import { postToAi, type AiOutcome } from '../ai/post'
import { isConfirmed, type ConfirmedRelationship } from '../relationships/confirmed'
import type { RelationshipCandidate } from '../relationships/detect'
import type { DatasetSummary } from '../relationships/request'
import { OUTPUT_LIMITS, REQUEST_LIMITS } from '../understanding/schema'
import {
  ASK_LIMITS,
  AskResultSchema,
  reconcilePlan,
  type AskRequest,
  type AskResult,
} from './schema'

/**
 * Builds the request: the question, dataset summaries (definitions, profile basics and a few
 * example values per column, never the rows) and the links that can bring datasets together.
 *
 * Links are the user's confirmed ones plus those found in the values, minus any marked "not
 * related". Weak value matches are left out, so Claude isn't tempted to match on coincidences.
 */
export function buildAskRequest(
  question: string,
  datasets: readonly DatasetSummary[],
  candidates: readonly RelationshipCandidate[],
  confirmed: readonly ConfirmedRelationship[] = [],
  rejected: readonly ConfirmedRelationship[] = [],
  previousQuestions: readonly string[] = [],
): AskRequest {
  const t = (s: string, max: number = REQUEST_LIMITS.maxTextLength) =>
    s.length > max ? s.slice(0, max) : s

  const links: AskRequest['links'] = []
  const confirmedLinks = confirmed.filter((c) => c.kind === 'link')
  for (const c of candidates) {
    if (c.kind !== 'key-link') continue
    const r: ConfirmedRelationship = { kind: 'link', from: c.from, to: c.to }
    if (isConfirmed(rejected, r)) continue
    const isUserConfirmed = isConfirmed(confirmedLinks, r)
    if (!isUserConfirmed && c.strength === 'weak') continue
    links.push({ from: c.from, to: c.to, cardinality: c.cardinality, confirmed: isUserConfirmed })
  }
  // Confirmed links the values didn't show: how often values repeat is unknown, so say so.
  for (const c of confirmedLinks) {
    if (links.some((l) => isConfirmed([{ kind: 'link', from: l.from, to: l.to }], c))) continue
    links.push({ from: c.from, to: c.to, cardinality: 'many-to-many', confirmed: true })
  }

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
