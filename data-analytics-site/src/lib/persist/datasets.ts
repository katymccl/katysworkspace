import type { Dataset } from '../datasets'
import type { MatchReason } from '../identity'
import type { CsvData } from '../parseCsv'
import { profileDataset, withDismissedIdentifiers } from '../profiling'
import { STORES, getAllByIndex, put, remove } from './db'

/**
 * An open dataset as saved in IndexedDB: the parsed file and its identity, without the profile,
 * which is worked out again on load so profiling improvements reach old data too.
 */
export interface StoredDataset {
  id: string
  workspaceId: string
  datasetId: string
  matchedBy: MatchReason
  addedAt: string
  data: CsvData
}

export function toStored(d: Dataset, workspaceId: string): StoredDataset {
  const { id, datasetId, matchedBy, addedAt, profile: _profile, ...data } = d
  return { id, workspaceId, datasetId, matchedBy, addedAt, data }
}

/** The dataset again, profiled, with the identifier flags the user removed applied. */
export function fromStored(s: StoredDataset, dismissedIdentifiers: readonly string[]): Dataset {
  const profile = withDismissedIdentifiers(profileDataset(s.data), dismissedIdentifiers)
  return {
    ...s.data,
    id: s.id,
    datasetId: s.datasetId,
    matchedBy: s.matchedBy,
    addedAt: s.addedAt,
    profile,
  }
}

export function saveDataset(d: Dataset, workspaceId: string): Promise<boolean> {
  return put(STORES.datasets, toStored(d, workspaceId))
}

export function deleteStoredDataset(id: string): Promise<boolean> {
  return remove(STORES.datasets, id)
}

/** A workspace's saved datasets, in the order they were added. */
export async function loadStoredDatasets(workspaceId: string): Promise<StoredDataset[]> {
  const stored = await getAllByIndex<StoredDataset>(STORES.datasets, 'workspaceId', workspaceId)
  return stored.sort((a, b) => (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0))
}
