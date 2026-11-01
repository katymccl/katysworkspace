import { useId, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, PencilLine, Trash2 } from 'lucide-react'
import type { GlossaryTerm } from '../../lib/glossary'
import { glossaryNameFor } from '../../lib/clean/rename'
import { linkButton } from '../understanding/styles'

interface ColumnNamesProps {
  /** The columns as they'll be after any splits, which can be renamed or removed. */
  columns: readonly string[]
  renames: Record<string, string>
  removed: readonly string[]
  problems: Record<string, string>
  glossary: readonly GlossaryTerm[]
  onRename: (renames: Record<string, string>) => void
  onRemove: (removed: string[]) => void
}

/**
 * "Rename or remove columns": a new name for any column (the glossary's terms are offered for names
 * that look like short forms of them), or leave it out of the new version. Meanings, links, charts
 * and the rest follow renamed columns.
 */
export function ColumnNames({ columns, renames, removed, problems, glossary, onRename, onRemove }: ColumnNamesProps) {
  const gone = new Set(removed)
  const isRenamed = (c: string) => !gone.has(c) && renames[c] !== undefined && renames[c].trim() !== c
  const renamedCount = columns.filter(isRenamed).length
  const removedCount = columns.filter((c) => gone.has(c)).length
  const suggestions = columns
    .filter((c) => !gone.has(c) && renames[c] === undefined)
    .map((c) => ({ column: c, term: glossaryNameFor(c, glossary) }))
    .filter((s): s is { column: string; term: string } => s.term !== null)
  const [open, setOpen] = useState(renamedCount + removedCount > 0)
  const id = useId()

  const rename = (column: string, to: string | undefined) => {
    const next = { ...renames }
    if (to === undefined || to === column) delete next[column]
    else next[column] = to
    onRename(next)
  }
  const toggleRemoved = (column: string) =>
    onRemove(gone.has(column) ? removed.filter((c) => c !== column) : [...removed, column])

  const counts = [renamedCount > 0 && `${renamedCount} renamed`, removedCount > 0 && `${removedCount} removed`]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-800"
      >
        {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
        <PencilLine className="h-4 w-4 text-violet-500" aria-hidden />
        Rename or remove columns
        {counts && <span className="text-xs font-normal text-slate-500">({counts})</span>}
        {!open && suggestions.length > 0 && (
          <span className="text-xs font-normal text-sky-700">
            · {suggestions.length} glossary name{suggestions.length === 1 ? '' : 's'} to use
          </span>
        )}
      </button>

      {open && (
        <div id={id} className="space-y-3 pl-6">
          <p className="text-xs text-slate-500">
            Give columns clearer names, or remove ones you don’t need. Meanings, relationships, saved
            charts and order follow renamed columns. Your original file isn’t changed.
          </p>
          {problems['*'] && <p className="text-xs text-red-700">{problems['*']}</p>}
          {suggestions.length > 1 && (
            <button
              type="button"
              onClick={() => onRename({ ...renames, ...Object.fromEntries(suggestions.map((s) => [s.column, s.term])) })}
              className={`${linkButton} inline-flex items-center gap-1 text-sky-700`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Use all {suggestions.length} glossary names
            </button>
          )}
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {columns.map((c) => {
              const removing = gone.has(c)
              const problem = removing ? undefined : problems[c]
              const term = removing ? null : glossaryNameFor(c, glossary)
              const edited = isRenamed(c)
              return (
                <li key={c} className="space-y-1">
                  <label className="block text-xs text-slate-500" htmlFor={`${id}-${c}`}>
                    {c}
                    {edited && <span className="text-violet-700"> → new name</span>}
                  </label>
                  {removing ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-red-300 bg-red-50/60 px-2 py-1 text-sm">
                      <span className="min-w-0 flex-1 truncate text-slate-500 line-through">{c}</span>
                      <span className="text-xs text-red-700">Will be removed</span>
                      <button type="button" onClick={() => toggleRemoved(c)} className={linkButton}>
                        Undo
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        id={`${id}-${c}`}
                        value={renames[c] ?? c}
                        onChange={(e) => rename(c, e.target.value)}
                        aria-invalid={problem ? true : undefined}
                        aria-describedby={problem ? `${id}-${c}-problem` : undefined}
                        className={`min-w-0 flex-1 rounded-md border px-2 py-1 text-sm focus:ring-2 focus:outline-none ${
                          problem
                            ? 'border-red-400 focus:ring-red-200'
                            : edited
                              ? 'border-violet-400 bg-violet-50/50 focus:ring-violet-200'
                              : 'border-slate-300 focus:border-violet-500 focus:ring-violet-200'
                        }`}
                      />
                      {edited && (
                        <button type="button" onClick={() => rename(c, undefined)} className={linkButton}>
                          Undo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleRemoved(c)}
                        aria-label={`Remove the column ${c}`}
                        title="Remove this column"
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                  {problem && (
                    <p id={`${id}-${c}-problem`} className="text-xs text-red-700">
                      {problem}
                    </p>
                  )}
                  {term && !edited && (
                    <button
                      type="button"
                      onClick={() => rename(c, term)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
                    >
                      <BookOpen className="h-3 w-3" aria-hidden />
                      Use the glossary name “{term}”
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
