import { describe, expect, it } from 'vitest'
import {
  addColumnTerm,
  columnDragData,
  findTerm,
  readColumnDrag,
  removeTerm,
  sortedTerms,
  termKey,
  updateTerm,
  type GlossaryTerm,
} from './glossary'
import { profileDataset } from './profiling'
import { RelationshipRequestSchema } from './relationships/schema'
import { buildRelationshipRequest } from './relationships/request'
import { AskRequestSchema } from './ask/schema'
import { buildAskRequest } from './ask/request'
import { EMPTY_CONFIRMED, resolveUnderstanding, withGlossary } from './understanding'
import type { DatasetUnderstanding } from './understanding'

const term = (overrides: Partial<GlossaryTerm> = {}): GlossaryTerm => ({
  id: 't1',
  term: 'Library ID',
  description: 'The code of a library branch.',
  role: 'identifier',
  aliases: [],
  from: null,
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('matching columns to terms', () => {
  it('matches header styles alike', () => {
    expect(termKey('Library ID')).toBe(termKey('library_id'))
    expect(termKey('LibraryID')).toBe(termKey('library-id'))
  })

  it('finds a term by its name or another name it goes by', () => {
    const terms = [term({ aliases: ['Branch code'] })]
    expect(findTerm(terms, 'library_id')?.id).toBe('t1')
    expect(findTerm(terms, 'BranchCode')?.id).toBe('t1')
    expect(findTerm(terms, 'Library')).toBeNull()
    expect(findTerm(terms, '')).toBeNull()
  })
})

describe('editing the glossary', () => {
  const column = { datasetId: 'ds', name: 'Library ID', description: ' Branch code ', role: null }

  it('adds a column as a term, tidied, remembering where it came from', () => {
    const { terms, term: added, added: isNew } = addColumnTerm([], column, 'id1', 'now')
    expect(isNew).toBe(true)
    expect(terms).toEqual([added])
    expect(added).toEqual({
      id: 'id1',
      term: 'Library ID',
      description: 'Branch code',
      role: null,
      aliases: [],
      from: { datasetId: 'ds', column: 'Library ID' },
      updatedAt: 'now',
    })
  })

  it('never adds the same name twice, however it is written', () => {
    const first = addColumnTerm([], column, 'id1', 'now')
    const again = addColumnTerm(first.terms, { ...column, name: 'library_id' }, 'id2', 'later')
    expect(again.added).toBe(false)
    expect(again.term.id).toBe('id1')
    expect(again.terms).toHaveLength(1)
  })

  it('tidies other names: trimmed, no blanks, no repeats, not the term itself', () => {
    const [updated] = updateTerm(
      [term()],
      't1',
      { aliases: [' Branch code ', 'branch_code', '', 'library id', 'LibraryID '] },
      'later',
    )
    expect(updated.aliases).toEqual(['Branch code'])
    expect(updated.updatedAt).toBe('later')
  })

  it('keeps the old name when renamed to nothing, and removes terms', () => {
    expect(updateTerm([term()], 't1', { term: '  ' }, 'x')[0].term).toBe('Library ID')
    expect(removeTerm([term(), term({ id: 't2' })], 't1').map((t) => t.id)).toEqual(['t2'])
  })

  it('sorts terms A to Z', () => {
    const terms = [term({ id: 'b', term: 'staff' }), term({ id: 'a', term: 'Address' })]
    expect(sortedTerms(terms).map((t) => t.term)).toEqual(['Address', 'staff'])
  })

  it('round-trips drag data, and ignores anything else dropped', () => {
    expect(readColumnDrag(columnDragData('ds', 'Library ID'))).toEqual({
      datasetId: 'ds',
      column: 'Library ID',
    })
    expect(readColumnDrag('not json')).toBeNull()
    expect(readColumnDrag('{"x":1}')).toBeNull()
  })
})

describe('glossary meanings for columns', () => {
  const suggestion: DatasetUnderstanding = {
    suggestedName: 'Staff',
    description: 'Staff counts.',
    rowMeaning: 'One staff type at one library.',
    columns: [
      { name: 'Library_ID', description: 'AI: a code.', role: 'category', confidence: 'high' },
      { name: 'Staff', description: 'AI: number of staff.', role: 'measure', confidence: 'high' },
    ],
    rowKeyColumns: [],
    questions: [],
  }
  const glossary = [term()]

  it('uses the glossary in place of the AI suggestion', () => {
    const r = resolveUnderstanding('s.csv', ['Library_ID', 'Staff'], suggestion, EMPTY_CONFIRMED, glossary)
    expect(r.columns[0].description).toEqual({
      value: 'The code of a library branch.',
      source: 'glossary',
      suggestion: 'AI: a code.',
    })
    expect(r.columns[0].role).toMatchObject({ value: 'identifier', source: 'glossary' })
    expect(r.columns[0].glossaryTerm?.id).toBe('t1')
    expect(r.columns[1].description.source).toBe('suggested')
  })

  it("lets a dataset's own confirmed meaning win over the glossary", () => {
    const confirmed = { columns: { Library_ID: { description: 'Our branch number.' } } }
    const r = resolveUnderstanding('s.csv', ['Library_ID'], suggestion, confirmed, glossary)
    expect(r.columns[0].description).toMatchObject({
      value: 'Our branch number.',
      source: 'confirmed',
    })
    // The role wasn't confirmed, so it still comes from the glossary.
    expect(r.columns[0].role.source).toBe('glossary')
  })

  it("leaves the AI's description when the term has none", () => {
    const r = resolveUnderstanding('s.csv', ['Library_ID'], suggestion, EMPTY_CONFIRMED, [
      term({ description: '' }),
    ])
    expect(r.columns[0].description.source).toBe('suggested')
  })

  it('hands glossary meanings to Claude as settled, without overriding confirmed ones', () => {
    const confirmed = { columns: { Staff: { description: 'Headcount.' } } }
    const settled = withGlossary(confirmed, ['Library_ID', 'Staff'], [
      term(),
      term({ id: 't2', term: 'Staff', description: 'Glossary staff.' }),
    ])
    expect(settled.columns).toEqual({
      Library_ID: { description: 'The code of a library branch.', role: 'identifier' },
      Staff: { description: 'Headcount.', role: 'identifier' },
    })
  })
})

describe('glossary terms in requests to Claude', () => {
  const rows = [{ Library_ID: 'L-1' }, { Library_ID: 'L-2' }]
  const summary = (key: string) => ({
    key,
    fileName: `${key}.csv`,
    name: key,
    description: null,
    rowMeaning: null,
    profile: profileDataset({ columns: ['Library_ID'], rows }),
    columnDefinitions: new Map([
      ['Library_ID', { description: 'Branch code.', role: 'identifier' as const, glossaryTerm: 'Library ID' }],
    ]),
  })

  it('tells Claude which term each column follows when finding relationships', () => {
    const request = buildRelationshipRequest([summary('a'), summary('b')], [])
    expect(RelationshipRequestSchema.safeParse(request).success).toBe(true)
    expect(request.datasets[0].columns[0]).toMatchObject({ glossaryTerm: 'Library ID' })
  })

  it('tells Claude which term each column follows when answering questions', () => {
    const request = buildAskRequest('How many branches?', [summary('a')], [])
    expect(AskRequestSchema.safeParse(request).success).toBe(true)
    expect(request.datasets[0].columns[0]).toMatchObject({ glossaryTerm: 'Library ID' })
  })
})
