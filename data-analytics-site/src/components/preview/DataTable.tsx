import { useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
} from 'lucide-react'
import type { CsvRow } from '../../lib/parseCsv'
import type { ColumnProfile } from '../../lib/profiling'
import { isMissing } from '../../lib/profiling/values'
import { toCsvText } from '../../lib/generate/client'
import {
  cellContains,
  compareValues,
  filterKindFor,
  isActive,
  loadColumnOrder,
  matchesFilter,
  moveColumn,
  reconcileOrder,
  saveColumnOrder,
  type ColumnFilter,
} from '../../lib/preview/table'
import { IdentifierStar } from '../profile/IdentifierStar'
import { identifierLabel } from '../profile/identifierReasons'

const PAGE_SIZES = [25, 50, 100, 250]
/** Drag data for a header being moved to another place in the table. */
const HEADER_DRAG_TYPE = 'application/x-sema-header'

interface DataTableProps {
  /** Stable across versions, so the column order is remembered through Prepare my data. */
  datasetId: string
  fileName: string
  columns: ColumnProfile[]
  rows: CsvRow[]
  /** Shows (or, with null, hides) the column's type tooltip. */
  onHeaderTip?: (column: ColumnProfile | null, target?: HTMLElement) => void
  /** Lets a header also be dropped onto the glossary. */
  columnDrag?: { type: string; data: (column: ColumnProfile) => string }
}

/**
 * The data preview: every row, a page at a time, with sorting (click a header), filters (one per
 * column, plus a search box) and columns that can be dragged into a different order. It changes only
 * the view; the dataset is untouched, and a new version from Prepare my data shows straight away.
 */
export function DataTable({ datasetId, fileName, columns, rows, onHeaderTip, columnDrag }: DataTableProps) {
  const names = useMemo(() => columns.map((c) => c.name), [columns])
  const [savedOrder, setSavedOrder] = useState<string[] | null>(() => loadColumnOrder(datasetId))
  const order = reconcileOrder(savedOrder, names)
  const reordered = order.some((c, i) => c !== names[i])
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const [drop, setDrop] = useState<{ column: string; side: 'before' | 'after' } | null>(null)

  const defs = useMemo<ColumnDef<CsvRow>[]>(
    () =>
      columns.map((c) => ({
        id: c.name,
        // Blanks are undefined, so the table keeps them last whichever way a column is sorted.
        accessorFn: (row) => (isMissing(row[c.name]) ? undefined : row[c.name]),
        sortUndefined: 'last',
        sortDescFirst: false,
        sortingFn: (a, b, id) => compareValues(a.getValue(id), b.getValue(id), c.inferredType),
        filterFn: (row, id, filter: ColumnFilter) => matchesFilter(row.getValue(id), filter),
      })),
    [columns],
  )

  // TanStack Table returns new functions each render, which only matters under the React Compiler,
  // and sema doesn't use it.
  // eslint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting, columnFilters, globalFilter: search.trim(), columnOrder: order, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    globalFilterFn: (row, id, query: string) => cellContains(row.getValue(id), query),
    getColumnCanGlobalFilter: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const changeOrder = (next: string[]) => {
    setSavedOrder(next)
    saveColumnOrder(datasetId, next, names)
  }
  const profileOf = (name: string) => columns.find((c) => c.name === name)!
  const filtered = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = pagination
  const from = filtered === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min(filtered, (pageIndex + 1) * pageSize)
  const viewChanged = sorting.length > 0 || columnFilters.length > 0 || search.trim() !== ''

  const onDragStart = (e: DragEvent, column: ColumnProfile) => {
    e.dataTransfer.setData(HEADER_DRAG_TYPE, column.name)
    if (columnDrag) e.dataTransfer.setData(columnDrag.type, columnDrag.data(column))
    e.dataTransfer.effectAllowed = 'copyMove'
    onHeaderTip?.(null)
  }
  const onDragOver = (e: DragEvent<HTMLElement>, name: string) => {
    if (!e.dataTransfer.types.includes(HEADER_DRAG_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const box = e.currentTarget.getBoundingClientRect()
    const side = e.clientX < box.left + box.width / 2 ? 'before' : 'after'
    if (drop?.column !== name || drop.side !== side) setDrop({ column: name, side })
  }
  const onDrop = (e: DragEvent, name: string) => {
    const moved = e.dataTransfer.getData(HEADER_DRAG_TYPE)
    setDrop(null)
    if (!moved || !drop) return
    e.preventDefault()
    changeOrder(moveColumn(order, moved, name, drop.side))
  }
  /** Alt + ← / → moves the focused column, for keyboards. */
  const onHeaderKey = (e: KeyboardEvent, name: string) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const at = order.indexOf(name)
    const target = order[e.key === 'ArrowLeft' ? at - 1 : at + 1]
    if (target) changeOrder(moveColumn(order, name, target, e.key === 'ArrowLeft' ? 'before' : 'after'))
  }

  const setFilter = (id: string, filter: ColumnFilter) =>
    setColumnFilters((prev) => [
      ...prev.filter((f) => f.id !== id),
      ...(isActive(filter) ? [{ id, value: filter }] : []),
    ])
  const filterOf = (id: string) => columnFilters.find((f) => f.id === id)?.value as ColumnFilter | undefined

  const download = () => {
    const shown = table.getPrePaginationRowModel().rows.map((r) => order.map((c) => r.original[c] ?? ''))
    const csv = toCsvText(order, shown, { forSpreadsheet: true })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.replace(/\.csv$/i, '') + '-view.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const pageButton =
    'rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1 sm:max-w-xs">
          <span className="sr-only">Search the rows</span>
          <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
            placeholder="Search every column"
            className="w-full rounded-lg border border-slate-300 py-1.5 pr-3 pl-8 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
          />
        </label>
        <p className="text-sm text-slate-500" aria-live="polite">
          {filtered === rows.length
            ? `${rows.length.toLocaleString('en-US')} rows`
            : `${filtered.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} rows match`}
        </p>
        <span className="ml-auto flex flex-wrap items-center gap-1">
          {viewChanged && (
            <button
              onClick={() => {
                setSorting([])
                setColumnFilters([])
                setSearch('')
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50"
            >
              Clear sorting and filters
            </button>
          )}
          {reordered && (
            <button
              onClick={() => changeOrder(names)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50"
            >
              Reset column order
            </button>
          )}
          <button
            onClick={download}
            disabled={filtered === 0}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {viewChanged || reordered ? 'Download these rows' : 'Download CSV'}
          </button>
        </span>
      </div>

      <div
        className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white"
        onScroll={() => onHeaderTip?.(null)}
      >
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              <th scope="col" className="w-0 px-3 py-2 text-right text-xs font-medium text-slate-400">
                <span className="sr-only">Row in file</span>#
              </th>
              {order.map((name) => {
                const column = profileOf(name)
                const sorted = table.getColumn(name)?.getIsSorted()
                const marker =
                  drop?.column === name
                    ? drop.side === 'before'
                      ? 'shadow-[inset_3px_0_0_#7c3aed]'
                      : 'shadow-[inset_-3px_0_0_#7c3aed]'
                    : ''
                return (
                  <th
                    key={name}
                    scope="col"
                    draggable
                    onDragStart={(e) => onDragStart(e, column)}
                    onDragOver={(e) => onDragOver(e, name)}
                    onDragLeave={() => setDrop(null)}
                    onDrop={(e) => onDrop(e, name)}
                    onDragEnd={() => setDrop(null)}
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    className={`cursor-grab whitespace-nowrap px-2 py-1 font-semibold active:cursor-grabbing ${marker}`}
                  >
                    <button
                      onClick={(e) => table.getColumn(name)?.toggleSorting(undefined, e.shiftKey)}
                      onKeyDown={(e) => onHeaderKey(e, name)}
                      onMouseEnter={(e) => onHeaderTip?.(column, e.currentTarget)}
                      onMouseLeave={() => onHeaderTip?.(null)}
                      onFocus={(e) => onHeaderTip?.(column, e.currentTarget)}
                      onBlur={() => onHeaderTip?.(null)}
                      title="Click to sort; drag to move (or Alt + ← / →)"
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 hover:bg-slate-200 focus:bg-slate-200 focus:outline-none"
                    >
                      {name}
                      {column.isPotentialIdentifier && <IdentifierStar label={identifierLabel(column)} />}
                      {sorted === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-violet-600" aria-label="sorted ascending" />
                      ) : sorted === 'desc' ? (
                        <ArrowDown className="h-3.5 w-3.5 text-violet-600" aria-label="sorted descending" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" aria-hidden />
                      )}
                    </button>
                  </th>
                )
              })}
            </tr>
            <tr className="border-t border-slate-200">
              <td />
              {order.map((name) => (
                <td key={name} className="px-2 pb-2">
                  <FilterInput
                    column={profileOf(name)}
                    rows={rows}
                    filter={filterOf(name)}
                    onChange={(f) => setFilter(name, f)}
                  />
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-400">{row.index + 1}</td>
                {order.map((name) => (
                  <td key={name} className="max-w-sm truncate whitespace-nowrap px-4 py-2" title={row.original[name]}>
                    {row.original[name]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No rows match the search and filters.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
            className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-sm"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <span className="flex items-center gap-1">
          <span className="mr-2 tabular-nums">
            {from.toLocaleString('en-US')}–{to.toLocaleString('en-US')} of {filtered.toLocaleString('en-US')}
          </span>
          <button onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()} aria-label="First page" className={pageButton}>
            <ChevronsLeft className="h-4 w-4" aria-hidden />
          </button>
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page" className={pageButton}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="px-1 tabular-nums">
            Page {(pageIndex + 1).toLocaleString('en-US')} of {Math.max(1, table.getPageCount()).toLocaleString('en-US')}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page" className={pageButton}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <button onClick={() => table.lastPage()} disabled={!table.getCanNextPage()} aria-label="Last page" className={pageButton}>
            <ChevronsRight className="h-4 w-4" aria-hidden />
          </button>
        </span>
      </div>
    </div>
  )
}

const filterField =
  'w-full min-w-20 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-normal text-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-200 focus:outline-none'

/** The filter under a header: a range for numbers, a pick-list for categories, else "contains". */
function FilterInput({
  column,
  rows,
  filter,
  onChange,
}: {
  column: ColumnProfile
  rows: readonly CsvRow[]
  filter: ColumnFilter | undefined
  onChange: (filter: ColumnFilter) => void
}) {
  const kind = filterKindFor(column)
  // A category's values, in A to Z order, read from the rows so they follow Prepare my data.
  const values = useMemo(() => {
    if (kind !== 'value') return []
    const seen = new Set<string>()
    for (const r of rows) {
      const v = r[column.name]
      if (!isMissing(v)) seen.add(String(v).trim())
    }
    return [...seen].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  }, [kind, rows, column.name])
  const label = `Filter ${column.name}`

  if (kind === 'value') {
    return (
      <select
        aria-label={label}
        value={filter?.kind === 'value' ? filter.equals : ''}
        onChange={(e) => onChange({ kind: 'value', equals: e.target.value })}
        className={filterField}
      >
        <option value="">All</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    )
  }
  if (kind === 'range') {
    const range = filter?.kind === 'range' ? filter : { kind: 'range' as const, min: null, max: null }
    const num = (text: string) => (text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text))
    return (
      <span className="flex gap-1">
        <input
          type="number"
          aria-label={`${label}: at least`}
          placeholder="min"
          value={range.min ?? ''}
          onChange={(e) => onChange({ ...range, min: num(e.target.value) })}
          className={filterField}
        />
        <input
          type="number"
          aria-label={`${label}: at most`}
          placeholder="max"
          value={range.max ?? ''}
          onChange={(e) => onChange({ ...range, max: num(e.target.value) })}
          className={filterField}
        />
      </span>
    )
  }
  return (
    <input
      type="search"
      aria-label={`${label}: contains`}
      placeholder="contains…"
      value={filter?.kind === 'text' ? filter.contains : ''}
      onChange={(e) => onChange({ kind: 'text', contains: e.target.value })}
      className={filterField}
    />
  )
}
