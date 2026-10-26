import type { ReactNode } from 'react'
import type { ColumnProfile, NumericStats } from '../../lib/profiling'
import { formatNumber, formatPercent, plural } from './format'
import { IdentifierStar } from './IdentifierStar'
import { describeReason, identifierLabel } from './identifierReasons'
import { TypeBadge } from './TypeBadge'
import { TYPE_META } from './typeMeta'

const TOP_VALUES_SHOWN = 3

interface ColumnProfilesProps {
  columns: ColumnProfile[]
  /** Optional extra content for each card, such as the column's confirmed or suggested meaning. */
  renderDefinition?: (column: ColumnProfile) => ReactNode
}

export function ColumnProfiles({ columns, renderDefinition }: ColumnProfilesProps) {
  if (columns.length === 0) return null

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-slate-900">Column profiles</h3>
        {columns.some((c) => c.isPotentialIdentifier) && (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <IdentifierStar className="h-3 w-3" /> Potential identifier
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {columns.map((column) => (
          <ColumnCard key={column.index} column={column} definition={renderDefinition?.(column)} />
        ))}
      </div>
    </section>
  )
}

function ColumnCard({ column, definition }: { column: ColumnProfile; definition?: ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex items-start justify-between gap-2">
        <h4 className="flex min-w-0 items-center gap-1.5 font-medium text-slate-900">
          <span className="truncate" title={column.name}>
            {column.name || <span className="italic text-slate-400">(no name)</span>}
          </span>
          {column.isPotentialIdentifier && <IdentifierStar label={identifierLabel(column)} />}
        </h4>
        <TypeBadge type={column.inferredType} />
      </header>
      {column.isPotentialIdentifier && (
        <p className="-mt-2 text-xs text-slate-500">
          {column.identifierReasons.map(describeReason).join(' · ')}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Metric
          label="Missing"
          value={formatPercent(column.missingRatio)}
          detail={column.missingCount > 0 ? column.missingCount.toLocaleString('en-US') : undefined}
        />
        <Metric
          label="Distinct"
          value={column.distinctCount.toLocaleString('en-US')}
          detail={
            column.nonMissingCount > 0
              ? `${formatPercent(column.uniquenessRatio)} unique`
              : undefined
          }
        />
      </dl>

      <ColumnDetail column={column} />
      {definition}
    </article>
  )
}

function ColumnDetail({ column }: { column: ColumnProfile }) {
  // Averages of ID numbers mean nothing, so identifiers fall through to examples below.
  if (column.numericStats && !column.isPotentialIdentifier) {
    return <NumericDetail stats={column.numericStats} />
  }

  if (column.inferredType === 'empty') {
    return <p className="text-sm text-slate-400">No values</p>
  }

  if (column.topValues && !column.isUnique) {
    return (
      <div className="space-y-2">
        {column.inferredType === 'mixed' && column.dominantKind && (
          <p className="text-xs text-slate-500">
            Mostly {TYPE_META[column.dominantKind].label.toLowerCase()} (
            {column.kindCounts[column.dominantKind].toLocaleString('en-US')} of{' '}
            {plural(column.nonMissingCount, 'value')})
          </p>
        )}
        <p className="text-xs font-medium text-slate-500">Most frequent</p>
        <ul className="space-y-1.5">
          {column.topValues.slice(0, TOP_VALUES_SHOWN).map((v) => (
            <li key={v.value} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate text-slate-700" title={v.value}>
                  {v.value}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {v.count.toLocaleString('en-US')} · {formatPercent(v.ratio)}
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-slate-100">
                <div
                  className="h-1 rounded-full bg-violet-500"
                  style={{ width: `${Math.max(v.ratio * 100, 1)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // Dates, and categorical columns where every value is different, are best shown by example.
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">
        {column.isUnique && column.inferredType !== 'date'
          ? 'Every value is unique, e.g.'
          : 'Examples'}
      </p>
      <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
        {column.sampleValues.slice(0, 3).map((v) => (
          <li key={v} className="truncate" title={v}>
            {v}
          </li>
        ))}
      </ul>
    </div>
  )
}

function NumericDetail({ stats }: { stats: NumericStats }) {
  return (
    <dl className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-sm">
      <Metric label="Min" value={formatNumber(stats.min)} />
      <Metric label="Max" value={formatNumber(stats.max)} />
      <Metric label="Mean" value={formatNumber(stats.mean)} />
      <Metric label="Median" value={formatNumber(stats.median)} />
    </dl>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="truncate tabular-nums text-slate-900" title={value}>
        {value}
        {detail && <span className="ml-1 text-xs text-slate-500">({detail})</span>}
      </dd>
    </div>
  )
}
