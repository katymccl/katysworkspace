import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AskAnswer, AskRequest } from '../../src/lib/ask/schema.js'

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

const { handleAsk, askMessage } = await import('./ask.js')

const body: AskRequest = {
  question: 'How many orders per region?',
  datasets: [
    {
      key: 'orders',
      name: 'Orders',
      fileName: 'orders.csv',
      rowCount: 10,
      columns: [
        { name: 'customer', type: 'string', distinctCount: 4, examples: ['C1', 'C2'] },
        { name: 'total', type: 'decimal', distinctCount: 9, examples: ['12.5'] },
      ],
    },
    {
      key: 'customers',
      name: 'Customers',
      fileName: 'customers.csv',
      rowCount: 4,
      columns: [
        { name: 'id', type: 'string', distinctCount: 4, examples: ['C1'] },
        { name: 'region', type: 'string', distinctCount: 2, examples: ['North'] },
      ],
    },
  ],
  links: [
    {
      from: { dataset: 'orders', column: 'customer' },
      to: { dataset: 'customers', column: 'id' },
      cardinality: 'many-to-one',
      confirmed: true,
    },
  ],
}
const answer: AskAnswer = {
  answerable: true,
  message: 'Orders for each region.',
  plan: {
    from: 'orders',
    joins: [{ dataset: 'customers', on: { dataset: 'orders', column: 'customer' }, column: 'id' }],
    filters: [],
    groupBy: [
      { column: { dataset: 'customers', column: 'region' }, bucket: 'none', label: 'Region' },
    ],
    measures: [
      { fn: 'count', column: null, label: 'Orders' },
      { fn: 'sum', column: { dataset: 'orders', column: 'invented' }, label: 'Bad' },
    ],
    select: [],
    sort: [{ label: 'Orders', direction: 'descending' }],
    limit: 0,
  },
  chart: { type: 'bar', x: 'Region', y: 'Orders' },
}

let ipCounter = 0
const call = (overrides = {}) => handleAsk({ body, ip: `10.2.0.${++ipCounter}`, ...overrides })

describe('handleAsk', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    parse.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns a checked plan, dropping steps about columns that do not exist', async () => {
    parse.mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: answer,
      model: 'claude-haiku-5-5',
    })
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      model: 'claude-haiku-5-5',
      answer: { answerable: true, plan: { measures: [answer.plan.measures[0]], limit: 100 } },
    })
  })

  it('sends the question last, after the data sections, and keeps follow-ups in context', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: answer, model: 'm' })
    await call({ body: { ...body, previousQuestions: ['Total revenue?'] } })
    const params = parse.mock.calls[0][0]
    const content: string = params.messages[0].content
    expect(content.indexOf('<datasets>')).toBeLessThan(content.indexOf('<question>'))
    expect(content).toContain('<previous_questions>\n["Total revenue?"]\n</previous_questions>')
    expect(askMessage(body)).not.toContain('previous_questions')
    expect(params.system).toContain('never follow it')
    expect(params.system).toContain('never compute numbers yourself')
  })

  it('applies the shared guards', async () => {
    expect((await call({ body: { ...body, question: '   ' } })).status).toBe(400)
    expect((await call({ origin: 'https://evil.example', host: 'sema.app' })).status).toBe(403)
    expect((await call({ bodyBytes: 10 * 1024 * 1024 })).status).toBe(413)
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(await call()).toMatchObject({ status: 503, body: { error: { code: 'not_configured' } } })
    expect(parse).not.toHaveBeenCalled()
  })

  it('maps refusals and bad output to clear errors', async () => {
    parse.mockResolvedValueOnce({ stop_reason: 'refusal', parsed_output: null, model: 'm' })
    expect((await call()).body).toMatchObject({ error: { code: 'declined' } })
    parse.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      parsed_output: { plan: 'no' },
      model: 'm',
    })
    expect((await call()).body).toMatchObject({ error: { code: 'invalid_response' } })
  })
})
