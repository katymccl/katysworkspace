import { BaseEdge, getBezierPath, Position, type Edge, type EdgeProps } from '@xyflow/react'
import type { ArrowHeads } from './linkStyle'

export type ArrowEdgeType = Edge<{ heads: ArrowHeads }, 'arrow'>

/** The way out of a box from each side, as a unit step. */
const OUTWARD: Record<Position, [number, number]> = {
  [Position.Left]: [-1, 0],
  [Position.Right]: [1, 0],
  [Position.Top]: [0, -1],
  [Position.Bottom]: [0, 1],
}

/**
 * A curved link with drawn arrowheads at the column ends. React Flow's own markers sit on top of
 * the line, so a thick line pokes through the head and the curve is still bending under it. Here
 * the curve stops inside each head's notch, and each head points straight into its box. Heads grow
 * with the line, and stay solid when the line is dashed.
 */
export function ArrowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  style,
  data,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
}: EdgeProps<ArrowEdgeType>) {
  const heads = data?.heads ?? 'end'
  const width = Number(style?.strokeWidth ?? 2)
  const length = 8 + width * 2
  const half = 3.5 + width
  // The line ends just inside a head's notch, so no gap shows between line and head.
  const lineEnd = length * 0.7

  const head = (x: number, y: number, side: Position) => {
    const [dx, dy] = OUTWARD[side]
    const at = (distance: number, across = 0) =>
      `${x + dx * distance - dy * across},${y + dy * distance + dx * across}`
    return {
      d: `M${at(0)} L${at(length, half)} L${at(length * 0.75)} L${at(length, -half)} Z`,
      lineX: x + dx * lineEnd,
      lineY: y + dy * lineEnd,
    }
  }
  const start = heads === 'both' ? head(sourceX, sourceY, sourcePosition) : null
  const end = heads !== 'none' ? head(targetX, targetY, targetPosition) : null

  const [path, labelX, labelY] = getBezierPath({
    sourceX: start?.lineX ?? sourceX,
    sourceY: start?.lineY ?? sourceY,
    sourcePosition,
    targetX: end?.lineX ?? targetX,
    targetY: end?.lineY ?? targetY,
    targetPosition,
  })
  const color = style?.stroke ?? '#7960bd'

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        interactionWidth={interactionWidth}
      />
      {[start, end].map(
        (h, i) =>
          h && (
            <path
              key={i}
              d={h.d}
              fill={color}
              stroke={color}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          ),
      )}
    </>
  )
}
