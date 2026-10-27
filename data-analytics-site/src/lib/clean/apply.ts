import type { CsvRow } from '../parseCsv'
import type { CleanIssues } from './detect'
import { applySplits, splitColumns, type Split } from './split'

/** Replaces several spellings of one value in a column, e.g. "NY" and "N.Y." with "New York". */
export interface Replacement {
  column: string
  from: string[]
  to: string
}

/** The user's choices in "Prepare my data". Anything not listed is left as it is. */
export interface CleanEdits {
  removeDuplicates: boolean
  /** Rows the user chose to remove, e.g. ones missing a value they need. */
  removeRows: number[]
  /** New cell values by `cellKey(row, column)`. */
  cells: Record<string, string>
  replacements: Replacement[]
  /** Columns to split into new ones; applied after every other change. */
  splits: Split[]
}

export const NO_EDITS: CleanEdits = {
  removeDuplicates: false,
  removeRows: [],
  cells: {},
  replacements: [],
  splits: [],
}

export const cellKey = (row: number, column: string) => `${row}\u0000${column}`

export function parseCellKey(key: string): { row: number; column: string } {
  const at = key.indexOf('\u0000')
  return { row: Number(key.slice(0, at)), column: key.slice(at + 1) }
}

/** Every row the edits remove: duplicate copies (if asked) and rows the user picked. */
export function removedRowSet(issues: CleanIssues, edits: CleanEdits): Set<number> {
  return new Set([
    ...(edits.removeDuplicates ? issues.duplicates.flatMap((d) => d.copies) : []),
    ...edits.removeRows,
  ])
}

/** Adds the rows to the removal list, or takes them all off it when every one is already there. */
export function toggleRemoved(edits: CleanEdits, rows: readonly number[]): CleanEdits {
  const current = new Set(edits.removeRows)
  const allIn = rows.length > 0 && rows.every((r) => current.has(r))
  for (const r of rows) {
    if (allIn) current.delete(r)
    else current.add(r)
  }
  return { ...edits, removeRows: [...current].sort((a, b) => a - b) }
}

/**
 * The rows with the user's choices applied: replacements first, then cell edits (which win), then
 * removed rows left out. Rows are copied; the input is never changed. Pure.
 */
export function applyEdits(
  rows: readonly CsvRow[],
  issues: CleanIssues,
  edits: CleanEdits,
): CsvRow[] {
  const byColumn = new Map(
    edits.replacements.map((r) => [
      r.column,
      { from: new Set(r.from.map((v) => v.trim())), to: r.to },
    ]),
  )
  const cellsByRow = new Map<number, [string, string][]>()
  for (const [key, value] of Object.entries(edits.cells)) {
    const { row, column } = parseCellKey(key)
    const list = cellsByRow.get(row)
    if (list) list.push([column, value])
    else cellsByRow.set(row, [[column, value]])
  }
  const dropped = removedRowSet(issues, edits)

  const out: CsvRow[] = []
  rows.forEach((row, index) => {
    if (dropped.has(index)) return
    const next = { ...row }
    for (const [column, { from, to }] of byColumn) {
      if (from.has((next[column] ?? '').trim())) next[column] = to
    }
    for (const [column, value] of cellsByRow.get(index) ?? []) next[column] = value
    out.push(next)
  })
  return out
}

/**
 * How many rows go and how many cells change in the rows that stay, for the "Apply" button and
 * the notice afterwards.
 */
export function summariseEdits(
  rows: readonly CsvRow[],
  issues: CleanIssues,
  edits: CleanEdits,
): { changedValues: number; removedRows: number } {
  const dropped = removedRowSet(issues, edits)
  // Apply with nothing removed, so each result row lines up with its original.
  const after = applyEdits(
    rows,
    { ...issues, duplicates: [] },
    { ...edits, removeDuplicates: false, removeRows: [] },
  )
  let changedValues = 0
  after.forEach((row, i) => {
    if (dropped.has(i)) return
    for (const column of Object.keys(row)) if (row[column] !== rows[i][column]) changedValues++
  })
  return { changedValues, removedRows: dropped.size }
}

/** The cleaned dataset: every change applied, then columns split. Pure. */
export function applyAll(
  columns: readonly string[],
  rows: readonly CsvRow[],
  issues: CleanIssues,
  edits: CleanEdits,
): { columns: string[]; rows: CsvRow[] } {
  return {
    columns: splitColumns(columns, edits.splits),
    rows: applySplits(applyEdits(rows, issues, edits), edits.splits),
  }
}
