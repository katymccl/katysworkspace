import { describe, expect, it } from 'vitest'
import {
  MAX_COLUMNS_SHOWN,
  NODE,
  centreOut,
  layoutNodes,
  nodeHeight,
  pickColumns,
  type NodeModel,
} from './layout'

const node = (id: string, columns = 2): NodeModel => ({
  id,
  title: id,
  fileName: `${id}.csv`,
  rowCount: 1,
  columns: Array.from({ length: columns }, (_, i) => ({
    name: `c${i}`,
    type: 'string',
    isIdentifier: false,
    linked: false,
  })),
  hiddenCount: 0,
})

describe('pickColumns', () => {
  const all = Array.from({ length: 15 }, (_, i) => ({
    name: `c${i}`,
    type: 'string' as const,
    isIdentifier: i % 2 === 0,
  }))

  it('lists linked columns and identifiers, in file order', () => {
    const { columns, hiddenCount } = pickColumns(all.slice(0, 5), new Set(['c3']))
    expect(columns.map((c) => c.name)).toEqual(['c0', 'c2', 'c3', 'c4'])
    expect(columns.find((c) => c.name === 'c3')?.linked).toBe(true)
    expect(hiddenCount).toBe(1)
  })

  it('caps the list, keeping linked columns first', () => {
    const { columns, hiddenCount } = pickColumns(all, new Set(['c13', 'c11']))
    expect(columns).toHaveLength(MAX_COLUMNS_SHOWN)
    expect(columns.map((c) => c.name)).toEqual(expect.arrayContaining(['c11', 'c13']))
    expect(hiddenCount).toBe(15 - MAX_COLUMNS_SHOWN)
  })
})

describe('centreOut', () => {
  it('puts the top item in the middle and alternates the rest', () => {
    expect(centreOut(['a', 'b', 'c', 'd'])).toEqual(['d', 'b', 'a', 'c'])
    expect(centreOut(['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
    expect(centreOut(['a'])).toEqual(['a'])
    expect(centreOut([])).toEqual([])
  })
})

describe('layoutNodes', () => {
  const edge = (a: string, b: string, weight = 1) => ({ a, b, weight })
  const rowOf = (positions: Map<string, { x: number; y: number }>) => (id: string) =>
    positions.get(id)!.y
  const colOf = (positions: Map<string, { x: number; y: number }>) => (id: string) =>
    positions.get(id)!.x / (NODE.width + NODE.gapX)

  it('gives each connected group its own row, with the hub in the middle', () => {
    // Orders: two monthly files both point at customers. Libraries: staff points at libraries.
    const nodes = ['customers', 'feb', 'jan', 'libs', 'staff', 'misc'].map((id) => node(id))
    const positions = layoutNodes(nodes, [
      edge('jan', 'customers'),
      edge('feb', 'customers'),
      edge('jan', 'feb', 0.5),
      edge('staff', 'libs'),
    ])
    const row = rowOf(positions)
    const col = colOf(positions)
    expect(row('jan')).toBe(row('customers'))
    expect(row('feb')).toBe(row('customers'))
    expect(col('customers')).toBe(1)
    // Both partners sit right next to the hub, so no line crosses a box.
    expect([col('jan'), col('feb')].sort()).toEqual([0, 2])
    expect(row('staff')).toBe(row('libs'))
    expect(row('staff')).toBeGreaterThan(row('customers'))
    expect(row('misc')).toBeGreaterThan(row('staff'))
  })

  it('spaces rows by the tallest box in each', () => {
    const nodes = [node('a', 6), node('b'), node('c')]
    const positions = layoutNodes(nodes, [edge('a', 'b')])
    expect(positions.get('c')!.y).toBe(nodeHeight(nodes[0]) + NODE.gapY)
  })

  it('wraps large groups and lone datasets onto rows of at most four', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const positions = layoutNodes(
      ids.map((id) => node(id)),
      ids.slice(1).map((id) => edge('a', id)),
    )
    const rows = new Set([...positions.values()].map((p) => p.y))
    expect(rows.size).toBe(2)
    expect(new Set([...positions.values()].map((p) => `${p.x},${p.y}`)).size).toBe(6)
  })

  it('ignores edges to unknown datasets and is deterministic', () => {
    const nodes = ['d', 'b', 'a', 'c'].map((id) => node(id))
    const edges = [edge('a', 'b'), edge('c', 'ghost')]
    const first = [...layoutNodes(nodes, edges)].sort()
    expect([...layoutNodes([...nodes].reverse(), [...edges].reverse())].sort()).toEqual(first)
  })
})
