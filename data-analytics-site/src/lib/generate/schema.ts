/**
 * The contract between the browser and /api/generate, which asks Claude for a fictional sample
 * dataset, optionally one that complements an existing dataset (the "base"). Shared by both sides,
 * so it must only import `zod`.
 */
import { z } from 'zod'

export const GENERATE_LIMITS = {
  maxColumns: 25,
  maxRows: 100,
  /** Rows × columns. Keeps each generation well inside the server's time limit. */
  maxCells: 1000,
  maxDescription: 500,
  maxColumnName: 100,
  maxHint: 200,
  maxCellLength: 200,
  /** What the browser may send about a base dataset. */
  baseSampleRows: 5,
  baseKeyColumns: 4,
  baseKeyRows: 200,
  baseValueLength: 100,
  maxBodyBytes: 128 * 1024,
} as const

const INFERRED_TYPES = [
  'integer',
  'decimal',
  'boolean',
  'date',
  'string',
  'mixed',
  'empty',
] as const
const baseValue = z.string().max(GENERATE_LIMITS.baseValueLength)

/** What the new dataset should fit with: a summary of an existing dataset, no full rows. */
export const BaseContextSchema = z
  .object({
    name: z.string().max(200),
    fileName: z.string().max(200),
    description: z.string().max(800).optional(),
    rowMeaning: z.string().max(400).optional(),
    rowCount: z.number().int().nonnegative(),
    columns: z
      .array(
        z
          .object({
            name: z.string().max(GENERATE_LIMITS.maxColumnName),
            type: z.enum(INFERRED_TYPES),
            role: z.string().max(40).optional(),
            description: z.string().max(400).optional(),
          })
          .strict(),
      )
      .max(300),
    sampleRows: z.array(z.array(baseValue)).max(GENERATE_LIMITS.baseSampleRows),
    /**
     * The distinct combinations of the base's identifier and name columns, so the AI can see
     * which values belong together (e.g. two spellings of a name sharing one code).
     */
    keys: z
      .object({
        columns: z
          .array(z.string().max(GENERATE_LIMITS.maxColumnName))
          .max(GENERATE_LIMITS.baseKeyColumns),
        rows: z.array(z.array(baseValue)).max(GENERATE_LIMITS.baseKeyRows),
      })
      .strict()
      .refine((k) => k.rows.every((r) => r.length === k.columns.length), {
        message: 'Each key row needs one value per key column',
      }),
  })
  .strict()
export type BaseContext = z.infer<typeof BaseContextSchema>

export const GenerateRequestSchema = z
  .object({
    description: z.string().max(GENERATE_LIMITS.maxDescription),
    /** The columns to create. May be empty only with a base, when Claude chooses them. */
    columns: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(GENERATE_LIMITS.maxColumnName),
            hint: z.string().max(GENERATE_LIMITS.maxHint).optional(),
          })
          .strict(),
      )
      .max(GENERATE_LIMITS.maxColumns),
    /** How many rows. May be left out only with a base, when Claude chooses a fitting number. */
    rowCount: z.number().int().min(1).max(GENERATE_LIMITS.maxRows).optional(),
    base: BaseContextSchema.optional(),
  })
  .strict()
  .refine((r) => r.columns.length > 0 || r.base !== undefined, {
    message: 'List at least one column, or choose a dataset to base it on',
  })
  .refine((r) => r.rowCount !== undefined || r.base !== undefined, {
    message: 'Choose how many rows',
  })
  .refine((r) => (r.rowCount ?? 1) * Math.max(r.columns.length, 1) <= GENERATE_LIMITS.maxCells, {
    message: 'Too many cells',
  })
  .refine(
    (r) => new Set(r.columns.map((c) => c.name.trim().toLowerCase())).size === r.columns.length,
    { message: 'Column names must be unique' },
  )
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>

/** What the model must return. Shape only; `reconcileGenerated` enforces counts and lengths. */
export const GeneratedDatasetSchema = z.object({
  fileName: z.string().describe('Short lowercase kebab-case file name ending in .csv'),
  columns: z
    .array(z.string())
    .describe('Column names in order: exactly the requested ones when columns were listed'),
  rows: z
    .array(z.array(z.string()))
    .describe('One array per row, with one string per column, in column order'),
  links: z
    .array(
      z.object({
        column: z.string().describe('A column in the new dataset'),
        baseColumn: z.string().describe('The base dataset column whose values it reuses'),
      }),
    )
    .describe('New columns that reuse values from the base dataset; empty without a base'),
  notes: z.string().describe('One or two sentences on any assumptions made'),
})
export type GeneratedDataset = z.infer<typeof GeneratedDatasetSchema>

export const GenerateResultSchema = z.object({
  dataset: GeneratedDatasetSchema,
  model: z.string(),
  generatedAt: z.string(),
})
export type GenerateResult = z.infer<typeof GenerateResultSchema>

/**
 * Makes model output safe to use. Pure.
 * - Columns are the requested ones when listed; otherwise the model's, if they are usable
 *   (1 to 25 unique, non-empty names). Unusable column lists produce no rows.
 * - Keeps only rows with exactly one value per column, up to the requested count and the cell
 *   limit, with cells capped in length.
 * - Keeps links only between real new columns and real base columns.
 * - Turns the suggested name into a safe .csv file name.
 */
export function reconcileGenerated(
  raw: GeneratedDataset,
  request: GenerateRequest,
): GeneratedDataset {
  const columns =
    request.columns.length > 0
      ? request.columns.map((c) => c.name.trim())
      : usableColumns(raw.columns)
  const width = columns.length
  const maxRows =
    width === 0
      ? 0
      : Math.min(
          request.rowCount ?? GENERATE_LIMITS.maxRows,
          Math.floor(GENERATE_LIMITS.maxCells / width),
        )
  const rows = raw.rows
    .filter((row) => row.length === width)
    .slice(0, maxRows)
    .map((row) => row.map((cell) => clip(cell, GENERATE_LIMITS.maxCellLength)))

  const newColumns = new Set(columns)
  const baseColumns = new Set(request.base?.columns.map((c) => c.name) ?? [])
  const seen = new Set<string>()
  const links = raw.links.filter((l) => {
    const key = `${l.column}\u0000${l.baseColumn}`
    if (!newColumns.has(l.column) || !baseColumns.has(l.baseColumn) || seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    fileName: safeFileName(raw.fileName),
    columns,
    rows,
    links,
    notes: clip(raw.notes.trim(), 400),
  }
}

function usableColumns(names: readonly string[]): string[] {
  const trimmed = names.map((n) => n.trim())
  const valid =
    trimmed.length > 0 &&
    trimmed.length <= GENERATE_LIMITS.maxColumns &&
    trimmed.every((n) => n.length > 0 && n.length <= GENERATE_LIMITS.maxColumnName) &&
    new Set(trimmed.map((n) => n.toLowerCase())).size === trimmed.length
  return valid ? trimmed : []
}

/** `My Orders!.CSV` → `my-orders.csv`; falls back to `sample-data.csv`. */
export function safeFileName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\.csv$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'sample-data'}.csv`
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s
}
