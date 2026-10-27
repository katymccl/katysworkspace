import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanRequest } from '../../src/lib/generate/plan.js'

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

const { handlePlan, planMessage } = await import('./plan.js')

const body: PlanRequest = { description: 'Customers of a bookshop', columns: [] }
const reply = (plan: object, extra = {}) => ({
  stop_reason: 'end_turn',
  model: 'claude-haiku-5-5',
  parsed_output: plan,
  ...extra,
})

let ipCounter = 0
const call = (overrides = {}) => handlePlan({ body, ip: `10.4.0.${++ipCounter}`, ...overrides })

describe('handlePlan', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    parse.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns a cleaned-up plan', async () => {
    parse.mockResolvedValue(
      reply({
        description: 'One row per customer,\nwith their city.',
        columns: [
          { name: 'customer_id', hint: '' },
          { name: 'city: town', hint: 'UK cities' },
          { name: 'Customer_ID', hint: 'duplicate' },
          { name: '  ', hint: '' },
        ],
        rowCount: 500,
      }),
    )
    expect(await call()).toEqual({
      status: 200,
      body: {
        model: 'claude-haiku-5-5',
        plan: {
          description: 'One row per customer, with their city.',
          columns: [
            { name: 'customer_id', hint: '' },
            { name: 'city town', hint: 'UK cities' },
          ],
          rowCount: 100,
        },
      },
    })
  })

  it('rejects an empty draft without calling Claude', async () => {
    const result = await call({ body: { description: '  ', columns: [] } })
    expect(result.status).toBe(400)
    expect(parse).not.toHaveBeenCalled()
  })

  it('reports refusals and plans with no columns', async () => {
    parse.mockResolvedValueOnce(reply({}, { stop_reason: 'refusal' }))
    expect(await call()).toMatchObject({ status: 502, body: { error: { code: 'declined' } } })
    parse.mockResolvedValueOnce(reply({ description: 'x', columns: [], rowCount: 5 }))
    expect(await call()).toMatchObject({
      status: 502,
      body: { error: { code: 'invalid_response' } },
    })
  })

  it('needs an API key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(await call()).toMatchObject({ status: 503, body: { error: { code: 'not_configured' } } })
  })
})

describe('planMessage', () => {
  it("includes the user's columns and hints, and marks empty parts", () => {
    const message = planMessage({
      description: '',
      columns: [{ name: 'qty', hint: '1 to 5' }, { name: 'sku' }],
    })
    expect(message).toContain('Description: (none yet)')
    expect(message).toContain('Rows: (not chosen)')
    expect(message).toContain('- qty: 1 to 5\n- sku')
    expect(message).not.toContain('<base_dataset>')
  })
})
