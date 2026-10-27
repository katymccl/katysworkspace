import type { CsvRow } from '../parseCsv'
import { isMissing } from '../profiling'

/** Splitting one column into several at a separator, e.g. "Leeds, UK" into city and country. */
export interface Split {
  column: string
  delimiter: string
  /** Names of the new columns, in order; there are as many parts as names. */
  names: string[]
  /** Keep the original column next to the new ones, or replace it. */
  keepOriginal: boolean
}

/** Separators offered by name; anything else can be typed. */
export const DELIMITERS = [
  { value: ',', label: 'Comma ( , )' },
  { value: ' ', label: 'Space' },
  { value: '-', label: 'Hyphen ( - )' },
  { value: '/', label: 'Slash ( / )' },
  { value: ';', label: 'Semicolon ( ; )' },
  { value: '|', label: 'Bar ( | )' },
  { value: '_', label: 'Underscore ( _ )' },
] as const

/** Most new columns one split may make. */
export const MAX_PARTS = 10

/**
 * Splits a value into exactly `parts` pieces, trimmed: anything past the last piece stays joined
 * in it ("a, b, c" into 2 is "a" and "b, c"), and missing pieces are empty. Pure.
 */
export function splitValue(value: string | undefined, delimiter: string, parts: number): string[] {
  const out = Array.from({ length: parts }, () => '')
  if (value === undefined || isMissing(value) || delimiter === '' || parts < 1) return out
  // A space separator also swallows runs of spaces, so "Ada  Lovelace" splits cleanly.
  const pieces = delimiter === ' ' ? value.trim().split(/ +/) : value.split(delimiter)
  for (let i = 0; i < parts - 1 && i < pieces.length; i++) out[i] = pieces[i].trim()
  if (pieces.length >= parts) out[parts - 1] = pieces.slice(parts - 1).join(delimiter).trim()
  return out
}

/** The most pieces any value splits into, capped at MAX_PARTS; 1 when nothing splits. */
export function countParts(rows: readonly CsvRow[], column: string, delimiter: string): number {
  if (delimiter === '') return 1
  let most = 1
  for (const row of rows) {
    const v = row[column]
    if (v === undefined || isMissing(v)) continue
    const n = delimiter === ' ' ? v.trim().split(/ +/).length : v.split(delimiter).length
    if (n > most) most = Math.min(n, MAX_PARTS)
    if (most === MAX_PARTS) break
  }
  return most
}

/** The offered separator found in the most values of a column, or null when none appears. */
export function guessDelimiter(rows: readonly CsvRow[], column: string): string | null {
  let best: { value: string; count: number } | null = null
  for (const { value } of DELIMITERS) {
    let count = 0
    for (const row of rows.slice(0, 1000)) {
      const v = row[column]
      if (v !== undefined && !isMissing(v) && v.trim().includes(value)) count++
    }
    if (count > 0 && (!best || count > best.count)) best = { value, count }
  }
  return best?.value ?? null
}

/** `city` → `city_1`, `city_2`…, skipping names already taken. */
export function defaultNames(column: string, parts: number, taken: readonly string[]): string[] {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  const names: string[] = []
  let i = 1
  while (names.length < parts) {
    const name = `${column}_${i++}`
    if (!used.has(name.toLowerCase())) {
      used.add(name.toLowerCase())
      names.push(name)
    }
  }
  return names
}

/** The columns after these splits: new ones right after their source, which goes unless kept. */
export function splitColumns(columns: readonly string[], splits: readonly Split[]): string[] {
  const bySource = new Map(splits.map((s) => [s.column, s]))
  return columns.flatMap((c) => {
    const split = bySource.get(c)
    if (!split) return [c]
    return split.keepOriginal ? [c, ...split.names] : split.names
  })
}

/**
 * Why a split can't be added, or null when it can: names must be filled in, different from each
 * other and from the columns that will remain, and a column is split once.
 */
export function splitProblem(
  columns: readonly string[],
  existing: readonly Split[],
  split: Split,
): string | null {
  if (existing.some((s) => s.column === split.column)) return `${split.column} is already being split.`
  if (split.delimiter === '') return 'Choose what to split at.'
  if (split.names.length < 2) return 'Split into at least 2 columns.'
  const names = split.names.map((n) => n.trim())
  if (names.some((n) => n === '')) return 'Give every new column a name.'
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
    return 'The new columns need different names.'
  }
  const remaining = splitColumns(columns, existing).filter(
    (c) => split.keepOriginal || c !== split.column,
  )
  const clash = names.find((n) => remaining.some((c) => c.toLowerCase() === n.toLowerCase()))
  return clash ? `There is already a column called ${clash}.` : null
}

/** The rows with each split applied, keyed by the new column names. Pure. */
export function applySplits(rows: readonly CsvRow[], splits: readonly Split[]): CsvRow[] {
  if (splits.length === 0) return [...rows]
  return rows.map((row) => {
    const next = { ...row }
    for (const s of splits) {
      const parts = splitValue(row[s.column], s.delimiter, s.names.length)
      s.names.forEach((name, i) => (next[name] = parts[i]))
      if (!s.keepOriginal) delete next[s.column]
    }
    return next
  })
}
