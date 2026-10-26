import { FileSpreadsheet, X } from 'lucide-react'
import { formatBytes, type CsvData } from '../lib/parseCsv'

const PREVIEW_ROWS = 100

interface CsvPreviewProps {
  data: CsvData
  onRemove: () => void
}

export function CsvPreview({ data, onRemove }: CsvPreviewProps) {
  const shown = data.rows.slice(0, PREVIEW_ROWS)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 shrink-0 text-violet-500" />
          <div className="min-w-0">
            <p className="truncate font-medium">{data.fileName}</p>
            <p className="text-sm text-slate-500">
              {data.rows.length.toLocaleString()} rows · {data.columns.length} columns ·{' '}
              {formatBytes(data.fileSize)}
            </p>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          <X className="h-4 w-4" /> Remove
        </button>
      </div>

      {data.warnings.length > 0 && (
        <details className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <summary className="cursor-pointer">
            {data.warnings.length} row{data.warnings.length === 1 ? '' : 's'} had parsing issues
          </summary>
          <ul className="mt-2 list-disc pl-5">
            {data.warnings.slice(0, 20).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100">
            <tr>
              {data.columns.map((col) => (
                <th key={col} className="whitespace-nowrap px-4 py-2 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50">
                {data.columns.map((col) => (
                  <td key={col} className="whitespace-nowrap px-4 py-2">
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.rows.length > PREVIEW_ROWS && (
        <p className="text-sm text-slate-500">
          Showing the first {PREVIEW_ROWS} of {data.rows.length.toLocaleString()} rows.
        </p>
      )}
    </section>
  )
}
