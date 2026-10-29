import { useEffect, useRef, type ReactNode } from 'react'
import { Check, Sparkles, X } from 'lucide-react'
import type { DiagramLink, DiagramSimilarity } from '../../lib/relationships/merge'
import { formatPercent } from '../profile/format'
import { cardinalityLabel, linkConfidence, type Confidence } from './linkStyle'

interface RelationshipListProps {
  links: DiagramLink[]
  similar: DiagramSimilarity[]
  nameOf: (datasetKey: string) => string
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Confirms the relationship, or un-confirms it if it already is. */
  onToggleConfirmed: (item: DiagramLink | DiagramSimilarity) => void
  /** Marks the relationship as not related, or undoes that. */
  onToggleRejected: (item: DiagramLink | DiagramSimilarity) => void
}

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  confirmed: 'Confirmed',
  firm: 'Strong',
  tentative: 'Possible',
  faint: 'Weak',
  rejected: 'Not related',
}

/**
 * The same relationships as the diagram, as text: what links to what, and why we think so. Click
 * to select; double-click, or use the buttons, to confirm or mark as not related.
 */
export function RelationshipList({
  links,
  similar,
  nameOf,
  selectedId,
  onSelect,
  onToggleConfirmed,
  onToggleRejected,
}: RelationshipListProps) {
  const selectedRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must not
    // return anything but a clean-up function.
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  if (links.length === 0 && similar.length === 0) return null

  const item = (
    entry: DiagramLink | DiagramSimilarity,
    heading: ReactNode,
    detail: ReactNode,
    label: string,
  ) => (
    <li
      key={entry.id}
      ref={entry.id === selectedId ? selectedRef : undefined}
      // A double-click starts with two clicks, so clicking only selects.
      onClick={() => onSelect(entry.id)}
      onDoubleClick={(e) => {
        // Don't leave the double-clicked words highlighted.
        window.getSelection()?.removeAllRanges()
        e.preventDefault()
        if (!entry.rejected) onToggleConfirmed(entry)
      }}
      className={`cursor-pointer select-none rounded-lg border px-4 py-3 text-sm transition-colors ${
        entry.id === selectedId
          ? 'border-violet-400 bg-violet-50'
          : entry.confirmed
            ? 'border-violet-200 bg-white hover:border-violet-300'
            : entry.rejected
              ? 'border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {heading}
            <Badge confidence={linkConfidence(entry)} />
          </div>
          {entry.description && (
            <p className="mt-1 flex items-start gap-1.5 text-slate-700">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-label="AI" />
              {entry.description}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1 sm:flex-row">
          {entry.rejected ? (
            <ActionButton
              onClick={() => onToggleRejected(entry)}
              ariaLabel={`Undo not related for ${label}`}
              pressed
              quiet
            >
              Undo
            </ActionButton>
          ) : (
            <>
              <ActionButton
                onClick={() => onToggleConfirmed(entry)}
                ariaLabel={`${entry.confirmed ? 'Unconfirm' : 'Confirm'} ${label}`}
                pressed={entry.confirmed}
                quiet={entry.confirmed}
              >
                {entry.confirmed ? 'Unconfirm' : 'Confirm'}
              </ActionButton>
              {!entry.confirmed && (
                <ActionButton
                  onClick={() => onToggleRejected(entry)}
                  ariaLabel={`Mark ${label} as not related`}
                  quiet
                >
                  Not related
                </ActionButton>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  )

  return (
    <ul className="space-y-2">
      {links.map((l) =>
        item(
          l,
          <>
            <span className="font-medium text-slate-900">
              {nameOf(l.from.dataset)} <span className="text-slate-500">·</span> {l.from.column}
            </span>
            <span className="text-slate-400" aria-hidden>
              →
            </span>
            <span className="font-medium text-slate-900">
              {nameOf(l.to.dataset)} <span className="text-slate-500">·</span> {l.to.column}
            </span>
            {l.cardinality && (
              <span className="text-xs text-slate-500">{cardinalityLabel(l.cardinality)}</span>
            )}
          </>,
          l.evidence
            ? `${l.evidence.sharedCount.toLocaleString('en-US')} shared value${l.evidence.sharedCount === 1 ? '' : 's'}: ` +
                `${formatPercent(l.evidence.fromCoverage)} of ${l.from.column} found in ${l.to.column}, ` +
                `${formatPercent(l.evidence.toCoverage)} the other way` +
                (l.evidence.namesMatch ? ' · names match' : '') +
                (l.evidence.sharedExamples.length > 0
                  ? ` · e.g. ${l.evidence.sharedExamples.slice(0, 3).join(', ')}`
                  : '')
            : l.source === 'ai'
              ? 'Suggested by Claude from what the columns mean; no shared values were found.'
              : 'Confirmed by you. No shared values are found between these columns right now.',
          `the link from ${nameOf(l.from.dataset)} ${l.from.column} to ${nameOf(l.to.dataset)} ${l.to.column}`,
        ),
      )}
      {similar.map((s) =>
        item(
          s,
          <>
            <span className="font-medium text-slate-900">{nameOf(s.datasets[0])}</span>
            <span className="text-slate-400" aria-hidden>
              ↔
            </span>
            <span className="font-medium text-slate-900">{nameOf(s.datasets[1])}</span>
            <span className="text-xs text-slate-500">same columns</span>
          </>,
          `Share ${s.sharedColumns.length} column names (${formatPercent(s.similarity)} of all their columns): ` +
            `${s.sharedColumns.slice(0, 6).join(', ')}${s.sharedColumns.length > 6 ? '…' : ''}`,
          `that ${nameOf(s.datasets[0])} and ${nameOf(s.datasets[1])} share columns`,
        ),
      )}
    </ul>
  )
}

function ActionButton({
  onClick,
  ariaLabel,
  pressed,
  quiet = false,
  children,
}: {
  onClick: () => void
  ariaLabel: string
  pressed?: boolean
  quiet?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        quiet ? 'text-slate-600 hover:bg-slate-100' : 'bg-violet-600 text-white hover:bg-violet-700'
      }`}
    >
      {children}
    </button>
  )
}

function Badge({ confidence }: { confidence: Confidence }) {
  const style =
    confidence === 'confirmed'
      ? 'bg-violet-700 text-white'
      : confidence === 'rejected'
        ? 'bg-slate-200 text-slate-600'
        : confidence === 'firm'
          ? 'bg-violet-100 text-violet-800'
          : confidence === 'tentative'
            ? 'bg-slate-100 text-slate-700'
            : 'bg-slate-50 text-slate-500'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${style}`}
    >
      {confidence === 'confirmed' && <Check className="h-3 w-3" aria-hidden />}
      {confidence === 'rejected' && <X className="h-3 w-3" aria-hidden />}
      {CONFIDENCE_TEXT[confidence]}
    </span>
  )
}
