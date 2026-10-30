import { classifyValue } from '../profiling'

/**
 * Reads dates written in the many ways people type them, so "Prepare my data" can rewrite a column
 * in one format. Pure. Only whole days are read: values with a time are left alone.
 */

/** Which number comes first in dates like `01/04/2024`: the day (1 April) or the month (4 January). */
export type DayMonthOrder = 'day-first' | 'month-first'

export interface DateReading {
  year: number
  /** Known when the year comes first or the month is a name. */
  month?: number
  day?: number
  /** For numbers-only dates with the year last: the first two numbers, in the order written. */
  pair?: [number, number]
}

export interface CalendarDay {
  year: number
  month: number
  day: number
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]
const SEP = '[\\s\\-/.]+'
const ORDINAL = '(?:st|nd|rd|th)?'
const YEAR_FIRST = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
const YEAR_LAST = /^(\d{1,2})([-/.])(\d{1,2})\2(\d{2}|\d{4})$/
const DAY_NAME_YEAR = new RegExp(`^(\\d{1,2})${ORDINAL}${SEP}([A-Za-z]{3,9})\\.?,?${SEP}(\\d{2}|\\d{4})$`)
const NAME_DAY_YEAR = new RegExp(`^([A-Za-z]{3,9})\\.?${SEP}(\\d{1,2})${ORDINAL},?${SEP}(\\d{2}|\\d{4})$`)

/** A month from its full name or a short form of at least three letters (`Jan`, `Sept`). */
export function monthNumber(name: string): number | undefined {
  const lower = name.toLowerCase()
  const index = MONTHS.findIndex((m) => m === lower || (lower.length >= 3 && m.startsWith(lower)))
  return index === -1 ? undefined : index + 1
}

/** Two-digit years: 00–69 are 2000s, 70–99 are 1900s. */
export function fullYear(text: string): number {
  const year = Number(text)
  if (text.length === 4) return year
  return year < 70 ? 2000 + year : 1900 + year
}

/** How a date cell is written, or null when it isn't a whole-day date this module reads. */
export function readDate(value: string): DateReading | null {
  const text = value.trim()
  let match = YEAR_FIRST.exec(text)
  if (match) return checked({ year: +match[1], month: +match[2], day: +match[3] })

  match = YEAR_LAST.exec(text)
  if (match) {
    const reading: DateReading = { year: fullYear(match[4]), pair: [+match[1], +match[3]] }
    return resolveDate(reading, 'day-first') || resolveDate(reading, 'month-first') ? reading : null
  }

  match = DAY_NAME_YEAR.exec(text)
  if (match) {
    const month = monthNumber(match[2])
    return month ? checked({ year: fullYear(match[3]), month, day: +match[1] }) : null
  }

  match = NAME_DAY_YEAR.exec(text)
  if (match) {
    const month = monthNumber(match[1])
    return month ? checked({ year: fullYear(match[3]), month, day: +match[2] }) : null
  }
  return null
}

function checked(reading: DateReading): DateReading | null {
  return resolveDate(reading, 'month-first') ? reading : null
}

/** The calendar day a reading stands for, reading `pair` in the given order; null if not a real day. */
export function resolveDate(reading: DateReading, order: DayMonthOrder): CalendarDay | null {
  const [month, day] = reading.pair
    ? order === 'day-first'
      ? [reading.pair[1], reading.pair[0]]
      : reading.pair
    : [reading.month!, reading.day!]
  if (month < 1 || month > 12 || day < 1) return null
  if (day > new Date(Date.UTC(reading.year, month, 0)).getUTCDate()) return null
  return { year: reading.year, month, day }
}

/** `2024-01-03`: the format every standardised date is written in, which sorts and is read as a date. */
export function isoDate({ year, month, day }: CalendarDay): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

/** The value rewritten as `YYYY-MM-DD`, or null when it can't be read in that order. */
export function standardiseDate(value: string, order: DayMonthOrder): string | null {
  const reading = readDate(value)
  const day = reading && resolveDate(reading, order)
  return day ? isoDate(day) : null
}

/**
 * The shape of a date as written, so `01/04/2024` and `1/4/2024` count as different ways but two
 * days in one style count once: digits become 9, month names become `Mon` or `Month`.
 */
export function dateShape(value: string): string {
  return value
    .trim()
    .replace(/\d/g, '9')
    .replace(/[A-Za-z]{3,}/g, (word) => (monthNumber(word) ? (word.length > 3 ? 'Month' : 'Mon') : word))
}

export interface DateColumnFacts {
  /** One example of each way the dates are written, most common first. */
  formats: { example: string; count: number }[]
  /**
   * The day/month order the values show: a first number over 12 means day first, a second one
   * means month first. `null` when nothing shows it or the values disagree, so the user picks;
   * `undefined` when no value depends on it.
   */
  order: DayMonthOrder | null | undefined
  /** A value whose meaning depends on the order, to ask the user about. */
  ambiguousExample: string | null
  readable: number
  /** Rows whose value isn't a date this module reads. */
  unreadable: number[]
}

/** What a column's non-missing values say about its dates. `values` are [row, value] pairs. */
export function describeDates(values: readonly (readonly [number, string])[]): DateColumnFacts {
  const formats = new Map<string, { example: string; count: number }>()
  const unreadable: number[] = []
  let dayFirst = 0
  let monthFirst = 0
  let dependsOnOrder = false
  let ambiguousExample: string | null = null

  for (const [row, value] of values) {
    const reading = readDate(value)
    if (!reading) {
      unreadable.push(row)
      continue
    }
    const shape = dateShape(value)
    const seen = formats.get(shape)
    if (seen) seen.count++
    else formats.set(shape, { example: value.trim(), count: 1 })

    if (reading.pair) {
      dependsOnOrder = true
      const [first, second] = reading.pair
      if (first > 12) dayFirst++
      else if (second > 12) monthFirst++
      else if (first !== second) ambiguousExample ??= value.trim()
    }
  }

  const order = !dependsOnOrder
    ? undefined
    : dayFirst > 0 && monthFirst === 0
      ? 'day-first'
      : monthFirst > 0 && dayFirst === 0
        ? 'month-first'
        : null
  return {
    formats: [...formats.values()].sort((a, b) => b.count - a.count),
    order,
    ambiguousExample,
    readable: values.length - unreadable.length,
    unreadable,
  }
}

/** Whether sema's profiler already reads a value as a date (only `2024-01-03` and `1/3/2024` styles). */
export function isProfiledDate(value: string): boolean {
  return classifyValue(value).kind === 'date'
}
