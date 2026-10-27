import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import { AskPage } from './components/ask/AskPage'
import { CsvPreview } from './components/CsvPreview'
import { CsvUploader } from './components/CsvUploader'
import { SampleGenerator } from './components/generate/SampleGenerator'
import { Home } from './components/Home'
import { Notices, type Notice } from './components/Notices'
import { Sidebar } from './components/Sidebar'
import { ColumnDefinition } from './components/understanding/ColumnDefinition'
import { UnderstandingPanel } from './components/understanding/UnderstandingPanel'
import { Wordmark } from './components/Wordmark'
import { useAsk } from './hooks/useAsk'
import { useUnderstanding } from './hooks/useUnderstanding'
import { toDataset, type Dataset, type View } from './lib/datasets'
import { matchDataset, recordUpload, type MatchReason } from './lib/identity'
import type { BaseSource } from './lib/generate/base'
import type { CsvData } from './lib/parseCsv'
import {
  EMPTY_CONFIRMED,
  acceptAllSuggestions,
  confirmColumn,
  confirmDatasetField,
  loadRegistry,
  revertColumn,
  revertDatasetField,
  saveRegistry,
  type ConfirmedDefinitions,
  type ResolvedUnderstanding,
} from './lib/understanding'

// The diagram library is large, so the relationships page loads only when it's opened.
const RelationshipsPage = lazy(() =>
  import('./components/relationships/RelationshipsPage').then((m) => ({
    default: m.RelationshipsPage,
  })),
)

const MATCH_NOTE: Record<MatchReason, string> = {
  'new-dataset': '',
  'same-content': ', recognised from an earlier upload',
  'new-version': ', as a new version of a dataset you uploaded before',
}

function notice(kind: Notice['kind'], message: string): Notice {
  return { id: crypto.randomUUID(), kind, message }
}

function App() {
  const understanding = useUnderstanding()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const ask = useAsk(datasets, understanding.resolve)
  const [view, setView] = useState<View>({ kind: 'home' })
  const [datasetsOpen, setDatasetsOpen] = useState(true)

  const [notices, setNotices] = useState<Notice[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  function closeMenu() {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function handleUpload(loaded: CsvData[], errors: string[]) {
    let registry = loadRegistry()
    const now = new Date().toISOString()
    const added: Dataset[] = []
    const messages: Notice[] = []
    let firstShown: string | undefined

    for (const data of loaded) {
      const identity = matchDataset(registry, data, () => crypto.randomUUID())
      registry = recordUpload(registry, identity, data.fileName, now)

      // The exact same version is already open: show it instead of opening a second copy.
      const open = [...datasets, ...added].find(
        (d) =>
          d.datasetId === identity.datasetId &&
          d.fingerprints.content === data.fingerprints.content,
      )
      if (open) {
        firstShown ??= open.id
        messages.push(notice('success', `${data.fileName} is already open`))
        continue
      }

      const dataset = toDataset(data, identity)
      added.push(dataset)
      firstShown ??= dataset.id
      messages.push(
        notice(
          'success',
          data.generatedBy
            ? `${data.fileName} generated as a fictional sample`
            : `${data.fileName} loaded successfully${MATCH_NOTE[identity.matchedBy]}`,
        ),
      )
    }
    saveRegistry(registry)
    understanding.restore(added)

    // Each upload replaces the previous upload's messages.
    setNotices([...messages, ...errors.map((message) => notice('error', message))])
    if (added.length > 0) {
      setDatasets((prev) => [...prev, ...added])
      setDatasetsOpen(true)
    }
    if (firstShown) setView({ kind: 'dataset', id: firstShown })
  }

  function handleRemove(id: string) {
    const remaining = datasets.filter((d) => d.id !== id)
    setDatasets(remaining)
    setView(remaining.length > 0 ? { kind: 'dataset', id: remaining[0].id } : { kind: 'upload' })
  }

  const selected = view.kind === 'dataset' ? datasets.find((d) => d.id === view.id) : undefined

  if (view.kind === 'home') {
    return (
      <Home
        datasetCount={datasets.length}
        onUpload={() => setView({ kind: 'upload' })}
        onViewDatasets={() => setView({ kind: 'dataset', id: datasets[0].id })}
      />
    )
  }

  const sidebarProps = {
    datasets,
    view,
    datasetsOpen,
    onToggleDatasets: () => setDatasetsOpen((open) => !open),
    nameOf: (d: Dataset) => understanding.resolve(d).name.value ?? d.fileName,
  }

  return (
    <div className="flex h-screen">
      <div className="hidden md:flex">
        <Sidebar {...sidebarProps} onSelect={setView} />
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="absolute inset-0 bg-slate-900/30" onClick={closeMenu} aria-hidden />
          <div className="relative h-full w-64 max-w-[85vw] shadow-xl">
            <Sidebar
              {...sidebarProps}
              onSelect={(next) => {
                setView(next)
                closeMenu()
              }}
              onClose={closeMenu}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setView({ kind: 'home' })} aria-label="sema home">
            <Wordmark className="text-2xl" />
          </button>
          <button
            ref={menuButtonRef}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
            <Notices
              notices={notices}
              onDismiss={(id) => setNotices((prev) => prev.filter((n) => n.id !== id))}
            />
            {view.kind === 'upload' && (
              <>
                <PageHeader
                  title="Upload datasets"
                  subtitle="Add one or more CSV files. Each file becomes its own dataset."
                />
                <CsvUploader onUpload={handleUpload} />
                <div className="mt-6">
                  <SampleGenerator
                    key={view.baseId ?? 'none'}
                    bases={datasets.map((d) => ({
                      id: d.id,
                      name: understanding.resolve(d).name.value ?? d.fileName,
                    }))}
                    getBase={(id) => {
                      const d = datasets.find((x) => x.id === id)
                      return d
                        ? {
                            source: baseSource(d, understanding.resolve(d)),
                            datasetId: d.datasetId,
                          }
                        : null
                    }}
                    initialBaseId={view.baseId}
                    onGenerated={(data) => handleUpload([data], [])}
                  />
                </div>
              </>
            )}

            {view.kind === 'ask' && (
              <>
                <PageHeader
                  title="Ask your data"
                  subtitle="Ask a question in plain English. Claude plans the answer; your browser works it out from every row."
                />
                <AskPage
                  datasets={datasets}
                  nameOf={(d) => understanding.resolve(d).name.value ?? d.fileName}
                  ask={ask}
                />
              </>
            )}

            {view.kind === 'all' && (
              <>
                <PageHeader
                  title="All datasets"
                  subtitle={`${datasets.length} dataset${datasets.length === 1 ? '' : 's'} loaded`}
                />
                <Suspense
                  fallback={<p className="text-sm text-slate-500">Loading relationships…</p>}
                >
                  <RelationshipsPage datasets={datasets} resolve={understanding.resolve} />
                </Suspense>
              </>
            )}

            {selected && (
              <DatasetPage
                dataset={selected}
                understanding={understanding}
                onRemove={() => handleRemove(selected.id)}
                onGenerateRelated={() => setView({ kind: 'upload', baseId: selected.id })}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-6">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-slate-500">{subtitle}</p>
    </header>
  )
}

/** One dataset: its profile, plus the AI-suggested or confirmed understanding of it. */
function DatasetPage({
  dataset,
  understanding,
  onRemove,
  onGenerateRelated,
}: {
  dataset: Dataset
  understanding: ReturnType<typeof useUnderstanding>
  onRemove: () => void
  onGenerateRelated: () => void
}) {
  const resolved = understanding.resolve(dataset)
  const update = (change: (c: ConfirmedDefinitions) => ConfirmedDefinitions) =>
    understanding.updateConfirmed(dataset.datasetId, change)

  return (
    <CsvPreview
      data={dataset}
      title={resolved.name.value ?? dataset.fileName}
      onRemove={onRemove}
      onGenerateRelated={onGenerateRelated}
      about={
        <UnderstandingPanel
          resolved={resolved}
          state={understanding.stateFor(dataset)}
          onInterpret={() => understanding.interpret(dataset)}
          onSaveField={(field, value) => update((c) => confirmDatasetField(c, field, value))}
          onRevertField={(field) => update((c) => revertDatasetField(c, field))}
          onAcceptAll={() => update((c) => acceptAllSuggestions(c, resolved))}
          onResetAll={() => update(() => EMPTY_CONFIRMED)}
        />
      }
      renderDefinition={(column) => (
        <ColumnDefinition
          column={resolved.columns[column.index]}
          onSave={(change) => update((c) => confirmColumn(c, column.name, change))}
          onRevert={() => update((c) => revertColumn(c, column.name))}
        />
      )}
    />
  )
}

/** A dataset as the base for generating a related one: its data plus what it means. */
function baseSource(d: Dataset, resolved: ResolvedUnderstanding): BaseSource {
  return {
    name: resolved.name.value ?? d.fileName,
    fileName: d.fileName,
    description: resolved.description.value,
    rowMeaning: resolved.rowMeaning.value,
    columns: d.columns,
    rows: d.rows,
    profile: d.profile,
    columnDefinitions: new Map(
      resolved.columns.map((c) => [
        c.name,
        { description: c.description.value, role: c.role.value },
      ]),
    ),
  }
}

export default App
