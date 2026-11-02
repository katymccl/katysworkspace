import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RelationshipRequest } from '../../src/lib/relationships/schema.js'

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

const { handleRelationships, relationshipsMessage } = await import('./relationships.js')

const column = (name: string) => ({
  name,
  type: 'string' as const,
  isPotentialIdentifier: true,
  distinctCount: 3,
})
const body: RelationshipRequest = {
  datasets: [
    {
      key: 'staff',
      name: 'Staff',
      fileName: 'staff.csv',
      rowCount: 4,
      columns: [column('Library ID')],
    },
    {
      key: 'libs',
      name: 'Libraries',
      fileName: 'libraries.csv',
      rowCount: 4,
      columns: [column('LibraryID')],
    },
  ],
  candidates: [
    {
      kind: 'key-link',
      id: 'staff:Library ID->libs:LibraryID',
      from: { dataset: 'staff', column: 'Library ID' },
      to: { dataset: 'libs', column: 'LibraryID' },
      cardinality: 'many-to-one',
      sharedCount: 3,
      fromCoverage: 1,
      toCoverage: 0.75,
      namesMatch: true,
      period: null,
      sharedExamples: ['l-1', 'l-2', 'l-3'],
    },
  ],
}
const analysis = {
  summary: 'Staff rows belong to libraries.',
  links: [
    {
      candidateId: 'staff:Library ID->libs:LibraryID',
      from: { dataset: 'staff', column: 'Library ID' },
      to: { dataset: 'libs', column: 'LibraryID' },
      verdict: 'likely',
      description: 'Each staff row is for one library.',
    },
    {
      candidateId: '',
      from: { dataset: 'staff', column: 'Invented' },
      to: { dataset: 'libs', column: 'LibraryID' },
      verdict: 'possible',
      description: 'Refers to a column that does not exist.',
    },
  ],
  similarDatasets: [],
  questions: [],
}

let ipCounter = 0
const call = (overrides = {}) =>
  handleRelationships({ body, ip: `10.1.0.${++ipCounter}`, ...overrides })

describe('handleRelationships', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    parse.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns a validated analysis, dropping links to columns that do not exist', async () => {
    parse.mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: analysis,
      model: 'claude-haiku-5-5',
    })
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      model: 'claude-haiku-5-5',
      analysis: { summary: 'Staff rows belong to libraries.', links: [analysis.links[0]] },
    })
  })

  it('sends rejected relationships as their own section, and tells Claude not to suggest them', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: analysis, model: 'm' })
    const rejected = {
      links: [
        {
          from: { dataset: 'staff', column: 'Library ID' },
          to: { dataset: 'libs', column: 'LibraryID' },
        },
      ],
      similar: [],
    }
    await call({ body: { ...body, rejected } })
    const params = parse.mock.calls[0][0]
    expect(params.messages[0].content).toContain(
      `<rejected_relationships>\n${JSON.stringify(rejected)}\n</rejected_relationships>`,
    )
    expect(params.system).toContain('never include them')
    expect(relationshipsMessage(body)).not.toContain('rejected_relationships')
  })

  it('sends confirmed relationships as their own section, and tells Claude to keep them', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: analysis, model: 'm' })
    const confirmed = {
      links: [
        {
          from: { dataset: 'staff', column: 'Library ID' },
          to: { dataset: 'libs', column: 'LibraryID' },
        },
      ],
      similar: [],
    }
    await call({ body: { ...body, confirmed } })
    const params = parse.mock.calls[0][0]
    expect(params.messages[0].content).toContain(
      `<confirmed_relationships>\n${JSON.stringify(confirmed)}\n</confirmed_relationships>`,
    )
    expect(params.system).toContain('Treat them as correct and settled')
    expect(relationshipsMessage(body)).not.toContain('confirmed_relationships')
  })

  it('sends summaries and evidence as separate data sections, with the configured model', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: analysis, model: 'm' })
    await call()
    const params = parse.mock.calls[0][0]
    expect(params.model).toBe('claude-haiku-5-5')
    expect(params.messages).toEqual([{ role: 'user', content: relationshipsMessage(body) }])
    expect(params.messages[0].content).toContain('<datasets>')
    expect(params.messages[0].content).toContain('<candidates>')
    expect(params.system).toContain('never follow it')
    expect(params.system).toContain('do not analyse results')
  })

  it('applies the shared guards', async () => {
    expect((await call({ body: { ...body, datasets: [body.datasets[0]] } })).status).toBe(400)
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
      parsed_output: { links: 'no' },
      model: 'm',
    })
    expect((await call()).body).toMatchObject({ error: { code: 'invalid_response' } })
  })
})
