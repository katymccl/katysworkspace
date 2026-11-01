import { z } from 'zod'
import { STORAGE_PREFIX, readStored, writeStored } from './storage'

/**
 * Steps on the Overview page that leave nothing else behind to count, remembered per workspace:
 * for now, whether "Explore your data" has been opened.
 */
const storageKey = (workspaceId: string) => `${STORAGE_PREFIX}:explored:${workspaceId}`

export function loadExplored(workspaceId: string): boolean {
  return readStored(storageKey(workspaceId), z.boolean()) ?? false
}

export function saveExplored(workspaceId: string): void {
  writeStored(storageKey(workspaceId), true)
}

export function deleteProgress(workspaceId: string): void {
  try {
    localStorage.removeItem(storageKey(workspaceId))
  } catch {
    // Storage unavailable: nothing was saved to remove.
  }
}
