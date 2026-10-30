/**
 * Measures how datasets' columns overlap, from their actual values, as evidence for Claude, which
 * decides what is related. Nothing here decides: every pair of columns that shares a value is
 * measured, and every pair of datasets that shares most column names is noted. Pure and
 * deterministic, independent of React and AI: the same datasets always give the same measurements,
 * in the same order.
 *
 * Two kinds of evidence:
 * - column overlaps: values of a column in one dataset that reappear in a column of another (e.g.
 *   Staff."Library ID" values all exist in Libraries."Library ID"). Time columns are compared as
 *   periods, so a `Month` of `Jan 2024` meets one of `2024-01`.
 * - similar structure: two datasets that share most of their column names (e.g. monthly exports)
 */
import { headerWords, idEntity, isIdHeader } from '../profiling/identifiers'
import type { ColumnProfile, DatasetProfile, RawRow } from '../profiling/types'
import { classifyValue, isMissing } from '../profiling/values'
import { periodColumn, periodKey, type PeriodGrain } from './periods'

export interface RelationshipInput {
  /** Stable key for the dataset within this analysis (e.g. its datasetId). */
  key: string
  /** Used to recognise `customer_id` → the `id` column of `customers.csv`. */
  fileName: string
  columns: readonly string[]
  rows: readonly RawRow[]
  profile: DatasetProfile
}

export interface ColumnRef {
  dataset: string
  column: string
}

export type Cardinality = 'one-to-one' | 'many-to-one' | 'many-to-many'

/** How two columns' values overlap. A measurement, not a judgement that they're related. */
export interface KeyLinkCandidate {
  kind: 'key-link'
  /** Stable id derived from the endpoints, e.g. `staff:Library ID->libraries:Library ID`. */
  id: string
  /** The "many" side when there is one: the column that would refer to the other. */
  from: ColumnRef
  /** The "one" side when there is one: usually a unique key. */
  to: ColumnRef
  cardinality: Cardinality
  /** Distinct values found in both columns. */
  sharedCount: number
  /** Share of `from`'s distinct values that also appear in `to` (0–1). */
  fromCoverage: number
  /** Share of `to`'s distinct values that also appear in `from` (0–1). */
  toCoverage: number
  /** The column names suggest a link (same words, or an ID named after the other dataset). */
  namesMatch: boolean
  /**
   * For two time columns, the kind of period they share; values were matched as periods, so
   * `Jan 2024` met `2024-01`. Null for other columns.
   */
  period: PeriodGrain | null
  /** Up to five shared values, sorted, as examples. */
  sharedExamples: string[]
}

export interface SimilarStructureCandidate {
  kind: 'similar-structure'
  id: string
  datasets: [string, string]
  sharedColumns: string[]
  /** Shared column names / all distinct column names across both (0–1). */
  similarity: number
}

export type RelationshipCandidate = KeyLinkCandidate | SimilarStructureCandidate

/** Distinct values kept per column; larger columns are compared on their first distinct values. */
export const MAX_DISTINCT_PER_COLUMN = 100_000
/** Datasets sharing at least this share of their column names are noted as similar. */
const SIMILAR_STRUCTURE_THRESHOLD = 0.6
/** Yes/no and empty columns overlap with any other of their kind, which says nothing. */
const SKIPPED_TYPES = new Set(['empty', 'boolean'])
const PERIOD_SAMPLE_ROWS = 10_000

interface ColumnValues {
  ref: ColumnRef
  profile: ColumnProfile
  words: string[]
  /** Normalised value (or period key) → the first original text seen, used for display. */
  values: Map<string, string>
  /** The kind of period a time column holds; null for other columns. */
  period: PeriodGrain | null
  /** Whether every value is present and different (for time columns: every period). */
  unique: boolean
}

/**
 * Measures every pair of datasets: each pair of columns sharing at least one value, and whether
 * the datasets share most of their column names. Overlaps come first, those with matching names
 * and the most shared values leading, so the strongest evidence survives any limit on how many
 * are sent.
 */
export function measureOverlaps(datasets: readonly RelationshipInput[]): RelationshipCandidate[] {
  const columnsByDataset = datasets.map(measuredColumns)
  const candidates: RelationshipCandidate[] = []
  for (let i = 0; i < datasets.length; i++) {
    for (let j = i + 1; j < datasets.length; j++) {
      for (const x of columnsByDataset[i]) {
        for (const y of columnsByDataset[j]) {
          const overlap = compareColumns(x, datasets[i], y, datasets[j])
          if (overlap.sharedCount > 0) candidates.push(overlap)
        }
      }
      const similar = similarStructure(datasets[i], datasets[j])
      if (similar) candidates.push(similar)
    }
  }
  return candidates.sort(compareCandidates)
}

/**
 * How two particular columns overlap, even when they share nothing: for showing the evidence
 * behind a link Claude suggested or the user drew. Null when a dataset or column isn't open.
 */
export function measureLink(
  datasets: readonly RelationshipInput[],
  a: ColumnRef,
  b: ColumnRef,
): KeyLinkCandidate | null {
  const da = datasets.find((d) => d.key === a.dataset)
  const db = datasets.find((d) => d.key === b.dataset)
  const ca = da?.profile.columns.find((c) => c.name === a.column)
  const cb = db?.profile.columns.find((c) => c.name === b.column)
  if (!da || !db || !ca || !cb) return null
  return compareColumns(columnValues(da, ca), da, columnValues(db, cb), db)
}

/**
 * Normalises a cell for comparison across files: numbers by value (`1,000` = `1000`), text trimmed
 * and case-insensitive. Missing values are dropped.
 */
export function normaliseValue(value: unknown): string | null {
  if (isMissing(value)) return null
  const classified = classifyValue(value)
  if (classified.number !== undefined) return `#${classified.number}`
  return String(value).trim().toLowerCase()
}

function measuredColumns(dataset: RelationshipInput): ColumnValues[] {
  return dataset.profile.columns
    .filter((c) => !SKIPPED_TYPES.has(c.inferredType) && c.distinctCount >= 1)
    .map((profile) => columnValues(dataset, profile))
}

/** A column's distinct values, read as periods when it's a time column. */
function columnValues(dataset: RelationshipInput, profile: ColumnProfile): ColumnValues {
  // Judged on the different values among the first rows, which is quick on big files.
  const sample = new Set(dataset.rows.slice(0, PERIOD_SAMPLE_ROWS).map((r) => r[profile.name]))
  const period = periodColumn(profile.name, sample)
  const key = period
    ? (raw: unknown) => periodKey(raw, period)
    : (raw: unknown) => normaliseValue(raw)
  const values = new Map<string, string>()
  let present = 0
  for (const row of dataset.rows) {
    const raw = row[profile.name]
    const v = key(raw)
    if (v === null) continue
    present++
    if (values.size < MAX_DISTINCT_PER_COLUMN && !values.has(v)) values.set(v, String(raw).trim())
  }
  return {
    ref: { dataset: dataset.key, column: profile.name },
    profile,
    words: headerWords(profile.name),
    values,
    period,
    // Time columns repeat by period, so `Jan 2024` and `2024-01` in one column are a repeat.
    unique: period ? present > 0 && values.size === present : profile.isUnique,
  }
}

function compareColumns(
  x: ColumnValues,
  xDataset: RelationshipInput,
  y: ColumnValues,
  yDataset: RelationshipInput,
): KeyLinkCandidate {
  // A time column's values are period keys, which never equal another column's plain values.
  const shared: string[] = []
  if (x.period === y.period) {
    const [small, large] =
      x.values.size <= y.values.size ? [x.values, y.values] : [y.values, x.values]
    for (const v of small.keys()) if (large.has(v)) shared.push(v)
  }

  const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d)
  const xCoverage = ratio(shared.length, x.values.size)
  const yCoverage = ratio(shared.length, y.values.size)
  // Point from the "many" side to the "one" side; with no clear side, from the better-covered one.
  const forward =
    y.unique && !x.unique ? true : x.unique && !y.unique ? false : xCoverage >= yCoverage
  const [from, to] = forward ? [x, y] : [y, x]

  return {
    kind: 'key-link',
    id: `${refId(from.ref)}->${refId(to.ref)}`,
    from: from.ref,
    to: to.ref,
    cardinality:
      x.unique && y.unique ? 'one-to-one' : x.unique || y.unique ? 'many-to-one' : 'many-to-many',
    sharedCount: shared.length,
    fromCoverage: forward ? xCoverage : yCoverage,
    toCoverage: forward ? yCoverage : xCoverage,
    namesMatch: columnNamesMatch(x, xDataset, y, yDataset),
    period: x.period === y.period ? x.period : null,
    // Shown as written in the referring column (sorted for stable output).
    sharedExamples: shared
      .sort()
      .slice(0, 5)
      .map((v) => from.values.get(v)!),
  }
}

/**
 * Names suggest a link when the header words are the same (`Library ID` = `library_id` =
 * `LibraryID`), or when an ID column is named after the other dataset and that dataset's own ID
 * column is a bare `id` (`orders.customer_id` → `customers.id`).
 */
function columnNamesMatch(
  x: ColumnValues,
  xDataset: RelationshipInput,
  y: ColumnValues,
  yDataset: RelationshipInput,
): boolean {
  if (x.words.length > 0 && x.words.join(' ') === y.words.join(' ')) return true
  return (
    namedAfter(x.profile.name, y.profile.name, yDataset.fileName) ||
    namedAfter(y.profile.name, x.profile.name, xDataset.fileName)
  )
}

function namedAfter(refColumn: string, keyColumn: string, keyFileName: string): boolean {
  const entity = idEntity(refColumn)
  if (!entity || !isIdHeader(keyColumn) || idEntity(keyColumn) !== null) return false
  const datasetWords = headerWords(keyFileName.replace(/\.[^.]+$/, '')).map(singular)
  const entityWords = entity.split(' ').map(singular)
  return entityWords.every((w) => datasetWords.includes(w))
}

function singular(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
  return word
}

function similarStructure(
  a: RelationshipInput,
  b: RelationshipInput,
): SimilarStructureCandidate | null {
  const norm = (c: string) => headerWords(c).join(' ')
  const aNames = new Map(a.columns.map((c) => [norm(c), c]))
  const bNames = new Set(b.columns.map(norm))
  const shared = [...aNames.keys()].filter((n) => n && bNames.has(n))
  const union = new Set([...aNames.keys(), ...bNames])
  const similarity = union.size === 0 ? 0 : shared.length / union.size
  if (similarity < SIMILAR_STRUCTURE_THRESHOLD || shared.length < 2) return null
  return {
    kind: 'similar-structure',
    id: `${a.key}~${b.key}`,
    datasets: [a.key, b.key],
    sharedColumns: shared.map((n) => aNames.get(n)!).sort(),
    similarity,
  }
}

/** Similar datasets first (there are few), then overlaps with matching names and the most shared. */
function compareCandidates(a: RelationshipCandidate, b: RelationshipCandidate): number {
  if (a.kind !== b.kind) return a.kind === 'similar-structure' ? -1 : 1
  if (a.kind === 'key-link' && b.kind === 'key-link') {
    return (
      Number(b.namesMatch) - Number(a.namesMatch) ||
      b.sharedCount - a.sharedCount ||
      b.fromCoverage - a.fromCoverage ||
      compareText(a.id, b.id)
    )
  }
  return compareText(a.id, b.id)
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function refId(ref: ColumnRef): string {
  return `${ref.dataset}:${ref.column}`
}
