/**
 * "Explore your data": answers a templated question (a measure over time, compared across groups,
 * its distribution, or two measures side by side) from every row of one dataset, in the browser,
 * without Claude. Each answer is chart data plus a one-line summary and notes. Pure.
 */
import type { ChartPoint } from '../ask/chart'
import type { CsvRow } from '../parseCsv'
import { headerWords } from '../profiling/identifiers'
import type { ColumnProfile, DatasetProfile } from '../profiling/types'
import { classifyValue, isMissing } from '../profiling/values'
import { periodColumn, readPeriod, type PeriodGrain } from '../relationships/periods'

export type ExploreQuestion = 'over-time' | 'compare' | 'distribution' | 'related'

export const QUESTIONS: { value: ExploreQuestion; label: string }[] = [
  { value: 'over-time', label: 'See how something changes over time' },
  { value: 'compare', label: 'Compare groups' },
  { value: 'distribution', label: 'Understand a distribution' },
  { value: 'related', label: 'See whether two measures are related' },
]

export type Calculation = 'sum' | 'average' | 'median' | 'min' | 'max' | 'count'

export const CALCULATIONS: { value: Calculation; label: string }[] = [
  { value: 'sum', label: 'Total' },
  { value: 'average', label: 'Average' },
  { value: 'median', label: 'Median' },
  { value: 'min', label: 'Smallest' },
  { value: 'max', label: 'Largest' },
  { value: 'count', label: 'Number of rows' },
]

/** How finely time is grouped. `month-name` is a month without a year, such as `Jan`. */
export type TimeStep = 'day' | 'month' | 'quarter' | 'year' | 'month-name'

export const TIME_STEP_LABELS: Record<TimeStep, string> = {
  day: 'Day',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
  'month-name': 'Month of the year',
}

/** Most groups a comparison shows; the rest are left out with a note. */
export const MAX_GROUPS = 30
/** Most distinct values a column can have to be offered for grouping. */
export const MAX_GROUP_VALUES = 100
/** Most points a scatterplot draws; larger datasets are thinned evenly. */
export const MAX_SCATTER_POINTS = 10_000

export interface TimeColumn {
  name: string
  grain: PeriodGrain
  /** The steps it can be grouped by, finest first. */
  steps: TimeStep[]
}

/** The columns a dataset offers for each part of a question. */
export interface ExploreColumns {
  /** Numbers that can be measured: not identifiers, and not years. */
  measures: string[]
  /** Dates and periods (months, quarters, years). */
  time: TimeColumn[]
  /** Columns with few enough values to compare as groups. */
  groups: string[]
}

const STEPS_FOR: Record<PeriodGrain, TimeStep[]> = {
  date: ['day', 'month', 'quarter', 'year'],
  month: ['month', 'quarter', 'year'],
  quarter: ['quarter', 'year'],
  year: ['year'],
  'month-name': ['month-name'],
}

function isNumeric(c: ColumnProfile): boolean {
  if (c.inferredType === 'integer' || c.inferredType === 'decimal') return true
  // Mostly numbers with a few stray values still makes a measure; the strays are skipped.
  return c.inferredType === 'mixed' && (c.dominantKind === 'integer' || c.dominantKind === 'decimal')
}

export function exploreColumns(rows: readonly CsvRow[], profile: DatasetProfile): ExploreColumns {
  const time: TimeColumn[] = []
  const measures: string[] = []
  const groups: string[] = []
  for (const c of profile.columns) {
    const part = periodPart(c)
    // A month number (1–12) reads as a month of the year, like a column of month names.
    const grain =
      part === 'month'
        ? 'month-name'
        : c.inferredType === 'empty'
          ? null
          : periodColumn(c.name, rows.map((r) => r[c.name]))
    if (grain) time.push({ name: c.name, grain, steps: STEPS_FOR[grain] })
    // Years and parts of a date (month 3, week 12) are times, not amounts to add up.
    if (isNumeric(c) && !c.isPotentialIdentifier && grain !== 'year' && !part) measures.push(c.name)
    const fewValues = c.distinctCount >= 2 && c.distinctCount <= MAX_GROUP_VALUES && !c.isUnique
    // Numbers are grouped only when they're periods (years, months) or labelled as a code or rating.
    if (fewValues && (!isNumeric(c) || grain !== null || part || looksLikeGroupNumber(c.name))) {
      groups.push(c.name)
    }
  }
  return { measures, time, groups }
}

/**
 * Parts of a date written as numbers: the header words that name them, and their range. Plurals
 * are left out on purpose: `Days late` or `Hours worked` are amounts, not parts of a date.
 */
const PERIOD_PARTS = [
  { part: 'month', words: ['month', 'mon', 'mth', 'mo'], min: 1, max: 12 },
  { part: 'quarter', words: ['quarter', 'qtr', 'q'], min: 1, max: 4 },
  { part: 'week', words: ['week', 'wk', 'weeknum'], min: 1, max: 53 },
  { part: 'day', words: ['day', 'dow', 'weekday', 'dom'], min: 1, max: 31 },
  { part: 'hour', words: ['hour', 'hr', 'hh'], min: 0, max: 23 },
] as const

export type PeriodPart = (typeof PERIOD_PARTS)[number]['part']

/**
 * The part of a date a column of whole numbers holds, such as `month` for a `Month` column of
 * 1 to 12; null for anything else. Both the header and the range must fit, so amounts that merely
 * run in a short sequence (books read: 0 to 16) still count as amounts.
 */
export function periodPart(c: ColumnProfile): PeriodPart | null {
  if (c.inferredType !== 'integer' || !c.numericStats) return null
  const words = headerWords(c.name)
  const { min, max } = c.numericStats
  const found = PERIOD_PARTS.find((p) => p.words.some((w) => words.includes(w)))
  return found && min >= found.min && max <= found.max ? found.part : null
}

const GROUP_NUMBER_WORDS: ReadonlySet<string> = new Set([
  'rating',
  'score',
  'level',
  'grade',
  'rank',
  'tier',
  'class',
  'code',
  'group',
  'stars',
  'week',
  'day',
  'quarter',
])
function looksLikeGroupNumber(name: string): boolean {
  return headerWords(name).some((w) => GROUP_NUMBER_WORDS.has(w))
}

/** The number in a cell, or null when it's missing or not a number. */
export function readNumber(value: unknown): number | null {
  if (isMissing(value)) return null
  const text = String(value).trim().replace(/^[$£€¥]|%$/g, '')
  return classifyValue(text).number ?? null
}

export function calculate(values: readonly number[], calc: Calculation): number {
  if (calc === 'count') return values.length
  if (values.length === 0) return 0
  if (calc === 'sum') return values.reduce((a, b) => a + b, 0)
  if (calc === 'average') return values.reduce((a, b) => a + b, 0) / values.length
  if (calc === 'min') return Math.min(...values)
  if (calc === 'max') return Math.max(...values)
  return quantile([...values].sort((a, b) => a - b), 0.5)
}

/** The value a share of the way through sorted numbers, between neighbours where needed. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0
  const at = (sorted.length - 1) * q
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)
}

/** The heading for a calculated measure, e.g. "Total Books Read" or "Number of rows". */
export function measureLabel(calc: Calculation, measure: string | null): string {
  if (calc === 'count' || !measure) return 'Number of rows'
  return `${CALCULATIONS.find((c) => c.value === calc)!.label} ${measure}`
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`

export interface PointAnswer {
  kind: 'line' | 'bar'
  x: string
  y: string
  points: ChartPoint[]
  summary: string
  notes: string[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The sortable key and label of a time value grouped by `step`, or null if it isn't one. */
export function timeBucket(
  value: unknown,
  grain: PeriodGrain,
  step: TimeStep,
): { key: string; label: string } | null {
  if (isMissing(value)) return null
  // Month numbers (from a column `periodPart` found) are months of the year.
  const monthNumber = grain === 'month-name' && /^\s*\d{1,2}\s*$/.test(String(value)) ? Number(value) : 0
  const reading =
    monthNumber >= 1 && monthNumber <= 12
      ? { grain: 'month-name' as const, key: `M${String(monthNumber).padStart(2, '0')}` }
      : readPeriod(value)
  if (!reading || reading.grain !== grain) return null
  if (grain === 'month-name') {
    const m = Number(reading.key.slice(1))
    return { key: reading.key, label: MONTHS[m - 1] }
  }
  const year = reading.key.slice(0, 4)
  if (step === 'year') return { key: year, label: year }
  if (grain === 'quarter') return { key: reading.key, label: `${reading.key.slice(5)} ${year}` }
  const month = Number(reading.key.slice(5, 7))
  if (step === 'quarter') {
    const q = Math.ceil(month / 3)
    return { key: `${year}-Q${q}`, label: `Q${q} ${year}` }
  }
  if (step === 'month') return { key: `${year}-${reading.key.slice(5, 7)}`, label: `${MONTHS[month - 1]} ${year}` }
  return { key: reading.key, label: reading.key }
}

/** Measures (or counts) rows per group, noting rows left out. Groups come back in first-seen order. */
function groupValues(
  rows: readonly CsvRow[],
  groupOf: (row: CsvRow) => { key: string; label: string } | null,
  measure: string | null,
  calc: Calculation,
) {
  const groups = new Map<string, { label: string; values: number[] }>()
  let noGroup = 0
  let noValue = 0
  for (const row of rows) {
    const g = groupOf(row)
    if (!g) {
      noGroup++
      continue
    }
    let v = 1
    if (calc !== 'count' && measure) {
      const n = readNumber(row[measure])
      if (n === null) {
        noValue++
        continue
      }
      v = n
    }
    const entry = groups.get(g.key) ?? { label: g.label, values: [] }
    entry.values.push(v)
    groups.set(g.key, entry)
  }
  return { groups, noGroup, noValue }
}

function leftOutNotes(noGroup: number, groupWhat: string, noValue: number, measure: string | null) {
  const notes: string[] = []
  if (noGroup > 0) notes.push(`${plural(noGroup, 'row')} had no ${groupWhat} and ${noGroup === 1 ? 'was' : 'were'} left out.`)
  if (noValue > 0 && measure) {
    notes.push(`${plural(noValue, 'row')} had no number for ${measure} and ${noValue === 1 ? 'was' : 'were'} left out.`)
  }
  return notes
}

export function overTime(
  rows: readonly CsvRow[],
  time: TimeColumn,
  step: TimeStep,
  measure: string | null,
  calc: Calculation,
): PointAnswer {
  const { groups, noGroup, noValue } = groupValues(
    rows,
    (r) => timeBucket(r[time.name], time.grain, step),
    measure,
    calc,
  )
  const points = [...groups]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, g]) => ({ label: g.label, value: calculate(g.values, calc) }))
  const y = measureLabel(calc, measure)
  const notes = leftOutNotes(noGroup, `readable ${time.name}`, noValue, measure)
  let summary = 'There is nothing to show: no rows had both a time and a value.'
  if (points.length === 1) {
    summary = `There is only one ${TIME_STEP_LABELS[step].toLowerCase()}: ${points[0].label}, with ${fmt(points[0].value)}.`
  } else if (points.length > 1 && step === 'month-name') {
    // Months of the year repeat, so there's no start and end: name the highest and lowest.
    const hi = points.reduce((a, b) => (b.value > a.value ? b : a))
    const lo = points.reduce((a, b) => (b.value < a.value ? b : a))
    summary = `Across the year, ${lowerFirst(y)} is highest in ${hi.label} (${fmt(hi.value)}) and lowest in ${lo.label} (${fmt(lo.value)}).`
  } else if (points.length > 1) {
    const first = points[0]
    const last = points.at(-1)!
    const peak = points.reduce((a, b) => (b.value > a.value ? b : a))
    const change =
      first.value !== 0 ? ` (${last.value >= first.value ? '+' : ''}${fmt(Math.round(((last.value - first.value) / Math.abs(first.value)) * 1000) / 10)}%)` : ''
    summary = `${y} went from ${fmt(first.value)} in ${first.label} to ${fmt(last.value)} in ${last.label}${change}. The highest was ${fmt(peak.value)} in ${peak.label}.`
  }
  return { kind: 'line', x: TIME_STEP_LABELS[step], y, points, summary, notes }
}

export function compareGroups(
  rows: readonly CsvRow[],
  group: string,
  measure: string | null,
  calc: Calculation,
  /** Periods and numbers keep their own order; other groups are sorted largest first. */
  ordered = false,
): PointAnswer {
  const { groups, noGroup, noValue } = groupValues(
    rows,
    (r) => {
      if (isMissing(r[group])) return null
      const text = String(r[group]).trim()
      return { key: text.toLowerCase(), label: text }
    },
    measure,
    calc,
  )
  let points = [...groups.values()].map((g) => ({ label: g.label, value: calculate(g.values, calc) }))
  const numericLabels = points.every((p) => readNumber(p.label) !== null)
  if (ordered || numericLabels) {
    points.sort((a, b) =>
      numericLabels
        ? readNumber(a.label)! - readNumber(b.label)!
        : a.label.localeCompare(b.label, 'en', { numeric: true }),
    )
  } else {
    points.sort((a, b) => b.value - a.value)
  }
  const y = measureLabel(calc, measure)
  const notes = leftOutNotes(noGroup, group, noValue, measure)
  if (points.length > MAX_GROUPS) {
    notes.push(
      ordered || numericLabels
        ? `Only the first ${MAX_GROUPS} of ${fmt(points.length)} groups are shown.`
        : `Only the ${MAX_GROUPS} largest of ${fmt(points.length)} groups are shown.`,
    )
    points = points.slice(0, MAX_GROUPS)
  }
  let summary = 'There is nothing to show: no rows had both a group and a value.'
  if (points.length > 0) {
    const hi = points.reduce((a, b) => (b.value > a.value ? b : a))
    const lo = points.reduce((a, b) => (b.value < a.value ? b : a))
    summary =
      points.length === 1
        ? `Every row is in one group, ${hi.label}, with ${fmt(hi.value)}.`
        : `${hi.label} has the highest ${lowerFirst(y)} (${fmt(hi.value)}) and ${lo.label} the lowest (${fmt(lo.value)}).`
  }
  return { kind: 'bar', x: group, y, points, summary, notes }
}

const lowerFirst = (s: string) => (s.startsWith('Number') ? s.toLowerCase() : s[0].toLowerCase() + s.slice(1))

export interface DistributionAnswer {
  kind: 'histogram'
  measure: string
  /** One bar per range of values, lowest first. */
  bins: { from: number; to: number; label: string; count: number }[]
  stats: { count: number; min: number; q1: number; median: number; mean: number; q3: number; max: number }
  summary: string
  notes: string[]
}

/** A round step (1, 2 or 5 times a power of ten) giving about `target` ranges over `span`. */
export function niceStep(span: number, target: number): number {
  if (span <= 0) return 1
  const raw = span / target
  const power = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / power
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power
}

export function distribution(rows: readonly CsvRow[], measure: string): DistributionAnswer {
  const values: number[] = []
  let missing = 0
  for (const row of rows) {
    const n = readNumber(row[measure])
    if (n === null) missing++
    else values.push(n)
  }
  values.sort((a, b) => a - b)
  const notes = missing > 0 ? [`${plural(missing, 'row')} had no number for ${measure} and ${missing === 1 ? 'was' : 'were'} left out.`] : []
  if (values.length === 0) {
    return {
      kind: 'histogram',
      measure,
      bins: [],
      stats: { count: 0, min: 0, q1: 0, median: 0, mean: 0, q3: 0, max: 0 },
      summary: `There is nothing to show: no rows have a number for ${measure}.`,
      notes,
    }
  }
  const min = values[0]
  const max = values.at(-1)!
  const stats = {
    count: values.length,
    min,
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    q3: quantile(values, 0.75),
    max,
  }

  const allWhole = values.every(Number.isInteger)
  const target = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length))))
  // Whole numbers spanning only a few values get one bar each.
  const step = allWhole && max - min < 20 ? 1 : Math.max(niceStep(max - min, target), allWhole ? 1 : 0)
  const start = Math.floor(min / step) * step
  const count = Math.max(1, Math.floor((max - start) / step) + 1)
  const bins = Array.from({ length: count }, (_, i) => {
    const from = round(start + i * step)
    const to = round(from + step)
    const label =
      allWhole && step === 1 ? fmt(from) : allWhole ? `${fmt(from)} to ${fmt(to - 1)}` : `${fmt(from)} to under ${fmt(to)}`
    return { from, to, label, count: 0 }
  })
  for (const v of values) bins[Math.min(Math.floor((v - start) / step), bins.length - 1)].count++

  const summary =
    min === max
      ? `Every row has the same ${measure}: ${fmt(min)}.`
      : `${measure} runs from ${fmt(min)} to ${fmt(max)}. The middle half of rows fall between ${fmt(stats.q1)} and ${fmt(stats.q3)}, and the median is ${fmt(stats.median)} (average ${fmt(stats.mean)}).`
  return { kind: 'histogram', measure, bins, stats, summary, notes }
}

/** Rounds away floating-point noise such as 0.30000000000000004. */
const round = (n: number) => Math.round(n * 1e9) / 1e9

export interface RelatedAnswer {
  kind: 'scatter'
  x: string
  y: string
  points: { x: number; y: number }[]
  /** Pearson correlation of every row with both numbers; null when it can't be worked out. */
  r: number | null
  /** Rows with both numbers (all of them, not just those drawn). */
  pairs: number
  summary: string
  notes: string[]
}

export function correlation(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy)
}

export function strength(r: number): string {
  const a = Math.abs(r)
  return a < 0.1 ? 'no clear' : a < 0.3 ? 'a weak' : a < 0.5 ? 'a moderate' : a < 0.7 ? 'a fairly strong' : 'a strong'
}

export function related(rows: readonly CsvRow[], x: string, y: string): RelatedAnswer {
  const xs: number[] = []
  const ys: number[] = []
  let skipped = 0
  for (const row of rows) {
    const a = readNumber(row[x])
    const b = readNumber(row[y])
    if (a === null || b === null) skipped++
    else {
      xs.push(a)
      ys.push(b)
    }
  }
  const r = correlation(xs, ys)
  const every = Math.max(1, Math.ceil(xs.length / MAX_SCATTER_POINTS))
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < xs.length; i += every) points.push({ x: xs[i], y: ys[i] })

  const notes: string[] = []
  if (skipped > 0) notes.push(`${plural(skipped, 'row')} didn't have a number for both and ${skipped === 1 ? 'was' : 'were'} left out.`)
  if (every > 1) notes.push(`The chart shows every ${every === 2 ? 'other' : ordinal(every)} row (${fmt(points.length)} of ${fmt(xs.length)}); the summary uses them all.`)

  let summary: string
  if (x === y) summary = 'Pick two different measures to compare.'
  else if (r === null) summary = xs.length < 3 ? 'There are too few rows with both numbers to say.' : 'One of the measures never changes, so there is no relationship to measure.'
  else if (Math.abs(r) < 0.1) summary = `There's no clear relationship between ${x} and ${y} (correlation ${fmtR(r)}, from ${plural(xs.length, 'row')}).`
  else
    summary = `Rows with a higher ${x} tend to have a ${r > 0 ? 'higher' : 'lower'} ${y}: ${strength(r)} ${r > 0 ? 'positive' : 'negative'} relationship (correlation ${fmtR(r)}, from ${plural(xs.length, 'row')}).`
  return { kind: 'scatter', x, y, points, r, pairs: xs.length, summary, notes }
}

const fmtR = (r: number) => r.toFixed(2).replace('-', '−')
const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

export type ExploreAnswer = PointAnswer | DistributionAnswer | RelatedAnswer

/** A question as chosen on the page: saved with a dashboard chart, so it can be worked out again. */
export interface ExploreConfig {
  question: ExploreQuestion
  time: string | null
  step: TimeStep | null
  group: string | null
  calc: Calculation
  measure: string | null
  second: string | null
}

export const DEFAULT_CONFIG: ExploreConfig = {
  question: 'over-time',
  time: null,
  step: null,
  group: null,
  calc: 'sum',
  measure: null,
  second: null,
}

/** The chosen option when it's still offered, else the first one offered. */
function pick<T>(chosen: T | null, offered: readonly T[]): T | null {
  return chosen !== null && offered.includes(chosen) ? chosen : (offered[0] ?? null)
}

export interface ExploreRun {
  /** The config with every choice that no longer fits replaced by the first that does. */
  effective: ExploreConfig
  answer: ExploreAnswer | null
  /** Why the dataset can't answer the question, when it can't. */
  missing: string | null
}

/**
 * Works out a question on a dataset. Choices that don't fit it (another dataset, a column since
 * removed) fall back to the first that does, so a saved chart still draws when it can.
 */
export function runExplore(
  rows: readonly CsvRow[],
  columns: ExploreColumns,
  config: ExploreConfig,
  /**
   * For a saved chart: the dataset's columns. Then a column the chart used that's gone, or no
   * longer fits, is reported rather than swapped for another, so a dashboard never quietly shows
   * a different chart.
   */
  strict?: { columns: readonly string[] },
): ExploreRun {
  if (strict) {
    const problem = savedColumnProblem(columns, config, strict.columns)
    if (problem) return { effective: config, answer: null, missing: problem }
  }
  const time = columns.time.find((t) => t.name === pick(config.time, columns.time.map((c) => c.name))) ?? null
  const step = time ? (config.step && time.steps.includes(config.step) ? config.step : defaultStep(time.steps)) : null
  const group = pick(config.group, columns.groups)
  const calc: Calculation = columns.measures.length > 0 ? config.calc : 'count'
  const measure = pick(config.measure, columns.measures)
  const second = pick(config.second, columns.measures.filter((m) => m !== measure))
  const effective: ExploreConfig = { question: config.question, time: time?.name ?? null, step, group, calc, measure, second }

  let answer: ExploreAnswer | null = null
  let missing: string | null = null
  if (config.question === 'over-time') {
    if (!time || !step) missing = 'No column in this dataset looks like dates, months, quarters or years.'
    else answer = overTime(rows, time, step, measure, calc)
  } else if (config.question === 'compare') {
    if (!group) missing = 'No column in this dataset has few enough different values to compare as groups.'
    else answer = compareGroups(rows, group, measure, calc, columns.time.some((t) => t.name === group))
  } else if (config.question === 'distribution') {
    if (!measure) missing = 'This dataset has no number columns to look at.'
    else answer = distribution(rows, measure)
  } else if (!measure || !second) missing = 'This needs a dataset with at least two number columns.'
  else answer = related(rows, measure, second)
  return { effective, answer, missing }
}

/** Why a saved question can't be drawn as saved: a column it used is gone or no longer fits. */
function savedColumnProblem(
  columns: ExploreColumns,
  config: ExploreConfig,
  present: readonly string[],
): string | null {
  type Use = [name: string | null, offered: readonly string[]]
  const measure: Use[] = config.calc === 'count' ? [] : [[config.measure, columns.measures]]
  const uses: Record<ExploreQuestion, Use[]> = {
    'over-time': [[config.time, columns.time.map((t) => t.name)], ...measure],
    compare: [[config.group, columns.groups], ...measure],
    distribution: [[config.measure, columns.measures]],
    related: [
      [config.measure, columns.measures],
      [config.second, columns.measures],
    ],
  }
  const used = uses[config.question]
  for (const [name, offered] of used) {
    if (name === null || offered.includes(name)) continue
    return present.includes(name)
      ? `The column “${name}” no longer suits this chart, so it can’t be drawn.`
      : `The column “${name}” is no longer in this dataset, so this chart can’t be drawn.`
  }
  return null
}

/** Months for dates (days are usually too many to read), otherwise the column's own step. */
function defaultStep(steps: readonly TimeStep[]): TimeStep {
  return steps.includes('month') ? 'month' : steps[0]
}

/** Whether an answer has nothing to chart. */
export function isEmptyAnswer(answer: ExploreAnswer): boolean {
  return answer.kind === 'histogram' ? answer.bins.length === 0 : answer.points.length === 0
}

/** A short title for an answer's chart, e.g. "Total Books Read by Month". */
export function answerTitle(answer: ExploreAnswer): string {
  if (answer.kind === 'histogram') return `Spread of ${answer.measure}`
  if (answer.kind === 'scatter') return `${answer.y} against ${answer.x}`
  return `${answer.y} by ${answer.x}`
}
