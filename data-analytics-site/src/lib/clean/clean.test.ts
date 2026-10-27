import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import { NO_EDITS, applyEdits, cellKey, summariseEdits, toggleRemoved } from './apply'
import { expectedKind, findIssues, fits, issueCount } from './detect'

const columns = ['id', 'city', 'amount', 'ordered_on']
const table = (...lines: string[][]) =>
  lines.map((l) => Object.fromEntries(columns.map((c, i) => [c, l[i]])))

// 10 rows so one odd amount stays under the 20% a mostly-number column may have.
const rows = table(
  ['1', 'Leeds', '10.5', '2024-01-02'],
  ['2', '', '20', '2024-01-03'],
  ['3', 'York', 'abc', '2024-01-04'],
  ['1', 'Leeds', '10.5', '2024-01-02'],
  ['4', 'NY', '7', 'n/a'],
  ['5', 'N.Y.', '8', '2024-01-06'],
  ['6', 'Leeds', '9', '2024-01-07'],
  ['7', 'York', '11', 'soon'],
  ['8', 'Leeds', '12', '2024-01-09'],
  ['1', 'Leeds', '10.5', '2024-01-02'],
)
const issues = findIssues(columns, rows, profileDataset({ columns, rows }))

describe('findIssues', () => {
  it('lists missing values by column, counting tokens like n/a', () => {
    expect(issues.missing).toEqual([
      { column: 'city', rows: [1] },
      { column: 'ordered_on', rows: [4] },
    ])
  })

  it('groups exact duplicate rows, keeping the first', () => {
    expect(issues.duplicates).toEqual([{ keep: 0, copies: [3, 9] }])
  })

  it('flags values that do not fit a mostly-typed column', () => {
    expect(issues.mismatches).toEqual([
      { row: 2, column: 'amount', value: 'abc', expected: 'number' },
      { row: 7, column: 'ordered_on', value: 'soon', expected: 'date' },
    ])
    expect(issueCount(issues)).toBe(6)
  })

  it('expects nothing of text columns or columns without a clear main kind', () => {
    const base = { kindCounts: { integer: 0, decimal: 0, boolean: 0, date: 0, string: 0 } }
    expect(expectedKind({ ...base, inferredType: 'string', dominantKind: 'string', nonMissingCount: 3 })).toBeNull()
    expect(
      expectedKind({
        inferredType: 'mixed',
        dominantKind: 'integer',
        kindCounts: { ...base.kindCounts, integer: 6, string: 4 },
        nonMissingCount: 10,
      }),
    ).toBeNull()
  })

  it('treats one stray value in a small column as wrong', () => {
    const kindCounts = { integer: 3, decimal: 0, boolean: 0, date: 0, string: 1 }
    const small = { inferredType: 'mixed', dominantKind: 'integer' as const, kindCounts }
    expect(expectedKind({ ...small, nonMissingCount: 4 })).toBe('number')
    expect(
      expectedKind({
        ...small,
        kindCounts: { ...kindCounts, integer: 1 },
        nonMissingCount: 2,
      }),
    ).toBeNull()
  })
})

describe('fits', () => {
  it('accepts whole and decimal numbers alike, and blanks', () => {
    expect(fits('number', '3')).toBe(true)
    expect(fits('number', '3.5')).toBe(true)
    expect(fits('number', '')).toBe(true)
    expect(fits('date', '2024-02-30')).toBe(false)
  })
})

describe('applyEdits', () => {
  it('changes nothing without edits', () => {
    expect(applyEdits(rows, issues, NO_EDITS)).toEqual(rows)
  })

  it('applies replacements, then cell edits, then removes duplicates', () => {
    const edits = {
      ...NO_EDITS,
      removeDuplicates: true,
      cells: { [cellKey(2, 'amount')]: '15', [cellKey(4, 'city')]: 'Boston' },
      replacements: [{ column: 'city', from: ['NY', 'N.Y.'], to: 'New York' }],
    }
    const result = applyEdits(rows, issues, edits)
    expect(result).toHaveLength(8)
    expect(result[2].amount).toBe('15')
    expect(result.map((r) => r.city)).toEqual([
      'Leeds',
      '',
      'York',
      'Boston',
      'New York',
      'Leeds',
      'York',
      'Leeds',
    ])
    expect(rows[2].amount).toBe('abc')
    expect(summariseEdits(rows, issues, edits)).toEqual({ changedValues: 3, removedRows: 2 })
  })

  it('removes chosen rows, and does not count edits to rows that go', () => {
    const edits = toggleRemoved(
      { ...NO_EDITS, removeDuplicates: true, cells: { [cellKey(1, 'city')]: 'Leeds' } },
      [1, 4, 3],
    )
    expect(edits.removeRows).toEqual([1, 3, 4])
    const result = applyEdits(rows, issues, edits)
    expect(result.map((r) => r.id)).toEqual(['1', '3', '5', '6', '7', '8'])
    // Row 3 is both a duplicate copy and picked: removed once.
    expect(summariseEdits(rows, issues, edits)).toEqual({ changedValues: 0, removedRows: 4 })
    expect(toggleRemoved(edits, [1, 4]).removeRows).toEqual([3])
  })
})
