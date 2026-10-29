import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import {
  detectRelationships,
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

const links = (input: RelationshipInput[]) =>
  detectRelationships(input).filter((c): c is KeyLinkCandidate => c.kind === 'key-link')
const summary = (l: KeyLinkCandidate) =>
  `${l.from.dataset}.${l.from.column} -> ${l.to.dataset}.${l.to.column} (${l.cardinality}, ${l.strength})`

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

describe('detectRelationships: key links', () => {
  it('links a repeated ID to the table where it is unique, many-to-one', () => {
    const found = links([staff, libraries]).map(summary)
    expect(found).toContain('staff.Library ID -> libs.LibraryID (many-to-one, strong)')
  })

  it('also links matching names, through their values', () => {
    expect(links([staff, libraries]).map(summary)).toContain(
      'staff.Library -> libs.Name (many-to-one, strong)',
    )
  })

  it('reports how much of each side is covered, with sorted examples', () => {
    const link = links([staff, libraries]).find((l) => l.from.column === 'Library ID')!
    expect(link).toMatchObject({
      sharedCount: 3,
      fromCoverage: 1,
      toCoverage: 0.75,
      namesMatch: true,
      sharedExamples: ['L-BA', 'L-BS', 'L-IHL'],
    })
  })

  it('ignores small vocabularies that overlap by coincidence', () => {
    // Private and Open Sundays are both yes/no, but nothing says they are related.
    const found = links([staff, libraries])
    expect(found.some((l) => [l.from.column, l.to.column].includes('Private'))).toBe(false)
  })

  it('recognises customer_id -> customers.id by name, plural file names included', () => {
    const customers = dataset(
      'cust',
      'customers.csv',
      ['id', 'name'],
      [
        ['1', 'Ada'],
        ['2', 'Grace'],
        ['3', 'Alan'],
      ],
    )
    const orders = dataset(
      'ord',
      'orders.csv',
      ['order_no', 'customer_id', 'total'],
      [
        ['100', '1', '9.50'],
        ['101', '1', '12.00'],
        ['102', '3', '4.25'],
      ],
    )
    const found = links([orders, customers])
    const link = found.find((l) => l.from.column === 'customer_id')!
    expect(summary(link)).toBe('ord.customer_id -> cust.id (many-to-one, strong)')
    expect(link.namesMatch).toBe(true)
    // order_no (100-102) shares no values with id (1-3), so it is not linked.
    expect(found.some((l) => l.from.column === 'order_no' || l.to.column === 'order_no')).toBe(
      false,
    )
  })

  it('finds value links even when the names differ', () => {
    const a = dataset('a', 'visits.csv', ['site'], [['S-01'], ['S-02'], ['S-03'], ['S-01']])
    const b = dataset(
      'b',
      'sites.csv',
      ['code', 'label'],
      [
        ['S-01', 'North'],
        ['S-02', 'South'],
        ['S-03', 'East'],
        ['S-04', 'West'],
      ],
    )
    expect(links([a, b]).map(summary)).toEqual(['a.site -> b.code (many-to-one, strong)'])
  })

  it('does not link columns without enough shared values', () => {
    const a = dataset('a', 'a.csv', ['code'], [['X1'], ['X2'], ['X3'], ['Z9']])
    const b = dataset('b', 'b.csv', ['ref'], [['X1'], ['Q1'], ['Q2'], ['Q3'], ['Q4']])
    expect(links([a, b])).toEqual([])
  })

  it('compares numbers by value and text without case or padding', () => {
    expect(normaliseValue('1,000')).toBe(normaliseValue('1000'))
    expect(normaliseValue(' L-IHL ')).toBe(normaliseValue('l-ihl'))
    expect(normaliseValue('02134')).not.toBe(normaliseValue('2134'))
    expect(normaliseValue('')).toBeNull()
    expect(normaliseValue('NA')).toBeNull()
  })

  it('never links quantities or categories, however many values they share', () => {
    const stock = dataset(
      'stock',
      'stock.csv',
      ['Copies', 'Shelf', 'Genre'],
      [
        ['53', 'Top', 'Librarians'],
        ['4', 'Middle', 'Library Assistants'],
        ['16', 'Bottom', 'Library Technicians'],
        ['61', 'Top', 'Librarians'],
      ],
    )
    // Copies shares 53, 4, 16 and 61 with Number of Staff, and Genre shares Staff Type's values.
    expect(links([staff, stock])).toEqual([])
  })

  it('links a key to every dataset that uses it', () => {
    // One ID column whose values appear in four other datasets.
    const hub = dataset('hub', 'hub.csv', ['ref'], [['K1'], ['K2'], ['K3']])
    const others = ['p', 'q', 'r', 's'].map((k) =>
      dataset(k, `${k}.csv`, ['ref'], [['K1'], ['K2'], ['K3']]),
    )
    const touchingHub = links([hub, ...others]).filter(
      (l) => l.from.dataset === 'hub' || l.to.dataset === 'hub',
    )
    expect(touchingHub.map((l) => (l.from.dataset === 'hub' ? l.to : l.from).dataset).sort()).toEqual(
      ['p', 'q', 'r', 's'],
    )
  })

  it('keeps only the best link from a column to each other dataset', () => {
    const items = dataset('items', 'items.csv', ['ID', 'Parent ID'], [
      ['K1', 'K2'],
      ['K2', 'K3'],
      ['K3', 'K1'],
    ])
    const notes = dataset('notes', 'notes.csv', ['ID'], [['K1'], ['K2'], ['K3']])
    // notes.ID matches both columns of items; the same-named one wins.
    expect(links([items, notes]).map(summary)).toEqual([
      'items.ID -> notes.ID (one-to-one, strong)',
    ])
  })

  it('links identical copies of a dataset the same way', () => {
    const cells = libraries.rows.map((r) => libraries.columns.map((c) => String(r[c])))
    const copy = dataset('libs2', 'Libraries 2024.csv', [...libraries.columns], cells)
    const found = links([staff, libraries, copy]).map(summary)
    expect(found).toContain('staff.Library ID -> libs.LibraryID (many-to-one, strong)')
    expect(found).toContain('staff.Library ID -> libs2.LibraryID (many-to-one, strong)')
  })
})

describe('detectRelationships: similar structure', () => {
  it('spots datasets that share most of their columns', () => {
    const jan = dataset(
      'jan',
      'sales-jan.csv',
      ['Date', 'Store', 'Amount'],
      [['2024-01-01', 'A', '5']],
    )
    const feb = dataset(
      'feb',
      'sales-feb.csv',
      ['date', 'store', 'amount'],
      [['2024-02-01', 'B', '7']],
    )
    const similar = detectRelationships([jan, feb]).filter((c) => c.kind === 'similar-structure')
    expect(similar).toEqual([
      {
        kind: 'similar-structure',
        id: 'jan~feb',
        datasets: ['jan', 'feb'],
        sharedColumns: ['Amount', 'Date', 'Store'],
        similarity: 1,
      },
    ])
  })

  it('does not also link the same-named columns of parallel copies', () => {
    const jan = dataset(
      'jan',
      'orders-jan.csv',
      ['order_no', 'customer_id'],
      [
        ['1', 'C-1'],
        ['2', 'C-2'],
        ['3', 'C-3'],
      ],
    )
    const feb = dataset(
      'feb',
      'orders-feb.csv',
      ['order_no', 'customer_id'],
      [
        ['4', 'C-2'],
        ['5', 'C-3'],
        ['6', 'C-1'],
      ],
    )
    const kinds = detectRelationships([jan, feb]).map((c) => c.kind)
    expect(kinds).toEqual(['similar-structure'])
  })

  it('does not call unrelated layouts similar', () => {
    const found = detectRelationships([staff, libraries]).filter(
      (c) => c.kind === 'similar-structure',
    )
    expect(found).toEqual([])
  })
})

describe('detectRelationships: general behaviour', () => {
  it('is deterministic and independent of dataset order for the links it finds', () => {
    const first = detectRelationships([staff, libraries])
    expect(detectRelationships([staff, libraries])).toEqual(first)
    const reversed = detectRelationships([libraries, staff])
      .map((c) => c.id)
      .sort()
    expect(reversed).toEqual(first.map((c) => c.id).sort())
  })

  it('handles zero, one, and empty datasets', () => {
    expect(detectRelationships([])).toEqual([])
    expect(detectRelationships([staff])).toEqual([])
    const empty = dataset('e', 'empty.csv', ['Library ID'], [])
    expect(detectRelationships([staff, empty])).toEqual([])
  })

  it('never modifies the datasets', () => {
    const before = JSON.stringify([staff.rows, libraries.rows])
    detectRelationships([staff, libraries])
    expect(JSON.stringify([staff.rows, libraries.rows])).toBe(before)
  })
})
