import { describe, expect, it } from 'vitest'
import {
  EMPTY_CONFIRMED,
  acceptAllSuggestions,
  countConfirmed,
  countPendingSuggestions,
  confirmColumn,
  confirmDatasetField,
  resolveUnderstanding,
  revertColumn,
  revertDatasetField,
} from './definitions'
import type { DatasetUnderstanding } from './schema'

const suggestion: DatasetUnderstanding = {
  suggestedName: 'Library Staffing',
  description: 'Staff counts for independent libraries.',
  rowMeaning: 'Each row is one staff type at one library.',
  rowKeyColumns: ['Library ID', 'Staff Type'],
  columns: [
    {
      name: 'Library ID',
      description: 'Code for the library.',
      role: 'identifier',
      confidence: 'high',
    },
    { name: 'Staff', description: 'Number of staff.', role: 'measure', confidence: 'medium' },
  ],
  questions: [{ question: 'Is "YYY" a typo?', columns: ['Library'] }],
}
const columns = ['Library ID', 'Staff', 'Notes']

describe('resolveUnderstanding', () => {
  it('shows AI suggestions immediately when nothing is confirmed', () => {
    const r = resolveUnderstanding('libs.csv', columns, suggestion, EMPTY_CONFIRMED)
    expect(r.name).toEqual({
      value: 'Library Staffing',
      source: 'suggested',
      suggestion: 'Library Staffing',
    })
    expect(r.description.source).toBe('suggested')
    expect(r.columns[0]).toMatchObject({
      name: 'Library ID',
      description: { value: 'Code for the library.', source: 'suggested' },
      role: { value: 'identifier', source: 'suggested' },
      confidence: 'high',
    })
    expect(r.questions).toHaveLength(1)
    expect(r.rowKeyColumns).toEqual(['Library ID', 'Staff Type'])
  })

  it('falls back to the file name and empty fields without a suggestion', () => {
    const r = resolveUnderstanding('libs.csv', columns, null, EMPTY_CONFIRMED)
    expect(r.name).toMatchObject({ value: 'libs.csv', source: 'none', suggestion: null })
    expect(r.description).toMatchObject({ value: null, source: 'none' })
    expect(r.columns[2].description.source).toBe('none')
    expect(r.questions).toEqual([])
  })

  it('always shows the confirmed value, whatever the AI suggested', () => {
    const confirmed = confirmDatasetField(EMPTY_CONFIRMED, 'name', 'Staff by Library')
    const r = resolveUnderstanding('libs.csv', columns, suggestion, confirmed)
    expect(r.name).toEqual({
      value: 'Staff by Library',
      source: 'confirmed',
      suggestion: 'Library Staffing',
    })
  })

  it('keeps confirmed definitions when there is no suggestion at all', () => {
    const confirmed = confirmColumn(EMPTY_CONFIRMED, 'Notes', {
      description: 'Free notes',
      role: 'text',
    })
    const r = resolveUnderstanding('f', columns, null, confirmed)
    expect(r.columns[2]).toMatchObject({
      description: { value: 'Free notes', source: 'confirmed', suggestion: null },
      role: { value: 'text', source: 'confirmed' },
    })
  })

  it('ignores confirmed definitions for columns the file no longer has', () => {
    const confirmed = confirmColumn(EMPTY_CONFIRMED, 'Old column', {
      description: 'x',
      role: 'text',
    })
    const r = resolveUnderstanding('f', columns, null, confirmed)
    expect(r.columns.map((c) => c.name)).toEqual(columns)
  })
})

describe('editing confirmed definitions', () => {
  it('confirming and reverting never touch the suggestion or the input object', () => {
    const start = Object.freeze({ ...EMPTY_CONFIRMED, columns: Object.freeze({}) })
    const confirmed = confirmDatasetField(start, 'description', '  Our staffing survey.  ')
    expect(confirmed.description).toBe('Our staffing survey.')
    expect(start).toEqual(EMPTY_CONFIRMED)

    const reverted = revertDatasetField(confirmed, 'description')
    expect(reverted.description).toBeUndefined()
    const r = resolveUnderstanding('f', columns, suggestion, reverted)
    expect(r.description).toMatchObject({ value: suggestion.description, source: 'suggested' })
  })

  it('treats saving empty text as clearing the confirmed value', () => {
    const confirmed = confirmDatasetField(EMPTY_CONFIRMED, 'rowMeaning', 'x')
    expect(confirmDatasetField(confirmed, 'rowMeaning', '   ').rowMeaning).toBeUndefined()
  })

  it('confirms column parts independently and reverts them together', () => {
    let defs = confirmColumn(EMPTY_CONFIRMED, 'Staff', { role: 'category' })
    expect(resolveUnderstanding('f', columns, suggestion, defs).columns[1]).toMatchObject({
      description: { value: 'Number of staff.', source: 'suggested' },
      role: { value: 'category', source: 'confirmed', suggestion: 'measure' },
    })
    defs = confirmColumn(defs, 'Staff', { description: 'Head count' })
    expect(defs.columns.Staff).toEqual({ role: 'category', description: 'Head count' })
    defs = revertColumn(defs, 'Staff')
    expect(defs.columns.Staff).toBeUndefined()
  })
})

describe('accepting all suggestions', () => {
  it('counts every unconfirmed suggestion shown', () => {
    const r = resolveUnderstanding('f', columns, suggestion, EMPTY_CONFIRMED)
    // name, description and row meaning, plus two suggested columns (each counted once)
    expect(countPendingSuggestions(r)).toBe(5)
    expect(countPendingSuggestions(resolveUnderstanding('f', columns, null, EMPTY_CONFIRMED))).toBe(
      0,
    )
  })

  it('confirms every suggestion as shown', () => {
    const r = resolveUnderstanding('f', columns, suggestion, EMPTY_CONFIRMED)
    const defs = acceptAllSuggestions(EMPTY_CONFIRMED, r)
    expect(defs).toEqual({
      name: 'Library Staffing',
      description: 'Staff counts for independent libraries.',
      rowMeaning: 'Each row is one staff type at one library.',
      columns: {
        'Library ID': { description: 'Code for the library.', role: 'identifier' },
        Staff: { description: 'Number of staff.', role: 'measure' },
      },
    })
    const after = resolveUnderstanding('f', columns, suggestion, defs)
    expect(countPendingSuggestions(after)).toBe(0)
    expect(after.name.source).toBe('confirmed')
  })

  it('never overwrites what the user already confirmed', () => {
    let defs = confirmDatasetField(EMPTY_CONFIRMED, 'name', 'My Name')
    defs = confirmColumn(defs, 'Staff', { role: 'category' })
    const r = resolveUnderstanding('f', columns, suggestion, defs)
    // description, row meaning, Library ID, and Staff (its meaning is still a suggestion)
    expect(countPendingSuggestions(r)).toBe(4)
    const accepted = acceptAllSuggestions(defs, r)
    expect(accepted.name).toBe('My Name')
    expect(accepted.columns.Staff).toEqual({ role: 'category', description: 'Number of staff.' })
  })

  it('does not modify its input', () => {
    const start = { ...EMPTY_CONFIRMED, columns: {} }
    const r = resolveUnderstanding('f', columns, suggestion, start)
    acceptAllSuggestions(start, r)
    expect(start).toEqual(EMPTY_CONFIRMED)
  })
})

describe('countConfirmed', () => {
  it('counts confirmed values shown, and none after a reset', () => {
    let defs = confirmDatasetField(EMPTY_CONFIRMED, 'name', 'My Name')
    defs = confirmColumn(defs, 'Staff', { role: 'category', description: 'Head count' })
    defs = confirmColumn(defs, 'Removed column', { description: 'not shown' })
    // the name, and the Staff column once; the removed column isn't shown, so isn't counted
    expect(countConfirmed(resolveUnderstanding('f', columns, suggestion, defs))).toBe(2)
    // Reset all replaces the definitions with EMPTY_CONFIRMED.
    expect(countConfirmed(resolveUnderstanding('f', columns, suggestion, EMPTY_CONFIRMED))).toBe(0)
  })
})
