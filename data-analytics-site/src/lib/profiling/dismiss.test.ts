import { describe, expect, it } from 'vitest'
import { withDismissedIdentifiers } from './dismiss'
import { profileDataset } from './profile'

const profile = profileDataset({
  columns: ['Order ID', 'Customer name', 'Amount'],
  rows: [
    { 'Order ID': 'O-1', 'Customer name': 'Ada', Amount: '3.5' },
    { 'Order ID': 'O-2', 'Customer name': 'Grace', Amount: '3.5' },
  ],
})
const byName = (p: typeof profile, name: string) => p.columns.find((c) => c.name === name)!

describe('withDismissedIdentifiers', () => {
  it('removes the flag from listed columns and keeps their reasons', () => {
    const result = withDismissedIdentifiers(profile, ['Customer name'])
    const column = byName(result, 'Customer name')
    expect(column.isPotentialIdentifier).toBe(false)
    expect(column.identifierDismissed).toBe(true)
    expect(column.identifierReasons).toEqual(byName(profile, 'Customer name').identifierReasons)
    expect(byName(result, 'Order ID').isPotentialIdentifier).toBe(true)
  })

  it('restores the flag when a column is no longer listed', () => {
    const restored = withDismissedIdentifiers(withDismissedIdentifiers(profile, ['Order ID']), [])
    expect(byName(restored, 'Order ID')).toEqual(byName(profile, 'Order ID'))
  })

  it('ignores columns that were never flagged, and unknown names', () => {
    expect(byName(profile, 'Amount').isPotentialIdentifier).toBe(false)
    expect(withDismissedIdentifiers(profile, ['Amount', 'Missing'])).toBe(profile)
  })
})
