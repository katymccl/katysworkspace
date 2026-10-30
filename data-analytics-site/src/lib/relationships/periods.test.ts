import { describe, expect, it } from 'vitest'
import { periodColumn, periodKey, readPeriod } from './periods'

describe('readPeriod', () => {
  it.each([
    ['2024-01-15', 'date', '2024-01-15'],
    ['1/15/2024', 'date', '2024-01-15'],
    ['Jan 15 2024', 'date', '2024-01-15'],
    ['15 January 2024', 'date', '2024-01-15'],
    ['2024-01', 'month', '2024-01'],
    ['2024/1', 'month', '2024-01'],
    ['01/2024', 'month', '2024-01'],
    ['Jan 2024', 'month', '2024-01'],
    ['January 2024', 'month', '2024-01'],
    ['Jan-24', 'month', '2024-01'],
    ['2024 Jan', 'month', '2024-01'],
    ['Q1 2024', 'quarter', '2024-Q1'],
    ['2024-Q1', 'quarter', '2024-Q1'],
    ['q3-2023', 'quarter', '2023-Q3'],
    ['2024', 'year', '2024'],
    ['January', 'month-name', 'M01'],
    ['Sept', 'month-name', 'M09'],
  ])('%j → %s %s', (value, grain, key) => {
    expect(readPeriod(value)).toEqual({ grain, key })
  })

  it.each(['', 'Shipped', '2024-13', '13/2024', 'Q5 2024', '1850', '12', 'Janet'])(
    '%j is not a period',
    (value) => {
      expect(readPeriod(value)).toBeNull()
    },
  )
})

describe('periodColumn', () => {
  it('finds the kind of period most values are', () => {
    expect(periodColumn('Period', ['2024-01', 'Feb 2024', 'March 2024', ''])).toBe('month')
    expect(periodColumn('Joined', ['4/2/2021', '2021-11-27'])).toBe('date')
  })

  it('needs at least 90% of values to be that kind', () => {
    const mostly = [...Array.from({ length: 8 }, (_, i) => `2024-0${i + 1}`), 'n/a?', 'later']
    expect(periodColumn('Month', mostly)).toBeNull()
  })

  it('takes four-digit numbers as years only under a year header', () => {
    expect(periodColumn('Year', ['2023', '2024'])).toBe('year')
    expect(periodColumn('FY', ['2023', '2024'])).toBe('year')
    expect(periodColumn('Amount', ['2023', '2024'])).toBeNull()
  })

  it('takes month names only under a month header', () => {
    expect(periodColumn('Month', ['January', 'Feb'])).toBe('month-name')
    expect(periodColumn('Name', ['January', 'Feb'])).toBeNull()
  })
})

describe('periodKey', () => {
  it('gives every way of writing one period the same key, and other kinds none', () => {
    expect(periodKey('Jan 2024', 'month')).toBe(periodKey('2024-01', 'month'))
    expect(periodKey('2024-01-15', 'month')).toBeNull()
    expect(periodKey('n/a', 'month')).toBeNull()
  })
})
