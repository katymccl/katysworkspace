// =========================
// api/_lib/claude.ts
// =========================
// Shared server-side plumbing for sema's AI endpoints: request guards (origin, size, rate limit,
// API key), the Claude client and model choice, and error mapping. Every endpoint goes through
// these so all of them get the same protections.
//
// The API key is read from process.env here and nowhere else; it never reaches the browser.

import Anthropic from '@anthropic-ai/sdk'
import type { UnderstandingError } from '../../src/lib/understanding/schema.js'

/**
 * The cheapest current Claude model by default; set SEMA_AI_MODEL (server env) to use another,
 * e.g. claude-sonnet-5-5 for richer descriptions.
 */
export const DEFAULT_MODEL = 'claude-haiku-5-5'

/** Models that accept the server-side refusal fallback (`fallbacks: 'default'`). */
const FALLBACK_MODELS: ReadonlySet<string> = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
])

const RATE_LIMIT = { requests: 10, windowMs: 60_000 }

export function configuredModel(): string {
  return process.env.SEMA_AI_MODEL?.trim() || DEFAULT_MODEL
}

/** Request parameters that turn on the refusal fallback, for models that support it. */
export function fallbackParams(model: string) {
  return FALLBACK_MODELS.has(model)
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    : {}
}

export interface AiRequestInput {
  body: unknown
  /** Size of the raw request body in bytes, when known. */
  bodyBytes?: number
  ip: string
  /** The request's Origin header, if any. */
  origin?: string
  /** The Host the request was sent to. */
  host?: string
}

export interface ErrorOutput {
  status: number
  body: { error: UnderstandingError }
}

export interface AiOutput<T> {
  status: number
  body: T | { error: UnderstandingError }
}

/**
 * Checks everything that doesn't depend on the endpoint: same-site origin, body size, rate limit
 * and that a key is configured. Returns a ready client, or the error to send.
 */
export function guardRequest(
  input: AiRequestInput,
  maxBodyBytes: number,
  /** How long to wait for Claude; generation needs longer than interpretation. */
  timeoutMs = 60_000,
): { ok: true; client: Anthropic; model: string } | { ok: false; error: ErrorOutput } {
  if (input.origin && input.host && !sameHost(input.origin, input.host)) {
    return { ok: false, error: fail(403, 'invalid_request', 'Requests must come from this site.') }
  }
  if ((input.bodyBytes ?? 0) > maxBodyBytes) {
    return { ok: false, error: fail(413, 'invalid_request', 'The request is too large.') }
  }
  if (isRateLimited(input.ip)) {
    return {
      ok: false,
      error: fail(429, 'rate_limited', 'Too many requests. Try again in a minute.'),
    }
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      error: fail(503, 'not_configured', 'AI interpretation is not set up on this server.'),
    }
  }
  return {
    ok: true,
    client: new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 }),
    model: configuredModel(),
  }
}

/** Maps SDK errors to safe, user-facing errors; never includes upstream details or the key. */
export function mapError(error: unknown, label: string): ErrorOutput {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    console.error(`${label}: AI credentials rejected`)
    return fail(503, 'not_configured', 'AI interpretation is not set up correctly on this server.')
  }
  if (error instanceof Anthropic.NotFoundError) {
    console.error(`${label}: configured model not found`)
    return fail(503, 'not_configured', 'The configured AI model is not available.')
  }
  if (error instanceof Anthropic.RateLimitError) {
    return fail(429, 'rate_limited', 'The AI is busy right now. Try again shortly.')
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return fail(504, 'timeout', 'The AI took too long to respond.')
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`${label}: AI request failed with status ${error.status}`)
    return fail(502, 'upstream_error', 'The AI service returned an error.')
  }
  // Includes structured-output parse failures raised by the SDK.
  console.error(`${label}: unexpected failure`, error instanceof Error ? error.name : typeof error)
  return fail(502, 'invalid_response', "The AI's answer couldn't be read.")
}

export function fail(
  status: number,
  code: UnderstandingError['code'],
  message: string,
): ErrorOutput {
  return { status, body: { error: { code, message } } }
}

function sameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

// Best-effort, per-instance limit shared by all AI endpoints: serverless instances don't share
// memory, so this slows down casual abuse but isn't a hard cap. The account spend limit is the
// backstop.
const recentRequests = new Map<string, number[]>()

function isRateLimited(ip: string, now = Date.now()): boolean {
  const recent = (recentRequests.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs)
  if (recent.length >= RATE_LIMIT.requests) {
    recentRequests.set(ip, recent)
    return true
  }
  recent.push(now)
  recentRequests.set(ip, recent)
  return false
}
