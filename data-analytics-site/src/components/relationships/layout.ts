import type { InferredType } from '../../lib/profiling'

/** Geometry of a dataset box in the diagram, shared by the layout and the node component. */
export const NODE = {
  width: 260,
  headerHeight: 64,
  rowHeight: 30,
  footerHeight: 28,
  gapX: 100,
  gapY: 72,
}
export const MAX_COLUMNS_SHOWN = 10

/** Hidden anchor points: every column row can start or end a line on either side. */
export const handleId = (column: string, side: 'left' | 'right', kind: 'source' | 'target') =>
  `${kind}:${side}:${column}`
/** Anchor name for a box's header, used for dataset-level links such as "same columns". */
export const HEADER_COLUMN = '\u0000header'

export interface NodeColumn {
  name: string
  type: InferredType
  isIdentifier: boolean
  /** Part of a relationship drawn on the diagram. */
  linked: boolean
}

export interface NodeModel {
  id: string
  title: string
  fileName: string
  rowCount: number
  columns: NodeColumn[]
  /** Columns left out to keep the box readable. */
  hiddenCount: number
}

/**
 * Chooses which columns a box lists: those in a drawn relationship and likely identifiers, in file
 * order, up to MAX_COLUMNS_SHOWN (linked ones first if there are too many).
 */
export function pickColumns(
  all: readonly Omit<NodeColumn, 'linked'>[],
  linked: ReadonlySet<string>,
): { columns: NodeColumn[]; hiddenCount: number } {
  const marked = all.map((c) => ({ ...c, linked: linked.has(c.name) }))
  const relevant = marked.filter((c) => c.linked || c.isIdentifier)
  const chosen =
    relevant.length <= MAX_COLUMNS_SHOWN
      ? relevant
      : [...relevant.filter((c) => c.linked), ...relevant.filter((c) => !c.linked)]
          .slice(0, MAX_COLUMNS_SHOWN)
          .sort(
            (a, b) =>
              all.findIndex((c) => c.name === a.name) - all.findIndex((c) => c.name === b.name),
          )
  return { columns: chosen, hiddenCount: all.length - chosen.length }
}

export function nodeHeight(node: NodeModel): number {
  return (
    NODE.headerHeight +
    Math.max(node.columns.length, 1) * NODE.rowHeight +
    (node.hiddenCount > 0 ? NODE.footerHeight : 0)
  )
}

export interface LayoutEdge {
  a: string
  b: string
  /** How strongly the edge should pull its boxes together; key links outweigh "same columns". */
  weight: number
}

const MAX_PER_ROW = 4

/**
 * Places boxes so related datasets sit side by side: each connected group gets its own row (or
 * rows, if large), with its most connected dataset in the middle and its partners either side.
 * Unconnected datasets share the last row. Deterministic.
 */
export function layoutNodes(
  nodes: readonly NodeModel[],
  edges: readonly LayoutEdge[],
): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const ids = [...byId.keys()].sort(compareText)
  const neighbours = new Map(ids.map((id) => [id, new Set<string>()]))
  const degree = new Map(ids.map((id) => [id, 0]))
  for (const e of edges) {
    if (!byId.has(e.a) || !byId.has(e.b) || e.a === e.b) continue
    neighbours.get(e.a)!.add(e.b)
    neighbours.get(e.b)!.add(e.a)
    degree.set(e.a, degree.get(e.a)! + e.weight)
    degree.set(e.b, degree.get(e.b)! + e.weight)
  }

  // Connected groups, found in a fixed order so the result never depends on input order.
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const start of ids) {
    if (seen.has(start)) continue
    const group: string[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length > 0) {
      const id = queue.shift()!
      group.push(id)
      for (const next of [...neighbours.get(id)!].sort(compareText)) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    groups.push(group)
  }

  const connected = groups.filter((g) => g.length > 1).sort((a, b) => b.length - a.length)
  const loners = groups.filter((g) => g.length === 1).flat()
  const byDegree = (a: string, b: string) => degree.get(b)! - degree.get(a)! || compareText(a, b)
  const rows = [
    ...connected.flatMap((g) => chunk(centreOut([...g].sort(byDegree)), MAX_PER_ROW)),
    ...chunk(loners, MAX_PER_ROW),
  ]

  const positions = new Map<string, { x: number; y: number }>()
  let y = 0
  for (const row of rows) {
    row.forEach((id, i) => positions.set(id, { x: i * (NODE.width + NODE.gapX), y }))
    y += Math.max(...row.map((id) => nodeHeight(byId.get(id)!))) + NODE.gapY
  }
  return positions
}

/**
 * Reorders a ranked list so the highest-ranked item is in the middle and the rest alternate
 * left and right: [a, b, c, d] → [d, b, a, c].
 */
export function centreOut<T>(ranked: readonly T[]): T[] {
  const left: T[] = []
  const right: T[] = []
  ranked.slice(1).forEach((item, i) => (i % 2 === 0 ? left : right).push(item))
  return ranked.length === 0 ? [] : [...left.reverse(), ranked[0], ...right]
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size))
  return rows
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
