import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { IdentifierStar } from '../profile/IdentifierStar'
import { TYPE_META } from '../profile/typeMeta'
import { HEADER_COLUMN, NODE, handleId, type NodeModel } from './layout'

export type DatasetNodeType = Node<{ model: NodeModel }, 'dataset'>
function Anchors({ column, top }: { column: string; top: number }) {
  return (
    <>
      {(['left', 'right'] as const).flatMap((side) =>
        (['source', 'target'] as const).map((kind) => (
          <Handle
            key={`${kind}-${side}`}
            id={handleId(column, side, kind)}
            type={kind}
            position={side === 'left' ? Position.Left : Position.Right}
            isConnectable={false}
            style={{ top, opacity: 0, pointerEvents: 'none' }}
          />
        )),
      )}
    </>
  )
}

/** One dataset as a box: its name, file and the columns that matter for relationships. */
export function DatasetNode({ data }: NodeProps<DatasetNodeType>) {
  const { model } = data
  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-300 bg-white text-left shadow-sm"
      style={{ width: NODE.width }}
    >
      <Anchors column={HEADER_COLUMN} top={NODE.headerHeight / 2} />
      <div
        className="border-b border-slate-200 bg-slate-50 px-3 py-2"
        style={{ height: NODE.headerHeight }}
      >
        <p className="truncate text-sm font-semibold text-slate-900" title={model.title}>
          {model.title}
        </p>
        <p className="truncate text-xs text-slate-500" title={model.fileName}>
          {model.fileName} · {model.rowCount.toLocaleString('en-US')} rows
        </p>
      </div>
      {model.columns.length === 0 ? (
        <p
          className="px-3 text-xs italic text-slate-400"
          style={{ lineHeight: `${NODE.rowHeight}px` }}
        >
          No linked columns
        </p>
      ) : (
        model.columns.map((c) => {
          const Icon = TYPE_META[c.type].Icon
          return (
            <div
              key={c.name}
              className={`relative flex items-center gap-2 border-b border-slate-100 px-3 text-xs ${
                c.linked ? 'bg-violet-50 font-medium text-slate-900' : 'text-slate-600'
              }`}
              style={{ height: NODE.rowHeight }}
            >
              <Anchors column={c.name} top={NODE.rowHeight / 2} />
              <Icon
                className="h-3 w-3 shrink-0 text-slate-400"
                aria-label={TYPE_META[c.type].label}
              />
              <span className="truncate" title={c.name}>
                {c.name}
              </span>
              {c.isIdentifier && <IdentifierStar className="h-3 w-3" />}
            </div>
          )
        })
      )}
      {model.hiddenCount > 0 && (
        <p className="px-3 text-xs text-slate-400" style={{ lineHeight: `${NODE.footerHeight}px` }}>
          +{model.hiddenCount} more column{model.hiddenCount === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}
