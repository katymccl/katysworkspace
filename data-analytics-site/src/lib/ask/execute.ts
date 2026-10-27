/**
 * Runs a query plan from /api/ask against the full datasets, in the browser. Pure: the same plan
 * and data always give the same result, and nothing here reaches the network.
 *
 * Values are compared the way relationships are found: numbers by value (`1,000` = `1000`), text
 * trimmed and case-insensitive, and missing cells (blank, `n/a`, …) never match a filter.
 */
import type { CsvRow } from '../parseCsv'
import { classifyValue, isMissing } from '../profiling'
import { parseDate } from '../profiling/values'
import { normaliseValue } from '../relationships/detect'
import type { DateBucket, FilterOp, PlanRef, QueryPlan } from './schema'

export interface QueryTable {
  /** Display name, for notes about joins. */
  name: string
  rows: readonly CsvRow[]
}

export type Cell = string | number | null

export interface ResultColumn {
  label: string
  /** True when every value is a number, so the table aligns it right and charts can plot it. */
  numeric: boolean
}

export interface QueryResult {
  columns: ResultColumn[]
  /** Up to the plan's limit. */
  rows: Cell[][]
  /** Rows in the full result, before the limit. */
  totalRows: number
  /** Rows (after joins and filters) the result was worked out from. */
  sourceRows: number
  /** Plain sentences about anything that affects how to read the result. */
  notes: string[]
}

export type QueryOutcome = { ok: true; result: QueryResult } | { ok: false; message: string }

/** Joins that multiply rows past this are stopped rather than freezing the page. */
export const MAX_JOINED_ROWS = 500_000

/** One row of the base dataset with the matching row (if any) of each joined dataset. */
type Combined = Record<string, CsvRow | undefined>

export function runQuery(plan: QueryPlan, tables: ReadonlyMap<string, QueryTable>): QueryOutcome {
  const base = tables.get(plan.from)
  if (!base) return { ok: false, message: 'The dataset this question is about is no longer open.' }
  const notes: string[] = []

  let rows: Combined[] = base.rows.map((r) => ({ [plan.from]: r }))
  for (const join of plan.joins) {
    const table = tables.get(join.dataset)
    if (!table) return { ok: false, message: `${join.dataset} is no longer open.` }
    const joined = joinRows(rows, join.on, join.dataset, join.column, table)
    if (!joined.ok) {
      return {
        ok: false,
        message: `Matching ${table.name} made more than ${MAX_JOINED_ROWS.toLocaleString('en-US')} rows, so it was stopped. The columns may not refer to the same things.`,
      }
    }
    rows = joined.rows
    if (joined.unmatched > 0) {
      notes.push(
        `${plural(joined.unmatched, 'row')} had no match in ${table.name}, so ${joined.unmatched === 1 ? 'its' : 'their'} ${table.name} values are blank.`,
      )
    }
    if (joined.repeated > 0) {
      notes.push(
        `${plural(joined.repeated, 'row')} matched more than one row in ${table.name}, so ${joined.repeated === 1 ? 'it appears' : 'they appear'} more than once.`,
      )
    }
  }

  const filters = plan.filters.map((f) => ({ ...f, test: filterTest(f.op, f.values) }))
  rows = rows.filter((row) => filters.every((f) => f.test(cell(row, f.column))))

  const aggregating = plan.groupBy.length > 0 || plan.measures.length > 0
  const table = aggregating ? aggregate(rows, plan, notes) : listRows(rows, plan)

  const sortSpec = plan.sort.length > 0 ? plan.sort : defaultSort(plan)
  const order = sortSpec
    .map((s) => ({
      index: table.labels.indexOf(s.label),
      sign: s.direction === 'descending' ? -1 : 1,
    }))
    .filter((s) => s.index >= 0)
  if (order.length > 0) {
    table.rows.sort((a, b) => {
      for (const { index, sign } of order) {
        const c = compareCells(a[index], b[index])
        // Blanks go last in either direction.
        if (c !== 0) return a[index] === null || b[index] === null ? c : c * sign
      }
      return 0
    })
  }

  return {
    ok: true,
    result: {
      columns: table.labels.map((label, i) => ({
        label,
        numeric:
          table.rows.some((r) => r[i] !== null) &&
          table.rows.every((r) => r[i] === null || typeof r[i] === 'number'),
      })),
      rows: table.rows.slice(0, plan.limit),
      totalRows: table.rows.length,
      sourceRows: rows.length,
      notes,
    },
  }
}

function cell(row: Combined, ref: PlanRef): unknown {
  return row[ref.dataset]?.[ref.column]
}

function joinRows(
  rows: Combined[],
  on: PlanRef,
  dataset: string,
  column: string,
  table: QueryTable,
): { ok: true; rows: Combined[]; unmatched: number; repeated: number } | { ok: false } {
  const index = new Map<string, CsvRow[]>()
  for (const r of table.rows) {
    const key = normaliseValue(r[column])
    if (key === null) continue
    const list = index.get(key)
    if (list) list.push(r)
    else index.set(key, [r])
  }
  const out: Combined[] = []
  let unmatched = 0
  let repeated = 0
  for (const row of rows) {
    const key = normaliseValue(cell(row, on))
    const matches = key === null ? undefined : index.get(key)
    if (!matches) {
      unmatched++
      out.push({ ...row, [dataset]: undefined })
    } else {
      if (matches.length > 1) repeated++
      for (const m of matches) out.push({ ...row, [dataset]: m })
    }
    if (out.length > MAX_JOINED_ROWS) return { ok: false }
  }
  return { ok: true, rows: out, unmatched, repeated }
}

/** A test for one cell. Missing cells only pass `is_missing`. */
export function filterTest(op: FilterOp, values: readonly string[]): (value: unknown) => boolean {
  if (op === 'is_missing') return (v) => isMissing(v)
  if (op === 'is_not_missing') return (v) => !isMissing(v)
  const present = (test: (v: unknown) => boolean) => (v: unknown) => !isMissing(v) && test(v)
  const wanted = values.map(normaliseValue).filter((v) => v !== null)
  const lower = (values[0] ?? '').trim().toLowerCase()
  switch (op) {
    case 'equals':
    case 'one_of':
      return present((v) => wanted.includes(normaliseValue(v)!))
    case 'not_equals':
      return present((v) => !wanted.includes(normaliseValue(v)!))
    case 'contains':
      return present((v) => String(v).toLowerCase().includes(lower))
    case 'not_contains':
      return present((v) => !String(v).toLowerCase().includes(lower))
    case 'greater_than':
      return present((v) => compareValue(v, values[0]) > 0)
    case 'at_least':
      return present((v) => compareValue(v, values[0]) >= 0)
    case 'less_than':
      return present((v) => compareValue(v, values[0]) < 0)
    case 'at_most':
      return present((v) => compareValue(v, values[0]) <= 0)
  }
}

/**
 * Compares a cell with a filter value: as numbers when the value is a number, as dates when it is a
 * date, else as text. A cell of the wrong kind gives NaN, which fails every comparison.
 */
function compareValue(value: unknown, target: string): number {
  const b = classifyValue(target).number
  if (b !== undefined) return (classifyValue(value).number ?? NaN) - b
  const db = parseDate(target)
  if (db) return (parseDate(value)?.time ?? NaN) - db.time
  return String(value).trim().toLowerCase().localeCompare(target.trim().toLowerCase())
}

/** Orders result cells: numbers by value, dates by day, text alphabetically; blanks last. */
export function compareCells(a: Cell, b: Cell): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const na = typeof a === 'number' ? a : classifyValue(a).number
  const nb = typeof b === 'number' ? b : classifyValue(b).number
  if (na !== undefined && nb !== undefined) return na - nb
  const da = parseDate(a)
  const db = parseDate(b)
  if (da && db) return da.time - db.time
  return String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true })
}

interface Table {
  labels: string[]
  rows: Cell[][]
}

function listRows(rows: Combined[], plan: QueryPlan): Table {
  return {
    labels: plan.select.map((s) => s.label),
    rows: rows.map((row) =>
      plan.select.map((s) => {
        const v = cell(row, s.column)
        return isMissing(v) ? null : String(v)
      }),
    ),
  }
}

/** Time periods label themselves so that sorting the labels sorts the periods. */
export function bucketLabel(value: unknown, bucket: DateBucket): string | null {
  const d = parseDate(value)
  if (!d) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  switch (bucket) {
    case 'year':
      return String(d.year)
    case 'quarter':
      return `${d.year} Q${Math.ceil(d.month / 3)}`
    case 'month':
      return `${d.year}-${pad(d.month)}`
    case 'week': {
      // The Monday that starts the week.
      const day = new Date(Date.UTC(d.year, d.month - 1, d.day))
      day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
      return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`
    }
    case 'day':
    case 'none':
      return `${d.year}-${pad(d.month)}-${pad(d.day)}`
  }
}

interface Accumulator {
  add(value: unknown): void
  result(): Cell
}

function accumulator(fn: QueryPlan['measures'][number]['fn'], onSkip: () => void): Accumulator {
  switch (fn) {
    case 'count': {
      let n = 0
      return { add: () => n++, result: () => n }
    }
    case 'count_distinct': {
      const seen = new Set<string>()
      return {
        add: (v) => {
          const key = normaliseValue(v)
          if (key !== null) seen.add(key)
        },
        result: () => seen.size,
      }
    }
    case 'sum':
    case 'average': {
      let total = 0
      let n = 0
      return {
        add: (v) => {
          if (isMissing(v)) return
          const num = classifyValue(v).number
          if (num === undefined) return onSkip()
          total += num
          n++
        },
        result: () => (n === 0 ? null : fn === 'sum' ? total : total / n),
      }
    }
    case 'min':
    case 'max': {
      // Numbers by value; dates (kept as written) by day.
      let best: { key: number; value: Cell } | null = null
      const better = (key: number) =>
        best === null || (fn === 'min' ? key < best.key : key > best.key)
      return {
        add: (v) => {
          if (isMissing(v)) return
          const num = classifyValue(v).number
          if (num !== undefined) {
            if (better(num)) best = { key: num, value: num }
            return
          }
          const date = parseDate(v)
          if (!date) return onSkip()
          if (better(date.time)) best = { key: date.time, value: String(v).trim() }
        },
        result: () => best?.value ?? null,
      }
    }
  }
}

function aggregate(rows: Combined[], plan: QueryPlan, notes: string[]): Table {
  const skipped = plan.measures.map(() => 0)
  const groups = new Map<string, { values: Cell[]; accs: Accumulator[] }>()
  const newAccs = () => plan.measures.map((m, i) => accumulator(m.fn, () => skipped[i]++))

  for (const row of rows) {
    const values: Cell[] = []
    const keys: (string | null)[] = []
    for (const g of plan.groupBy) {
      const raw = cell(row, g.column)
      if (isMissing(raw)) {
        values.push(null)
        keys.push(null)
        continue
      }
      const bucketed = g.bucket === 'none' ? null : bucketLabel(raw, g.bucket)
      values.push(bucketed ?? String(raw).trim())
      keys.push(bucketed ?? normaliseValue(raw))
    }
    const key = JSON.stringify(keys)
    const group = groups.get(key) ?? { values, accs: newAccs() }
    groups.set(key, group)
    plan.measures.forEach((m, i) => group.accs[i].add(m.column ? cell(row, m.column) : null))
  }
  // Totals over no rows are still a row ("0 orders"), unless the result is grouped.
  if (plan.groupBy.length === 0 && groups.size === 0)
    groups.set('[]', { values: [], accs: newAccs() })

  plan.measures.forEach((m, i) => {
    if (skipped[i] > 0 && m.column) {
      notes.push(
        `${plural(skipped[i], 'value')} in ${m.column.column} ${skipped[i] === 1 ? "wasn't a number or date and was" : "weren't numbers or dates and were"} left out of ${m.label}.`,
      )
    }
  })

  return {
    labels: [...plan.groupBy.map((g) => g.label), ...plan.measures.map((m) => m.label)],
    rows: [...groups.values()].map((g) => [...g.values, ...g.accs.map((a) => a.result())]),
  }
}

/** Without an explicit order, grouped results read best in group order (e.g. by month). */
function defaultSort(plan: QueryPlan): QueryPlan['sort'] {
  return plan.groupBy.map((g) => ({ label: g.label, direction: 'ascending' as const }))
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`
}
