/**
 * Reads time values the many ways people write them, so a month column in one file can line up
 * with a month column in another however each is written (`2024-01`, `Jan 2024`, `01/2024`). Used
 * to find relationships between time columns and to join on them. Pure.
 */
import { fullYear, monthNumber, readDate, resolveDate } from '../clean/dates'
import { headerWords } from '../profiling/identifiers'
import type { RawValue } from '../profiling/types'
import { isMissing, parseDate, toText } from '../profiling/values'

/** How long a period a value names. A month name has no year, so it's its own kind. */
export type PeriodGrain = 'date' | 'month' | 'quarter' | 'year' | 'month-name'

export interface PeriodReading {
  grain: PeriodGrain
  /** The same for every way of writing one period: `2024-01-31`, `2024-01`, `2024-Q1`, `2024`, `M01`. */
  key: string
}

/** Share of a column's values that must be one kind of period for it to count as a time column. */
const PERIOD_SHARE = 0.9
const YEAR_WORDS: ReadonlySet<string> = new Set(['year', 'years', 'yr', 'fy'])
const MONTH_WORDS: ReadonlySet<string> = new Set(['month', 'months', 'mon', 'mth'])

const MONTH_NUMBER_FIRST = /^(\d{1,2})[-/.](\d{4})$/
const YEAR_MONTH_NUMBER = /^(\d{4})[-/.](\d{1,2})$/
const MONTH_NAME_YEAR = /^([A-Za-z]{3,9})\.?[\s\-/,']+(\d{4}|\d{2})$/
const YEAR_MONTH_NAME = /^(\d{4})[\s\-/]+([A-Za-z]{3,9})\.?$/
const QUARTER_FIRST = /^q([1-4])[\s\-/]*(\d{4})$/i
const YEAR_QUARTER = /^(\d{4})[\s\-/]*q([1-4])$/i
const YEAR = /^(\d{4})$/

const pad = (n: number) => String(n).padStart(2, '0')
const month = (year: number, m: number): PeriodReading | null =>
  m >= 1 && m <= 12 ? { grain: 'month', key: `${year}-${pad(m)}` } : null

/** The period a value names, or null when it isn't one. A bare four-digit number reads as a year. */
export function readPeriod(value: RawValue): PeriodReading | null {
  const text = toText(value).trim()
  if (text === '') return null

  const date = parseDate(text)
  if (date) return { grain: 'date', key: `${date.year}-${pad(date.month)}-${pad(date.day)}` }
  // Named-month dates such as `Jan 5 2024` or `5 January 2024`.
  const named = readDate(text)
  const day = named && !named.pair ? resolveDate(named, 'month-first') : null
  if (day) return { grain: 'date', key: `${day.year}-${pad(day.month)}-${pad(day.day)}` }

  let m = YEAR_MONTH_NUMBER.exec(text)
  if (m) return month(+m[1], +m[2])
  m = MONTH_NUMBER_FIRST.exec(text)
  if (m) return month(+m[2], +m[1])
  m = MONTH_NAME_YEAR.exec(text)
  if (m && monthNumber(m[1])) return month(fullYear(m[2]), monthNumber(m[1])!)
  m = YEAR_MONTH_NAME.exec(text)
  if (m && monthNumber(m[2])) return month(+m[1], monthNumber(m[2])!)

  m = QUARTER_FIRST.exec(text)
  if (m) return { grain: 'quarter', key: `${m[2]}-Q${m[1]}` }
  m = YEAR_QUARTER.exec(text)
  if (m) return { grain: 'quarter', key: `${m[1]}-Q${m[2]}` }

  m = YEAR.exec(text)
  if (m && +m[1] >= 1900 && +m[1] <= 2100) return { grain: 'year', key: m[1] }

  const monthOnly = /^[A-Za-z]{3,9}\.?$/.test(text) ? monthNumber(text.replace(/\.$/, '')) : undefined
  if (monthOnly) return { grain: 'month-name', key: `M${pad(monthOnly)}` }
  return null
}

/**
 * The kind of period a column holds, when at least 90% of its values are that kind; null for
 * anything else. Years need a header such as `Year` or `FY`, since amounts like 2000 look the same,
 * and month names need one such as `Month`, since they repeat every year.
 */
export function periodColumn(header: string, values: Iterable<RawValue>): PeriodGrain | null {
  const counts = new Map<PeriodGrain, number>()
  let present = 0
  for (const v of values) {
    if (isMissing(v)) continue
    present++
    const reading = readPeriod(v)
    if (reading) counts.set(reading.grain, (counts.get(reading.grain) ?? 0) + 1)
  }
  if (present === 0) return null
  const [grain, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  if (grain === null || count / present < PERIOD_SHARE) return null
  const words = headerWords(header)
  if (grain === 'year' && !words.some((w) => YEAR_WORDS.has(w))) return null
  if (grain === 'month-name' && !words.some((w) => MONTH_WORDS.has(w))) return null
  return grain
}

/** The key a value is matched on in a column of this kind of period, or null when it isn't one. */
export function periodKey(value: RawValue, grain: PeriodGrain): string | null {
  const reading = isMissing(value) ? null : readPeriod(value)
  return reading?.grain === grain ? `${grain}:${reading.key}` : null
}
