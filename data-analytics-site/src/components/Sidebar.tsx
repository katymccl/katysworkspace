import type { ReactNode } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Layers,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import type { Dataset, View } from '../lib/datasets'
import { Wordmark } from './Wordmark'

interface SidebarProps {
  datasets: Dataset[]
  view: View
  datasetsOpen: boolean
  onToggleDatasets: () => void
  onSelect: (view: View) => void
  /** When set (the phone menu), shows a close button. */
  onClose?: () => void
  /** Display name for a dataset; defaults to its file name. */
  nameOf?: (dataset: Dataset) => string
  /** The workspace switcher, shown above everything else. */
  workspaceSwitcher?: ReactNode
}

export function Sidebar({
  datasets,
  view,
  datasetsOpen,
  onToggleDatasets,
  onSelect,
  onClose,
  nameOf = (d) => d.fileName,
  workspaceSwitcher,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between pr-3">
        <button
          onClick={() => onSelect({ kind: 'home' })}
          aria-label="sema home"
          className="px-5 py-5 text-left"
        >
          <Wordmark className="text-2xl" />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            autoFocus
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {workspaceSwitcher}

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="mb-1">
          <NavItem
            icon={<MessageSquare className="h-4 w-4" />}
            label="Ask your data"
            active={view.kind === 'ask'}
            disabled={datasets.length === 0}
            onClick={() => onSelect({ kind: 'ask' })}
          />
        </div>
        <button
          onClick={onToggleDatasets}
          aria-expanded={datasetsOpen}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <Database className="h-4 w-4 text-slate-500" />
          <span className="flex-1 text-left">Datasets</span>
          {datasets.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">
              {datasets.length}
            </span>
          )}
          {datasetsOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {datasetsOpen && (
          <ul className="mt-1 space-y-0.5 pl-4">
            <li>
              <NavItem
                icon={<Layers className="h-4 w-4" />}
                label="All datasets"
                active={view.kind === 'all'}
                disabled={datasets.length === 0}
                onClick={() => onSelect({ kind: 'all' })}
              />
            </li>
            {datasets.map((d) => (
              <li key={d.id}>
                <NavItem
                  icon={
                    d.generatedBy ? (
                      <Sparkles className="h-4 w-4" aria-label="AI-generated sample" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )
                  }
                  label={nameOf(d)}
                  active={view.kind === 'dataset' && view.id === d.id}
                  onClick={() => onSelect({ kind: 'dataset', id: d.id })}
                />
              </li>
            ))}
            <li>
              <NavItem
                icon={<Plus className="h-4 w-4" />}
                label="Upload datasets"
                active={view.kind === 'upload'}
                onClick={() => onSelect({ kind: 'upload' })}
              />
            </li>
          </ul>
        )}
      </nav>
    </aside>
  )
}

interface NavItemProps {
  icon: ReactNode
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, disabled, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-violet-50 font-medium text-violet-700'
          : 'text-slate-600 enabled:hover:bg-slate-100'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}
