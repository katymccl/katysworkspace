import { describe, expect, it } from 'vitest'
import { MAX_PIE_SLICES, requestedChart, resolveChart, type ResolvedChart } from './chart'
import type { Cell, QueryResult } from './execute'

const result = (columns: [string, boolean][], rows: Cell[][]): QueryResult => ({
  columns: columns.map(([label, numeric]) => ({ label, numeric })),
  rows,
  totalRows: rows.length,
  sourceRows: rows.length,
  notes: [],
})
/** The points of a bar, line or pie chart. */
const pointsOf = (chart: ResolvedChart | null) => {
  if (!chart || chart.type === 'heatmap') throw new Error(`Expected points, got ${chart?.type}`)
  return chart.points
}
const none = { type: 'none' as const, x: '', y: '', by: '' }
const byRegion = result(
  [
    ['Region', false],
    ['Sales', true],
  ],
  [
    ['West', 30],
    ['East', 20],
    ['North', 10],
  ],
)

describe('requestedChart', () => {
  it.each([
    ['Show sales by region as a pie chart', 'pie'],
    ['donut of orders by status', 'pie'],
    ['Orders by region and month as a heatmap', 'heatmap'],
    ['heat map of sales', 'heatmap'],
    ['bar chart of revenue per month', 'bar'],
    ['Plot revenue as a line graph', 'line'],
    ['graph orders by region', 'any'],
    ['Can you visualise this?', 'any'],
    ['How many orders per region?', null],
    ['Which product sells best at the bar?', null],
  ])('%j → %j', (question, kind) => {
    expect(requestedChart(question)).toBe(kind)
  })
})

describe('resolveChart', () => {
  it("uses Claude's chart when the question names none", () => {
    const chart = resolveChart(
      'Sales by region',
      { type: 'bar', x: 'Region', y: 'Sales', by: '' },
      byRegion,
    )
    expect(chart).toMatchObject({ type: 'bar', x: 'Region', y: 'Sales' })
    expect(pointsOf(chart)).toEqual([
      { label: 'West', value: 30 },
      { label: 'East', value: 20 },
      { label: 'North', value: 10 },
    ])
  })

  it('shows no chart when neither Claude nor the question asks for one', () => {
    expect(resolveChart('Sales by region', none, byRegion)).toBeNull()
  })

  it('always charts when asked, picking columns itself', () => {
    expect(resolveChart('chart sales by region', none, byRegion)).toMatchObject({
      type: 'bar',
      x: 'Region',
      y: 'Sales',
    })
  })

  it('draws the kind asked for over the one Claude chose', () => {
    const chart = resolveChart(
      'pie chart of sales',
      { type: 'bar', x: 'Region', y: 'Sales', by: '' },
      byRegion,
    )
    expect(chart!.type).toBe('pie')
  })

  it('says when the chart shows only some of the results', () => {
    const cut = { ...byRegion, totalRows: 250 }
    expect(resolveChart('chart it', none, cut)!.notes).toEqual([
      'The chart shows the first 3 of 250 results.',
    ])
  })

  it('counts rows per category when there are no numbers', () => {
    const rows = result([['Status', false]], [['Shipped'], ['Open'], ['Shipped']])
    expect(resolveChart('graph the statuses', none, rows)).toMatchObject({
      x: 'Status',
      y: 'Rows',
      points: [
        { label: 'Shipped', value: 2 },
        { label: 'Open', value: 1 },
      ],
    })
  })

  it('charts headline figures side by side', () => {
    const totals = result(
      [
        ['Costs', true],
        ['Sales', true],
      ],
      [[40, 60]],
    )
    expect(pointsOf(resolveChart('pie chart of costs vs sales', none, totals))).toEqual([
      { label: 'Sales', value: 60 },
      { label: 'Costs', value: 40 },
    ])
  })

  it('charts a single row, and notes rows without a value', () => {
    const one = result(
      [
        ['Region', false],
        ['Sales', true],
      ],
      [
        ['West', 5],
        ['East', null],
      ],
    )
    const chart = resolveChart('bar chart', none, one)!
    expect(pointsOf(chart)).toEqual([{ label: 'West', value: 5 }])
    expect(chart.notes).toEqual(['1 row without a Sales value is left out of the chart.'])
  })

  it('has nothing to draw for an empty result', () => {
    expect(resolveChart('chart it', none, result([['Region', false]], []))).toBeNull()
  })

  it(`folds a pie past ${MAX_PIE_SLICES} slices into "Other", largest first`, () => {
    const many = result(
      [
        ['Shop', false],
        ['Sales', true],
      ],
      [1, 9, 2, 8, 3, 7, 4].map((v) => [`S${v}`, v]),
    )
    const chart = resolveChart('pie chart', none, many)!
    expect(pointsOf(chart).map((p) => p.label)).toEqual(['S9', 'S8', 'S7', 'S4', 'S3', 'Other (2)'])
    expect(pointsOf(chart).at(-1)!.value).toBe(3)
  })

  it('leaves values of zero or less out of a pie, or draws bars when none are left', () => {
    const mixed = result(
      [
        ['Shop', false],
        ['Profit', true],
      ],
      [
        ['A', 5],
        ['B', -2],
      ],
    )
    expect(resolveChart('pie chart', none, mixed)).toMatchObject({
      type: 'pie',
      points: [{ label: 'A', value: 5 }],
      notes: ['1 value of zero or less is left out of the pie chart.'],
    })
    const losses = result(mixed.columns.map((c) => [c.label, c.numeric]), [['B', -2]])
    expect(resolveChart('pie chart', none, losses)!.type).toBe('bar')
  })
})

describe('resolveChart: heatmaps', () => {
  const byRegionAndMonth = result(
    [
      ['Region', false],
      ['Month', false],
      ['Orders', true],
    ],
    [
      ['West', '2024-01', 3],
      ['West', '2024-02', 5],
      ['East', '2024-01', 2],
      ['East', '2024-01', 1],
    ],
  )

  it('lays out a grid in result order, adding repeats and leaving gaps empty', () => {
    expect(resolveChart('heatmap of orders', none, byRegionAndMonth)).toEqual({
      type: 'heatmap',
      x: 'Region',
      y: 'Orders',
      by: 'Month',
      rows: ['West', 'East'],
      columns: ['2024-01', '2024-02'],
      values: [
        [3, 5],
        [3, null],
      ],
      notes: [],
    })
  })

  it("uses Claude's headings to choose rows and columns", () => {
    const chart = resolveChart(
      'Orders by month and region',
      { type: 'heatmap', x: 'Month', y: 'Orders', by: 'Region' },
      byRegionAndMonth,
    )
    expect(chart).toMatchObject({ rows: ['2024-01', '2024-02'], columns: ['East', 'West'] })
  })

  it('sorts the columns, so months run in order however the rows arrive', () => {
    const months = result(
      [
        ['Region', false],
        ['Month', false],
        ['Orders', true],
      ],
      [
        ['West', '2024-03', 1],
        ['West', '2024-10', 2],
        ['East', '2024-02', 3],
      ],
    )
    expect(resolveChart('heatmap', none, months)).toMatchObject({
      rows: ['West', 'East'],
      columns: ['2024-02', '2024-03', '2024-10'],
      values: [
        [null, 1, 2],
        [3, null, null],
      ],
    })
  })

  it('counts rows per pair when there are no numbers', () => {
    const pairs = result(
      [
        ['Region', false],
        ['Status', false],
      ],
      [
        ['West', 'Open'],
        ['West', 'Open'],
        ['East', 'Shipped'],
      ],
    )
    expect(resolveChart('heatmap', none, pairs)).toMatchObject({
      y: 'Rows',
      values: [
        [2, null],
        [null, 1],
      ],
    })
  })

  it('draws bars, with a note, when there is only one category', () => {
    const chart = resolveChart('heatmap of sales', none, byRegion)!
    expect(chart.type).toBe('bar')
    expect(chart.notes[0]).toMatch(/needs two things to compare across/)
  })
})
