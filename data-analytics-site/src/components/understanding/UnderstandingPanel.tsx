import { useState } from 'react'
import { AlertCircle, Loader2, RotateCw, Sparkles } from 'lucide-react'
import type { InterpretationState } from '../../hooks/useUnderstanding'
import {
  countConfirmed,
  countPendingSuggestions,
  type DatasetField,
  type ResolvedUnderstanding,
} from '../../lib/understanding'
import { plural } from '../profile/format'
import { EditableField } from './EditableField'
import { primaryButton, quietButton } from './styles'

interface UnderstandingPanelProps {
  resolved: ResolvedUnderstanding
  state: InterpretationState
  onInterpret: () => void
  onSaveField: (field: DatasetField, value: string) => void
  onRevertField: (field: DatasetField) => void
  /** Confirms every displayed AI suggestion, at dataset and column level. */
  onAcceptAll: () => void
  /** Clears every confirmed definition for this dataset. */
  onResetAll: () => void
}

const ERROR_HINTS: Partial<Record<string, string>> = {
  not_configured: 'Add ANTHROPIC_API_KEY to the server settings to turn it on (see .env.example).',
  rate_limited: 'Wait a minute, then try again.',
}

/** "About this dataset": the AI-suggested or confirmed name, description and row meaning. */
export function UnderstandingPanel({
  resolved,
  state,
  onInterpret,
  onSaveField,
  onRevertField,
  onAcceptAll,
  onResetAll,
}: UnderstandingPanelProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const loading = state.status === 'loading'
  const hasSuggestion = state.suggestion !== null
  const pending = countPendingSuggestions(resolved)
  const confirmedCount = countConfirmed(resolved)

  return (
    <section
      aria-labelledby="about-dataset"
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="about-dataset" className="font-medium text-slate-900">
            About this dataset
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {hasSuggestion
              ? `Suggested by Claude on ${formatDate(state.suggestion!.generatedAt)}. Edit anything that isn’t right.`
              : 'Let Claude suggest a name, description and column meanings, or write your own.'}
          </p>
        </div>
        <button
          onClick={onInterpret}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : hasSuggestion ? (
            <RotateCw className="h-4 w-4" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {loading ? 'Interpreting…' : hasSuggestion ? 'Re-run AI' : 'Interpret with AI'}
        </button>
        <p className="w-full text-xs text-slate-400">
          Interpreting sends column names, statistics and a few sample values to Claude. The file
          itself stays in your browser.
        </p>
      </div>

      {state.status === 'error' && state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1">
            <p>
              {state.error.message} {ERROR_HINTS[state.error.code] ?? ''}
            </p>
            <p className="mt-0.5 text-xs text-red-600">
              The profile below doesn’t depend on AI and is still accurate.
            </p>
          </div>
          {state.error.code !== 'not_configured' && (
            <button onClick={onInterpret} className={`${quietButton} -my-1 text-red-700`}>
              Try again
            </button>
          )}
        </div>
      )}

      {(pending > 0 || confirmedCount > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          {confirmingReset ? (
            <>
              <p className="text-slate-700">
                Clear {plural(confirmedCount, 'confirmed value')}? Each goes back to Claude’s
                suggestion, or to empty if there isn’t one.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onResetAll()
                    setConfirmingReset(false)
                  }}
                  autoFocus
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  Reset all
                </button>
                <button onClick={() => setConfirmingReset(false)} className={quietButton}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-600">
                {pending > 0
                  ? `${plural(pending, 'AI suggestion')} not yet confirmed`
                  : 'Everything shown is confirmed'}
                {confirmedCount > 0 && ` · ${confirmedCount} confirmed`}
              </p>
              <div className="flex gap-2">
                {pending > 0 && (
                  <button onClick={onAcceptAll} className={primaryButton}>
                    Accept all
                  </button>
                )}
                {confirmedCount > 0 && (
                  <button onClick={() => setConfirmingReset(true)} className={quietButton}>
                    Reset all
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <EditableField
            label="Name"
            field={resolved.name}
            placeholder=""
            valueClassName="text-lg font-semibold text-slate-900"
            onSave={(v) => onSaveField('name', v)}
            onRevert={() => onRevertField('name')}
          />
          <p className="mt-1 text-xs text-slate-500">Original file: {resolved.fileName}</p>
        </div>
        <EditableField
          label="Description"
          field={resolved.description}
          placeholder="No description yet."
          multiline
          onSave={(v) => onSaveField('description', v)}
          onRevert={() => onRevertField('description')}
        />
        <EditableField
          label="What one row represents"
          field={resolved.rowMeaning}
          placeholder="Not described yet."
          multiline
          onSave={(v) => onSaveField('rowMeaning', v)}
          onRevert={() => onRevertField('rowMeaning')}
        />
        {resolved.rowKeyColumns.length > 0 && (
          <p className="text-xs text-slate-500">
            Columns that together identify a row (AI suggestion):{' '}
            <span className="text-slate-700">{resolved.rowKeyColumns.join(', ')}</span>
          </p>
        )}
      </div>

      {resolved.questions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h4 className="text-sm font-medium text-amber-900">Questions Claude couldn’t settle</h4>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-900">
            {resolved.questions.map((q, i) => (
              <li key={i}>
                {q.question}
                {q.columns.length > 0 && (
                  <span className="ml-1 text-xs text-amber-800">({q.columns.join(', ')})</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            Answer them by editing the descriptions above or the column meanings below.
          </p>
        </div>
      )}
    </section>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? 'an earlier date'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
