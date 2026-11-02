import { useId, useState } from 'react'
import { COLUMN_ROLES, type ColumnRole, type ResolvedColumn } from '../../lib/understanding'
import { ROLE_LABELS } from './roles'
import { SourceBadge } from './SourceBadge'
import { linkButton, primaryButton, quietButton } from './styles'

interface ColumnDefinitionProps {
  column: ResolvedColumn
  onSave: (update: { description: string; role: ColumnRole }) => void
  onRevert: () => void
  /** Adds this column to the workspace glossary as a new term. */
  onAddToGlossary?: () => void
  /** Opens the glossary page, to edit the term this column follows. */
  onOpenGlossary?: () => void
}

/**
 * A column's meaning and role inside its profile card: suggested, from the workspace glossary, or
 * confirmed for this dataset, and editable.
 */
export function ColumnDefinition({
  column,
  onSave,
  onRevert,
  onAddToGlossary,
  onOpenGlossary,
}: ColumnDefinitionProps) {
  const [draft, setDraft] = useState<{ description: string; role: ColumnRole } | null>(null)
  const descriptionId = useId()
  const roleId = useId()
  const { description, role } = column
  // The card shows one badge: confirmed if anything about the column was confirmed.
  const source =
    description.source === 'confirmed' || role.source === 'confirmed'
      ? 'confirmed'
      : description.source === 'glossary' || role.source === 'glossary'
        ? 'glossary'
        : description.source === 'suggested' || role.source === 'suggested'
          ? 'suggested'
          : 'none'
  const term = column.glossaryTerm
  // Reverting only makes sense when the AI's suggestion would actually change something.
  const suggestionDiffers =
    (description.suggestion !== null && description.suggestion !== description.value) ||
    (role.suggestion !== null && role.suggestion !== role.value)

  if (draft) {
    return (
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <label htmlFor={descriptionId} className="text-xs font-medium text-slate-500">
          Meaning
        </label>
        <textarea
          id={descriptionId}
          rows={2}
          autoFocus
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        <label htmlFor={roleId} className="text-xs font-medium text-slate-500">
          Role
        </label>
        <select
          id={roleId}
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value as ColumnRole })}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        >
          {COLUMN_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {term && (
          <p className="text-xs text-slate-500">
            Saving changes this dataset only. To change “{term.term}” everywhere, edit it in the
            glossary.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => {
              onSave(draft)
              setDraft(null)
            }}
            className={primaryButton}
          >
            Save
          </button>
          <button onClick={() => setDraft(null)} className={quietButton}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-slate-500">Meaning</p>
        <SourceBadge source={source} />
        {role.value && (
          <span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
            {ROLE_LABELS[role.value]}
          </span>
        )}
        {source === 'suggested' && column.confidence === 'low' && (
          <span className="text-xs text-slate-500">Low confidence</span>
        )}
      </div>
      {description.value ? (
        <p className="text-sm text-slate-700">{description.value}</p>
      ) : (
        <p className="text-sm italic text-slate-400">No meaning yet.</p>
      )}
      <div className="flex flex-wrap gap-3 pt-0.5">
        {source === 'suggested' && (
          <button
            onClick={() =>
              onSave({ description: description.value ?? '', role: role.value ?? 'other' })
            }
            className={linkButton}
          >
            Accept
          </button>
        )}
        <button
          onClick={() =>
            setDraft({ description: description.value ?? '', role: role.value ?? 'other' })
          }
          className={linkButton}
        >
          {description.value || role.value ? 'Edit' : 'Add'}
        </button>
        {source === 'confirmed' && term ? (
          <button onClick={onRevert} className={linkButton}>
            Use the glossary meaning
          </button>
        ) : (
          source === 'confirmed' &&
          suggestionDiffers && (
            <button onClick={onRevert} className={linkButton}>
              Revert to suggestion
            </button>
          )
        )}
        {term
          ? onOpenGlossary && (
              <button onClick={onOpenGlossary} className={linkButton}>
                Glossary: {term.term}
              </button>
            )
          : onAddToGlossary && (
              <button onClick={onAddToGlossary} className={linkButton}>
                Add to glossary
              </button>
            )}
      </div>
    </div>
  )
}
