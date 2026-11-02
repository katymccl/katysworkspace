/**
 * The rules behind the data preview's table: how cells sort and filter by their column's type, and
 * the remembered column order. They change only how the rows are viewed, never the dataset. Pure,
 * apart from storage.
 */
import { z } from 'zod'
import type { ColumnProfile, InferredType } from '../profiling/types'
import { isMissing, parseDate } from '../profiling/values'
import { readNumber } from '../explore/explore'
import { STORAGE_PREFIX, readStored, writeStored } from '../storage'

/** What a cell sorts by: a number (numbers and dates) or lower-case text. */
export function sortKey(value: unknown, type: InferredType): number | string {
  const text = String(value).trim()
  if (type === 'integer' || type === 'decimal') return readNumber(text) ?? Number.NaN
  if (type === 'date') return parseDate(text)?.time ?? Number.NaN
  return text.toLowerCase()
}

/**
 * Compares two cells of a column, ascending. Numbers and dates compare by value (9 before 10), text
 * in natural order (`item 2` before `item 10`); values that don't read as the column's type (such as
 * a stray `n/a` among numbers) come after those that do. Blanks are handled by the table, which
 * always puts them last.
 */
export function compareValues(a: unknown, b: unknown, type: InferredType): number {
  const x = sortKey(a, type)
  const y = sortKey(b, type)
  if (typeof x === 'number' && typeof y === 'number') {
    const xBad = Number.isNaN(x)
    const yBad = Number.isNaN(y)
    if (xBad || yBad) {
      if (xBad && yBad) return String(a).localeCompare(String(b), 'en', { numeric: true })
      return xBad ? 1 : -1
    }
    return x - y
  }
  return String(x).localeCompare(String(y), 'en', { numeric: true, sensitivity: 'base' })
}

/** The filter a column offers: a range for numbers, a list for categories, otherwise "contains". */
export type FilterKind = 'range' | 'value' | 'text'

/** Most distinct values a column can have to be filtered by picking one from a list. */
export const MAX_FILTER_VALUES = 30

export function filterKindFor(column: ColumnProfile): FilterKind {
  if (column.inferredType === 'integer' || column.inferredType === 'decimal') return 'range'
  if (
    (column.inferredType === 'string' || column.inferredType === 'boolean') &&
    column.distinctCount <= MAX_FILTER_VALUES &&
    !column.isUnique
  ) {
    return 'value'
  }
  return 'text'
}

export type ColumnFilter =
  | { kind: 'text'; contains: string }
  | { kind: 'value'; equals: string }
  | { kind: 'range'; min: number | null; max: number | null }

/** Whether a filter is set to anything; an empty one shows every row. */
export function isActive(filter: ColumnFilter | undefined): boolean {
  if (!filter) return false
  if (filter.kind === 'text') return filter.contains.trim() !== ''
  if (filter.kind === 'value') return filter.equals !== ''
  return filter.min !== null || filter.max !== null
}

export function matchesFilter(value: unknown, filter: ColumnFilter): boolean {
  if (!isActive(filter)) return true
  const blank = isMissing(value)
  if (filter.kind === 'text') {
    return !blank && String(value).toLowerCase().includes(filter.contains.trim().toLowerCase())
  }
  if (filter.kind === 'value') return !blank && String(value).trim() === filter.equals
  const n = blank ? null : readNumber(value)
  if (n === null) return false
  return (filter.min === null || n >= filter.min) && (filter.max === null || n <= filter.max)
}

/** The search box, cell by cell: whether a cell contains the text, ignoring case. */
export function cellContains(value: unknown, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return value != null && String(value).toLowerCase().includes(q)
}

/**
 * The columns in the remembered order: those since removed (say, by Prepare my data) are dropped,
 * and new ones go at the end in file order.
 */
export function reconcileOrder(saved: readonly string[] | null, columns: readonly string[]): string[] {
  if (!saved) return [...columns]
  const present = new Set(columns)
  const kept = saved.filter((c) => present.has(c))
  const keptSet = new Set(kept)
  return [...kept, ...columns.filter((c) => !keptSet.has(c))]
}

/** Moves a column to where another one is, before or after it. */
export function moveColumn(
  order: readonly string[],
  column: string,
  target: string,
  side: 'before' | 'after',
): string[] {
  if (column === target) return [...order]
  const rest = order.filter((c) => c !== column)
  const at = rest.indexOf(target)
  if (at === -1) return [...order]
  rest.splice(side === 'before' ? at : at + 1, 0, column)
  return rest
}

const orderKey = (datasetId: string) => `${STORAGE_PREFIX}:column-order:${datasetId}`

export function loadColumnOrder(datasetId: string): string[] | null {
  return readStored(orderKey(datasetId), z.array(z.string()))
}

/** Saves the order, or forgets it when it's back to the file's own. */
export function saveColumnOrder(datasetId: string, order: readonly string[], fileOrder: readonly string[]) {
  const same = order.length === fileOrder.length && order.every((c, i) => c === fileOrder[i])
  if (same) {
    try {
      localStorage.removeItem(orderKey(datasetId))
    } catch {
      // Storage unavailable: nothing was saved.
    }
  } else {
    writeStored(orderKey(datasetId), order)
  }
}
