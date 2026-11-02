/**
 * The contract between the browser and /api/relationships. Shared by both sides, so it must only
 * import `zod` and other server-safe schema files.
 */
import { z } from 'zod'
import { COLUMN_ROLES, OUTPUT_LIMITS, REQUEST_LIMITS } from '../understanding/schema.js'

export const RELATIONSHIP_LIMITS = {
  maxDatasets: 20,
  maxCandidates: 200,
  maxConfirmed: 100,
  maxBodyBytes: 512 * 1024,
} as const

export const CARDINALITIES = ['one-to-one', 'many-to-one', 'many-to-many'] as const
export const VERDICTS = ['likely', 'possible', 'unlikely'] as const
export type Verdict = (typeof VERDICTS)[number]

const text = (max: number = REQUEST_LIMITS.maxTextLength) => z.string().max(max)
const ratio = z.number().min(0).max(1)
const columnRef = z.object({ dataset: text(), column: text() }).strict()

/** A list of relationships the user has decided on, by dataset key and column. */
const decisions = z
  .object({
    links: z
      .array(z.object({ from: columnRef, to: columnRef }).strict())
      .max(RELATIONSHIP_LIMITS.maxConfirmed),
    similar: z
      .array(z.object({ datasets: z.tuple([text(), text()]) }).strict())
      .max(RELATIONSHIP_LIMITS.maxConfirmed),
  })
  .strict()

export const RelationshipRequestSchema = z
  .object({
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
                    /** The workspace glossary term the column follows, if any. */
                    glossaryTerm: text().optional(),
                    isPotentialIdentifier: z.boolean(),
                    distinctCount: z.number().int().nonnegative(),
                  })
                  .strict(),
              )
              .max(REQUEST_LIMITS.maxColumns),
          })
          .strict(),
      )
      .min(2)
      .max(RELATIONSHIP_LIMITS.maxDatasets),
    candidates: z
      .array(
        z.discriminatedUnion('kind', [
          z
            .object({
              kind: z.literal('key-link'),
              id: text(500),
              from: columnRef,
              to: columnRef,
              cardinality: z.enum(CARDINALITIES),
              sharedCount: z.number().int().nonnegative(),
              fromCoverage: ratio,
              toCoverage: ratio,
              namesMatch: z.boolean(),
              period: z.enum(['date', 'month', 'quarter', 'year', 'month-name']).nullable(),
              sharedExamples: z
                .array(text(REQUEST_LIMITS.maxValueLength))
                .max(REQUEST_LIMITS.maxValuesPerColumn),
            })
            .strict(),
          z
            .object({
              kind: z.literal('similar-structure'),
              id: text(500),
              datasets: z.tuple([text(), text()]),
              sharedColumns: z.array(text()).max(REQUEST_LIMITS.maxColumns),
              similarity: ratio,
            })
            .strict(),
        ]),
      )
      .max(RELATIONSHIP_LIMITS.maxCandidates),
    /** Relationships the user has confirmed: settled facts for the AI, not suggestions. */
    confirmed: decisions.optional(),
    /** Relationships the user has marked "not related": the AI must not suggest them. */
    rejected: decisions.optional(),
  })
  .strict()
export type RelationshipRequest = z.infer<typeof RelationshipRequestSchema>

/** What the model must return. String limits are applied afterwards by `reconcileAnalysis`. */
export const RelationshipAnalysisSchema = z.object({
  summary: z
    .string()
    .describe('Two or three plain sentences on how the datasets fit together, or that they do not'),
  links: z.array(
    z.object({
      candidateId: z
        .string()
        .describe('The id of the measured overlap this link uses, or an empty string if none'),
      from: z.object({ dataset: z.string(), column: z.string() }),
      to: z.object({ dataset: z.string(), column: z.string() }),
      verdict: z.enum(VERDICTS),
      description: z.string().describe('One plain sentence on what the link means'),
    }),
  ),
  similarDatasets: z.array(
    z.object({
      candidateId: z.string(),
      verdict: z.enum(VERDICTS),
      description: z.string().describe('One plain sentence on how the two datasets relate'),
    }),
  ),
  questions: z.array(
    z.object({
      question: z.string(),
      datasets: z.array(z.string()).describe('Dataset keys the question is about'),
    }),
  ),
})
export type RelationshipAnalysis = z.infer<typeof RelationshipAnalysisSchema>

export const RelationshipResultSchema = z.object({
  analysis: RelationshipAnalysisSchema,
  model: z.string(),
  generatedAt: z.string(),
})
export type RelationshipResult = z.infer<typeof RelationshipResultSchema>

const LIMITS = { summary: 800, description: 400, question: 400, maxQuestions: 10, maxNewLinks: 20 }

/**
 * Makes a model response safe to show: keeps judgements only for real candidates, keeps new links
 * only between real columns of different datasets, drops repeats, trims text. Pure.
 */
export function reconcileAnalysis(
  raw: RelationshipAnalysis,
  request: RelationshipRequest,
): RelationshipAnalysis {
  const columns = new Map(
    request.datasets.map((d) => [d.key, new Set(d.columns.map((c) => c.name))]),
  )
  const exists = (r: { dataset: string; column: string }) => columns.get(r.dataset)?.has(r.column)
  const linkIds = new Set(request.candidates.filter((c) => c.kind === 'key-link').map((c) => c.id))
  const similarIds = new Set(
    request.candidates.filter((c) => c.kind === 'similar-structure').map((c) => c.id),
  )
  const seen = new Set<string>()
  let newLinks = 0

  const links = raw.links.filter((l) => {
    if (l.candidateId) {
      if (!linkIds.has(l.candidateId) || seen.has(l.candidateId)) return false
      seen.add(l.candidateId)
      return true
    }
    const key = `${l.from.dataset}:${l.from.column}->${l.to.dataset}:${l.to.column}`
    if (
      !exists(l.from) ||
      !exists(l.to) ||
      l.from.dataset === l.to.dataset ||
      seen.has(key) ||
      newLinks >= LIMITS.maxNewLinks
    ) {
      return false
    }
    seen.add(key)
    newLinks++
    return true
  })

  return {
    summary: clip(raw.summary, LIMITS.summary),
    links: links.map((l) => ({ ...l, description: clip(l.description, LIMITS.description) })),
    similarDatasets: raw.similarDatasets
      .filter((s) => {
        if (!similarIds.has(s.candidateId) || seen.has(s.candidateId)) return false
        seen.add(s.candidateId)
        return true
      })
      .map((s) => ({ ...s, description: clip(s.description, LIMITS.description) })),
    questions: raw.questions
      .map((q) => ({
        question: clip(q.question, LIMITS.question),
        datasets: [...new Set(q.datasets)].filter((k) => columns.has(k)),
      }))
      .filter((q) => q.question.length > 0)
      .slice(0, LIMITS.maxQuestions),
  }
}

function clip(s: string, max: number): string {
  const t = s.trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}
