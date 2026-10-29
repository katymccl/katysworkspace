import type { CsvData } from '../parseCsv'
import type { DatasetProfile } from '../profiling'
import { entityNameColumns, isKeyColumn } from '../profiling/identifiers'
import { isMissing } from '../profiling/values'
import { normaliseValue } from '../relationships/detect'
import type { ColumnRole } from '../understanding/schema'
import { GENERATE_LIMITS, type BaseContext, type GeneratedDataset } from './schema'

/** What the browser knows about the dataset a new one should complement. */
export interface BaseSource {
  name: string
  fileName: string
  description: string | null
  rowMeaning: string | null
  columns: readonly string[]
  rows: CsvData['rows']
  profile: DatasetProfile
  /** Column meanings and roles, confirmed or suggested, where known. */
  columnDefinitions: ReadonlyMap<string, { description: string | null; role: ColumnRole | null }>
}

/** Roles whose values the new dataset is likely to refer to, most useful first. */
const KEY_ROLE_ORDER: readonly (ColumnRole | null)[] = ['identifier', 'name']

/**
 * Summarises the base for the AI: definitions, column details, a few sample rows, and the values
 * of its identifier and name columns so the new data can reuse them exactly. Pure.
 */
export function buildBaseContext(base: BaseSource): BaseContext {
  const clip = (s: string, max: number = GENERATE_LIMITS.baseValueLength) =>
    s.length > max ? s.slice(0, max) : s
  const text = (v: unknown) => (isMissing(v) ? '' : clip(String(v)))

  // Names that go with an ID column (`Library` beside `Library ID`) travel with their IDs.
  const idNames = entityNameColumns(base.profile.columns.map((c) => c.name))
  const keyColumns = base.profile.columns
    .map((c) => ({ c, role: base.columnDefinitions.get(c.name)?.role ?? null }))
    .filter(({ c, role }) => isKeyColumn(c) || idNames.has(c.name) || KEY_ROLE_ORDER.includes(role))
    .filter(({ c }) => c.inferredType !== 'empty' && c.inferredType !== 'boolean')
    .sort(
      (a, b) => rank(a.c.isPotentialIdentifier, a.role) - rank(b.c.isPotentialIdentifier, b.role),
    )
    .slice(0, GENERATE_LIMITS.baseKeyColumns)
    .map(({ c }) => c.name)

  return {
    name: clip(base.name, 200),
    fileName: clip(base.fileName, 200),
    ...(base.description && { description: clip(base.description, 800) }),
    ...(base.rowMeaning && { rowMeaning: clip(base.rowMeaning, 400) }),
    rowCount: base.profile.rowCount,
    columns: base.profile.columns.slice(0, 300).map((c) => {
      const def = base.columnDefinitions.get(c.name)
      return {
        name: clip(c.name, GENERATE_LIMITS.maxColumnName),
        type: c.inferredType,
        ...(def?.role && { role: def.role }),
        ...(def?.description && { description: clip(def.description, 400) }),
      }
    }),
    sampleRows: base.rows
      .slice(0, GENERATE_LIMITS.baseSampleRows)
      .map((row) => base.columns.map((c) => text(row[c]))),
    keys: {
      columns: keyColumns.map((c) => clip(c, GENERATE_LIMITS.maxColumnName)),
      rows: distinctCombinations(base.rows, keyColumns)
        .slice(0, GENERATE_LIMITS.baseKeyRows)
        .map((row) => row.map((v) => clip(v))),
    },
  }
}

function rank(isIdentifier: boolean, role: ColumnRole | null): number {
  const roleRank = KEY_ROLE_ORDER.indexOf(role)
  return (isIdentifier ? 0 : 10) + (roleRank === -1 ? 5 : roleRank)
}

/** Distinct combinations of the given columns, in first-seen order; all-missing rows skipped. */
function distinctCombinations(rows: CsvData['rows'], columns: readonly string[]): string[][] {
  if (columns.length === 0) return []
  const seen = new Set<string>()
  const combos: string[][] = []
  for (const row of rows) {
    const values = columns.map((c) => (isMissing(row[c]) ? '' : String(row[c]).trim()))
    if (values.every((v) => v === '')) continue
    const key = JSON.stringify(values)
    if (!seen.has(key)) {
      seen.add(key)
      combos.push(values)
    }
  }
  return combos
}

export interface LinkCheck {
  column: string
  baseColumn: string
  /** Distinct values of the new column also found in the base column. */
  matched: number
  /** Distinct non-missing values in the new column. */
  total: number
}

/**
 * Checks each link the AI claimed against the actual values: how many of the new column's values
 * really appear in the base column (compared as in relationship detection). Pure.
 */
export function checkLinks(
  generated: Pick<GeneratedDataset, 'columns' | 'rows' | 'links'>,
  base: Pick<BaseSource, 'rows'>,
): LinkCheck[] {
  return generated.links.map(({ column, baseColumn }) => {
    const index = generated.columns.indexOf(column)
    const baseValues = new Set(
      base.rows.map((r) => normaliseValue(r[baseColumn])).filter((v) => v !== null),
    )
    const newValues = new Set(
      generated.rows.map((r) => normaliseValue(r[index])).filter((v) => v !== null),
    )
    let matched = 0
    for (const v of newValues) if (baseValues.has(v)) matched++
    return { column, baseColumn, matched, total: newValues.size }
  })
}
