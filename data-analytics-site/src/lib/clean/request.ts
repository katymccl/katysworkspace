import { postToAi, type AiOutcome } from '../ai/post'
import type { CsvRow } from '../parseCsv'
import type { DatasetProfile } from '../profiling'
import { isMissing } from '../profiling'
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
 * they're the most fixable, then missing ones, up to 40), and the distinct values of short text
 * columns. Also returns which cell each issue id stands for. Pure.
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

  const categories = profile.columns
    .filter(
      (c) =>
        c.inferredType === 'string' &&
        !c.isPotentialIdentifier &&
        c.distinctCount >= 2 &&
        c.distinctCount <= CLEAN_LIMITS.maxCategoryValues,
    )
    .slice(0, CLEAN_LIMITS.maxCategoryColumns)
    .map((c) => {
      const counts = new Map<string, number>()
      for (const row of rows) {
        const v = row[c.name]
        if (!isMissing(v)) counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      return {
        column: clip(c.name),
        values: [...counts]
          .sort((a, b) => b[1] - a[1])
          .slice(0, CLEAN_LIMITS.maxCategoryValues)
          .map(([value, count]) => ({ value: clip(value), count })),
      }
    })

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
