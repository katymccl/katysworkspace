import type { ColumnProfile, IdentifierReason, InferredType, RawRow } from './types'
import { isMissing, toText } from './values'

const ID_WORDS: ReadonlySet<string> = new Set(['id', 'ids', 'identifier', 'uuid', 'guid'])

/**
 * Splits a header into lowercase words, breaking on punctuation, spaces, camelCase and letter/digit
 * boundaries: `"Library ID"` → `[library, id]`, `customerId` → `[customer, id]`,
 * `LibraryID` → `[library, id]`, `IDNumber` → `[id, number]`.
 */
export function headerWords(header: string): string[] {
  return header
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)|(\d)([a-zA-Z])/g, '$1$3 $2$4')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function isIdHeader(header: string): boolean {
  return headerWords(header).some((word) => ID_WORDS.has(word))
}

/** `Name`, `Library Name`, `first_name`, `username`, `surname`. */
export function isNameHeader(header: string): boolean {
  return headerWords(header).some(
    (word) => word === 'name' || (word.length > 4 && word.endsWith('name')),
  )
}

/** The entity an ID header identifies, e.g. `"Library ID"` → `"library"`; null when there is none. */
export function idEntity(header: string): string | null {
  const words = headerWords(header)
  if (!words.some((word) => ID_WORDS.has(word))) return null
  const entity = words.filter((word) => !ID_WORDS.has(word)).join(' ')
  return entity || null
}

const CODE_SHAPE = /^[A-Za-z0-9]+(?:[-_.:/#][A-Za-z0-9]+)*$/

/**
 * A code-like value: one token without spaces that has a letter and also a digit or a separator.
 * `L-IHL`, `SKU123`, `a1b2`, UUIDs: yes. `London`, `SHIPPED`, `02134`, `42`: no. All-capital
 * words alone don't count, since they are usually status or category labels.
 */
export function looksLikeIdValue(text: string): boolean {
  const value = text.trim()
  if (value.length < 2 || value.length > 64 || !CODE_SHAPE.test(value)) return false
  if (!/[A-Za-z]/.test(value)) return false
  return /\d/.test(value) || /[-_.:/#]/.test(value)
}

/** Below this many values, uniqueness is too likely to be a coincidence to trust for numbers. */
export const MIN_VALUES_FOR_UNIQUENESS = 20
export const MOSTLY_UNIQUE_RATIO = 0.9
export const PAIR_CONSISTENCY = 0.9
/** Pairing compares columns two at a time, so it looks at the first rows only to stay fast. */
export const PAIR_SAMPLE_ROWS = 10_000
const MAX_PAIR_CANDIDATES = 30
const KEY_TYPES: ReadonlySet<InferredType> = new Set(['integer', 'string'])

interface ColumnFacts {
  name: string
  inferredType: InferredType
  missingCount: number
  nonMissingCount: number
  isUnique: boolean
  distinctCount: number
  uniquenessRatio: number
  /** Distinct values that occur more than once. */
  repeatedValueCount: number
  /** Whether every non-missing value passed `looksLikeIdValue`. */
  allValuesIdLike: boolean
}

/** Identifier reasons that depend on this column alone, in a fixed order. */
export function columnIdentifierReasons(facts: ColumnFacts): IdentifierReason[] {
  if (facts.inferredType === 'empty') return []
  const reasons: IdentifierReason[] = []
  const isKeyType = KEY_TYPES.has(facts.inferredType)
  const enoughValues = facts.nonMissingCount >= MIN_VALUES_FOR_UNIQUENESS

  if (isIdHeader(facts.name)) reasons.push({ kind: 'id-header' })
  if (isNameHeader(facts.name)) reasons.push({ kind: 'name-header' })
  if (facts.inferredType === 'string' && facts.allValuesIdLike && facts.distinctCount >= 2) {
    reasons.push({ kind: 'id-like-values' })
  }
  if (
    facts.isUnique &&
    facts.missingCount === 0 &&
    facts.nonMissingCount >= 2 &&
    // Unique numbers in a small file are usually measurements that happen not to repeat.
    (facts.inferredType === 'string' || (facts.inferredType === 'integer' && enoughValues))
  ) {
    reasons.push({ kind: 'unique-values' })
  }
  if (
    isKeyType &&
    enoughValues &&
    !facts.isUnique &&
    facts.uniquenessRatio >= MOSTLY_UNIQUE_RATIO
  ) {
    reasons.push({ kind: 'mostly-unique', repeatedValueCount: facts.repeatedValueCount })
  }
  return reasons
}

/**
 * Adds reasons that compare columns, returning new column objects (the inputs are not modified):
 * - entity-name: the header is the entity of an ID column, such as `Library` next to `Library ID`
 * - paired-values: the column's values repeat in step with another column's
 */
export function withCrossColumnReasons(
  columns: readonly ColumnProfile[],
  rows: readonly RawRow[],
  missingTokens: ReadonlySet<string>,
): ColumnProfile[] {
  const extra = new Map<number, IdentifierReason[]>()
  const add = (index: number, reason: IdentifierReason) =>
    extra.set(index, [...(extra.get(index) ?? []), reason])

  const idColumnByEntity = new Map<string, string>()
  for (const column of columns) {
    const entity = idEntity(column.name)
    if (entity !== null && !idColumnByEntity.has(entity)) idColumnByEntity.set(entity, column.name)
  }
  for (const column of columns) {
    const idColumn = idColumnByEntity.get(headerWords(column.name).join(' '))
    if (idColumn !== undefined && idColumn !== column.name && column.inferredType !== 'empty') {
      add(column.index, { kind: 'entity-name', idColumn })
    }
  }

  for (const [index, withColumn] of pairedColumns(columns, rows, missingTokens)) {
    add(index, { kind: 'paired-values', withColumn })
  }

  return columns.map((column) => {
    const added = extra.get(column.index)
    if (!added) return column
    const identifierReasons = [...column.identifierReasons, ...added]
    return { ...column, identifierReasons, isPotentialIdentifier: true }
  })
}

/**
 * Finds columns that repeat in step: whenever a value in one column repeats, the value beside it in
 * the other column repeats too (in both directions, for at least PAIR_CONSISTENCY of the rows), the
 * way `Library ID` and `Library` move together. Returns each paired column's index and its best
 * partner's name.
 */
function pairedColumns(
  columns: readonly ColumnProfile[],
  rows: readonly RawRow[],
  missingTokens: ReadonlySet<string>,
): Map<number, string> {
  const sample = rows.slice(0, PAIR_SAMPLE_ROWS)
  const candidates = columns
    .filter(
      (c) =>
        KEY_TYPES.has(c.inferredType) &&
        c.distinctCount >= 3 &&
        c.distinctCount < c.nonMissingCount,
    )
    .slice(0, MAX_PAIR_CANDIDATES)
    .map((c) => ({ column: c, codes: encode(sample, c.name, missingTokens) }))

  const best = new Map<number, { withColumn: string; score: number }>()
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]
      const b = candidates[j]
      const score = pairConsistency(a.codes, b.codes)
      if (score < PAIR_CONSISTENCY) continue
      for (const [self, other] of [
        [a, b],
        [b, a],
      ]) {
        const current = best.get(self.column.index)
        // Strictly greater keeps the earliest partner on ties, so results are stable.
        if (!current || score > current.score) {
          best.set(self.column.index, { withColumn: other.column.name, score })
        }
      }
    }
  }
  return new Map([...best].map(([index, { withColumn }]) => [index, withColumn]))
}

/** Each row's value as a small integer code, or -1 when missing. */
function encode(
  rows: readonly RawRow[],
  name: string,
  missingTokens: ReadonlySet<string>,
): Int32Array {
  const ids = new Map<string, number>()
  const codes = new Int32Array(rows.length)
  rows.forEach((row, i) => {
    const value = row[name]
    if (isMissing(value, missingTokens)) {
      codes[i] = -1
      return
    }
    const text = toText(value)
    let id = ids.get(text)
    if (id === undefined) ids.set(text, (id = ids.size))
    codes[i] = id
  })
  return codes
}

/**
 * How consistently two columns move together, from 0 to 1: the share of rows that agree with the
 * most common partner of their value, taking the weaker of the two directions. Columns that barely
 * repeat in the compared rows score 0, since any unique column trivially "agrees" with anything.
 */
export function pairConsistency(a: Int32Array, b: Int32Array): number {
  const pairs = new Map<number, Map<number, number>>()
  const reverse = new Map<number, Map<number, number>>()
  let n = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 0 || b[i] < 0) continue
    n++
    bump(pairs, a[i], b[i])
    bump(reverse, b[i], a[i])
  }
  // Each side needs real repetition: at most 80% distinct values among the compared rows.
  if (n === 0 || pairs.size > n * 0.8 || reverse.size > n * 0.8) return 0
  return Math.min(agreement(pairs), agreement(reverse)) / n
}

function bump(map: Map<number, Map<number, number>>, key: number, partner: number) {
  let partners = map.get(key)
  if (!partners) map.set(key, (partners = new Map()))
  partners.set(partner, (partners.get(partner) ?? 0) + 1)
}

function agreement(map: Map<number, Map<number, number>>): number {
  let total = 0
  for (const partners of map.values()) total += Math.max(...partners.values())
  return total
}
