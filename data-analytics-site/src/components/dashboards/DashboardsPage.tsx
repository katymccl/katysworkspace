import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, LayoutDashboard, Plus, X } from 'lucide-react'
import type { Dataset } from '../../lib/datasets'
import type { Dashboard, DashboardItem } from '../../lib/dashboards'
import { answerTitle, exploreColumns, runExplore, type ExploreRun } from '../../lib/explore/explore'
import { ResultChart } from '../ask/ResultChart'
import { ExploreAnswerBody } from '../explore/ExploreCharts'
import { linkButton, primaryButton, quietButton } from '../understanding/styles'

interface DashboardsPageProps {
  dashboards: Dashboard[]
  /** The dashboard to show; the first when not set or no longer there. */
  selectedId: string | undefined
  datasets: readonly Dataset[]
  nameOf: (d: Dataset) => string
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onRemoveItem: (dashboardId: string, itemId: string) => void
  onMoveItem: (dashboardId: string, itemId: string, by: -1 | 1) => void
}

/** The workspace's dashboards: saved charts from any of its datasets, side by side. */
export function DashboardsPage({
  dashboards,
  selectedId,
  datasets,
  nameOf,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onRemoveItem,
  onMoveItem,
}: DashboardsPageProps) {
  const [creating, setCreating] = useState(false)
  const dashboard = dashboards.find((d) => d.id === selectedId) ?? dashboards[0]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Dashboards">
        {dashboards.map((d) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={d.id === dashboard?.id}
            onClick={() => onSelect(d.id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              d.id === dashboard?.id
                ? 'border-violet-300 bg-violet-50 font-medium text-violet-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {d.name}
            <span className="ml-1.5 text-xs text-slate-400">{d.items.length}</span>
          </button>
        ))}
        {creating ? (
          <NameForm
            initial=""
            label="New dashboard name"
            submitLabel="Create"
            onSubmit={(name) => {
              onCreate(name)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button onClick={() => setCreating(true)} className={`${quietButton} inline-flex items-center gap-1`}>
            <Plus className="h-4 w-4" aria-hidden /> New dashboard
          </button>
        )}
      </div>

      {dashboard ? (
        <DashboardView
          key={dashboard.id}
          dashboard={dashboard}
          datasets={datasets}
          nameOf={nameOf}
          onRename={(name) => onRename(dashboard.id, name)}
          onDelete={() => onDelete(dashboard.id)}
          onRemoveItem={(itemId) => onRemoveItem(dashboard.id, itemId)}
          onMoveItem={(itemId, by) => onMoveItem(dashboard.id, itemId, by)}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-slate-500">
          <LayoutDashboard className="h-10 w-10 text-slate-400" />
          <p className="max-w-md">
            No dashboards yet. Use “Save to dashboard” under a chart in Explore your data or Ask with
            AI, or create an empty one above. A dashboard can hold charts from any of this
            workspace’s datasets.
          </p>
        </div>
      )}
    </div>
  )
}

function DashboardView({
  dashboard,
  datasets,
  nameOf,
  onRename,
  onDelete,
  onRemoveItem,
  onMoveItem,
}: {
  dashboard: Dashboard
  datasets: readonly Dataset[]
  nameOf: (d: Dataset) => string
  onRename: (name: string) => void
  onDelete: () => void
  onRemoveItem: (itemId: string) => void
  onMoveItem: (itemId: string, by: -1 | 1) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { items } = dashboard
  const sources = new Set(items.map((i) => (i.kind === 'explore' ? i.datasetId : 'ask')))

  return (
    <section className="space-y-4" role="tabpanel" aria-label={dashboard.name}>
      <div className="flex flex-wrap items-center gap-3">
        {renaming ? (
          <NameForm
            initial={dashboard.name}
            label="Dashboard name"
            submitLabel="Save"
            onSubmit={(name) => {
              onRename(name)
              setRenaming(false)
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <h2 className="text-lg font-semibold text-slate-900">{dashboard.name}</h2>
        )}
        <span className="text-xs text-slate-500">
          {items.length} chart{items.length === 1 ? '' : 's'}
          {items.length > 0 && ` from ${sources.size} source${sources.size === 1 ? '' : 's'}`}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {!renaming && (
            <button onClick={() => setRenaming(true)} className={linkButton}>
              Rename
            </button>
          )}
          {confirmDelete ? (
            <span className="flex items-center gap-2 text-xs text-slate-600" role="alertdialog" aria-label="Delete dashboard">
              Delete “{dashboard.name}” and its charts? Your data stays.
              <button onClick={onDelete} className="font-medium text-red-700 hover:underline">
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className={linkButton}>
                Cancel
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs font-medium text-red-700 hover:underline">
              Delete
            </button>
          )}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
          This dashboard is empty. Use “Save to dashboard” under a chart in Explore your data or Ask
          with AI to add one.
        </p>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {items.map((item, i) => (
            <ItemCard
              key={item.id}
              item={item}
              datasets={datasets}
              nameOf={nameOf}
              first={i === 0}
              last={i === items.length - 1}
              onRemove={() => onRemoveItem(item.id)}
              onMove={(by) => onMoveItem(item.id, by)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ItemCard({
  item,
  datasets,
  nameOf,
  first,
  last,
  onRemove,
  onMove,
}: {
  item: DashboardItem
  datasets: readonly Dataset[]
  nameOf: (d: Dataset) => string
  first: boolean
  last: boolean
  onRemove: () => void
  onMove: (by: -1 | 1) => void
}) {
  const dataset = item.kind === 'explore' ? datasets.find((d) => d.id === item.datasetId) : undefined
  // A live chart is worked out again from the data as it is now, and titled from that, so a renamed
  // column shows its new name.
  const config = item.kind === 'explore' ? item.config : null
  const run = useMemo(
    () =>
      dataset && config
        ? runExplore(dataset.rows, exploreColumns(dataset.rows, dataset.profile), config, {
            columns: dataset.columns,
          })
        : null,
    [dataset, config],
  )
  const title = run?.answer ? answerTitle(run.answer) : item.title
  const saved = new Date(item.addedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })
  const source =
    item.kind === 'explore'
      ? `${dataset ? nameOf(dataset) : item.datasetName} · Explore your data, kept up to date`
      : `Ask with AI · as answered on ${saved}`
  const icon = 'rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <li className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{source}</p>
        </div>
        <button onClick={() => onMove(-1)} disabled={first} aria-label={`Move “${title}” earlier`} className={icon}>
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
        <button onClick={() => onMove(1)} disabled={last} aria-label={`Move “${title}” later`} className={icon}>
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
        <button onClick={onRemove} aria-label={`Remove “${title}” from the dashboard`} className={icon}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {item.kind === 'snapshot' ? (
        <>
          <p className="text-sm text-slate-700">{item.summary}</p>
          <ResultChart chart={item.chart} />
        </>
      ) : run ? (
        <LiveChart run={run} />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          “{item.datasetName}” is no longer in this workspace, so this chart can’t be drawn.
        </p>
      )}
    </li>
  )
}

/** An Explore chart worked out again from the dataset as it is now. */
function LiveChart({ run }: { run: ExploreRun }) {
  if (!run.answer) {
    return <p className="text-sm text-slate-500">{run.missing}</p>
  }
  return (
    <div className="space-y-3 text-sm">
      <ExploreAnswerBody answer={run.answer} />
    </div>
  )
}

function NameForm({
  initial,
  label,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string
  label: string
  submitLabel: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) onSubmit(name.trim())
  }
  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onCancel()} className="flex items-center gap-2">
      <input
        aria-label={label}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
      />
      <button type="submit" className={primaryButton}>
        {submitLabel}
      </button>
      <button type="button" onClick={onCancel} className={quietButton}>
        Cancel
      </button>
    </form>
  )
}
