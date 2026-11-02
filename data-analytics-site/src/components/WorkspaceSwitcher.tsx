import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, ChevronDown, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Workspace } from '../lib/workspaces'

interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
  current: Workspace | null
  /** Datasets in the current workspace, for the delete warning. */
  datasetCount: number
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

type Mode = 'menu' | 'create' | 'rename' | 'delete'

/**
 * The open workspace, with a menu to switch to another, start a new one, or rename or delete this
 * one. Claude only ever works with the open workspace's datasets.
 */
export function WorkspaceSwitcher({
  workspaces,
  current,
  datasetCount,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('menu')
  const [name, setName] = useState('')
  const wrapper = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  const close = () => {
    setOpen(false)
    setMode('menu')
    toggle.current?.focus()
  }

  // Escape or a click elsewhere closes the menu.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) {
        setOpen(false)
        setMode('menu')
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'create') onCreate(name)
    else if (mode === 'rename' && current) onRename(current.id, name.trim() || current.name)
    close()
  }

  const item =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'

  return (
    <div ref={wrapper} className="relative px-3 pb-3">
      <p className="px-2 pb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
        Workspace
      </p>
      <button
        ref={toggle}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{current?.name ?? 'Loading…'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div className="absolute inset-x-3 top-full z-20 mt-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          {mode === 'menu' && (
            <>
              <ul aria-label="Workspaces" className="max-h-60 overflow-y-auto">
                {workspaces.map((w) => (
                  <li key={w.id}>
                    <button
                      onClick={() => {
                        onSwitch(w.id)
                        close()
                      }}
                      aria-current={w.id === current?.id ? 'true' : undefined}
                      className={`${item} ${w.id === current?.id ? 'font-medium text-violet-700' : ''}`}
                    >
                      <span className="w-4 shrink-0">
                        {w.id === current?.id && <Check className="h-4 w-4" aria-hidden />}
                      </span>
                      <span className="truncate">{w.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="my-1 border-t border-slate-100" />
              <button
                className={item}
                onClick={() => {
                  setName('')
                  setMode('create')
                }}
              >
                <Plus className="h-4 w-4 text-slate-500" aria-hidden /> New workspace
              </button>
              {current && (
                <>
                  <button
                    className={item}
                    onClick={() => {
                      setName(current.name)
                      setMode('rename')
                    }}
                  >
                    <Pencil className="h-4 w-4 text-slate-500" aria-hidden /> Rename “{current.name}”
                  </button>
                  <button
                    className={`${item} text-red-700 hover:bg-red-50`}
                    onClick={() => setMode('delete')}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete “{current.name}”
                  </button>
                </>
              )}
            </>
          )}

          {(mode === 'create' || mode === 'rename') && (
            <form onSubmit={submit} className="space-y-2 p-1">
              <label className="block text-xs font-medium text-slate-600">
                {mode === 'create' ? 'Name the new workspace' : 'Rename the workspace'}
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Library staffing"
                  maxLength={80}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                />
              </label>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setMode('menu')}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700"
                >
                  {mode === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {mode === 'delete' && current && (
            <div className="space-y-2 p-1 text-sm" role="alertdialog" aria-label="Delete workspace">
              <p className="text-slate-700">
                Delete “{current.name}” and its {datasetCount} dataset
                {datasetCount === 1 ? '' : 's'}? Their saved copies in this browser go too. This
                can’t be undone.
              </p>
              <div className="flex justify-end gap-1">
                <button
                  autoFocus
                  onClick={() => setMode('menu')}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete(current.id)
                    close()
                  }}
                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
