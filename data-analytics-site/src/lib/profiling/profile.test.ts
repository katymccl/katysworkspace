import { describe, expect, it } from 'vitest'
import { EXTRA_FIELDS_KEY, inferType, numericStats, profileDataset } from './profile'
import type { ColumnProfile, ProfileInput, RawRow } from './types'

/** Builds input from a header and string rows, the way a CSV parser would with `header: true`. */
function csv(columns: string[], ...lines: (string | undefined)[][]): ProfileInput {
  const rows = lines.map((cells) => {
    const row: Record<string, string> = {}
    columns.forEach((col, i) => {
      if (cells[i] !== undefined) row[col] = cells[i]
    })
    return row
  })
  return { columns, rows }
}

function column(input: ProfileInput, name: string, options = {}): ColumnProfile {
  const col = profileDataset(input, options).columns.find((c) => c.name === name)
  if (!col) throw new Error(`no column ${name}`)
  return col
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

describe('profileDataset: dataset shape', () => {
  it('counts rows and columns', () => {
    const profile = profileDataset(csv(['a', 'b'], ['1', 'x'], ['2', 'y'], ['3', 'z']))
    expect(profile.rowCount).toBe(3)
    expect(profile.columnCount).toBe(2)
    expect(profile.columns.map((c) => [c.name, c.index])).toEqual([
      ['a', 0],
      ['b', 1],
    ])
  })

  it('handles a header with no rows', () => {
    const profile = profileDataset(csv(['id', 'name']))
    expect(profile).toMatchObject({ rowCount: 0, columnCount: 2, malformedRowCount: 0 })
    expect(profile.columns[0]).toMatchObject({
      inferredType: 'empty',
      dominantKind: null,
      missingCount: 0,
      missingRatio: 0,
      distinctCount: 0,
      uniquenessRatio: 0,
      isUnique: false,
      sampleValues: [],
      numericStats: null,
      topValues: null,
    })
  })

  it('handles no columns at all', () => {
    expect(profileDataset({ columns: [], rows: [] })).toEqual({
      rowCount: 0,
      columnCount: 0,
      malformedRowCount: 0,
      columns: [],
    })
  })

  it('counts malformed rows and still profiles their values', () => {
    const rows: RawRow[] = [
      { a: '1', b: '2' },
      { a: '3' }, // too few fields
      { a: '5', b: '6', [EXTRA_FIELDS_KEY]: ['7'] }, // too many fields
    ]
    const profile = profileDataset({ columns: ['a', 'b'], rows })
    expect(profile.malformedRowCount).toBe(2)
    expect(profile.columns[0].nonMissingCount).toBe(3)
    expect(profile.columns[1].missingCount).toBe(1)
  })
})

describe('profileDataset: type inference', () => {
  const input = csv(
    ['int', 'dec', 'bool', 'date', 'text', 'mixed', 'zip', 'blank'],
    ['1', '1', 'true', '2024-01-01', 'apple', '1', '02134', ''],
    ['2', '2.5', 'False', '2024-02-29', 'pear', 'two', '10001', 'NA'],
    ['-3', '1e3', 'yes', '12/31/2024', 'fig', '3', '94103', ''],
  )
  const profile = profileDataset(input)
  const typeOf = (name: string) => profile.columns.find((c) => c.name === name)?.inferredType

  it('infers a single kind per column', () => {
    expect(typeOf('int')).toBe('integer')
    expect(typeOf('bool')).toBe('boolean')
    expect(typeOf('date')).toBe('date')
    expect(typeOf('text')).toBe('string')
  })

  it('widens integers mixed with decimals to decimal', () => {
    expect(typeOf('dec')).toBe('decimal')
  })

  it('keeps leading-zero codes as strings so they are not summed like numbers', () => {
    expect(typeOf('zip')).toBe('mixed')
    const zip = profile.columns.find((c) => c.name === 'zip')!
    expect(zip.kindCounts).toMatchObject({ string: 1, integer: 2 })
  })

  it('marks incompatible kinds as mixed and reports the dominant kind', () => {
    const mixed = profile.columns.find((c) => c.name === 'mixed')!
    expect(mixed.inferredType).toBe('mixed')
    expect(mixed.dominantKind).toBe('integer')
    expect(mixed.kindCounts).toEqual({ integer: 2, decimal: 0, boolean: 0, date: 0, string: 1 })
    expect(mixed.numericStats).toBeNull()
    expect(mixed.topValues).not.toBeNull()
  })

  it('infers empty when every value is missing', () => {
    expect(typeOf('blank')).toBe('empty')
  })

  it('ignores missing values when inferring', () => {
    expect(column(csv(['n'], ['1'], [''], ['NA'], ['4']), 'n').inferredType).toBe('integer')
  })

  it('inferType follows the documented rules', () => {
    const counts = { integer: 0, decimal: 0, boolean: 0, date: 0, string: 0 }
    expect(inferType(counts)).toBe('empty')
    expect(inferType({ ...counts, integer: 3 })).toBe('integer')
    expect(inferType({ ...counts, integer: 3, decimal: 1 })).toBe('decimal')
    expect(inferType({ ...counts, integer: 3, string: 1 })).toBe('mixed')
    expect(inferType({ ...counts, date: 2, boolean: 2 })).toBe('mixed')
  })

  it('breaks dominant-kind ties in a fixed order', () => {
    const tie = column(csv(['v'], ['x'], ['1']), 'v')
    expect(tie.dominantKind).toBe('integer')
  })
})

describe('profileDataset: missing values', () => {
  it('counts blanks, whitespace, missing tokens and absent fields', () => {
    const rows: RawRow[] = [
      { v: 'a' },
      { v: '' },
      { v: '   ' },
      { v: 'N/A' },
      { v: 'null' },
      {},
      { v: null },
      { v: 'b' },
    ]
    const v = profileDataset({ columns: ['v'], rows }).columns[0]
    expect(v.missingCount).toBe(6)
    expect(v.nonMissingCount).toBe(2)
    expect(v.missingRatio).toBe(6 / 8)
  })

  it('keeps meaningful zero-like values', () => {
    const v = column(csv(['v'], ['0'], ['false'], ['-']), 'v')
    expect(v.missingCount).toBe(0)
  })

  it('accepts custom missing tokens', () => {
    const input = csv(['v'], ['NA'], ['unknown'], ['x'])
    const v = column(input, 'v', { missingTokens: ['', 'unknown'] })
    expect(v.missingCount).toBe(1)
    expect(v.sampleValues).toEqual(['NA', 'x'])
  })
})

describe('profileDataset: distinct values and uniqueness', () => {
  it('flags a unique key column', () => {
    const id = column(csv(['id'], ['a1'], ['a2'], ['a3']), 'id')
    expect(id).toMatchObject({ distinctCount: 3, uniquenessRatio: 1, isUnique: true })
  })

  it('computes the ratio over non-missing values only', () => {
    const v = column(csv(['v'], ['x'], ['y'], ['x'], [''], ['']), 'v')
    expect(v.distinctCount).toBe(2)
    expect(v.uniquenessRatio).toBe(2 / 3)
    expect(v.isUnique).toBe(false)
  })

  it('treats a column of unique values with blanks as unique', () => {
    expect(column(csv(['v'], ['x'], [''], ['y']), 'v').isUnique).toBe(true)
  })

  it('compares raw values exactly', () => {
    const v = column(csv(['v'], ['a'], ['A'], [' a']), 'v')
    expect(v.distinctCount).toBe(3)
  })

  it('flags ID headers and unique, complete string columns as potential identifiers', () => {
    const input = csv(
      ['id', 'code', 'price', 'when', 'flag', 'gappy', 'repeat'],
      ['1', 'A-1', '9.99', '2024-01-01', 'yes', 'x', 'a'],
      ['2', 'A-2', '4.50', '2024-01-02', 'no', '', 'a'],
      ['3', 'A-3', '1.25', '2024-01-03', 'true', 'y', 'b'],
    )
    const flagged = profileDataset(input)
      .columns.filter((c) => c.isPotentialIdentifier)
      .map((c) => c.name)
    // price/when/flag are unique but excluded by type; gappy has a missing value.
    expect(flagged).toEqual(['id', 'code'])
  })

  it('does not flag unique values in a single-row dataset', () => {
    expect(column(csv(['n'], ['1']), 'n').isPotentialIdentifier).toBe(false)
  })

  it('is zero for an all-missing column', () => {
    const v = column(csv(['v'], [''], ['NA']), 'v')
    expect(v).toMatchObject({ distinctCount: 0, uniquenessRatio: 0, isUnique: false })
  })
})

describe('profileDataset: sample and top values', () => {
  it('samples the first distinct raw values in row order', () => {
    const v = column(csv(['v'], [' padded '], ['b'], ['b'], [''], ['c'], ['d']), 'v', {
      sampleSize: 3,
    })
    expect(v.sampleValues).toEqual([' padded ', 'b', 'c'])
  })

  it('orders top values by count, then value', () => {
    const input = csv(['c'], ['red'], ['blue'], ['red'], ['green'], ['blue'], ['red'], ['amber'])
    const c = column(input, 'c', { topValuesLimit: 3 })
    expect(c.topValues).toEqual([
      { value: 'red', count: 3, ratio: 3 / 7 },
      { value: 'blue', count: 2, ratio: 2 / 7 },
      { value: 'amber', count: 1, ratio: 1 / 7 },
    ])
  })

  it('reports top values for boolean columns but not numeric or date ones', () => {
    const input = csv(['b', 'n', 'd'], ['yes', '1', '2024-01-01'], ['no', '2', '2024-01-02'])
    const profile = profileDataset(input)
    expect(profile.columns[0].topValues).toHaveLength(2)
    expect(profile.columns[1].topValues).toBeNull()
    expect(profile.columns[2].topValues).toBeNull()
  })
})

describe('numeric statistics', () => {
  it('computes min, max, mean and median for an odd count', () => {
    const n = column(csv(['n'], ['5'], ['1'], ['3']), 'n')
    expect(n.numericStats).toEqual({ count: 3, min: 1, max: 5, mean: 3, median: 3 })
  })

  it('averages the middle pair for an even count', () => {
    const n = column(csv(['n'], ['10'], ['2'], ['4'], ['8']), 'n')
    expect(n.numericStats).toMatchObject({ median: 6, mean: 6, min: 2, max: 10 })
  })

  it('handles negatives, decimals, exponents and thousands separators', () => {
    const n = column(csv(['n'], ['-2.5'], ['1,000'], ['1e2'], ['0.5']), 'n')
    expect(n.inferredType).toBe('decimal')
    expect(n.numericStats).toEqual({ count: 4, min: -2.5, max: 1000, mean: 274.5, median: 50.25 })
  })

  it('skips missing values', () => {
    const n = column(csv(['n'], ['4'], [''], ['NA'], ['6']), 'n')
    expect(n.numericStats).toEqual({ count: 2, min: 4, max: 6, mean: 5, median: 5 })
  })

  it('sorts numerically, not as text', () => {
    expect(numericStats([10, 9, 100, 2])).toMatchObject({ min: 2, max: 100, median: 9.5 })
  })

  it('returns null for no values and leaves its input unsorted', () => {
    expect(numericStats([])).toBeNull()
    const values = [3, 1, 2]
    numericStats(values)
    expect(values).toEqual([3, 1, 2])
  })

  it('is not computed for string columns', () => {
    expect(column(csv(['s'], ['a'], ['b']), 's').numericStats).toBeNull()
  })
})

describe('profileDataset: purity', () => {
  const input = () =>
    csv(
      ['id', 'amount', 'note'],
      ['1', '1,200.50', ' keep my spaces '],
      ['2', 'NA', ''],
      ['3', '7', 'Carol, Jr.'],
    )

  it('never modifies the input', () => {
    const frozen = deepFreeze(input())
    const before = JSON.stringify(frozen)
    // Frozen input makes any write throw in strict mode, so this also proves no mutation is attempted.
    expect(() => profileDataset(frozen)).not.toThrow()
    expect(JSON.stringify(frozen)).toBe(before)
    expect(frozen.rows[0].note).toBe(' keep my spaces ')
    expect(frozen.rows[0].amount).toBe('1,200.50')
  })

  it('is deterministic', () => {
    expect(profileDataset(input())).toEqual(profileDataset(input()))
  })
})
