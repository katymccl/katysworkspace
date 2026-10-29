import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import { NO_EDITS, applyEdits, summariseEdits } from './apply'
import { dateShape, describeDates, readDate, standardiseDate } from './dates'
import { findIssues } from './detect'
import { claudeCanHelp, mayHaveVariants } from './request'

describe('standardiseDate', () => {
  it.each([
    ['2024-01-03', '2024-01-03'],
    ['2024/1/3', '2024-01-03'],
    ['2024.01.03', '2024-01-03'],
    ['Jan 3 2024', '2024-01-03'],
    ['Jan 3, 2024', '2024-01-03'],
    ['January 3rd, 2024', '2024-01-03'],
    ['3 Jan 2024', '2024-01-03'],
    ['3-Jan-24', '2024-01-03'],
    ['03 Sept 2024', '2024-09-03'],
    ['01/03/2024', '2024-01-03'],
    ['1-3-99', '1999-01-03'],
  ])('reads %j month first as %j', (value, iso) => {
    expect(standardiseDate(value, 'month-first')).toBe(iso)
  })

  it('reads number-only dates in the order given, and named months either way', () => {
    expect(standardiseDate('01/04/2024', 'day-first')).toBe('2024-04-01')
    expect(standardiseDate('01/04/2024', 'month-first')).toBe('2024-01-04')
    expect(standardiseDate('Jan 4 2024', 'day-first')).toBe('2024-01-04')
  })

  it('returns null for days that do not exist in that order', () => {
    expect(standardiseDate('25/12/2024', 'month-first')).toBeNull()
    expect(standardiseDate('25/12/2024', 'day-first')).toBe('2024-12-25')
  })

  it.each(['soon', '2024', '31/31/2024', 'Feb 30 2024', 'Monday 3', '2024-01-03T10:00', '1/2/3/2024'])(
    'does not read %j',
    (value) => {
      expect(readDate(value)).toBeNull()
    },
  )
})

describe('dateShape', () => {
  it('tells padded and unpadded styles apart but not two days in one style', () => {
    expect(dateShape('01/04/2024')).toBe(dateShape('12/25/2024'))
    expect(dateShape('1/4/2024')).not.toBe(dateShape('01/04/2024'))
    expect(dateShape('Jan 5 2024')).toBe('Mon 9 9999')
    expect(dateShape('6 January 2024')).toBe('9 Month 9999')
  })
})

describe('describeDates', () => {
  const facts = (...values: string[]) => describeDates(values.map((v, i) => [i, v]))

  it('counts the ways dates are written, most common first, and lists rows it cannot read', () => {
    const d = facts('2024-01-03', 'Jan 5 2024', '2024-01-07', 'soon')
    expect(d.formats).toEqual([
      { example: '2024-01-03', count: 2 },
      { example: 'Jan 5 2024', count: 1 },
    ])
    expect(d.readable).toBe(3)
    expect(d.unreadable).toEqual([3])
    expect(d.order).toBeUndefined()
  })

  it('works out day or month first from a number over 12', () => {
    expect(facts('01/04/2024', '25/04/2024').order).toBe('day-first')
    expect(facts('01/04/2024', '04/25/2024').order).toBe('month-first')
  })

  it('leaves the order to the user when nothing shows it or the values disagree', () => {
    const unclear = facts('01/04/2024', '2024-01-05')
    expect(unclear.order).toBeNull()
    expect(unclear.ambiguousExample).toBe('01/04/2024')
    expect(facts('25/04/2024', '04/25/2024').order).toBeNull()
  })

  it('does not ask about dates where day and month are the same number', () => {
    expect(facts('04/04/2024', '2024-01-05').ambiguousExample).toBeNull()
  })
})

describe('date columns in Prepare my data', () => {
  const columns = ['id', 'ordered', 'note']
  const make = (dates: string[]) =>
    dates.map((d, i) => ({ id: String(i + 1), ordered: d, note: 'x' }))
  const issuesOf = (rows: ReturnType<typeof make>) =>
    findIssues(columns, rows, profileDataset({ columns, rows }))

  it('offers a column of dates written several ways, and does not list them as wrong kind', () => {
    const rows = make([
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
      '2024-01-06',
      '2024-01-07',
      '2024-01-08',
      '2024-01-09',
      'Jan 10 2024',
      '11 January 2024',
      'soon',
    ])
    const issues = issuesOf(rows)
    expect(issues.dateFormats).toHaveLength(1)
    expect(issues.dateFormats[0]).toMatchObject({ column: 'ordered', readable: 9, unreadable: [9] })
    expect(issues.mismatches).toEqual([])
  })

  it('offers a column written one way the profiler does not read as dates', () => {
    expect(issuesOf(make(['Jan 3 2024', 'Feb 4 2024'])).dateFormats).toHaveLength(1)
  })

  it('leaves alone dates already written one readable way, and columns of mostly text', () => {
    expect(issuesOf(make(['2024-01-03', '2024-02-04'])).dateFormats).toEqual([])
    expect(issuesOf(make(['Jan 3 2024', 'soon', 'later', '2024-01-01'])).dateFormats).toEqual([])
  })

  it('rewrites the chosen columns as YYYY-MM-DD, including dates typed into cells', () => {
    const rows = make(['01/04/2024', 'Jan 5 2024', 'soon'])
    const issues = issuesOf(rows)
    const edits = {
      ...NO_EDITS,
      cells: { [`2\u0000ordered`]: '6 Jan 2024' },
      dates: [{ column: 'ordered', order: 'day-first' as const }],
    }
    expect(applyEdits(rows, issues, edits).map((r) => r.ordered)).toEqual([
      '2024-04-01',
      '2024-01-05',
      '2024-01-06',
    ])
    expect(summariseEdits(rows, issues, edits).changedValues).toBe(3)
  })
})

describe('mayHaveVariants', () => {
  it.each([
    [['Shipped', 'shipped']],
    [['North', 'N.']],
    [['New York', 'NY']],
    [['London', 'Londn']],
  ])('spots %j', (values) => {
    expect(mayHaveVariants(values)).toBe(true)
  })

  it.each([
    [['North', 'South', 'East']],
    [['SKU-1001', 'SKU-1002']],
    [['Pen', 'Pencil', 'Paper']],
    [['small', 'medium', 'large']],
  ])('lets %j through', (values) => {
    expect(mayHaveVariants(values)).toBe(false)
  })
})

describe('claudeCanHelp', () => {
  const columns = ['region', 'amount']
  const helpFor = (cells: [string, string][]) => {
    const rows = cells.map(([region, amount]) => ({ region, amount }))
    const profile = profileDataset({ columns, rows })
    return claudeCanHelp(rows, profile, findIssues(columns, rows, profile))
  }

  it('has nothing to do on tidy data', () => {
    expect(helpFor([['North', '1'], ['South', '2'], ['North', '3']])).toEqual({
      fixes: false,
      spellings: false,
    })
  })

  it('checks spellings when a text column may write one thing two ways', () => {
    expect(helpFor([['North', '1'], ['north', '2'], ['South', '3']]).spellings).toBe(true)
  })

  it('suggests fixes for values of the wrong kind', () => {
    const cells: [string, string][] = [['North', 'abc'], ...[1, 2, 3, 4].map((n): [string, string] => ['South', String(n)])]
    expect(helpFor(cells).fixes).toBe(true)
  })
})
