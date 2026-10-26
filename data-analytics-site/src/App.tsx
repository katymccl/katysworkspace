import { useState } from 'react'
import { Layers } from 'lucide-react'
import { CsvPreview } from './components/CsvPreview'
import { CsvUploader } from './components/CsvUploader'
import { Home } from './components/Home'
import { Notices, type Notice } from './components/Notices'
import { Sidebar } from './components/Sidebar'
import { toDataset, type Dataset, type View } from './lib/datasets'
import type { CsvData } from './lib/parseCsv'

function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [view, setView] = useState<View>({ kind: 'home' })
  const [datasetsOpen, setDatasetsOpen] = useState(true)

  const [notices, setNotices] = useState<Notice[]>([])

  function handleUpload(loaded: CsvData[], errors: string[]) {
    const added = loaded.map(toDataset)
    // Each upload replaces the previous upload's messages.
    setNotices([
      ...added.map((d): Notice => ({
        id: crypto.randomUUID(),
        kind: 'success',
        message: `${d.fileName} loaded successfully`,
      })),
      ...errors.map((message): Notice => ({ id: crypto.randomUUID(), kind: 'error', message })),
    ])
    if (added.length === 0) return
    setDatasets((prev) => [...prev, ...added])
    setDatasetsOpen(true)
    setView({ kind: 'dataset', id: added[0].id })
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

  return (
    <div className="flex h-screen">
      <Sidebar
        datasets={datasets}
        view={view}
        datasetsOpen={datasetsOpen}
        onToggleDatasets={() => setDatasetsOpen((open) => !open)}
        onSelect={setView}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">
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
            </>
          )}

          {view.kind === 'all' && (
            <>
              <PageHeader
                title="All datasets"
                subtitle={`${datasets.length} dataset${datasets.length === 1 ? '' : 's'} loaded`}
              />
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-slate-500">
                <Layers className="h-10 w-10 text-slate-400" />
                <p>Working across all datasets is coming soon.</p>
              </div>
            </>
          )}

          {selected && <CsvPreview data={selected} onRemove={() => handleRemove(selected.id)} />}
        </div>
      </main>
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

export default App
