/**
 * The contract between the browser and /api/ask. Shared by both sides, so it must only import
 * `zod` and other server-safe schema files.
 *
 * Claude never sees the rows: it gets dataset summaries and returns a query plan, which the
 * browser runs against the full data (see ./execute.ts).
 */
import { z } from 'zod'
import { COLUMN_ROLES, OUTPUT_LIMITS, REQUEST_LIMITS } from '../understanding/schema.js'

export const ASK_LIMITS = {
  maxQuestionLength: 500,
  maxDatasets: 20,
  maxLinks: 100,
  maxPreviousQuestions: 5,
  maxBodyBytes: 512 * 1024,
  /** Most rows an answer shows (and downloads). */
  maxResultRows: 1000,
  defaultResultRows: 100,
} as const

export const FILTER_OPS = [
  'equals',
  'not_equals',
  'greater_than',
  'at_least',
  'less_than',
  'at_most',
  'contains',
  'not_contains',
  'one_of',
  'is_missing',
  'is_not_missing',
] as const
export type FilterOp = (typeof FILTER_OPS)[number]

export const AGGREGATES = ['count', 'count_distinct', 'sum', 'average', 'min', 'max'] as const
export type Aggregate = (typeof AGGREGATES)[number]

export const DATE_BUCKETS = ['none', 'year', 'quarter', 'month', 'week', 'day'] as const
export type DateBucket = (typeof DATE_BUCKETS)[number]

export const CHART_TYPES = ['none', 'bar', 'line'] as const

const text = (max: number = REQUEST_LIMITS.maxTextLength) => z.string().max(max)
const columnRef = z.object({ dataset: text(), column: text() }).strict()

export const AskRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(ASK_LIMITS.maxQuestionLength),
    datasets: z
      .array(
        z
          .object({
            key: text(),
            name: text(OUTPUT_LIMITS.name),
            fileName: text(),
            description: text(OUTPUT_LIMITS.description).optional(),
            rowMeaning: text(OUTPUT_LIMITS.rowMeaning).optional(),
            rowCount: z.number().int().nonnegative(),
            columns: z
              .array(
                z
                  .object({
                    name: text(),
                    type: z.enum([
                      'integer',
                      'decimal',
                      'boolean',
                      'date',
                      'string',
                      'mixed',
                      'empty',
                    ]),
                    role: z.enum(COLUMN_ROLES).optional(),
                    description: text(OUTPUT_LIMITS.columnDescription).optional(),
                    distinctCount: z.number().int().nonnegative(),
                    /** A few real values, so filters can match how the data is written. */
                    examples: z
                      .array(text(REQUEST_LIMITS.maxValueLength))
                      .max(REQUEST_LIMITS.maxValuesPerColumn),
                  })
                  .strict(),
              )
              .max(REQUEST_LIMITS.maxColumns),
          })
          .strict(),
      )
      .min(1)
      .max(ASK_LIMITS.maxDatasets),
    /** Columns that hold the same values in two datasets: confirmed by the user, or found. */
    links: z
      .array(
        z
          .object({
            from: columnRef,
            to: columnRef,
            cardinality: z.enum(['one-to-one', 'many-to-one', 'many-to-many']),
            confirmed: z.boolean(),
          })
          .strict(),
      )
      .max(ASK_LIMITS.maxLinks),
    /** Earlier questions in this conversation, so follow-ups like "and by month?" make sense. */
    previousQuestions: z
      .array(text(ASK_LIMITS.maxQuestionLength))
      .max(ASK_LIMITS.maxPreviousQuestions)
      .optional(),
  })
  .strict()
export type AskRequest = z.infer<typeof AskRequestSchema>

const modelRef = z.object({ dataset: z.string(), column: z.string() })

/**
 * The query plan the model must return. Kept free of length and number limits because structured
 * outputs constrain the shape only; `reconcilePlan` checks and trims it afterwards.
 */
export const AskAnswerSchema = z.object({
  answerable: z
    .boolean()
    .describe('False when the datasets cannot answer the question; then explain why in "message"'),
  message: z
    .string()
    .describe(
      'One or two plain sentences: what the result shows when answerable, or why not and what would help',
    ),
  plan: z.object({
    from: z.string().describe('Key of the dataset whose rows the question is about'),
    joins: z.array(
      z.object({
        dataset: z.string().describe('Key of the dataset to bring in'),
        on: modelRef.describe('Column already available (base or earlier join) to match on'),
        column: z.string().describe('Column of the joined dataset holding the same values'),
      }),
    ),
    filters: z.array(
      z.object({
        column: modelRef,
        op: z.enum(FILTER_OPS),
        values: z
          .array(z.string())
          .describe('The value to compare with; several only for one_of; empty for is_missing'),
      }),
    ),
    groupBy: z.array(
      z.object({
        column: modelRef,
        bucket: z.enum(DATE_BUCKETS).describe('For date columns: the period to group by'),
        label: z.string().describe('Short heading for this column of the result'),
      }),
    ),
    measures: z.array(
      z.object({
        fn: z.enum(AGGREGATES),
        column: modelRef
          .nullable()
          .describe('The column to aggregate; null for count, which counts rows'),
        label: z.string().describe('Short heading, e.g. "Total revenue" or "Orders"'),
      }),
    ),
    select: z
      .array(z.object({ column: modelRef, label: z.string() }))
      .describe('Columns to list when the answer is rows rather than totals'),
    sort: z.array(
      z.object({
        label: z.string().describe('Heading of a result column'),
        direction: z.enum(['ascending', 'descending']),
      }),
    ),
    limit: z.number().int().describe('Most rows to show; 0 for the default'),
  }),
  chart: z.object({
    type: z.enum(CHART_TYPES),
    x: z.string().describe('Heading of the result column for categories or time'),
    y: z.string().describe('Heading of the numeric result column'),
  }),
})
export type AskAnswer = z.infer<typeof AskAnswerSchema>
export type QueryPlan = AskAnswer['plan']
export type PlanRef = z.infer<typeof modelRef>

export const AskResultSchema = z.object({
  answer: AskAnswerSchema,
  model: z.string(),
  generatedAt: z.string(),
})
export type AskResult = z.infer<typeof AskResultSchema>

const LIMITS = { message: 600, label: 80, value: 200, maxValues: 50, maxItems: 20 }

/**
 * Makes a model answer safe to run and show: drops steps that refer to datasets or columns that
 * don't exist (or aren't brought in by a join), repeats and unknown sort headings; trims text;
 * clamps the row limit. An answerable plan left with nothing to run becomes unanswerable. Pure.
 */
export function reconcilePlan(raw: AskAnswer, request: AskRequest): AskAnswer {
  const columns = new Map(
    request.datasets.map((d) => [d.key, new Set(d.columns.map((c) => c.name))]),
  )
  const message = clip(raw.message, LIMITS.message)
  const unanswerable = (why: string): AskAnswer => ({
    answerable: false,
    message: message || why,
    plan: emptyPlan(request.datasets[0]?.key ?? ''),
    chart: { type: 'none', x: '', y: '' },
  })
  if (!raw.answerable) return unanswerable("These datasets can't answer that question.")

  const p = raw.plan
  if (!columns.has(p.from))
    return unanswerable("The AI's plan referred to a dataset that isn't open.")

  // Datasets in scope grow as joins are added; each join must match on a column already in scope.
  const inScope = new Set([p.from])
  const joins = p.joins
    .filter((j) => {
      const ok =
        !inScope.has(j.dataset) &&
        columns.get(j.dataset)?.has(j.column) &&
        inScope.has(j.on.dataset) &&
        columns.get(j.on.dataset)?.has(j.on.column)
      if (ok) inScope.add(j.dataset)
      return ok
    })
    .slice(0, LIMITS.maxItems)
  const valid = (r: PlanRef) =>
    inScope.has(r.dataset) && (columns.get(r.dataset)?.has(r.column) ?? false)

  const labels = new Set<string>()
  const uniqueLabel = (label: string, fallback: string) => {
    const base = clip(label, LIMITS.label) || clip(fallback, LIMITS.label)
    let candidate = base
    for (let n = 2; labels.has(candidate); n++) candidate = `${base} (${n})`
    labels.add(candidate)
    return candidate
  }

  const groupBy = p.groupBy
    .filter((g) => valid(g.column))
    .slice(0, LIMITS.maxItems)
    .map((g) => ({ ...g, label: uniqueLabel(g.label, g.column.column) }))
  const measures = p.measures
    .filter((m) => (m.column === null ? m.fn === 'count' : valid(m.column)))
    .slice(0, LIMITS.maxItems)
    .map((m) => ({
      ...m,
      label: uniqueLabel(m.label, m.column ? `${m.fn} of ${m.column.column}` : 'Rows'),
    }))
  const aggregating = groupBy.length > 0 || measures.length > 0
  const select = aggregating
    ? []
    : p.select
        .filter((s) => valid(s.column))
        .slice(0, LIMITS.maxItems * 2)
        .map((s) => ({ ...s, label: uniqueLabel(s.label, s.column.column) }))

  if (!aggregating && select.length === 0) {
    return unanswerable("The AI's plan didn't say what to show.")
  }

  const filters = p.filters
    .filter((f) => valid(f.column))
    .filter((f) => f.op === 'is_missing' || f.op === 'is_not_missing' || f.values.length > 0)
    .slice(0, LIMITS.maxItems)
    .map((f) => ({
      ...f,
      values: (f.op === 'one_of' ? f.values : f.values.slice(0, 1))
        .slice(0, LIMITS.maxValues)
        .map((v) => clip(v, LIMITS.value)),
    }))

  const seenSort = new Set<string>()
  const sort = p.sort.filter((s) => {
    if (!labels.has(s.label) || seenSort.has(s.label)) return false
    seenSort.add(s.label)
    return true
  })

  const limit =
    p.limit > 0
      ? Math.min(Math.floor(p.limit), ASK_LIMITS.maxResultRows)
      : ASK_LIMITS.defaultResultRows
  const chart =
    raw.chart.type !== 'none' && labels.has(raw.chart.x) && labels.has(raw.chart.y)
      ? raw.chart
      : { type: 'none' as const, x: '', y: '' }

  return {
    answerable: true,
    message,
    plan: { from: p.from, joins, filters, groupBy, measures, select, sort, limit },
    chart,
  }
}

function emptyPlan(from: string): QueryPlan {
  return { from, joins: [], filters: [], groupBy: [], measures: [], select: [], sort: [], limit: 0 }
}

function clip(s: string, max: number): string {
  const t = s.trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}
