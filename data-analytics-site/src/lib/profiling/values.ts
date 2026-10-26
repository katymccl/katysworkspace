import type { RawValue, ValueKind } from './types'

export const DEFAULT_MISSING_TOKENS: readonly string[] = ['', 'na', 'n/a', 'null', 'none', 'nan']

/** Builds the lookup used by `isMissing` from user-facing tokens. */
export function missingTokenSet(tokens: readonly string[] = DEFAULT_MISSING_TOKENS): Set<string> {
  return new Set(tokens.map((t) => t.trim().toLowerCase()))
}

const DEFAULT_TOKEN_SET = missingTokenSet()

export function isMissing(value: RawValue, tokens: ReadonlySet<string> = DEFAULT_TOKEN_SET): boolean {
  if (value === null || value === undefined) return true
  return tokens.has(toText(value).trim().toLowerCase())
}

/** The text of a cell, without changing strings in any way. */
export function toText(value: RawValue): string {
  return typeof value === 'string' ? value : String(value)
}

const INTEGER = /^[+-]?(?:0|[1-9]\d*)$/
const INTEGER_GROUPED = /^[+-]?[1-9]\d{0,2}(?:,\d{3})+$/
const LEADING_ZERO = /^[+-]?0\d+$/
const DECIMAL = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/
const DECIMAL_GROUPED = /^[+-]?[1-9]\d{0,2}(?:,\d{3})+\.\d+$/
const BOOLEAN = new Set(['true', 'false', 'yes', 'no'])
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

export interface Classified {
  kind: ValueKind
  /** The numeric value for `integer` and `decimal` kinds. */
  number?: number
}

/** Classifies one non-missing cell. Pure and locale-independent. */
export function classifyValue(value: RawValue): Classified {
  const text = toText(value).trim()

  if (BOOLEAN.has(text.toLowerCase())) return { kind: 'boolean' }

  // Leading zeros usually mean an identifier (ZIP code, account number), not a quantity.
  if (!LEADING_ZERO.test(text)) {
    if (INTEGER.test(text) || INTEGER_GROUPED.test(text)) {
      const n = Number(text.replaceAll(',', ''))
      if (Number.isFinite(n)) return { kind: 'integer', number: n }
    }
    if (DECIMAL.test(text) || DECIMAL_GROUPED.test(text)) {
      const n = Number(text.replaceAll(',', ''))
      if (Number.isFinite(n)) return { kind: 'decimal', number: n }
    }
  }

  if (isDate(text)) return { kind: 'date' }
  return { kind: 'string' }
}

function isDate(text: string): boolean {
  const iso = ISO_DATE.exec(text)
  if (iso) {
    const [, y, m, d, hh = '0', mm = '0', ss = '0'] = iso
    return isCalendarDay(+y, +m, +d) && +hh < 24 && +mm < 60 && +ss < 60
  }
  const slash = SLASH_DATE.exec(text)
  if (slash) {
    const [a, b, y] = [+slash[1], +slash[2], +slash[3]]
    // Accept either month-first or day-first, as long as one reading is a real day.
    return isCalendarDay(y, a, b) || isCalendarDay(y, b, a)
  }
  return false
}

function isCalendarDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= daysInMonth
}
