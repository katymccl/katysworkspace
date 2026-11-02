import { useRef, useState } from 'react'
import {
  isEmptyAnswer,
  type DistributionAnswer,
  type ExploreAnswer,
  type RelatedAnswer,
} from '../../lib/explore/explore'
import { formatCell } from '../ask/format'
import { ResultChart } from '../ask/ResultChart'
import { ChartDownload } from '../ChartDownload'

const W = 640
const H = 260
const PAD = { top: 12, right: 16, bottom: 40, left: 56 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom

const tooltip =
  'pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow'

/** Upright bars, one per range of values, touching so they read as one spread. */
export function Histogram({ answer }: { answer: DistributionAnswer }) {
  const [hover, setHover] = useState<number | null>(null)
  const { bins } = answer
  const max = Math.max(...bins.map((b) => b.count), 1)
  const step = innerW / bins.length
  const py = (n: number) => PAD.top + (1 - n / max) * innerH
  const ticks = [0, Math.round(max / 2), max].filter((t, i, all) => all.indexOf(t) === i)
  const figure = useRef<HTMLElement>(null)
  const title = `Number of rows by ${answer.measure}`

  return (
    <figure ref={figure} className="rounded-lg border border-slate-200 p-4">
      <figcaption className="mb-3 flex items-start justify-between gap-3 text-xs font-medium text-slate-600">
        <span>{title}</span>
        <ChartDownload target={figure} title={title} />
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Histogram of ${answer.measure}: ${bins.length} ranges from ${bins[0].label} to ${bins.at(-1)!.label}`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={py(t)} y2={py(t)} className="stroke-slate-100" />
              <text x={PAD.left - 8} y={py(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px]">
                {formatCell(t)}
              </text>
            </g>
          ))}
          {bins.map((b, i) => (
            <rect
              key={i}
              x={PAD.left + i * step + 0.5}
              y={py(b.count)}
              width={Math.max(step - 1, 1)}
              height={PAD.top + innerH - py(b.count)}
              className={hover === i ? 'fill-violet-600' : 'fill-violet-500'}
            />
          ))}
          {/* The first and last ranges, named as in the tooltips. */}
          <text x={PAD.left} y={H - 22} className="fill-slate-500 text-[11px]">
            {bins[0].label}
          </text>
          {bins.length > 1 && (
            <text x={W - PAD.right} y={H - 22} textAnchor="end" className="fill-slate-500 text-[11px]">
              {bins.at(-1)!.label}
            </text>
          )}
          <text x={PAD.left + innerW / 2} y={H - 4} textAnchor="middle" className="fill-slate-600 text-[11px]">
            {answer.measure}
          </text>
          {/* Hit areas the full height of the chart, so short bars are easy to point at. */}
          {bins.map((b, i) => (
            <rect
              key={i}
              x={PAD.left + i * step}
              y={PAD.top}
              width={step}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${b.label}: ${b.count} rows`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="focus:outline-none"
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className={tooltip}
            style={{
              left: `${((PAD.left + (hover + 0.5) * step) / W) * 100}%`,
              top: `${(py(bins[hover].count) / H) * 100}%`,
            }}
          >
            {bins[hover].label}: <span className="tabular-nums">{formatCell(bins[hover].count)} rows</span>
          </div>
        )}
      </div>
    </figure>
  )
}

/** Evenly spaced, rounded tick values across a range. */
function ticksFor(lo: number, hi: number): number[] {
  if (lo === hi) return [lo]
  return [lo, lo + (hi - lo) / 2, hi]
}

/** One dot per row, with the dot nearest the pointer named in a tooltip. */
export function Scatter({ answer }: { answer: RelatedAnswer }) {
  const [hover, setHover] = useState<number | null>(null)
  const { points } = answer
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const [xlo, xhi] = [Math.min(...xs), Math.max(...xs)]
  const [ylo, yhi] = [Math.min(...ys), Math.max(...ys)]
  const px = (v: number) => PAD.left + (xhi === xlo ? 0.5 : (v - xlo) / (xhi - xlo)) * innerW
  const py = (v: number) => PAD.top + (1 - (yhi === ylo ? 0.5 : (v - ylo) / (yhi - ylo))) * innerH
  // Many dots overlap, so each is see-through and dense areas read darker.
  const opacity = points.length > 2000 ? 0.25 : points.length > 300 ? 0.45 : 0.7
  const figure = useRef<HTMLElement>(null)
  const title = `${answer.y} against ${answer.x}`

  const nearest = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - box.left) / box.width) * W
    const my = ((e.clientY - box.top) / box.height) * H
    let best = -1
    let bestDistance = 20 ** 2
    for (let i = 0; i < points.length; i++) {
      const d = (px(points[i].x) - mx) ** 2 + (py(points[i].y) - my) ** 2
      if (d < bestDistance) {
        best = i
        bestDistance = d
      }
    }
    setHover(best === -1 ? null : best)
  }

  return (
    <figure ref={figure} className="rounded-lg border border-slate-200 p-4">
      <figcaption className="mb-3 flex items-start justify-between gap-3 text-xs font-medium text-slate-600">
        <span>{title}</span>
        <ChartDownload target={figure} title={title} />
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Scatterplot of ${answer.y} against ${answer.x}, ${points.length} rows. ${answer.summary}`}
          onMouseMove={nearest}
          onMouseLeave={() => setHover(null)}
        >
          {ticksFor(ylo, yhi).map((t) => (
            <g key={`y${t}`}>
              <line x1={PAD.left} x2={W - PAD.right} y1={py(t)} y2={py(t)} className="stroke-slate-100" />
              <text x={PAD.left - 8} y={py(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px]">
                {formatCell(t)}
              </text>
            </g>
          ))}
          {ticksFor(xlo, xhi).map((t) => (
            <text key={`x${t}`} x={px(t)} y={H - 22} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {formatCell(t)}
            </text>
          ))}
          <text x={PAD.left + innerW / 2} y={H - 4} textAnchor="middle" className="fill-slate-600 text-[11px]">
            {answer.x}
          </text>
          <text
            transform={`translate(12 ${PAD.top + innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-slate-600 text-[11px]"
          >
            {answer.y}
          </text>
          {points.map((p, i) => (
            <circle key={i} cx={px(p.x)} cy={py(p.y)} r={3} className="fill-violet-500" opacity={opacity} />
          ))}
          {hover !== null && (
            <circle
              cx={px(points[hover].x)}
              cy={py(points[hover].y)}
              r={5}
              strokeWidth={2}
              className="fill-violet-600 stroke-white"
            />
          )}
        </svg>
        {hover !== null && (
          <div
            className={tooltip}
            style={{
              left: `${(px(points[hover].x) / W) * 100}%`,
              top: `${(py(points[hover].y) / H) * 100}%`,
            }}
          >
            {answer.x}: <span className="tabular-nums">{formatCell(points[hover].x)}</span> · {answer.y}:{' '}
            <span className="tabular-nums">{formatCell(points[hover].y)}</span>
          </div>
        )}
      </div>
    </figure>
  )
}

/** An answer's summary, chart (with figures for a distribution) and notes. */
export function ExploreAnswerBody({ answer }: { answer: ExploreAnswer }) {
  const empty = isEmptyAnswer(answer)
  return (
    <>
      <p className="text-slate-800">{answer.summary}</p>
      {!empty &&
        (answer.kind === 'histogram' ? (
          <>
            <Histogram answer={answer} />
            <dl className="grid grid-cols-3 gap-3 text-sm sm:grid-cols-6">
              {(
                [
                  ['Rows', answer.stats.count],
                  ['Smallest', answer.stats.min],
                  ['Median', answer.stats.median],
                  ['Average', answer.stats.mean],
                  ['Largest', answer.stats.max],
                  ['Middle half', null],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="font-medium tabular-nums text-slate-900">
                    {value === null
                      ? `${formatCell(answer.stats.q1)}–${formatCell(answer.stats.q3)}`
                      : formatCell(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : answer.kind === 'scatter' ? (
          <Scatter answer={answer} />
        ) : (
          <ResultChart
            chart={{ type: answer.kind, x: answer.x, y: answer.y, points: answer.points, notes: [] }}
          />
        ))}
      {answer.notes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-500">
          {answer.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </>
  )
}
