import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real SDK's helpers and errors, but `files` is a mock: no real API calls.
const upload = vi.fn()
const del = vi.fn()
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>()
  class FakeAnthropic extends actual.default {
    constructor(options: ConstructorParameters<typeof actual.default>[0]) {
      super(options)
      Object.assign(this, { files: { upload, delete: del } })
    }
  }
  return { ...actual, default: FakeAnthropic }
})

const { handleFiles, safeName } = await import('./files.js')

const csv = 'region,total\nWest,10\nEast,5\n'
const gz = (text: string) => gzipSync(Buffer.from(text)).toString('base64')
let ipCounter = 0
const call = (body: unknown) => handleFiles({ body, ip: `10.5.0.${++ipCounter}` })

describe('handleFiles', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    upload.mockReset()
    del.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('unzips the CSV and uploads it under a safe name', async () => {
    upload.mockResolvedValue({ id: 'file_1' })
    const result = await call({ action: 'upload', fileName: '../q1 sales.csv', csvGzipBase64: gz(csv) })
    expect(result).toEqual({ status: 200, body: { fileId: 'file_1' } })
    const file: File = upload.mock.calls[0][0].file
    expect(file.name).toBe('q1 sales.csv')
    expect(await file.text()).toBe(csv)
  })

  it('refuses data that is not gzip', async () => {
    const result = await call({ action: 'upload', fileName: 'a.csv', csvGzipBase64: 'bm90IGd6aXA=' })
    expect(result.status).toBe(400)
    expect(upload).not.toHaveBeenCalled()
  })

  it('deletes files, counting the ones that went', async () => {
    del.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('gone'))
    expect(await call({ action: 'delete', fileIds: ['a', 'b'] })).toEqual({
      status: 200,
      body: { deleted: 1 },
    })
  })

  it('rejects anything else', async () => {
    expect((await call({ action: 'rename' })).status).toBe(400)
  })
})

describe('safeName', () => {
  it.each([
    ['sales.csv', 'sales.csv'],
    ['C:\\data\\sales.csv', 'sales.csv'],
    ['report<2024>', 'report_2024_.csv'],
    ['', 'data.csv'],
  ])('%j → %j', (name, safe) => {
    expect(safeName(name)).toBe(safe)
  })
})
