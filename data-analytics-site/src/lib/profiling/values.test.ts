import { describe, expect, it } from 'vitest'
import { classifyValue, isMissing, missingTokenSet } from './values'

const kindOf = (value: string) => classifyValue(value).kind

describe('classifyValue', () => {
  it.each(['0', '42', '-7', '+3', '1,234', '-1,234,567', ' 12 '])('treats %j as integer', (v) => {
    expect(kindOf(v)).toBe('integer')
  })

  it.each(['3.14', '-0.5', '.5', '1.', '1e6', '2.5E-3', '1,234.50', '0.0'])(
    'treats %j as decimal',
    (v) => {
      expect(kindOf(v)).toBe('decimal')
    },
  )

  it('returns the parsed number for numeric values', () => {
    expect(classifyValue('1,234.5')).toEqual({ kind: 'decimal', number: 1234.5 })
    expect(classifyValue('-12')).toEqual({ kind: 'integer', number: -12 })
  })

  it.each(['02134', '007', '-01'])('keeps leading-zero identifiers like %j as strings', (v) => {
    expect(kindOf(v)).toBe('string')
  })

  it.each(['1,23', '12,34,567', '1e999', '1.2.3', '$5', '5%', '--1'])(
    'does not treat %j as a number',
    (v) => {
      expect(['integer', 'decimal']).not.toContain(kindOf(v))
    },
  )

  it.each(['true', 'FALSE', 'Yes', 'no'])('treats %j as boolean', (v) => {
    expect(kindOf(v)).toBe('boolean')
  })

  it.each([
    '2024-02-29',
    '2024-01-15T09:30',
    '2024-01-15 09:30:15',
    '2024-01-15T09:30:15.123Z',
    '2024-01-15T09:30:15+02:00',
    '12/31/2024',
    '31/12/2024',
  ])('treats %j as date', (v) => {
    expect(kindOf(v)).toBe('date')
  })

  it.each(['2023-02-29', '2024-13-01', '2024-01-15T25:00', '13/13/2024', '31/31/2024'])(
    'rejects impossible date %j',
    (v) => {
      expect(kindOf(v)).toBe('string')
    },
  )

  it.each(['hello', 'North', 'Carol, Jr.', 'N/A-ish'])('treats %j as string', (v) => {
    expect(kindOf(v)).toBe('string')
  })

  it('stringifies non-string input', () => {
    expect(kindOf(5 as unknown as string)).toBe('integer')
    expect(kindOf(true as unknown as string)).toBe('boolean')
  })
})

describe('isMissing', () => {
  it.each([undefined, null, '', '   ', 'NA', 'n/a', 'NULL', 'None', 'NaN', ' na '])(
    'treats %j as missing',
    (v) => {
      expect(isMissing(v)).toBe(true)
    },
  )

  it.each(['0', 'false', 'N', '-', 'nothing', 0])('does not treat %j as missing', (v) => {
    expect(isMissing(v)).toBe(false)
  })

  it('uses custom tokens instead of the defaults', () => {
    const tokens = missingTokenSet(['', '-', 'unknown'])
    expect(isMissing('-', tokens)).toBe(true)
    expect(isMissing(' Unknown ', tokens)).toBe(true)
    expect(isMissing('NA', tokens)).toBe(false)
  })
})
