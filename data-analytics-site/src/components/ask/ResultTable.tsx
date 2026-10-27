import type { QueryResult } from '../../lib/ask/execute'
import { formatCell } from './format'

/** The full answer as a table: the source of truth beside any chart. */
export function ResultTable({ result }: { result: QueryResult }) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
          <tr>
            {result.columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={`px-3 py-2 font-medium whitespace-nowrap ${c.numeric ? 'text-right' : ''}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {result.rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {row.map((value, j) => (
                <td
                  key={j}
                  className={`px-3 py-1.5 ${result.columns[j].numeric ? 'text-right tabular-nums' : ''} ${value === null ? 'text-slate-400 italic' : 'text-slate-800'}`}
                >
                  {formatCell(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
