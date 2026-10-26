import { z } from 'zod'
import type { DatasetRecord } from '../identity'
import { STORAGE_PREFIX, readStored as read, writeStored as write } from '../storage'
import type { ConfirmedDefinitions, StoredSuggestion } from './definitions'
import { COLUMN_ROLES, DatasetUnderstandingSchema } from './schema'

/**
 * Saves dataset identities, AI suggestions and confirmed definitions in this browser's
 * localStorage, as separate records. Confirmed definitions are keyed by datasetId so they survive
 * new versions; a suggestion records the contentFingerprint it was made for. Every access is
 * guarded: storage can be unavailable (private windows, blocked site data) and the app must work
 * without it.
 */

const PREFIX = STORAGE_PREFIX

const RegistryRecord = z.array(
  z.object({
    datasetId: z.string(),
    fileNames: z.array(z.string()),
    schemaFingerprint: z.string(),
    contentFingerprints: z.array(z.string()),
    firstSeenAt: z.string(),
    lastSeenAt: z.string(),
  }),
)

const SuggestionRecord = z.object({
  contentFingerprint: z.string(),
  understanding: DatasetUnderstandingSchema,
  model: z.string(),
  generatedAt: z.string(),
})

const ConfirmedRecord = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  rowMeaning: z.string().optional(),
  columns: z.record(
    z.string(),
    z.object({ description: z.string().optional(), role: z.enum(COLUMN_ROLES).optional() }),
  ),
})

export function loadRegistry(): DatasetRecord[] {
  return read(`${PREFIX}:datasets`, RegistryRecord) ?? []
}

export function saveRegistry(records: readonly DatasetRecord[]): void {
  write(`${PREFIX}:datasets`, records)
}

/** The saved suggestion for a dataset, only if it was made for this exact content version. */
export function loadSuggestion(
  datasetId: string,
  contentFingerprint: string,
): StoredSuggestion | null {
  const record = read(`${PREFIX}:suggestion:${datasetId}`, SuggestionRecord)
  if (!record || record.contentFingerprint !== contentFingerprint) return null
  return {
    understanding: record.understanding,
    model: record.model,
    generatedAt: record.generatedAt,
  }
}

export function saveSuggestion(
  datasetId: string,
  contentFingerprint: string,
  suggestion: StoredSuggestion,
): void {
  write(`${PREFIX}:suggestion:${datasetId}`, { contentFingerprint, ...suggestion })
}

export function loadConfirmed(datasetId: string): ConfirmedDefinitions | null {
  return read(`${PREFIX}:confirmed:${datasetId}`, ConfirmedRecord)
}

export function saveConfirmed(datasetId: string, confirmed: ConfirmedDefinitions): void {
  write(`${PREFIX}:confirmed:${datasetId}`, confirmed)
}
