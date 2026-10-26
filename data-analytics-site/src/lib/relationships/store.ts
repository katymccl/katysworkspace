import { z } from 'zod'
import { STORAGE_PREFIX, readStored, writeStored } from '../storage'
import { RelationshipResultSchema, type RelationshipResult } from './schema'

/**
 * The latest AI relationship analysis, saved in this browser. One record per set of dataset
 * versions; it is only reused when the exact same versions are open again.
 */
const Record = z.object({ workspaceKey: z.string(), result: RelationshipResultSchema })

const storageKey = (workspaceKey: string) => `${STORAGE_PREFIX}:relationships:${hash(workspaceKey)}`

export function loadAnalysis(workspaceKey: string): RelationshipResult | null {
  const record = readStored(storageKey(workspaceKey), Record)
  return record && record.workspaceKey === workspaceKey ? record.result : null
}

export function saveAnalysis(workspaceKey: string, result: RelationshipResult): void {
  writeStored(storageKey(workspaceKey), { workspaceKey, result })
}

/** Short, deterministic key for a long workspace key; collisions are caught by the check above. */
function hash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16)
}
