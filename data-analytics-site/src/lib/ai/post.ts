import type { z } from 'zod'
import { UnderstandingErrorSchema, type UnderstandingError } from '../understanding/schema'

export type AiOutcome<T> = { ok: true; result: T } | { ok: false; error: UnderstandingError }

const DEFAULT_TIMEOUT_MS = 75_000

/**
 * POSTs JSON to one of sema's same-origin AI endpoints and validates the reply. Never throws:
 * every failure becomes an `{ ok: false }` outcome the UI can show next to deterministic results.
 */
export async function postToAi<T>(
  endpoint: string,
  body: unknown,
  resultSchema: z.ZodType<T>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<AiOutcome<T>> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: combined,
    })
  } catch {
    return timeout.aborted
      ? fail('timeout', 'The AI took too long to respond.')
      : fail('network_error', "Couldn't reach the server.")
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    return fail(
      'upstream_error',
      `The server returned an unreadable response (${response.status}).`,
    )
  }

  if (!response.ok) {
    const parsed = UnderstandingErrorSchema.safeParse(json)
    return parsed.success
      ? { ok: false, error: parsed.data.error }
      : fail('upstream_error', `The server returned an error (${response.status}).`)
  }

  // The server validates too; checking again here means a bad deploy can't break the UI.
  const parsed = resultSchema.safeParse(json)
  return parsed.success
    ? { ok: true, result: parsed.data }
    : fail('invalid_response', "The AI's answer wasn't in the expected format.")
}

function fail<T>(code: UnderstandingError['code'], message: string): AiOutcome<T> {
  return { ok: false, error: { code, message } }
}
