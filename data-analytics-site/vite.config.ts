import type { IncomingMessage } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Mirrors the Vercel serverless functions under /api for local dev, since `npm run dev` (plain
// Vite) never invokes them on its own. Production deploys on Vercel ignore this plugin; both paths
// call the same handlers in api/_lib.
const API_ROUTES = {
  '/api/understand': { module: '/api/_lib/understand.ts', handler: 'handleUnderstand' },
  '/api/relationships': { module: '/api/_lib/relationships.ts', handler: 'handleRelationships' },
  '/api/generate': { module: '/api/_lib/generate.ts', handler: 'handleGenerate' },
  '/api/plan': { module: '/api/_lib/plan.ts', handler: 'handlePlan' },
  '/api/ask': { module: '/api/_lib/ask.ts', handler: 'handleAsk' },
  '/api/questions': { module: '/api/_lib/questions.ts', handler: 'handleSuggestQuestions' },
  '/api/clean': { module: '/api/_lib/clean.ts', handler: 'handleClean' },
} as const

function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      for (const [path, route] of Object.entries(API_ROUTES)) {
        server.middlewares.use(path, async (req, res) => {
          const send = (status: number, body: unknown) => {
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(body))
          }
          if (req.method !== 'POST') {
            send(405, { error: { code: 'invalid_request', message: 'Method not allowed.' } })
            return
          }
          try {
            const raw = await readBody(req)
            let body: unknown
            try {
              body = JSON.parse(raw)
            } catch {
              send(400, { error: { code: 'invalid_request', message: 'Body must be JSON.' } })
              return
            }
            const mod = await server.ssrLoadModule(route.module)
            const result = await mod[route.handler]({
              body,
              bodyBytes: Buffer.byteLength(raw),
              ip: req.socket.remoteAddress ?? 'local',
              origin: req.headers.origin,
              host: req.headers.host,
            })
            send(result.status, result.body)
          } catch {
            send(500, {
              error: {
                code: 'upstream_error',
                message: 'Dev server failed to handle the request.',
              },
            })
          }
        })
      }
    },
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only secrets from .env.local (never VITE_-prefixed, so never bundled for the browser).
  const env = loadEnv(mode, process.cwd(), '')
  for (const name of ['ANTHROPIC_API_KEY', 'SEMA_AI_MODEL']) {
    // Only copy real values: assigning undefined to process.env stores the string "undefined".
    if (env[name] && !process.env[name]) process.env[name] = env[name]
  }

  return {
    plugins: [react(), tailwindcss(), apiDevMiddleware()],
  }
})
