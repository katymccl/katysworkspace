import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toDataset } from '../datasets'
import type { CsvData } from '../parseCsv'
import {
  deleteWorkspace,
  loadWorkspaces,
  newWorkspace,
  resetWorkspaceLoading,
  saveCurrentWorkspaceId,
  saveWorkspace,
} from '../workspaces'
import { resetDbConnection } from './db'
import { deleteStoredDataset, fromStored, loadStoredDatasets, saveDataset, toStored } from './datasets'

const csv = (fileName: string): CsvData => ({
  fileName,
  fileSize: 20,
  columns: ['id', 'name'],
  rows: [
    { id: '1', name: 'Ada' },
    { id: '2', name: 'Grace' },
  ],
  warnings: [],
  fingerprints: { schema: 's', content: fileName },
})
const dataset = (fileName: string, addedAt: string) => ({
  ...toDataset(csv(fileName), { datasetId: `ds-${fileName}`, matchedBy: 'new-dataset' }),
  addedAt,
})

beforeEach(() => {
  // A fresh, empty database for every test.
  globalThis.indexedDB = new IDBFactory()
  resetDbConnection()
  resetWorkspaceLoading()
  localStorage.clear()
})

vi.stubGlobal(
  'localStorage',
  (() => {
    let store: Record<string, string> = {}
    return {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        store = {}
      },
    }
  })(),
)

describe('workspaces', () => {
  it('creates "My workspace" the first time, and opens it', async () => {
    const { workspaces, currentId, persistent } = await loadWorkspaces(() => 'w1')
    expect(persistent).toBe(true)
    expect(workspaces).toEqual([
      { id: 'w1', name: 'My workspace', createdAt: expect.any(String), fullData: true },
    ])
    expect(currentId).toBe('w1')
    // Loading again finds the same one rather than making another.
    resetWorkspaceLoading()
    expect((await loadWorkspaces(() => 'w2')).workspaces.map((w) => w.id)).toEqual(['w1'])
  })

  it('creates only one first workspace when loaded twice at once', async () => {
    let n = 0
    const newId = () => `w${++n}`
    const [a, b] = await Promise.all([loadWorkspaces(newId), loadWorkspaces(newId)])
    expect(a.workspaces).toEqual(b.workspaces)
    resetWorkspaceLoading()
    expect((await loadWorkspaces(newId)).workspaces).toHaveLength(1)
  })

  it('reopens the workspace last chosen, oldest first in the list', async () => {
    await saveWorkspace(newWorkspace('Sales', 'a', '2026-01-01T00:00:00Z'))
    await saveWorkspace(newWorkspace('HR', 'b', '2026-02-01T00:00:00Z'))
    saveCurrentWorkspaceId('b')
    const { workspaces, currentId } = await loadWorkspaces()
    expect(workspaces.map((w) => w.name)).toEqual(['Sales', 'HR'])
    expect(currentId).toBe('b')
  })

  it('deletes a workspace with its datasets, leaving other workspaces alone', async () => {
    await saveDataset(dataset('a.csv', '1'), 'w1')
    await saveDataset(dataset('b.csv', '2'), 'w2')
    const deleted = await deleteWorkspace('w1')
    expect(deleted.map((d) => d.data.fileName)).toEqual(['a.csv'])
    expect(await loadStoredDatasets('w1')).toEqual([])
    expect((await loadStoredDatasets('w2')).map((d) => d.data.fileName)).toEqual(['b.csv'])
  })
})

describe('saved datasets', () => {
  it('round-trips a dataset, profiling it again on load', async () => {
    const d = dataset('people.csv', '2026-01-01T00:00:00Z')
    expect(await saveDataset(d, 'w1')).toBe(true)
    const [stored] = await loadStoredDatasets('w1')
    expect(stored).toEqual(toStored(d, 'w1'))
    expect(stored).not.toHaveProperty('data.profile')
    const restored = fromStored(stored, [])
    expect(restored).toEqual(d)
  })

  it('applies identifier flags the user removed when restoring', async () => {
    const d = dataset('people.csv', '1')
    await saveDataset(d, 'w1')
    const [stored] = await loadStoredDatasets('w1')
    const restored = fromStored(stored, ['id'])
    expect(restored.profile.columns[0]).toMatchObject({
      name: 'id',
      isPotentialIdentifier: false,
      identifierDismissed: true,
    })
  })

  it('keeps datasets in the order they were added, and replaces a dataset saved again', async () => {
    const first = dataset('first.csv', '2026-01-01T00:00:00Z')
    await saveDataset(dataset('second.csv', '2026-01-02T00:00:00Z'), 'w1')
    await saveDataset(first, 'w1')
    await saveDataset({ ...first, fileName: 'first-cleaned.csv' }, 'w1')
    expect((await loadStoredDatasets('w1')).map((d) => d.data.fileName)).toEqual([
      'first-cleaned.csv',
      'second.csv',
    ])
  })

  it('removes a dataset', async () => {
    const d = dataset('gone.csv', '1')
    await saveDataset(d, 'w1')
    await deleteStoredDataset(d.id)
    expect(await loadStoredDatasets('w1')).toEqual([])
  })
})

describe('without IndexedDB', () => {
  it('keeps working in memory and says nothing will be saved', async () => {
    // @ts-expect-error: simulating a browser that blocks IndexedDB
    globalThis.indexedDB = undefined
    resetDbConnection()
    resetWorkspaceLoading()
    const { workspaces, persistent } = await loadWorkspaces(() => 'w1')
    expect(persistent).toBe(false)
    expect(workspaces.map((w) => w.name)).toEqual(['My workspace'])
    expect(await saveDataset(dataset('a.csv', '1'), 'w1')).toBe(false)
    expect(await loadStoredDatasets('w1')).toEqual([])
  })
})
