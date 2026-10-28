import { useId, useState } from 'react'
import { Scissors, X } from 'lucide-react'
import type { CsvRow } from '../../lib/parseCsv'
import { isMissing } from '../../lib/profiling'
import {
  DELIMITERS,
  MAX_PARTS,
  countParts,
  defaultNames,
  emptyParts,
  guessDelimiter,
  keptNames,
  splitColumns,
  splitProblem,
  splitValue,
  type Split,
} from '../../lib/clean/split'
import { linkButton } from '../understanding/styles'

const PREVIEW_ROWS = 3
const CUSTOM = '\u0000custom'

interface SplitColumnProps {
  columns: readonly string[]
  rows: readonly CsvRow[]
  splits: readonly Split[]
  onAdd: (split: Split) => void
  onRemove: (column: string) => void
}

/**
 * "Split a column": pick a column and a separator, see how a few values split, choose and name the
 * new columns, and add the split to the changes waiting to be applied.
 */
export function SplitColumn({ columns, rows, splits, onAdd, onRemove }: SplitColumnProps) {
  const ids = { column: useId(), delimiter: useId(), parts: useId() }
  const available = columns.filter((c) => !splits.some((s) => s.column === c))
  const [column, setColumn] = useState('')
  const [choice, setChoice] = useState('')
  const [custom, setCustom] = useState('')
  const [parts, setParts] = useState(2)
  const [names, setNames] = useState<string[]>([])
  const [skip, setSkip] = useState<number[]>([])
  const [keepOriginal, setKeepOriginal] = useState(true)

  const delimiter = choice === CUSTOM ? custom : choice
  const taken = splitColumns(columns, splits)

  /** Picks sensible defaults whenever the column or separator changes. */
  function reset(nextColumn: string, nextDelimiter: string) {
    const n = Math.max(2, countParts(rows, nextColumn, nextDelimiter))
    setParts(n)
    setNames(defaultNames(nextColumn, n, taken))
    setSkip(emptyParts(rows, nextColumn, nextDelimiter, n))
  }

  function chooseColumn(next: string) {
    setColumn(next)
    const guessed = next ? (guessDelimiter(rows, next) ?? ',') : ''
    setChoice(guessed)
    if (next) reset(next, guessed)
  }

  function chooseDelimiter(next: string) {
    setChoice(next)
    if (column && next !== CUSTOM) reset(column, next)
  }

  function changeParts(n: number) {
    const count = Math.min(Math.max(n, 2), MAX_PARTS)
    setParts(count)
    setSkip((current) => current.filter((i) => i < count))
    setNames((current) => {
      const extra = defaultNames(column, MAX_PARTS, [...taken, ...current])
      return Array.from({ length: count }, (_, i) => current[i] ?? extra[i - current.length])
    })
  }

  const split: Split = {
    column,
    delimiter,
    names: names.map((n) => n.trim()),
    keepOriginal,
    skip,
  }
  const problem = column ? splitProblem(columns, splits, split) : null
  const examples = column
    ? rows
        .map((r) => r[column])
        .filter((v): v is string => v !== undefined && !isMissing(v))
        .slice(0, PREVIEW_ROWS)
    : []
  const splitsAnything = examples.some((v) => splitValue(v, delimiter, 2)[1] !== '')

  const input =
    'rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200'

  return (
    <div className="space-y-3">
      <div>
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Scissors className="h-4 w-4 text-violet-500" aria-hidden /> Split a column
        </h4>
        <p className="text-xs text-slate-500">
          Turn one column into several at a separator, e.g. “Leeds, UK” into a city and a country.
          Untick any part you don’t need, e.g. to keep just the number from “-1234”.
        </p>
      </div>

      {splits.length > 0 && (
        <ul className="space-y-1">
          {splits.map((s) => (
            <li
              key={s.column}
              className="flex items-center justify-between gap-2 rounded-lg bg-violet-50 px-3 py-1.5 text-sm text-violet-900"
            >
              <span>
                Split <span className="font-medium">{s.column}</span> at{' '}
                {delimiterName(s.delimiter)} into {keptNames(s).join(', ')}
                {s.keepOriginal ? ' (keeping the original)' : ''}
              </span>
              <button
                onClick={() => onRemove(s.column)}
                aria-label={`Don't split ${s.column}`}
                className="rounded p-1 text-violet-700 hover:bg-violet-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-slate-600" htmlFor={ids.column}>
          <span className="block">Column</span>
          <select
            id={ids.column}
            value={column}
            onChange={(e) => chooseColumn(e.target.value)}
            className={input}
          >
            <option value="">Choose a column…</option>
            {available.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {column && (
          <>
            <label className="space-y-1 text-xs text-slate-600" htmlFor={ids.delimiter}>
              <span className="block">Split at</span>
              <select
                id={ids.delimiter}
                value={choice}
                onChange={(e) => chooseDelimiter(e.target.value)}
                className={input}
              >
                {DELIMITERS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
                <option value={CUSTOM}>Something else…</option>
              </select>
            </label>
            {choice === CUSTOM && (
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onBlur={() => custom && reset(column, custom)}
                placeholder="e.g. ::"
                aria-label="Separator"
                className={`${input} w-20`}
              />
            )}
            <label className="space-y-1 text-xs text-slate-600" htmlFor={ids.parts}>
              <span className="block">Into parts</span>
              <input
                id={ids.parts}
                type="number"
                min={2}
                max={MAX_PARTS}
                value={parts}
                onChange={(e) => changeParts(Number(e.target.value))}
                className={`${input} w-16`}
              />
            </label>
            <label className="flex items-center gap-1.5 pb-1.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={keepOriginal}
                onChange={(e) => setKeepOriginal(e.target.checked)}
                className="h-3.5 w-3.5 accent-violet-600"
              />
              Keep the original column
            </label>
          </>
        )}
      </div>

      {column && delimiter && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-1.5 font-medium text-slate-500">{column}</th>
                {names.map((name, i) => {
                  const kept = !skip.includes(i)
                  return (
                    <th key={i} className="px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={kept}
                          onChange={() =>
                            setSkip((current) =>
                              kept ? [...current, i] : current.filter((j) => j !== i),
                            )
                          }
                          aria-label={`Keep part ${i + 1}`}
                          title={kept ? 'Leave this part out' : 'Keep this part'}
                          className="h-3.5 w-3.5 accent-violet-600"
                        />
                        <input
                          value={name}
                          disabled={!kept}
                          onChange={(e) =>
                            setNames((current) =>
                              current.map((n, j) => (j === i ? e.target.value : n)),
                            )
                          }
                          aria-label={`Name of new column ${i + 1}`}
                          className={`${input} w-32 text-xs font-medium disabled:bg-slate-50 disabled:text-slate-400 disabled:line-through`}
                        />
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {examples.map((v, r) => (
                <tr key={r} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-500">{v}</td>
                  {splitValue(v, delimiter, parts).map((p, i) => (
                    <td
                      key={i}
                      className={`px-3 py-1.5 ${skip.includes(i) ? 'text-slate-300 line-through' : 'text-slate-800'}`}
                    >
                      {p || <span className="italic text-slate-300">empty</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {column && delimiter && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              onAdd(split)
              setColumn('')
            }}
            disabled={problem !== null}
            className={`${linkButton} rounded-md border border-violet-200 px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Add this split
          </button>
          {problem ? (
            <p className="text-xs text-amber-700">{problem}</p>
          ) : (
            !splitsAnything &&
            examples.length > 0 && (
              <p className="text-xs text-amber-700">
                None of these values contain that separator, so the new columns would be mostly
                empty.
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}

function delimiterName(d: string): string {
  const known = DELIMITERS.find((x) => x.value === d)
  return known ? known.label.split(' (')[0].toLowerCase() : `“${d}”`
}
