import { z } from 'zod'
import type { ResolvedChart } from './ask/chart'
import type { ExploreConfig } from './explore/explore'
import { STORAGE_PREFIX, readStored, writeStored } from './storage'

/**
 * A workspace's dashboards: named pages of saved charts, from any of the workspace's datasets.
 * Charts from "Explore your data" are saved as their question and worked out again from the
 * dataset each time, so they follow its latest rows; answers from "Ask with AI" are saved as
 * they were (a snapshot), since working them out again would mean asking Claude again. Pure,
 * apart from storage.
 */
export interface Dashboard {
  id: string
  name: string
  createdAt: string
  items: DashboardItem[]
}

interface ItemBase {
  id: string
  title: string
  addedAt: string
}

export interface ExploreItem extends ItemBase {
  kind: 'explore'
  /** The open dataset's id, which stays the same across reloads and cleaning. */
  datasetId: string
  /** The dataset's name when saved, shown if it's since been removed. */
  datasetName: string
  config: ExploreConfig
}

export interface SnapshotItem extends ItemBase {
  kind: 'snapshot'
  /** Claude's answer in a sentence or two. */
  summary: string
  chart: ResolvedChart
}

export type DashboardItem = ExploreItem | SnapshotItem

/** A chart about to be saved; the dashboard gives it an id and time. */
export type NewItem = Omit<ExploreItem, 'id' | 'addedAt'> | Omit<SnapshotItem, 'id' | 'addedAt'>

const name = z.string().nullable()
const ConfigSchema = z.object({
  question: z.enum(['over-time', 'compare', 'distribution', 'related']),
  time: name,
  step: z.enum(['day', 'month', 'quarter', 'year', 'month-name']).nullable(),
  group: name,
  calc: z.enum(['sum', 'average', 'median', 'min', 'max', 'count']),
  measure: name,
  second: name,
})
const chartBase = { x: z.string(), y: z.string(), notes: z.array(z.string()) }
const ChartSchema = z.union([
  z.object({
    ...chartBase,
    type: z.enum(['bar', 'line', 'pie']),
    points: z.array(z.object({ label: z.string(), value: z.number() })),
  }),
  z.object({
    ...chartBase,
    type: z.literal('heatmap'),
    by: z.string(),
    rows: z.array(z.string()),
    columns: z.array(z.string()),
    values: z.array(z.array(z.number().nullable())),
  }),
])
const itemBase = { id: z.string(), title: z.string(), addedAt: z.string() }
const DashboardsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    items: z.array(
      z.discriminatedUnion('kind', [
        z.object({
          ...itemBase,
          kind: z.literal('explore'),
          datasetId: z.string(),
          datasetName: z.string(),
          config: ConfigSchema,
        }),
        z.object({ ...itemBase, kind: z.literal('snapshot'), summary: z.string(), chart: ChartSchema }),
      ]),
    ),
  }),
)

export const DEFAULT_DASHBOARD_NAME = 'My dashboard'

export function newDashboard(dashboardName: string, id: string, now: string): Dashboard {
  return { id, name: dashboardName.trim() || DEFAULT_DASHBOARD_NAME, createdAt: now, items: [] }
}

const change = (list: readonly Dashboard[], id: string, fn: (d: Dashboard) => Dashboard) =>
  list.map((d) => (d.id === id ? fn(d) : d))

export function addItem(
  list: readonly Dashboard[],
  dashboardId: string,
  item: NewItem,
  id: string,
  now: string,
): Dashboard[] {
  return change(list, dashboardId, (d) => ({
    ...d,
    items: [...d.items, { ...item, id, addedAt: now } as DashboardItem],
  }))
}

export function removeItem(list: readonly Dashboard[], dashboardId: string, itemId: string): Dashboard[] {
  return change(list, dashboardId, (d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }))
}

/** Moves a chart one place earlier (-1) or later (+1); nothing happens at either end. */
export function moveItem(
  list: readonly Dashboard[],
  dashboardId: string,
  itemId: string,
  by: -1 | 1,
): Dashboard[] {
  return change(list, dashboardId, (d) => {
    const from = d.items.findIndex((i) => i.id === itemId)
    const to = from + by
    if (from === -1 || to < 0 || to >= d.items.length) return d
    const items = [...d.items]
    ;[items[from], items[to]] = [items[to], items[from]]
    return { ...d, items }
  })
}

export function renameDashboard(list: readonly Dashboard[], id: string, to: string): Dashboard[] {
  const trimmed = to.trim()
  return trimmed ? change(list, id, (d) => ({ ...d, name: trimmed })) : [...list]
}

export function removeDashboard(list: readonly Dashboard[], id: string): Dashboard[] {
  return list.filter((d) => d.id !== id)
}

const storageKey = (workspaceId: string) => `${STORAGE_PREFIX}:dashboards:${workspaceId}`

export function loadDashboards(workspaceId: string): Dashboard[] {
  return readStored(storageKey(workspaceId), DashboardsSchema) ?? []
}

export function saveDashboards(workspaceId: string, list: readonly Dashboard[]): void {
  writeStored(storageKey(workspaceId), list)
}

export function deleteDashboards(workspaceId: string): void {
  try {
    localStorage.removeItem(storageKey(workspaceId))
  } catch {
    // Storage unavailable: nothing was saved to remove.
  }
}
