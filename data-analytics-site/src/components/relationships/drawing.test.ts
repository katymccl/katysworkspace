import { describe, expect, it } from 'vitest'
import { HEADER_COLUMN, columnOfHandle, drawnLink, handleId, pickColumns } from './layout'

describe('columnOfHandle', () => {
  it('reads back the column from any handle, including names with colons', () => {
    expect(columnOfHandle(handleId('order_id', 'left', 'source'))).toBe('order_id')
    expect(columnOfHandle(handleId('Time: start', 'right', 'target'))).toBe('Time: start')
  })

  it('ignores the header anchor and unknown ids', () => {
    expect(columnOfHandle(handleId(HEADER_COLUMN, 'left', 'source'))).toBeNull()
    expect(columnOfHandle('something')).toBeNull()
    expect(columnOfHandle(null)).toBeNull()
  })
})

describe('drawnLink', () => {
  const connection = {
    source: 'orders',
    target: 'shipments',
    sourceHandle: handleId('order_id', 'right', 'source'),
    targetHandle: handleId('order_ref', 'left', 'source'),
  }

  it('turns a line between two columns into a link', () => {
    expect(drawnLink(connection)).toEqual({
      from: { dataset: 'orders', column: 'order_id' },
      to: { dataset: 'shipments', column: 'order_ref' },
    })
  })

  it('refuses lines within one dataset or to a box header', () => {
    expect(drawnLink({ ...connection, target: 'orders' })).toBeNull()
    expect(
      drawnLink({ ...connection, targetHandle: handleId(HEADER_COLUMN, 'left', 'target') }),
    ).toBeNull()
  })
})

describe('pickColumns while drawing', () => {
  it('lists every column so any of them can be linked', () => {
    const all = Array.from({ length: 15 }, (_, i) => ({
      name: `c${i}`,
      type: 'string' as const,
      isIdentifier: false,
    }))
    const { columns, hiddenCount } = pickColumns(all, new Set(['c3']), true)
    expect(columns).toHaveLength(15)
    expect(columns[3].linked).toBe(true)
    expect(hiddenCount).toBe(0)
  })
})
