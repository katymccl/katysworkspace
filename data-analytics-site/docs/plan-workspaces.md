# Plan: workspaces, data glossary, and full data for Claude

Agreed on 2026-10-30. Built overnight in phases; each phase ends with typecheck, lint, tests,
a check in the running app, and a commit pushed to `data-analytics-site`.

## Decisions (made with Katy)

| Topic | Decision |
|---|---|
| Storage | Saved in this browser (IndexedDB). No accounts or server storage; not synced across devices. |
| Full data | Ask your data uses Claude's code execution tool: the workspace's CSVs are uploaded to Anthropic and Claude runs Python over every row. |
| Privacy switch | Each workspace has a "Let Claude read full data" setting, **on** by default. Off = today's summaries-only answers, computed in the browser. |
| Glossary priority | For a column's description: confirmed for this dataset > glossary term > AI suggestion. |

## Defaults I'll use unless told otherwise

- **One dataset, one workspace.** Uploading the same file into a second workspace makes a separate
  dataset there (starting from the earlier one's saved descriptions, as copies do today).
- **Existing users** get a workspace called "My workspace" on first load. Nothing already saved
  (descriptions, relationship decisions) is lost.
- **Glossary terms match by header words**, so `Customer ID`, `customer_id` and `CustomerID` are
  the same term. Each term can also list other names it goes by ("also called").
- **Ask history** (questions and answers) is saved per workspace, so it survives reloads.
- **Model for full-data answers:** a new `SEMA_ASK_MODEL` setting defaulting to `claude-opus-5-5`,
  since writing correct analysis code needs the strongest model. The other features keep
  `SEMA_AI_MODEL` (currently Haiku). This costs more per question than today.
- **Large files:** CSVs are gzipped in the browser before upload to fit Vercel's ~4.5 MB request
  limit. A file still too big after compressing falls back to summaries-only answers, with a note
  saying so. Splitting very large files into parts is a later improvement.

## Phase 1: Save datasets in the browser

Datasets currently live only in React state and vanish on reload. Everything else depends on
them persisting.

- `src/lib/persist/db.ts`: a small IndexedDB wrapper (no new dependency) with stores for
  workspaces, datasets (CSV text plus file name, fingerprints, identity) and ask history.
- On startup, load the current workspace's datasets and re-profile them (profiles aren't stored,
  so profiling changes apply to old data).
- Adding, removing, cleaning (new version) and generating datasets write through to IndexedDB.
- Handle IndexedDB being unavailable (private windows): keep working in memory with a notice.
- Tests: the wrapper against `fake-indexeddb` (dev dependency only), round trips and failures.

## Phase 2: Workspaces

- A workspace: id, name, created date, full-data setting.
- **Sidebar:** a workspace switcher at the top (current name, a list of the others, "New
  workspace"), with rename and delete in a small menu. Deleting asks for confirmation and removes
  the workspace's datasets and their uploaded copies at Anthropic.
- Dataset list, "All datasets" (relationships), "Ask your data", Prepare and Generate all work
  on the current workspace only. Generating a related dataset adds it to the current workspace.
- **Claude only sees the current workspace:** relationship requests, ask requests and suggested
  questions are built from that workspace's datasets, and saved analyses are keyed by workspace.
- Relationship decisions (confirmed/rejected) and diagram positions are kept per workspace.
- Dataset identity matching (recognising re-uploads and new versions) looks only within the
  workspace.
- "Move to another workspace" for a dataset: left for later unless there's time.

## Phase 3: Data glossary

- A workspace has a glossary: terms, each with a description, an optional role (identifier,
  measure, category, etc., as on columns), optional "also called" names, and where it came from.
- **Adding terms by drag and drop:** column rows on a dataset's page can be dragged onto a
  "Glossary" drop area in the sidebar (and onto the Glossary page). Dropping creates a term
  named after the column, with that column's current description and role filled in, ready to
  edit. Keyboard and touch users get an "Add to glossary" button on each column instead, since
  dragging isn't accessible on its own.
- **Glossary page** (a sidebar item per workspace): list, search, edit, delete, add by hand, and
  for each term the datasets and columns it applies to.
- **Applying terms:** `resolveUnderstanding` gains the glossary. Order: confirmed for this
  dataset > glossary > AI. A new source badge, "From glossary", sits beside "Confirmed" and
  "AI suggestion", and a column's panel offers "Use for this dataset only" to override.
- **Claude uses the glossary too:** interpreting a dataset, finding relationships and Ask your
  data receive the workspace glossary as settled definitions. Columns that share a glossary term
  across datasets are flagged to Claude as strong evidence of a link.
- Tests: term matching (header words, aliases), resolve order, drag-and-drop helpers.

## Phase 4: Full data in Ask your data (code execution)

- **Upload:** a new `/api/files` endpoint takes a gzipped CSV, uploads it to Anthropic's Files
  API with the server-side key, and returns the file id. The browser remembers file ids per
  dataset content version, so each file is uploaded once, and deletes them when a dataset or
  workspace is removed.
- **Answer:** `/api/ask` gains a full-data mode that sends the question, the workspace's file ids
  as container uploads, dataset summaries, the glossary and the relationship links, with the code
  execution tool and a strict `report_answer` tool. Claude explores the data in Python and then
  calls `report_answer` with a short message, a result table (up to 1,000 rows) and a chart
  suggestion. It handles `pause_turn`, refusals (with server-side fallbacks, per the API
  guidance) and errors; it reuses the workspace's container between questions where possible.
- **Display:** the answer card shows the table and chart as today (`resolveChart`, including pie
  and heatmap), plus "How this was worked out" listing the steps Claude took, with its code
  available behind a "Show code" toggle.
- **Time limits:** answers can take longer than the current 60-second function limit, so the
  function limit is raised to what the Vercel plan allows (up to 300 seconds with Fluid
  compute), and the card shows progress while it works.
- **Private workspaces** (setting off) keep the current plan-in-Claude, compute-in-browser
  answers unchanged.
- **Wording:** the Ask page's privacy note changes to say plainly that, with full data on, the
  workspace's files are uploaded to Anthropic for analysis; the setting is linked right there.
- Tests: request building, file-id caching, `report_answer` validation, the API handler with a
  mocked client (tool loop, pause_turn, refusal, oversized files).

## Phase 5: Check everything together

- Two workspaces with overlapping file names; confirm relationships, ask and glossary stay
  separate; reload and confirm everything persists.
- Real questions in full-data mode that the old mode couldn't answer (percentage of total,
  month-over-month change, text matching), checked against values computed by hand.
- Update `README.md` and `.env.example` (`SEMA_ASK_MODEL`, what full data means for privacy).

## Risks and how I'll handle them

- **Vercel time and size limits** are the most likely things to bite in production, since they
  only show once deployed. I'll check the limits against Vercel's documentation and test with a
  large file locally. If an answer can't finish in time, the card says so rather than hanging.
- **API details:** I'll check code execution, the Files API and container reuse against the
  current API documentation before writing that code, rather than from memory.
- **Cost:** checking Phase 4 means real Claude calls with code execution, roughly tens of calls
  overnight.
- **If a phase can't be finished**, I'll stop there with everything before it committed and
  working, and say exactly where it stands.
