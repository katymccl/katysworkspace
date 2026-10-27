/**
 * The contract for /api/clean: Claude suggests fixes for problems the browser found, and spots
 * spellings of one value that should be the same. It gets only the flagged rows (up to a limit)
 * and the distinct values of short category columns, never the whole file. Shared by the browser
 * and the server, so it must only import `zod`.
 */
import { z } from 'zod'

export const CLEAN_LIMITS = {
  maxIssues: 40,
  maxColumns: 60,
  maxCategoryColumns: 15,
  maxCategoryValues: 40,
  maxValueLength: 100,
  maxTextLength: 400,
  maxBodyBytes: 256 * 1024,
} as const

const value = z.string().max(CLEAN_LIMITS.maxValueLength)
const text = z.string().max(CLEAN_LIMITS.maxTextLength)

export const CleanRequestSchema = z
  .object({
    dataset: z
      .object({
        name: text,
        description: text.optional(),
        rowMeaning: text.optional(),
        columns: z
          .array(
            z
              .object({
                name: value,
                expected: z.enum(['number', 'date', 'boolean', 'text']),
                description: text.optional(),
                examples: z.array(value).max(5),
              })
              .strict(),
          )
          .max(CLEAN_LIMITS.maxColumns),
      })
      .strict(),
    issues: z
      .array(
        z
          .object({
            id: z.string().max(40),
            problem: z.enum(['missing', 'wrong-type']),
            column: value,
            /** The other values in the flagged row, for context. */
            row: z.record(value, value),
          })
          .strict(),
      )
      .max(CLEAN_LIMITS.maxIssues),
    /** Distinct values of short text columns, to spot spellings that should be the same. */
    categories: z
      .array(
        z
          .object({
            column: value,
            values: z
              .array(z.object({ value, count: z.number().int().positive() }).strict())
              .max(CLEAN_LIMITS.maxCategoryValues),
          })
          .strict(),
      )
      .max(CLEAN_LIMITS.maxCategoryColumns),
  })
  .strict()
  .refine((r) => r.issues.length > 0 || r.categories.length > 0, {
    message: 'Nothing to check',
  })
export type CleanRequest = z.infer<typeof CleanRequestSchema>

/** What the model must return. Shape only; `reconcileCleanSuggestions` checks it. */
export const CleanSuggestionsSchema = z.object({
  fixes: z
    .array(
      z.object({
        id: z.string().describe('The id of the issue this fixes'),
        value: z.string().describe('The value to put in the cell'),
        reason: z.string().describe('A short reason, under 15 words'),
      }),
    )
    .describe('Fixes only for issues you can fix confidently from the row; omit the rest'),
  standardise: z
    .array(
      z.object({
        column: z.string(),
        from: z.array(z.string()).describe('Exact existing values that mean the same thing'),
        to: z.string().describe('The one spelling to use for all of them'),
        reason: z.string().describe('A short reason, under 15 words'),
      }),
    )
    .describe('Groups of category values that are spellings of the same thing'),
})
export type CleanSuggestions = z.infer<typeof CleanSuggestionsSchema>

export const CleanResultSchema = z.object({ suggestions: CleanSuggestionsSchema, model: z.string() })
export type CleanResult = z.infer<typeof CleanResultSchema>

/**
 * Keeps only suggestions that fit the request: fixes for real issue ids (one each, not blank),
 * and standardising groups of real category values (at least two spellings, different from the
 * target). Pure.
 */
export function reconcileCleanSuggestions(
  raw: CleanSuggestions,
  request: CleanRequest,
): CleanSuggestions {
  const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s)
  const ids = new Set(request.issues.map((i) => i.id))
  const seen = new Set<string>()
  const fixes = raw.fixes
    .filter((f) => ids.has(f.id) && f.value.trim() !== '' && !seen.has(f.id) && seen.add(f.id))
    .map((f) => ({
      id: f.id,
      value: clip(f.value.trim(), CLEAN_LIMITS.maxValueLength),
      reason: clip(f.reason.trim(), 200),
    }))

  const valuesOf = new Map(
    request.categories.map((c) => [c.column, new Set(c.values.map((v) => v.value))]),
  )
  const used = new Set<string>()
  const standardise = raw.standardise.flatMap((s) => {
    const known = valuesOf.get(s.column)
    const to = s.to.trim()
    if (!known || !to) return []
    const from = [...new Set(s.from)].filter(
      (v) => known.has(v) && v !== to && !used.has(`${s.column}\u0000${v}`),
    )
    // One wrong spelling is enough when the target is itself an existing value.
    if (from.length === 0 || (from.length === 1 && !known.has(to))) return []
    for (const v of from) used.add(`${s.column}\u0000${v}`)
    return [
      {
        column: s.column,
        from,
        to: clip(to, CLEAN_LIMITS.maxValueLength),
        reason: clip(s.reason.trim(), 200),
      },
    ]
  })
  return { fixes, standardise }
}
