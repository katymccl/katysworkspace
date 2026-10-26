import type {
  ColumnProfile,
  DatasetProfile,
  InferredType,
  NumericStats,
  ProfileInput,
  ProfileOptions,
  RawRow,
  ValueCount,
  ValueKind,
} from './types'
import { columnIdentifierReasons, looksLikeIdValue, withCrossColumnReasons } from './identifiers'
import {
  classifyValue,
  DEFAULT_MISSING_TOKENS,
  isMissing,
  missingTokenSet,
  toText,
  type Classified,
} from './values'

/** Key PapaParse puts extra fields under when a row has more fields than the header. */
export const EXTRA_FIELDS_KEY = '__parsed_extra'

const DEFAULT_SAMPLE_SIZE = 5
const DEFAULT_TOP_VALUES_LIMIT = 10

/** Fixed order used to break ties, so results never depend on input order. */
const KIND_ORDER: readonly ValueKind[] = ['integer', 'decimal', 'boolean', 'date', 'string']
const CATEGORICAL_TYPES: ReadonlySet<InferredType> = new Set(['string', 'boolean', 'mixed'])

/**
 * Profiles a parsed CSV. Pure and deterministic: the input is only read, never modified, and the
 * same input and options always give the same result.
 */
export function profileDataset(input: ProfileInput, options: ProfileOptions = {}): DatasetProfile {
  const settings = {
    sampleSize: Math.max(0, options.sampleSize ?? DEFAULT_SAMPLE_SIZE),
    topValuesLimit: Math.max(0, options.topValuesLimit ?? DEFAULT_TOP_VALUES_LIMIT),
    missingTokens: missingTokenSet(options.missingTokens ?? DEFAULT_MISSING_TOKENS),
  }
  const { columns, rows } = input

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    malformedRowCount: rows.filter((row) => isMalformed(row, columns)).length,
    columns: withCrossColumnReasons(
      columns.map((name, index) => profileColumn(name, index, rows, settings)),
      rows,
      settings.missingTokens,
    ),
  }
}

function isMalformed(row: RawRow, columns: readonly string[]): boolean {
  return EXTRA_FIELDS_KEY in row || columns.some((col) => !(col in row))
}

interface Settings {
  sampleSize: number
  topValuesLimit: number
  missingTokens: ReadonlySet<string>
}

function profileColumn(
  name: string,
  index: number,
  rows: readonly RawRow[],
  settings: Settings,
): ColumnProfile {
  const kindCounts: Record<ValueKind, number> = {
    integer: 0,
    decimal: 0,
    boolean: 0,
    date: 0,
    string: 0,
  }
  const valueCounts = new Map<string, number>()
  const numbers: number[] = []
  const sampleValues: string[] = []
  // Columns repeat values heavily, so each distinct text is checked once (null = missing).
  const classifiedByText = new Map<string, Classified | null>()
  let missingCount = 0

  for (const row of rows) {
    const value = row[name]
    const text = value === null || value === undefined ? null : toText(value)
    let classified = text === null ? null : classifiedByText.get(text)
    if (classified === undefined) {
      classified = isMissing(text, settings.missingTokens) ? null : classifyValue(text)
      classifiedByText.set(text!, classified)
    }
    if (text === null || classified === null) {
      missingCount++
      continue
    }

    kindCounts[classified.kind]++
    if (classified.number !== undefined) numbers.push(classified.number)

    const seen = valueCounts.get(text)
    valueCounts.set(text, (seen ?? 0) + 1)
    if (seen === undefined && sampleValues.length < settings.sampleSize) sampleValues.push(text)
  }

  const nonMissingCount = rows.length - missingCount
  const distinctCount = valueCounts.size
  const inferredType = inferType(kindCounts)
  const isUnique = nonMissingCount > 0 && distinctCount === nonMissingCount
  const identifierReasons = columnIdentifierReasons({
    name,
    inferredType,
    missingCount,
    nonMissingCount,
    isUnique,
    distinctCount,
    uniquenessRatio: ratio(distinctCount, nonMissingCount),
    repeatedValueCount: countRepeated(valueCounts),
    // Checked per distinct value, and only where the code-like-values reason can apply.
    allValuesIdLike: inferredType === 'string' && [...valueCounts.keys()].every(looksLikeIdValue),
  })

  return {
    name,
    index,
    inferredType,
    dominantKind: dominantKind(kindCounts),
    kindCounts,
    missingCount,
    missingRatio: ratio(missingCount, rows.length),
    nonMissingCount,
    distinctCount,
    uniquenessRatio: ratio(distinctCount, nonMissingCount),
    isUnique,
    isPotentialIdentifier: identifierReasons.length > 0,
    identifierReasons,
    sampleValues,
    numericStats:
      inferredType === 'integer' || inferredType === 'decimal' ? numericStats(numbers) : null,
    topValues: CATEGORICAL_TYPES.has(inferredType)
      ? topValues(valueCounts, nonMissingCount, settings.topValuesLimit)
      : null,
  }
}

export function inferType(kindCounts: Readonly<Record<ValueKind, number>>): InferredType {
  const present = KIND_ORDER.filter((kind) => kindCounts[kind] > 0)
  if (present.length === 0) return 'empty'
  if (present.length === 1) return present[0]
  if (present.every((kind) => kind === 'integer' || kind === 'decimal')) return 'decimal'
  return 'mixed'
}

function dominantKind(kindCounts: Readonly<Record<ValueKind, number>>): ValueKind | null {
  let best: ValueKind | null = null
  for (const kind of KIND_ORDER) {
    if (kindCounts[kind] > 0 && (best === null || kindCounts[kind] > kindCounts[best])) best = kind
  }
  return best
}

/** Min, max, mean and median of a non-empty list; null for an empty one. */
export function numericStats(values: readonly number[]): NumericStats | null {
  if (values.length === 0) return null
  // Float64Array sorts numerically, and copying keeps the caller's array untouched.
  const sorted = Float64Array.from(values).sort()
  const mid = sorted.length >> 1
  let sum = 0
  for (const v of sorted) sum += v

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median: sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
  }
}

function topValues(
  counts: ReadonlyMap<string, number>,
  total: number,
  limit: number,
): ValueCount[] {
  return (
    [...counts]
      // Ties are broken by code-unit order rather than localeCompare, which varies by locale.
      .sort(([a, ca], [b, cb]) => cb - ca || (a < b ? -1 : a > b ? 1 : 0))
      .slice(0, limit)
      .map(([value, count]) => ({ value, count, ratio: ratio(count, total) }))
  )
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole
}

function countRepeated(counts: ReadonlyMap<string, number>): number {
  let repeated = 0
  for (const count of counts.values()) if (count > 1) repeated++
  return repeated
}
