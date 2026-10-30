import { postToAi, type AiOutcome } from '../ai/post'
import type { DiagramLink } from '../relationships/merge'
import type { DatasetSummary } from '../relationships/request'
import { OUTPUT_LIMITS, REQUEST_LIMITS } from '../understanding/schema'
import {
  SuggestQuestionsResultSchema,
  reconcileQuestions,
  type SuggestQuestionsRequest,
  type SuggestQuestionsResult,
} from './questions'
import {
  ASK_LIMITS,
  AskResultSchema,
  reconcilePlan,
  type AskRequest,
  type AskResult,
} from './schema'

/**
 * Builds the request: the question, dataset summaries (definitions, profile basics and a few
 * example values per column, never the rows) and the links that can bring datasets together:
 * those the user confirmed or drew and those Claude found likely or possible (see `usableLinks`).
 */
export function buildAskRequest(
  question: string,
  datasets: readonly DatasetSummary[],
  usable: readonly DiagramLink[],
  previousQuestions: readonly string[] = [],
): AskRequest {
  const t = (s: string, max: number = REQUEST_LIMITS.maxTextLength) =>
    s.length > max ? s.slice(0, max) : s

  const links: AskRequest['links'] = usable.slice(0, ASK_LIMITS.maxLinks).map((l) => ({
    from: l.from,
    to: l.to,
    // Columns that share no values say nothing about repeats, so assume the worst.
    cardinality: l.cardinality ?? 'many-to-many',
    confirmed: l.confirmed,
  }))

  return {
    question: question.trim().slice(0, ASK_LIMITS.maxQuestionLength),
    datasets: datasets.slice(0, ASK_LIMITS.maxDatasets).map((d) => ({
      key: t(d.key),
      name: t(d.name, OUTPUT_LIMITS.name),
      fileName: t(d.fileName),
      ...(d.description && { description: t(d.description, OUTPUT_LIMITS.description) }),
      ...(d.rowMeaning && { rowMeaning: t(d.rowMeaning, OUTPUT_LIMITS.rowMeaning) }),
      rowCount: d.profile.rowCount,
      columns: d.profile.columns.slice(0, REQUEST_LIMITS.maxColumns).map((c) => {
        const def = d.columnDefinitions.get(c.name)
        // The most common values say best how categories are written; otherwise the first few.
        const examples = c.topValues?.length ? c.topValues.map((v) => v.value) : c.sampleValues
        return {
          name: t(c.name),
          type: c.inferredType,
          ...(def?.role && { role: def.role }),
          ...(def?.glossaryTerm && { glossaryTerm: t(def.glossaryTerm) }),
          ...(def?.description && {
            description: t(def.description, OUTPUT_LIMITS.columnDescription),
          }),
          distinctCount: c.distinctCount,
          examples: examples
            .slice(0, REQUEST_LIMITS.maxValuesPerColumn)
            .map((v) => t(v, REQUEST_LIMITS.maxValueLength)),
        }
      }),
    })),
    links: links.slice(0, ASK_LIMITS.maxLinks).map((l) => ({
      ...l,
      from: { dataset: t(l.from.dataset), column: t(l.from.column) },
      to: { dataset: t(l.to.dataset), column: t(l.to.column) },
    })),
    ...(previousQuestions.length > 0 && {
      previousQuestions: previousQuestions
        .slice(-ASK_LIMITS.maxPreviousQuestions)
        .map((q) => t(q, ASK_LIMITS.maxQuestionLength)),
    }),
  }
}

/** The same summaries and links as a question, for asking Claude what to ask. */
export function buildSuggestRequest(
  datasets: readonly DatasetSummary[],
  usable: readonly DiagramLink[],
): SuggestQuestionsRequest {
  const { datasets: summaries, links } = buildAskRequest('', datasets, usable)
  return { datasets: summaries, links }
}

export async function requestQuestions(
  request: SuggestQuestionsRequest,
  signal?: AbortSignal,
): Promise<AiOutcome<SuggestQuestionsResult>> {
  const outcome = await postToAi('/api/questions', request, SuggestQuestionsResultSchema, {
    signal,
  })
  if (!outcome.ok) return outcome
  return {
    ok: true,
    result: { ...outcome.result, questions: reconcileQuestions(outcome.result.questions) },
  }
}

export async function requestAnswer(
  request: AskRequest,
  signal?: AbortSignal,
): Promise<AiOutcome<AskResult>> {
  const outcome = await postToAi('/api/ask', request, AskResultSchema, { signal })
  if (!outcome.ok) return outcome
  return {
    ok: true,
    result: { ...outcome.result, answer: reconcilePlan(outcome.result.answer, request) },
  }
}
