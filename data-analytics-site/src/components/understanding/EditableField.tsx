import { useId, useState } from 'react'
import type { ResolvedField } from '../../lib/understanding'
import { SourceBadge } from './SourceBadge'
import { linkButton, primaryButton, quietButton } from './styles'

interface EditableFieldProps {
  label: string
  field: ResolvedField<string>
  /** Shown when there is neither a suggestion nor a confirmed value. */
  placeholder: string
  multiline?: boolean
  /** Extra classes for the displayed value, e.g. a larger heading size. */
  valueClassName?: string
  onSave: (value: string) => void
  onRevert: () => void
}

/**
 * A dataset-level definition: shows the confirmed value or the AI suggestion with a badge saying
 * which, and lets the user accept, edit or revert it.
 */
export function EditableField({
  label,
  field,
  placeholder,
  multiline = false,
  valueClassName = 'text-slate-800',
  onSave,
  onRevert,
}: EditableFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const inputId = useId()

  if (draft !== null) {
    const save = () => {
      onSave(draft)
      setDraft(null)
    }
    const inputProps = {
      id: inputId,
      value: draft,
      autoFocus: true,
      onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') setDraft(null)
        if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          save()
        }
      },
      className:
        'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200',
    }
    return (
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-xs font-medium text-slate-500">
          {label}
        </label>
        {multiline ? <textarea rows={3} {...inputProps} /> : <input {...inputProps} />}
        <div className="flex gap-2">
          <button onClick={save} className={primaryButton}>
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
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <SourceBadge source={field.source} />
      </div>
      {field.value !== null ? (
        <p className={valueClassName}>{field.value}</p>
      ) : (
        <p className="text-sm italic text-slate-400">{placeholder}</p>
      )}
      <div className="flex flex-wrap gap-3 pt-0.5">
        {field.source === 'suggested' && (
          <button onClick={() => onSave(field.value!)} className={linkButton}>
            Accept
          </button>
        )}
        <button onClick={() => setDraft(field.value ?? '')} className={linkButton}>
          {field.value === null ? 'Add' : 'Edit'}
        </button>
        {field.source === 'confirmed' &&
          field.suggestion !== null &&
          field.suggestion !== field.value && (
            <button onClick={onRevert} className={linkButton}>
              Revert to suggestion
            </button>
          )}
      </div>
    </div>
  )
}
