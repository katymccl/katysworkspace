'use client'

import { useState, useMemo } from 'react'
import { UserButton, useUser } from '@clerk/nextjs'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { usePetal } from '@/hooks/usePetal'
import { Bucket, Task, Priority } from '@/types'
import TaskCard from './TaskCard'
import DroppableBucket from './DroppableBucket'
import AddTaskRow from './AddTaskRow'
import ProjectsTab from './ProjectsTab'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const now = new Date()
const TODAY = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`

// Get Mon–Sun of current week
function getWeekRange() {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (x: Date) => `${MONTHS[x.getMonth()].slice(0,3)} ${x.getDate()}`
  return `${fmt(mon)} – ${fmt(sun)}`
}
const WEEK_RANGE = getWeekRange()

type Tab = 'daily' | 'thisWeek' | 'planning' | 'projects'

function SectionHeader({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <div className="section-header">
      <span className="section-title">{title}{count !== undefined ? ` (${count})` : ''}</span>
      {hint && <span className="section-hint">{hint}</span>}
      <style jsx>{`
        .section-header { margin: 18px 0 8px; }
        .section-title { font-size: 13px; font-weight: 700; color: #c2185b; text-transform: uppercase; letter-spacing: 0.5px; }
        .section-hint { display: block; font-size: 12px; color: #ad1457; opacity: 0.7; font-style: italic; margin-top: 2px; }
      `}</style>
    </div>
  )
}

export default function PetalApp() {
  const {
    state, loading, saving,
    dailyTasks, thisWeekTasks, backlogTasks, thisMonthTasks, futureTasks,
    addTask, removeTask, toggleTask, editTask, setPriority, moveTask, reorderTasks,
    addCategory, removeCategory,
    addProject, removeProject, editProject,
    addStep, removeStep, toggleStep, editStep,
  } = usePetal()

  const { user } = useUser()
  const [tab, setTab] = useState<Tab>('daily')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [catManagerOpen, setCatManagerOpen] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  )

  // ── Search results ─────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return state.tasks.filter(t =>
      t.text.toLowerCase().includes(q) ||
      (t.category && t.category.toLowerCase().includes(q))
    )
  }, [searchQuery, state.tasks])

  const isSearching = searchQuery.trim().length > 0

  // ── Planning filters ────────────────────────────────────────
  const allPlanningTasks = [...backlogTasks, ...thisMonthTasks, ...futureTasks]

  function applyFilters(tasks: Task[]) {
    let result = tasks
    if (activeFilter !== 'all') {
      result = activeFilter === 'uncategorized'
        ? result.filter(t => !t.category)
        : result.filter(t => t.category === activeFilter)
    }
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter)
    }
    return result
  }

  const filteredBacklog = applyFilters(backlogTasks)
  const filteredThisMonth = applyFilters(thisMonthTasks)
  const filteredFuture = applyFilters(futureTasks)
  const filteredThisWeek = applyFilters(thisWeekTasks)

  function getBucket(id: string): Bucket | null {
    const task = state.tasks.find(t => t.id === id)
    return task?.bucket ?? null
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveTask(state.tasks.find(t => t.id === active.id) ?? null)
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const fromBucket = getBucket(active.id as string)
    const overTask = state.tasks.find(t => t.id === over.id)
    const toBucket = overTask ? overTask.bucket : (over.id as Bucket)
    if (fromBucket && toBucket && fromBucket !== toBucket) {
      moveTask(active.id as string, toBucket)
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null)
    if (!over) return
    const fromBucket = getBucket(active.id as string)
    const overTask = state.tasks.find(t => t.id === over.id)
    const toBucket = overTask ? overTask.bucket : (over.id as Bucket)

    if (fromBucket !== toBucket) {
      moveTask(active.id as string, toBucket as Bucket)
      return
    }

    const bucketTasks = state.tasks.filter(t => t.bucket === fromBucket)
    const oldIdx = bucketTasks.findIndex(t => t.id === active.id)
    const newIdx = bucketTasks.findIndex(t => t.id === over.id)
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      const reordered = arrayMove(bucketTasks, oldIdx, newIdx)
      reorderTasks(reordered.map(t => t.id))
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 32, animation: 'pulse 1s infinite' }}>🌸</div>
      </div>
    )
  }

  const BUCKET_LABEL: Record<Bucket, string> = {
    daily: 'today',
    thisWeek: 'this week',
    thisMonth: 'this month',
    future: 'future',
    backlog: 'brain dump',
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="app">
        <div className="blob blob1" />
        <div className="blob blob2" />
        <div className="blob blob3" />

        <div className="inner">
          {/* header */}
          <div className="header">
            <div className="header-top">
              <div style={{ width: 32 }} />
              <div className="bow">🌸</div>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
            <h1>petal</h1>
            {user && <p className="welcome">hi {user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0]} 🌷</p>}
            <p className="date">{TODAY}</p>
            {saving && <p className="saving">saving…</p>}
          </div>

          {/* ── SEARCH BAR ── */}
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="search tasks..."
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          {/* ── SEARCH RESULTS ── */}
          {isSearching && (
            <div className="search-results">
              <div className="search-results-header">
                {searchResults.length === 0
                  ? 'no results'
                  : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`}
              </div>
              {searchResults.map(task => (
                <div key={task.id} className="search-result-item">
                  <span className="search-result-bucket">{BUCKET_LABEL[task.bucket]}</span>
                  <TaskCard
                    task={task}
                    onToggle={() => toggleTask(task.id)}
                    onRemove={() => removeTask(task.id)}
                    onEdit={(text) => editTask(task.id, text)}
                    onPriority={(p) => setPriority(task.id, p)}
                    showCategory
                  />
                </div>
              ))}
            </div>
          )}

          {/* tabs (hidden when searching) */}
          {!isSearching && (
            <>
              <div className="tabs">
                {(['daily', 'thisWeek', 'planning', 'projects'] as Tab[]).map((t, i) => {
                  const labels = ['✨ today', '📆 this week', '🗓 planning', '🌸 projects']
                  return (
                    <button
                      key={t}
                      className={`tab-btn ${tab === t ? 'active' : ''}`}
                      onClick={() => setTab(t)}
                    >{labels[i]}</button>
                  )
                })}
              </div>

              {/* ── TODAY TAB ── */}
              {tab === 'daily' && (
                <div>
                  <p className="hint">
                    {dailyTasks.length < 3
                      ? `pick up to ${3 - dailyTasks.length} task${3 - dailyTasks.length === 1 ? '' : 's'} — drag from planning or add below 🌷`
                      : "you've got your 3! go do the thing 💪🩷"}
                  </p>

                  <DroppableBucket
                    bucket="daily"
                    tasks={dailyTasks}
                    onToggle={toggleTask}
                    onRemove={removeTask}
                    onEdit={editTask}
                    onMove={moveTask}
                    onPriority={setPriority}
                    moveTargets={['backlog']}
                    emptyText="drag tasks here from planning, or add directly below ✨"
                  />

                  {dailyTasks.length < 3 && (
                    <AddTaskRow
                      bucket="daily"
                      onAdd={(text, _, priority) => addTask(text, 'daily', null, priority)}
                      placeholder="add directly to today..."
                      showPriorityPicker
                    />
                  )}
                </div>
              )}

              {/* ── THIS WEEK TAB ── */}
              {tab === 'thisWeek' && (
                <div>
                  <p className="hint">week of {WEEK_RANGE} 📆</p>

                  {/* priority filter row */}
                  <div className="filter-row">
                    {(['all', 1, 2, 3] as const).map(f => {
                      const count = f === 'all'
                        ? thisWeekTasks.length
                        : thisWeekTasks.filter(t => t.priority === f).length
                      return (
                        <button
                          key={String(f)}
                          className={`filter-chip ${priorityFilter === f ? 'active' : ''}`}
                          onClick={() => setPriorityFilter(f)}
                        >
                          {f === 'all' ? '🫧 all' : `priority ${f}`} ({count})
                        </button>
                      )
                    })}
                  </div>

                  <AddTaskRow
                    bucket="thisWeek"
                    categories={state.categories}
                    onAdd={(text, cat, priority) => addTask(text, 'thisWeek', cat, priority)}
                    placeholder="add to this week..."
                    showCategoryPicker
                    showPriorityPicker
                  />
                  <DroppableBucket
                    bucket="thisWeek"
                    tasks={filteredThisWeek}
                    onToggle={toggleTask}
                    onRemove={removeTask}
                    onEdit={editTask}
                    onMove={moveTask}
                    onPriority={setPriority}
                    showCategory
                    moveTargets={['daily', 'backlog', 'thisMonth', 'future']}
                    emptyText="drop this week's tasks here 📆"
                  />
                </div>
              )}

              {/* ── PLANNING TAB ── */}
              {tab === 'planning' && (
                <div>
                  {/* category manager */}
                  <div className="cat-manager">
                    <div className="cat-manager-top">
                      <span className="cat-manager-label">🏷️ categories</span>
                      <button className="cat-toggle" onClick={() => setCatManagerOpen(o => !o)}>
                        {catManagerOpen ? '− close' : '+ manage'}
                      </button>
                    </div>
                    {catManagerOpen && (
                      <div className="cat-manager-body">
                        <div className="cat-chips">
                          {state.categories.length === 0
                            ? <span className="no-cats">no categories yet</span>
                            : state.categories.map(c => (
                              <div key={c} className="cat-chip">
                                {c}
                                <button onClick={() => removeCategory(c)} className="cat-chip-del">×</button>
                              </div>
                            ))
                          }
                        </div>
                        <div className="cat-add">
                          <input
                            className="cat-add-input"
                            value={newCatInput}
                            onChange={e => setNewCatInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                addCategory(newCatInput)
                                setNewCatInput('')
                              }
                            }}
                            placeholder="new category..."
                          />
                          <button className="cat-add-btn" onClick={() => { addCategory(newCatInput); setNewCatInput('') }}>add</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* category + priority filters */}
                  <div className="filter-row">
                    {['all', ...state.categories, ...(allPlanningTasks.some(t => !t.category) ? ['uncategorized'] : [])].map(f => {
                      const count = f === 'all' ? allPlanningTasks.length
                        : f === 'uncategorized' ? allPlanningTasks.filter(t => !t.category).length
                        : allPlanningTasks.filter(t => t.category === f).length
                      return (
                        <button
                          key={f}
                          className={`filter-chip ${activeFilter === f ? 'active' : ''}`}
                          onClick={() => setActiveFilter(f)}
                        >
                          {f === 'all' ? '🫧 all' : f === 'uncategorized' ? '• other' : f} ({count})
                        </button>
                      )
                    })}
                  </div>

                  {/* priority filter */}
                  <div className="filter-row" style={{ marginTop: 4 }}>
                    <span className="filter-label">priority:</span>
                    {(['all', 1, 2, 3] as const).map(f => (
                      <button
                        key={String(f)}
                        className={`filter-chip pri-filter ${priorityFilter === f ? 'active' : ''}`}
                        onClick={() => setPriorityFilter(f)}
                      >
                        {f === 'all' ? 'any' : f}
                      </button>
                    ))}
                  </div>

                  {/* brain dump */}
                  <SectionHeader
                    title="🫧 brain dump"
                    count={filteredBacklog.length}
                    hint="drag to this week, this month, future, or today"
                  />
                  <AddTaskRow
                    bucket="backlog"
                    categories={state.categories}
                    onAdd={(text, cat, priority) => addTask(text, 'backlog', cat, priority)}
                    placeholder="dump it here..."
                    showCategoryPicker
                    showPriorityPicker
                  />
                  <DroppableBucket
                    bucket="backlog"
                    tasks={filteredBacklog}
                    onToggle={toggleTask}
                    onRemove={removeTask}
                    onEdit={editTask}
                    onMove={moveTask}
                    onPriority={setPriority}
                    showCategory
                    moveTargets={['daily', 'thisWeek', 'thisMonth', 'future']}
                    emptyText="drop tasks here or add above ✨"
                  />

                  {/* this month */}
                  <SectionHeader
                    title="📅 this month"
                    count={filteredThisMonth.length}
                    hint="things to do sometime this month"
                  />
                  <AddTaskRow
                    bucket="thisMonth"
                    categories={state.categories}
                    onAdd={(text, cat, priority) => addTask(text, 'thisMonth', cat, priority)}
                    placeholder="add to this month..."
                    showCategoryPicker
                    showPriorityPicker
                  />
                  <DroppableBucket
                    bucket="thisMonth"
                    tasks={filteredThisMonth}
                    onToggle={toggleTask}
                    onRemove={removeTask}
                    onEdit={editTask}
                    onMove={moveTask}
                    onPriority={setPriority}
                    showCategory
                    moveTargets={['daily', 'thisWeek', 'backlog', 'future']}
                    emptyText="drop tasks here 📅"
                  />

                  {/* future */}
                  <SectionHeader
                    title="🔮 future"
                    count={filteredFuture.length}
                    hint="someday, maybe — no pressure"
                  />
                  <AddTaskRow
                    bucket="future"
                    categories={state.categories}
                    onAdd={(text, cat, priority) => addTask(text, 'future', cat, priority)}
                    placeholder="future ideas..."
                    showCategoryPicker
                    showPriorityPicker
                  />
                  <DroppableBucket
                    bucket="future"
                    tasks={filteredFuture}
                    onToggle={toggleTask}
                    onRemove={removeTask}
                    onEdit={editTask}
                    onMove={moveTask}
                    onPriority={setPriority}
                    showCategory
                    moveTargets={['daily', 'thisWeek', 'backlog', 'thisMonth']}
                    emptyText="drop future ideas here 🔮"
                  />
                </div>
              )}

              {/* ── PROJECTS TAB ── */}
              {tab === 'projects' && (
                <ProjectsTab
                  projects={state.projects ?? []}
                  onAdd={addProject}
                  onRemove={removeProject}
                  onEdit={editProject}
                  onAddStep={addStep}
                  onRemoveStep={removeStep}
                  onToggleStep={toggleStep}
                  onEditStep={editStep}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* drag overlay */}
      <DragOverlay>
        {activeTask && (
          <TaskCard
            task={activeTask}
            onToggle={() => {}}
            onRemove={() => {}}
            onEdit={() => {}}
            isDragOverlay
          />
        )}
      </DragOverlay>

      <style jsx>{`
        .app {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }
        .blob {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }
        .blob1 { top: -80px; right: -80px; width: 260px; height: 260px; background: rgba(255,182,193,0.35); }
        .blob2 { bottom: -60px; left: -60px; width: 200px; height: 200px; background: rgba(255,192,203,0.3); }
        .blob3 { top: 40%; left: -40px; width: 120px; height: 120px; background: rgba(255,105,135,0.1); }
        .inner {
          position: relative;
          z-index: 1;
          max-width: 520px;
          margin: 0 auto;
          padding: 28px 16px 80px;
        }
        .header { text-align: center; margin-bottom: 20px; }
        .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .welcome { font-size: 13px; color: #e91e8c; opacity: 0.8; margin-top: 2px; }
        .bow { font-size: 34px; margin-bottom: 2px; }
        h1 { font-size: 30px; font-weight: 700; color: #c2185b; font-style: italic; letter-spacing: -0.5px; }
        .date { font-size: 13px; color: #e91e8c; opacity: 0.7; margin-top: 4px; }
        .saving { font-size: 11px; color: #f48fb1; font-style: italic; margin-top: 2px; }

        /* Search */
        .search-wrap {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.82);
          border: 1.5px solid rgba(244,143,177,0.4);
          border-radius: 16px;
          padding: 0 14px;
          margin-bottom: 18px;
          box-shadow: 0 2px 10px rgba(233,30,140,0.07);
          transition: border-color 0.18s;
        }
        .search-wrap:focus-within {
          border-color: rgba(233,30,140,0.5);
          box-shadow: 0 2px 14px rgba(233,30,140,0.13);
        }
        .search-icon { font-size: 15px; margin-right: 8px; opacity: 0.6; flex-shrink: 0; }
        .search-input {
          flex: 1;
          height: 42px;
          border: none;
          background: transparent;
          font-size: 14px;
          color: #880e4f;
          outline: none;
        }
        .search-input::placeholder { color: #f4a8c4; }
        .search-clear {
          background: none;
          border: none;
          color: #f48fb1;
          font-size: 18px;
          padding: 0 2px;
          line-height: 1;
          flex-shrink: 0;
        }
        .search-clear:hover { color: #e91e8c; }
        .search-results {
          background: rgba(255,255,255,0.6);
          border: 1.5px solid rgba(244,143,177,0.25);
          border-radius: 16px;
          padding: 10px 12px;
          backdrop-filter: blur(8px);
        }
        .search-results-header {
          font-size: 11px;
          font-weight: 700;
          color: #f4a8c4;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }
        .search-result-item { position: relative; }
        .search-result-bucket {
          display: inline-block;
          font-size: 9px;
          font-weight: 700;
          color: #e91e8c;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          background: rgba(244,143,177,0.18);
          padding: 1px 6px;
          border-radius: 5px;
          margin-bottom: 3px;
        }

        /* Tabs */
        .tabs {
          display: flex;
          gap: 5px;
          margin-bottom: 22px;
          background: rgba(255,255,255,0.6);
          border-radius: 18px;
          padding: 5px;
          backdrop-filter: blur(8px);
        }
        .tab-btn {
          flex: 1;
          padding: 8px 2px;
          border-radius: 14px;
          border: none;
          font-size: 11px;
          font-weight: 600;
          background: transparent;
          color: #c2185b;
          transition: all 0.18s;
        }
        .tab-btn.active {
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          color: #fff;
          box-shadow: 0 2px 8px rgba(233,30,140,0.28);
        }
        .hint {
          font-size: 13px;
          color: #ad1457;
          font-style: italic;
          text-align: center;
          margin-bottom: 14px;
        }

        /* Category manager */
        .cat-manager {
          background: rgba(255,255,255,0.5);
          border: 1.5px dashed rgba(244,143,177,0.4);
          border-radius: 14px;
          padding: 10px 14px;
          margin-bottom: 12px;
        }
        .cat-manager-top { display: flex; justify-content: space-between; align-items: center; }
        .cat-manager-label { font-size: 12px; font-weight: 700; color: #ad1457; }
        .cat-toggle { background: none; border: none; font-size: 12px; font-weight: 700; color: #e91e8c; }
        .cat-manager-body { margin-top: 10px; }
        .cat-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .cat-chip {
          display: flex; align-items: center; gap: 4px;
          background: rgba(244,143,177,0.18); border-radius: 20px;
          padding: 3px 10px; font-size: 12px; color: #c2185b; font-weight: 600;
        }
        .cat-chip-del { background: none; border: none; color: #f48fb1; font-size: 14px; line-height: 1; padding: 0; }
        .no-cats { font-size: 12px; color: #f48fb1; font-style: italic; }
        .cat-add { display: flex; gap: 6px; }
        .cat-add-input {
          flex: 1; height: 34px; border-radius: 10px;
          border: 1.5px solid rgba(244,143,177,0.4); background: rgba(255,255,255,0.9);
          padding: 0 10px; font-size: 13px; color: #880e4f;
        }
        .cat-add-input::placeholder { color: #f48fb1; }
        .cat-add-btn {
          height: 34px; padding: 0 14px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #f48fb1, #e91e8c); color: #fff;
          font-size: 13px; font-weight: 700;
        }

        /* Filters */
        .filter-row {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; align-items: center;
        }
        .filter-label { font-size: 11px; font-weight: 700; color: #f4a8c4; margin-right: 2px; }
        .filter-chip {
          padding: 4px 11px; border-radius: 20px;
          border: 1.5px solid rgba(244,143,177,0.3); font-size: 12px; font-weight: 600;
          background: rgba(255,255,255,0.6); color: #c2185b; transition: all 0.14s;
        }
        .filter-chip.active {
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          color: #fff; border-color: transparent;
          box-shadow: 0 2px 6px rgba(233,30,140,0.22);
        }
        .pri-filter { padding: 4px 9px; }
      `}</style>
    </DndContext>
  )
}
