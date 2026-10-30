import { z } from 'zod'
import { headerWords } from './profiling/identifiers'
import { STORAGE_PREFIX, readStored, writeStored } from './storage'
import { COLUMN_ROLES, type ColumnRole } from './understanding/schema'

/**
 * A workspace's data glossary: terms the user defines once (usually by dragging a column in), whose
 * meaning then applies to every column of that name in the workspace's datasets. A column's own
 * confirmed meaning still wins; the glossary beats AI suggestions. Pure, apart from storage.
 */
export interface GlossaryTerm {
  id: string
  /** The term as written, e.g. `Library ID`. */
  term: string
  description: string
  role: ColumnRole | null
  /** Other names columns use for the same thing, e.g. `LibraryID`, `Branch code`. */
  aliases: string[]
  /** The column it was made from, if it was dragged in. */
  from: { datasetId: string; column: string } | null
  updatedAt: string
}

const GlossarySchema = z.array(
  z.object({
    id: z.string(),
    term: z.string(),
    description: z.string(),
    role: z.enum(COLUMN_ROLES).nullable(),
    aliases: z.array(z.string()),
    from: z.object({ datasetId: z.string(), column: z.string() }).nullable(),
    updatedAt: z.string(),
  }),
)

/** How names are compared: by header words, so `Library ID`, `library_id` and `LibraryID` match. */
export function termKey(name: string): string {
  return headerWords(name).join(' ')
}

/** The term a column name matches, by the term itself or one of its other names; null if none. */
export function findTerm(terms: readonly GlossaryTerm[], columnName: string): GlossaryTerm | null {
  const key = termKey(columnName)
  if (key === '') return null
  return terms.find((t) => [t.term, ...t.aliases].some((n) => termKey(n) === key)) ?? null
}

/**
 * Adds a term made from a column, or, when the column's name already matches a term, returns the
 * list unchanged with that term, so dragging a column in twice never makes duplicates.
 */
export function addColumnTerm(
  terms: readonly GlossaryTerm[],
  column: { datasetId: string; name: string; description: string | null; role: ColumnRole | null },
  id: string,
  now: string,
): { terms: GlossaryTerm[]; term: GlossaryTerm; added: boolean } {
  const existing = findTerm(terms, column.name)
  if (existing) return { terms: [...terms], term: existing, added: false }
  const term: GlossaryTerm = {
    id,
    term: column.name.trim(),
    description: column.description?.trim() ?? '',
    role: column.role,
    aliases: [],
    from: { datasetId: column.datasetId, column: column.name },
    updatedAt: now,
  }
  return { terms: [...terms, term], term, added: true }
}

/** Replaces a term's editable parts, tidying its other names (trimmed, no repeats or blanks). */
export function updateTerm(
  terms: readonly GlossaryTerm[],
  id: string,
  change: Partial<Pick<GlossaryTerm, 'term' | 'description' | 'role' | 'aliases'>>,
  now: string,
): GlossaryTerm[] {
  return terms.map((t) => {
    if (t.id !== id) return t
    const next = { ...t, ...change, updatedAt: now }
    const own = termKey(next.term)
    const seen = new Set<string>([own])
    next.term = next.term.trim() || t.term
    next.aliases = next.aliases
      .map((a) => a.trim())
      .filter((a) => {
        const key = termKey(a)
        if (key === '' || seen.has(key)) return false
        seen.add(key)
        return true
      })
    return next
  })
}

export function removeTerm(terms: readonly GlossaryTerm[], id: string): GlossaryTerm[] {
  return terms.filter((t) => t.id !== id)
}

/** Terms sorted A to Z, for showing. */
export function sortedTerms(terms: readonly GlossaryTerm[]): GlossaryTerm[] {
  return [...terms].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }))
}

const storageKey = (workspaceId: string) => `${STORAGE_PREFIX}:glossary:${workspaceId}`

export function loadGlossary(workspaceId: string): GlossaryTerm[] {
  return readStored(storageKey(workspaceId), GlossarySchema) ?? []
}

export function saveGlossary(workspaceId: string, terms: readonly GlossaryTerm[]): void {
  writeStored(storageKey(workspaceId), terms)
}

export function deleteGlossary(workspaceId: string): void {
  try {
    localStorage.removeItem(storageKey(workspaceId))
  } catch {
    // Storage unavailable: nothing was saved to remove.
  }
}

/** Drag data type for a column being dragged onto the glossary. */
export const COLUMN_DRAG_TYPE = 'application/x-sema-column'

export function columnDragData(datasetId: string, column: string): string {
  return JSON.stringify({ datasetId, column })
}

export function readColumnDrag(data: string): { datasetId: string; column: string } | null {
  try {
    const parsed = z.object({ datasetId: z.string(), column: z.string() }).safeParse(JSON.parse(data))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
