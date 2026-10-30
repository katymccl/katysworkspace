import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { CleanPanel } from './components/clean/CleanPanel'
import { Menu } from 'lucide-react'
import { AskPage } from './components/ask/AskPage'
import { CsvPreview } from './components/CsvPreview'
import { CsvUploader } from './components/CsvUploader'
import { SampleGenerator } from './components/generate/SampleGenerator'
import { Home } from './components/Home'
import { Notices, type Notice } from './components/Notices'
import { Sidebar } from './components/Sidebar'
import { WorkspaceSwitcher } from './components/WorkspaceSwitcher'
import { GlossaryPage } from './components/glossary/GlossaryPage'
import { ColumnDefinition } from './components/understanding/ColumnDefinition'
import { UnderstandingPanel } from './components/understanding/UnderstandingPanel'
import { Wordmark } from './components/Wordmark'
import { useAsk } from './hooks/useAsk'
import { useUnderstanding } from './hooks/useUnderstanding'
import { forgetUploads } from './lib/ask/full'
import { toDataset, type Dataset, type View } from './lib/datasets'
import {
  COLUMN_DRAG_TYPE,
  addColumnTerm,
  columnDragData,
  deleteGlossary,
  findTerm,
  loadGlossary,
  removeTerm,
  saveGlossary,
  updateTerm,
  type GlossaryTerm,
} from './lib/glossary'
import { deleteStoredDataset, fromStored, loadStoredDatasets, saveDataset } from './lib/persist/datasets'
import {
  DEFAULT_WORKSPACE_NAME,
  deleteWorkspace,
  loadWorkspaces,
  newWorkspace,
  saveCurrentWorkspaceId,
  saveWorkspace,
  type Workspace,
} from './lib/workspaces'
import { cleanedCsvData } from './lib/clean/version'
import { matchInWorkspace, recordUpload, type MatchReason } from './lib/identity'
import type { BaseSource } from './lib/generate/base'
import type { CsvData, CsvRow } from './lib/parseCsv'
import { withDismissedIdentifiers } from './lib/profiling'
import {
  EMPTY_CONFIRMED,
  acceptAllSuggestions,
  confirmColumn,
  confirmDatasetField,
  copySavedUnderstanding,
  loadDismissedIdentifiers,
  loadRegistry,
  revertColumn,
  revertDatasetField,
  saveDismissedIdentifiers,
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
  copy: ', as a separate dataset with the same contents as one you uploaded before',
  'new-version': ', as a new version of a dataset you uploaded before',
}

function notice(kind: Notice['kind'], message: string): Notice {
  return { id: crypto.randomUUID(), kind, message }
}

function App() {
  // The open workspace's glossary; its meanings fill in for AI suggestions on matching columns.
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([])
  const understanding = useUnderstanding(glossary)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId) ?? null
  const ask = useAsk(datasets, understanding.resolve, workspaceId, currentWorkspace?.fullData ?? false)
  const [view, setView] = useState<View>({ kind: 'home' })
  const [datasetsOpen, setDatasetsOpen] = useState(true)

  const [notices, setNotices] = useState<Notice[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  // The open workspace's id, once loaded. Uploads made while it loads wait for it, so they land in
  // the right workspace.
  const workspaceReady = useRef<Promise<string> | null>(null)
  /** The workspace whose datasets are being shown; a later switch wins over a slower earlier one. */
  const showing = useRef<string | null>(null)
  const { restore } = understanding

  /**
   * Opens a workspace and its saved datasets. With `keepUnsaved`, datasets added while it loaded
   * stay after the saved ones. Returns the datasets, or null if another workspace was opened since.
   */
  const showWorkspace = useCallback(
    async (id: string, keepUnsaved = false): Promise<Dataset[] | null> => {
      showing.current = id
      workspaceReady.current = Promise.resolve(id)
      saveCurrentWorkspaceId(id)
      setWorkspaceId(id)
      setGlossary(loadGlossary(id))
      const stored = await loadStoredDatasets(id)
      if (showing.current !== id) return null
      const restored = stored.map((s) => fromStored(s, loadDismissedIdentifiers(s.datasetId)))
      restore(restored)
      setDatasets((prev) =>
        keepUnsaved
          ? [...restored, ...prev.filter((d) => !restored.some((r) => r.id === d.id))]
          : restored,
      )
      return restored
    },
    [restore],
  )

  useEffect(() => {
    let live = true
    workspaceReady.current = loadWorkspaces().then(async (loaded) => {
      if (!live) return loaded.currentId
      setWorkspaces(loaded.workspaces)
      if (!loaded.persistent) {
        setNotices([
          notice(
            'error',
            "This browser isn't letting sema save data, so your datasets will be gone when you close the tab.",
          ),
        ])
      }
      await showWorkspace(loaded.currentId, true)
      return loaded.currentId
    })
    return () => {
      live = false
    }
  }, [showWorkspace])

  async function switchWorkspace(id: string) {
    if (id === workspaceId) return
    setNotices([])
    const shown = await showWorkspace(id)
    if (shown) setView(shown.length > 0 ? { kind: 'dataset', id: shown[0].id } : { kind: 'upload' })
  }

  async function createWorkspace(name: string) {
    const w = newWorkspace(name, crypto.randomUUID(), new Date().toISOString())
    await saveWorkspace(w)
    setWorkspaces((list) => [...list, w])
    await switchWorkspace(w.id)
    setNotices([notice('success', `Created the workspace "${w.name}".`)])
  }

  function updateWorkspace(id: string, change: Partial<Omit<Workspace, 'id'>>) {
    setWorkspaces((list) =>
      list.map((w) => {
        if (w.id !== id) return w
        const next = { ...w, ...change }
        void saveWorkspace(next)
        return next
      }),
    )
  }

  /** Deletes a workspace and its saved datasets, opening another (or a fresh one) if needed. */
  async function removeWorkspace(id: string) {
    const gone = workspaces.find((w) => w.id === id)
    const deleted = await deleteWorkspace(id)
    deleteGlossary(id)
    void forgetUploads(deleted.map((d) => d.datasetId))
    let rest = workspaces.filter((w) => w.id !== id)
    if (rest.length === 0) {
      const fresh = newWorkspace(DEFAULT_WORKSPACE_NAME, crypto.randomUUID(), new Date().toISOString())
      await saveWorkspace(fresh)
      rest = [fresh]
    }
    setWorkspaces(rest)
    if (id === workspaceId) await switchWorkspace(rest[0].id)
    setNotices([
      notice(
        'success',
        `Deleted the workspace "${gone?.name ?? ''}" and its ${deleted.length} dataset${deleted.length === 1 ? '' : 's'}.`,
      ),
    ])
  }

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

  function changeGlossary(next: GlossaryTerm[]) {
    if (!workspaceId) return
    setGlossary(next)
    saveGlossary(workspaceId, next)
  }

  /** Adds a column (dragged in, or from its "Add to glossary" button) as a glossary term. */
  function addColumnToGlossary({ datasetId, column }: { datasetId: string; column: string }) {
    const d = datasets.find((x) => x.datasetId === datasetId)
    if (!d) return
    const resolved = understanding.resolve(d).columns.find((c) => c.name === column)
    const { terms, term, added } = addColumnTerm(
      glossary,
      {
        datasetId,
        name: column,
        description: resolved?.description.value ?? null,
        role: resolved?.role.value ?? null,
      },
      crypto.randomUUID(),
      new Date().toISOString(),
    )
    if (added) changeGlossary(terms)
    setNotices([
      notice(
        'success',
        added
          ? `Added “${term.term}” to the glossary. Columns with that name in this workspace now use its meaning.`
          : `“${column}” is already in the glossary as “${term.term}”.`,
      ),
    ])
  }

  /** Adds a term written by hand on the Glossary page, unless its name is already a term. */
  function addTypedTerm(t: { term: string; description: string; role: GlossaryTerm['role'] }) {
    const existing = findTerm(glossary, t.term)
    if (existing) {
      setNotices([notice('error', `“${t.term}” is already in the glossary as “${existing.term}”.`)])
      return
    }
    const now = new Date().toISOString()
    changeGlossary([...glossary, { id: crypto.randomUUID(), ...t, aliases: [], from: null, updatedAt: now }])
  }

  async function handleUpload(loaded: CsvData[], errors: string[]) {
    const ws = await workspaceReady.current
    if (!ws) return
    let registry = loadRegistry()
    const now = new Date().toISOString()
    const added: Dataset[] = []
    const messages: Notice[] = []
    let firstShown: string | undefined

    for (const data of loaded) {
      const sameVersion = (d: Dataset, datasetId: string) =>
        d.datasetId === datasetId && d.fingerprints.content === data.fingerprints.content
      let identity = matchInWorkspace(registry, data, ws, () => crypto.randomUUID())
      // Already open under another name (a match remembered from before uploads were told apart
      // by file name): this file is a copy, not the same dataset again.
      const openElsewhere = [...datasets, ...added].some(
        (d) => sameVersion(d, identity.datasetId) && d.fileName !== data.fileName,
      )
      if (identity.matchedBy === 'same-content' && openElsewhere) {
        identity = {
          datasetId: crypto.randomUUID(),
          fingerprints: data.fingerprints,
          matchedBy: 'copy',
          copyOf: identity.datasetId,
        }
      }
      registry = recordUpload(registry, identity, data.fileName, now, ws)
      if (identity.copyOf) copySavedUnderstanding(identity.copyOf, identity.datasetId)

      // The exact same version is already open: show it instead of opening a second copy.
      const open = [...datasets, ...added].find((d) => sameVersion(d, identity.datasetId))
      if (open) {
        firstShown ??= open.id
        messages.push(notice('success', `${data.fileName} is already open`))
        continue
      }

      const dataset = toDataset(data, identity, loadDismissedIdentifiers(identity.datasetId))
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
    for (const d of added) void saveDataset(d, ws)

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
    const gone = datasets.find((d) => d.id === id)
    setDatasets(remaining)
    void deleteStoredDataset(id)
    if (gone) void forgetUploads([gone.datasetId])
    setView(remaining.length > 0 ? { kind: 'dataset', id: remaining[0].id } : { kind: 'upload' })
  }

  /**
   * Replaces an open dataset with its cleaned rows, as a new version of the same dataset: its
   * definitions and identifier choices carry over, and the registry remembers the new content.
   */
  async function handleCleaned(id: string, columns: string[], rows: CsvRow[], message: string) {
    const old = datasets.find((d) => d.id === id)
    const ws = await workspaceReady.current
    if (!old || !ws) return
    const data = await cleanedCsvData(old, columns, rows)
    const identity = {
      datasetId: old.datasetId,
      fingerprints: data.fingerprints,
      matchedBy: 'new-version' as const,
    }
    saveRegistry(
      recordUpload(loadRegistry(), identity, data.fileName, new Date().toISOString(), ws),
    )
    const cleaned = {
      ...toDataset(data, identity, loadDismissedIdentifiers(old.datasetId)),
      id: old.id,
      addedAt: old.addedAt,
    }
    understanding.restore([cleaned])
    void saveDataset(cleaned, ws)
    // The earlier version's upload is no longer needed.
    void forgetUploads([old.datasetId], data.fingerprints.content)
    setDatasets((prev) => prev.map((d) => (d.id === id ? cleaned : d)))
    setNotices([notice('success', message)])
  }

  /** Removes or restores a column's identifier flag, for every open version of the dataset. */
  function handleIdentifierDismissed(datasetId: string, columnName: string, dismissed: boolean) {
    const names = loadDismissedIdentifiers(datasetId).filter((n) => n !== columnName)
    if (dismissed) names.push(columnName)
    saveDismissedIdentifiers(datasetId, names)
    setDatasets((prev) =>
      prev.map((d) => {
        if (d.datasetId !== datasetId) return d
        const profile = withDismissedIdentifiers(d.profile, names)
        return profile === d.profile ? d : { ...d, profile }
      }),
    )
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
    workspaceSwitcher: (
      <WorkspaceSwitcher
        workspaces={workspaces}
        current={currentWorkspace}
        datasetCount={datasets.length}
        onSwitch={(id) => void switchWorkspace(id)}
        onCreate={(name) => void createWorkspace(name)}
        onRename={(id, name) => updateWorkspace(id, { name })}
        onDelete={(id) => void removeWorkspace(id)}
      />
    ),
    glossaryCount: glossary.length,
    onDropColumn: addColumnToGlossary,
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
                  subtitle={
                    currentWorkspace?.fullData
                      ? 'Ask a question in plain English. Claude works out the answer from every row of this workspace’s files.'
                      : 'Ask a question in plain English. Claude plans the answer; your browser works it out from every row.'
                  }
                />
                <AskPage
                  datasets={datasets}
                  nameOf={(d) => understanding.resolve(d).name.value ?? d.fileName}
                  ask={ask}
                  workspaceName={currentWorkspace?.name ?? 'this workspace'}
                  fullData={currentWorkspace?.fullData ?? false}
                  onFullDataChange={(on) => {
                    if (!currentWorkspace) return
                    updateWorkspace(currentWorkspace.id, { fullData: on })
                    // Turning it off removes the copies Claude could read.
                    if (!on) void forgetUploads(datasets.map((d) => d.datasetId))
                  }}
                />
              </>
            )}

            {view.kind === 'glossary' && (
              <>
                <PageHeader
                  title="Glossary"
                  subtitle={`Terms for ${currentWorkspace?.name ?? 'this workspace'}. Their meanings apply to matching columns in every dataset here, and Claude uses them too.`}
                />
                <GlossaryPage
                  terms={glossary}
                  columns={datasets.flatMap((d) => {
                    const r = understanding.resolve(d)
                    return r.columns.map((c) => ({
                      datasetName: r.name.value ?? d.fileName,
                      column: c.name,
                      overridden:
                        c.description.source === 'confirmed' || c.role.source === 'confirmed',
                    }))
                  })}
                  onAdd={addTypedTerm}
                  onUpdate={(id, change) =>
                    changeGlossary(updateTerm(glossary, id, change, new Date().toISOString()))
                  }
                  onRemove={(id) => changeGlossary(removeTerm(glossary, id))}
                  onDropColumn={addColumnToGlossary}
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
                onIdentifierDismissed={(name, dismissed) =>
                  handleIdentifierDismissed(selected.datasetId, name, dismissed)
                }
                onCleaned={(columns, rows, message) =>
                  handleCleaned(selected.id, columns, rows, message)
                }
                onAddToGlossary={(column) =>
                  addColumnToGlossary({ datasetId: selected.datasetId, column })
                }
                onOpenGlossary={() => setView({ kind: 'glossary' })}
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
  onIdentifierDismissed,
  onCleaned,
  onAddToGlossary,
  onOpenGlossary,
}: {
  dataset: Dataset
  understanding: ReturnType<typeof useUnderstanding>
  onRemove: () => void
  onGenerateRelated: () => void
  onIdentifierDismissed: (columnName: string, dismissed: boolean) => void
  onCleaned: (columns: string[], rows: CsvRow[], message: string) => Promise<void>
  onAddToGlossary: (column: string) => void
  onOpenGlossary: () => void
}) {
  const resolved = understanding.resolve(dataset)
  // Which open dataset "Prepare my data" is showing for; switching datasets closes it.
  const [cleaningId, setCleaningId] = useState<string | null>(null)
  const cleaning = cleaningId === dataset.id
  const update = (change: (c: ConfirmedDefinitions) => ConfirmedDefinitions) =>
    understanding.updateConfirmed(dataset.datasetId, change)

  return (
    <CsvPreview
      data={dataset}
      title={resolved.name.value ?? dataset.fileName}
      onRemove={onRemove}
      onGenerateRelated={onGenerateRelated}
      onIdentifierDismissed={onIdentifierDismissed}
      columnDrag={{
        type: COLUMN_DRAG_TYPE,
        data: (column) => columnDragData(dataset.datasetId, column.name),
      }}
      onClean={() => setCleaningId(dataset.id)}
      cleanPanel={
        cleaning && (
          <CleanPanel
            dataset={dataset}
            context={{
              name: resolved.name.value ?? dataset.fileName,
              description: resolved.description.value,
              rowMeaning: resolved.rowMeaning.value,
              columnDescriptions: new Map(
                resolved.columns.map((c) => [c.name, c.description.value]),
              ),
            }}
            onApply={async ({ columns, rows }, message) => {
              await onCleaned(columns, rows, message)
              setCleaningId(null)
            }}
            onClose={() => setCleaningId(null)}
          />
        )
      }
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
          onAddToGlossary={() => onAddToGlossary(column.name)}
          onOpenGlossary={onOpenGlossary}
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
