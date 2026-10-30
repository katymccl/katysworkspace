import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toDataset } from '../datasets'
import { buildAnalyseRequest, ensureUploaded, forgetUploads, gzipBase64 } from './full'
import { AnalyseRequestSchema, reconcileReport, type ReportAnswer } from './fullSchema'

const store: Record<string, string> = {}
const memoryStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v
  },
  removeItem: (k: string) => {
    delete store[k]
  },
}

const dataset = (content = 'c1', rows = [{ region: 'West', total: '1,200' }]) =>
  toDataset(
    {
      fileName: 'orders.csv',
      fileSize: 10,
      columns: ['region', 'total'],
      rows,
      warnings: [],
      fingerprints: { schema: 's', content },
    },
    { datasetId: 'ds-1', matchedBy: 'new-dataset' },
  )

const fetchMock = vi.fn()
const ok = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('localStorage', memoryStorage)
})
afterEach(() => vi.unstubAllGlobals())

describe('uploading datasets', () => {
  it('gzips text so the server can read it back', async () => {
    const text = 'a,b\n1,2\n'.repeat(1000)
    const back = gunzipSync(Buffer.from(await gzipBase64(text), 'base64')).toString()
    expect(back).toBe(text)
  })

  it('uploads the CSV once per version, and reuses the file id after', async () => {
    fetchMock.mockImplementation(() => ok({ fileId: 'file_1' }))
    expect(await ensureUploaded(dataset())).toEqual({ ok: true, fileId: 'file_1' })
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).toMatchObject({ action: 'upload', fileName: 'orders.csv' })
    expect(gunzipSync(Buffer.from(sent.csvGzipBase64, 'base64')).toString()).toBe(
      'region,total\r\nWest,"1,200"\r\n',
    )

    expect(await ensureUploaded(dataset())).toEqual({ ok: true, fileId: 'file_1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // A new version is a new upload.
    fetchMock.mockImplementation(() => ok({ fileId: 'file_2' }))
    expect(await ensureUploaded(dataset('c2'))).toEqual({ ok: true, fileId: 'file_2' })
  })

  it('says when a file is too large to send, without trying', async () => {
    // Random-ish text barely compresses, so this stays far over the limit once gzipped.
    let seed = 1
    const noise = () => (seed = (seed * 16807) % 2147483647).toString(36)
    const rows = Array.from({ length: 600_000 }, () => ({ region: noise(), total: noise() }))
    expect(await ensureUploaded(dataset('big', rows))).toEqual({ ok: false, tooLarge: true })
    expect(fetchMock).not.toHaveBeenCalled()
    // Compressing about 10 MB takes a few seconds while other test files run alongside.
  }, 30_000)

  it('reports a failed upload', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'Busy.' } }), {
          status: 429,
        }),
      ),
    )
    expect(await ensureUploaded(dataset())).toEqual({ ok: false, tooLarge: false, message: 'Busy.' })
  })

  it('forgets uploads, keeping the version asked for, and deletes them at Anthropic', async () => {
    fetchMock.mockImplementation(() => ok({ fileId: 'file_1' }))
    await ensureUploaded(dataset('c1'))
    fetchMock.mockImplementation(() => ok({ fileId: 'file_2' }))
    await ensureUploaded(dataset('c2'))
    fetchMock.mockReset()
    fetchMock.mockImplementation(() => ok({ deleted: 1 }))

    await forgetUploads(['ds-1'], 'c2')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'delete',
      fileIds: ['file_1'],
    })
    // c2 is still known, so no new upload.
    fetchMock.mockReset()
    expect(await ensureUploaded(dataset('c2'))).toEqual({ ok: true, fileId: 'file_2' })
    expect(fetchMock).not.toHaveBeenCalled()

    await forgetUploads(['someone-else'])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('analyse requests and reports', () => {
  it('builds a valid request from an ask request and the uploaded files', () => {
    const request = buildAnalyseRequest(
      {
        question: 'Total?',
        datasets: [{ key: 'ds-1', name: 'Orders', fileName: 'o.csv', rowCount: 1, columns: [] }],
        links: [],
      },
      [{ dataset: 'ds-1', fileId: 'file_1', fileName: 'o.csv' }],
    )
    expect(AnalyseRequestSchema.safeParse(request).success).toBe(true)
  })

  const report: ReportAnswer = {
    answerable: true,
    message: '  Total revenue is 1,234.  ',
    steps: ['Added up totals', '  '],
    notes: [],
    columns: [
      { label: 'Region', numeric: false },
      { label: 'Revenue', numeric: true },
    ],
    rows: [['West', '1,200'], ['East'], ['North', 'n/a', 'extra']],
    chart: { type: 'bar', x: 'Region', y: 'Revenue', by: 'Ghost' },
  }

  it('tidies a report: text, row lengths, numbers, and chart headings', () => {
    expect(reconcileReport(report)).toEqual({
      answerable: true,
      message: 'Total revenue is 1,234.',
      steps: ['Added up totals'],
      notes: [],
      columns: report.columns,
      rows: [
        ['West', 1200],
        ['East', null],
        ['North', 'n/a'],
      ],
      chart: { type: 'bar', x: 'Region', y: 'Revenue', by: '' },
    })
  })

  it('drops the table and chart when the question could not be answered', () => {
    const out = reconcileReport({ ...report, answerable: false })
    expect(out).toMatchObject({ columns: [], rows: [], chart: { type: 'none' } })
  })
})
