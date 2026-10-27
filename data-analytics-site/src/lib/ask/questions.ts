/**
 * The contract for /api/questions: Claude suggests questions worth asking about the open datasets,
 * from the same summaries "Ask your data" sends (never the rows). Shared by the browser and the
 * server, so it must only import `zod` and other server-safe schema files.
 */
import { z } from 'zod'
import { ASK_LIMITS, AskRequestSchema } from './schema.js'

export const QUESTION_LIMITS = { maxQuestions: 6, maxLength: 200 } as const

export const SuggestQuestionsRequestSchema = AskRequestSchema.omit({
  question: true,
  previousQuestions: true,
})
export type SuggestQuestionsRequest = z.infer<typeof SuggestQuestionsRequestSchema>

/** What the model must return. Shape only; `reconcileQuestions` enforces limits. */
export const SuggestedQuestionsSchema = z.object({
  questions: z
    .array(z.string())
    .describe('Short, plain-English questions the datasets can answer, most interesting first'),
})
export type SuggestedQuestions = z.infer<typeof SuggestedQuestionsSchema>

export const SuggestQuestionsResultSchema = z.object({
  questions: z.array(z.string()),
  model: z.string(),
})
export type SuggestQuestionsResult = z.infer<typeof SuggestQuestionsResultSchema>

/** One line each, no blanks or repeats (ignoring case), at most six, each a sensible length. */
export function reconcileQuestions(raw: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of raw) {
    const question = q.replace(/\s+/g, ' ').trim()
    const key = question.toLowerCase()
    if (!question || question.length > QUESTION_LIMITS.maxLength || seen.has(key)) continue
    seen.add(key)
    out.push(question.slice(0, ASK_LIMITS.maxQuestionLength))
    if (out.length === QUESTION_LIMITS.maxQuestions) break
  }
  return out
}
