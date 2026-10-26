/**
 * The contract between the browser and the /api/understand endpoint. Shared by both sides, so it
 * must only import `zod` (the server imports this file directly).
 */
import { z } from 'zod'

export const COLUMN_ROLES = [
  'identifier',
  'name',
  'category',
  'measure',
  'datetime',
  'flag',
  'text',
  'location',
  'contact',
  'other',
] as const
export type ColumnRole = (typeof COLUMN_ROLES)[number]

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const
export type Confidence = (typeof CONFIDENCE_LEVELS)[number]

/** Limits on what the browser may send, so the endpoint can't be used as a general AI proxy. */
export const REQUEST_LIMITS = {
  maxColumns: 300,
  maxTextLength: 200,
  maxValuesPerColumn: 5,
  maxValueLength: 100,
  maxReasonsPerColumn: 10,
  maxBodyBytes: 256 * 1024,
} as const

/** Text limits for definitions, applied to model output and to confirmed definitions sent back. */
export const OUTPUT_LIMITS = {
  name: 120,
  description: 800,
  rowMeaning: 400,
  columnDescription: 400,
  question: 400,
  maxQuestions: 10,
} as const

const text = (max: number = REQUEST_LIMITS.maxTextLength) => z.string().max(max)
const value = text(REQUEST_LIMITS.maxValueLength)

export const UnderstandingRequestSchema = z
  .object({
    fileName: text(),
    rowCount: z.number().int().nonnegative(),
    columnCount: z.number().int().nonnegative(),
    malformedRowCount: z.number().int().nonnegative(),
    columns: z
      .array(
        z
          .object({
            name: text(),
            inferredType: z.enum([
              'integer',
              'decimal',
              'boolean',
              'date',
              'string',
              'mixed',
              'empty',
            ]),
            missingRatio: z.number().min(0).max(1),
            distinctCount: z.number().int().nonnegative(),
            uniquenessRatio: z.number().min(0).max(1),
            identifierReasons: z.array(text()).max(REQUEST_LIMITS.maxReasonsPerColumn),
            numericStats: z
              .object({ min: z.number(), max: z.number(), mean: z.number(), median: z.number() })
              .strict()
              .nullable(),
            topValues: z
              .array(z.object({ value, count: z.number().int().nonnegative() }).strict())
              .max(REQUEST_LIMITS.maxValuesPerColumn),
            sampleValues: z.array(value).max(REQUEST_LIMITS.maxValuesPerColumn),
          })
          .strict(),
      )
      .max(REQUEST_LIMITS.maxColumns),
    /**
     * Definitions the user has confirmed. Claude treats them as settled: it keeps them, builds on
     * them, and only raises a question if one clearly contradicts the data.
     */
    confirmed: z
      .object({
        name: text(OUTPUT_LIMITS.name).optional(),
        description: text(OUTPUT_LIMITS.description).optional(),
        rowMeaning: text(OUTPUT_LIMITS.rowMeaning).optional(),
        columns: z
          .array(
            z
              .object({
                name: text(),
                description: text(OUTPUT_LIMITS.columnDescription).optional(),
                role: z.enum(COLUMN_ROLES).optional(),
              })
              .strict(),
          )
          .max(REQUEST_LIMITS.maxColumns),
      })
      .strict()
      .optional(),
  })
  .strict()
export type UnderstandingRequest = z.infer<typeof UnderstandingRequestSchema>

/**
 * What the model must return. Kept free of length limits because structured outputs constrain the
 * shape, not string lengths; `reconcileUnderstanding` trims and filters afterwards.
 */
export const DatasetUnderstandingSchema = z.object({
  suggestedName: z.string().describe('A short, human-readable title for the dataset'),
  description: z
    .string()
    .describe('Two or three plain-English sentences on what the dataset contains'),
  rowMeaning: z.string().describe('What one row represents, starting "Each row is"'),
  rowKeyColumns: z
    .array(z.string())
    .describe('Column names that together identify a row; empty if unclear'),
  columns: z.array(
    z.object({
      name: z.string().describe('Exact column name from the profile'),
      description: z.string().describe('One plain-English sentence on what the column holds'),
      role: z.enum(COLUMN_ROLES),
      confidence: z.enum(CONFIDENCE_LEVELS),
    }),
  ),
  questions: z
    .array(
      z.object({
        question: z.string().describe('Something about the data the profile cannot settle'),
        columns: z.array(z.string()).describe('Column names the question is about'),
      }),
    )
    .describe('Important ambiguities only; empty if none'),
})
export type DatasetUnderstanding = z.infer<typeof DatasetUnderstandingSchema>

/** Successful endpoint response. */
export const UnderstandingResultSchema = z.object({
  understanding: DatasetUnderstandingSchema,
  model: z.string(),
  generatedAt: z.string(),
})
export type UnderstandingResult = z.infer<typeof UnderstandingResultSchema>

export const UNDERSTANDING_ERROR_CODES = [
  'not_configured',
  'invalid_request',
  'rate_limited',
  'declined',
  'invalid_response',
  'timeout',
  'upstream_error',
  'network_error',
] as const
export type UnderstandingErrorCode = (typeof UNDERSTANDING_ERROR_CODES)[number]

export const UnderstandingErrorSchema = z.object({
  error: z.object({ code: z.enum(UNDERSTANDING_ERROR_CODES), message: z.string() }),
})
export type UnderstandingError = z.infer<typeof UnderstandingErrorSchema>['error']

/**
 * Makes a model response safe to show: trims and caps text, drops columns that don't exist or
 * repeat, and keeps only real column names in key columns and questions. Pure.
 */
export function reconcileUnderstanding(
  raw: DatasetUnderstanding,
  columnNames: readonly string[],
): DatasetUnderstanding {
  const known = new Set(columnNames)
  const clip = (s: string, max: number) => {
    const t = s.trim()
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
  }
  const seen = new Set<string>()
  const columns = raw.columns.filter((c) => {
    if (!known.has(c.name) || seen.has(c.name)) return false
    seen.add(c.name)
    return true
  })

  return {
    suggestedName: clip(raw.suggestedName, OUTPUT_LIMITS.name),
    description: clip(raw.description, OUTPUT_LIMITS.description),
    rowMeaning: clip(raw.rowMeaning, OUTPUT_LIMITS.rowMeaning),
    rowKeyColumns: [...new Set(raw.rowKeyColumns)].filter((name) => known.has(name)),
    columns: columns.map((c) => ({
      ...c,
      description: clip(c.description, OUTPUT_LIMITS.columnDescription),
    })),
    questions: raw.questions
      .map((q) => ({
        question: clip(q.question, OUTPUT_LIMITS.question),
        columns: [...new Set(q.columns)].filter((name) => known.has(name)),
      }))
      .filter((q) => q.question.length > 0)
      .slice(0, OUTPUT_LIMITS.maxQuestions),
  }
}
