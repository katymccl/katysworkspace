import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import { detectRelationships, type RelationshipInput } from './detect'
import { isShown, mergeRelationships } from './merge'
import { buildRelationshipRequest, workspaceKey, type DatasetSummary } from './request'
import { RelationshipRequestSchema, reconcileAnalysis, type RelationshipAnalysis } from './schema'

function input(
  key: string,
  fileName: string,
  columns: string[],
  cells: string[][],
): RelationshipInput {
  const rows = cells.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])))
  return { key, fileName, columns, rows, profile: profileDataset({ columns, rows }) }
}

const staff = input(
  'staff',
  'staff.csv',
  ['Library ID', 'Staff Type', 'Count'],
  [
    ['L-1', 'Librarians', '4'],
    ['L-2', 'Librarians', '7'],
    ['L-1', 'Assistants', '2'],
    ['L-3', 'Assistants', '9'],
  ],
)
const libs = input(
  'libs',
  'libraries.csv',
  ['LibraryID', 'Name'],
  [
    ['L-1', 'Idle Hour'],
    ['L-2', 'Bide Awhile'],
    ['L-3', 'Old Friend'],
    ['L-4', 'Page Station'],
  ],
)
const candidates = detectRelationships([staff, libs])
const summaries: DatasetSummary[] = [staff, libs].map((d) => ({
  key: d.key,
  fileName: d.fileName,
  name: d.fileName.replace('.csv', ''),
  description: null,
  rowMeaning: null,
  profile: d.profile,
  columnDefinitions: new Map(),
}))
const request = buildRelationshipRequest(summaries, candidates)
const linkId = candidates[0].id

describe('buildRelationshipRequest', () => {
  it('builds a valid request with summaries and evidence, and no rows', () => {
    expect(RelationshipRequestSchema.safeParse(request).success).toBe(true)
    expect(JSON.stringify(request)).not.toContain('Idle Hour')
    expect(request.candidates[0]).toMatchObject({
      kind: 'key-link',
      from: { column: 'Library ID' },
    })
  })

  it('includes known definitions', () => {
    const withDefs = buildRelationshipRequest(
      [
        {
          ...summaries[0],
          description: 'Staff counts.',
          columnDefinitions: new Map([
            ['Library ID', { description: 'Library code', role: 'identifier' as const }],
          ]),
        },
        summaries[1],
      ],
      candidates,
    )
    expect(withDefs.datasets[0]).toMatchObject({
      description: 'Staff counts.',
      columns: expect.arrayContaining([
        expect.objectContaining({
          name: 'Library ID',
          description: 'Library code',
          role: 'identifier',
        }),
      ]),
    })
  })

  it('rejects requests with fewer than two datasets or extra fields', () => {
    expect(
      RelationshipRequestSchema.safeParse({ ...request, datasets: [request.datasets[0]] }).success,
    ).toBe(false)
    expect(RelationshipRequestSchema.safeParse({ ...request, note: 'hi' }).success).toBe(false)
  })
})

describe('reconcileAnalysis', () => {
  const raw: RelationshipAnalysis = {
    summary: '  Staff rows belong to libraries.  ',
    links: [
      {
        candidateId: linkId,
        from: candidates[0].kind === 'key-link' ? candidates[0].from : { dataset: '', column: '' },
        to: { dataset: 'libs', column: 'LibraryID' },
        verdict: 'likely',
        description: 'Each staff row is for one library.',
      },
      {
        candidateId: linkId,
        from: { dataset: 'x', column: 'y' },
        to: { dataset: 'x', column: 'y' },
        verdict: 'unlikely',
        description: 'Duplicate judgement.',
      },
      {
        candidateId: 'made-up',
        from: { dataset: 'staff', column: 'Count' },
        to: { dataset: 'libs', column: 'Name' },
        verdict: 'possible',
        description: 'Unknown candidate.',
      },
      {
        candidateId: '',
        from: { dataset: 'staff', column: 'Staff Type' },
        to: { dataset: 'libs', column: 'Name' },
        verdict: 'possible',
        description: 'New link.',
      },
      {
        candidateId: '',
        from: { dataset: 'staff', column: 'Nope' },
        to: { dataset: 'libs', column: 'Name' },
        verdict: 'possible',
        description: 'Unknown column.',
      },
      {
        candidateId: '',
        from: { dataset: 'staff', column: 'Count' },
        to: { dataset: 'staff', column: 'Library ID' },
        verdict: 'possible',
        description: 'Same dataset.',
      },
    ],
    similarDatasets: [{ candidateId: 'nope', verdict: 'likely', description: 'x' }],
    questions: [{ question: 'Is L-4 a closed library?', datasets: ['libs', 'ghost'] }],
  }
  const result = reconcileAnalysis(raw, request)

  it('keeps one judgement per real candidate and new links only between real columns of different datasets', () => {
    expect(result.links.map((l) => l.description)).toEqual([
      'Each staff row is for one library.',
      'New link.',
    ])
    expect(result.similarDatasets).toEqual([])
  })

  it('trims text and keeps only real dataset keys in questions', () => {
    expect(result.summary).toBe('Staff rows belong to libraries.')
    expect(result.questions).toEqual([{ question: 'Is L-4 a closed library?', datasets: ['libs'] }])
  })
})

describe('mergeRelationships', () => {
  it('shows value evidence on its own when the AI has not run', () => {
    const view = mergeRelationships(candidates, null)
    expect(view.links[0]).toMatchObject({
      id: linkId,
      source: 'values',
      verdict: null,
      description: null,
    })
    expect(view.summary).toBeNull()
  })

  it('adds AI verdicts and descriptions, and AI-only links', () => {
    const analysis: RelationshipAnalysis = {
      summary: 'Linked by library code.',
      links: [
        {
          candidateId: linkId,
          from: { dataset: 'staff', column: 'Library ID' },
          to: { dataset: 'libs', column: 'LibraryID' },
          verdict: 'likely',
          description: 'Each staff row is for one library.',
        },
        {
          candidateId: '',
          from: { dataset: 'staff', column: 'Staff Type' },
          to: { dataset: 'libs', column: 'Name' },
          verdict: 'unlikely',
          description: 'Probably unrelated.',
        },
      ],
      similarDatasets: [],
      questions: [],
    }
    const view = mergeRelationships(candidates, analysis)
    expect(view.links.find((l) => l.id === linkId)).toMatchObject({
      verdict: 'likely',
      description: 'Each staff row is for one library.',
      cardinality: 'many-to-one',
    })
    const aiOnly = view.links.find((l) => l.source === 'ai')!
    expect(aiOnly).toMatchObject({ cardinality: null, evidence: null, verdict: 'unlikely' })
    expect(isShown(aiOnly)).toBe(false)
    expect(view.summary).toBe('Linked by library code.')
  })
})

describe('workspaceKey', () => {
  it('ignores order but changes when any content version changes', () => {
    const a = workspaceKey([
      { datasetId: 'x', content: '1' },
      { datasetId: 'y', content: '2' },
    ])
    expect(
      workspaceKey([
        { datasetId: 'y', content: '2' },
        { datasetId: 'x', content: '1' },
      ]),
    ).toBe(a)
    expect(
      workspaceKey([
        { datasetId: 'x', content: '1' },
        { datasetId: 'y', content: '3' },
      ]),
    ).not.toBe(a)
  })
})
