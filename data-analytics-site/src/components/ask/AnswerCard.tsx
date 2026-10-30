import { AlertCircle, Download, HelpCircle, Info, Loader2, Sparkles } from 'lucide-react'
import type { AskEntry } from '../../hooks/useAsk'
import { requestedChart, resolveChart } from '../../lib/ask/chart'
import { describePlan } from '../../lib/ask/describe'
import type { QueryResult } from '../../lib/ask/execute'
import { toCsvText } from '../../lib/generate/client'
import { quietButton } from '../understanding/styles'
import { formatCell } from './format'
import { ResultChart } from './ResultChart'
import { ResultTable } from './ResultTable'

const ERROR_HINTS: Partial<Record<string, string>> = {
  not_configured: 'Add ANTHROPIC_API_KEY to the server settings to turn it on (see .env.example).',
  rate_limited: 'Wait a minute, then try again.',
}

/** One question and its answer: Claude's plan, run on the data in this browser. */
export function AnswerCard({ entry, onRetry }: { entry: AskEntry; onRetry: () => void }) {
  const { answer, outcome, error } = entry
  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-medium text-slate-900">{entry.question}</h3>

      {entry.status === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Working out how to answer…
        </p>
      )}

      {entry.status === 'error' && error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1">
            {error.message} {ERROR_HINTS[error.code] ?? ''}
          </p>
          {error.code !== 'not_configured' && (
            <button onClick={onRetry} className={`${quietButton} -my-1 text-red-700`}>
              Try again
            </button>
          )}
        </div>
      )}

      {answer && !answer.answerable && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {answer.message}
        </p>
      )}

      {answer?.answerable && outcome && (
        <>
          <p className="flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-slate-800">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-label="AI plan" />
            {answer.message}
          </p>
          {outcome.ok ? (
            <Result result={outcome.result} chart={answer.chart} question={entry.question} />
          ) : (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {outcome.message}
            </p>
          )}
          <details className="text-sm text-slate-600">
            <summary className="cursor-pointer text-xs font-medium text-violet-700 hover:underline">
              How this was worked out
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {describePlan(answer.plan, (key) => entry.names[key] ?? key).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              Claude planned these steps from the dataset summaries. They ran in your browser on
              every row, so the numbers come from your data, not from the AI.
            </p>
          </details>
        </>
      )}
    </article>
  )
}

function Result({
  result,
  chart,
  question,
}: {
  result: QueryResult
  chart: NonNullable<AskEntry['answer']>['chart']
  question: string
}) {
  const single = result.rows.length === 1 && result.columns.every((c) => c.numeric)
  const drawn = resolveChart(question, chart, result)
  // Headline figures don't need a chart unless the question asked for one.
  const showChart = drawn !== null && (!single || requestedChart(question) !== null)
  return (
    <div className="space-y-3">
      {result.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-800">
          {result.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      )}

      {result.totalRows === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          No rows matched.
        </p>
      ) : single ? (
        // A headline figure (or a few) reads better as numbers than as a one-row table.
        <>
          <dl className="flex flex-wrap gap-4">
            {result.columns.map((c, i) => (
              <div key={c.label} className="min-w-32 rounded-lg border border-slate-200 px-4 py-3">
                <dt className="text-xs text-slate-500">{c.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                  {formatCell(result.rows[0][i])}
                </dd>
              </div>
            ))}
          </dl>
          {showChart && drawn && <ResultChart chart={drawn} />}
        </>
      ) : (
        <>
          {showChart && drawn && <ResultChart chart={drawn} />}
          <ResultTable result={result} />
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {result.totalRows > result.rows.length
            ? `Showing ${result.rows.length.toLocaleString('en-US')} of ${result.totalRows.toLocaleString('en-US')} rows · `
            : ''}
          Worked out from {result.sourceRows.toLocaleString('en-US')} row
          {result.sourceRows === 1 ? '' : 's'}
        </span>
        {result.totalRows > 0 && (
          <button
            onClick={() => downloadResult(result, question)}
            className={`${quietButton} inline-flex items-center gap-1.5 text-xs`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download CSV
          </button>
        )}
      </div>
    </div>
  )
}

/** Saves the shown rows as CSV, escaped so spreadsheet apps can't run formulas. */
function downloadResult(result: QueryResult, question: string) {
  const rows = result.rows.map((r) => r.map((v) => (v === null ? '' : String(v))))
  const csv = toCsvText(
    result.columns.map((c) => c.label),
    rows,
    { forSpreadsheet: true },
  )
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${
    question
      .replace(/[^\w\s-]/g, '')
      .trim()
      .slice(0, 60)
      .replace(/\s+/g, '-') || 'answer'
  }.csv`
  link.click()
  URL.revokeObjectURL(url)
}
