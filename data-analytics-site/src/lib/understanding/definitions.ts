import { findTerm, type GlossaryTerm } from '../glossary'
import type { ColumnRole, Confidence, DatasetUnderstanding } from './schema'

/** An AI suggestion as stored: the model output plus where and when it came from. */
export interface StoredSuggestion {
  understanding: DatasetUnderstanding
  model: string
  generatedAt: string
}

/**
 * Definitions the user has confirmed or written. Kept apart from AI suggestions and never written
 * by the AI, so re-running interpretation can't overwrite them. Every field is optional: absent
 * means "not confirmed", not "empty".
 */
export interface ConfirmedDefinitions {
  name?: string
  description?: string
  rowMeaning?: string
  columns: Record<string, { description?: string; role?: ColumnRole }>
}

export const EMPTY_CONFIRMED: ConfirmedDefinitions = { columns: {} }

/** Where a displayed value came from. */
export type FieldSource = 'confirmed' | 'glossary' | 'suggested' | 'none'

export interface ResolvedField<T> {
  /** What to display: confirmed, else suggested, else null. */
  value: T | null
  source: FieldSource
  /**
   * The current AI suggestion, whether or not it is displayed. Confirmed values are sent with each
   * AI run as settled facts, so a confirmed field's suggestion normally matches it; any real
   * conflict comes back as one of the AI's questions instead.
   */
  suggestion: T | null
}

export interface ResolvedColumn {
  name: string
  description: ResolvedField<string>
  role: ResolvedField<ColumnRole>
  /** The AI's confidence in its own suggestion for this column, if any. */
  confidence: Confidence | null
  /** The workspace glossary term the column's name matches, if any. */
  glossaryTerm: GlossaryTerm | null
}

export interface ResolvedUnderstanding {
  /** Display name; when nothing is suggested or confirmed it falls back to the file name. */
  name: ResolvedField<string>
  fileName: string
  description: ResolvedField<string>
  rowMeaning: ResolvedField<string>
  columns: ResolvedColumn[]
  rowKeyColumns: string[]
  questions: DatasetUnderstanding['questions']
}

function resolve<T>(
  confirmed: T | undefined,
  suggestion: T | undefined,
  glossary?: T,
): ResolvedField<T> {
  const s = suggestion ?? null
  if (confirmed !== undefined) return { value: confirmed, source: 'confirmed', suggestion: s }
  if (glossary !== undefined) return { value: glossary, source: 'glossary', suggestion: s }
  return { value: s, source: s === null ? 'none' : 'suggested', suggestion: s }
}

/**
 * Combines AI suggestions, the workspace glossary and confirmed definitions. For each value:
 * confirmed for this dataset, else the glossary term the column's name matches, else the AI's
 * suggestion. Pure.
 */
export function resolveUnderstanding(
  fileName: string,
  columnNames: readonly string[],
  suggestion: DatasetUnderstanding | null,
  confirmed: ConfirmedDefinitions,
  glossary: readonly GlossaryTerm[] = [],
): ResolvedUnderstanding {
  const suggestedColumns = new Map(suggestion?.columns.map((c) => [c.name, c]) ?? [])
  const name = resolve(confirmed.name, suggestion?.suggestedName)

  return {
    name: name.value === null ? { ...name, value: fileName } : name,
    fileName,
    description: resolve(confirmed.description, suggestion?.description),
    rowMeaning: resolve(confirmed.rowMeaning, suggestion?.rowMeaning),
    columns: columnNames.map((columnName) => {
      const s = suggestedColumns.get(columnName)
      const c = confirmed.columns[columnName]
      const g = findTerm(glossary, columnName)
      return {
        name: columnName,
        // An empty glossary description leaves the column's own suggestion showing.
        description: resolve(c?.description, s?.description, g?.description || undefined),
        role: resolve(c?.role, s?.role, g?.role ?? undefined),
        confidence: s?.confidence ?? null,
        glossaryTerm: g,
      }
    }),
    rowKeyColumns: suggestion?.rowKeyColumns ?? [],
    questions: suggestion?.questions ?? [],
  }
}

export type DatasetField = 'name' | 'description' | 'rowMeaning'

/** Returns new definitions with a dataset-level field confirmed (empty text clears it). */
export function confirmDatasetField(
  defs: ConfirmedDefinitions,
  field: DatasetField,
  value: string,
): ConfirmedDefinitions {
  const next = { ...defs }
  const trimmed = value.trim()
  if (trimmed) next[field] = trimmed
  else delete next[field]
  return next
}

/** Returns new definitions without the confirmed value, so the AI suggestion shows again. */
export function revertDatasetField(
  defs: ConfirmedDefinitions,
  field: DatasetField,
): ConfirmedDefinitions {
  const next = { ...defs }
  delete next[field]
  return next
}

/** Returns new definitions with a column's description and/or role confirmed. */
export function confirmColumn(
  defs: ConfirmedDefinitions,
  column: string,
  update: { description?: string; role?: ColumnRole },
): ConfirmedDefinitions {
  const current = { ...defs.columns[column] }
  if (update.description !== undefined) {
    const trimmed = update.description.trim()
    if (trimmed) current.description = trimmed
    else delete current.description
  }
  if (update.role !== undefined) current.role = update.role
  return { ...defs, columns: { ...defs.columns, [column]: current } }
}

/** Returns new definitions without any confirmed values for the column. */
export function revertColumn(defs: ConfirmedDefinitions, column: string): ConfirmedDefinitions {
  const columns = { ...defs.columns }
  delete columns[column]
  return { ...defs, columns }
}

const DATASET_FIELDS: readonly DatasetField[] = ['name', 'description', 'rowMeaning']

/**
 * How many displayed items are still unconfirmed AI suggestions: each dataset field, plus each
 * column with a suggested meaning or role (a column counts once, as it shows one badge).
 */
export function countPendingSuggestions(resolved: ResolvedUnderstanding): number {
  return countItems(resolved, 'suggested')
}

function countItems(resolved: ResolvedUnderstanding, source: FieldSource): number {
  const datasetFields = DATASET_FIELDS.filter((f) => resolved[f].source === source).length
  const columns = resolved.columns.filter(
    (c) => c.description.source === source || c.role.source === source,
  ).length
  return datasetFields + columns
}

/**
 * Returns new definitions with every displayed AI suggestion confirmed as shown. Values the user
 * already confirmed are left exactly as they are.
 */
export function acceptAllSuggestions(
  defs: ConfirmedDefinitions,
  resolved: ResolvedUnderstanding,
): ConfirmedDefinitions {
  let next = defs
  for (const field of DATASET_FIELDS) {
    const { source, value } = resolved[field]
    if (source === 'suggested' && value !== null) next = confirmDatasetField(next, field, value)
  }
  for (const c of resolved.columns) {
    const update: { description?: string; role?: ColumnRole } = {}
    if (c.description.source === 'suggested' && c.description.value !== null) {
      update.description = c.description.value
    }
    if (c.role.source === 'suggested' && c.role.value !== null) update.role = c.role.value
    if (update.description !== undefined || update.role !== undefined) {
      next = confirmColumn(next, c.name, update)
    }
  }
  return next
}

/** How many displayed items the user has confirmed, counted like countPendingSuggestions. */
export function countConfirmed(resolved: ResolvedUnderstanding): number {
  return countItems(resolved, 'confirmed')
}

/**
 * The confirmed definitions with glossary meanings filled in for columns the user hasn't confirmed
 * themselves, so Claude treats both as settled when interpreting the dataset.
 */
export function withGlossary(
  confirmed: ConfirmedDefinitions,
  columnNames: readonly string[],
  glossary: readonly GlossaryTerm[],
): ConfirmedDefinitions {
  const columns = { ...confirmed.columns }
  for (const name of columnNames) {
    const g = findTerm(glossary, name)
    if (!g) continue
    const own = columns[name] ?? {}
    columns[name] = {
      ...(g.description && { description: g.description }),
      ...(g.role && { role: g.role }),
      ...own,
    }
  }
  return { ...confirmed, columns }
}
