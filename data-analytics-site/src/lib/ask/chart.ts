import { compareCells, type Cell, type QueryResult } from './execute'
import type { AskAnswer, ChartType } from './schema'

/**
 * Decides the chart an answer shows, in the browser, after the plan has run. Claude suggests one,
 * but when the question asks for a chart there is always one: the kind asked for, or Claude's, or
 * a bar chart, drawn from whichever result columns fit. Pure.
 */

export type DrawnChartType = Exclude<ChartType, 'none'>

export interface ChartPoint {
  label: string
  value: number
}

interface ChartBase {
  /** Heading for the categories or periods (a heatmap's rows). */
  x: string
  /** Heading for the numbers. */
  y: string
  /** Plain sentences about anything left out of the chart. */
  notes: string[]
}

export interface PointChart extends ChartBase {
  type: 'bar' | 'line' | 'pie'
  points: ChartPoint[]
}

/** A grid of one number for each pair of categories, such as orders by region and month. */
export interface HeatmapChart extends ChartBase {
  type: 'heatmap'
  /** Heading for the second categories or periods (the heatmap's columns). */
  by: string
  rows: string[]
  columns: string[]
  /** `values[row][column]`; null where the result has no such pair. */
  values: (number | null)[][]
}

export type ResolvedChart = PointChart | HeatmapChart

/** Most slices a pie shows; the smallest of the rest are added together as "Other". */
export const MAX_PIE_SLICES = 6

/**
 * Whether the question asks for a chart: the kind named (`pie`, `bar`, `line`, `heatmap`), `any`
 * for a chart of no particular kind ("graph", "plot", "visualise"), or null.
 */
export function requestedChart(question: string): DrawnChartType | 'any' | null {
  const q = question.toLowerCase()
  if (/\bheat\s*-?\s*maps?\b/.test(q)) return 'heatmap'
  if (/\b(pie|donut|doughnut)\b/.test(q)) return 'pie'
  if (/\b(bar|column)\s*(chart|graph|plot)s?\b|\bbars\b|\bhistogram\b/.test(q)) return 'bar'
  if (/\bline\s*(chart|graph|plot)s?\b|\btrend\s*line\b/.test(q)) return 'line'
  if (/\b(chart|graph|plot|visuali[sz]e|visuali[sz]ation|diagram)s?\b/.test(q)) return 'any'
  return null
}

/**
 * The chart to draw, or null when there's none to show: Claude didn't suggest one and the question
 * didn't ask, or the result has no rows. Claude's headings are used when they fit the result;
 * otherwise the first text column gives the categories and the first number column the values.
 * Without a number column, rows are counted per category. A one-row result of numbers charts
 * each number as its own category, such as total costs beside total sales. A heatmap needs two
 * category columns; without a second one it becomes a bar chart.
 */
export function resolveChart(
  question: string,
  suggested: AskAnswer['chart'],
  result: QueryResult,
): ResolvedChart | null {
  const asked = requestedChart(question)
  const type: DrawnChartType | null =
    asked !== null && asked !== 'any'
      ? asked
      : suggested.type !== 'none'
        ? suggested.type
        : asked === 'any'
          ? 'bar'
          : null
  if (type === null || result.rows.length === 0) return null

  const { columns, rows } = result
  const notes: string[] = []
  if (result.totalRows > rows.length) {
    notes.push(
      `The chart shows the first ${rows.length.toLocaleString('en-US')} of ${result.totalRows.toLocaleString('en-US')} results.`,
    )
  }
  const find = (label: string, numeric: boolean) =>
    columns.findIndex((c) => c.label === label && c.numeric === numeric)
  const firstText = columns.findIndex((c) => !c.numeric)
  let yi = find(suggested.y, true)
  if (yi < 0) yi = columns.findIndex((c, i) => c.numeric && i !== firstText)

  if (firstText < 0 && rows.length === 1) {
    // Only headline numbers: each one becomes a category.
    const points = columns.flatMap((c, i) => {
      const v = rows[0][i]
      return typeof v === 'number' ? [{ label: c.label, value: v }] : []
    })
    if (points.length === 0) return null
    if (type === 'heatmap') notes.push(NO_SECOND_CATEGORY)
    return shaped(type === 'heatmap' ? 'bar' : type, 'Figure', 'Value', points, notes)
  }

  let xi = columns.findIndex((c, i) => c.label === suggested.x && i !== yi)
  if (xi < 0) xi = firstText >= 0 ? firstText : columns.findIndex((_, i) => i !== yi)
  if (xi < 0) xi = 0
  const x = columns[xi].label
  const y = yi < 0 ? 'Rows' : columns[yi].label
  const value = (r: Cell[]) => (yi < 0 ? 1 : typeof r[yi] === 'number' ? (r[yi] as number) : null)
  const blank = rows.filter((r) => value(r) === null).length
  if (blank > 0) {
    notes.push(
      `${plural(blank, 'row')} without a ${y} value ${blank === 1 ? 'is' : 'are'} left out of the chart.`,
    )
  }

  if (type === 'heatmap') {
    // The second category: Claude's, else another text column, else any other column.
    const others = columns.map((_, i) => i).filter((i) => i !== xi && i !== yi)
    const byi =
      others.find((i) => columns[i].label === suggested.by) ??
      others.find((i) => !columns[i].numeric) ??
      others[0]
    if (byi !== undefined) return heatmap(x, y, columns[byi].label, rows, xi, byi, value, notes)
    notes.push(NO_SECOND_CATEGORY)
  }

  const points =
    yi < 0
      ? countBy(rows, xi)
      : rows.flatMap((r) => {
          const v = value(r)
          return v === null ? [] : [{ label: label(r[xi]), value: v }]
        })
  if (points.length === 0) return null
  return shaped(type === 'heatmap' ? 'bar' : type, x, y, points, notes)
}

const NO_SECOND_CATEGORY =
  'A heatmap needs two things to compare across, such as region and month, so this is a bar chart instead.'

function shaped(
  type: PointChart['type'],
  x: string,
  y: string,
  points: ChartPoint[],
  notes: string[],
): PointChart {
  return type === 'pie' ? pie(x, y, points, notes) : { type, x, y, points, notes }
}

/** A pie of the positive values, largest first, with anything past the sixth slice as "Other". */
function pie(x: string, y: string, points: ChartPoint[], notes: string[]): PointChart {
  const positive = points.filter((p) => p.value > 0).sort((a, b) => b.value - a.value)
  const skipped = points.length - positive.length
  if (positive.length === 0) {
    // Nothing a pie can show: bars still draw zero and negative values.
    notes.push(`A pie chart can only show values above zero, so this is a bar chart instead.`)
    return { type: 'bar', x, y, points, notes }
  }
  if (skipped > 0) {
    notes.push(
      `${plural(skipped, 'value')} of zero or less ${skipped === 1 ? 'is' : 'are'} left out of the pie chart.`,
    )
  }
  let slices = positive
  if (positive.length > MAX_PIE_SLICES) {
    const rest = positive.slice(MAX_PIE_SLICES - 1)
    slices = [
      ...positive.slice(0, MAX_PIE_SLICES - 1),
      { label: `Other (${rest.length})`, value: rest.reduce((n, p) => n + p.value, 0) },
    ]
  }
  return { type: 'pie', x, y, points: slices, notes }
}

/**
 * Rows in the order they first appear in the result (so a "highest first" sort still reads top to
 * bottom) and columns sorted, so months, numbers and dates run in order and text A to Z. Values of
 * repeated pairs are added together; rows without a value are left out.
 */
function heatmap(
  x: string,
  y: string,
  by: string,
  rows: readonly Cell[][],
  xi: number,
  byi: number,
  value: (r: Cell[]) => number | null,
  notes: string[],
): HeatmapChart {
  const rowLabels = new Set<string>()
  /** Each column's label with the result cell it came from, which sorts by its kind. */
  const columnCells = new Map<string, Cell>()
  const cells = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const v = value(r)
    if (v === null) continue
    const row = label(r[xi])
    const column = label(r[byi])
    rowLabels.add(row)
    if (!columnCells.has(column)) columnCells.set(column, r[byi])
    const inRow = cells.get(row) ?? new Map<string, number>()
    inRow.set(column, (inRow.get(column) ?? 0) + v)
    cells.set(row, inRow)
  }
  const columns = [...columnCells]
    .sort(([, a], [, b]) => compareCells(a, b))
    .map(([column]) => column)
  return {
    type: 'heatmap',
    x,
    y,
    by,
    rows: [...rowLabels],
    columns,
    values: [...rowLabels].map((row) => columns.map((c) => cells.get(row)?.get(c) ?? null)),
    notes,
  }
}

function countBy(rows: readonly Cell[][], column: number): ChartPoint[] {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(label(r[column]), (counts.get(label(r[column])) ?? 0) + 1)
  return [...counts].map(([l, value]) => ({ label: l, value }))
}

function label(cell: Cell): string {
  return cell === null || cell === '' ? '(blank)' : String(cell)
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`
}
