import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { profileDataset } from '../profiling'
import {
  applicableConfirmations,
  isConfirmed,
  loadConfirmedRelationships,
  loadRejectedRelationships,
  relationshipId,
  saveConfirmedRelationships,
  saveRejectedRelationships,
  toggleConfirmed,
  withoutRelationship,
  type ConfirmedRelationship,
} from './confirmed'
import { measureOverlaps, type RelationshipInput } from './detect'
import { asConfirmation, isShown, mergeRelationships } from './merge'
import { buildRelationshipRequest } from './request'
import { RelationshipRequestSchema, type RelationshipAnalysis } from './schema'

const link = (a: string, ac: string, b: string, bc: string): ConfirmedRelationship => ({
  kind: 'link',
  from: { dataset: a, column: ac },
  to: { dataset: b, column: bc },
})

describe('toggleConfirmed', () => {
  it('confirms, then un-confirms, without modifying the input', () => {
    const start: ConfirmedRelationship[] = Object.freeze([]) as unknown as ConfirmedRelationship[]
    const once = toggleConfirmed(start, link('a', 'x', 'b', 'y'))
    expect(once).toHaveLength(1)
    expect(toggleConfirmed(once, link('a', 'x', 'b', 'y'))).toEqual([])
    expect(start).toEqual([])
  })

  it('treats a link in either direction as the same relationship', () => {
    const confirmed = [link('a', 'x', 'b', 'y')]
    expect(isConfirmed(confirmed, link('b', 'y', 'a', 'x'))).toBe(true)
    expect(toggleConfirmed(confirmed, link('b', 'y', 'a', 'x'))).toEqual([])
    expect(isConfirmed(confirmed, link('a', 'x', 'b', 'z'))).toBe(false)
  })

  it('does the same for "same columns" pairs', () => {
    const confirmed: ConfirmedRelationship[] = [{ kind: 'similar', datasets: ['a', 'b'] }]
    expect(isConfirmed(confirmed, { kind: 'similar', datasets: ['b', 'a'] })).toBe(true)
  })
})

describe('applicableConfirmations', () => {
  it('keeps only confirmations whose datasets are open and columns still exist', () => {
    const columns = new Map([
      ['a', new Set(['x'])],
      ['b', new Set(['y'])],
    ])
    const confirmed: ConfirmedRelationship[] = [
      link('a', 'x', 'b', 'y'),
      link('a', 'gone', 'b', 'y'),
      link('a', 'x', 'closed', 'y'),
      { kind: 'similar', datasets: ['a', 'b'] },
      { kind: 'similar', datasets: ['a', 'closed'] },
    ]
    expect(applicableConfirmations(confirmed, columns).map(relationshipId)).toEqual([
      'a:x->b:y',
      'a~b',
    ])
  })
})

describe('storage', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips confirmations, and starts empty', () => {
    expect(loadConfirmedRelationships()).toEqual([])
    const confirmed: ConfirmedRelationship[] = [
      link('a', 'x', 'b', 'y'),
      { kind: 'similar', datasets: ['a', 'b'] },
    ]
    saveConfirmedRelationships(confirmed)
    expect(loadConfirmedRelationships()).toEqual(confirmed)
  })
})

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
  ['Library ID', 'Count'],
  [
    ['L-1', '4'],
    ['L-2', '7'],
    ['L-1', '2'],
    ['L-3', '9'],
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
  ],
)
const candidates = measureOverlaps([staff, libs])
/** Claude's analysis listing the Library ID link as likely. */
const likely: RelationshipAnalysis = {
  summary: '',
  links: [
    {
      candidateId: 'staff:Library ID->libs:LibraryID',
      from: { dataset: 'staff', column: 'Library ID' },
      to: { dataset: 'libs', column: 'LibraryID' },
      verdict: 'likely',
      description: 'Each row is for one library.',
    },
  ],
  similarDatasets: [],
  questions: [],
}

describe('mergeRelationships with confirmations', () => {
  it('marks confirmed links, whichever direction they were confirmed in', () => {
    const view = mergeRelationships(candidates, null, [
      link('libs', 'LibraryID', 'staff', 'Library ID'),
    ])
    const l = view.links.find((x) => x.from.column === 'Library ID')!
    expect(l.confirmed).toBe(true)
    expect(asConfirmation(l)).toEqual(link('staff', 'Library ID', 'libs', 'LibraryID'))
  })

  it('always shows confirmed links, even ones the AI judged unlikely', () => {
    const analysis: RelationshipAnalysis = {
      summary: '',
      links: [
        {
          candidateId: candidates[0].id,
          from: { dataset: 'staff', column: 'Library ID' },
          to: { dataset: 'libs', column: 'LibraryID' },
          verdict: 'unlikely',
          description: 'Coincidence.',
        },
      ],
      similarDatasets: [],
      questions: [],
    }
    const unconfirmed = mergeRelationships(candidates, analysis).links[0]
    expect(isShown(unconfirmed)).toBe(false)
    const confirmed = mergeRelationships(candidates, analysis, [
      link('staff', 'Library ID', 'libs', 'LibraryID'),
    ]).links[0]
    expect(isShown(confirmed)).toBe(true)
  })

  it('keeps confirmed links that nothing currently suggests', () => {
    const view = mergeRelationships(candidates, null, [link('staff', 'Count', 'libs', 'Name')])
    const userLink = view.links.find((l) => l.source === 'user')!
    expect(userLink).toMatchObject({
      id: 'staff:Count->libs:Name',
      confirmed: true,
      evidence: null,
      cardinality: null,
    })
  })

  it('does not duplicate a confirmed AI-only link', () => {
    const analysis: RelationshipAnalysis = {
      summary: '',
      links: [
        {
          candidateId: '',
          from: { dataset: 'staff', column: 'Count' },
          to: { dataset: 'libs', column: 'Name' },
          verdict: 'possible',
          description: 'Maybe.',
        },
      ],
      similarDatasets: [],
      questions: [],
    }
    const view = mergeRelationships(candidates, analysis, [link('libs', 'Name', 'staff', 'Count')])
    const matching = view.links.filter((l) => l.from.column === 'Count' || l.to.column === 'Count')
    expect(matching).toHaveLength(1)
    expect(matching[0]).toMatchObject({ source: 'ai', confirmed: true })
  })
})

describe('buildRelationshipRequest with confirmations', () => {
  const summaries = [staff, libs].map((d) => ({
    key: d.key,
    fileName: d.fileName,
    name: d.fileName,
    description: null,
    rowMeaning: null,
    profile: d.profile,
    columnDefinitions: new Map(),
  }))

  it('sends confirmations as settled facts', () => {
    const request = buildRelationshipRequest(summaries, candidates, [
      link('staff', 'Library ID', 'libs', 'LibraryID'),
      { kind: 'similar', datasets: ['staff', 'libs'] },
    ])
    expect(RelationshipRequestSchema.safeParse(request).success).toBe(true)
    expect(request.confirmed).toEqual({
      links: [
        {
          from: { dataset: 'staff', column: 'Library ID' },
          to: { dataset: 'libs', column: 'LibraryID' },
        },
      ],
      similar: [{ datasets: ['staff', 'libs'] }],
    })
  })

  it('leaves confirmed out when there are none', () => {
    expect(buildRelationshipRequest(summaries, candidates)).not.toHaveProperty('confirmed')
  })
})

describe('rejected relationships', () => {
  const staffLink = link('staff', 'Library ID', 'libs', 'LibraryID')

  it('hides links marked not related, even ones Claude finds likely', () => {
    const view = mergeRelationships(candidates, likely, [], [staffLink])
    const l = view.links.find((x) => x.from.column === 'Library ID')!
    expect(l).toMatchObject({ rejected: true, confirmed: false, verdict: 'likely' })
    expect(isShown(l)).toBe(false)
  })

  it('matches rejections in either direction', () => {
    const view = mergeRelationships(
      candidates,
      likely,
      [],
      [link('libs', 'LibraryID', 'staff', 'Library ID')],
    )
    expect(view.links.find((x) => x.from.column === 'Library ID')!.rejected).toBe(true)
  })

  it('removes a relationship from one list when it is added to the other', () => {
    expect(
      withoutRelationship(
        [staffLink, link('a', 'x', 'b', 'y')],
        link('libs', 'LibraryID', 'staff', 'Library ID'),
      ),
    ).toEqual([link('a', 'x', 'b', 'y')])
  })

  it('sends rejections to the AI separately from confirmations', () => {
    const summaries = [staff, libs].map((d) => ({
      key: d.key,
      fileName: d.fileName,
      name: d.fileName,
      description: null,
      rowMeaning: null,
      profile: d.profile,
      columnDefinitions: new Map(),
    }))
    const request = buildRelationshipRequest(summaries, candidates, [], [staffLink])
    expect(RelationshipRequestSchema.safeParse(request).success).toBe(true)
    expect(request).not.toHaveProperty('confirmed')
    expect(request.rejected?.links).toEqual([
      {
        from: { dataset: 'staff', column: 'Library ID' },
        to: { dataset: 'libs', column: 'LibraryID' },
      },
    ])
  })
})

describe('rejected storage', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps rejections apart from confirmations', () => {
    saveRejectedRelationships([link('a', 'x', 'b', 'y')])
    expect(loadRejectedRelationships()).toEqual([link('a', 'x', 'b', 'y')])
    expect(loadConfirmedRelationships()).toEqual([])
  })
})
