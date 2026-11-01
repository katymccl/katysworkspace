import { describe, expect, it } from 'vitest'
import { NO_EDITS, applyAll } from './apply'
import { findIssues } from './detect'
import {
  effectiveRenames,
  glossaryNameFor,
  renameConfirmed,
  renameDashboards,
  renameGlossarySources,
  renameNames,
  renameProblems,
  renameRelationships,
  renameSuggestion,
} from './rename'
import { profileDataset } from '../profiling'
import { DEFAULT_CONFIG } from '../explore/explore'
import type { Dashboard } from '../dashboards'
import type { GlossaryTerm } from '../glossary'

const columns = ['lib_id', 'snow_in', 'Region']
const rows = [
  { lib_id: 'L1', snow_in: '4', Region: 'North' },
  { lib_id: 'L2', snow_in: '6', Region: 'South' },
]

describe('renaming in Prepare my data', () => {
  it('renames the columns and every row, and reports what took effect', () => {
    const issues = findIssues(columns, rows, profileDataset({ columns, rows }))
    const out = applyAll(columns, rows, issues, {
      ...NO_EDITS,
      renames: { snow_in: ' Snowfall (inches) ', Region: 'Region', gone: 'X' },
    })
    expect(out.columns).toEqual(['lib_id', 'Snowfall (inches)', 'Region'])
    expect(out.rows[1]).toEqual({ lib_id: 'L2', 'Snowfall (inches)': '6', Region: 'South' })
    expect(out.renames).toEqual({ snow_in: 'Snowfall (inches)' })
  })

  it('removes columns from the columns and every row, before renaming', () => {
    const issues = findIssues(columns, rows, profileDataset({ columns, rows }))
    const out = applyAll(columns, rows, issues, {
      ...NO_EDITS,
      removeColumns: ['snow_in'],
      // Renaming a removed column does nothing; another column may take its old name.
      renames: { snow_in: 'Snow', Region: 'snow_in' },
    })
    expect(out.columns).toEqual(['lib_id', 'snow_in'])
    expect(out.rows[0]).toEqual({ lib_id: 'L1', snow_in: 'North' })
    expect(out.renames).toEqual({ Region: 'snow_in' })
  })

  it('refuses blank names and names another column will have', () => {
    expect(renameProblems(columns, { lib_id: '  ', snow_in: 'region' })).toEqual({
      lib_id: 'A column needs a name.',
      snow_in: 'Another column is called “region”.',
    })
    // Swapping two names is fine: neither ends up shared.
    expect(renameProblems(columns, { lib_id: 'Region', Region: 'lib_id' })).toEqual({})
    expect(effectiveRenames({ Region: 'Region ' }, columns)).toEqual({})
  })
})

describe('what follows a renamed column', () => {
  const renames = { snow_in: 'Snowfall', lib_id: 'Library ID' }

  it('confirmed meanings and identifier choices', () => {
    const defs = renameConfirmed(
      { description: 'd', columns: { snow_in: { description: 'Inches of snow' }, Region: { role: 'category' } } },
      renames,
    )
    expect(defs).toEqual({
      description: 'd',
      columns: { Snowfall: { description: 'Inches of snow' }, Region: { role: 'category' } },
    })
    expect(renameNames(['lib_id', 'Region'], renames)).toEqual(['Library ID', 'Region'])
  })

  it("Claude's suggestion, keeping only columns the new version has", () => {
    const u = renameSuggestion(
      {
        suggestedName: 'Snow',
        description: '',
        rowMeaning: '',
        rowKeyColumns: ['lib_id'],
        columns: [
          { name: 'snow_in', description: 'Snow', role: 'measure', confidence: 'high' },
          { name: 'split_away', description: 'x', role: 'other', confidence: 'low' },
        ],
        questions: [{ question: 'Units?', columns: ['snow_in', 'split_away'] }],
      },
      renames,
      ['Library ID', 'Snowfall', 'Region'],
    )
    expect(u.rowKeyColumns).toEqual(['Library ID'])
    expect(u.columns.map((c) => c.name)).toEqual(['Snowfall'])
    expect(u.questions[0].columns).toEqual(['Snowfall'])
  })

  it("relationship decisions, only on this dataset's side", () => {
    const out = renameRelationships(
      [
        { kind: 'link', from: { dataset: 'ds', column: 'lib_id' }, to: { dataset: 'other', column: 'lib_id' } },
        { kind: 'similar', datasets: ['ds', 'other'] },
      ],
      'ds',
      renames,
    )
    expect(out[0]).toEqual({
      kind: 'link',
      from: { dataset: 'ds', column: 'Library ID' },
      to: { dataset: 'other', column: 'lib_id' },
    })
    expect(out[1]).toEqual({ kind: 'similar', datasets: ['ds', 'other'] })
  })

  it("saved Explore charts of this dataset, and the glossary's notes", () => {
    const board: Dashboard = {
      id: 'd',
      name: 'D',
      createdAt: 't',
      items: [
        { id: 'a', kind: 'explore', title: 't', addedAt: 't', datasetId: 'open-1', datasetName: 'S', config: { ...DEFAULT_CONFIG, measure: 'snow_in', group: 'Region' } },
        { id: 'b', kind: 'explore', title: 't', addedAt: 't', datasetId: 'open-2', datasetName: 'S', config: { ...DEFAULT_CONFIG, measure: 'snow_in' } },
      ],
    }
    const [out] = renameDashboards([board], 'open-1', renames)
    expect(out.items[0]).toMatchObject({ config: { measure: 'Snowfall', group: 'Region' } })
    expect(out.items[1]).toMatchObject({ config: { measure: 'snow_in' } })

    const term = { id: 't', term: 'Library ID', description: '', role: null, aliases: [], values: [], updatedAt: 't', from: { datasetId: 'ds', column: 'lib_id' } }
    expect(renameGlossarySources([term], 'ds', renames)[0].from).toEqual({ datasetId: 'ds', column: 'Library ID' })
  })
})

describe('glossary names to offer', () => {
  const term = (name: string, aliases: string[] = []): GlossaryTerm => ({
    id: name, term: name, description: '', role: null, aliases, values: [], from: null, updatedAt: 't',
  })
  const glossary = [term('Library ID'), term('Customer name', ['Client'])]

  it('offers a term a column name is a short form of', () => {
    expect(glossaryNameFor('lib_id', glossary)).toBe('Library ID')
    expect(glossaryNameFor('cust_name', glossary)).toBe('Customer name')
  })

  it('offers nothing for names that already match, or that only loosely look alike', () => {
    expect(glossaryNameFor('library_id', glossary)).toBeNull()
    expect(glossaryNameFor('client', glossary)).toBeNull()
    expect(glossaryNameFor('l_id', glossary)).toBeNull()
    expect(glossaryNameFor('lib', glossary)).toBeNull()
  })
})
