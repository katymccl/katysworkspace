import { postToAi, type AiOutcome } from '../ai/post'
import type { CsvRow } from '../parseCsv'
import type { DatasetProfile } from '../profiling'
import { isKeyColumn, isMissing } from '../profiling'
import { expectedKind, type CleanIssues } from './detect'
import {
  CLEAN_LIMITS,
  CleanResultSchema,
  reconcileCleanSuggestions,
  type CleanRequest,
  type CleanResult,
} from './schema'

export interface CleanContext {
  name: string
  description: string | null
  rowMeaning: string | null
  columnDescriptions: ReadonlyMap<string, string | null>
}

/**
 * Builds what Claude sees: column summaries, the flagged rows (wrong-type values first, since
 * they're the most fixable, then missing ones, up to 40), and the values of the short text columns
 * that may spell something more than one way. Also returns which cell each issue id stands for.
 * Pure.
 */
export function buildCleanRequest(
  columns: readonly string[],
  rows: readonly CsvRow[],
  profile: DatasetProfile,
  issues: CleanIssues,
  context: CleanContext,
): { request: CleanRequest; cells: Map<string, { row: number; column: string }> } {
  const clip = (s: string, max: number = CLEAN_LIMITS.maxValueLength) =>
    s.length > max ? s.slice(0, max) : s
  const clipText = (s: string | null) => (s ? clip(s, CLEAN_LIMITS.maxTextLength) : undefined)

  const flagged = [
    ...issues.mismatches.map((m) => ({ row: m.row, column: m.column, problem: 'wrong-type' as const })),
    ...issues.missing.flatMap((m) =>
      m.rows.map((row) => ({ row, column: m.column, problem: 'missing' as const })),
    ),
  ].slice(0, CLEAN_LIMITS.maxIssues)

  const shown = columns.slice(0, CLEAN_LIMITS.maxColumns)
  const cells = new Map<string, { row: number; column: string }>()
  const requestIssues = flagged.map((f, i) => {
    const id = `i${i + 1}`
    cells.set(id, { row: f.row, column: f.column })
    const row: Record<string, string> = {}
    for (const c of shown) {
      const v = rows[f.row][c] ?? ''
      if (c === f.column || !isMissing(v)) row[clip(c)] = clip(v)
    }
    return { id, problem: f.problem, column: clip(f.column), row }
  })

  const categories = spellingColumns(rows, profile, issues).map((c) => ({
    column: clip(c.column),
    values: c.values.map(({ value, count }) => ({ value: clip(value), count })),
  }))

  return {
    cells,
    request: {
      dataset: {
        name: clip(context.name, CLEAN_LIMITS.maxTextLength),
        ...(context.description && { description: clipText(context.description) }),
        ...(context.rowMeaning && { rowMeaning: clipText(context.rowMeaning) }),
        columns: profile.columns.slice(0, CLEAN_LIMITS.maxColumns).map((c) => {
          const description = context.columnDescriptions.get(c.name)
          return {
            name: clip(c.name),
            expected: expectedKind(c) ?? 'text',
            ...(description && { description: clipText(description) }),
            examples: c.sampleValues.slice(0, 5).map((v) => clip(v)),
          }
        }),
      },
      issues: requestIssues,
      categories,
    },
  }
}

/**
 * What Claude can help with: fixing values of the wrong kind, and checking text columns whose values
 * may be spellings of one thing. Missing values alone are rarely fixable from the rest of the row,
 * so they're sent along but never the only reason to ask.
 */
export function claudeCanHelp(
  rows: readonly CsvRow[],
  profile: DatasetProfile,
  issues: CleanIssues,
): { fixes: boolean; spellings: boolean } {
  return {
    fixes: issues.mismatches.length > 0,
    spellings: spellingColumns(rows, profile, issues).length > 0,
  }
}

/**
 * Short text columns, with their values most common first, where at least two values look like
 * the same thing written differently. Mixed columns count when no kind dominates (so one stray
 * number doesn't hide a column); keys and date-format columns don't.
 */
export function spellingColumns(
  rows: readonly CsvRow[],
  profile: DatasetProfile,
  issues: CleanIssues,
): { column: string; values: { value: string; count: number }[] }[] {
  const dateColumns = new Set(issues.dateFormats.map((d) => d.column))
  return profile.columns
    .filter(
      (c) =>
        (c.inferredType === 'string' || (c.inferredType === 'mixed' && !expectedKind(c))) &&
        !isKeyColumn(c) &&
        !dateColumns.has(c.name) &&
        c.distinctCount >= 2 &&
        c.distinctCount <= CLEAN_LIMITS.maxCategoryValues,
    )
    .map((c) => {
      const counts = new Map<string, number>()
      for (const row of rows) {
        const v = row[c.name]
        if (!isMissing(v)) counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      const values = [...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }))
      return { column: c.name, values }
    })
    .filter((c) => mayHaveVariants(c.values.map((v) => v.value)))
    .slice(0, CLEAN_LIMITS.maxCategoryColumns)
}

/**
 * Whether two values could be one thing spelled two ways: equal ignoring case and punctuation
 * (`Shipped`, `shipped`), one written as a short form of the other (`N.` or `N`, `North`), initials (`NY`,
 * `New York`), or one letter apart in longer words (`Londn`, `London`). Codes with digits such as
 * `SKU-1001` and `SKU-1002` only count when equal. A cheap check that only decides whether asking
 * Claude is worthwhile; Claude judges the actual groups.
 */
export function mayHaveVariants(values: readonly string[]): boolean {
  const forms = values.map((v) => ({
    // Written as a short form: ending in a full stop, or one to three capitals.
    abbreviated: /\.$/.test(v.trim()) || /^\p{Lu}{1,3}$/u.test(v.trim()),
    plain: v.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''),
    initials: v
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .map((w) => w[0].toLowerCase())
      .join(''),
  }))
  for (let i = 0; i < forms.length; i++) {
    for (let j = i + 1; j < forms.length; j++) {
      const [a, b] = forms[i].plain.length <= forms[j].plain.length ? [forms[i], forms[j]] : [forms[j], forms[i]]
      if (a.plain === '' || b.plain === '') continue
      if (a.plain === b.plain) return true
      if (!LETTERS.test(a.plain) || !LETTERS.test(b.plain)) continue
      if (a.abbreviated && b.plain.startsWith(a.plain)) return true
      if (a.plain.length >= 2 && a.plain === b.initials) return true
      if (a.plain.length >= 4 && withinOneEdit(a.plain, b.plain)) return true
    }
  }
  return false
}

const LETTERS = /^\p{L}+$/u

/** Whether one insertion, deletion or substitution turns `a` (the shorter) into `b`. */
function withinOneEdit(a: string, b: string): boolean {
  if (b.length - a.length > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return a.length === b.length ? a.slice(i + 1) === b.slice(i + 1) : a.slice(i) === b.slice(i + 1)
}

export async function requestCleanSuggestions(
  request: CleanRequest,
  signal?: AbortSignal,
): Promise<AiOutcome<CleanResult>> {
  const outcome = await postToAi('/api/clean', request, CleanResultSchema, { signal })
  if (!outcome.ok) return outcome
  return {
    ok: true,
    result: {
      ...outcome.result,
      suggestions: reconcileCleanSuggestions(outcome.result.suggestions, request),
    },
  }
}
