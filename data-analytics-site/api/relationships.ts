// =========================
// api/relationships.ts
// =========================
// Vercel serverless function entry point. The logic lives in ./_lib/relationships.ts, shared with
// the Vite dev server middleware (see vite.config.ts) so `npm run dev` behaves the same way.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleRelationships } from './_lib/relationships.js'
import { clientIp, sendJson } from './_lib/http.js'

// Analysing several datasets can take a while; allow up to a minute.
export const config = { maxDuration: 60 }

/** Vercel's Node request: a standard IncomingMessage with the JSON body already parsed. */
type VercelRequest = IncomingMessage & { body?: unknown }

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: { code: 'invalid_request', message: 'Method not allowed.' } })
    return
  }
  const { status, body } = await handleRelationships({
    body: req.body,
    bodyBytes: Number(req.headers['content-length'] ?? 0),
    ip: clientIp(req),
    origin: req.headers.origin,
    host: req.headers.host,
  })
  sendJson(res, status, body)
}
