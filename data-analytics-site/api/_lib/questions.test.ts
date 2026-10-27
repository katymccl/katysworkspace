import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SuggestQuestionsRequest } from '../../src/lib/ask/questions.js'

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

const { handleSuggestQuestions, questionsMessage } = await import('./questions.js')

const body: SuggestQuestionsRequest = {
  datasets: [
    {
      key: 'ds-1',
      name: 'Shipments',
      fileName: 'shipments.csv',
      rowCount: 4,
      columns: [{ name: 'carrier', type: 'string', distinctCount: 2, examples: ['DHL', 'UPS'] }],
    },
  ],
  links: [],
}
const reply = (questions: string[], extra = {}) => ({
  stop_reason: 'end_turn',
  model: 'claude-haiku-5-5',
  parsed_output: { questions },
  ...extra,
})

let ipCounter = 0
const call = (overrides = {}) =>
  handleSuggestQuestions({ body, ip: `10.5.0.${++ipCounter}`, ...overrides })

describe('handleSuggestQuestions', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    parse.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns cleaned-up questions, at most six', async () => {
    parse.mockResolvedValue(
      reply([
        'Which carrier\nshipped the most?',
        'which carrier shipped the most?',
        ' ',
        'x'.repeat(300),
        'Q3?',
        'Q4?',
        'Q5?',
        'Q6?',
        'Q7?',
        'Q8?',
      ]),
    )
    expect(await call()).toEqual({
      status: 200,
      body: {
        model: 'claude-haiku-5-5',
        questions: ['Which carrier shipped the most?', 'Q3?', 'Q4?', 'Q5?', 'Q6?', 'Q7?'],
      },
    })
  })

  it('rejects a request with a question or without datasets', async () => {
    expect((await call({ body: { ...body, question: 'hi' } })).status).toBe(400)
    expect((await call({ body: { datasets: [], links: [] } })).status).toBe(400)
    expect(parse).not.toHaveBeenCalled()
  })

  it('reports refusals and empty suggestions', async () => {
    parse.mockResolvedValueOnce(reply([], { stop_reason: 'refusal' }))
    expect(await call()).toMatchObject({ status: 502, body: { error: { code: 'declined' } } })
    parse.mockResolvedValueOnce(reply([' ']))
    expect(await call()).toMatchObject({
      status: 502,
      body: { error: { code: 'invalid_response' } },
    })
  })
})

describe('questionsMessage', () => {
  it('sends the summaries and links in tagged sections', () => {
    const message = questionsMessage(body)
    expect(message).toContain('<datasets>\n[{"key":"ds-1"')
    expect(message).toContain('<links>\n[]\n</links>')
  })
})
