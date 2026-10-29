import { postToAi, type AiOutcome } from '../ai/post'
import {
  UnderstandingResultSchema,
  reconcileUnderstanding,
  type UnderstandingRequest,
  type UnderstandingResult,
} from './schema'

export type UnderstandingOutcome = AiOutcome<UnderstandingResult>

/**
 * Asks the server to interpret a dataset summary. Never throws: every failure becomes an
 * `{ ok: false }` outcome the UI can show next to the (always available) profile.
 */
export async function requestUnderstanding(
  request: UnderstandingRequest,
  signal?: AbortSignal,
): Promise<UnderstandingOutcome> {
  const outcome = await postToAi('/api/understand', request, UnderstandingResultSchema, { signal })
  if (!outcome.ok) return outcome
  const columnNames = request.columns.map((c) => c.name)
  return {
    ok: true,
    result: {
      ...outcome.result,
      understanding: reconcileUnderstanding(outcome.result.understanding, columnNames),
    },
  }
}
