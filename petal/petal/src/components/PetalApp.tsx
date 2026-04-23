'use client'

import { useState } from 'react'
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
import { Bucket, Task } from '@/types'
import TaskCard from './TaskCard'
import DroppableBucket from './DroppableBucket'
import AddTaskRow from './AddTaskRow'
import ProjectsTab from './ProjectsTab'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const now = new Date()
const TODAY = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`

type Tab = 'daily' | 'planning' | 'projects'

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
    dailyTasks, backlogTasks, thisMonthTasks, futureTasks,
    addTask, removeTask, toggleTask, editTask, moveTask, reorderTasks,
    addCategory, removeCategory,
    addProject, removeProject, editProject,
    addStep, removeStep, toggleStep, editStep,
  } = usePetal()

  const { user } = useUser()
  const [tab, setTab] = useState<Tab>('daily')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [catManagerOpen, setCatManagerOpen] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [activeProject, setActiveProject] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  )

  const allPlanningTasks = [...backlogTasks, ...thisMonthTasks, ...futureTasks]
  const filteredBacklog = activeFilter === 'all' ? backlogTasks
    : activeFilter === 'uncategorized' ? backlogTasks.filter(t => !t.category)
    : backlogTasks.filter(t => t.category === activeFilter)

  const filteredThisMonth = activeFilter === 'all' ? thisMonthTasks
    : activeFilter === 'uncategorized' ? thisMonthTasks.filter(t => !t.category)
    : thisMonthTasks.filter(t => t.category === activeFilter)

  const filteredFuture = activeFilter === 'all' ? futureTasks
    : activeFilter === 'uncategorized' ? futureTasks.filter(t => !t.category)
    : futureTasks.filter(t => t.category === activeFilter)

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

    // reorder within same bucket
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="app">
        {/* decorative blobs */}
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

          {/* tabs */}
          <div className="tabs">
            {(['daily', 'planning', 'projects'] as Tab[]).map((t, i) => {
              const labels = ['✨ today', '🗓 planning', '🌸 projects']
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
                moveTargets={['backlog']}
                emptyText="drag tasks here from planning, or add directly below ✨"
              />

              {dailyTasks.length < 3 && (
                <AddTaskRow
                  bucket="daily"
                  onAdd={(text) => addTask(text, 'daily')}
                  placeholder="add directly to today..."
                />
              )}
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

              {/* filters */}
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

              {/* brain dump section */}
              <SectionHeader
                title="🫧 brain dump"
                count={filteredBacklog.length}
                hint="drag to this month, future, or today"
              />
              <AddTaskRow
                bucket="backlog"
                categories={state.categories}
                onAdd={(text, cat) => addTask(text, 'backlog', cat)}
                placeholder="dump it here..."
                showCategoryPicker
              />
              <DroppableBucket
                bucket="backlog"
                tasks={filteredBacklog}
                onToggle={toggleTask}
                onRemove={removeTask}
                onEdit={editTask}
                onMove={moveTask}
                showCategory
                moveTargets={['daily', 'thisMonth', 'future']}
                emptyText="drop tasks here or add above ✨"
              />

              {/* this month section */}
              <SectionHeader
                title="📅 this month"
                count={filteredThisMonth.length}
                hint="things to do sometime this month"
              />
              <AddTaskRow
                bucket="thisMonth"
                categories={state.categories}
                onAdd={(text, cat) => addTask(text, 'thisMonth', cat)}
                placeholder="add to this month..."
                showCategoryPicker
              />
              <DroppableBucket
                bucket="thisMonth"
                tasks={filteredThisMonth}
                onToggle={toggleTask}
                onRemove={removeTask}
                onEdit={editTask}
                onMove={moveTask}
                showCategory
                moveTargets={['daily', 'backlog', 'future']}
                emptyText="drop tasks here 📅"
              />

              {/* future section */}
              <SectionHeader
                title="🔮 future"
                count={filteredFuture.length}
                hint="someday, maybe — no pressure"
              />
              <AddTaskRow
                bucket="future"
                categories={state.categories}
                onAdd={(text, cat) => addTask(text, 'future', cat)}
                placeholder="future ideas..."
                showCategoryPicker
              />
              <DroppableBucket
                bucket="future"
                tasks={filteredFuture}
                onToggle={toggleTask}
                onRemove={removeTask}
                onEdit={editTask}
                onMove={moveTask}
                showCategory
                moveTargets={['daily', 'backlog', 'thisMonth']}
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
        .header { text-align: center; margin-bottom: 24px; }
        .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .welcome { font-size: 13px; color: #e91e8c; opacity: 0.8; margin-top: 2px; }
        .bow { font-size: 34px; margin-bottom: 2px; }
        h1 { font-size: 30px; font-weight: 700; color: #c2185b; font-style: italic; letter-spacing: -0.5px; }
        .date { font-size: 13px; color: #e91e8c; opacity: 0.7; margin-top: 4px; }
        .saving { font-size: 11px; color: #f48fb1; font-style: italic; margin-top: 2px; }
        .tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 22px;
          background: rgba(255,255,255,0.6);
          border-radius: 18px;
          padding: 5px;
          backdrop-filter: blur(8px);
        }
        .tab-btn {
          flex: 1;
          padding: 8px 4px;
          border-radius: 14px;
          border: none;
          font-size: 12px;
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
        .cat-manager-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cat-manager-label { font-size: 12px; font-weight: 700; color: #ad1457; }
        .cat-toggle {
          background: none;
          border: none;
          font-size: 12px;
          font-weight: 700;
          color: #e91e8c;
        }
        .cat-manager-body { margin-top: 10px; }
        .cat-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .cat-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(244,143,177,0.18);
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 12px;
          color: #c2185b;
          font-weight: 600;
        }
        .cat-chip-del {
          background: none;
          border: none;
          color: #f48fb1;
          font-size: 14px;
          line-height: 1;
          padding: 0;
        }
        .no-cats { font-size: 12px; color: #f48fb1; font-style: italic; }
        .cat-add { display: flex; gap: 6px; }
        .cat-add-input {
          flex: 1;
          height: 34px;
          border-radius: 10px;
          border: 1.5px solid rgba(244,143,177,0.4);
          background: rgba(255,255,255,0.9);
          padding: 0 10px;
          font-size: 13px;
          color: #880e4f;
        }
        .cat-add-input::placeholder { color: #f48fb1; }
        .cat-add-btn {
          height: 34px;
          padding: 0 14px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
        }

        /* Filters */
        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 4px;
        }
        .filter-chip {
          padding: 4px 11px;
          border-radius: 20px;
          border: 1.5px solid rgba(244,143,177,0.3);
          font-size: 12px;
          font-weight: 600;
          background: rgba(255,255,255,0.6);
          color: #c2185b;
          transition: all 0.14s;
        }
        .filter-chip.active {
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 2px 6px rgba(233,30,140,0.22);
        }
      `}</style>
    </DndContext>
  )
}
