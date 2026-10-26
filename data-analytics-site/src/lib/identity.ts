/**
 * Dataset identity across uploads. A dataset has:
 * - datasetId: a unique, stable ID assigned the first time it is seen
 * - schemaFingerprint: SHA-256 of its ordered column names (its structure)
 * - contentFingerprint: SHA-256 of the exact file bytes (one version of its contents)
 *
 * Re-uploads are matched to a known datasetId by `matchDataset`. Pure apart from hashing.
 */

export interface DatasetFingerprints {
  schema: string
  content: string
}

/** What this browser remembers about a dataset it has seen. */
export interface DatasetRecord {
  datasetId: string
  /** Every file name it has been uploaded under, so a rename doesn't lose the original name. */
  fileNames: string[]
  schemaFingerprint: string
  /** Every content version seen, newest last (capped). */
  contentFingerprints: string[]
  firstSeenAt: string
  lastSeenAt: string
}

export type MatchReason =
  /** The exact same bytes were uploaded before, possibly under another name. */
  | 'same-content'
  /** Same file name and columns, different contents: a new version of the dataset. */
  | 'new-version'
  /** Nothing matched, so this is a new dataset. */
  | 'new-dataset'

export interface DatasetIdentity {
  datasetId: string
  fingerprints: DatasetFingerprints
  matchedBy: MatchReason
}

export const MAX_VERSIONS_REMEMBERED = 20

export async function sha256Hex(data: BufferSource | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash of the ordered column names. Names are compared as written (after trimming), so renaming
 * or reordering a column gives a different schema.
 */
export function schemaFingerprint(columns: readonly string[]): Promise<string> {
  return sha256Hex(JSON.stringify(columns.map((c) => c.trim())))
}

/** Hash of the exact file bytes. */
export function contentFingerprint(bytes: BufferSource): Promise<string> {
  return sha256Hex(bytes)
}

/**
 * Finds which known dataset an upload belongs to. Exact content wins over everything (newest
 * record first); otherwise the same file name and schema mean a new version. A matching schema
 * under a different name is treated as a different dataset, since recurring exports often share
 * columns while being distinct datasets.
 */
export function matchDataset(
  known: readonly DatasetRecord[],
  upload: { fileName: string; fingerprints: DatasetFingerprints },
  newId: () => string,
): DatasetIdentity {
  const byRecency = [...known].sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1))
  const sameContent = byRecency.find((r) =>
    r.contentFingerprints.includes(upload.fingerprints.content),
  )
  if (sameContent) {
    return {
      datasetId: sameContent.datasetId,
      fingerprints: upload.fingerprints,
      matchedBy: 'same-content',
    }
  }
  const sameSchemaAndName = byRecency.find(
    (r) =>
      r.schemaFingerprint === upload.fingerprints.schema && r.fileNames.includes(upload.fileName),
  )
  if (sameSchemaAndName) {
    return {
      datasetId: sameSchemaAndName.datasetId,
      fingerprints: upload.fingerprints,
      matchedBy: 'new-version',
    }
  }
  return { datasetId: newId(), fingerprints: upload.fingerprints, matchedBy: 'new-dataset' }
}

/** Returns the registry with this upload recorded. The input array is not modified. */
export function recordUpload(
  known: readonly DatasetRecord[],
  identity: DatasetIdentity,
  fileName: string,
  now: string,
): DatasetRecord[] {
  const existing = known.find((r) => r.datasetId === identity.datasetId)
  const versions = [
    ...(existing?.contentFingerprints ?? []).filter((f) => f !== identity.fingerprints.content),
    identity.fingerprints.content,
  ].slice(-MAX_VERSIONS_REMEMBERED)
  const record: DatasetRecord = {
    datasetId: identity.datasetId,
    fileNames: [...new Set([...(existing?.fileNames ?? []), fileName])],
    schemaFingerprint: identity.fingerprints.schema,
    contentFingerprints: versions,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
  }
  return [...known.filter((r) => r.datasetId !== identity.datasetId), record]
}
