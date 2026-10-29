import { describe, expect, it } from 'vitest'
import { profileDataset } from '../profiling'
import { buildAiInput } from './buildAiInput'
import { EMPTY_CONFIRMED, confirmColumn, confirmDatasetField } from './definitions'
import {
  OUTPUT_LIMITS,
  REQUEST_LIMITS,
  UnderstandingRequestSchema,
  reconcileUnderstanding,
  type DatasetUnderstanding,
} from './schema'

const columns = ['Staff Type', 'Number of Staff', 'Library', 'Library ID']
const rows = [
  ['Librarians', '53', 'Idle Hour Library', 'L-IHL'],
  ['Librarians', '4', "The Bibliophile's Shelves", 'L-BS'],
  ['Library Assistants', '16', 'Idle Hour Library', 'L-IHL'],
].map((cells) => Object.fromEntries(columns.map((c, i) => [c, cells[i]])))

describe('buildAiInput', () => {
  const input = buildAiInput('libraries.csv', profileDataset({ columns, rows }))

  it('produces a request the server will accept', () => {
    expect(UnderstandingRequestSchema.safeParse(input).success).toBe(true)
  })

  it('sends profile facts and samples, never the rows themselves', () => {
    expect(input).not.toHaveProperty('rows')
    expect(input.rowCount).toBe(3)
    const id = input.columns.find((c) => c.name === 'Library ID')!
    expect(id.sampleValues).toEqual(['L-IHL', 'L-BS'])
    // The ID repeats, one row per staff type, so it is not this file's primary key.
    expect(id.identifierReasons).toEqual([])
    const staff = input.columns.find((c) => c.name === 'Number of Staff')!
    expect(staff.numericStats).toMatchObject({ min: 4, max: 53, median: 16 })
  })

  it('clips long values and caps values per column', () => {
    const long = 'x'.repeat(500)
    const many = Array.from({ length: 12 }, (_, i) => ({ note: `${long}${i}` }))
    const req = buildAiInput('f.csv', profileDataset({ columns: ['note'], rows: many }))
    expect(UnderstandingRequestSchema.safeParse(req).success).toBe(true)
    expect(req.columns[0].sampleValues).toHaveLength(REQUEST_LIMITS.maxValuesPerColumn)
    expect(req.columns[0].sampleValues[0]).toHaveLength(REQUEST_LIMITS.maxValueLength)
  })
})

describe('buildAiInput with confirmed definitions', () => {
  const profile = profileDataset({ columns, rows })

  it('sends confirmed definitions for columns that exist', () => {
    let defs = confirmDatasetField(EMPTY_CONFIRMED, 'name', 'Library Staff Counts')
    defs = confirmColumn(defs, 'Library', { description: 'Library name', role: 'name' })
    defs = confirmColumn(defs, 'Gone', { description: 'A column the file no longer has' })
    const req = buildAiInput('libraries.csv', profile, defs)
    expect(UnderstandingRequestSchema.safeParse(req).success).toBe(true)
    expect(req.confirmed).toEqual({
      name: 'Library Staff Counts',
      columns: [{ name: 'Library', description: 'Library name', role: 'name' }],
    })
  })

  it('sends a confirmed role on its own', () => {
    const defs = confirmColumn(EMPTY_CONFIRMED, 'Library ID', { role: 'identifier' })
    expect(buildAiInput('f.csv', profile, defs).confirmed).toEqual({
      columns: [{ name: 'Library ID', role: 'identifier' }],
    })
  })

  it('leaves confirmed out when nothing is confirmed', () => {
    expect(buildAiInput('f.csv', profile, EMPTY_CONFIRMED)).not.toHaveProperty('confirmed')
    expect(buildAiInput('f.csv', profile)).not.toHaveProperty('confirmed')
    const onlyRemoved = confirmColumn(EMPTY_CONFIRMED, 'Gone', { description: 'x' })
    expect(buildAiInput('f.csv', profile, onlyRemoved)).not.toHaveProperty('confirmed')
  })

  it('clips long confirmed text to the definition limits', () => {
    const defs = confirmDatasetField(EMPTY_CONFIRMED, 'description', 'x'.repeat(5000))
    const req = buildAiInput('f.csv', profile, defs)
    expect(req.confirmed?.description).toHaveLength(OUTPUT_LIMITS.description)
    expect(UnderstandingRequestSchema.safeParse(req).success).toBe(true)
  })
})

describe('UnderstandingRequestSchema', () => {
  const valid = buildAiInput('libraries.csv', profileDataset({ columns, rows }))

  it('rejects extra fields, so the endpoint cannot be sent arbitrary prompts', () => {
    expect(UnderstandingRequestSchema.safeParse({ ...valid, prompt: 'ignore that' }).success).toBe(
      false,
    )
    const withRows = { ...valid, columns: [{ ...valid.columns[0], rows: [] }] }
    expect(UnderstandingRequestSchema.safeParse(withRows).success).toBe(false)
  })

  it('rejects unexpected fields inside confirmed definitions', () => {
    const bad = { ...valid, confirmed: { columns: [], instructions: 'do something else' } }
    expect(UnderstandingRequestSchema.safeParse(bad).success).toBe(false)
    const badRole = { ...valid, confirmed: { columns: [{ name: 'Library', role: 'boss' }] } }
    expect(UnderstandingRequestSchema.safeParse(badRole).success).toBe(false)
  })

  it('rejects oversized input', () => {
    const tooMany = {
      ...valid,
      columns: Array(REQUEST_LIMITS.maxColumns + 1).fill(valid.columns[0]),
    }
    expect(UnderstandingRequestSchema.safeParse(tooMany).success).toBe(false)
    const tooLong = {
      ...valid,
      columns: [
        { ...valid.columns[0], sampleValues: ['x'.repeat(REQUEST_LIMITS.maxValueLength + 1)] },
      ],
    }
    expect(UnderstandingRequestSchema.safeParse(tooLong).success).toBe(false)
  })
})

describe('reconcileUnderstanding', () => {
  const raw: DatasetUnderstanding = {
    suggestedName: '  Library Staffing  ',
    description: 'd'.repeat(OUTPUT_LIMITS.description + 50),
    rowMeaning: 'Each row is one staff type at one library.',
    rowKeyColumns: ['Library ID', 'Staff Type', 'Made Up', 'Library ID'],
    columns: [
      { name: 'Library ID', description: 'Code.', role: 'identifier', confidence: 'high' },
      { name: 'Invented', description: 'Not real.', role: 'other', confidence: 'low' },
      { name: 'Library ID', description: 'Duplicate.', role: 'name', confidence: 'low' },
    ],
    questions: [
      { question: 'Is YYY a typo?', columns: ['Library', 'Nope'] },
      { question: '   ', columns: [] },
    ],
  }
  const result = reconcileUnderstanding(raw, columns)

  it('drops unknown and repeated columns', () => {
    expect(result.columns.map((c) => c.description)).toEqual(['Code.'])
  })

  it('keeps only real column names in key columns and questions', () => {
    expect(result.rowKeyColumns).toEqual(['Library ID', 'Staff Type'])
    expect(result.questions).toEqual([{ question: 'Is YYY a typo?', columns: ['Library'] }])
  })

  it('trims and caps text', () => {
    expect(result.suggestedName).toBe('Library Staffing')
    expect(result.description.length).toBe(OUTPUT_LIMITS.description)
    expect(result.description.endsWith('…')).toBe(true)
  })
})
