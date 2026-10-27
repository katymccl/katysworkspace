import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { toCsvText } from './client'
import {
  GENERATE_LIMITS,
  GenerateRequestSchema,
  reconcileGenerated,
  safeFileName,
  type BaseContext,
  type GenerateRequest,
  type GeneratedDataset,
} from './schema'
import { maxRowsFor, parseColumnSpec } from './spec'

describe('parseColumnSpec', () => {
  it('reads one column per line, with optional hints after the first colon', () => {
    const { columns, errors } = parseColumnSpec(
      'order_id\n\n  quantity: 1 to 5 \nstart_time: HH:MM, 24-hour\r\nnotes',
    )
    expect(errors).toEqual([])
    expect(columns).toEqual([
      { name: 'order_id' },
      { name: 'quantity', hint: '1 to 5' },
      { name: 'start_time', hint: 'HH:MM, 24-hour' },
      { name: 'notes' },
    ])
  })

  it('reports duplicates, missing names and too many columns', () => {
    expect(parseColumnSpec('price\nPrice').errors).toEqual(['"Price" is listed more than once.'])
    expect(parseColumnSpec(': just a hint').errors).toEqual([
      '": just a hint" has a hint but no column name.',
    ])
    const many = Array.from({ length: GENERATE_LIMITS.maxColumns + 1 }, (_, i) => `c${i}`).join(
      '\n',
    )
    expect(parseColumnSpec(many).errors[0]).toMatch(/at most 25 columns/)
  })

  it('returns nothing for blank input', () => {
    expect(parseColumnSpec('  \n\n')).toEqual({ columns: [], errors: [] })
  })
})

describe('maxRowsFor', () => {
  it('keeps rows × columns within the cell limit', () => {
    expect(maxRowsFor(1)).toBe(GENERATE_LIMITS.maxRows)
    expect(maxRowsFor(10)).toBe(100)
    expect(maxRowsFor(25)).toBe(40)
    expect(maxRowsFor(0)).toBe(GENERATE_LIMITS.maxRows)
  })
})

describe('GenerateRequestSchema', () => {
  const valid: GenerateRequest = {
    description: 'Books',
    columns: [{ name: 'title' }],
    rowCount: 10,
  }

  it('accepts a normal request', () => {
    expect(GenerateRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('lets columns and rows be left to Claude only when there is a base', () => {
    const base: BaseContext = {
      name: 'Staff',
      fileName: 'staff.csv',
      rowCount: 3,
      columns: [],
      sampleRows: [],
      keys: { columns: [], rows: [] },
    }
    expect(GenerateRequestSchema.safeParse({ description: 'x', columns: [], base }).success).toBe(
      true,
    )
    expect(
      GenerateRequestSchema.safeParse({ description: 'x', columns: [], rowCount: 5 }).success,
    ).toBe(false)
    expect(
      GenerateRequestSchema.safeParse({ description: 'x', columns: [{ name: 'a' }] }).success,
    ).toBe(false)
  })

  it('limits what can be sent about a base', () => {
    const base = {
      name: 'Staff',
      fileName: 'staff.csv',
      rowCount: 3,
      columns: [],
      sampleRows: Array(GENERATE_LIMITS.baseSampleRows + 1).fill(['x']),
      keys: { columns: [], rows: [] },
    }
    expect(GenerateRequestSchema.safeParse({ description: '', columns: [], base }).success).toBe(
      false,
    )
    const extra = { ...base, sampleRows: [], allRows: [['x']] }
    expect(
      GenerateRequestSchema.safeParse({ description: '', columns: [], base: extra }).success,
    ).toBe(false)
  })

  it('rejects oversized, duplicate or unexpected input', () => {
    const tooManyCells = {
      ...valid,
      rowCount: 100,
      columns: Array.from({ length: 11 }, (_, i) => ({ name: `c${i}` })),
    }
    expect(GenerateRequestSchema.safeParse(tooManyCells).success).toBe(false)
    const duplicate = { ...valid, columns: [{ name: 'a' }, { name: ' A ' }] }
    expect(GenerateRequestSchema.safeParse(duplicate).success).toBe(false)
    expect(GenerateRequestSchema.safeParse({ ...valid, system: 'x' }).success).toBe(false)
    expect(GenerateRequestSchema.safeParse({ ...valid, rowCount: 0 }).success).toBe(false)
    expect(GenerateRequestSchema.safeParse({ ...valid, columns: [] }).success).toBe(false)
  })
})

describe('reconcileGenerated', () => {
  const request: GenerateRequest = {
    description: '',
    columns: [{ name: 'a' }, { name: 'b' }],
    rowCount: 2,
  }

  const raw = (overrides: Partial<GeneratedDataset>): GeneratedDataset => ({
    fileName: 'x.csv',
    columns: ['a', 'b'],
    rows: [],
    links: [],
    notes: '',
    ...overrides,
  })

  it('keeps only complete rows, up to the requested count, and caps cell length', () => {
    const result = reconcileGenerated(
      raw({
        rows: [['1', '2'], ['short'], ['3', 'x'.repeat(500)], ['5', '6']],
        notes: ' Prices in GBP. ',
      }),
      request,
    )
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', 'x'.repeat(GENERATE_LIMITS.maxCellLength)],
    ])
    expect(result.notes).toBe('Prices in GBP.')
  })

  it('always uses the requested column names when columns were listed', () => {
    const result = reconcileGenerated(
      raw({ columns: ['renamed', 'b'], rows: [['1', '2']] }),
      request,
    )
    expect(result.columns).toEqual(['a', 'b'])
  })

  describe('with a base dataset', () => {
    const base: BaseContext = {
      name: 'Staff',
      fileName: 'staff.csv',
      rowCount: 3,
      columns: [{ name: 'Library ID', type: 'string' }],
      sampleRows: [],
      keys: { columns: [], rows: [] },
    }
    const auto: GenerateRequest = { description: 'Libraries', columns: [], base }

    it("uses Claude's columns when none were listed, and the cell limit for rows", () => {
      const result = reconcileGenerated(
        raw({
          columns: [' library_id ', 'city'],
          rows: Array.from({ length: 600 }, (_, i) => [`L-${i}`, 'Leeds']),
        }),
        auto,
      )
      expect(result.columns).toEqual(['library_id', 'city'])
      expect(result.rows).toHaveLength(GENERATE_LIMITS.maxRows)
    })

    it('produces no rows when the chosen columns are unusable', () => {
      for (const columns of [[], ['a', 'A'], ['a', ' ']]) {
        expect(reconcileGenerated(raw({ columns, rows: [['1', '2']] }), auto).rows).toEqual([])
      }
    })

    it('keeps links only between real new and base columns, once each', () => {
      const result = reconcileGenerated(
        raw({
          columns: ['library_id', 'city'],
          rows: [['L-1', 'Leeds']],
          links: [
            { column: 'library_id', baseColumn: 'Library ID' },
            { column: 'library_id', baseColumn: 'Library ID' },
            { column: 'ghost', baseColumn: 'Library ID' },
            { column: 'city', baseColumn: 'Not In Base' },
          ],
        }),
        auto,
      )
      expect(result.links).toEqual([{ column: 'library_id', baseColumn: 'Library ID' }])
    })
  })
})

describe('safeFileName', () => {
  it.each([
    ['bookshop-orders.csv', 'bookshop-orders.csv'],
    ['My Orders!.CSV', 'my-orders.csv'],
    ['../../etc/passwd', 'etc-passwd.csv'],
    ['', 'sample-data.csv'],
    ['***', 'sample-data.csv'],
  ])('%j → %j', (input, expected) => {
    expect(safeFileName(input)).toBe(expected)
  })
})

describe('toCsvText', () => {
  const columns = ['name', 'note', 'amount']
  const rows = [
    ['Ada, Countess', 'said "hi"', '-5'],
    ['Grace', 'line one\nline two', '=SUM(A1)'],
  ]

  it('round-trips awkward values exactly', () => {
    const parsed = Papa.parse<string[]>(toCsvText(columns, rows).trim())
    expect(parsed.data).toEqual([columns, ...rows])
  })

  it('ends with a line break that a parser does not read into the last value', () => {
    const parsed = Papa.parse<string[]>(toCsvText(['a', 'b'], [['1', 'last']]), {
      skipEmptyLines: 'greedy',
    })
    expect(parsed.data).toEqual([
      ['a', 'b'],
      ['1', 'last'],
    ])
  })

  it('escapes formula-like values for spreadsheets but keeps negative numbers', () => {
    const parsed = Papa.parse<string[]>(toCsvText(columns, rows, { forSpreadsheet: true }).trim())
    expect(parsed.data[1][2]).toBe('-5')
    expect(parsed.data[2][2]).toBe("'=SUM(A1)")
  })
})
