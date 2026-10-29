import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPositions, savePositions } from './positions'

describe('diagram positions', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('saves and restores dragged positions per set of datasets', () => {
    expect(loadPositions('a:1|b:2')).toEqual({})
    savePositions('a:1|b:2', { a: { x: 10, y: 20 } })
    expect(loadPositions('a:1|b:2')).toEqual({ a: { x: 10, y: 20 } })
    expect(loadPositions('a:1|b:3')).toEqual({})
  })

  it('clears positions on reset', () => {
    savePositions('k', { a: { x: 1, y: 2 } })
    savePositions('k', {})
    expect(loadPositions('k')).toEqual({})
  })

  it('works without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => savePositions('k', { a: { x: 1, y: 2 } })).not.toThrow()
    expect(loadPositions('k')).toEqual({})
  })
})
