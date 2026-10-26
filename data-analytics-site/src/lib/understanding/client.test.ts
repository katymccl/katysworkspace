import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestUnderstanding } from './client'
import type { UnderstandingRequest } from './schema'

const request: UnderstandingRequest = {
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
  columns: [
    { name: 'id', description: 'An ID.', role: 'identifier', confidence: 'high' },
    { name: 'ghost', description: 'Not a column.', role: 'other', confidence: 'low' },
  ],
  questions: [],
}

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

describe('requestUnderstanding', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns a validated, reconciled result', async () => {
    respond(200, { understanding, model: 'claude-opus-5-5', generatedAt: '2026-10-25T00:00:00Z' })
    const outcome = await requestUnderstanding(request)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.understanding.columns.map((c) => c.name)).toEqual(['id'])
      expect(outcome.result.model).toBe('claude-opus-5-5')
    }
  })

  it('passes server errors through', async () => {
    respond(503, { error: { code: 'not_configured', message: 'No key.' } })
    expect(await requestUnderstanding(request)).toEqual({
      ok: false,
      error: { code: 'not_configured', message: 'No key.' },
    })
  })

  it('turns malformed success responses into an error instead of throwing', async () => {
    respond(200, { understanding: { suggestedName: 42 } })
    const outcome = await requestUnderstanding(request)
    expect(outcome).toMatchObject({ ok: false, error: { code: 'invalid_response' } })
  })

  it('turns unexpected error bodies and network failures into errors', async () => {
    respond(500, { message: 'boom' })
    expect(await requestUnderstanding(request)).toMatchObject({
      ok: false,
      error: { code: 'upstream_error' },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(await requestUnderstanding(request)).toMatchObject({
      ok: false,
      error: { code: 'network_error' },
    })
  })

  it('sends only the summary, as JSON, to the same-origin endpoint', async () => {
    respond(200, { understanding, model: 'm', generatedAt: 't' })
    await requestUnderstanding(request)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/understand')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual(request)
  })
})
