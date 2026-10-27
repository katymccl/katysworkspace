import { useState } from 'react'
import type { Cell, QueryResult } from '../../lib/ask/execute'
import { formatCell } from './format'

interface ResultChartProps {
  result: QueryResult
  type: 'bar' | 'line'
  x: string
  y: string
}

/** Most bars or points a chart shows; longer results are left to the table. */
export const MAX_CHART_POINTS = 60

/**
 * One measure across categories (bars) or periods (a line). A single series, so it needs no
 * legend: the y heading titles it. Every mark has a hover/focus tooltip, and the table below
 * always shows the same numbers.
 */
export function ResultChart({ result, type, x, y }: ResultChartProps) {
  const xi = result.columns.findIndex((c) => c.label === x)
  const yi = result.columns.findIndex((c) => c.label === y)
  if (xi < 0 || yi < 0 || !result.columns[yi].numeric) return null
  const points = result.rows
    .filter((r): r is Cell[] => typeof r[yi] === 'number')
    .map((r) => ({ label: formatCell(r[xi]), value: r[yi] as number }))
  if (points.length < 2 || points.length > MAX_CHART_POINTS) return null

  return (
    <figure className="rounded-lg border border-slate-200 p-4">
      <figcaption className="mb-3 text-xs font-medium text-slate-600">
        {y} by {x}
      </figcaption>
      {type === 'bar' ? <Bars points={points} /> : <Line points={points} />}
    </figure>
  )
}

interface Point {
  label: string
  value: number
}

function Bars({ points }: { points: Point[] }) {
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 0)
  return (
    <ul className="space-y-0.5" role="list">
      {points.map((p, i) => (
        <li
          key={i}
          tabIndex={0}
          title={`${p.label}: ${formatCell(p.value)}`}
          className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded px-1 py-0.5 text-xs hover:bg-slate-50 focus:bg-slate-50 focus:outline-none sm:grid-cols-[minmax(0,14rem)_1fr_auto]"
        >
          <span className="truncate text-slate-600">{p.label}</span>
          <span className="h-3.5">
            <span
              className="block h-full rounded-r bg-violet-500 group-hover:bg-violet-600 group-focus:bg-violet-600"
              style={{ width: max > 0 ? `${Math.max((Math.abs(p.value) / max) * 100, 0.5)}%` : 0 }}
            />
          </span>
          <span className="tabular-nums text-slate-700">{formatCell(p.value)}</span>
        </li>
      ))}
    </ul>
  )
}

const W = 640
const H = 220
const PAD = { top: 12, right: 12, bottom: 28, left: 56 }

function Line({ points }: { points: Point[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const values = points.map((p) => p.value)
  // Start the scale at zero unless values go below it, so changes aren't exaggerated.
  const lo = Math.min(0, ...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const px = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
  const py = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom)
  const ticks = [lo, lo + span / 2, hi]
  const step = (W - PAD.left - PAD.right) / (points.length - 1)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Line chart of ${points.length} values from ${points[0].label} to ${points.at(-1)!.label}`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={py(t)}
              y2={py(t)}
              className="stroke-slate-100"
            />
            <text
              x={PAD.left - 8}
              y={py(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-slate-500 text-[11px]"
            >
              {formatCell(t)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 8} className="fill-slate-500 text-[11px]">
          {points[0].label}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-slate-500 text-[11px]">
          {points.at(-1)!.label}
        </text>
        {hover !== null && (
          <line
            x1={px(hover)}
            x2={px(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            className="stroke-slate-300"
          />
        )}
        <polyline
          points={points.map((p, i) => `${px(i)},${py(p.value)}`).join(' ')}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          className="stroke-violet-500"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={px(i)}
            cy={py(p.value)}
            r={hover === i ? 5 : points.length <= 24 ? 4 : 0}
            strokeWidth={2}
            className="fill-violet-500 stroke-white"
          />
        ))}
        {/* Hit areas wider than the marks: one column per point. */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={px(i) - step / 2}
            y={PAD.top}
            width={step}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            tabIndex={0}
            aria-label={`${p.label}: ${formatCell(p.value)}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="focus:outline-none"
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow"
          style={{
            left: `${(px(hover) / W) * 100}%`,
            top: `${(py(points[hover].value) / H) * 100}%`,
          }}
        >
          {points[hover].label}:{' '}
          <span className="tabular-nums">{formatCell(points[hover].value)}</span>
        </div>
      )}
    </div>
  )
}
