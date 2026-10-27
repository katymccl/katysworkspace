import type { CsvRow } from '../parseCsv'
import type { DatasetProfile, ValueKind } from '../profiling'
import { classifyValue, isMissing } from '../profiling'

/**
 * Finds what "Prepare my data" offers to fix, exactly and in the browser: missing values, rows that
 * repeat an earlier row, and values that don't fit their column's type. Pure; rows are referred
 * to by their index in the dataset.
 */

export interface MissingIssue {
  column: string
  rows: number[]
}

export interface DuplicateGroup {
  /** The first row with these values; it is kept. */
  keep: number
  /** Later rows with exactly the same values. */
  copies: number[]
}

export interface MismatchIssue {
  row: number
  column: string
  value: string
  expected: ExpectedKind
}

/** What a column's values should be. Whole and decimal numbers are treated as one kind. */
export type ExpectedKind = 'number' | 'date' | 'boolean'

export interface CleanIssues {
  missing: MissingIssue[]
  duplicates: DuplicateGroup[]
  mismatches: MismatchIssue[]
}

/** A mostly-typed column must have at least this share of one kind for the rest to look wrong. */
export const DOMINANT_SHARE = 0.8

export function findIssues(
  columns: readonly string[],
  rows: readonly CsvRow[],
  profile: DatasetProfile,
): CleanIssues {
  const expected = new Map<string, ExpectedKind>()
  for (const c of profile.columns) {
    const kind = expectedKind(c)
    if (kind) expected.set(c.name, kind)
  }

  const missing = new Map<string, number[]>(columns.map((c) => [c, []]))
  const mismatches: MismatchIssue[] = []
  const firstSeen = new Map<string, number>()
  const groups = new Map<number, number[]>()

  rows.forEach((row, index) => {
    for (const column of columns) {
      const value = row[column]
      if (isMissing(value)) {
        missing.get(column)!.push(index)
        continue
      }
      const kind = expected.get(column)
      if (kind && !fits(kind, value)) {
        mismatches.push({ row: index, column, value, expected: kind })
      }
    }
    const key = columns.map((c) => (row[c] ?? '').trim()).join('\u0000')
    const first = firstSeen.get(key)
    if (first === undefined) firstSeen.set(key, index)
    else groups.set(first, [...(groups.get(first) ?? []), index])
  })

  return {
    missing: columns
      .map((column) => ({ column, rows: missing.get(column)! }))
      .filter((m) => m.rows.length > 0),
    duplicates: [...groups].map(([keep, copies]) => ({ keep, copies })),
    mismatches,
  }
}

/**
 * The kind a column's values should have: its type when every value agrees, or its main kind when
 * at least 80% of values have it (or all but one, with 3 or more). Text columns expect nothing,
 * since any value fits.
 */
export function expectedKind(column: {
  inferredType: string
  dominantKind: ValueKind | null
  kindCounts: Record<ValueKind, number>
  nonMissingCount: number
}): ExpectedKind | null {
  const asExpected = (kind: string | null): ExpectedKind | null =>
    kind === 'integer' || kind === 'decimal'
      ? 'number'
      : kind === 'date' || kind === 'boolean'
        ? kind
        : null
  if (column.inferredType !== 'mixed') return asExpected(column.inferredType)

  const kind = asExpected(column.dominantKind)
  if (!kind || column.nonMissingCount === 0) return null
  const share =
    kind === 'number'
      ? column.kindCounts.integer + column.kindCounts.decimal
      : column.kindCounts[column.dominantKind!]
  // In small files one stray value already breaks 80%, so a single misfit among 3+ also counts.
  const misfits = column.nonMissingCount - share
  const mostly =
    share / column.nonMissingCount >= DOMINANT_SHARE ||
    (misfits === 1 && column.nonMissingCount >= 3)
  return mostly ? kind : null
}

/** Whether a value fits what its column expects. Missing values fit; they're flagged separately. */
export function fits(expected: ExpectedKind, value: string): boolean {
  if (isMissing(value)) return true
  const kind = classifyValue(value).kind
  return expected === 'number' ? kind === 'integer' || kind === 'decimal' : kind === expected
}

export function issueCount(issues: CleanIssues): number {
  return (
    issues.missing.reduce((n, m) => n + m.rows.length, 0) +
    issues.duplicates.reduce((n, d) => n + d.copies.length, 0) +
    issues.mismatches.length
  )
}
