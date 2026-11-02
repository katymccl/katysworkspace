// =========================
// api/files.ts
// =========================
// Vercel serverless function entry point. The logic lives in ./_lib/files.ts, shared with
// the Vite dev server middleware (see vite.config.ts) so `npm run dev` behaves the same way.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { clientIp, sendJson } from './_lib/http.js'
import { handleFiles } from './_lib/files.js'

// Uploading a large CSV to Anthropic can take a while.
export const config = { maxDuration: 120 }

/** Vercel's Node request: a standard IncomingMessage with the JSON body already parsed. */
type VercelRequest = IncomingMessage & { body?: unknown }

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: { code: 'invalid_request', message: 'Method not allowed.' } })
    return
  }

  const { status, body } = await handleFiles({
    body: req.body,
    bodyBytes: Number(req.headers['content-length'] ?? 0),
    ip: clientIp(req),
    origin: req.headers.origin,
    host: req.headers.host,
  })
  sendJson(res, status, body)
}
