import { Check, Sparkles } from 'lucide-react'
import type { FieldSource } from '../../lib/understanding'

/** Says whether a value is an AI suggestion or confirmed by the user. Text and icon, never color alone. */
export function SourceBadge({ source }: { source: FieldSource }) {
  if (source === 'none') return null
  return source === 'suggested' ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-700">
      <Sparkles className="h-3 w-3" aria-hidden /> AI suggestion
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
      <Check className="h-3 w-3" aria-hidden /> Confirmed
    </span>
  )
}
