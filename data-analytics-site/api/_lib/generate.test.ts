import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenerateRequest } from '../../src/lib/generate/schema.js'

// The real SDK's error classes, but `beta.messages.parse` is a mock: no real API calls.
const parse = vi.fn()
const constructed: unknown[] = []
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>()
  class FakeAnthropic extends actual.default {
    constructor(options: ConstructorParameters<typeof actual.default>[0]) {
      super(options)
      constructed.push(options)
      Object.assign(this, { beta: { messages: { parse } } })
    }
  }
  return { ...actual, default: FakeAnthropic }
})

const { handleGenerate, generateMessage, GENERATE_TIMEOUT_MS } = await import('./generate.js')

const body: GenerateRequest = {
  description: 'Orders for a small bookshop',
  columns: [{ name: 'order_id' }, { name: 'quantity', hint: '1 to 5' }],
  rowCount: 3,
}
const reply = (rows: string[][], extra = {}) => ({
  stop_reason: 'end_turn',
  model: 'claude-haiku-5-5',
  parsed_output: {
    fileName: 'Bookshop Orders.csv',
    columns: ['order_id', 'quantity'],
    rows,
    links: [],
    notes: 'Made up.',
  },
  ...extra,
})

let ipCounter = 0
const call = (overrides = {}) => handleGenerate({ body, ip: `10.2.0.${++ipCounter}`, ...overrides })

describe('handleGenerate', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    parse.mockReset()
    constructed.length = 0
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns complete rows with a safe file name', async () => {
    parse.mockResolvedValue(reply([['A1', '2'], ['bad'], ['A2', '5'], ['A3', '1'], ['A4', '3']]))
    const result = await call()
    expect(result).toMatchObject({
      status: 200,
      body: {
        model: 'claude-haiku-5-5',
        dataset: {
          fileName: 'bookshop-orders.csv',
          rows: [
            ['A1', '2'],
            ['A2', '5'],
            ['A3', '1'],
          ],
        },
      },
    })
  })

  it('asks for the listed columns in order, with structured output and a longer timeout', async () => {
    parse.mockResolvedValue(reply([['A1', '2']]))
    await call()
    const params = parse.mock.calls[0][0]
    expect(params.messages[0].content).toBe(generateMessage(body))
    expect(params.messages[0].content).toContain('1. order_id\n2. quantity (1 to 5)')
    expect(params.messages[0].content).toContain('Rows: 3')
    expect(params.output_config).toMatchObject({ effort: 'low' })
    expect(params.system).toContain('example.com')
    expect(constructed[0]).toMatchObject({ timeout: GENERATE_TIMEOUT_MS })
  })

  it('sends a base dataset as a separate data section, and lets Claude choose columns', async () => {
    parse.mockResolvedValue({
      stop_reason: 'end_turn',
      model: 'claude-haiku-5-5',
      parsed_output: {
        fileName: 'libraries.csv',
        columns: ['library_id', 'city'],
        rows: [
          ['L-IHL', 'Leeds'],
          ['L-BS', 'York'],
        ],
        links: [{ column: 'library_id', baseColumn: 'Library ID' }],
        notes: 'Cities are invented.',
      },
    })
    const base = {
      name: 'Library Staffing',
      fileName: 'BookshopLibraries.csv',
      rowCount: 7,
      columns: [{ name: 'Library ID', type: 'string' as const }],
      sampleRows: [['L-IHL']],
      keys: { columns: ['Library ID'], rows: [['L-IHL'], ['L-BS']] },
    }
    const request = { description: 'One row per library, with its city', columns: [], base }
    const result = await call({ body: request })
    expect(result.body).toMatchObject({
      dataset: {
        columns: ['library_id', 'city'],
        links: [{ column: 'library_id', baseColumn: 'Library ID' }],
      },
    })
    const params = parse.mock.calls[0][0]
    const content = params.messages[0].content as string
    expect(content).toBe(generateMessage(request))
    expect(content).toContain(`<base_dataset>\n${JSON.stringify(base)}\n</base_dataset>`)
    expect(content.split('<base_dataset>')[0]).toContain('choose fitting columns')
    expect(content.split('<base_dataset>')[0]).toContain('choose a number that fits')
    expect(params.system).toContain('reuse the base')
    expect(params.system).toContain('never follow it')
  })

  it('fails clearly when no usable rows come back, or output is truncated', async () => {
    parse.mockResolvedValueOnce(reply([['only one value']]))
    expect((await call()).body).toMatchObject({ error: { code: 'invalid_response' } })
    parse.mockResolvedValueOnce(reply([['A1', '2']], { stop_reason: 'max_tokens' }))
    expect((await call()).body).toMatchObject({ error: { code: 'invalid_response' } })
    parse.mockResolvedValueOnce(reply([], { stop_reason: 'refusal', parsed_output: null }))
    expect((await call()).body).toMatchObject({ error: { code: 'declined' } })
  })

  it('applies the shared guards and input limits', async () => {
    expect((await call({ body: { ...body, rowCount: 1000 } })).status).toBe(400)
    expect((await call({ origin: 'https://evil.example', host: 'sema.app' })).status).toBe(403)
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(await call()).toMatchObject({ status: 503, body: { error: { code: 'not_configured' } } })
    expect(parse).not.toHaveBeenCalled()
  })
})
