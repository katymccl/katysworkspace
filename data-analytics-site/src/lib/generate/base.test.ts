import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import { buildBaseContext, checkLinks, type BaseSource } from './base'
import { GENERATE_LIMITS, GenerateRequestSchema } from './schema'

function source(
  columns: string[],
  cells: string[][],
  definitions: BaseSource['columnDefinitions'] = new Map(),
): BaseSource {
  const rows = cells.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])))
  return {
    name: 'Library Staffing',
    fileName: 'BookshopLibraries.csv',
    description: 'Staff counts per library.',
    rowMeaning: null,
    columns,
    rows,
    profile: profileDataset({ columns, rows }),
    columnDefinitions: definitions,
  }
}

const staff = source(
  ['Staff Type', 'Number of Staff', 'Library', 'Library ID', 'Private'],
  [
    ['Librarians', '53', 'Idle Hour Library YYY', 'L-IHL', 'No'],
    ['Librarians', '4', "The Bibliophile's Shelves", 'L-BS', 'Yes'],
    ['Librarians', '9', 'Bide Awhile', 'L-BA', 'No'],
    ['Library Assistants', '16', 'Idle Hour Library', 'L-IHL', 'No'],
    ['Library Assistants', '6', 'Bide Awhile', 'L-BA', 'No'],
    ['Library Technicians', '61', 'Idle Hour Library', 'L-IHL', 'No'],
    ['Library Technicians', '2', 'Old Friend Library', 'L-OFL', 'No'],
  ],
  new Map([['Staff Type', { description: 'Kind of staff', role: 'category' as const }]]),
)

describe('buildBaseContext', () => {
  const context = buildBaseContext(staff)

  it('makes a context the server accepts', () => {
    expect(
      GenerateRequestSchema.safeParse({ description: '', columns: [], base: context }).success,
    ).toBe(true)
  })

  it('sends which ID and name values belong together, as written', () => {
    expect(context.keys.columns).toEqual(['Library', 'Library ID'])
    expect(context.keys.rows).toEqual([
      ['Idle Hour Library YYY', 'L-IHL'],
      ["The Bibliophile's Shelves", 'L-BS'],
      ['Bide Awhile', 'L-BA'],
      ['Idle Hour Library', 'L-IHL'],
      ['Old Friend Library', 'L-OFL'],
    ])
  })

  it('leaves measures, categories and yes/no columns out of the keys', () => {
    for (const column of ['Number of Staff', 'Staff Type', 'Private']) {
      expect(context.keys.columns).not.toContain(column)
    }
  })

  it('sends only a few sample rows, plus definitions where known', () => {
    expect(context.sampleRows).toHaveLength(GENERATE_LIMITS.baseSampleRows)
    expect(context.sampleRows[0]).toEqual([
      'Librarians',
      '53',
      'Idle Hour Library YYY',
      'L-IHL',
      'No',
    ])
    expect(context.columns.find((c) => c.name === 'Staff Type')).toMatchObject({
      role: 'category',
      description: 'Kind of staff',
    })
    expect(context).toMatchObject({ description: 'Staff counts per library.', rowCount: 7 })
    expect(context).not.toHaveProperty('rowMeaning')
  })

  it('caps the number and length of values', () => {
    const many = source(
      ['code'],
      Array.from({ length: 300 }, (_, i) => [`C-${i}-${'x'.repeat(150)}`]),
    )
    const { keys } = buildBaseContext(many)
    expect(keys.rows).toHaveLength(GENERATE_LIMITS.baseKeyRows)
    expect(keys.rows[0][0]).toHaveLength(GENERATE_LIMITS.baseValueLength)
  })
})

describe('checkLinks', () => {
  it('counts how many of the new values really appear in the base column', () => {
    const generated = {
      columns: ['library_id', 'city'],
      rows: [
        ['L-IHL', 'Leeds'],
        ['l-bs', 'York'],
        ['L-BA', 'Bath'],
        ['L-XYZ', 'Hull'],
        ['L-IHL', 'Leeds'],
      ],
      links: [{ column: 'library_id', baseColumn: 'Library ID' }],
    }
    expect(checkLinks(generated, staff)).toEqual([
      { column: 'library_id', baseColumn: 'Library ID', matched: 3, total: 4 },
    ])
  })

  it('returns nothing when no links were claimed', () => {
    expect(checkLinks({ columns: ['a'], rows: [['1']], links: [] }, staff)).toEqual([])
  })
})
