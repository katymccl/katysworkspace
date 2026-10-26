# sema.

Give your data meaning. Upload CSV datasets and explore them in the browser.

## Develop

```bash
npm install
npm run dev
```

`npm run build` type-checks and builds; `npm run lint` runs oxlint.

## AI dataset understanding

"Interpret with AI" on a dataset page asks Claude to suggest a name, description, what a row
represents, column meanings and open questions. Only the profile summary and a few sample values
are sent, via the server endpoint `api/understand.ts`; the API key stays on the server.

- Set `ANTHROPIC_API_KEY` (and optionally `SEMA_AI_MODEL`) as described in `.env.example`.
- `npm run dev` serves the endpoint through a Vite middleware; Vercel serves `api/understand.ts`.
- Suggestions and your confirmed definitions are saved separately in the browser, per dataset.
