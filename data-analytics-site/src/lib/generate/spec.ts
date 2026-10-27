import { GENERATE_LIMITS, type GenerateRequest } from './schema'

export interface ColumnSpecResult {
  columns: GenerateRequest['columns']
  /** Problems to show the user; the request should not be sent while there are any. */
  errors: string[]
}

/**
 * Reads the user's column list: one column per line, with an optional hint after the first colon
 * (`price: in GBP, 1 to 500`). Blank lines are ignored. Pure.
 */
export function parseColumnSpec(text: string): ColumnSpecResult {
  const columns: GenerateRequest['columns'] = []
  const errors: string[] = []
  const seen = new Set<string>()

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const colon = line.indexOf(':')
    const name = (colon === -1 ? line : line.slice(0, colon)).trim()
    const hint = colon === -1 ? '' : line.slice(colon + 1).trim()

    if (!name) {
      errors.push(`"${line.trim()}" has a hint but no column name.`)
      continue
    }
    if (name.length > GENERATE_LIMITS.maxColumnName) {
      errors.push(`"${name.slice(0, 30)}…" is too long for a column name.`)
      continue
    }
    const key = name.toLowerCase()
    if (seen.has(key)) {
      errors.push(`"${name}" is listed more than once.`)
      continue
    }
    seen.add(key)
    columns.push(hint ? { name, hint: hint.slice(0, GENERATE_LIMITS.maxHint) } : { name })
  }

  if (columns.length > GENERATE_LIMITS.maxColumns) {
    errors.push(`Use at most ${GENERATE_LIMITS.maxColumns} columns (you listed ${columns.length}).`)
  }
  return { columns, errors }
}

/** The largest row count allowed for this many columns. */
export function maxRowsFor(columnCount: number): number {
  if (columnCount === 0) return GENERATE_LIMITS.maxRows
  return Math.min(GENERATE_LIMITS.maxRows, Math.floor(GENERATE_LIMITS.maxCells / columnCount))
}

/** The column box's text for a list of columns: the reverse of parseColumnSpec. */
export function formatColumnSpec(columns: GenerateRequest['columns']): string {
  return columns.map((c) => (c.hint ? `${c.name}: ${c.hint}` : c.name)).join('\n')
}

/** Marks placeholder lines as an example, keeping them aligned in a monospace box. */
export function asExample(text: string): string {
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? `e.g. ${line}` : `     ${line}`))
    .join('\n')
}
