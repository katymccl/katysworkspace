import type { ColumnProfile, IdentifierReason, InferredType } from './types'

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

/** Below this many values, uniqueness alone is too likely to be a coincidence to trust. */
export const MIN_VALUES_FOR_UNIQUENESS = 20
/** Values with at least this many words read as sentences, which differ from row to row by chance. */
const PROSE_WORDS = 5
/** Share of steps that must go up for whole numbers to read as a running count. */
const SEQUENCE_RISING = 0.9
const KEY_TYPES: ReadonlySet<InferredType> = new Set(['integer', 'string'])

/** Free text such as a comment or description, rather than a name or code. */
export function looksLikeProse(text: string): boolean {
  return text.trim().split(/\s+/).length >= PROSE_WORDS
}

/**
 * Whole numbers that count up through the file without big gaps, like `1001, 1002, 1003`: at least
 * 90% of steps go up and the numbers span no more than twice their count. Amounts and ages that
 * happen not to repeat are rarely both in order and packed together.
 */
export function looksLikeSequence(numbers: readonly number[]): boolean {
  if (numbers.length < 2) return false
  let min = numbers[0]
  let max = numbers[0]
  let rising = 0
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] > numbers[i - 1]) rising++
    min = Math.min(min, numbers[i])
    max = Math.max(max, numbers[i])
  }
  return rising >= (numbers.length - 1) * SEQUENCE_RISING && max - min + 1 <= numbers.length * 2
}

interface ColumnFacts {
  name: string
  inferredType: InferredType
  missingCount: number
  nonMissingCount: number
  isUnique: boolean
  distinctCount: number
  /** Whether every non-missing value passed `looksLikeIdValue`. */
  allValuesIdLike: boolean
  /** Whether more than half of the distinct values passed `looksLikeProse`. */
  mostlyProse: boolean
  /** Whether the values, in file order, passed `looksLikeSequence`. */
  sequential: boolean
  /** The ID column this header names the entity of (`Library ID` for `Library`), if any. */
  entityOf: string | null
}

/**
 * Why a column could be this file's primary key, in a fixed order; empty when it can't be one.
 * Every row needs a value and no two may match. Header, code and entity evidence then lets a short
 * file's key count. Without it the column needs enough values, text must not be sentences and whole
 * numbers must count up, since small files, comments and measures are often unique by chance.
 */
export function columnIdentifierReasons(facts: ColumnFacts): IdentifierReason[] {
  if (
    !KEY_TYPES.has(facts.inferredType) ||
    !facts.isUnique ||
    facts.missingCount > 0 ||
    facts.nonMissingCount < 2
  ) {
    return []
  }
  const reasons: IdentifierReason[] = []
  if (isIdHeader(facts.name)) reasons.push({ kind: 'id-header' })
  if (isNameHeader(facts.name)) reasons.push({ kind: 'name-header' })
  if (facts.entityOf !== null) reasons.push({ kind: 'entity-name', idColumn: facts.entityOf })
  if (facts.inferredType === 'string' && facts.allValuesIdLike) {
    reasons.push({ kind: 'id-like-values' })
  }
  const sequential = facts.inferredType === 'integer' && facts.sequential
  const valuesLookLikeKeys = facts.inferredType === 'string' ? !facts.mostlyProse : sequential
  if (
    reasons.length === 0 &&
    (facts.nonMissingCount < MIN_VALUES_FOR_UNIQUENESS || !valuesLookLikeKeys)
  ) {
    return []
  }
  if (sequential) reasons.push({ kind: 'sequential-values' })
  return [...reasons, { kind: 'unique-values' }]
}

/**
 * Each header that names what an ID column identifies, mapped to that ID column: `Library` →
 * `Library ID`. The first ID column wins when two identify the same thing.
 */
export function entityNameColumns(headers: readonly string[]): Map<string, string> {
  const idColumnByEntity = new Map<string, string>()
  for (const header of headers) {
    const entity = idEntity(header)
    if (entity !== null && !idColumnByEntity.has(entity)) idColumnByEntity.set(entity, header)
  }
  const result = new Map<string, string>()
  for (const header of headers) {
    const idColumn = idColumnByEntity.get(headerWords(header).join(' '))
    if (idColumn !== undefined && idColumn !== header) result.set(header, idColumn)
  }
  return result
}

/**
 * Whether a column holds keys: its own (a starred primary key) or another file's, such as a
 * `Customer ID` that repeats in an orders file. Their values label records, so they are neither
 * amounts to add up nor categories to group by. A star the user removed counts as not a key.
 */
export function isKeyColumn(column: ColumnProfile): boolean {
  return column.isPotentialIdentifier || (!column.identifierDismissed && isIdHeader(column.name))
}
