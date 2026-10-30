import { z } from 'zod'
import { postToAi, type AiOutcome } from '../ai/post'
import type { Dataset } from '../datasets'
import { toCsvText } from '../generate/client'
import { STORAGE_PREFIX, readStored, writeStored } from '../storage'
import {
  AnalyseResultSchema,
  FULL_LIMITS,
  FileDeleteResultSchema,
  FileUploadResultSchema,
  type AnalyseRequest,
  type AnalyseResult,
} from './fullSchema'
import type { AskRequest } from './schema'

/**
 * The browser side of full-data answers: uploading a workspace's datasets to Anthropic (once per
 * content version, remembered here), forgetting uploads that are no longer needed, and asking.
 */

/** One uploaded content version of a dataset. */
const UploadRecord = z.object({
  datasetId: z.string(),
  content: z.string(),
  fileId: z.string(),
})
type UploadRecord = z.infer<typeof UploadRecord>
const UPLOADS_KEY = `${STORAGE_PREFIX}:uploaded-files`

function loadUploads(): UploadRecord[] {
  return readStored(UPLOADS_KEY, z.array(UploadRecord)) ?? []
}

/** The dataset's CSV, gzipped and base64-encoded for /api/files. */
export async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  // In slices, since spreading a large array into one call overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export type UploadOutcome =
  | { ok: true; fileId: string }
  | { ok: false; tooLarge: true }
  | { ok: false; tooLarge: false; message: string }

/** Uploads a dataset unless this version already was, and remembers the file id. */
export async function ensureUploaded(d: Dataset): Promise<UploadOutcome> {
  const known = loadUploads().find(
    (u) => u.datasetId === d.datasetId && u.content === d.fingerprints.content,
  )
  if (known) return { ok: true, fileId: known.fileId }

  const csv = toCsvText(
    d.columns,
    d.rows.map((r) => d.columns.map((c) => r[c] ?? '')),
  )
  const body = {
    action: 'upload' as const,
    fileName: d.fileName.slice(0, FULL_LIMITS.maxFileNameLength),
    csvGzipBase64: await gzipBase64(csv),
  }
  if (JSON.stringify(body).length > FULL_LIMITS.maxUploadBodyBytes) return { ok: false, tooLarge: true }

  const outcome = await postToAi('/api/files', body, FileUploadResultSchema, { timeoutMs: 130_000 })
  if (!outcome.ok) return { ok: false, tooLarge: false, message: outcome.error.message }
  writeStored(UPLOADS_KEY, [
    ...loadUploads(),
    { datasetId: d.datasetId, content: d.fingerprints.content, fileId: outcome.result.fileId },
  ])
  return { ok: true, fileId: outcome.result.fileId }
}

/**
 * Deletes the uploads of these datasets, all versions, or only those other than `keepContent`.
 * Best-effort: the browser forgets them even if Anthropic can't be reached.
 */
export async function forgetUploads(datasetIds: readonly string[], keepContent?: string) {
  const ids = new Set(datasetIds)
  const all = loadUploads()
  const gone = all.filter((u) => ids.has(u.datasetId) && u.content !== keepContent)
  if (gone.length === 0) return
  writeStored(
    UPLOADS_KEY,
    all.filter((u) => !gone.includes(u)),
  )
  await postToAi(
    '/api/files',
    { action: 'delete', fileIds: gone.map((u) => u.fileId) },
    FileDeleteResultSchema,
  )
}

export function buildAnalyseRequest(
  ask: AskRequest,
  files: { dataset: string; fileId: string; fileName: string }[],
): AnalyseRequest {
  return { ...ask, files: files.slice(0, FULL_LIMITS.maxFiles) }
}

export function requestAnalysis(
  request: AnalyseRequest,
  signal?: AbortSignal,
): Promise<AiOutcome<AnalyseResult>> {
  // The server stops itself at 270 seconds; wait a little longer for its reply.
  return postToAi('/api/analyse', request, AnalyseResultSchema, { signal, timeoutMs: 290_000 })
}
