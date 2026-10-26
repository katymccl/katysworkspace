import { describe, expect, it } from 'vitest'
import {
  headerWords,
  idEntity,
  isIdHeader,
  isNameHeader,
  looksLikeIdValue,
  pairConsistency,
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

describe('potential identifiers in a profile', () => {
  const reasonsOf = (input: ProfileInput) =>
    Object.fromEntries(
      profileDataset(input).columns.map((c) => [c.name, c.identifierReasons.map((r) => r.kind)]),
    )

  it('finds the ID and name columns in a long-format file where neither is unique', () => {
    // Mirrors BookshopLibraries.csv: one row per library per staff type.
    const columns = [
      'Staff Type',
      'Number of Staff',
      'Library',
      'Library ID',
      'Consortium Member',
      'Private',
    ]
    const rows = [
      ['Librarians', '53', 'Idle Hour Library', 'L-IHL', 'Yes', 'No'],
      ['Librarians', '4', "The Bibliophile's Shelves", 'L-BS', 'Yes', 'Yes'],
      ['Library Assistants', '16', 'Idle Hour Library', 'L-IHL', 'Yes', 'No'],
      ['Library Assistants', '6', 'Bide Awhile', 'L-BA', 'Yes', 'No'],
      ['Library Technicians', '61', 'Idle Hour Library', 'L-IHL', 'Yes', 'No'],
    ].map((cells) => Object.fromEntries(columns.map((c, i) => [c, cells[i]])))

    expect(reasonsOf({ columns, rows })).toEqual({
      'Staff Type': [],
      'Number of Staff': [],
      Library: ['entity-name', 'paired-values'],
      'Library ID': ['id-header', 'id-like-values', 'paired-values'],
      'Consortium Member': [],
      Private: [],
    })
    const library = profileDataset({ columns, rows }).columns[2]
    expect(library.identifierReasons).toEqual([
      { kind: 'entity-name', idColumn: 'Library ID' },
      { kind: 'paired-values', withColumn: 'Library ID' },
    ])
  })

  it('flags ID and name headers even when values repeat or are numeric', () => {
    const columns = ['customerId', 'Customer Name', 'amount']
    const rows = [
      { customerId: '7', 'Customer Name': 'Ada', amount: '5' },
      { customerId: '7', 'Customer Name': 'Ada', amount: '5' },
    ]
    expect(reasonsOf({ columns, rows })).toEqual({
      customerId: ['id-header'],
      'Customer Name': ['name-header'],
      amount: [],
    })
  })

  it('matches entity names across header styles', () => {
    const columns = ['CustomerID', 'customer', 'product']
    const rows = [
      { CustomerID: '1', customer: 'Ada', product: 'Pen' },
      { CustomerID: '1', customer: 'Ada', product: 'Pen' },
    ]
    expect(reasonsOf({ columns, rows })).toMatchObject({ customer: ['entity-name'], product: [] })
  })

  it('never flags an empty column, whatever its header', () => {
    const columns = ['id', 'name', 'Library', 'Library ID']
    const rows = [{ id: '', name: '', Library: '', 'Library ID': '' }]
    expect(profileDataset({ columns, rows }).columns.some((c) => c.isPotentialIdentifier)).toBe(
      false,
    )
  })

  it('needs at least two distinct codes before trusting code-like values', () => {
    const columns = ['status']
    const rows = [{ status: 'N/A-1' }, { status: 'N/A-1' }]
    expect(reasonsOf({ columns, rows }).status).toEqual([])
  })
})

describe('identifiers from uniqueness', () => {
  const kinds = (input: ProfileInput, name: string) =>
    profileDataset(input)
      .columns.find((c) => c.name === name)!
      .identifierReasons.map((r) => r.kind)
  const single = (name: string, values: string[]): ProfileInput => ({
    columns: [name],
    rows: values.map((v) => ({ [name]: v })),
  })
  const range = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1))

  it('trusts unique whole numbers only with enough values', () => {
    expect(kinds(single('n', range(20)), 'n')).toEqual(['unique-values'])
    expect(kinds(single('n', range(19)), 'n')).toEqual([])
  })

  it('flags mostly-unique columns and counts the repeated values', () => {
    const values = [...range(18), '1', '2'] // 20 values, 18 distinct: 90%
    const column = profileDataset(single('ref', values)).columns[0]
    expect(column.identifierReasons).toEqual([{ kind: 'mostly-unique', repeatedValueCount: 2 }])
  })

  it('does not flag columns below 90% unique or with too few values', () => {
    expect(kinds(single('ref', [...range(17), '1', '2', '3']), 'ref')).toEqual([]) // 85%
    expect(kinds(single('ref', [...range(9), '1']), 'ref')).toEqual([]) // only 10 values
  })

  it('ignores decimals however unique they are', () => {
    const prices = range(30).map((v) => `${v}.99`)
    expect(kinds(single('price', prices), 'price')).toEqual([])
  })
})

describe('identifiers from repeated values', () => {
  const regions: [string, string][] = [
    ['WST', 'West'],
    ['EST', 'East'],
    ['NTH', 'North'],
    ['STH', 'South'],
  ]
  const sizes = ['small', 'large', 'medium']

  /** 24 rows where code and name always travel together and size varies independently. */
  function input(overrides: Record<number, Record<string, string>> = {}): ProfileInput {
    const rows = Array.from({ length: 24 }, (_, i) => ({
      code: regions[i % 4][0],
      region: regions[i % 4][1],
      size: sizes[i % 3],
      ...overrides[i],
    }))
    return { columns: ['code', 'region', 'size'], rows }
  }
  const reasons = (data: ProfileInput) =>
    profileDataset(data).columns.map((c) => c.identifierReasons)

  it('pairs columns that repeat in step, naming the partner', () => {
    const [code, region, size] = reasons(input())
    expect(code).toContainEqual({ kind: 'paired-values', withColumn: 'region' })
    expect(region).toContainEqual({ kind: 'paired-values', withColumn: 'code' })
    expect(size).toEqual([])
  })

  it('tolerates an occasional typo', () => {
    const [, region] = reasons(input({ 0: { region: 'West YYY' } }))
    expect(region).toContainEqual({ kind: 'paired-values', withColumn: 'code' })
  })

  it('stops pairing when the columns disagree too often', () => {
    const typos = { 0: { region: 'x1' }, 1: { region: 'x2' }, 2: { region: 'x3' } }
    expect(reasons(input(typos))[1]).not.toContainEqual(
      expect.objectContaining({ kind: 'paired-values' }),
    )
  })

  it('never pairs columns that barely repeat', () => {
    // A unique column agrees with anything, so it must not count as moving in step.
    const columns = ['id', 'region']
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, region: regions[i % 4][1] }))
    const [id] = reasons({ columns, rows })
    expect(id).not.toContainEqual(expect.objectContaining({ kind: 'paired-values' }))
  })
})

describe('pairConsistency', () => {
  const codes = (...values: number[]) => Int32Array.from(values)

  it('is 1 for columns that always move together', () => {
    expect(pairConsistency(codes(0, 1, 0, 1, 2, 2), codes(5, 6, 5, 6, 7, 7))).toBe(1)
  })

  it('takes the weaker direction', () => {
    // a → b is perfect, but b value 5 belongs to two different a values.
    expect(pairConsistency(codes(0, 0, 1, 1, 2, 2), codes(5, 5, 5, 5, 6, 6))).toBeCloseTo(4 / 6)
  })

  it('skips rows where either side is missing', () => {
    expect(pairConsistency(codes(0, 0, -1, 1, 1, 2, 2), codes(5, 5, 9, 6, 6, 7, 7))).toBe(1)
  })

  it('is 0 when one side does not repeat', () => {
    expect(pairConsistency(codes(0, 1, 2, 3), codes(5, 5, 6, 6))).toBe(0)
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

  it('e-commerce orders: order, customer and product keys, not measures or statuses', () => {
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
    expect(starred(input)).toEqual({
      OrderNumber: ['unique-values'],
      customer_name: ['name-header'],
      'Product SKU': ['id-like-values'],
    })
  })

  it('sensor readings: device codes, not timestamps or readings', () => {
    const input = table(['device', 'recorded', 'temperature_c', 'ok'], 40, (i) => [
      `dev-${i % 4}`,
      `2024-05-01T${String(i % 24).padStart(2, '0')}:00`,
      (20 + (i % 9) * 0.37).toFixed(2),
      i % 5 ? 'true' : 'false',
    ])
    expect(starred(input)).toEqual({ device: ['id-like-values'] })
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
