import { useState } from 'react'
import { FileSpreadsheet, X } from 'lucide-react'
import type { Dataset } from '../lib/datasets'
import { formatBytes } from '../lib/parseCsv'
import type { ColumnProfile } from '../lib/profiling'
import { ColumnProfiles } from './profile/ColumnProfiles'
import { formatPercent } from './profile/format'
import { IdentifierStar } from './profile/IdentifierStar'
import { describeReason, identifierLabel } from './profile/identifierReasons'
import { ProfileSummary } from './profile/ProfileSummary'
import { TypeBadge } from './profile/TypeBadge'
import { TYPE_META } from './profile/typeMeta'

const PREVIEW_ROWS = 100
const TOOLTIP_WIDTH = 240

interface CsvPreviewProps {
  data: Dataset
  onRemove: () => void
}

interface HeaderTip {
  column: ColumnProfile
  rect: DOMRect
}

export function CsvPreview({ data, onRemove }: CsvPreviewProps) {
  const shown = data.rows.slice(0, PREVIEW_ROWS)
  const { profile } = data
  const [tip, setTip] = useState<HeaderTip | null>(null)

  function showTip(column: ColumnProfile, target: HTMLElement) {
    setTip({ column, rect: target.getBoundingClientRect() })
  }

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 shrink-0 text-violet-500" />
            <div className="min-w-0">
              <p className="truncate font-medium">{data.fileName}</p>
              <p className="text-sm text-slate-500">
                {data.rows.length.toLocaleString()} rows · {data.columns.length} columns ·{' '}
                {formatBytes(data.fileSize)}
              </p>
            </div>
          </div>
          <button
            onClick={onRemove}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" /> Remove
          </button>
        </div>

        {data.warnings.length > 0 && (
          <details className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <summary className="cursor-pointer">
              {data.warnings.length} row{data.warnings.length === 1 ? '' : 's'} had parsing issues
            </summary>
            <ul className="mt-2 list-disc pl-5">
              {data.warnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}

        <ProfileSummary profile={profile} />
      </div>

      <ColumnProfiles columns={profile.columns} />

      <div>
        <h3 className="mb-3 font-medium text-slate-900">Data preview</h3>
        <div
          className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white"
          onScroll={() => setTip(null)}
        >
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                {profile.columns.map((column) => (
                  <th
                    key={column.index}
                    tabIndex={0}
                    aria-describedby={tip?.column === column ? 'header-tip' : undefined}
                    onMouseEnter={(e) => showTip(column, e.currentTarget)}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(e) => showTip(column, e.currentTarget)}
                    onBlur={() => setTip(null)}
                    className="cursor-default whitespace-nowrap px-4 py-2 font-semibold hover:bg-slate-200 focus:bg-slate-200 focus:outline-none"
                  >
                    <span className="flex items-center gap-1.5">
                      {column.name}
                      {column.isPotentialIdentifier && (
                        <IdentifierStar label={identifierLabel(column)} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50">
                  {data.columns.map((col) => (
                    <td key={col} className="whitespace-nowrap px-4 py-2">
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.rows.length > PREVIEW_ROWS && (
          <p className="mt-2 text-sm text-slate-500">
            Showing the first {PREVIEW_ROWS} of {data.rows.length.toLocaleString()} rows.
          </p>
        )}
      </div>

      {tip && <HeaderTooltip {...tip} />}
    </section>
  )
}

function HeaderTooltip({ column, rect }: HeaderTip) {
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - TOOLTIP_WIDTH - 8))

  return (
    <div
      id="header-tip"
      role="tooltip"
      style={{ top: rect.bottom + 6, left, width: TOOLTIP_WIDTH }}
      className="pointer-events-none fixed z-50 space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg"
    >
      <div className="flex items-center gap-2">
        <TypeBadge type={column.inferredType} />
        <span className="text-xs text-slate-500">{TYPE_META[column.inferredType].description}</span>
      </div>
      {column.isPotentialIdentifier && (
        <div className="text-xs text-slate-700">
          <p className="flex items-center gap-1.5 font-medium">
            <IdentifierStar className="h-3 w-3" /> Potential identifier
          </p>
          <ul className="mt-0.5 list-disc pl-8 text-slate-600">
            {column.identifierReasons.map((reason) => (
              <li key={reason.kind}>{describeReason(reason)}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-500">
        {formatPercent(column.missingRatio)} missing ·{' '}
        {column.distinctCount.toLocaleString('en-US')} distinct
      </p>
    </div>
  )
}
