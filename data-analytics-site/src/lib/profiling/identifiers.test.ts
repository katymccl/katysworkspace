import { describe, expect, it } from 'vitest'
import {
  headerWords,
  idEntity,
  isIdHeader,
  isNameHeader,
  isKeyColumn,
  looksLikeIdValue,
  looksLikeProse,
  looksLikeSequence,
} from './identifiers'
import { profileDataset } from './profile'
import type { ProfileInput } from './types'

describe('headerWords', () => {
  it.each([
    ['Library ID', ['library', 'id']],
    ['shop_id', ['shop', 'id']],
    ['customerId', ['customer', 'id']],
    ['LibraryID', ['library', 'id']],
    ['IDNumber', ['id', 'number']],
    ['user-id2', ['user', 'id', '2']],
    ['  Number of Staff ', ['number', 'of', 'staff']],
  ])('splits %j', (header, words) => {
    expect(headerWords(header)).toEqual(words)
  })
})

describe('isIdHeader', () => {
  it.each([
    'ID',
    'id',
    'Library ID',
    'shop_id',
    'customerId',
    'LibraryID',
    'UUID',
    'record guid',
    'Identifier',
  ])('recognises %j', (header) => {
    expect(isIdHeader(header)).toBe(true)
  })

  it.each(['Valid', 'Paid', 'Width', 'Idea', 'Video', 'Android', 'Number of Staff', 'Private'])(
    'ignores %j, where "id" is only part of a word',
    (header) => {
      expect(isIdHeader(header)).toBe(false)
    },
  )
})

describe('isNameHeader', () => {
  it.each(['Name', 'Library Name', 'first_name', 'lastName', 'username', 'Surname'])(
    'recognises %j',
    (header) => {
      expect(isNameHeader(header)).toBe(true)
    },
  )

  it.each(['Library', 'Names count?', 'Staff Type', 'Namespace'])('ignores %j', (header) => {
    // "Names count?" splits to [names, count]: plural "names" is a count, not a name column.
    expect(isNameHeader(header)).toBe(false)
  })
})

describe('idEntity', () => {
  it.each([
    ['Library ID', 'library'],
    ['customerId', 'customer'],
    ['order_item_id', 'order item'],
    ['ID', null],
    ['Library', null],
  ])('%j identifies %j', (header, entity) => {
    expect(idEntity(header)).toBe(entity)
  })
})

describe('looksLikeIdValue', () => {
  it.each([
    'L-IHL',
    'SKU123',
    'a1b2',
    'S1',
    'ORD_2024_001',
    '550e8400-e29b-41d4-a716-446655440000',
  ])('treats %j as a code', (v) => {
    expect(looksLikeIdValue(v)).toBe(true)
  })

  it.each([
    'London',
    'Idle Hour Library',
    'Librarians',
    'SHIPPED',
    'US',
    '02134',
    '42',
    'A',
    'yes',
    'two words-1',
    'a@b.com',
  ])('does not treat %j as a code', (v) => {
    expect(looksLikeIdValue(v)).toBe(false)
  })
})

describe('primary keys in a profile', () => {
  const reasonsOf = (input: ProfileInput) =>
    Object.fromEntries(
      profileDataset(input).columns.map((c) => [c.name, c.identifierReasons.map((r) => r.kind)]),
    )
  const rowsOf = (columns: string[], cells: string[][]) =>
    cells.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])))

  it('stars nothing in a long-format file where the ID and name repeat', () => {
    // Mirrors BookshopLibraries.csv: one row per library per staff type.
    const columns = ['Staff Type', 'Number of Staff', 'Library', 'Library ID']
    const rows = rowsOf(columns, [
      ['Librarians', '53', 'Idle Hour Library', 'L-IHL'],
      ['Librarians', '4', "The Bibliophile's Shelves", 'L-BS'],
      ['Library Assistants', '16', 'Idle Hour Library', 'L-IHL'],
      ['Library Technicians', '61', 'Idle Hour Library', 'L-IHL'],
    ])
    const profile = profileDataset({ columns, rows })
    expect(profile.columns.some((c) => c.isPotentialIdentifier)).toBe(false)
    expect(profile.columns.filter(isKeyColumn).map((c) => c.name)).toEqual(['Library ID'])
  })

  it('stars a unique ID and the name beside it, even in a short file', () => {
    const columns = ['Library ID', 'Library', 'City']
    const rows = rowsOf(columns, [
      ['L-IHL', 'Idle Hour Library', 'Leeds'],
      ['L-BS', "The Bibliophile's Shelves", 'York'],
      ['L-BA', 'Bide Awhile', 'Hull'],
    ])
    expect(reasonsOf({ columns, rows })).toEqual({
      'Library ID': ['id-header', 'id-like-values', 'unique-values'],
      Library: ['entity-name', 'unique-values'],
      City: [],
    })
    expect(profileDataset({ columns, rows }).columns[1].identifierReasons[0]).toEqual({
      kind: 'entity-name',
      idColumn: 'Library ID',
    })
  })

  it('does not star ID or name headers whose values repeat, but treats the ID as a key', () => {
    const columns = ['customerId', 'Customer Name', 'amount']
    const rows = rowsOf(columns, [
      ['7', 'Ada', '5'],
      ['7', 'Ada', '5'],
      ['8', 'Grace', '6'],
    ])
    const profile = profileDataset({ columns, rows })
    expect(reasonsOf({ columns, rows })).toEqual({ customerId: [], 'Customer Name': [], amount: [] })
    expect(profile.columns.map(isKeyColumn)).toEqual([true, false, false])
  })

  it('stars a unique name column', () => {
    const columns = ['first_name']
    const rows = rowsOf(columns, [['Ada'], ['Grace'], ['Alan']])
    expect(reasonsOf({ columns, rows }).first_name).toEqual(['name-header', 'unique-values'])
  })

  it('needs every row to have a value', () => {
    const columns = ['id']
    expect(reasonsOf({ columns, rows: rowsOf(columns, [['a1'], [''], ['a2']]) }).id).toEqual([])
  })

  it('does not star codes that repeat', () => {
    const columns = ['status']
    const rows = rowsOf(columns, [['A-1'], ['B-2'], ['A-1'], ['C-3']])
    expect(reasonsOf({ columns, rows }).status).toEqual([])
  })

  it('never stars an empty column, whatever its header', () => {
    const columns = ['id', 'name', 'Library', 'Library ID']
    const rows = [{ id: '', name: '', Library: '', 'Library ID': '' }]
    expect(profileDataset({ columns, rows }).columns.some((c) => c.isPotentialIdentifier)).toBe(
      false,
    )
  })
})

describe('primary keys from uniqueness alone', () => {
  const kinds = (input: ProfileInput, name: string) =>
    profileDataset(input)
      .columns.find((c) => c.name === name)!
      .identifierReasons.map((r) => r.kind)
  const single = (name: string, values: string[]): ProfileInput => ({
    columns: [name],
    rows: values.map((v) => ({ [name]: v })),
  })
  const range = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1))

  it('trusts unique whole numbers and text only with enough values', () => {
    expect(kinds(single('n', range(20)), 'n')).toEqual(['sequential-values', 'unique-values'])
    expect(kinds(single('n', range(19)), 'n')).toEqual([])
    const cities = range(20).map((v) => `City ${v}`)
    expect(kinds(single('city', cities), 'city')).toEqual(['unique-values'])
    expect(kinds(single('city', cities.slice(0, 19)), 'city')).toEqual([])
  })

  it('does not star unique whole numbers that do not count up', () => {
    // Amounts that happen not to repeat: out of order and spread out.
    const amounts = range(25).map((v) => String((Number(v) * 389) % 997))
    expect(kinds(single('amount', amounts), 'amount')).toEqual([])
  })

  it('still stars unique whole numbers with an ID header, in any order', () => {
    const ids = range(5).map((v) => String((Number(v) * 389) % 997))
    expect(kinds(single('Customer ID', ids), 'Customer ID')).toEqual(['id-header', 'unique-values'])
  })

  it('does not star a column that is almost unique', () => {
    expect(kinds(single('ref', [...range(19), '1']), 'ref')).toEqual([])
  })

  it('does not star free text that happens to be unique', () => {
    const comments = range(25).map((v) => `Order ${v} arrived a little late`)
    expect(kinds(single('comment', comments), 'comment')).toEqual([])
  })

  it('ignores decimals however unique they are', () => {
    const prices = range(30).map((v) => `${v}.99`)
    expect(kinds(single('price', prices), 'price')).toEqual([])
  })
})

describe('looksLikeProse', () => {
  it.each([
    ['Arrived late but the box was fine', true],
    ['Ada Lovelace', false],
    ["The Bibliophile's Shelves", false],
  ])('%j → %j', (text, prose) => {
    expect(looksLikeProse(text)).toBe(prose)
  })
})

describe('looksLikeSequence', () => {
  it.each([
    [[1001, 1002, 1003, 1004], true],
    [[1, 2, 4, 5, 7, 8], true],
    [[1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11], true],
    [[5, 3, 9, 1, 7], false],
    [[10, 200, 3000, 40000], false],
    [[7], false],
  ])('%j → %j', (numbers, sequence) => {
    expect(looksLikeSequence(numbers)).toBe(sequence)
  })
})

describe('isKeyColumn', () => {
  it('drops a starred column the user said is not an identifier', () => {
    const rows = [{ 'Order ID': '1' }, { 'Order ID': '2' }]
    const column = profileDataset({ columns: ['Order ID'], rows }).columns[0]
    expect(isKeyColumn(column)).toBe(true)
    expect(isKeyColumn({ ...column, isPotentialIdentifier: false, identifierDismissed: true })).toBe(
      false,
    )
  })
})

describe('identifiers across unrelated datasets', () => {
  /** Column name → identifier reason kinds, for a quick whole-dataset picture. */
  const starred = (input: ProfileInput) =>
    Object.fromEntries(
      profileDataset(input)
        .columns.filter((c) => c.isPotentialIdentifier)
        .map((c) => [c.name, c.identifierReasons.map((r) => r.kind)]),
    )
  const table = (columns: string[], n: number, row: (i: number) => string[]): ProfileInput => ({
    columns,
    rows: Array.from({ length: n }, (_, i) =>
      Object.fromEntries(row(i).map((v, c) => [columns[c], v])),
    ),
  })

  it('e-commerce orders: the order number, not repeated customers, products or statuses', () => {
    const customers = [
      'Ada Lovelace',
      'Grace Hopper',
      'Alan Turing',
      'Edsger Dijkstra',
      'Barbara Liskov',
    ]
    const statuses = ['PENDING', 'SHIPPED', 'DELIVERED']
    const input = table(
      ['OrderNumber', 'customer_name', 'Product SKU', 'qty', 'unit_price', 'status', 'ordered_at'],
      30,
      (i) => [
        String(5000 + i),
        customers[i % 5],
        `SKU-${100 + (i % 6)}`,
        String(1 + (i % 4)),
        `${(i % 6) + 9}.99`,
        statuses[i % 3],
        `2024-03-${String((i % 28) + 1).padStart(2, '0')}`,
      ],
    )
    // Customer names and SKUs repeat across orders, so only the order number is this file's key.
    expect(starred(input)).toEqual({ OrderNumber: ['sequential-values', 'unique-values'] })
  })

  it('sensor readings: repeated device codes are not a key', () => {
    const input = table(['device', 'recorded', 'temperature_c', 'ok'], 40, (i) => [
      `dev-${i % 4}`,
      `2024-05-01T${String(i % 24).padStart(2, '0')}:00`,
      (20 + (i % 9) * 0.37).toFixed(2),
      i % 5 ? 'true' : 'false',
    ])
    expect(starred(input)).toEqual({})
  })

  it('a survey with no identifier columns stars nothing', () => {
    const input = table(['age_band', 'rating', 'would_recommend', 'comment'], 25, (i) => [
      ['18-24', '25-34', '35-44'][i % 3],
      String(1 + (i % 5)),
      i % 2 ? 'yes' : 'no',
      ['Great', 'Fine', 'Too slow', 'Loved it'][i % 4],
    ])
    expect(starred(input)).toEqual({})
  })

  it('people records: an email key without any ID-like header', () => {
    const input = table(['email', 'country', 'signup_year'], 25, (i) => [
      `user${i}@example.com`,
      ['US', 'GB', 'FR'][i % 3],
      String(2018 + (i % 6)),
    ])
    expect(starred(input)).toEqual({ email: ['unique-values'] })
  })
})
