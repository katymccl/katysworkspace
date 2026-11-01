import { createContext } from 'react'
import type { NewItem } from '../../lib/dashboards'

export interface DashboardSaver {
  dashboards: readonly { id: string; name: string }[]
  /** Saves to an existing dashboard, or to a new one with this name; returns that dashboard. */
  save: (item: NewItem, to: { id: string } | { newName: string }) => { id: string; name: string }
  /** Opens a dashboard. */
  open: (id: string) => void
}

/** Provided by the app, so any chart can offer to be saved without passing props down. */
export const DashboardSaveContext = createContext<DashboardSaver | null>(null)
