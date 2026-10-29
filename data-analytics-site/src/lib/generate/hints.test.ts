import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import { baseHints } from './hints'

const hintsFor = (columns: string[], rows: string[][]) =>
  baseHints(
    'data.csv',
    profileDataset({
      columns,
      rows: rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))),
    }),
  )

describe('baseHints', () => {
  it('suggests the thing a repeating ID column refers to', () => {
    const hints = hintsFor(
      ['order_id', 'customer_id', 'amount'],
      [
        ['O-1', 'C-1', '5'],
        ['O-2', 'C-1', '6'],
        ['O-3', 'C-2', '7'],
      ],
    )
    expect(hints.description).toBe(
      'e.g. One row per customer in data.csv, with a few details about each',
    )
    expect(hints.columns.split('\n')[0]).toBe('customer_id')
  })

  it('falls back to a repeated label column', () => {
    const hints = hintsFor(
      ['Shipped on', 'Region'],
      [
        ['2024-01-01', 'North'],
        ['2024-01-02', 'North'],
        ['2024-01-03', 'South'],
        ['2024-01-04', 'South'],
      ],
    )
    expect(hints.description).toContain('One row per region in data.csv')
    expect(hints.columns.split('\n')[0]).toBe('Region')
  })

  it('stays neutral when nothing is referred to', () => {
    const hints = hintsFor(['Amount'], [['1'], ['2']])
    expect(hints.description).toBe('e.g. Details about the things listed in data.csv')
    expect(hints.columns).not.toMatch(/librar/i)
  })
})
