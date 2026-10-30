import { useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, RotateCw, Share2, Sparkles, Spline } from 'lucide-react'
import { useRelationships } from '../../hooks/useRelationships'
import type { Dataset } from '../../lib/datasets'
import { isConfirmed, relationshipId } from '../../lib/relationships/confirmed'
import { asConfirmation, isShown } from '../../lib/relationships/merge'
import { refId } from '../../lib/relationships/detect'
import type { ResolvedUnderstanding } from '../../lib/understanding'
import { quietButton } from '../understanding/styles'
import { pickColumns, type NodeModel } from './layout'
import { CONFIDENCE_LABELS } from './linkStyle'
import { RelationshipDiagram } from './RelationshipDiagram'
import { RelationshipList } from './RelationshipList'

interface RelationshipsPageProps {
  datasets: readonly Dataset[]
  resolve: (d: Dataset) => ResolvedUnderstanding
}

const ERROR_HINTS: Partial<Record<string, string>> = {
  not_configured: 'Add ANTHROPIC_API_KEY to the server settings to turn it on (see .env.example).',
  rate_limited: 'Wait a minute, then try again.',
}

/** "All datasets": how the open datasets connect, as a diagram and a list. */
export function RelationshipsPage({ datasets, resolve }: RelationshipsPageProps) {
  const { workspace, view, state, analyse, toggleConfirmed, toggleRejected, confirm, layoutKey } =
    useRelationships(datasets, resolve)
  const toggleById = (id: string) => {
    const item = [...view.links, ...view.similar].find((x) => x.id === id)
    // A "not related" link is only restored with Undo, never by a stray double-click.
    if (item && !item.rejected) toggleConfirmed(asConfirmation(item))
  }
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showUnlikely, setShowUnlikely] = useState(false)
  const [drawing, setDrawing] = useState(false)
  /** The link drawn last, to say what was added. */
  const [drawn, setDrawn] = useState<string | null>(null)

  const names = useMemo(
    () => new Map(workspace.map((d) => [d.datasetId, resolve(d).name.value ?? d.fileName])),
    [workspace, resolve],
  )
  const nameOf = (key: string) => names.get(key) ?? key

  const links = view.links.filter((l) => showUnlikely || isShown(l))
  const similar = view.similar.filter((s) => showUnlikely || isShown(s))
  const hiddenCount = view.links.length + view.similar.length - links.length - similar.length

  const nodes: NodeModel[] = useMemo(() => {
    const linked = new Set(links.flatMap((l) => [refId(l.from), refId(l.to)]))
    return workspace.map((d) => {
      const { columns, hiddenCount } = pickColumns(
        d.profile.columns.map((c) => ({
          name: c.name,
          type: c.inferredType,
          isIdentifier: c.isPotentialIdentifier,
        })),
        new Set(d.columns.filter((c) => linked.has(`${d.datasetId}:${c}`))),
        drawing,
      )
      return {
        id: d.datasetId,
        title: names.get(d.datasetId) ?? d.fileName,
        fileName: d.fileName,
        rowCount: d.rows.length,
        columns,
        hiddenCount,
      }
    })
  }, [workspace, links, names, drawing])

  if (workspace.length < 2) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-slate-500">
        <Share2 className="h-10 w-10 text-slate-400" />
        <p>Upload at least two datasets to see how they connect.</p>
      </div>
    )
  }

  const loading = state.status === 'loading'
  const hasAnalysis = state.result !== null

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-slate-900">How these datasets connect</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {hasAnalysis
                ? 'Claude picked these links from what the columns mean and how their values overlap, measured in your browser.'
                : 'Claude looks at what the columns mean and how their values overlap, measured in your browser, and picks the links.'}{' '}
              Confirm the ones you agree with, mark others not related, or draw your own.
            </p>
          </div>
          <button
            onClick={analyse}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : hasAnalysis ? (
              <RotateCw className="h-4 w-4" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {loading
              ? 'Finding links…'
              : hasAnalysis
                ? 'Ask Claude again'
                : 'Find relationships with Claude'}
          </button>
          <p className="w-full text-xs text-slate-400">
            Finding links sends dataset names, descriptions, column details, how much columns'
            values overlap and a few shared values to Claude. The files themselves stay in your
            browser.
          </p>
        </div>

        {state.status === 'error' && state.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex-1">
              <p>
                {state.error.message} {ERROR_HINTS[state.error.code] ?? ''}
              </p>
              <p className="mt-0.5 text-xs text-red-600">
                Links you confirmed or drew are still shown below.
              </p>
            </div>
            {state.error.code !== 'not_configured' && (
              <button onClick={analyse} className={`${quietButton} -my-1 text-red-700`}>
                Try again
              </button>
            )}
          </div>
        )}

        {view.summary && (
          <p className="flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-slate-800">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-label="AI summary" />
            {view.summary}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600" aria-live="polite">
          {drawn ??
            (drawing
              ? 'Drag from the dot beside a column to the matching column in another dataset.'
              : 'Missing a link, or is one wrong? Draw your own, or mark one not related below.')}
        </p>
        <button
          onClick={() => {
            setDrawing((d) => !d)
            setDrawn(null)
          }}
          aria-pressed={drawing}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            drawing
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'border border-violet-200 text-violet-700 hover:bg-violet-50'
          }`}
        >
          {drawing ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Spline className="h-4 w-4" aria-hidden />
          )}
          {drawing ? 'Done' : 'Draw a link'}
        </button>
      </div>
      <RelationshipDiagram
        key={layoutKey}
        drawing={drawing}
        onDrawLink={(link) => {
          const r = { kind: 'link' as const, ...link }
          const existing = view.links.find((l) =>
            isConfirmed([{ kind: 'link', from: l.from, to: l.to }], r),
          )
          confirm(r)
          setSelectedId(existing?.id ?? relationshipId(r))
          setDrawn(
            `Linked ${nameOf(link.from.dataset)} ${link.from.column} to ${nameOf(link.to.dataset)} ${link.to.column}. Double-click the line to remove it.`,
          )
        }}
        layoutKey={layoutKey}
        nodes={nodes}
        links={links}
        similar={similar}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onToggleConfirmed={toggleById}
      />
      <p className="text-xs text-slate-500">
        {Object.values(CONFIDENCE_LABELS).join(' · ')} · Arrows point to the side where each value
        appears once: one head for many → one, a head at both ends for one ↔ one, and none for many
        ↔ many. Drag the boxes to rearrange them. Click a line or list item to highlight it;
        double-click it to confirm it, or to remove a link you confirmed or drew.
      </p>

      {links.length === 0 && similar.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          {hasAnalysis
            ? 'Claude didn’t find any links between these datasets.'
            : 'No links yet. Ask Claude to find them with “Find relationships with Claude”.'}{' '}
          You can also connect two columns yourself with “Draw a link”.
        </p>
      ) : (
        <section>
          <h3 className="mb-3 font-medium text-slate-900">Relationships</h3>
          <RelationshipList
            links={links}
            similar={similar}
            nameOf={nameOf}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggleConfirmed={(item) => toggleConfirmed(asConfirmation(item))}
            onToggleRejected={(item) => toggleRejected(asConfirmation(item))}
          />
        </section>
      )}
      {(hiddenCount > 0 || showUnlikely) && (
        <button onClick={() => setShowUnlikely((v) => !v)} className={quietButton}>
          {showUnlikely
            ? 'Hide links marked not related or judged unlikely'
            : `Show ${hiddenCount} hidden link${hiddenCount === 1 ? '' : 's'} (marked not related or judged unlikely)`}
        </button>
      )}

      {view.questions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-sm font-medium text-amber-900">Questions Claude couldn’t settle</h4>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-900">
            {view.questions.map((q, i) => (
              <li key={i}>
                {q.question}
                {q.datasets.length > 0 && (
                  <span className="ml-1 text-xs text-amber-800">
                    ({q.datasets.map(nameOf).join(', ')})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
