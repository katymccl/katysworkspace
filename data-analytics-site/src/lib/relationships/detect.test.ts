import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import {
  measureLink,
  measureOverlaps,
  normaliseValue,
  type KeyLinkCandidate,
  type RelationshipInput,
} from './detect'

function dataset(
  key: string,
  fileName: string,
  columns: string[],
  cells: string[][],
): RelationshipInput {
  const rows = cells.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])))
  return { key, fileName, columns, rows, profile: profileDataset({ columns, rows }) }
}

const overlaps = (input: RelationshipInput[]) =>
  measureOverlaps(input).filter((c): c is KeyLinkCandidate => c.kind === 'key-link')
const summary = (l: KeyLinkCandidate) =>
  `${l.from.dataset}.${l.from.column} -> ${l.to.dataset}.${l.to.column} (${l.cardinality}, ${l.sharedCount})`

const staff = dataset(
  'staff',
  'BookshopLibraries.csv',
  ['Staff Type', 'Number of Staff', 'Library', 'Library ID', 'Private'],
  [
    ['Librarians', '53', 'Idle Hour Library', 'L-IHL', 'No'],
    ['Librarians', '4', "The Bibliophile's Shelves", 'L-BS', 'Yes'],
    ['Librarians', '9', 'Bide Awhile', 'L-BA', 'No'],
    ['Library Assistants', '16', 'Idle Hour Library', 'L-IHL', 'No'],
    ['Library Assistants', '6', 'Bide Awhile', 'L-BA', 'No'],
    ['Library Technicians', '61', 'Idle Hour Library', 'L-IHL', 'No'],
  ],
)
const libraries = dataset(
  'libs',
  'Libraries.csv',
  ['LibraryID', 'Name', 'City', 'Open Sundays'],
  [
    ['L-IHL', 'Idle Hour Library', 'Leeds', 'Yes'],
    ['L-BS', "The Bibliophile's Shelves", 'York', 'No'],
    ['L-BA', 'Bide Awhile', 'Bath', 'No'],
    ['L-OFL', 'Old Friend Library', 'Leeds', 'Yes'],
  ],
)

describe('measureOverlaps: column overlaps', () => {
  it('measures a repeated ID against the table where it is unique', () => {
    const link = overlaps([staff, libraries]).find((l) => l.from.column === 'Library ID')!
    expect(link).toEqual({
      kind: 'key-link',
      id: 'staff:Library ID->libs:LibraryID',
      from: { dataset: 'staff', column: 'Library ID' },
      to: { dataset: 'libs', column: 'LibraryID' },
      cardinality: 'many-to-one',
      sharedCount: 3,
      fromCoverage: 1,
      toCoverage: 0.75,
      namesMatch: true,
      period: null,
      sharedExamples: ['L-BA', 'L-BS', 'L-IHL'],
    })
  })

  it('measures every pair of columns sharing a value, coincidences included', () => {
    const stock = dataset(
      'stock',
      'stock.csv',
      ['Copies', 'Genre'],
      [
        ['53', 'Librarians'],
        ['4', 'Novels'],
        ['99', 'Poetry'],
      ],
    )
    // No rules decide here: Claude judges that copies and staff numbers are a coincidence.
    expect(overlaps([staff, stock]).map(summary).sort()).toEqual([
      'staff.Staff Type -> stock.Genre (many-to-one, 1)',
      'stock.Copies -> staff.Number of Staff (one-to-one, 2)',
    ])
  })

  it('leaves out yes/no columns, which overlap with any other', () => {
    const found = overlaps([staff, libraries])
    const columns = found.flatMap((l) => [l.from.column, l.to.column])
    expect(columns).not.toContain('Private')
    expect(columns).not.toContain('Open Sundays')
  })

  it('lists matching names first, then the most shared values', () => {
    expect(overlaps([staff, libraries]).map(summary)).toEqual([
      'staff.Library ID -> libs.LibraryID (many-to-one, 3)',
      'staff.Library -> libs.Name (many-to-one, 3)',
    ])
  })

  it('notes an ID named after the other dataset as matching names', () => {
    const customers = dataset('cust', 'customers.csv', ['id', 'name'], [
      ['1', 'Ada'],
      ['2', 'Grace'],
      ['3', 'Alan'],
    ])
    const orders = dataset('ord', 'orders.csv', ['order_no', 'customer_id'], [
      ['100', '1'],
      ['101', '1'],
      ['102', '3'],
    ])
    const link = overlaps([orders, customers]).find((l) => l.from.column === 'customer_id')!
    expect(summary(link)).toBe('ord.customer_id -> cust.id (many-to-one, 2)')
    expect(link.namesMatch).toBe(true)
  })

  it('compares numbers by value and text without case or padding', () => {
    expect(normaliseValue('1,000')).toBe(normaliseValue('1000'))
    expect(normaliseValue(' L-IHL ')).toBe(normaliseValue('l-ihl'))
    expect(normaliseValue('02134')).not.toBe(normaliseValue('2134'))
    expect(normaliseValue('')).toBeNull()
    expect(normaliseValue('NA')).toBeNull()
  })
})

describe('measureLink', () => {
  it('measures two columns even when they share nothing', () => {
    const link = measureLink(
      [staff, libraries],
      { dataset: 'staff', column: 'Staff Type' },
      { dataset: 'libs', column: 'City' },
    )
    expect(link).toMatchObject({ sharedCount: 0, fromCoverage: 0, sharedExamples: [] })
  })

  it('is null when a dataset or column is not open', () => {
    const missing = { dataset: 'libs', column: 'Nope' }
    expect(measureLink([staff, libraries], { dataset: 'staff', column: 'Library' }, missing)).toBe(
      null,
    )
  })
})

describe('measureOverlaps: similar structure', () => {
  it('notes datasets that share most of their columns, and still measures their columns', () => {
    const jan = dataset('jan', 'sales-jan.csv', ['Date', 'Store', 'Amount'], [
      ['2024-01-01', 'A', '5'],
    ])
    const feb = dataset('feb', 'sales-feb.csv', ['date', 'store', 'amount'], [
      ['2024-02-01', 'A', '7'],
    ])
    const found = measureOverlaps([jan, feb])
    expect(found[0]).toEqual({
      kind: 'similar-structure',
      id: 'jan~feb',
      datasets: ['jan', 'feb'],
      sharedColumns: ['Amount', 'Date', 'Store'],
      similarity: 1,
    })
    expect(found.filter((c) => c.kind === 'key-link').map((c) => c.id)).toEqual([
      'jan:Store->feb:store',
    ])
  })

  it('does not call unrelated layouts similar', () => {
    expect(measureOverlaps([staff, libraries]).some((c) => c.kind === 'similar-structure')).toBe(
      false,
    )
  })
})

describe('measureOverlaps: time columns', () => {
  const sales = dataset(
    'sales',
    'sales.csv',
    ['Month', 'Region', 'Revenue'],
    [
      ['2024-01', 'West', '120'],
      ['2024-01', 'East', '90'],
      ['2024-02', 'West', '130'],
      ['2024-03', 'East', '95'],
    ],
  )
  const targets = dataset(
    'targets',
    'targets.csv',
    ['Period', 'Target'],
    [
      ['Jan 2024', '200'],
      ['Feb 2024', '210'],
      ['Mar 2024', '220'],
    ],
  )

  it('matches month columns as periods however each is written', () => {
    const [link] = overlaps([sales, targets])
    expect(summary(link)).toBe('sales.Month -> targets.Period (many-to-one, 3)')
    expect(link.period).toBe('month')
    expect(link.sharedExamples).toEqual(['2024-01', '2024-02', '2024-03'])
  })

  it('matches dates with dates but not with months', () => {
    const visits = dataset('visits', 'visits.csv', ['Visit Date'], [
      ['2024-01-05'],
      ['2024-01-06'],
    ])
    const weather = dataset('weather', 'weather.csv', ['Day'], [['1/5/2024'], ['1/6/2024']])
    expect(overlaps([visits, weather]).map(summary)).toEqual([
      'visits.Visit Date -> weather.Day (one-to-one, 2)',
    ])
    expect(overlaps([visits, sales])).toEqual([])
  })

  it('reads years as periods only under year headers', () => {
    const budget = dataset('budget', 'budget.csv', ['Year'], [['2022'], ['2023'], ['2024']])
    const hires = dataset('hires', 'hires.csv', ['FY'], [['2023'], ['2024'], ['2024']])
    const prices = dataset('prices', 'prices.csv', ['Price'], [['2022'], ['2023'], ['2024']])
    const found = overlaps([budget, hires, prices])
    expect(found.find((l) => l.to.column === 'Year')).toMatchObject({ period: 'year' })
    // A price column holds amounts, not years, so it never meets the year columns.
    expect(found.some((l) => [l.from.column, l.to.column].includes('Price'))).toBe(false)
  })

  it('counts two spellings of one month as a repeat when working out one or many', () => {
    const plans = dataset('plans', 'plans.csv', ['Month'], [['Jan 2024'], ['2024-01'], ['Feb 2024']])
    expect(overlaps([plans, targets]).map((l) => l.cardinality)).toEqual(['many-to-one'])
  })
})

describe('measureOverlaps: general behaviour', () => {
  it('is deterministic and independent of dataset order', () => {
    const first = measureOverlaps([staff, libraries])
    expect(measureOverlaps([staff, libraries])).toEqual(first)
    const reversed = measureOverlaps([libraries, staff])
      .map((c) => c.id)
      .sort()
    expect(reversed).toEqual(first.map((c) => c.id).sort())
  })

  it('handles zero, one, and empty datasets', () => {
    expect(measureOverlaps([])).toEqual([])
    expect(measureOverlaps([staff])).toEqual([])
    const empty = dataset('e', 'empty.csv', ['Library ID'], [])
    expect(measureOverlaps([staff, empty])).toEqual([])
  })

  it('never modifies the datasets', () => {
    const before = JSON.stringify([staff.rows, libraries.rows])
    measureOverlaps([staff, libraries])
    expect(JSON.stringify([staff.rows, libraries.rows])).toBe(before)
  })
})
