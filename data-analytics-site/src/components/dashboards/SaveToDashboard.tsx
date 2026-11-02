import { useContext, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Check, LayoutDashboard, Plus } from 'lucide-react'
import type { NewItem } from '../../lib/dashboards'
import { DashboardSaveContext } from './context'
import { quietButton } from '../understanding/styles'

/**
 * "Save to dashboard": a menu of the workspace's dashboards and a way to start a new one. `item`
 * is called when a dashboard is picked, so the saved chart is the one showing at that moment.
 */
export function SaveToDashboard({ item }: { item: () => NewItem }) {
  const saver = useContext(DashboardSaveContext)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null)
  const [newName, setNewName] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!saver) return null

  const save = (to: { id: string } | { newName: string }) => {
    setSaved(saver.save(item(), to))
    setOpen(false)
    setNewName('')
  }
  const create = (e: FormEvent) => {
    e.preventDefault()
    save({ newName })
  }

  return (
    <div ref={box} className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={menuId}
        className={`${quietButton} inline-flex items-center gap-1.5 text-xs`}
      >
        <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
        Save to dashboard
      </button>
      {saved && !open && (
        <span className="flex items-center gap-1 text-xs text-emerald-700" role="status">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Saved to{' '}
          <button type="button" onClick={() => saver.open(saved.id)} className="font-medium underline">
            {saved.name}
          </button>
        </span>
      )}
      {open && (
        <div
          id={menuId}
          className="absolute right-0 bottom-full z-20 mb-1 w-64 space-y-1 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg"
        >
          {saver.dashboards.length > 0 && (
            <ul className="max-h-48 overflow-y-auto">
              {saver.dashboards.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => save({ id: d.id })}
                    className="w-full truncate rounded-md px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                  >
                    {d.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={create} className="flex gap-1 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
            <label className="sr-only" htmlFor={`${menuId}-name`}>
              New dashboard name
            </label>
            <input
              id={`${menuId}-name`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New dashboard"
              autoFocus={saver.dashboards.length === 0}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Create dashboard and save"
              className="rounded-md bg-violet-600 px-2 text-white hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
