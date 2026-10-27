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

## Ask your data

"Ask your data" (in the sidebar) answers plain-English questions about the open datasets. Claude
gets the same summaries as above (names, definitions, column types, a few example values) plus the
links between datasets, and returns a query plan: which dataset to start from, which to match in,
filters, groups, totals and sort order. The plan runs in the browser on every row
(`src/lib/ask/execute.ts`), so the numbers come from the data, not from the AI.

- Served by `api/ask.ts` (and the same Vite middleware in dev); uses the same key and model.
- Each answer shows a table, a bar or line chart when it fits, notes (unmatched or repeated rows,
  skipped values), the plan as plain steps, and a CSV download.
- Follow-up questions see the earlier questions, so "and by month?" works.
- "Suggest questions with Claude" sends the same summaries (no question) to `api/questions.ts` and
  shows up to six questions the plan can answer. They are saved in the browser per set of open
  file versions, so they come back without another call.

## Prepare my data

"Prepare my data" on a dataset page lists missing values, exact duplicate rows and values that don't
fit their column's type (a column counts as numbers, dates or yes/no when at least 80% of its
values are, or all but one in a small column). This runs in the browser on every row
(`src/lib/clean/detect.ts`). You remove duplicates, edit flagged cells or leave them, and applying
makes a new version of the dataset in the browser (the original file is unchanged; download it to
keep it).

"Suggest fixes with Claude" (`api/clean.ts`) sends only the flagged rows (up to 40), column details
and the values of short text columns. Claude suggests fixes it is confident about and groups of
values spelled several ways ("NY", "N.Y." → "New York"); each is a button you choose to use.

"Plan with Claude" in the sample generator (`api/plan.ts`) fills in a description, columns and a
row count to edit before anything is generated.
