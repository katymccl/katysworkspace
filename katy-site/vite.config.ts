import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import os from 'node:os'
import path from 'node:path'

// Mirrors the /api/compile Vercel serverless function for local dev, since
// `npm run dev` (plain Vite) never invokes files under /api on its own.
// Production deploys on Vercel ignore this plugin entirely — configureServer
// only runs under `vite dev`, never during `vite build` or on Vercel itself
// — and use api/compile.js directly. Both call the same shared logic in
// api/_lib/compileCsharp.js so behavior stays identical in both places.
function csharpCompileDevMiddleware(): Plugin {
  return {
    name: 'csharp-compile-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/compile', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Allow', 'POST')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed.' }))
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(chunk as Buffer)
          }
          const raw = Buffer.concat(chunks).toString('utf-8')
          const parsed: unknown = raw ? JSON.parse(raw) : {}
          const source =
            typeof parsed === 'object' && parsed !== null && 'source' in parsed
              ? (parsed as { source: unknown }).source
              : undefined

          const { compileCsharp } = await import('./api/_lib/compileCsharp.js')
          const { status, body } = await compileCsharp(typeof source === 'string' ? source : '')

          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        } catch {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Dev server failed to handle the compile request.' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), csharpCompileDevMiddleware()],
  // Keeps Vite's dependency cache off any network-mounted project folder,
  // which can have flaky file-locking behavior for the frequent
  // create/delete churn the optimizer does.
  cacheDir: path.join(os.homedir(), '.cache', 'katy-site-vite'),
})
