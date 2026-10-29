import { useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, BrushCleaning, Check, Copy, Loader2, Sparkles, X } from 'lucide-react'
import type { Dataset } from '../../lib/datasets'
import {
  NO_EDITS,
  applyAll,
  cellKey,
  removedRowSet,
  summariseEdits,
  toggleRemoved,
  type CleanEdits,
  type Replacement,
} from '../../lib/clean/apply'
import { readDate, resolveDate, standardiseDate, type DayMonthOrder } from '../../lib/clean/dates'
import {
  expectedKind,
  findIssues,
  fits,
  issueCount,
  type DateFormatIssue,
  type ExpectedKind,
} from '../../lib/clean/detect'
import {
  buildCleanRequest,
  claudeCanHelp,
  requestCleanSuggestions,
  type CleanContext,
} from '../../lib/clean/request'
import { CLEAN_LIMITS, type CleanSuggestions } from '../../lib/clean/schema'
import { keptNames } from '../../lib/clean/split'
import type { CsvRow } from '../../lib/parseCsv'
import { isMissing } from '../../lib/profiling'
import type { UnderstandingError } from '../../lib/understanding'
import { linkButton, primaryButton, quietButton } from '../understanding/styles'
import { SplitColumn } from './SplitColumn'

const PAGE = 10

const EXPECTED_LABEL: Record<ExpectedKind, string> = {
  number: 'numbers',
  date: 'dates',
  boolean: 'yes/no values',
}

interface CleanPanelProps {
  dataset: Dataset
  context: CleanContext
  /** Saves the cleaned columns and rows as the dataset's new version. */
  onApply: (cleaned: { columns: string[]; rows: CsvRow[] }, summary: string) => Promise<void>
  onClose: () => void
}

interface SuggestState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Claude's fixes by cell key, and its spelling groups. */
  fixes: Map<string, { value: string; reason: string }>
  standardise: CleanSuggestions['standardise']
  error: UnderstandingError | null
}

const NO_SUGGESTIONS: SuggestState = { status: 'idle', fixes: new Map(), standardise: [], error: null }

/**
 * "Prepare my data": the browser lists missing values, duplicate rows, values that don't fit
 * their column and date columns written several ways; the user decides what to change. Claude can suggest fixes for the flagged cells,
 * but nothing changes until the user applies it, and then only as a new version in this browser.
 */
export function CleanPanel({ dataset, context, onApply, onClose }: CleanPanelProps) {
  const { columns, rows, profile } = dataset
  const issues = useMemo(() => findIssues(columns, rows, profile), [columns, rows, profile])
  const [edits, setEdits] = useState<CleanEdits>(NO_EDITS)
  const [suggest, setSuggest] = useState<SuggestState>(NO_SUGGESTIONS)
  const [applying, setApplying] = useState(false)

  const total = issueCount(issues)
  const duplicateCount = issues.duplicates.reduce((n, d) => n + d.copies.length, 0)
  const missingCount = issues.missing.reduce((n, m) => n + m.rows.length, 0)
  const { changedValues, removedRows } = summariseEdits(rows, issues, edits)
  const hasChanges = changedValues > 0 || removedRows > 0 || edits.splits.length > 0
  const removed = removedRowSet(issues, edits)
  const picked = new Set(edits.removeRows)
  const onToggleRemove = (list: number[]) => setEdits((e) => toggleRemoved(e, list))
  const help = useMemo(() => claudeCanHelp(rows, profile, issues), [rows, profile, issues])
  // Rewritten dates are counted among the changed values, so they're named rather than added.
  const datesNote =
    edits.dates.length > 0
      ? `, including dates in ${edits.dates.map((d) => d.column).join(', ')} written as YYYY-MM-DD`
      : ''
  const setDates = (column: string, order: DayMonthOrder | null) =>
    setEdits((e) => ({
      ...e,
      dates: [
        ...e.dates.filter((d) => d.column !== column),
        ...(order ? [{ column, order }] : []),
      ],
    }))

  const setCell = (row: number, column: string, value: string | undefined) =>
    setEdits((e) => {
      const cells = { ...e.cells }
      if (value === undefined) delete cells[cellKey(row, column)]
      else cells[cellKey(row, column)] = value
      return { ...e, cells }
    })
  const toggleReplacement = (r: Replacement) =>
    setEdits((e) => {
      const has = e.replacements.some((x) => x.column === r.column && x.to === r.to)
      return {
        ...e,
        replacements: has
          ? e.replacements.filter((x) => !(x.column === r.column && x.to === r.to))
          : [...e.replacements, r],
      }
    })

  async function suggestFixes() {
    setSuggest((s) => ({ ...s, status: 'loading', error: null }))
    const { request, cells } = buildCleanRequest(columns, rows, profile, issues, context)
    const outcome = await requestCleanSuggestions(request)
    if (!outcome.ok) {
      setSuggest((s) => ({ ...s, status: 'error', error: outcome.error }))
      return
    }
    const fixes = new Map<string, { value: string; reason: string }>()
    for (const f of outcome.result.suggestions.fixes) {
      const cell = cells.get(f.id)
      if (cell) fixes.set(cellKey(cell.row, cell.column), { value: f.value, reason: f.reason })
    }
    setSuggest({
      status: 'ready',
      fixes,
      standardise: outcome.result.suggestions.standardise,
      error: null,
    })
  }

  async function apply() {
    setApplying(true)
    const parts = [
      removedRows > 0 && `removed ${plural(removedRows, 'row')}`,
      changedValues > 0 && `changed ${plural(changedValues, 'value')}${datesNote}`,
      ...edits.splits.map((s) => `split ${s.column} into ${keptNames(s).join(', ')}`),
    ].filter(Boolean)
    await onApply(
      applyAll(columns, rows, issues, edits),
      `Prepared ${dataset.fileName}: ${parts.join(', ')}.`,
    )
    setApplying(false)
  }

  const expectedOf = (column: string): ExpectedKind | undefined => {
    const profiled = profile.columns.find((c) => c.name === column)
    return (profiled && expectedKind(profiled)) ?? undefined
  }
  const fixCount = suggest.fixes.size
  const flaggedForClaude = Math.min(issues.mismatches.length + missingCount, CLEAN_LIMITS.maxIssues)

  return (
    <section
      aria-labelledby="clean-heading"
      className="space-y-5 rounded-xl border border-violet-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="clean-heading" className="flex items-center gap-2 font-medium text-slate-900">
            <BrushCleaning className="h-4 w-4 text-violet-500" aria-hidden /> Prepare my data
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {total === 0
              ? 'No missing values, duplicate rows or values of the wrong kind were found.'
              : [
                  missingCount > 0 && plural(missingCount, 'missing value'),
                  duplicateCount > 0 && plural(duplicateCount, 'duplicate row'),
                  issues.mismatches.length > 0 &&
                    `${plural(issues.mismatches.length, 'value')} of the wrong kind`,
                  issues.dateFormats.length > 0 &&
                    `${plural(issues.dateFormats.length, 'date column')} to tidy`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(help.fixes || help.spellings) && (
            <button
              onClick={suggestFixes}
              disabled={suggest.status === 'loading'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60"
            >
              {suggest.status === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {suggest.status === 'loading'
                ? 'Asking Claude…'
                : suggest.status === 'ready'
                  ? 'Ask again'
                  : help.fixes
                    ? 'Suggest fixes with Claude'
                    : 'Check spellings with Claude'}
            </button>
          )}
          <button onClick={onClose} aria-label="Close Prepare my data" className={quietButton}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="w-full text-xs text-slate-400">
          Problems are found in your browser, from every row.
          {(help.fixes || help.spellings) &&
            ` Asking Claude sends it${flaggedForClaude > 0 ? ` the ${plural(flaggedForClaude, 'flagged row')},` : ''} column details${help.spellings ? ' and the values of text columns that may spell something more than one way' : ''}, not the whole file.`}{' '}
          Nothing changes until you apply it.
        </p>
      </div>

      {suggest.status === 'error' && suggest.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {suggest.error.message}
        </p>
      )}
      {suggest.status === 'ready' && (
        <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800" role="status">
          {fixCount === 0 && suggest.standardise.length === 0
            ? 'Claude had no confident fixes. Edit the values yourself or leave them.'
            : [
                fixCount > 0 && `${plural(fixCount, 'suggested fix', 'suggested fixes')} below`,
                suggest.standardise.length > 0 &&
                  `${plural(suggest.standardise.length, 'group')} of values spelled differently`,
              ]
                .filter(Boolean)
                .join(' and ') + '. Use the ones you agree with.'}
        </p>
      )}

      {suggest.standardise.length > 0 && (
        <Group title="Values spelled more than one way">
          <ul className="space-y-2">
            {suggest.standardise.map((s) => {
              const on = edits.replacements.some((r) => r.column === s.column && r.to === s.to)
              return (
                <li
                  key={`${s.column}:${s.to}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{s.column}</span>:{' '}
                    {s.from.map((v) => `“${v}”`).join(', ')} → <span className="font-medium">“{s.to}”</span>
                    <span className="ml-1 text-xs text-slate-500">{s.reason}</span>
                  </span>
                  <ToggleButton on={on} onClick={() => toggleReplacement(s)} labelOn="Will change" labelOff="Use" />
                </li>
              )
            })}
          </ul>
        </Group>
      )}

      {issues.dateFormats.length > 0 && (
        <Group title="Dates to tidy">
          {issues.dateFormats.map((d) => (
            <DateFormatCard
              key={d.column}
              issue={d}
              chosen={edits.dates.find((x) => x.column === d.column)?.order ?? null}
              onChange={(order) => setDates(d.column, order)}
            >
              {d.unreadable.length > 0 && (
                <CellList
                  heading={`Not read as a date (${d.unreadable.length})`}
                  cells={d.unreadable.map((row) => ({ row, value: rows[row][d.column] ?? '' }))}
                  column={d.column}
                  expected={undefined}
                  rows={rows}
                  columns={columns}
                  edits={edits}
                  fixes={suggest.fixes}
                  onChange={setCell}
                  removed={removed}
                  picked={picked}
                  onToggleRemove={onToggleRemove}
                />
              )}
            </DateFormatCard>
          ))}
        </Group>
      )}

      {issues.duplicates.length > 0 && (
        <Group title={`Duplicate rows (${duplicateCount})`}>
          <p className="text-sm text-slate-600">
            {plural(duplicateCount, 'row')} {duplicateCount === 1 ? 'is an exact copy' : 'are exact copies'} of an
            earlier row.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
            {issues.duplicates.slice(0, 5).map((d) => (
              <li key={d.keep}>
                <Copy className="mr-1 inline h-3 w-3" aria-hidden />
                {d.copies.map((c) => `Row ${c + 1}`).join(', ')} {d.copies.length === 1 ? 'repeats' : 'repeat'} row{' '}
                {d.keep + 1}: {rowPreview(rows[d.keep], columns)}
              </li>
            ))}
            {issues.duplicates.length > 5 && <li>…and {issues.duplicates.length - 5} more groups</li>}
          </ul>
          <label className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={edits.removeDuplicates}
              onChange={(e) => setEdits((x) => ({ ...x, removeDuplicates: e.target.checked }))}
              className="h-4 w-4 accent-violet-600"
            />
            Remove the {plural(duplicateCount, 'copy', 'copies')}, keeping the first of each
          </label>
        </Group>
      )}

      {issues.mismatches.length > 0 && (
        <Group title={`Values of the wrong kind (${issues.mismatches.length})`}>
          {groupBy(issues.mismatches, (m) => m.column).map(([column, list]) => (
            <CellList
              key={column}
              heading={`${column}: expects ${EXPECTED_LABEL[list[0].expected]}`}
              cells={list.map((m) => ({ row: m.row, value: m.value }))}
              column={column}
              expected={list[0].expected}
              rows={rows}
              columns={columns}
              edits={edits}
              fixes={suggest.fixes}
              onChange={setCell}
              removed={removed}
              picked={picked}
              onToggleRemove={onToggleRemove}
            />
          ))}
        </Group>
      )}

      {issues.missing.length > 0 && (
        <Group title={`Missing values (${missingCount})`}>
          {issues.missing.map((m) => {
            const expected = expectedOf(m.column)
            return (
              <CellList
                key={m.column}
                heading={`${m.column}: ${plural(m.rows.length, 'missing value')}`}
                cells={m.rows.map((row) => ({ row, value: rows[row][m.column] ?? '' }))}
                column={m.column}
                expected={expected}
                rows={rows}
                columns={columns}
                edits={edits}
                fixes={suggest.fixes}
                onChange={setCell}
                removed={removed}
                picked={picked}
                onToggleRemove={onToggleRemove}
                removeAll={`Remove ${m.rows.length === 1 ? 'this row' : `these ${plural(m.rows.length, 'row')}`}`}
                fillAll={(value) =>
                  setEdits((e) => {
                    const cells = { ...e.cells }
                    for (const row of m.rows) cells[cellKey(row, m.column)] = value
                    return { ...e, cells }
                  })
                }
              />
            )
          })}
        </Group>
      )}

      <div className="border-t border-slate-100 pt-4">
        <SplitColumn
          columns={columns}
          rows={rows}
          splits={edits.splits}
          onAdd={(split) => setEdits((e) => ({ ...e, splits: [...e.splits, split] }))}
          onRemove={(column) =>
            setEdits((e) => ({ ...e, splits: e.splits.filter((x) => x.column !== column) }))
          }
        />
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
        <p className="text-sm text-slate-600" aria-live="polite">
          {hasChanges
            ? capitalise(
                [
                  removedRows > 0 && `remove ${plural(removedRows, 'row')}`,
                  changedValues > 0 && `change ${plural(changedValues, 'value')}${datesNote}`,
                  edits.splits.length > 0 && `split ${plural(edits.splits.length, 'column')}`,
                ]
                  .filter(Boolean)
                  .join(', '),
              )
            : 'Anything you don’t change is left as it is.'}
        </p>
        <div className="flex gap-2">
          {hasChanges && (
            <button onClick={() => setEdits(NO_EDITS)} className={quietButton}>
              Undo all
            </button>
          )}
          <button
            onClick={apply}
            disabled={!hasChanges || applying}
            className={`${primaryButton} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {applying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Apply changes
          </button>
        </div>
      </div>
    </section>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {children}
    </div>
  )
}

/**
 * One date column written several ways: which ways, what they become, and (when the numbers don't
 * say) whether `01/04/2024` is 1 April or January 4. Values that aren't dates are listed below.
 */
function DateFormatCard({
  issue,
  chosen,
  onChange,
  children,
}: {
  issue: DateFormatIssue
  /** The order the column will be rewritten in, or null while it's left as it is. */
  chosen: DayMonthOrder | null
  onChange: (order: DayMonthOrder | null) => void
  children: ReactNode
}) {
  const [picked, setPicked] = useState<DayMonthOrder | null>(chosen)
  // When no value depends on the order, either reading gives the same days.
  const order = issue.order === undefined ? 'month-first' : (issue.order ?? picked)
  const pick = (next: DayMonthOrder) => {
    setPicked(next)
    if (chosen) onChange(next)
  }
  // Only the ways of writing that change, e.g. not `2024-01-03` itself.
  const formats = issue.formats.filter(
    (f) => order === null || standardiseDate(f.example, order) !== f.example,
  )
  const example = issue.ambiguousExample
  const reading = example ? readDate(example) : null
  // The example as a day, written the way that order's readers would: "1 April" or "April 1".
  const meaning = (o: DayMonthOrder) => {
    const day = reading && resolveDate(reading, o)
    return day
      ? new Date(Date.UTC(day.year, day.month - 1, day.day)).toLocaleDateString(
          o === 'day-first' ? 'en-GB' : 'en-US',
          { day: 'numeric', month: 'long', timeZone: 'UTC' },
        )
      : null
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-slate-700">
          <span className="font-medium text-slate-900">{issue.column}</span>:{' '}
          {issue.formats.length === 1
            ? `${plural(issue.readable, 'date')} written like “${issue.formats[0].example}”, which isn’t read as a date.`
            : `${plural(issue.readable, 'date')} written ${issue.formats.length} ways.`}
        </p>
        <ToggleButton
          on={chosen !== null}
          disabled={order === null}
          onClick={() => onChange(chosen ? null : order)}
          labelOn="Will change"
          labelOff="Write all as 2024-01-31"
        />
      </div>
      {issue.order === null && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          <span>
            {example
              ? `Which comes first in “${example}”?`
              : 'Some dates put the day first and others the month. Which do most of them use?'}
          </span>
          {(['day-first', 'month-first'] as const).map((o) => (
            <label key={o} className="flex items-center gap-1">
              <input
                type="radio"
                name={`order-${issue.column}`}
                checked={picked === o}
                onChange={() => pick(o)}
                className="accent-violet-600"
              />
              {o === 'day-first' ? 'Day first' : 'Month first'}
              {example && ` (${meaning(o)})`}
            </label>
          ))}
        </div>
      )}
      {order !== null && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {formats.slice(0, 4).map((f) => (
            <li key={f.example}>
              {f.example} → <span className="font-medium text-slate-700">{standardiseDate(f.example, order) ?? f.example}</span>
            </li>
          ))}
          {formats.length > 4 && <li>…and {formats.length - 4} more ways</li>}
        </ul>
      )}
      {children}
    </div>
  )
}

function ToggleButton({
  on,
  onClick,
  labelOn,
  labelOff,
  disabled = false,
}: {
  on: boolean
  onClick: () => void
  labelOn: string
  labelOff: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? 'bg-violet-600 text-white hover:bg-violet-700' : 'border border-violet-200 text-violet-700 hover:bg-violet-50'
      }`}
    >
      {on && <Check className="h-3 w-3" aria-hidden />}
      {on ? labelOn : labelOff}
    </button>
  )
}

/**
 * One column's flagged cells: each can be edited, left, or have its row removed. Missing values
 * also get "fill all" and "remove all these rows".
 */
function CellList({
  heading,
  cells,
  column,
  expected,
  rows,
  columns,
  edits,
  fixes,
  onChange,
  removed,
  picked,
  onToggleRemove,
  removeAll,
  fillAll,
}: {
  heading: string
  cells: { row: number; value: string }[]
  column: string
  expected: ExpectedKind | undefined
  rows: readonly CsvRow[]
  columns: readonly string[]
  edits: CleanEdits
  fixes: SuggestState['fixes']
  onChange: (row: number, column: string, value: string | undefined) => void
  /** Rows that will go (duplicates included); `picked` are the ones the user chose. */
  removed: ReadonlySet<number>
  picked: ReadonlySet<number>
  onToggleRemove: (rows: number[]) => void
  /** Label for removing every row in the list; omitted for lists that don't offer it. */
  removeAll?: string
  fillAll?: (value: string) => void
}) {
  const [shown, setShown] = useState(PAGE)
  const [fill, setFill] = useState('')
  const listRows = cells.map((c) => c.row)
  const allPicked = listRows.every((r) => picked.has(r))

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-sm font-medium text-slate-800">{heading}</p>
        {removeAll && (
          <label className="flex items-center gap-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => onToggleRemove(listRows)}
              className="h-3.5 w-3.5 accent-violet-600"
            />
            {removeAll}
          </label>
        )}
        {fillAll && !allPicked && (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (fill.trim()) fillAll(fill.trim())
            }}
          >
            <label className="text-xs text-slate-500" htmlFor={`fill-${column}`}>
              Fill all with
            </label>
            <input
              id={`fill-${column}`}
              value={fill}
              onChange={(e) => setFill(e.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-violet-500 focus:outline-none"
            />
            <button type="submit" disabled={!fill.trim()} className={`${linkButton} disabled:opacity-50`}>
              Fill
            </button>
          </form>
        )}
      </div>
      <ul className="divide-y divide-slate-100">
        {cells.slice(0, shown).map(({ row, value }) => {
          const key = cellKey(row, column)
          const edited = edits.cells[key]
          const current = edited ?? value
          const fix = fixes.get(key)
          const ok = edited !== undefined && (!expected || fits(expected, current)) && !isMissing(current)
          const stillWrong = edited !== undefined && expected !== undefined && !fits(expected, current)
          if (removed.has(row)) {
            return (
              <li key={row} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-50 px-3 py-2 text-sm">
                <span className="w-16 shrink-0 text-xs text-slate-400 line-through">Row {row + 1}</span>
                <span className="text-xs font-medium text-slate-500">
                  {picked.has(row) ? 'Row will be removed' : 'Removed as a duplicate'}
                </span>
                {picked.has(row) && (
                  <button onClick={() => onToggleRemove([row])} className={linkButton}>
                    Keep row
                  </button>
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400 line-through">
                  {rowPreview(rows[row], columns, column)}
                </span>
              </li>
            )
          }
          return (
            <li key={row} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-xs text-slate-500">Row {row + 1}</span>
              <input
                value={current}
                placeholder="(empty)"
                aria-label={`${column}, row ${row + 1}`}
                onChange={(e) => onChange(row, column, e.target.value === value ? undefined : e.target.value)}
                className={`w-40 rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 ${
                  stillWrong ? 'border-amber-400' : ok ? 'border-green-500' : 'border-slate-300'
                }`}
              />
              {ok && <Check className="h-4 w-4 text-green-600" aria-label="Fixed" />}
              {edited !== undefined && (
                <button onClick={() => onChange(row, column, undefined)} className={linkButton}>
                  Leave as it was
                </button>
              )}
              {fix && edited !== fix.value && (
                <button
                  onClick={() => onChange(row, column, fix.value)}
                  title={fix.reason}
                  className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-800 hover:bg-violet-100"
                >
                  <Sparkles className="h-3 w-3" aria-hidden /> Use “{fix.value}”
                  <span className="text-violet-600">· {fix.reason}</span>
                </button>
              )}
              <button
                onClick={() => onToggleRemove([row])}
                aria-label={`Remove row ${row + 1}`}
                className="text-xs text-slate-500 hover:text-red-700 hover:underline"
              >
                Remove row
              </button>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-400" title={rowPreview(rows[row], columns, column, 20)}>
                {rowPreview(rows[row], columns, column)}
              </span>
            </li>
          )
        })}
      </ul>
      {cells.length > shown && (
        <button onClick={() => setShown((n) => n + PAGE * 5)} className={`${linkButton} px-3 py-2`}>
          Show {Math.min(PAGE * 5, cells.length - shown)} more of {cells.length - shown}
        </button>
      )}
    </div>
  )
}

/** A few of the row's other values, so the user can tell which record it is. */
function rowPreview(row: CsvRow, columns: readonly string[], skip?: string, max = 3): string {
  return columns
    .filter((c) => c !== skip && !isMissing(row[c]))
    .slice(0, max)
    .map((c) => `${c} ${row[c]}`)
    .join(' · ')
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return [...groups]
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}
