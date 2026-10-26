import { useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  type Edge,
  type EdgeMouseHandler,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { DiagramLink, DiagramSimilarity } from '../../lib/relationships/merge'
import { DatasetNode, type DatasetNodeType } from './DatasetNode'
import { HEADER_COLUMN, handleId, layoutNodes, type LayoutEdge, type NodeModel } from './layout'
import { cardinalityLabel, linkStyle } from './linkStyle'
import { loadPositions, savePositions, type Positions } from './positions'

const nodeTypes = { dataset: DatasetNode }

interface RelationshipDiagramProps {
  nodes: NodeModel[]
  links: DiagramLink[]
  similar: DiagramSimilarity[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Double-clicking a line confirms it, or un-confirms it. */
  onToggleConfirmed: (id: string) => void
  /** Identifies this set of datasets, so dragged positions are saved and restored for it. */
  layoutKey: string
}

/**
 * The relationship diagram: a box per dataset, lines between related columns. Positions come from
 * a deterministic layout until the user drags a box, after which its dragged position is kept (and
 * saved) until "Reset layout". Users can't draw new lines. Clicking a line selects it;
 * double-clicking confirms or un-confirms it.
 */
export function RelationshipDiagram({
  nodes,
  links,
  similar,
  selectedId,
  onSelect,
  onToggleConfirmed,
  layoutKey,
}: RelationshipDiagramProps) {
  // Boxes the user has moved, by dataset. The page remounts this component (key) per layoutKey.
  const [moved, setMoved] = useState<Positions>(() => loadPositions(layoutKey))

  const { flowNodes, edges } = useMemo(() => {
    const layoutEdges: LayoutEdge[] = [
      ...links.map((l) => ({ a: l.from.dataset, b: l.to.dataset, weight: 1 })),
      ...similar.map((sim) => ({ a: sim.datasets[0], b: sim.datasets[1], weight: 0.5 })),
    ]
    const positions = layoutNodes(nodes, layoutEdges)
    for (const [id, position] of Object.entries(moved)) {
      if (positions.has(id)) positions.set(id, position)
    }

    const flowNodes: DatasetNodeType[] = nodes.map((model) => ({
      id: model.id,
      type: 'dataset',
      position: positions.get(model.id)!,
      data: { model },
      connectable: false,
      ariaLabel: `${model.title}, ${model.columns.length} columns shown`,
    }))

    // Lines leave from the side facing the other box (wherever it has been dragged), so they don't
    // loop around.
    const sides = (from: string, to: string) => {
      const leftToRight = positions.get(from)!.x <= positions.get(to)!.x
      return leftToRight ? (['right', 'left'] as const) : (['left', 'right'] as const)
    }

    const titles = new Map(nodes.map((n) => [n.id, n.title]))
    const titleOf = (id: string) => titles.get(id) ?? id

    const edges: Edge[] = [
      ...links.map((l): Edge => {
        const [out, into] = sides(l.from.dataset, l.to.dataset)
        const style = linkStyle(l, l.id === selectedId)
        return {
          id: l.id,
          source: l.from.dataset,
          target: l.to.dataset,
          sourceHandle: handleId(l.from.column, out, 'source'),
          targetHandle: handleId(l.to.column, into, 'target'),
          label: `${l.confirmed ? '✓ ' : l.rejected ? '✕ ' : ''}${l.cardinality ? cardinalityLabel(l.cardinality) : l.source === 'ai' ? 'AI suggestion' : 'confirmed'}`,
          labelStyle: { fontSize: 11, fill: '#334155' },
          labelBgStyle: { fill: '#ffffff' },
          labelBgPadding: [4, 2],
          style: style.line,
          // Sized in pixels, not relative to the line, so arrowheads match on thick (confirmed or
          // selected) and thin lines alike.
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: style.color,
            width: 14,
            height: 14,
            markerUnits: 'userSpaceOnUse',
          },
          ariaLabel: `${titleOf(l.from.dataset)} ${l.from.column} relates to ${titleOf(l.to.dataset)} ${l.to.column}${l.confirmed ? ', confirmed' : l.rejected ? ', marked not related' : ''}`,
          interactionWidth: 24,
        }
      }),
      ...similar.map((s): Edge => {
        const [out, into] = sides(s.datasets[0], s.datasets[1])
        const style = linkStyle(s, s.id === selectedId)
        return {
          id: s.id,
          source: s.datasets[0],
          target: s.datasets[1],
          sourceHandle: handleId(HEADER_COLUMN, out, 'source'),
          targetHandle: handleId(HEADER_COLUMN, into, 'target'),
          label: `${s.confirmed ? '✓ ' : s.rejected ? '✕ ' : ''}same columns`,
          labelStyle: { fontSize: 11, fill: '#334155' },
          labelBgStyle: { fill: '#ffffff' },
          labelBgPadding: [4, 2],
          style: s.confirmed ? style.line : { ...style.line, strokeDasharray: '2 4' },
          ariaLabel: `${titleOf(s.datasets[0])} and ${titleOf(s.datasets[1])} share most of their columns${s.confirmed ? ', confirmed' : s.rejected ? ', marked not related' : ''}`,
          interactionWidth: 24,
        }
      }),
    ]
    return { flowNodes, edges }
  }, [nodes, links, similar, selectedId, moved])

  // A double-click starts with two clicks, so clicking only selects (never deselects) to keep the
  // line selected through a double-click.
  const onEdgeClick: EdgeMouseHandler = (_, edge) => onSelect(edge.id)
  const onEdgeDoubleClick: EdgeMouseHandler = (_, edge) => onToggleConfirmed(edge.id)

  // Only position changes are kept; they're saved once a drag ends.
  const onNodesChange: OnNodesChange<DatasetNodeType> = (changes) => {
    const updates: Positions = {}
    let finished = false
    for (const change of changes) {
      if (change.type !== 'position') continue
      if (change.position) updates[change.id] = change.position
      if (change.dragging === false) finished = true
    }
    if (Object.keys(updates).length === 0 && !finished) return
    setMoved((current) => {
      const next = { ...current, ...updates }
      if (finished) savePositions(layoutKey, next)
      return next
    })
  }

  const resetLayout = () => {
    setMoved({})
    savePositions(layoutKey, {})
  }

  return (
    <div className="h-[28rem] overflow-hidden rounded-xl border border-slate-200 bg-white sm:h-[32rem]">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        zoomOnDoubleClick={false}
        onPaneClick={() => onSelect(null)}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        nodesDraggable
        edgesFocusable
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={20} color="#e2e8f0" />
        <Controls showInteractive={false} />
        {Object.keys(moved).length > 0 && (
          <Panel position="top-right">
            <button
              onClick={resetLayout}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Reset layout
            </button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}
