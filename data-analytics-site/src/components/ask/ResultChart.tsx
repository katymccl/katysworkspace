import { useState } from 'react'
import type { ChartPoint as Point, HeatmapChart, ResolvedChart } from '../../lib/ask/chart'
import { formatCell } from './format'

/**
 * One measure across categories (bars), periods (a line), shares of a whole (a pie) or pairs of
 * categories (a heatmap). Bars and lines are a single series, so the y heading titles them without
 * a legend; a pie's slices are named in a legend with their values, and a heatmap has a scale.
 * Every mark has a hover/focus tooltip, and the table below always shows the same numbers.
 */
export function ResultChart({ chart }: { chart: ResolvedChart }) {
  const { x, y, notes } = chart
  return (
    <figure className="rounded-lg border border-slate-200 p-4">
      <figcaption className="mb-3 text-xs font-medium text-slate-600">
        {y} by {x}
        {chart.type === 'heatmap' && ` and ${chart.by}`}
      </figcaption>
      {chart.type === 'heatmap' ? (
        <Heatmap chart={chart} />
      ) : chart.type === 'bar' ? (
        <Bars points={chart.points} />
      ) : chart.type === 'line' ? (
        <Line points={chart.points} />
      ) : (
        <Pie points={chart.points} />
      )}
      {notes.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-slate-500">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </figure>
  )
}

/**
 * Heatmap steps, low to high: one hue (the app's violet) getting darker, so more reads as darker
 * without needing colour to tell values apart.
 */
const HEAT_COLORS = [
  '#ede9fe',
  '#ddd6fe',
  '#c4b5fd',
  '#a78bfa',
  '#8b5cf6',
  '#7c3aed',
  '#6d28d9',
  '#4c1d95',
]

function Heatmap({ chart }: { chart: HeatmapChart }) {
  const [hover, setHover] = useState<{ r: number; c: number; left: number; top: number } | null>(
    null,
  )
  const { rows, columns, values } = chart
  const present = values.flat().filter((v): v is number => v !== null)
  const lo = Math.min(...present)
  const hi = Math.max(...present)
  const step = (v: number) =>
    hi === lo
      ? HEAT_COLORS.length - 1
      : Math.min(Math.floor(((v - lo) / (hi - lo)) * HEAT_COLORS.length), HEAT_COLORS.length - 1)
  const hasGaps = present.length < rows.length * columns.length
  const show = (r: number, c: number, cell: HTMLElement) =>
    setHover({ r, c, left: cell.offsetLeft + cell.offsetWidth / 2, top: cell.offsetTop })
  const hovered = hover && values[hover.r][hover.c]

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div
          className="relative grid min-w-max gap-0.5 text-[11px]"
          style={{
            gridTemplateColumns: `minmax(4rem, 10rem) repeat(${columns.length}, minmax(2.25rem, 1fr))`,
          }}
          role="table"
          aria-label={`Heatmap of ${chart.y} by ${chart.x} and ${chart.by}`}
          onMouseLeave={() => setHover(null)}
        >
          <div role="row" className="contents">
            <span role="columnheader" className="truncate self-end pr-2 text-slate-400">
              {chart.x} / {chart.by}
            </span>
            {columns.map((c) => (
              <span
                key={c}
                role="columnheader"
                title={c}
                className="truncate self-end pb-0.5 text-center text-slate-500"
              >
                {c}
              </span>
            ))}
          </div>
          {rows.map((row, r) => (
            <div key={row} role="row" className="contents">
              <span role="rowheader" title={row} className="truncate self-center pr-2 text-slate-600">
                {row}
              </span>
              {columns.map((column, c) => {
                const v = values[r][c]
                const label = `${row}, ${column}: ${v === null ? 'no data' : formatCell(v)}`
                return (
                  <span
                    key={column}
                    role="cell"
                    tabIndex={0}
                    aria-label={label}
                    onMouseEnter={(e) => show(r, c, e.currentTarget)}
                    onFocus={(e) => show(r, c, e.currentTarget)}
                    onBlur={() => setHover(null)}
                    className={`h-7 rounded-sm focus:outline-2 focus:outline-offset-1 focus:outline-violet-700 ${
                      v === null ? 'border border-dashed border-slate-200' : ''
                    } ${hover?.r === r && hover.c === c ? 'ring-2 ring-slate-900 ring-inset' : ''}`}
                    style={v === null ? undefined : { background: HEAT_COLORS[step(v)] }}
                  />
                )
              })}
            </div>
          ))}
          {hover && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow"
              style={{ left: hover.left, top: hover.top }}
            >
              {rows[hover.r]} · {columns[hover.c]}:{' '}
              <span className="tabular-nums">
                {hovered === null ? 'no data' : formatCell(hovered)}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="tabular-nums">{formatCell(lo)}</span>
          <span className="flex gap-px" aria-hidden>
            {HEAT_COLORS.map((color) => (
              <span key={color} className="h-2.5 w-4 first:rounded-l-sm last:rounded-r-sm" style={{ background: color }} />
            ))}
          </span>
          <span className="tabular-nums">{formatCell(hi)}</span>
          <span>{chart.y}</span>
        </span>
        {hasGaps && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border border-dashed border-slate-300" aria-hidden />
            No data
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Slice colours in a fixed order, largest slice first: the first six categorical slots of the
 * dataviz reference palette (checked for colour-blind separation). Light ones sit below 3:1
 * against white, so the legend always names each slice with its value.
 */
const PIE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']
/** "Other" is grey so it never reads as one more category. */
const OTHER_COLOR = '#a3a3a3'

function Pie({ points }: { points: Point[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = points.reduce((n, p) => n + p.value, 0)
  const size = 200
  const r = size / 2 - 4
  const c = size / 2
  const colorOf = (p: Point, i: number) =>
    p.label.startsWith('Other (') && i === points.length - 1 ? OTHER_COLOR : PIE_COLORS[i]
  const share = (v: number) => `${((v / total) * 100).toFixed(v / total < 0.1 ? 1 : 0)}%`

  // Slices run clockwise from twelve o'clock.
  const angleAt = (n: number) => -Math.PI / 2 + (n / total) * Math.PI * 2
  const before = points.map((_, i) => points.slice(0, i).reduce((n, p) => n + p.value, 0))
  const slices = points.map((p, i) => {
    const start = angleAt(before[i])
    const end = angleAt(before[i] + p.value)
    const at = (a: number) => `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`
    const d =
      points.length === 1
        ? `M${c - r},${c} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`
        : `M${c},${c} L${at(start)} A${r},${r} 0 ${end - start > Math.PI ? 1 : 0},1 ${at(end)} Z`
    const mid = (start + end) / 2
    return { p, i, d, tip: { x: c + r * 0.6 * Math.cos(mid), y: c + r * 0.6 * Math.sin(mid) } }
  })

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative w-44 shrink-0 sm:w-52">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Pie chart of ${points.length} parts`}
          onMouseLeave={() => setHover(null)}
        >
          {slices.map(({ p, i, d }) => (
            <path
              key={i}
              d={d}
              fill={colorOf(p, i)}
              // A 2px white gap between slices, a little wider on the one being pointed at.
              stroke="#ffffff"
              strokeWidth={hover === i ? 3 : 2}
              strokeLinejoin="round"
              opacity={hover === null || hover === i ? 1 : 0.55}
              tabIndex={0}
              aria-label={`${p.label}: ${formatCell(p.value)} (${share(p.value)})`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="transition-opacity focus:outline-none"
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow"
            style={{
              left: `${(slices[hover].tip.x / size) * 100}%`,
              top: `${(slices[hover].tip.y / size) * 100}%`,
            }}
          >
            {points[hover].label}:{' '}
            <span className="tabular-nums">
              {formatCell(points[hover].value)} ({share(points[hover].value)})
            </span>
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs" role="list">
        {points.map((p, i) => (
          <li
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 rounded px-1 py-0.5 ${hover === i ? 'bg-slate-50' : ''}`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: colorOf(p, i) }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">{p.label}</span>
            <span className="tabular-nums text-slate-700">{formatCell(p.value)}</span>
            <span className="w-11 text-right tabular-nums text-slate-500">{share(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
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
  // A single point sits in the middle, with the whole width as its hover area.
  const gaps = Math.max(points.length - 1, 1)
  const px = (i: number) =>
    points.length === 1
      ? (PAD.left + W - PAD.right) / 2
      : PAD.left + (i / gaps) * (W - PAD.left - PAD.right)
  const py = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom)
  const ticks = [lo, lo + span / 2, hi]
  const step = (W - PAD.left - PAD.right) / gaps

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
