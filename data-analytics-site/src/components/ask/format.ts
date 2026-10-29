import type { Cell } from '../../lib/ask/execute'

/** Whole numbers with separators; other numbers to at most two decimal places. */
export function formatCell(value: Cell): string {
  if (value === null) return '(blank)'
  if (typeof value === 'string') return value
  return value.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 2 })
}
