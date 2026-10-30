import { AlertCircle, Download, HelpCircle, Info, Loader2, Sparkles } from 'lucide-react'
import type { AskEntry } from '../../hooks/useAsk'
import { requestedChart, resolveChart } from '../../lib/ask/chart'
import { describePlan } from '../../lib/ask/describe'
import type { QueryResult } from '../../lib/ask/execute'
import type { AnalyseResult, ReportAnswer } from '../../lib/ask/fullSchema'
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
          {entry.progress ?? 'Working out how to answer…'}
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

      {entry.full && <FullAnswer full={entry.full} question={entry.question} />}

      {entry.modeNote && (
        <p className="flex items-start gap-2 text-xs text-amber-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {entry.modeNote}
        </p>
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

/** An answer Claude worked out by running code over every row of the workspace's files. */
function FullAnswer({ full, question }: { full: AnalyseResult; question: string }) {
  const { answer, code } = full
  if (!answer.answerable) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {answer.message}
      </p>
    )
  }
  return (
    <>
      <p className="flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-slate-800">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-label="AI answer" />
        {answer.message}
      </p>
      <Result
        result={reportToResult(answer)}
        chart={answer.chart}
        question={question}
        basis="Worked out by Claude from every row of your files"
      />
      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer text-xs font-medium text-violet-700 hover:underline">
          How this was worked out
        </summary>
        {answer.steps.length > 0 && (
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {answer.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Claude read your uploaded files and ran its own code over every row, in Anthropic’s
          sandbox, then reported this table.
        </p>
        {code.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-violet-700 hover:underline">
              Show code ({code.length} step{code.length === 1 ? '' : 's'})
            </summary>
            <div className="mt-2 space-y-2">
              {code.map((c, i) => (
                <pre
                  key={i}
                  className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"
                >
                  <code>{c}</code>
                </pre>
              ))}
            </div>
          </details>
        )}
      </details>
    </>
  )
}

/** A reported table in the shape the result view, charts and download use. */
function reportToResult(answer: ReportAnswer): QueryResult {
  return {
    columns: answer.columns.map((c, i) => ({
      label: c.label,
      // Trust the values, not just the label: only all-number columns are aligned and charted.
      numeric:
        c.numeric &&
        answer.rows.some((r) => r[i] !== null) &&
        answer.rows.every((r) => r[i] === null || typeof r[i] === 'number'),
    })),
    rows: answer.rows,
    totalRows: answer.rows.length,
    sourceRows: answer.rows.length,
    notes: answer.notes,
  }
}

function Result({
  result,
  chart,
  question,
  basis,
}: {
  result: QueryResult
  chart: NonNullable<AskEntry['answer']>['chart']
  question: string
  /** Says where the numbers came from, in place of the row count. */
  basis?: string
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
          {basis ?? (
            <>
              Worked out from {result.sourceRows.toLocaleString('en-US')} row
              {result.sourceRows === 1 ? '' : 's'}
            </>
          )}
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
