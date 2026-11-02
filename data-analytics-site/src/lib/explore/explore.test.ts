import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import {
  MAX_GROUPS,
  calculate,
  compareGroups,
  correlation,
  distribution,
  exploreColumns,
  niceStep,
  overTime,
  periodPart,
  readNumber,
  related,
  timeBucket,
} from './explore'

const rows = [
  { Date: '2024-01-05', Year: '2024', Region: 'North', 'Books Read': '4', 'Commute (minutes)': '30', ID: 'A1' },
  { Date: '2024-01-20', Year: '2024', Region: 'South', 'Books Read': '6', 'Commute (minutes)': '20', ID: 'A2' },
  { Date: '2024-02-11', Year: '2024', Region: 'North', 'Books Read': '2', 'Commute (minutes)': '50', ID: 'A3' },
  { Date: '2024-04-02', Year: '2025', Region: 'West', 'Books Read': 'n/a', 'Commute (minutes)': '40', ID: 'A4' },
  { Date: '', Year: '2025', Region: 'South', 'Books Read': '8', 'Commute (minutes)': '10', ID: 'A5' },
]
const columns = Object.keys(rows[0])

describe('which columns fit which question', () => {
  it('measures numbers, groups by few values and years, and finds time columns', () => {
    const found = exploreColumns(rows, profileDataset({ columns, rows }))
    expect(found.measures).toEqual(['Books Read', 'Commute (minutes)'])
    expect(found.groups).toEqual(['Year', 'Region'])
    expect(found.time.map((t) => [t.name, t.grain])).toEqual([
      ['Date', 'date'],
      ['Year', 'year'],
    ])
    expect(found.time[0].steps).toEqual(['day', 'month', 'quarter', 'year'])
  })
})

describe('parts of a date written as numbers', () => {
  const snow = Array.from({ length: 36 }, (_, i) => ({
    year: String(2020 + Math.floor(i / 12)),
    month: String((i % 12) + 1),
    snowfall_inches: String((i * 7) % 40),
    'Days late': String((i % 12) + 1),
  }))
  const profile = profileDataset({ columns: Object.keys(snow[0]), rows: snow })
  const col = (name: string) => profile.columns.find((c) => c.name === name)!

  it('reads a month column of 1 to 12 as months, not an amount', () => {
    expect(periodPart(col('month'))).toBe('month')
    const found = exploreColumns(snow, profile)
    expect(found.measures).toEqual(['snowfall_inches', 'Days late'])
    expect(found.groups).toContain('month')
    expect(found.time.find((t) => t.name === 'month')).toMatchObject({ grain: 'month-name' })
  })

  it('keeps amounts that only look like a sequence, and plural durations, as amounts', () => {
    expect(periodPart(col('Days late'))).toBeNull()
    expect(periodPart(col('snowfall_inches'))).toBeNull()
  })

  it('needs the values to fit: a "month" column up to 13 is not months', () => {
    const odd = [{ month: '1' }, { month: '13' }]
    expect(periodPart(profileDataset({ columns: ['month'], rows: odd }).columns[0])).toBeNull()
  })

  it('charts month numbers as Jan to Dec', () => {
    const month = exploreColumns(snow, profile).time.find((t) => t.name === 'month')!
    const answer = overTime(snow, month, 'month-name', 'snowfall_inches', 'average')
    expect(answer.points.map((p) => p.label)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ])
    expect(timeBucket('3', 'month-name', 'month-name')).toEqual({ key: 'M03', label: 'Mar' })
    expect(answer.summary).toMatch(/^Across the year, average snowfall_inches is highest in \w{3} \(.+\) and lowest in \w{3}/)
  })
})

describe('numbers and calculations', () => {
  it('reads numbers people write, and nothing else', () => {
    expect(readNumber('1,200')).toBe(1200)
    expect(readNumber('$12.50')).toBe(12.5)
    expect(readNumber('45%')).toBe(45)
    expect(readNumber('n/a')).toBeNull()
    expect(readNumber('abc')).toBeNull()
  })

  it.each([
    ['sum', 10],
    ['average', 2.5],
    ['median', 2.5],
    ['min', 1],
    ['max', 4],
    ['count', 4],
  ] as const)('%s', (calc, expected) => {
    expect(calculate([4, 1, 3, 2], calc)).toBe(expected)
  })
})

describe('over time', () => {
  it('groups dates by month, quarter or year, in time order', () => {
    expect(timeBucket('2024-02-11', 'date', 'month')).toEqual({ key: '2024-02', label: 'Feb 2024' })
    expect(timeBucket('2024-02-11', 'date', 'quarter')).toEqual({ key: '2024-Q1', label: 'Q1 2024' })
    expect(timeBucket('Q3 2024', 'quarter', 'quarter')).toEqual({ key: '2024-Q3', label: 'Q3 2024' })
    expect(timeBucket('nope', 'date', 'month')).toBeNull()
  })

  it('totals a measure per month, noting rows left out', () => {
    const time = exploreColumns(rows, profileDataset({ columns, rows })).time[0]
    const answer = overTime(rows, time, 'month', 'Books Read', 'sum')
    expect(answer.points).toEqual([
      { label: 'Jan 2024', value: 10 },
      { label: 'Feb 2024', value: 2 },
    ])
    expect(answer.y).toBe('Total Books Read')
    expect(answer.summary).toContain('from 10 in Jan 2024 to 2 in Feb 2024 (-80%)')
    expect(answer.notes).toEqual([
      '1 row had no readable Date and was left out.',
      '1 row had no number for Books Read and was left out.',
    ])
  })

  it('counts rows without a measure', () => {
    const time = { name: 'Year', grain: 'year' as const, steps: ['year' as const] }
    expect(overTime(rows, time, 'year', null, 'count').points).toEqual([
      { label: '2024', value: 3 },
      { label: '2025', value: 2 },
    ])
  })
})

describe('comparing groups', () => {
  it('sorts categories largest first and says which is highest and lowest', () => {
    const answer = compareGroups(rows, 'Region', 'Books Read', 'average')
    expect(answer.points).toEqual([
      { label: 'South', value: 7 },
      { label: 'North', value: 3 },
    ])
    expect(answer.summary).toBe('South has the highest average Books Read (7) and North the lowest (3).')
  })

  it('keeps numbers such as years in order', () => {
    expect(compareGroups(rows, 'Year', null, 'count').points.map((p) => p.label)).toEqual(['2024', '2025'])
  })

  it('shows at most the largest groups', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ g: `G${i}`, v: String(i) }))
    const answer = compareGroups(many, 'g', 'v', 'sum')
    expect(answer.points).toHaveLength(MAX_GROUPS)
    expect(answer.points[0]).toEqual({ label: 'G39', value: 39 })
    expect(answer.notes.at(-1)).toBe('Only the 30 largest of 40 groups are shown.')
  })
})

describe('distribution', () => {
  it('gives whole numbers over a short range one bar each, with summary figures', () => {
    const answer = distribution(rows, 'Books Read')
    expect(answer.bins.map((b) => [b.label, b.count])).toEqual([
      ['2', 1],
      ['3', 0],
      ['4', 1],
      ['5', 0],
      ['6', 1],
      ['7', 0],
      ['8', 1],
    ])
    expect(answer.stats).toMatchObject({ count: 4, min: 2, median: 5, max: 8, mean: 5 })
  })

  it('uses round ranges for wider spreads, counting every value once', () => {
    const wide = Array.from({ length: 100 }, (_, i) => ({ v: String(i * 3.7) }))
    const answer = distribution(wide, 'v')
    expect(answer.bins.reduce((n, b) => n + b.count, 0)).toBe(100)
    expect(answer.bins[0].label).toBe('0 to under 50')
    expect(niceStep(366, 10)).toBe(50)
    expect(niceStep(7, 10)).toBe(1)
  })
})

describe('two measures', () => {
  it('measures how closely they move together', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(correlation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1)
    expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull()
  })

  it('describes the relationship in plain words', () => {
    const answer = related(rows, 'Commute (minutes)', 'Books Read')
    expect(answer.pairs).toBe(4)
    expect(answer.r).toBeLessThan(-0.9)
    expect(answer.summary).toMatch(
      /^Rows with a higher Commute \(minutes\) tend to have a lower Books Read: a strong negative relationship/,
    )
  })

  it('draws at most 10,000 points but measures every row', () => {
    const big = Array.from({ length: 25_000 }, (_, i) => ({ a: String(i), b: String(i * 2) }))
    const answer = related(big, 'a', 'b')
    expect(answer.points.length).toBeLessThanOrEqual(10_000)
    expect(answer.pairs).toBe(25_000)
    expect(answer.notes[0]).toBe('The chart shows every 3rd row (8,334 of 25,000); the summary uses them all.')
  })
})
