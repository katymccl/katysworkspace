import { z } from 'zod'
import { STORES, getAll, getAllByIndex, openDb, put, remove } from './persist/db'
import type { StoredDataset } from './persist/datasets'
import { STORAGE_PREFIX, readStored, writeStored } from './storage'

/**
 * A workspace: a set of related datasets that Claude works with together, with its own
 * relationships, glossary and questions. Saved in this browser's IndexedDB.
 */
export interface Workspace {
  id: string
  name: string
  createdAt: string
  /** Whether Ask your data may upload this workspace's files for Claude to analyse in full. */
  fullData: boolean
}

export const DEFAULT_WORKSPACE_NAME = 'My workspace'
const CURRENT_KEY = `${STORAGE_PREFIX}:current-workspace`

export function newWorkspace(name: string, id: string, now: string): Workspace {
  return { id, name: name.trim() || DEFAULT_WORKSPACE_NAME, createdAt: now, fullData: true }
}

/**
 * The saved workspaces (oldest first) and which one to open, creating "My workspace" when there
 * are none. `persistent` is false when IndexedDB is unavailable, so nothing will outlast the tab.
 */
export function loadWorkspaces(
  newId: () => string = () => crypto.randomUUID(),
): Promise<LoadedWorkspaces> {
  // Shared, so two callers at once (React runs effects twice in development) can't both create
  // a first workspace.
  loading ??= readWorkspaces(newId)
  return loading
}

/** Lets the next loadWorkspaces read storage again (for tests). */
export function resetWorkspaceLoading(): void {
  loading = null
}

interface LoadedWorkspaces {
  workspaces: Workspace[]
  currentId: string
  persistent: boolean
}
let loading: Promise<LoadedWorkspaces> | null = null

async function readWorkspaces(newId: () => string): Promise<LoadedWorkspaces> {
  const persistent = (await openDb()) !== null
  let workspaces = (await getAll<Workspace>(STORES.workspaces)).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : 1,
  )
  if (workspaces.length === 0) {
    const first = newWorkspace(DEFAULT_WORKSPACE_NAME, newId(), new Date().toISOString())
    await saveWorkspace(first)
    workspaces = [first]
  }
  const saved = readStored(CURRENT_KEY, z.string())
  const currentId = workspaces.some((w) => w.id === saved) ? saved! : workspaces[0].id
  saveCurrentWorkspaceId(currentId)
  return { workspaces, currentId, persistent }
}

export function saveWorkspace(w: Workspace): Promise<boolean> {
  return put(STORES.workspaces, w)
}

export function saveCurrentWorkspaceId(id: string): void {
  writeStored(CURRENT_KEY, id)
}

/** Deletes a workspace with its saved datasets and Ask history. Returns the deleted datasets. */
export async function deleteWorkspace(id: string): Promise<StoredDataset[]> {
  const datasets = await getAllByIndex<StoredDataset>(STORES.datasets, 'workspaceId', id)
  await Promise.all(datasets.map((d) => remove(STORES.datasets, d.id)))
  await remove(STORES.askHistory, id)
  await remove(STORES.workspaces, id)
  return datasets
}
