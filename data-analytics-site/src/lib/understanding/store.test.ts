import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_CONFIRMED, confirmColumn, confirmDatasetField } from './definitions'
import type { DatasetUnderstanding } from './schema'
import {
  copySavedUnderstanding,
  loadConfirmed,
  loadDismissedIdentifiers,
  loadRegistry,
  loadSuggestion,
  saveConfirmed,
  saveDismissedIdentifiers,
  saveRegistry,
  saveSuggestion,
} from './store'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

const understanding: DatasetUnderstanding = {
  suggestedName: 'Library Staffing',
  description: 'd',
  rowMeaning: 'r',
  rowKeyColumns: [],
  columns: [],
  questions: [],
}
const suggestion = { understanding, model: 'claude-opus-5-5', generatedAt: '2026-10-25T00:00:00Z' }

describe('store', () => {
  let storage: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps suggestions and confirmed definitions in separate records', () => {
    saveSuggestion('ds-1', 'content-1', suggestion)
    saveConfirmed('ds-1', confirmDatasetField(EMPTY_CONFIRMED, 'name', 'Mine'))
    expect([...storage.data.keys()].sort()).toEqual([
      'sema.v2:confirmed:ds-1',
      'sema.v2:suggestion:ds-1',
    ])
    expect(loadConfirmed('ds-1')).toEqual({ name: 'Mine', columns: {} })
  })

  it('reuses a suggestion only for the content version it was made for', () => {
    saveSuggestion('ds-1', 'content-1', suggestion)
    expect(loadSuggestion('ds-1', 'content-1')).toEqual(suggestion)
    expect(loadSuggestion('ds-1', 'content-2')).toBeNull()
  })

  it('keeps confirmed definitions across content versions', () => {
    const defs = confirmColumn(EMPTY_CONFIRMED, 'Staff', {
      description: 'Head count',
      role: 'measure',
    })
    saveConfirmed('ds-1', defs)
    saveSuggestion('ds-1', 'content-2', suggestion)
    expect(loadConfirmed('ds-1')).toEqual(defs)
  })

  it('round-trips the dataset registry', () => {
    const records = [
      {
        datasetId: 'ds-1',
        fileNames: ['a.csv'],
        schemaFingerprint: 's',
        contentFingerprints: ['c'],
        firstSeenAt: 't',
        lastSeenAt: 't',
      },
    ]
    saveRegistry(records)
    expect(loadRegistry()).toEqual(records)
  })

  it('ignores corrupt or unexpected saved data', () => {
    storage.setItem('sema.v2:datasets', '{not json')
    storage.setItem('sema.v2:confirmed:ds-1', JSON.stringify({ columns: { a: { role: 'boss' } } }))
    expect(loadRegistry()).toEqual([])
    expect(loadConfirmed('ds-1')).toBeNull()
  })

  it('keeps working when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => saveConfirmed('ds-1', EMPTY_CONFIRMED)).not.toThrow()
    expect(loadConfirmed('ds-1')).toBeNull()
    expect(loadRegistry()).toEqual([])
  })

  it("starts a copy from the original's saved data, without overwriting the copy's own", () => {
    const confirmed = confirmDatasetField(EMPTY_CONFIRMED, 'name', 'Staff')
    saveConfirmed('original', confirmed)
    saveSuggestion('original', 'content-1', suggestion)
    saveDismissedIdentifiers('original', ['Name'])
    saveDismissedIdentifiers('copy', ['Code'])

    copySavedUnderstanding('original', 'copy')
    expect(loadConfirmed('copy')).toEqual(confirmed)
    expect(loadSuggestion('copy', 'content-1')).toEqual(suggestion)
    expect(loadDismissedIdentifiers('copy')).toEqual(['Code'])

    // From then on they're separate.
    saveConfirmed('copy', EMPTY_CONFIRMED)
    expect(loadConfirmed('original')).toEqual(confirmed)
  })
})
