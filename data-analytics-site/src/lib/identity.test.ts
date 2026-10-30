import { describe, expect, it } from 'vitest'
import {
  MAX_VERSIONS_REMEMBERED,
  contentFingerprint,
  matchDataset,
  matchInWorkspace,
  recordUpload,
  schemaFingerprint,
  type DatasetRecord,
} from './identity'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('fingerprints', () => {
  it('hashes exact file bytes, so any change in content changes the fingerprint', async () => {
    const a = await contentFingerprint(bytes('id,name\n1,Ada\n'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await contentFingerprint(bytes('id,name\n1,Ada\n'))).toBe(a)
    expect(await contentFingerprint(bytes('id,name\n1,Ada\r\n'))).not.toBe(a)
  })

  it('hashes ordered column names for the schema', async () => {
    const s = await schemaFingerprint(['id', 'name'])
    expect(await schemaFingerprint([' id', 'name '])).toBe(s)
    expect(await schemaFingerprint(['name', 'id'])).not.toBe(s)
    expect(await schemaFingerprint(['id', 'full name'])).not.toBe(s)
  })

  it('does not confuse column boundaries', async () => {
    expect(await schemaFingerprint(['a,b', 'c'])).not.toBe(await schemaFingerprint(['a', 'b,c']))
  })
})

describe('matchDataset', () => {
  const record = (overrides: Partial<DatasetRecord>): DatasetRecord => ({
    datasetId: 'ds-1',
    fileNames: ['sales.csv'],
    schemaFingerprint: 'schema-A',
    contentFingerprints: ['content-1'],
    firstSeenAt: '2026-01-01T00:00:00Z',
    lastSeenAt: '2026-01-01T00:00:00Z',
    ...overrides,
  })
  const upload = (fileName: string, schema: string, content: string) => ({
    fileName,
    fingerprints: { schema, content },
  })
  const newId = () => 'new-id'

  it('gives a brand-new upload a new datasetId', () => {
    expect(matchDataset([], upload('sales.csv', 's', 'c'), newId)).toMatchObject({
      datasetId: 'new-id',
      matchedBy: 'new-dataset',
    })
  })

  it('recognises identical content uploaded again under the same name', () => {
    const known = [record({ contentFingerprints: ['old', 'content-1'] })]
    expect(matchDataset(known, upload('sales.csv', 'schema-A', 'old'), newId)).toMatchObject({
      datasetId: 'ds-1',
      matchedBy: 'same-content',
    })
  })

  it('makes identical content under another name a separate copy of the original', () => {
    const known = [record({})]
    expect(matchDataset(known, upload('sales copy.csv', 'schema-A', 'content-1'), newId)).toEqual({
      datasetId: 'new-id',
      fingerprints: { schema: 'schema-A', content: 'content-1' },
      matchedBy: 'copy',
      copyOf: 'ds-1',
    })
  })

  it('treats a copy uploaded again under its own name as that copy', () => {
    const known = [
      record({ datasetId: 'original', lastSeenAt: '2026-01-01T00:00:00Z' }),
      record({ datasetId: 'copy', fileNames: ['copy.csv'], lastSeenAt: '2026-01-02T00:00:00Z' }),
    ]
    expect(matchDataset(known, upload('sales.csv', 'schema-A', 'content-1'), newId).datasetId).toBe(
      'original',
    )
    expect(matchDataset(known, upload('copy.csv', 'schema-A', 'content-1'), newId).datasetId).toBe(
      'copy',
    )
  })

  it('treats same name and columns with new content as a new version', () => {
    const known = [record({})]
    expect(matchDataset(known, upload('sales.csv', 'schema-A', 'content-2'), newId)).toMatchObject({
      datasetId: 'ds-1',
      matchedBy: 'new-version',
    })
  })

  it('treats the same columns under another name as a different dataset', () => {
    const known = [record({})]
    expect(
      matchDataset(known, upload('sales-march.csv', 'schema-A', 'content-2'), newId),
    ).toMatchObject({ datasetId: 'new-id', matchedBy: 'new-dataset' })
  })

  it('treats a changed column list as a different dataset', () => {
    const known = [record({})]
    expect(matchDataset(known, upload('sales.csv', 'schema-B', 'content-2'), newId).matchedBy).toBe(
      'new-dataset',
    )
  })

  it('prefers the most recently seen dataset when several match', () => {
    const known = [
      record({ datasetId: 'older', lastSeenAt: '2026-01-01T00:00:00Z' }),
      record({ datasetId: 'newer', lastSeenAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(matchDataset(known, upload('sales.csv', 'schema-A', 'x'), newId).datasetId).toBe('newer')
  })

  it('keeps the fingerprints of the upload itself', () => {
    const identity = matchDataset([record({})], upload('sales.csv', 'schema-A', 'content-9'), newId)
    expect(identity.fingerprints).toEqual({ schema: 'schema-A', content: 'content-9' })
  })
})

describe('recordUpload', () => {
  const identity = (datasetId: string, content: string) => ({
    datasetId,
    fingerprints: { schema: 's', content },
    matchedBy: 'new-dataset' as const,
  })

  it('adds a new dataset record', () => {
    const records = recordUpload([], identity('ds-1', 'c1'), 'a.csv', '2026-01-01T00:00:00Z', 'w1')
    expect(records).toEqual([
      {
        datasetId: 'ds-1',
        fileNames: ['a.csv'],
        schemaFingerprint: 's',
        contentFingerprints: ['c1'],
        firstSeenAt: '2026-01-01T00:00:00Z',
        lastSeenAt: '2026-01-01T00:00:00Z',
        workspaceId: 'w1',
      },
    ])
  })

  it('appends new versions, keeps the first-seen time and does not modify its input', () => {
    const first = recordUpload([], identity('ds-1', 'c1'), 'a.csv', '2026-01-01T00:00:00Z', 'w1')
    const frozen = Object.freeze(first.map((r) => Object.freeze({ ...r })))
    const second = recordUpload(frozen, identity('ds-1', 'c2'), 'a.csv', '2026-02-01T00:00:00Z', 'w1')
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({
      contentFingerprints: ['c1', 'c2'],
      firstSeenAt: '2026-01-01T00:00:00Z',
      lastSeenAt: '2026-02-01T00:00:00Z',
    })
    expect(frozen[0].contentFingerprints).toEqual(['c1'])
  })

  it('remembers every file name, so a renamed copy does not break later version matching', () => {
    // Upload sales.csv, then the same bytes as copy.csv, then a new version of sales.csv.
    let records = recordUpload([], identity('ds-1', 'c1'), 'sales.csv', 't1', 'w1')
    records = recordUpload(records, identity('ds-1', 'c1'), 'copy.csv', 't2', 'w1')
    expect(records[0].fileNames).toEqual(['sales.csv', 'copy.csv'])
    const next = matchDataset(
      records,
      { fileName: 'sales.csv', fingerprints: { schema: 's', content: 'c2' } },
      () => 'new-id',
    )
    expect(next).toMatchObject({ datasetId: 'ds-1', matchedBy: 'new-version' })
  })

  it('moves a re-seen version to the end instead of duplicating it', () => {
    let records = recordUpload([], identity('ds-1', 'c1'), 'a.csv', 't1', 'w1')
    records = recordUpload(records, identity('ds-1', 'c2'), 'a.csv', 't2', 'w1')
    records = recordUpload(records, identity('ds-1', 'c1'), 'a.csv', 't3', 'w1')
    expect(records[0].contentFingerprints).toEqual(['c2', 'c1'])
  })

  it('remembers a limited number of versions', () => {
    let records: DatasetRecord[] = []
    for (let i = 0; i < MAX_VERSIONS_REMEMBERED + 5; i++) {
      records = recordUpload(records, identity('ds-1', `c${i}`), 'a.csv', `t${i}`, 'w1')
    }
    expect(records[0].contentFingerprints).toHaveLength(MAX_VERSIONS_REMEMBERED)
    expect(records[0].contentFingerprints.at(-1)).toBe(`c${MAX_VERSIONS_REMEMBERED + 4}`)
  })
})

describe('matchInWorkspace', () => {
  const record = (datasetId: string, workspaceId: string | undefined, content = 'c1') => ({
    datasetId,
    fileNames: ['sales.csv'],
    schemaFingerprint: 's',
    contentFingerprints: [content],
    firstSeenAt: '2026-01-01T00:00:00Z',
    lastSeenAt: '2026-01-01T00:00:00Z',
    workspaceId,
  })
  const upload = (content: string) => ({
    fileName: 'sales.csv',
    fingerprints: { schema: 's', content },
  })

  it("recognises the workspace's own datasets", () => {
    expect(matchInWorkspace([record('a', 'w1')], upload('c1'), 'w1', () => 'new')).toMatchObject({
      datasetId: 'a',
      matchedBy: 'same-content',
    })
  })

  it('makes the same file in another workspace a separate copy there', () => {
    expect(matchInWorkspace([record('a', 'w1')], upload('c1'), 'w2', () => 'new')).toEqual({
      datasetId: 'new',
      fingerprints: { schema: 's', content: 'c1' },
      matchedBy: 'copy',
      copyOf: 'a',
    })
  })

  it("never makes a new version of another workspace's dataset", () => {
    expect(matchInWorkspace([record('a', 'w1')], upload('c2'), 'w2', () => 'new')).toMatchObject({
      datasetId: 'new',
      matchedBy: 'new-dataset',
    })
  })

  it('lets any workspace claim a record from before workspaces', () => {
    const legacy = record('old', undefined)
    expect(matchInWorkspace([legacy], upload('c2'), 'w2', () => 'new')).toMatchObject({
      datasetId: 'old',
      matchedBy: 'new-version',
    })
    const identity = matchInWorkspace([legacy], upload('c2'), 'w2', () => 'new')
    const [claimed] = recordUpload([legacy], identity, 'sales.csv', 't', 'w2')
    expect(claimed.workspaceId).toBe('w2')
  })
})
