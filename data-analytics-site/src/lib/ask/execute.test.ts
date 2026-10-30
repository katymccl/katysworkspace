import { describe, expect, it } from 'vitest'
import {
  MAX_JOINED_ROWS,
  bucketLabel,
  compareCells,
  filterTest,
  runQuery,
  type QueryTable,
} from './execute'
import type { QueryPlan } from './schema'

const orders: QueryTable = {
  name: 'Orders',
  rows: [
    { order_id: '1', customer: 'C1', date: '2024-01-15', status: 'Shipped', total: '1,200.50' },
    { order_id: '2', customer: 'C2', date: '2024-01-20', status: 'shipped ', total: '80' },
    { order_id: '3', customer: 'C1', date: '2024-02-03', status: 'Pending', total: 'n/a' },
    { order_id: '4', customer: 'C3', date: '03/10/2024', status: 'Shipped', total: '20' },
    { order_id: '5', customer: 'C9', date: '2024-03-28', status: '', total: 'oops' },
  ],
}
const customers: QueryTable = {
  name: 'Customers',
  rows: [
    { id: 'c1', region: 'North' },
    { id: 'C2', region: 'South' },
    { id: 'C3', region: 'North' },
  ],
}
const tables = new Map([
  ['orders', orders],
  ['customers', customers],
])

const plan = (p: Partial<QueryPlan>): QueryPlan => ({
  from: 'orders',
  joins: [],
  filters: [],
  groupBy: [],
  measures: [],
  select: [],
  sort: [],
  limit: 100,
  ...p,
})
const ref = (column: string, dataset = 'orders') => ({ dataset, column })

function run(p: Partial<QueryPlan>) {
  const outcome = runQuery(plan(p), tables)
  if (!outcome.ok) throw new Error(outcome.message)
  return outcome.result
}

describe('runQuery', () => {
  it('counts rows overall, and still gives a row when nothing matches', () => {
    expect(run({ measures: [{ fn: 'count', column: null, label: 'Orders' }] }).rows).toEqual([[5]])
    const none = run({
      filters: [{ column: ref('status'), op: 'equals', values: ['Cancelled'] }],
      measures: [{ fn: 'count', column: null, label: 'Orders' }],
    })
    expect(none.rows).toEqual([[0]])
    expect(none.sourceRows).toBe(0)
  })

  it('matches text case-insensitively and trimmed, and numbers by value', () => {
    const shipped = run({
      filters: [{ column: ref('status'), op: 'equals', values: ['SHIPPED'] }],
      select: [{ column: ref('order_id'), label: 'Order' }],
    })
    expect(shipped.rows).toEqual([['1'], ['2'], ['4']])
    const big = run({
      filters: [{ column: ref('total'), op: 'greater_than', values: ['1000'] }],
      select: [{ column: ref('order_id'), label: 'Order' }],
    })
    expect(big.rows).toEqual([['1']])
  })

  it('compares dates written in different formats', () => {
    const march = run({
      filters: [{ column: ref('date'), op: 'at_least', values: ['2024-03-01'] }],
      select: [{ column: ref('order_id'), label: 'Order' }],
    })
    expect(march.rows).toEqual([['4'], ['5']])
  })

  it('groups by normalised value, sums numbers and notes skipped values', () => {
    const result = run({
      groupBy: [{ column: ref('status'), bucket: 'none', label: 'Status' }],
      measures: [
        { fn: 'count', column: null, label: 'Orders' },
        { fn: 'sum', column: ref('total'), label: 'Revenue' },
      ],
      sort: [{ label: 'Orders', direction: 'descending' }],
    })
    expect(result.columns).toEqual([
      { label: 'Status', numeric: false },
      { label: 'Orders', numeric: true },
      { label: 'Revenue', numeric: true },
    ])
    expect(result.rows).toEqual([
      ['Shipped', 3, 1300.5],
      ['Pending', 1, null],
      [null, 1, null],
    ])
    expect(result.notes).toEqual([
      "1 value in total wasn't a number or date and was left out of Revenue.",
    ])
  })

  it('groups dates into periods, in time order by default', () => {
    const result = run({
      groupBy: [{ column: ref('date'), bucket: 'month', label: 'Month' }],
      measures: [{ fn: 'count', column: null, label: 'Orders' }],
    })
    expect(result.rows).toEqual([
      ['2024-01', 2],
      ['2024-02', 1],
      ['2024-03', 2],
    ])
  })

  it('joins another dataset by matching values and notes rows without a match', () => {
    const result = run({
      joins: [{ dataset: 'customers', on: ref('customer'), column: 'id' }],
      groupBy: [{ column: ref('region', 'customers'), bucket: 'none', label: 'Region' }],
      measures: [{ fn: 'count_distinct', column: ref('customer'), label: 'Customers' }],
    })
    expect(result.rows).toEqual([
      ['North', 2],
      ['South', 1],
      [null, 1],
    ])
    expect(result.notes).toEqual([
      '1 row had no match in Customers, so its Customers values are blank.',
    ])
  })

  it('notes rows repeated by a join that matches several rows', () => {
    const dupes = new Map([
      ['orders', orders],
      ['customers', { name: 'Customers', rows: [...customers.rows, { id: 'C1', region: 'East' }] }],
    ])
    const outcome = runQuery(
      plan({
        joins: [{ dataset: 'customers', on: ref('customer'), column: 'id' }],
        measures: [{ fn: 'count', column: null, label: 'Rows' }],
      }),
      dupes,
    )
    expect(outcome.ok && outcome.result.rows).toEqual([[7]])
    expect(outcome.ok && outcome.result.notes[1]).toBe(
      '2 rows matched more than one row in Customers, so they appear more than once.',
    )
  })

  it('joins time columns by period, however each is written', () => {
    const outcome = runQuery(
      {
        ...plan({
          joins: [{ dataset: 'targets', on: { dataset: 'sales', column: 'Month' }, column: 'Period' }],
        }),
        from: 'sales',
        select: [
          { column: { dataset: 'sales', column: 'Month' }, label: 'Month' },
          { column: { dataset: 'targets', column: 'Target' }, label: 'Target' },
        ],
      },
      new Map([
        ['sales', { name: 'Sales', rows: [{ Month: '2024-01' }, { Month: '2024-02' }] }],
        [
          'targets',
          {
            name: 'Targets',
            rows: [
              { Period: 'Jan 2024', Target: '200' },
              { Period: 'February 2024', Target: '210' },
            ],
          },
        ],
      ]),
    )
    expect(outcome.ok && outcome.result.rows).toEqual([
      ['2024-01', '200'],
      ['2024-02', '210'],
    ])
  })

  it('stops joins that multiply rows too far', () => {
    const many = Array.from({ length: 1000 }, () => ({ k: 'x' }))
    const outcome = runQuery(
      {
        ...plan({ joins: [{ dataset: 'b', on: { dataset: 'a', column: 'k' }, column: 'k' }] }),
        from: 'a',
        measures: [{ fn: 'count', column: null, label: 'n' }],
      },
      new Map([
        ['a', { name: 'A', rows: many }],
        ['b', { name: 'B', rows: many }],
      ]),
    )
    expect(1000 * 1000).toBeGreaterThan(MAX_JOINED_ROWS)
    expect(outcome.ok).toBe(false)
  })

  it('finds the earliest and latest dates, kept as written', () => {
    const result = run({
      measures: [
        { fn: 'min', column: ref('date'), label: 'First' },
        { fn: 'max', column: ref('date'), label: 'Last' },
        { fn: 'average', column: ref('total'), label: 'Average' },
      ],
    })
    expect(result.rows).toEqual([['2024-01-15', '2024-03-28', (1200.5 + 80 + 20) / 3]])
  })

  it('applies the limit but reports the full count', () => {
    const result = run({ select: [{ column: ref('order_id'), label: 'Order' }], limit: 2 })
    expect(result.rows).toHaveLength(2)
    expect(result.totalRows).toBe(5)
  })

  it('fails clearly when a dataset is no longer open', () => {
    expect(runQuery(plan({ from: 'gone' }), tables)).toEqual({
      ok: false,
      message: 'The dataset this question is about is no longer open.',
    })
  })
})

describe('filterTest', () => {
  it('never matches missing cells except with is_missing', () => {
    expect(filterTest('not_equals', ['a'])('')).toBe(false)
    expect(filterTest('is_missing', [])('N/A')).toBe(true)
    expect(filterTest('is_not_missing', [])('x')).toBe(true)
  })

  it('handles one_of and contains', () => {
    expect(filterTest('one_of', ['North', 'East'])(' north')).toBe(true)
    expect(filterTest('one_of', ['North', 'East'])('South')).toBe(false)
    expect(filterTest('contains', ['ship'])('Shipped')).toBe(true)
    expect(filterTest('not_contains', ['ship'])('Shipped')).toBe(false)
  })
})

describe('bucketLabel', () => {
  it('labels periods so they sort in time order', () => {
    expect(bucketLabel('2024-05-15T10:00:00Z', 'year')).toBe('2024')
    expect(bucketLabel('2024-05-15', 'quarter')).toBe('2024 Q2')
    expect(bucketLabel('5/15/2024', 'month')).toBe('2024-05')
    // 2024-05-15 is a Wednesday; its week starts on Monday the 13th.
    expect(bucketLabel('2024-05-15', 'week')).toBe('2024-05-13')
    expect(bucketLabel('not a date', 'day')).toBeNull()
  })
})

describe('compareCells', () => {
  it('orders numbers, numeric text and dates by value, blanks last', () => {
    expect(['10', '9', null, '100'].sort(compareCells)).toEqual(['9', '10', '100', null])
    expect(compareCells('1/2/2024', '2023-12-31')).toBeGreaterThan(0)
  })
})
