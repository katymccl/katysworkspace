import type { ReactNode } from 'react'
import type { DatasetProfile } from '../../lib/profiling'
import { formatPercent, plural } from './format'
import { IdentifierStar } from './IdentifierStar'
import { TYPE_META, TYPE_ORDER } from './typeMeta'

export function ProfileSummary({ profile }: { profile: DatasetProfile }) {
  const { rowCount, columnCount, malformedRowCount, columns } = profile

  const totalCells = rowCount * columnCount
  const missingCells = columns.reduce((sum, c) => sum + c.missingCount, 0)
  const columnsWithMissing = columns.filter((c) => c.missingCount > 0).length
  const identifiers = columns.filter((c) => c.isPotentialIdentifier).map((c) => c.name)
  const typeBreakdown = TYPE_ORDER.map((type) => ({
    type,
    count: columns.filter((c) => c.inferredType === type).length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ type, count }) => `${count} ${TYPE_META[type].label.toLowerCase()}`)
    .join(' · ')

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatBox
        label="Rows"
        value={rowCount.toLocaleString('en-US')}
        detail={
          malformedRowCount > 0 ? (
            <span className="text-amber-700">{plural(malformedRowCount, 'malformed row')}</span>
          ) : (
            'All rows match the header'
          )
        }
      />
      <StatBox
        label="Columns"
        value={columnCount.toLocaleString('en-US')}
        detail={typeBreakdown || 'No columns'}
      />
      <StatBox
        label="Missing values"
        value={formatPercent(totalCells === 0 ? 0 : missingCells / totalCells)}
        detail={
          missingCells === 0
            ? 'No missing values'
            : `${plural(missingCells, 'cell')} in ${plural(columnsWithMissing, 'column')}`
        }
      />
      <StatBox
        label="Potential identifiers"
        value={
          <span className="flex items-center gap-2">
            {identifiers.length}
            {identifiers.length > 0 && <IdentifierStar className="h-5 w-5" />}
          </span>
        }
        detail={identifiers.length > 0 ? identifiers.join(', ') : 'None found'}
      />
    </div>
  )
}

function StatBox({ label, value, detail }: { label: string; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p
        className="mt-1 line-clamp-2 text-xs text-slate-500"
        title={typeof detail === 'string' ? detail : undefined}
      >
        {detail}
      </p>
    </div>
  )
}
