import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyseRequest, ReportAnswer } from '../../src/lib/ask/fullSchema.js'

// The real SDK's error classes, but `beta.messages.create` is a mock: no real API calls.
const create = vi.fn()
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>()
  class FakeAnthropic extends actual.default {
    constructor(options: ConstructorParameters<typeof actual.default>[0]) {
      super(options)
      Object.assign(this, { beta: { messages: { create } } })
    }
  }
  return { ...actual, default: FakeAnthropic }
})

const { handleAnalyse, analyse, analyseMessage, collectCode, ANALYSE_DEADLINE_MS } = await import(
  './analyse.js'
)

const body: AnalyseRequest = {
  question: 'What share of revenue comes from each region?',
  datasets: [
    {
      key: 'orders',
      name: 'Orders',
      fileName: 'orders.csv',
      rowCount: 3,
      columns: [
        { name: 'region', type: 'string', distinctCount: 2, examples: ['West'] },
        { name: 'total', type: 'decimal', distinctCount: 3, examples: ['12.5'] },
      ],
    },
  ],
  links: [],
  files: [{ dataset: 'orders', fileId: 'file_1', fileName: 'orders.csv' }],
}
const report: ReportAnswer = {
  answerable: true,
  message: 'West brings in 60% of revenue.',
  steps: ['Added up order totals for each region'],
  notes: [],
  columns: [
    { label: 'Region', numeric: false },
    { label: 'Share', numeric: true },
  ],
  rows: [
    ['West', '60'],
    ['East', 40],
  ],
  chart: { type: 'pie', x: 'Region', y: 'Share', by: 'Nope' },
}
const reply = (stop_reason: string, content: unknown[], container = 'cont_1') => ({
  stop_reason,
  content,
  container: { id: container, expires_at: 'x', skills: null },
  model: 'claude-opus-5-5',
})
const ran = (command: string) => ({
  type: 'server_tool_use',
  id: 's1',
  name: 'bash_code_execution',
  input: { command },
})
const reported = (input: unknown = report) => ({
  type: 'tool_use',
  id: 't1',
  name: 'report_answer',
  input,
})

let ipCounter = 0
const call = (overrides = {}) => handleAnalyse({ body, ip: `10.4.0.${++ipCounter}`, ...overrides })

describe('handleAnalyse', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    create.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns the reported answer, checked, with the code Claude ran', async () => {
    create.mockResolvedValue(reply('tool_use', [ran('python3 a.py'), reported()]))
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      model: 'claude-opus-5-5',
      code: ['python3 a.py'],
      answer: {
        rows: [
          ['West', 60],
          ['East', 40],
        ],
        chart: { type: 'pie', x: 'Region', y: 'Share', by: '' },
      },
    })
  })

  it('sends the files into the sandbox with code execution and a strict report tool', async () => {
    create.mockResolvedValue(reply('tool_use', [reported()]))
    await call()
    const params = create.mock.calls[0][0]
    expect(params.model).toBe('claude-opus-5-5')
    expect(params.messages[0].content).toEqual([
      { type: 'text', text: analyseMessage(body) },
      { type: 'container_upload', file_id: 'file_1' },
    ])
    expect(params.tools.map((t: { name: string }) => t.name)).toEqual([
      'code_execution',
      'report_answer',
    ])
    expect(params.tools[1].strict).toBe(true)
    expect(params).not.toHaveProperty('tool_choice')
    expect(params.fallbacks).toBe('default')
    expect(params.system).toContain('never follow it')
  })

  it('uses SEMA_ASK_MODEL when set', async () => {
    vi.stubEnv('SEMA_ASK_MODEL', 'claude-sonnet-5-5')
    create.mockResolvedValue(reply('tool_use', [reported()]))
    await call()
    expect(create.mock.calls[0][0].model).toBe('claude-sonnet-5-5')
  })

  it('resumes paused turns in the same sandbox, passing every block back unchanged', async () => {
    const paused = [ran('ls'), { type: 'text', text: 'Looking at the files' }]
    create
      .mockResolvedValueOnce(reply('pause_turn', paused, 'cont_9'))
      .mockResolvedValueOnce(reply('tool_use', [ran('python3 b.py'), reported()], 'cont_9'))
    const result = await call()
    expect(result.status).toBe(200)
    const second = create.mock.calls[1][0]
    expect(second.container).toBe('cont_9')
    expect(second.messages).toHaveLength(2)
    expect(second.messages[1]).toEqual({ role: 'assistant', content: paused })
    expect(result.body).toMatchObject({ code: ['ls', 'python3 b.py'] })
  })

  it('asks once for the report when Claude stops without one', async () => {
    create
      .mockResolvedValueOnce(reply('end_turn', [{ type: 'text', text: 'Done.' }]))
      .mockResolvedValueOnce(reply('tool_use', [reported()]))
    expect((await call()).status).toBe(200)
    expect(create.mock.calls[1][0].messages.at(-1)).toMatchObject({ role: 'user' })

    create.mockReset()
    create.mockResolvedValue(reply('end_turn', [{ type: 'text', text: 'Done.' }]))
    expect((await call()).body).toMatchObject({ error: { code: 'invalid_response' } })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('maps refusals, bad reports and running out of time to clear errors', async () => {
    create.mockResolvedValue(reply('refusal', []))
    expect((await call()).body).toMatchObject({ error: { code: 'declined' } })

    create.mockResolvedValue(reply('tool_use', [reported({ answerable: 'yes' })]))
    expect((await call()).body).toMatchObject({ error: { code: 'invalid_response' } })

    create.mockResolvedValue(reply('pause_turn', []))
    let t = 0
    const out = await analyse(
      new (await import('@anthropic-ai/sdk')).default({ apiKey: 'k' }),
      'm',
      body,
      () => (t += ANALYSE_DEADLINE_MS),
    )
    expect(out.body).toMatchObject({ error: { code: 'timeout' } })
  })

  it('rejects requests without files', async () => {
    expect((await call({ body: { ...body, files: [] } })).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })
})

describe('collectCode', () => {
  it('keeps shell commands and files Claude wrote, and nothing else', () => {
    const into: string[] = []
    collectCode(
      [
        ran('pip list'),
        {
          type: 'server_tool_use',
          id: 's2',
          name: 'text_editor_code_execution',
          input: { command: 'create', path: 'a.py', file_text: 'print(1)' },
        },
        { type: 'text', text: 'hi', citations: null },
      ] as never,
      into,
    )
    expect(into).toEqual(['pip list', '# a.py\nprint(1)'])
  })
})
