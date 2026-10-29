import { describe, expect, it } from 'vitest'
import { asExample, formatColumnSpec, parseColumnSpec } from './spec'

describe('formatColumnSpec', () => {
  it('writes columns so parseColumnSpec reads them back', () => {
    const columns = [{ name: 'order_id' }, { name: 'quantity', hint: '1 to 5' }]
    expect(formatColumnSpec(columns)).toBe('order_id\nquantity: 1 to 5')
    expect(parseColumnSpec(formatColumnSpec(columns)).columns).toEqual(columns)
  })
})

describe('asExample', () => {
  it('prefixes the first line with e.g. and aligns the rest', () => {
    expect(asExample('a\nb: 1 to 5')).toBe('e.g. a\n     b: 1 to 5')
  })
})
