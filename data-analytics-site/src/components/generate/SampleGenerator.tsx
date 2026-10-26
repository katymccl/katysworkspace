import { useId, useState } from 'react'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { buildBaseContext, type BaseSource } from '../../lib/generate/base'
import { generatedToCsvData, requestSample } from '../../lib/generate/client'
import { GENERATE_LIMITS, type GenerateRequest } from '../../lib/generate/schema'
import { maxRowsFor, parseColumnSpec } from '../../lib/generate/spec'
import type { CsvData } from '../../lib/parseCsv'
import type { UnderstandingError } from '../../lib/understanding'

export interface BaseOption {
  /** The open dataset's id in the app. */
  id: string
  name: string
}

interface SampleGeneratorProps {
  /** Open datasets a new one can be based on. */
  bases: BaseOption[]
  /** Summary of an open dataset, for basing a new one on it. */
  getBase: (id: string) => { source: BaseSource; datasetId: string } | null
  /** Pre-selects a base, e.g. when opened from a dataset's page. */
  initialBaseId?: string
  onGenerated: (data: CsvData) => void
}

const EXAMPLE = `order_id
order_date
customer_name
book_title
quantity: 1 to 5
unit_price: in GBP, 5 to 40`

const ERROR_HINTS: Partial<Record<string, string>> = {
  not_configured: 'Add ANTHROPIC_API_KEY to the server settings to turn it on (see .env.example).',
  rate_limited: 'Wait a minute, then try again.',
}

/**
 * Lets the user describe a dataset and asks Claude for fictional data: from scratch, or to
 * complement one of their open datasets.
 */
export function SampleGenerator({
  bases,
  getBase,
  initialBaseId,
  onGenerated,
}: SampleGeneratorProps) {
  const ids = { base: useId(), description: useId(), columns: useId(), rows: useId() }
  const [baseId, setBaseId] = useState(
    initialBaseId && bases.some((b) => b.id === initialBaseId) ? initialBaseId : '',
  )
  const [description, setDescription] = useState('')
  const [columnText, setColumnText] = useState('')
  const [rowText, setRowText] = useState(initialBaseId ? '' : '25')
  const [status, setStatus] = useState<'idle' | 'loading'>('idle')
  const [error, setError] = useState<UnderstandingError | null>(null)

  const base = baseId ? bases.find((b) => b.id === baseId) : undefined
  const { columns, errors } = parseColumnSpec(columnText)
  const maxRows = maxRowsFor(columns.length)
  const requestedRows =
    rowText.trim() === '' ? undefined : Math.max(1, Math.floor(Number(rowText)) || 1)
  const rowCount = requestedRows === undefined ? undefined : Math.min(requestedRows, maxRows)
  const canGenerate =
    errors.length === 0 &&
    (columns.length > 0 || base !== undefined) &&
    (rowCount !== undefined || base !== undefined) &&
    status !== 'loading'

  async function generate() {
    const chosenBase = base ? getBase(base.id) : null
    const request: GenerateRequest = {
      description: description.trim(),
      columns,
      ...(rowCount !== undefined && { rowCount }),
      ...(chosenBase && { base: buildBaseContext(chosenBase.source) }),
    }
    setStatus('loading')
    setError(null)
    const outcome = await requestSample(request)
    if (!outcome.ok) {
      setError(outcome.error)
      setStatus('idle')
      return
    }
    const { data } = await generatedToCsvData(outcome.result, chosenBase ?? undefined)
    setStatus('idle')
    onGenerated(data)
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200'
  const optional = <span className="font-normal text-slate-400">(optional)</span>

  return (
    <section
      aria-labelledby="generate-heading"
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div>
        <h3 id="generate-heading" className="flex items-center gap-2 font-medium text-slate-900">
          <Sparkles className="h-4 w-4 text-violet-500" aria-hidden /> Generate a sample dataset
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Describe the data you want and Claude will make up realistic, fictional rows. Base it on
          one of your datasets to get data that fits with it, such as a list of the libraries or
          customers it mentions.
        </p>
      </div>

      {bases.length > 0 && (
        <div className="space-y-1">
          <label htmlFor={ids.base} className="text-sm font-medium text-slate-700">
            Base it on {optional}
          </label>
          <select
            id={ids.base}
            value={baseId}
            onChange={(e) => setBaseId(e.target.value)}
            className={inputClass}
          >
            <option value="">Nothing: start from scratch</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={ids.description} className="text-sm font-medium text-slate-700">
          {base ? 'What should the new dataset contain?' : 'What is it about?'} {!base && optional}
        </label>
        <input
          id={ids.description}
          value={description}
          maxLength={GENERATE_LIMITS.maxDescription}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            base
              ? `e.g. One row per library in ${base.name}, with its city and opening year`
              : 'Orders for a small online bookshop in 2024'
          }
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={ids.columns} className="text-sm font-medium text-slate-700">
          Columns {base && optional}
        </label>
        <p className="text-xs text-slate-500">
          One per line. Add a hint after a colon, like <code>quantity: 1 to 5</code>.
          {base && ' Leave empty to let Claude choose.'}
        </p>
        <textarea
          id={ids.columns}
          rows={base ? 4 : 6}
          value={columnText}
          onChange={(e) => setColumnText(e.target.value)}
          placeholder={base ? 'library_id\ncity\nopened_year: 1950 to 2020' : EXAMPLE}
          className={`${inputClass} font-mono`}
          aria-describedby={errors.length > 0 ? `${ids.columns}-errors` : undefined}
        />
        {errors.length > 0 && (
          <ul id={`${ids.columns}-errors`} className="space-y-0.5 text-xs text-red-700">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {!base && columnText.trim() === '' && (
          <button
            type="button"
            onClick={() => {
              setColumnText(EXAMPLE)
              setDescription((d) => d || 'Orders for a small online bookshop in 2024')
            }}
            className="text-xs font-medium text-violet-700 hover:underline"
          >
            Use the example
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label htmlFor={ids.rows} className="text-sm font-medium text-slate-700">
            Rows {base && optional}
          </label>
          <input
            id={ids.rows}
            type="number"
            min={1}
            max={maxRows}
            value={rowText}
            placeholder={base ? 'Auto' : undefined}
            onChange={(e) => setRowText(e.target.value)}
            className={`${inputClass} w-24`}
          />
        </div>
        <button
          onClick={generate}
          disabled={!canGenerate}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {status === 'loading' ? 'Generating…' : 'Generate with AI'}
        </button>
      </div>
      <p className="text-xs text-slate-400">
        {requestedRows !== undefined && requestedRows !== rowCount
          ? `Up to ${maxRows} rows for ${columns.length} columns (${GENERATE_LIMITS.maxCells} values at most), so ${rowCount} will be made. `
          : ''}
        {status === 'loading'
          ? 'This can take up to a minute.'
          : base
            ? `Sends your description and columns, plus ${base.name}'s column details, ${GENERATE_LIMITS.baseSampleRows} sample rows and up to ${GENERATE_LIMITS.baseKeyRows} distinct values from its ID and name columns, to Claude.`
            : 'Only your description and column list are sent to Claude.'}
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {error.message} {ERROR_HINTS[error.code] ?? ''}
          </p>
        </div>
      )}
    </section>
  )
}
