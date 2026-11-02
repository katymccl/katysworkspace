import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addItem,
  loadDashboards,
  moveItem,
  newDashboard,
  removeDashboard,
  removeItem,
  renameDashboard,
  saveDashboards,
  type NewItem,
} from './dashboards'
import { DEFAULT_CONFIG, exploreColumns, runExplore } from './explore/explore'
import { profileDataset } from './profiling'

const live: NewItem = {
  kind: 'explore',
  title: 'Total Books Read by Month',
  datasetId: 'ds-1',
  datasetName: 'Survey',
  config: { ...DEFAULT_CONFIG, measure: 'Books Read' },
}
const snapshot: NewItem = {
  kind: 'snapshot',
  title: 'Revenue by region?',
  summary: 'South brings in most.',
  chart: { type: 'bar', x: 'Region', y: 'Revenue', notes: [], points: [{ label: 'South', value: 3 }] },
}

const board = () => {
  let list = [newDashboard('  ', 'd1', 'now')]
  list = addItem(list, 'd1', live, 'i1', 't1')
  return addItem(list, 'd1', snapshot, 'i2', 't2')
}

describe('editing dashboards', () => {
  it('holds charts from different sources, in the order saved', () => {
    const [d] = board()
    expect(d.name).toBe('My dashboard')
    expect(d.items.map((i) => [i.id, i.kind, i.addedAt])).toEqual([
      ['i1', 'explore', 't1'],
      ['i2', 'snapshot', 't2'],
    ])
  })

  it('moves, removes and renames, leaving others alone', () => {
    expect(moveItem(board(), 'd1', 'i2', -1)[0].items.map((i) => i.id)).toEqual(['i2', 'i1'])
    expect(moveItem(board(), 'd1', 'i2', 1)[0].items.map((i) => i.id)).toEqual(['i1', 'i2'])
    expect(removeItem(board(), 'd1', 'i1')[0].items.map((i) => i.id)).toEqual(['i2'])
    expect(renameDashboard(board(), 'd1', ' Sales ')[0].name).toBe('Sales')
    expect(renameDashboard(board(), 'd1', ' ')[0].name).toBe('My dashboard')
    expect(removeDashboard(board(), 'd1')).toEqual([])
  })
})

describe('saving dashboards', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads back what it saved, per workspace', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    })
    saveDashboards('ws', board())
    expect(loadDashboards('ws')).toEqual(board())
    expect(loadDashboards('other')).toEqual([])
  })
})

describe('saved Explore charts', () => {
  const rows = [
    { Month: '2024-01', Region: 'North', 'Books Read': '4' },
    { Month: '2024-02', Region: 'South', 'Books Read': '6' },
    { Month: '2024-02', Region: 'South', 'Books Read': '1' },
  ]
  const columns = exploreColumns(rows, profileDataset({ columns: Object.keys(rows[0]), rows }))

  it('are worked out again from the data as it is now', () => {
    const run = runExplore(rows, columns, { ...DEFAULT_CONFIG, measure: 'Books Read' })
    expect(run.answer).toMatchObject({ kind: 'line', points: [{ value: 4 }, { value: 7 }] })
    expect(run.effective).toMatchObject({ time: 'Month', step: 'month', measure: 'Books Read' })
  })

  it('fall back to columns that fit when a saved one is gone', () => {
    const run = runExplore(rows, columns, { ...DEFAULT_CONFIG, question: 'compare', group: 'Gone' })
    expect(run.effective.group).toBe('Month')
    expect(run.answer).not.toBeNull()
  })

  it('on a dashboard, say a column is gone rather than quietly using another', () => {
    const saved = { ...DEFAULT_CONFIG, question: 'compare' as const, group: 'Region', measure: 'Books Read' }
    const without = rows.map((r) => ({ Month: r.Month, 'Books Read': r['Books Read'] }))
    const cols = exploreColumns(without, profileDataset({ columns: ['Month', 'Books Read'], rows: without }))
    expect(runExplore(without, cols, saved).answer).not.toBeNull()
    expect(runExplore(without, cols, saved, { columns: ['Month', 'Books Read'] })).toMatchObject({
      answer: null,
      missing: 'The column “Region” is no longer in this dataset, so this chart can’t be drawn.',
    })
    // Still there but no longer a number: it doesn't suit the chart any more.
    const text = rows.map((r) => ({ ...r, 'Books Read': 'many' }))
    const textCols = exploreColumns(text, profileDataset({ columns: Object.keys(text[0]), rows: text }))
    expect(
      runExplore(text, textCols, saved, { columns: Object.keys(text[0]) }).missing,
    ).toBe('The column “Books Read” no longer suits this chart, so it can’t be drawn.')
    expect(runExplore(rows, columns, saved, { columns: Object.keys(rows[0]) }).answer).not.toBeNull()
  })

  it('say why when the dataset can no longer answer', () => {
    const run = runExplore(rows, columns, { ...DEFAULT_CONFIG, question: 'related' })
    expect(run.answer).toBeNull()
    expect(run.missing).toBe('This needs a dataset with at least two number columns.')
  })
})
