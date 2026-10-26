/**
 * Finds likely relationships between datasets from their actual values. Pure and deterministic,
 * independent of React and AI: the same datasets always give the same candidates, in the same order.
 *
 * Two kinds of evidence:
 * - key links: a column in one dataset whose values reappear in a column of another
 *   (e.g. Staff."Library ID" values all exist in Libraries."Library ID")
 * - similar structure: two datasets that share most of their column names (e.g. monthly exports)
 */
import { headerWords, idEntity, isIdHeader } from '../profiling/identifiers'
import type { ColumnProfile, DatasetProfile, RawRow } from '../profiling/types'
import { classifyValue, isMissing } from '../profiling/values'

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
export type Strength = 'strong' | 'moderate' | 'weak'

export interface KeyLinkCandidate {
  kind: 'key-link'
  /** Stable id derived from the endpoints, e.g. `staff:Library ID->libraries:Library ID`. */
  id: string
  /** The "many" side when there is one: the column that refers to the other. */
  from: ColumnRef
  /** The "one" side when there is one: usually a unique key. */
  to: ColumnRef
  cardinality: Cardinality
  strength: Strength
  /** Distinct values found in both columns. */
  sharedCount: number
  /** Share of `from`'s distinct values that also appear in `to` (0–1). */
  fromCoverage: number
  /** Share of `to`'s distinct values that also appear in `from` (0–1). */
  toCoverage: number
  /** The column names suggest the link (same words, or an ID named after the other dataset). */
  namesMatch: boolean
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
const MIN_SHARED = 2
const MIN_COVERAGE = 0.6
const MIN_DISTINCT_WITHOUT_NAME_MATCH = 3
const MAX_LINKS_PER_COLUMN = 2
const SIMILAR_STRUCTURE_THRESHOLD = 0.6
const LINKABLE_TYPES = new Set(['integer', 'string', 'mixed'])

interface ColumnValues {
  ref: ColumnRef
  profile: ColumnProfile
  words: string[]
  /** Normalised value → the first original text seen, used for display. */
  values: Map<string, string>
}

/** Detects relationship candidates between every pair of datasets. */
export function detectRelationships(
  datasets: readonly RelationshipInput[],
): RelationshipCandidate[] {
  const columnsByDataset = datasets.map(linkableColumns)
  const candidates: RelationshipCandidate[] = []

  for (let i = 0; i < datasets.length; i++) {
    for (let j = i + 1; j < datasets.length; j++) {
      const links = keyLinks(datasets[i], columnsByDataset[i], datasets[j], columnsByDataset[j])
      const similar = similarStructure(datasets[i], datasets[j])
      if (similar) {
        // Parallel copies (e.g. monthly exports) share values in their same-named columns; that's
        // the "same columns" relationship, not one dataset referring to the other.
        candidates.push(similar, ...links.filter((l) => !sameColumnName(l.from, l.to)))
      } else {
        candidates.push(...links)
      }
    }
  }
  return pruneLinks(candidates).sort(compareCandidates)
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

function linkableColumns(dataset: RelationshipInput): ColumnValues[] {
  return dataset.profile.columns
    .filter((c) => LINKABLE_TYPES.has(c.inferredType) && c.distinctCount >= 1)
    .map((profile) => {
      const values = new Map<string, string>()
      for (const row of dataset.rows) {
        if (values.size >= MAX_DISTINCT_PER_COLUMN) break
        const raw = row[profile.name]
        const v = normaliseValue(raw)
        if (v !== null && !values.has(v)) values.set(v, String(raw).trim())
      }
      return {
        ref: { dataset: dataset.key, column: profile.name },
        profile,
        words: headerWords(profile.name),
        values,
      }
    })
}

function keyLinks(
  a: RelationshipInput,
  aColumns: ColumnValues[],
  b: RelationshipInput,
  bColumns: ColumnValues[],
): KeyLinkCandidate[] {
  const links: KeyLinkCandidate[] = []
  for (const x of aColumns) {
    for (const y of bColumns) {
      const link = compareColumns(x, a, y, b)
      if (link) links.push(link)
    }
  }
  return links
}

function compareColumns(
  x: ColumnValues,
  xDataset: RelationshipInput,
  y: ColumnValues,
  yDataset: RelationshipInput,
): KeyLinkCandidate | null {
  if (x.values.size === 0 || y.values.size === 0) return null
  const [small, large] =
    x.values.size <= y.values.size ? [x.values, y.values] : [y.values, x.values]
  const shared: string[] = []
  for (const v of small.keys()) if (large.has(v)) shared.push(v)

  const namesMatch = columnNamesMatch(x, xDataset, y, yDataset)
  const xCoverage = shared.length / x.values.size
  const yCoverage = shared.length / y.values.size
  const coverage = Math.max(xCoverage, yCoverage)
  const minDistinct = Math.min(x.values.size, y.values.size)

  // Value evidence: enough shared values, covering most of one side. Small vocabularies (yes/no,
  // a handful of categories) overlap by coincidence, so they need matching names as well.
  const valueEvidence =
    shared.length >= MIN_SHARED &&
    coverage >= MIN_COVERAGE &&
    (minDistinct >= MIN_DISTINCT_WITHOUT_NAME_MATCH || namesMatch)
  const nameEvidence = namesMatch && shared.length >= 1
  if (!valueEvidence && !nameEvidence) return null

  const xUnique = x.profile.isUnique
  const yUnique = y.profile.isUnique
  // Point from the "many" side to the "one" side; with no clear side, from the better-covered one.
  const forward = yUnique && !xUnique ? true : xUnique && !yUnique ? false : xCoverage >= yCoverage
  const [from, to] = forward ? [x, y] : [y, x]
  const [fromCoverage, toCoverage] = forward ? [xCoverage, yCoverage] : [yCoverage, xCoverage]
  const cardinality: Cardinality =
    xUnique && yUnique ? 'one-to-one' : xUnique || yUnique ? 'many-to-one' : 'many-to-many'

  const strength: Strength =
    valueEvidence && fromCoverage >= 0.9 && (namesMatch || to.profile.isUnique)
      ? 'strong'
      : valueEvidence
        ? 'moderate'
        : 'weak'

  return {
    kind: 'key-link',
    id: `${refId(from.ref)}->${refId(to.ref)}`,
    from: from.ref,
    to: to.ref,
    cardinality,
    strength,
    sharedCount: shared.length,
    fromCoverage,
    toCoverage,
    namesMatch,
    // Shown as written in the referring column (sorted for stable output).
    sharedExamples: shared
      .sort()
      .slice(0, 5)
      .map((v) => from.values.get(v)!),
  }
}

function sameColumnName(a: ColumnRef, b: ColumnRef): boolean {
  return headerWords(a.column).join(' ') === headerWords(b.column).join(' ')
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

const STRENGTH_RANK: Record<Strength, number> = { strong: 0, moderate: 1, weak: 2 }

/** Keeps each column's best few links, so one busy column doesn't connect to everything. */
function pruneLinks(candidates: RelationshipCandidate[]): RelationshipCandidate[] {
  const links = candidates.filter((c): c is KeyLinkCandidate => c.kind === 'key-link')
  const ranked = [...links].sort(compareLinks)
  const perColumn = new Map<string, number>()
  const kept = new Set<string>()
  for (const link of ranked) {
    const ends = [refId(link.from), refId(link.to)]
    if (ends.some((e) => (perColumn.get(e) ?? 0) >= MAX_LINKS_PER_COLUMN)) continue
    ends.forEach((e) => perColumn.set(e, (perColumn.get(e) ?? 0) + 1))
    kept.add(link.id)
  }
  return candidates.filter((c) => c.kind !== 'key-link' || kept.has(c.id))
}

function compareLinks(a: KeyLinkCandidate, b: KeyLinkCandidate): number {
  return (
    STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength] ||
    Number(b.namesMatch) - Number(a.namesMatch) ||
    b.fromCoverage - a.fromCoverage ||
    b.sharedCount - a.sharedCount ||
    compareText(a.id, b.id)
  )
}

function compareCandidates(a: RelationshipCandidate, b: RelationshipCandidate): number {
  if (a.kind !== b.kind) return a.kind === 'key-link' ? -1 : 1
  if (a.kind === 'key-link' && b.kind === 'key-link') return compareLinks(a, b)
  return compareText(a.id, b.id)
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function refId(ref: ColumnRef): string {
  return `${ref.dataset}:${ref.column}`
}
