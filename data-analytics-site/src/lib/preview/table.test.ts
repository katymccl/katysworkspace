import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import {
  compareValues,
  filterKindFor,
  isActive,
  matchesFilter,
  moveColumn,
  reconcileOrder,
  cellContains,
} from './table'

const sorted = (values: string[], type: Parameters<typeof compareValues>[2]) =>
  [...values].sort((a, b) => compareValues(a, b, type))

describe('sorting by type', () => {
  it('sorts numbers by value, with stray text after them', () => {
    expect(sorted(['10', '9', '1,200', 'n/a', '-3', '$5'], 'integer')).toEqual([
      '-3',
      '$5',
      '9',
      '10',
      '1,200',
      'n/a',
    ])
  })

  it('sorts dates by day, however they are written', () => {
    expect(sorted(['2024-03-01', '01/15/2024', '2023-12-31'], 'date')).toEqual([
      '2023-12-31',
      '01/15/2024',
      '2024-03-01',
    ])
  })

  it('sorts text naturally, ignoring case', () => {
    expect(sorted(['item 10', 'Item 2', 'apple'], 'string')).toEqual(['apple', 'Item 2', 'item 10'])
  })
})

describe('filters', () => {
  const rows = [
    { name: 'A', region: 'North', total: '12', note: 'first' },
    { name: 'B', region: 'South', total: '1,200', note: 'second' },
    { name: 'C', region: 'North', total: '', note: 'third' },
  ]
  const profile = profileDataset({ columns: Object.keys(rows[0]), rows })
  const col = (n: string) => profile.columns.find((c) => c.name === n)!

  it('offers a range for numbers, a list for categories and "contains" for the rest', () => {
    expect(filterKindFor(col('total'))).toBe('range')
    expect(filterKindFor(col('region'))).toBe('value')
    expect(filterKindFor(col('note'))).toBe('text')
  })

  it('matches by range, value or text, leaving blanks out once a filter is set', () => {
    const range = { kind: 'range' as const, min: 100, max: null }
    expect(rows.map((r) => matchesFilter(r.total, range))).toEqual([false, true, false])
    expect(matchesFilter('North', { kind: 'value', equals: 'North' })).toBe(true)
    expect(matchesFilter('SECOND', { kind: 'text', contains: 'cond' })).toBe(true)
    expect(matchesFilter('', { kind: 'text', contains: '' })).toBe(true)
    expect(isActive({ kind: 'range', min: null, max: null })).toBe(false)
  })

  it('searches cells ignoring case, and an empty search matches everything', () => {
    expect(rows.filter((r) => Object.values(r).some((v) => cellContains(v, 'sOuTh'))).map((r) => r.name)).toEqual(['B'])
    expect(cellContains(undefined, 'a')).toBe(false)
    expect(cellContains(undefined, ' ')).toBe(true)
  })
})

describe('column order', () => {
  it('keeps the remembered order, dropping removed columns and adding new ones at the end', () => {
    expect(reconcileOrder(['c', 'a', 'gone'], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
    expect(reconcileOrder(null, ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('moves a column before or after another', () => {
    expect(moveColumn(['a', 'b', 'c'], 'c', 'a', 'before')).toEqual(['c', 'a', 'b'])
    expect(moveColumn(['a', 'b', 'c'], 'a', 'b', 'after')).toEqual(['b', 'a', 'c'])
    expect(moveColumn(['a', 'b'], 'a', 'a', 'after')).toEqual(['a', 'b'])
  })
})
