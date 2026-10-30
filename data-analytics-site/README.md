# sema.

Give your data meaning. Upload CSV datasets and explore them in the browser.

## Develop

```bash
npm install
npm run dev
```

`npm run build` type-checks and builds; `npm run lint` runs oxlint.

## Workspaces and saving

Datasets live in **workspaces**: separate sets of related files, switched from the top of the
sidebar. Claude only ever works with the open workspace's datasets, whether finding relationships,
answering questions or suggesting them.

Everything is saved in this browser: workspaces, their datasets (rows included) and Ask history in
IndexedDB (`src/lib/persist/`), and smaller things such as descriptions, glossaries and relationship
decisions in localStorage. Nothing is synced between browsers or devices. Uploading a file a
workspace already has is recognised; the same file in another workspace becomes a separate copy
there, starting from the original's saved descriptions.

## Data glossary

Each workspace has a glossary (in the sidebar). Drag a column card onto "Glossary", or use "Add to
glossary" on a column, to add it as a term with its meaning and role; terms can also be written by
hand and given other names ("also called"). A term's meaning is used for every column of that
name in the workspace (matched by header words, so `Library ID` = `library_id`) in place of
Claude's suggestion, unless you've confirmed a meaning for that column in that dataset. Claude is
told the glossary when interpreting datasets, finding relationships and answering questions.

## AI dataset understanding

"Interpret with AI" on a dataset page asks Claude to suggest a name, description, what a row
represents, column meanings and open questions. Only the profile summary and a few sample values
are sent, via the server endpoint `api/understand.ts`; the API key stays on the server.

- Set `ANTHROPIC_API_KEY` (and optionally `SEMA_AI_MODEL` and `SEMA_ASK_MODEL`) as described in
  `.env.example`.
- `npm run dev` serves the endpoint through a Vite middleware; Vercel serves `api/understand.ts`.
- Suggestions and your confirmed definitions are saved separately in the browser, per dataset.

## Ask your data

"Ask your data" (in the sidebar) answers plain-English questions about the open workspace's
datasets, in one of two ways, set per workspace on the Ask page.

**Full data (the default).** The workspace's CSVs are uploaded to Anthropic's Files API through
`api/files.ts`, once per version (gzipped in the browser to fit Vercel's 4.5 MB request limit).
`api/analyse.ts` then lets Claude (`claude-opus-5-5`, or `SEMA_ASK_MODEL`) run Python over every
row with the code execution tool and report a result table and chart, so any kind of question
works and the numbers come from the full data. Answers take longer (often under a minute; the
function stops itself at 270 seconds, inside Vercel's 300-second limit). The answer shows the steps
Claude took and the code it ran. A file still too large after compressing is answered the private
way instead, with a note. Uploads are deleted when a dataset or workspace is removed, when a
dataset is replaced by a cleaned version, and when full data is turned off.

**Private (full data off).** Claude gets the same summaries as above (names, definitions, column
types, a few example values) plus the links between datasets, and returns a query plan: which
dataset to start from, which to match in, filters, groups, totals and sort order. The plan runs in
the browser on every row (`src/lib/ask/execute.ts`), so the files never leave it.

- Private answers are served by `api/ask.ts` (and the same Vite middleware in dev).
- Each answer shows a table, a chart when it fits or when asked for (bar, line, pie or heatmap),
  notes (unmatched or repeated rows, skipped values), how it was worked out, and a CSV download.
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
