/**
 * The contract for /api/plan: before generating anything, Claude proposes what the new dataset
 * should contain (a description, columns with hints, a row count) for the user to edit. Shared by
 * the browser and the server, so it must only import `zod`.
 */
import { z } from 'zod'
import { BaseContextSchema, GENERATE_LIMITS } from './schema.js'

/** Whatever the user has filled in so far; any of it may be empty. */
export const PlanRequestSchema = z
  .object({
    description: z.string().max(GENERATE_LIMITS.maxDescription),
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
    rowCount: z.number().int().min(1).max(GENERATE_LIMITS.maxRows).optional(),
    base: BaseContextSchema.optional(),
  })
  .strict()
  .refine((r) => r.description.trim() !== '' || r.columns.length > 0 || r.base !== undefined, {
    message: 'Describe the data, list a column, or choose a dataset to base it on',
  })
export type PlanRequest = z.infer<typeof PlanRequestSchema>

/** What the model must return. Shape only; `reconcilePlan` enforces limits. */
export const DatasetPlanSchema = z.object({
  description: z.string().describe('One or two sentences: what one row is and what it covers'),
  columns: z
    .array(
      z.object({
        name: z.string().describe('Column name, without colons'),
        hint: z
          .string()
          .describe('Short format or range hint, e.g. "1 to 5" or "YYYY-MM-DD"; empty if none'),
      }),
    )
    .describe('The columns, in order'),
  rowCount: z.number().describe('How many rows to generate'),
})
export type DatasetPlan = z.infer<typeof DatasetPlanSchema>

export const PlanResultSchema = z.object({ plan: DatasetPlanSchema, model: z.string() })
export type PlanResult = z.infer<typeof PlanResultSchema>

/**
 * Makes a model's plan fit the form and the generator's limits. Pure.
 * - Column names lose colons and line breaks (the column box uses `name: hint` lines), blanks and
 *   repeats are dropped, and at most 25 are kept.
 * - The row count is a whole number from 1 to the most the cell limit allows for these columns.
 */
export function reconcilePlan(raw: DatasetPlan): DatasetPlan {
  const seen = new Set<string>()
  const columns: DatasetPlan['columns'] = []
  for (const c of raw.columns) {
    const name = oneLine(c.name.replace(/:/g, ' ')).slice(0, GENERATE_LIMITS.maxColumnName)
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    columns.push({ name, hint: oneLine(c.hint).slice(0, GENERATE_LIMITS.maxHint) })
    if (columns.length === GENERATE_LIMITS.maxColumns) break
  }
  const maxRows = Math.min(
    GENERATE_LIMITS.maxRows,
    Math.floor(GENERATE_LIMITS.maxCells / Math.max(columns.length, 1)),
  )
  const rowCount = Number.isFinite(raw.rowCount)
    ? Math.min(Math.max(Math.round(raw.rowCount), 1), maxRows)
    : Math.min(25, maxRows)
  return {
    description: oneLine(raw.description).slice(0, GENERATE_LIMITS.maxDescription),
    columns,
    rowCount,
  }
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}
