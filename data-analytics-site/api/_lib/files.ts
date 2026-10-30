// =========================
// api/_lib/files.ts
// =========================
// Server-only logic behind POST /api/files: uploads a workspace's CSV to Anthropic's Files API so
// Claude can analyse every row with code execution, and deletes uploads that are no longer needed.
// The browser gzips each CSV so it fits Vercel's request size limit; it's unzipped here.
// Shared by the Vercel function (api/files.ts) and the Vite dev middleware.

import { gunzipSync } from 'node:zlib'
import { toFile } from '@anthropic-ai/sdk'
import { FULL_LIMITS, FileRequestSchema } from '../../src/lib/ask/fullSchema.js'
import { fail, guardRequest, mapError, type AiOutput, type AiRequestInput } from './claude.js'

/** Unzipped CSVs larger than this are refused, so a tiny upload can't unpack into gigabytes. */
const MAX_CSV_BYTES = 200 * 1024 * 1024

export type FilesOutput = AiOutput<{ fileId: string } | { deleted: number }>

export async function handleFiles(input: AiRequestInput): Promise<FilesOutput> {
  const guard = guardRequest(input, FULL_LIMITS.maxUploadBodyBytes, 120_000)
  if (!guard.ok) return guard.error

  const parsed = FileRequestSchema.safeParse(input.body)
  if (!parsed.success) {
    return fail(400, 'invalid_request', 'The file request was not in the expected format.')
  }
  const request = parsed.data

  if (request.action === 'delete') {
    // Deleting is best-effort: a file already gone is as good as deleted.
    const results = await Promise.allSettled(
      request.fileIds.map((id) => guard.client.files.delete(id)),
    )
    return {
      status: 200,
      body: { deleted: results.filter((r) => r.status === 'fulfilled').length },
    }
  }

  let csv: Buffer
  try {
    csv = gunzipSync(Buffer.from(request.csvGzipBase64, 'base64'), {
      maxOutputLength: MAX_CSV_BYTES,
    })
  } catch {
    return fail(400, 'invalid_request', 'The file could not be read, or is too large.')
  }

  try {
    const file = await guard.client.files.upload({
      file: await toFile(csv, safeName(request.fileName), { type: 'text/csv' }),
    })
    return { status: 200, body: { fileId: file.id } }
  } catch (error) {
    return mapError(error, 'files')
  }
}

/** A plain file name ending in .csv: no folders, and only ordinary characters. */
export function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'data.csv'
  const cleaned = base.replace(/[^\w.\- ]+/g, '_').trim() || 'data'
  return cleaned.toLowerCase().endsWith('.csv') ? cleaned : `${cleaned}.csv`
}
