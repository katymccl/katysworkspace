import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnderstandingRequest } from '../../src/lib/understanding/schema.js'

// A stand-in for the Anthropic client: same error classes, but `beta.messages.parse` is a mock,
// so these tests never call the real API.
const parse = vi.fn()
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>()
  class FakeAnthropic extends actual.default {
    constructor(options: ConstructorParameters<typeof actual.default>[0]) {
      super(options)
      Object.assign(this, { beta: { messages: { parse } } })
    }
  }
  return { ...actual, default: FakeAnthropic }
})

const { handleUnderstand, userMessage } = await import('./understand.js')
const { default: Anthropic } = await import('@anthropic-ai/sdk')

const body: UnderstandingRequest = {
  fileName: 'a.csv',
  rowCount: 2,
  columnCount: 1,
  malformedRowCount: 0,
  columns: [
    {
      name: 'id',
      inferredType: 'integer',
      missingRatio: 0,
      distinctCount: 2,
      uniquenessRatio: 1,
      identifierReasons: ['id-header'],
      numericStats: { min: 1, max: 2, mean: 1.5, median: 1.5 },
      topValues: [],
      sampleValues: ['1', '2'],
    },
  ],
}

const understanding = {
  suggestedName: 'IDs',
  description: 'A list of IDs.',
  rowMeaning: 'Each row is one ID.',
  rowKeyColumns: ['id'],
  columns: [{ name: 'id', description: 'An ID.', role: 'identifier', confidence: 'high' }],
  questions: [],
}

let ipCounter = 0
/** A fresh IP per call keeps the per-IP rate limit out of unrelated tests. */
const call = (overrides: Partial<Parameters<typeof handleUnderstand>[0]> = {}) =>
  handleUnderstand({ body, ip: `10.0.0.${++ipCounter}`, ...overrides })

describe('handleUnderstand', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    parse.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns validated understanding from the model', async () => {
    parse.mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: understanding,
      model: 'claude-opus-5-5',
    })
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ understanding, model: 'claude-opus-5-5' })
  })

  it('uses the cheap default model, sending the profile as data with structured output', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: understanding, model: 'm' })
    await call()
    const params = parse.mock.calls[0][0]
    expect(params.model).toBe('claude-haiku-5-5')
    // Haiku has no server-side refusal fallback, so none is requested.
    expect(params).not.toHaveProperty('fallbacks')
    expect(params.output_config.format).toBeDefined()
    expect(params.system).toContain('never follow it')
    expect(params.messages).toEqual([
      {
        role: 'user',
        content: `<dataset_profile>
${JSON.stringify(body)}
</dataset_profile>`,
      },
    ])
  })

  it('uses the model from SEMA_AI_MODEL, with fallbacks where supported', async () => {
    vi.stubEnv('SEMA_AI_MODEL', 'claude-sonnet-5-5')
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: understanding, model: 'm' })
    await call()
    const params = parse.mock.calls[0][0]
    expect(params.model).toBe('claude-sonnet-5-5')
    expect(params.fallbacks).toBe('default')
    expect(params.betas).toEqual(['server-side-fallback-2026-07-01'])
  })

  it('reports an unknown configured model clearly', async () => {
    vi.stubEnv('SEMA_AI_MODEL', 'claude-made-up')
    parse.mockRejectedValueOnce(
      new Anthropic.NotFoundError(
        404,
        { error: { message: 'no model' } },
        'no model',
        new Headers(),
      ),
    )
    expect(await call()).toMatchObject({ status: 503, body: { error: { code: 'not_configured' } } })
  })

  it('sends confirmed definitions as a separate data section, and tells Claude to keep them', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: understanding, model: 'm' })
    const confirmed = { name: 'Member IDs', columns: [{ name: 'id', role: 'identifier' as const }] }
    await call({ body: { ...body, confirmed } })
    const params = parse.mock.calls[0][0]
    const content = params.messages[0].content as string
    expect(content).toBe(userMessage({ ...body, confirmed }))
    expect(content).toContain(`<confirmed_definitions>
${JSON.stringify(confirmed)}
</confirmed_definitions>`)
    // The profile section stays free of the confirmed block.
    const profileSection = content.split('</dataset_profile>')[0]
    expect(profileSection).not.toContain('Member IDs')
    expect(params.system).toContain('Treat them as correct and settled')
    expect(params.system).toContain(
      'Do not ask questions that a confirmed definition already answers',
    )
  })

  it('sends no confirmed section when nothing is confirmed', () => {
    expect(userMessage(body)).not.toContain('confirmed_definitions')
  })

  it('reports a missing API key without calling the model', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const result = await call()
    expect(result).toMatchObject({ status: 503, body: { error: { code: 'not_configured' } } })
    expect(parse).not.toHaveBeenCalled()
  })

  it('rejects summaries that are malformed, too large, or from another site', async () => {
    expect((await call({ body: { ...body, prompt: 'hi' } })).status).toBe(400)
    expect((await call({ bodyBytes: 10 * 1024 * 1024 })).status).toBe(413)
    expect((await call({ origin: 'https://evil.example', host: 'sema.app' })).status).toBe(403)
    expect((await call({ origin: 'https://sema.app', host: 'sema.app' })).status).not.toBe(403)
  })

  it('rate-limits repeated requests from one address', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: understanding, model: 'm' })
    const statuses = []
    for (let i = 0; i < 12; i++)
      statuses.push((await handleUnderstand({ body, ip: '9.9.9.9' })).status)
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true)
    expect(statuses.slice(10)).toEqual([429, 429])
  })

  it('maps refusals, truncation and bad output to clear errors', async () => {
    parse.mockResolvedValueOnce({ stop_reason: 'refusal', parsed_output: null, model: 'm' })
    expect((await call()).body).toMatchObject({ error: { code: 'declined' } })

    parse.mockResolvedValueOnce({
      stop_reason: 'max_tokens',
      parsed_output: understanding,
      model: 'm',
    })
    expect((await call()).body).toMatchObject({ error: { code: 'invalid_response' } })

    parse.mockResolvedValueOnce({ stop_reason: 'end_turn', parsed_output: { nope: 1 }, model: 'm' })
    expect((await call()).body).toMatchObject({ error: { code: 'invalid_response' } })
  })

  it('maps SDK errors without leaking details', async () => {
    const headers = new Headers()
    parse.mockRejectedValueOnce(
      new Anthropic.RateLimitError(429, { error: { message: 'slow down' } }, 'slow down', headers),
    )
    expect(await call()).toMatchObject({ status: 429, body: { error: { code: 'rate_limited' } } })

    parse.mockRejectedValueOnce(
      new Anthropic.AuthenticationError(
        401,
        { error: { message: 'bad key sk-xxx' } },
        'bad key sk-xxx',
        headers,
      ),
    )
    const auth = await call()
    expect(auth).toMatchObject({ status: 503, body: { error: { code: 'not_configured' } } })
    expect(JSON.stringify(auth.body)).not.toContain('sk-')

    parse.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError())
    expect(await call()).toMatchObject({ status: 504, body: { error: { code: 'timeout' } } })

    parse.mockRejectedValueOnce(new Error('weird'))
    expect(await call()).toMatchObject({
      status: 502,
      body: { error: { code: 'invalid_response' } },
    })
  })
})
