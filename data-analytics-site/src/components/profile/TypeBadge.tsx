import type { InferredType } from '../../lib/profiling'
import { TYPE_META } from './typeMeta'

export function TypeBadge({ type }: { type: InferredType }) {
  const { label, Icon } = TYPE_META[type]
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
