import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CleanRequest } from '../../src/lib/clean/schema.js'

// The real SDK's error classes, but `beta.messages.parse` is a mock: no real API calls.
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

const { handleClean, cleanMessage } = await import('./clean.js')

const body: CleanRequest = {
  dataset: {
    name: 'Orders',
    columns: [
      { name: 'amount', expected: 'number', examples: ['10.5', '20'] },
      { name: 'city', expected: 'text', examples: ['Leeds'] },
    ],
  },
  issues: [{ id: 'i1', problem: 'wrong-type', column: 'amount', row: { amount: '12,5' } }],
  categories: [
    {
      column: 'city',
      values: [
        { value: 'New York', count: 5 },
        { value: 'NY', count: 2 },
        { value: 'Leeds', count: 3 },
      ],
    },
  ],
}
const reply = (suggestions: object, extra = {}) => ({
  stop_reason: 'end_turn',
  model: 'claude-haiku-5-5',
  parsed_output: suggestions,
  ...extra,
})

let ipCounter = 0
const call = (overrides = {}) => handleClean({ body, ip: `10.6.0.${++ipCounter}`, ...overrides })

describe('handleClean', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    parse.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('keeps only suggestions that match the request', async () => {
    parse.mockResolvedValue(
      reply({
        fixes: [
          { id: 'i1', value: '12.5', reason: 'Comma used as decimal point' },
          { id: 'i1', value: '13', reason: 'duplicate' },
          { id: 'i9', value: 'x', reason: 'unknown issue' },
        ],
        standardise: [
          { column: 'city', from: ['NY', 'Nowhere'], to: 'New York', reason: 'Same city' },
          { column: 'city', from: ['Leeds'], to: 'LEEDS', reason: 'only one spelling' },
          { column: 'country', from: ['UK'], to: 'United Kingdom', reason: 'unknown column' },
        ],
      }),
    )
    expect(await call()).toEqual({
      status: 200,
      body: {
        model: 'claude-haiku-5-5',
        suggestions: {
          fixes: [{ id: 'i1', value: '12.5', reason: 'Comma used as decimal point' }],
          standardise: [{ column: 'city', from: ['NY'], to: 'New York', reason: 'Same city' }],
        },
      },
    })
  })

  it('rejects a request with nothing to check, without calling Claude', async () => {
    const result = await call({ body: { ...body, issues: [], categories: [] } })
    expect(result.status).toBe(400)
    expect(parse).not.toHaveBeenCalled()
  })

  it('reports refusals', async () => {
    parse.mockResolvedValue(reply({}, { stop_reason: 'refusal' }))
    expect(await call()).toMatchObject({ status: 502, body: { error: { code: 'declined' } } })
  })
})

describe('cleanMessage', () => {
  it('sends the dataset, issues and categories in tagged sections', () => {
    const message = cleanMessage(body)
    expect(message).toContain('<issues>\n[{"id":"i1"')
    expect(message).toContain('<categories>')
  })
})
