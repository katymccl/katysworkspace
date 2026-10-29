import { describe, expect, it } from 'vitest'
import { arrowHeads } from './linkStyle'

describe('arrowHeads', () => {
  it('points only many → one links, both ends of one ↔ one, and nothing else', () => {
    expect(arrowHeads('many-to-one')).toBe('end')
    expect(arrowHeads('one-to-one')).toBe('both')
    expect(arrowHeads('many-to-many')).toBe('none')
    expect(arrowHeads(null)).toBe('none')
  })
})
