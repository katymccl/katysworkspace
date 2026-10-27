import { useState, type ReactNode } from 'react'
import { BrushCleaning, Download, FileSpreadsheet, Sparkles, X } from 'lucide-react'
import type { Dataset } from '../lib/datasets'
import { toCsvText } from '../lib/generate/client'
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
  /** Display name; defaults to the file name, which is always shown as well. */
  title?: string
  /** Shown above the profile, e.g. the dataset understanding panel. */
  about?: ReactNode
  /** Extra content for each column card, e.g. the column's meaning. */
  renderDefinition?: (column: ColumnProfile) => ReactNode
  onRemove: () => void
  /** Opens the generator with this dataset as the base. */
  onGenerateRelated?: () => void
  /** Removes (true) or restores (false) a column's potential identifier flag. */
  onIdentifierDismissed?: (columnName: string, dismissed: boolean) => void
  /** Opens "Prepare my data"; the panel itself is passed as `cleanPanel` while it's open. */
  onClean?: () => void
  cleanPanel?: ReactNode
}

interface HeaderTip {
  column: ColumnProfile
  rect: DOMRect
}

export function CsvPreview({
  data,
  title,
  about,
  renderDefinition,
  onRemove,
  onGenerateRelated,
  onIdentifierDismissed,
  onClean,
  cleanPanel,
}: CsvPreviewProps) {
  const shown = data.rows.slice(0, PREVIEW_ROWS)
  const { profile } = data
  const [tip, setTip] = useState<HeaderTip | null>(null)

  function showTip(column: ColumnProfile, target: HTMLElement) {
    setTip({ column, rect: target.getBoundingClientRect() })
  }

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {data.generatedBy ? (
              <Sparkles className="h-6 w-6 shrink-0 text-violet-500" aria-hidden />
            ) : (
              <FileSpreadsheet className="h-6 w-6 shrink-0 text-violet-500" aria-hidden />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{title ?? data.fileName}</p>
                {data.generatedBy && (
                  <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                    AI-generated sample
                  </span>
                )}
                {data.cleanedAt && (
                  <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                    Prepared
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {title && title !== data.fileName && `${data.fileName} · `}
                {data.rows.length.toLocaleString()} rows · {data.columns.length} columns ·{' '}
                {formatBytes(data.fileSize)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {onClean && !cleanPanel && (
              <button
                onClick={onClean}
                className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                <BrushCleaning className="h-4 w-4" aria-hidden /> Prepare my data
              </button>
            )}
            {onGenerateRelated && (
              <button
                onClick={onGenerateRelated}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-50"
              >
                <Sparkles className="h-4 w-4" /> Generate related dataset
              </button>
            )}
            {(data.generatedBy || data.cleanedAt) && (
              <button
                onClick={() => downloadCsv(data)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                <Download className="h-4 w-4" /> Download CSV
              </button>
            )}
            <button
              onClick={onRemove}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" /> Remove
            </button>
          </div>
          {data.cleanedAt && !data.generatedBy && (
            <p className="w-full text-xs text-slate-500">
              This prepared version lives in this browser only; your original file hasn’t changed.
              Download it to keep it.
            </p>
          )}
          {data.generatedBy && (
            <p className="w-full text-xs text-slate-500">
              Fictional data made up by Claude for exploring sema; it doesn’t describe anything
              real.
              {data.generatedBy.notes && ` ${data.generatedBy.notes}`}
            </p>
          )}
          {data.generatedBy?.basedOn && (
            <div className="w-full text-xs text-slate-600">
              <p>
                Made to go with <span className="font-medium">{data.generatedBy.basedOn.name}</span>
                .
                {data.generatedBy.basedOn.linkChecks.length === 0 &&
                  ' Claude reported no columns that reuse its values.'}
              </p>
              {data.generatedBy.basedOn.linkChecks.length > 0 && (
                <ul className="mt-0.5 space-y-0.5">
                  {data.generatedBy.basedOn.linkChecks.map((check) => (
                    <li key={`${check.column}:${check.baseColumn}`}>
                      <span className="font-medium">{check.column}</span> matches{' '}
                      <span className="font-medium">{check.baseColumn}</span> for {check.matched} of{' '}
                      {check.total} value{check.total === 1 ? '' : 's'}
                      {check.total > 0 && check.matched < check.total && (
                        <span className="text-amber-700">
                          {' '}
                          (some values don’t appear in the base)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {cleanPanel}

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

        {about}

        <ProfileSummary profile={profile} />
      </div>

      <ColumnProfiles
        columns={profile.columns}
        renderDefinition={renderDefinition}
        onIdentifierDismissed={onIdentifierDismissed}
      />

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

/** Saves a generated dataset as a CSV file, escaped so spreadsheet apps can't run formulas. */
function downloadCsv(data: Dataset) {
  const rows = data.rows.map((row) => data.columns.map((c) => row[c] ?? ''))
  const csv = toCsvText(data.columns, rows, { forSpreadsheet: true })
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = data.fileName
  link.click()
  URL.revokeObjectURL(url)
}
