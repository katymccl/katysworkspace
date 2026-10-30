/**
 * The contract between the browser and the full-data endpoints, /api/files and /api/analyse. Shared
 * by both sides, so it must only import `zod` and other server-safe schema files.
 *
 * In a workspace with full data on, the workspace's CSVs are uploaded to Anthropic once (gzipped on
 * the way, to fit Vercel's request size limit) and Claude answers questions by running Python over
 * every row in its code execution sandbox, then reporting a result table through `report_answer`.
 */
import { z } from 'zod'
import { AskRequestSchema, CHART_TYPES } from './schema.js'

export const FULL_LIMITS = {
  /**
   * Largest upload request body. Vercel functions take about 4.5 MB; base64 and JSON add a little,
   * so this leaves room. Files bigger than this after compressing are answered from summaries.
   */
  maxUploadBodyBytes: 4_300_000,
  maxFiles: 20,
  maxFileNameLength: 200,
  maxAnalyseBodyBytes: 512 * 1024,
  maxResultRows: 1000,
  maxColumns: 50,
  /** Pieces of code shown under "Show code", each clipped. */
  maxCodeBlocks: 30,
  maxCodeLength: 8000,
} as const

const fileName = z.string().trim().min(1).max(FULL_LIMITS.maxFileNameLength)

export const FileRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('upload'),
      fileName,
      /** The CSV text, gzipped, then base64-encoded. */
      csvGzipBase64: z.string().min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal('delete'),
      fileIds: z.array(z.string().min(1).max(200)).min(1).max(100),
    })
    .strict(),
])
export type FileRequest = z.infer<typeof FileRequestSchema>

export const FileUploadResultSchema = z.object({ fileId: z.string() })
export const FileDeleteResultSchema = z.object({ deleted: z.number().int().nonnegative() })

/** A question for Claude to answer from the full data: the usual summaries plus the files. */
export const AnalyseRequestSchema = AskRequestSchema.extend({
  files: z
    .array(
      z
        .object({
          /** The dataset key (as in `datasets`) the file holds. */
          dataset: z.string().max(200),
          fileId: z.string().min(1).max(200),
          fileName,
        })
        .strict(),
    )
    .min(1)
    .max(FULL_LIMITS.maxFiles),
}).strict()
export type AnalyseRequest = z.infer<typeof AnalyseRequestSchema>

const cell = z.union([z.string(), z.number(), z.null()])

/** What Claude reports through the `report_answer` tool once its analysis is done. */
export const ReportAnswerSchema = z.object({
  answerable: z.boolean(),
  message: z.string(),
  steps: z.array(z.string()),
  notes: z.array(z.string()),
  columns: z.array(z.object({ label: z.string(), numeric: z.boolean() })),
  rows: z.array(z.array(cell)),
  chart: z.object({
    type: z.enum(CHART_TYPES),
    x: z.string(),
    y: z.string(),
    by: z.string(),
  }),
})
export type ReportAnswer = z.infer<typeof ReportAnswerSchema>

export const AnalyseResultSchema = z.object({
  answer: ReportAnswerSchema,
  /** The code Claude ran, in order, for "Show code". */
  code: z.array(z.string()),
  model: z.string(),
  generatedAt: z.string(),
})
export type AnalyseResult = z.infer<typeof AnalyseResultSchema>

/**
 * The `report_answer` tool's input schema, for strict tool use: every object closes with
 * `additionalProperties: false` and lists all its properties as required.
 */
export const REPORT_ANSWER_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answerable', 'message', 'steps', 'notes', 'columns', 'rows', 'chart'],
  properties: {
    answerable: {
      type: 'boolean',
      description: 'False when the data cannot answer the question; then explain why in message',
    },
    message: {
      type: 'string',
      description:
        'One or two plain sentences answering the question, with the key figures, or saying why it cannot be answered and what would help',
    },
    steps: {
      type: 'array',
      items: { type: 'string' },
      description: 'The steps you took, in plain English without code terms, in order',
    },
    notes: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Anything that affects how to read the result: rows left out and why, values that did not match, assumptions',
    },
    columns: {
      type: 'array',
      description: 'Headings of the result table, with whether each column holds numbers',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'numeric'],
        properties: { label: { type: 'string' }, numeric: { type: 'boolean' } },
      },
    },
    rows: {
      type: 'array',
      description: `The result table's rows, at most ${FULL_LIMITS.maxResultRows}, one value per column; null for blank`,
      items: {
        type: 'array',
        items: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
      },
    },
    chart: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'x', 'y', 'by'],
      properties: {
        type: { type: 'string', enum: [...CHART_TYPES] },
        x: { type: 'string', description: 'Heading of the category or period column' },
        y: { type: 'string', description: 'Heading of the number column' },
        by: { type: 'string', description: 'For a heatmap, the second category column; else empty' },
      },
    },
  },
} as const

const LIMITS = { message: 1200, text: 400, label: 80, cell: 400, maxSteps: 20, maxNotes: 10 }

/**
 * Makes a reported answer safe to show: trims text, limits rows and columns, makes every row as
 * long as the headings, turns numeric columns' number-like text into numbers, and clears chart
 * headings that aren't in the table. Pure.
 */
export function reconcileReport(raw: ReportAnswer): ReportAnswer {
  const columns = raw.columns
    .slice(0, FULL_LIMITS.maxColumns)
    .map((c, i) => ({ label: clip(c.label, LIMITS.label) || `Column ${i + 1}`, numeric: c.numeric }))
  const rows = raw.answerable
    ? raw.rows.slice(0, FULL_LIMITS.maxResultRows).map((r) =>
        columns.map((c, i) => {
          const v = r[i] ?? null
          if (v === null) return null
          if (typeof v === 'number') return Number.isFinite(v) ? v : null
          const text = clip(v, LIMITS.cell)
          if (c.numeric) {
            const n = Number(text.replace(/[,\s]/g, ''))
            if (text !== '' && Number.isFinite(n)) return n
          }
          return text === '' ? null : text
        }),
      )
    : []
  const labels = new Set(columns.map((c) => c.label))
  const heading = (label: string) => (labels.has(label) ? label : '')
  return {
    answerable: raw.answerable,
    message: clip(raw.message, LIMITS.message),
    steps: raw.steps.map((s) => clip(s, LIMITS.text)).filter(Boolean).slice(0, LIMITS.maxSteps),
    notes: raw.notes.map((s) => clip(s, LIMITS.text)).filter(Boolean).slice(0, LIMITS.maxNotes),
    columns: raw.answerable ? columns : [],
    rows,
    chart: {
      type: raw.answerable ? raw.chart.type : 'none',
      x: heading(raw.chart.x),
      y: heading(raw.chart.y),
      by: heading(raw.chart.by),
    },
  }
}

function clip(s: string, max: number): string {
  const t = s.trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

