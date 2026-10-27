import { describe, expect, it } from 'vitest'
import {
  applySplits,
  countParts,
  defaultNames,
  guessDelimiter,
  splitColumns,
  splitProblem,
  splitValue,
  type Split,
} from './split'

const rows = [
  { id: '1', place: 'Leeds, UK', name: 'Ada  Lovelace' },
  { id: '2', place: 'Paris, Île-de-France, France', name: 'Grace Hopper' },
  { id: '3', place: '', name: 'Alan' },
]

describe('splitValue', () => {
  it('trims pieces and keeps any extra in the last one', () => {
    expect(splitValue('Paris, Île-de-France, France', ',', 2)).toEqual(['Paris', 'Île-de-France, France'])
    expect(splitValue('Leeds, UK', ',', 3)).toEqual(['Leeds', 'UK', ''])
  })

  it('treats runs of spaces as one, and missing values as empty', () => {
    expect(splitValue('Ada  Lovelace', ' ', 2)).toEqual(['Ada', 'Lovelace'])
    expect(splitValue('n/a', ',', 2)).toEqual(['', ''])
    expect(splitValue(undefined, ',', 2)).toEqual(['', ''])
  })
})

describe('countParts and guessDelimiter', () => {
  it('finds the most pieces and the separator used most', () => {
    expect(countParts(rows, 'place', ',')).toBe(3)
    expect(countParts(rows, 'name', ' ')).toBe(2)
    expect(countParts(rows, 'id', ',')).toBe(1)
    expect(guessDelimiter(rows, 'place')).toBe(',')
    expect(guessDelimiter(rows, 'id')).toBeNull()
  })
})

describe('defaultNames', () => {
  it('numbers new columns, skipping names in use', () => {
    expect(defaultNames('place', 3, ['id', 'place', 'place_2'])).toEqual(['place_1', 'place_3', 'place_4'])
  })
})

describe('splitting a dataset', () => {
  const split: Split = { column: 'place', delimiter: ',', names: ['city', 'region'], keepOriginal: false }

  it('puts the new columns where the old one was, and fills them', () => {
    expect(splitColumns(['id', 'place', 'name'], [split])).toEqual(['id', 'city', 'region', 'name'])
    expect(splitColumns(['id', 'place'], [{ ...split, keepOriginal: true }])).toEqual([
      'id',
      'place',
      'city',
      'region',
    ])
    expect(applySplits(rows, [split])).toEqual([
      { id: '1', city: 'Leeds', region: 'UK', name: 'Ada  Lovelace' },
      { id: '2', city: 'Paris', region: 'Île-de-France, France', name: 'Grace Hopper' },
      { id: '3', city: '', region: '', name: 'Alan' },
    ])
    expect(rows[0].place).toBe('Leeds, UK')
  })

  it('explains splits that cannot be added', () => {
    const columns = ['id', 'place', 'name']
    expect(splitProblem(columns, [], split)).toBeNull()
    expect(splitProblem(columns, [split], split)).toBe('place is already being split.')
    expect(splitProblem(columns, [], { ...split, names: ['city', 'City'] })).toBe(
      'The new columns need different names.',
    )
    expect(splitProblem(columns, [], { ...split, names: ['city', 'name'] })).toBe(
      'There is already a column called name.',
    )
    // Replacing a column frees its name for one of the new columns.
    expect(splitProblem(columns, [], { ...split, names: ['place', 'country'] })).toBeNull()
    expect(splitProblem(columns, [], { ...split, names: ['city', ' '] })).toBe(
      'Give every new column a name.',
    )
  })
})
