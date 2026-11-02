/**
 * Renaming and removing columns in "Prepare my data". Either makes a new version of the dataset. On
 * a rename, everything that refers to a column by name (confirmed meanings, Claude's suggestions,
 * relationship decisions, identifier choices, column order, saved Explore charts) is carried over
 * to the new name, so nothing quietly comes apart. Pure.
 */
import type { ConfirmedDefinitions } from '../understanding/definitions'
import type { DatasetUnderstanding } from '../understanding/schema'
import type { ConfirmedRelationship } from '../relationships/confirmed'
import type { Dashboard } from '../dashboards'
import type { ExploreConfig } from '../explore/explore'
import type { GlossaryTerm } from '../glossary'
import { termKey } from '../glossary'
import { headerWords } from '../profiling/identifiers'
import type { CsvRow } from '../parseCsv'

/** New names by current name; columns not listed keep theirs. */
export type Renames = Readonly<Record<string, string>>

/** The renames that actually change something, trimmed. */
export function effectiveRenames(renames: Renames, columns: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of columns) {
    const to = renames[c]?.trim()
    if (to && to !== c) out[c] = to
  }
  return out
}

/** A column's name after renaming. */
export const renamed = (renames: Renames, name: string) => renames[name] ?? name

/**
 * Problems with the new names, by the column being renamed: a blank name, or one that another
 * column will have (ignoring case, so `Region` and `region` can't both exist).
 */
export function renameProblems(columns: readonly string[], renames: Renames): Record<string, string> {
  const problems: Record<string, string> = {}
  const final = columns.map((c) => ({ from: c, to: renames[c] === undefined ? c : renames[c].trim() }))
  const count = new Map<string, number>()
  for (const f of final) count.set(f.to.toLowerCase(), (count.get(f.to.toLowerCase()) ?? 0) + 1)
  for (const f of final) {
    if (renames[f.from] === undefined) continue
    if (f.to === '') problems[f.from] = 'A column needs a name.'
    else if ((count.get(f.to.toLowerCase()) ?? 0) > 1) problems[f.from] = `Another column is called “${f.to}”.`
  }
  return problems
}

/** The dataset without the removed columns. */
export function removeColumns(
  columns: readonly string[],
  rows: readonly CsvRow[],
  removed: readonly string[],
): { columns: string[]; rows: CsvRow[] } {
  if (removed.length === 0) return { columns: [...columns], rows: [...rows] }
  const gone = new Set(removed)
  return {
    columns: columns.filter((c) => !gone.has(c)),
    rows: rows.map((row) => {
      const out: CsvRow = {}
      for (const [k, v] of Object.entries(row)) if (!gone.has(k)) out[k] = v
      return out
    }),
  }
}

export function renameColumns(
  columns: readonly string[],
  rows: readonly CsvRow[],
  renames: Renames,
): { columns: string[]; rows: CsvRow[] } {
  if (Object.keys(renames).length === 0) return { columns: [...columns], rows: [...rows] }
  return {
    columns: columns.map((c) => renamed(renames, c)),
    rows: rows.map((row) => {
      const out: CsvRow = {}
      for (const [k, v] of Object.entries(row)) out[renamed(renames, k)] = v
      return out
    }),
  }
}

export function renameConfirmed(defs: ConfirmedDefinitions, renames: Renames): ConfirmedDefinitions {
  const columns: ConfirmedDefinitions['columns'] = {}
  for (const [name, def] of Object.entries(defs.columns)) columns[renamed(renames, name)] = def
  return { ...defs, columns }
}

/** Claude's suggestion, renamed and kept to the columns the new version has. */
export function renameSuggestion(
  u: DatasetUnderstanding,
  renames: Renames,
  columns: readonly string[],
): DatasetUnderstanding {
  const has = new Set(columns)
  const keep = (names: readonly string[]) => names.map((n) => renamed(renames, n)).filter((n) => has.has(n))
  return {
    ...u,
    rowKeyColumns: keep(u.rowKeyColumns),
    columns: u.columns
      .map((c) => ({ ...c, name: renamed(renames, c.name) }))
      .filter((c) => has.has(c.name)),
    questions: u.questions.map((q) => ({ ...q, columns: keep(q.columns) })),
  }
}

/** Relationship decisions, with this dataset's renamed columns (`datasetId` is the stable id). */
export function renameRelationships(
  list: readonly ConfirmedRelationship[],
  datasetId: string,
  renames: Renames,
): ConfirmedRelationship[] {
  const ref = (r: { dataset: string; column: string }) =>
    r.dataset === datasetId ? { ...r, column: renamed(renames, r.column) } : r
  return list.map((r) => (r.kind === 'link' ? { ...r, from: ref(r.from), to: ref(r.to) } : r))
}

export function renameNames(names: readonly string[], renames: Renames): string[] {
  return names.map((n) => renamed(renames, n))
}

function renameConfig(config: ExploreConfig, renames: Renames): ExploreConfig {
  const r = (n: string | null) => (n === null ? null : renamed(renames, n))
  return { ...config, time: r(config.time), group: r(config.group), measure: r(config.measure), second: r(config.second) }
}

/** Saved Explore charts of this dataset (`openId` is the open dataset's id), with renamed columns. */
export function renameDashboards(dashboards: readonly Dashboard[], openId: string, renames: Renames): Dashboard[] {
  return dashboards.map((d) => ({
    ...d,
    items: d.items.map((i) =>
      i.kind === 'explore' && i.datasetId === openId ? { ...i, config: renameConfig(i.config, renames) } : i,
    ),
  }))
}

/** Glossary terms made from a renamed column remember its new name. */
export function renameGlossarySources(
  terms: readonly GlossaryTerm[],
  datasetId: string,
  renames: Renames,
): GlossaryTerm[] {
  return terms.map((t) =>
    t.from?.datasetId === datasetId ? { ...t, from: { ...t.from, column: renamed(renames, t.from.column) } } : t,
  )
}

/**
 * A glossary term a column's name looks like a short form of, to offer as its new name: each word
 * of the column starts the matching word of the term (`lib_id` → `Library ID`, `cust_nm` → no).
 * Null when the column already matches a term, or none fits.
 */
export function glossaryNameFor(column: string, terms: readonly GlossaryTerm[]): string | null {
  const words = headerWords(column)
  if (words.length === 0) return null
  if (terms.some((t) => [t.term, ...t.aliases].some((n) => termKey(n) === termKey(column)))) return null
  for (const t of terms) {
    for (const name of [t.term, ...t.aliases]) {
      const target = headerWords(name)
      if (
        target.length === words.length &&
        words.every((w, i) => target[i].startsWith(w) && (w.length >= 2 || w === target[i]))
      ) {
        return t.term
      }
    }
  }
  return null
}
