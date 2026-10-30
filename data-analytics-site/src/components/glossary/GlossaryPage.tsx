import { useId, useState, type FormEvent } from 'react'
import { BookOpen, Plus, Search } from 'lucide-react'
import {
  COLUMN_DRAG_TYPE,
  findTerm,
  readColumnDrag,
  sortedTerms,
  type GlossaryTerm,
} from '../../lib/glossary'
import { COLUMN_ROLES, type ColumnRole } from '../../lib/understanding'
import { ROLE_LABELS } from '../understanding/roles'
import { linkButton, primaryButton, quietButton } from '../understanding/styles'

/** A column of an open dataset, for showing where each term applies. */
export interface GlossaryColumn {
  datasetName: string
  column: string
  /** The user confirmed their own meaning for this column, which wins over the glossary. */
  overridden: boolean
}

type TermChange = Partial<Pick<GlossaryTerm, 'term' | 'description' | 'role' | 'aliases'>>

interface GlossaryPageProps {
  terms: GlossaryTerm[]
  columns: GlossaryColumn[]
  onAdd: (term: { term: string; description: string; role: ColumnRole | null }) => void
  onUpdate: (id: string, change: TermChange) => void
  onRemove: (id: string) => void
  onDropColumn: (column: { datasetId: string; column: string }) => void
}

/**
 * The workspace's data glossary: terms whose meaning applies to every column of that name in the
 * workspace's datasets (unless a column has its own confirmed meaning), and which Claude is told.
 */
export function GlossaryPage({
  terms,
  columns,
  onAdd,
  onUpdate,
  onRemove,
  onDropColumn,
}: GlossaryPageProps) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [over, setOver] = useState(false)
  const q = query.trim().toLowerCase()
  const shown = sortedTerms(terms).filter(
    (t) =>
      q === '' ||
      [t.term, t.description, ...t.aliases].some((text) => text.toLowerCase().includes(q)),
  )

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false)
          const column = readColumnDrag(e.dataTransfer.getData(COLUMN_DRAG_TYPE))
          if (!column) return
          e.preventDefault()
          onDropColumn(column)
        }}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed px-5 py-4 text-sm ${
          over ? 'border-sky-400 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-600'
        }`}
      >
        <p className="flex min-w-0 flex-1 items-center gap-2">
          <BookOpen className="h-5 w-5 shrink-0 text-sky-600" aria-hidden />
          {over
            ? 'Drop to add this column as a term.'
            : 'Drag a column here from a dataset’s page (or onto “Glossary” in the menu), use “Add to glossary” on a column, or add a term by hand.'}
        </p>
        {!adding && (
          <button onClick={() => setAdding(true)} className={`${primaryButton} inline-flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" aria-hidden /> Add a term
          </button>
        )}
      </div>

      {adding && (
        <TermForm
          submitLabel="Add term"
          initial={{ term: '', description: '', role: null, aliases: [] }}
          onSubmit={(t) => {
            onAdd(t)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {terms.length > 0 && (
        <label className="relative block max-w-sm">
          <span className="sr-only">Search the glossary</span>
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms"
            className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
          />
        </label>
      )}

      {terms.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          No terms yet. A term’s meaning is used for every column with that name in this
          workspace, in place of Claude’s suggestion, and Claude is told it too.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500">No terms match “{query}”.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => (
            <TermCard
              key={t.id}
              term={t}
              usedIn={columns.filter((c) => findTerm([t], c.column) !== null)}
              onUpdate={(change) => onUpdate(t.id, change)}
              onRemove={() => onRemove(t.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function TermCard({
  term,
  usedIn,
  onUpdate,
  onRemove,
}: {
  term: GlossaryTerm
  usedIn: GlossaryColumn[]
  onUpdate: (change: TermChange) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (editing) {
    return (
      <li>
        <TermForm
          submitLabel="Save"
          initial={term}
          onSubmit={(change) => {
            onUpdate(change)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="space-y-1.5 rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-slate-900">{term.term}</h3>
        {term.role && (
          <span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
            {ROLE_LABELS[term.role]}
          </span>
        )}
        {term.aliases.length > 0 && (
          <span className="text-xs text-slate-500">also called {term.aliases.join(', ')}</span>
        )}
      </div>
      {term.description ? (
        <p className="text-sm text-slate-700">{term.description}</p>
      ) : (
        <p className="text-sm text-slate-400 italic">No meaning yet.</p>
      )}
      <p className="text-xs text-slate-500">
        {usedIn.length === 0
          ? 'No open dataset has a column with this name.'
          : `Used for ${usedIn
              .map((c) => `${c.datasetName} · ${c.column}${c.overridden ? ' (has its own meaning)' : ''}`)
              .join(', ')}`}
      </p>
      <div className="flex flex-wrap gap-3 pt-0.5">
        <button onClick={() => setEditing(true)} className={linkButton}>
          Edit
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-xs text-slate-600">
            Delete “{term.term}”? Columns go back to their own or Claude’s meaning.
            <button onClick={onRemove} className="font-medium text-red-700 hover:underline">
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className={linkButton}>
              Cancel
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-xs font-medium text-red-700 hover:underline">
            Delete
          </button>
        )}
      </div>
    </li>
  )
}

function TermForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Pick<GlossaryTerm, 'term' | 'description' | 'role' | 'aliases'>
  submitLabel: string
  onSubmit: (t: { term: string; description: string; role: ColumnRole | null; aliases: string[] }) => void
  onCancel: () => void
}) {
  const [term, setTerm] = useState(initial.term)
  const [description, setDescription] = useState(initial.description)
  const [role, setRole] = useState<ColumnRole | ''>(initial.role ?? '')
  const [aliases, setAliases] = useState(initial.aliases.join(', '))
  const id = useId()
  const field =
    'mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!term.trim()) return
    onSubmit({
      term: term.trim(),
      description: description.trim(),
      role: role || null,
      aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
    })
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="space-y-3 rounded-xl border border-violet-200 bg-white px-5 py-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600" htmlFor={`${id}-term`}>
          Term
          <input
            id={`${id}-term`}
            autoFocus
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Library ID"
            className={field}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600" htmlFor={`${id}-role`}>
          Role
          <select
            id={`${id}-role`}
            value={role}
            onChange={(e) => setRole(e.target.value as ColumnRole | '')}
            className={field}
          >
            <option value="">No role</option>
            {COLUMN_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-600" htmlFor={`${id}-description`}>
        Meaning
        <textarea
          id={`${id}-description`}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this means in your data"
          className={field}
        />
      </label>
      <label className="block text-xs font-medium text-slate-600" htmlFor={`${id}-aliases`}>
        Also called (optional, separated by commas)
        <input
          id={`${id}-aliases`}
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="e.g. LibraryID, Branch code"
          className={field}
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className={primaryButton}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={quietButton}>
          Cancel
        </button>
      </div>
    </form>
  )
}
