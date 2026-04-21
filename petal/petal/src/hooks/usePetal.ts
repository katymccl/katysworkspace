'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState, Task, Bucket, Project, ProjectStep } from '@/types'

const EMOJIS = ['🌸', '🌷', '💐', '🌺', '🩷', '✨', '🎀', '🍓', '🫧', '🌙']
const randomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

const DEFAULT_STATE: AppState = {
  tasks: [],
  categories: ['personal', 'work', 'errands', 'ideas'],
  projects: [],
}

export function usePetal() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasLoaded = useRef(false) // guard: never save before first load completes

  // Load from API on mount
  useEffect(() => {
    fetch('/api/state')
      .then(r => r.json())
      .then((data: AppState) => {
        setState({ ...DEFAULT_STATE, ...data, projects: data.projects ?? [] })
        hasLoaded.current = true // only NOW is it safe to save
        setLoading(false)
      })
      .catch(() => {
        hasLoaded.current = true // even on error, allow saves
        setLoading(false)
      })
  }, [])

  // Debounced save - will not fire until after initial load completes
  const save = useCallback((newState: AppState) => {
    if (!hasLoaded.current) return // never overwrite DB with default state
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(() => {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newState),
      }).finally(() => setSaving(false))
    }, 600)
  }, [])

  const update = useCallback((updater: (prev: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev)
      save(next)
      return next
    })
  }, [save])

  // Task mutations
  const addTask = useCallback((text: string, bucket: Bucket, category?: string | null) => {
    const task: Task = {
      id: uid(),
      text: text.trim(),
      done: false,
      emoji: randomEmoji(),
      category: category ?? null,
      bucket,
      createdAt: Date.now(),
    }
    update(s => ({ ...s, tasks: [...s.tasks, task] }))
  }, [update])

  const removeTask = useCallback((id: string) => {
    update(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }))
  }, [update])

  const toggleTask = useCallback((id: string) => {
    update(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t),
    }))
  }, [update])

  const editTask = useCallback((id: string, text: string) => {
    update(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === id ? { ...t, text } : t),
    }))
  }, [update])

  const moveTask = useCallback((id: string, bucket: Bucket) => {
    update(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === id ? { ...t, bucket, done: false } : t),
    }))
  }, [update])

  const reorderTasks = useCallback((orderedIds: string[]) => {
    update(s => {
      const map = new Map(s.tasks.map(t => [t.id, t]))
      const reordered = orderedIds.map(id => map.get(id)!).filter(Boolean)
      const rest = s.tasks.filter(t => !orderedIds.includes(t.id))
      return { ...s, tasks: [...reordered, ...rest] }
    })
  }, [update])

  // Category mutations
  const addCategory = useCallback((name: string) => {
    const clean = name.trim().toLowerCase()
    update(s => {
      if (s.categories.includes(clean)) return s
      return { ...s, categories: [...s.categories, clean] }
    })
  }, [update])

  const removeCategory = useCallback((name: string) => {
    update(s => ({
      ...s,
      categories: s.categories.filter(c => c !== name),
      tasks: s.tasks.map(t => t.category === name ? { ...t, category: null } : t),
    }))
  }, [update])

  // Project mutations
  const addProject = useCallback((name: string, description: string) => {
    const project: Project = {
      id: uid(),
      name: name.trim(),
      emoji: randomEmoji(),
      description: description.trim(),
      steps: [],
      createdAt: Date.now(),
    }
    update(s => ({ ...s, projects: [...(s.projects ?? []), project] }))
  }, [update])

  const removeProject = useCallback((id: string) => {
    update(s => ({ ...s, projects: (s.projects ?? []).filter(p => p.id !== id) }))
  }, [update])

  const editProject = useCallback((id: string, name: string, description: string) => {
    update(s => ({
      ...s,
      projects: (s.projects ?? []).map(p =>
        p.id === id ? { ...p, name: name.trim(), description: description.trim() } : p
      ),
    }))
  }, [update])

  const addStep = useCallback((projectId: string, text: string) => {
    const step: ProjectStep = {
      id: uid(),
      text: text.trim(),
      done: false,
      emoji: randomEmoji(),
      createdAt: Date.now(),
    }
    update(s => ({
      ...s,
      projects: (s.projects ?? []).map(p =>
        p.id === projectId ? { ...p, steps: [...p.steps, step] } : p
      ),
    }))
  }, [update])

  const removeStep = useCallback((projectId: string, stepId: string) => {
    update(s => ({
      ...s,
      projects: (s.projects ?? []).map(p =>
        p.id === projectId ? { ...p, steps: p.steps.filter(st => st.id !== stepId) } : p
      ),
    }))
  }, [update])

  const toggleStep = useCallback((projectId: string, stepId: string) => {
    update(s => ({
      ...s,
      projects: (s.projects ?? []).map(p =>
        p.id === projectId
          ? { ...p, steps: p.steps.map(st => st.id === stepId ? { ...st, done: !st.done } : st) }
          : p
      ),
    }))
  }, [update])

  const editStep = useCallback((projectId: string, stepId: string, text: string) => {
    update(s => ({
      ...s,
      projects: (s.projects ?? []).map(p =>
        p.id === projectId
          ? { ...p, steps: p.steps.map(st => st.id === stepId ? { ...st, text: text.trim() } : st) }
          : p
      ),
    }))
  }, [update])

  const dailyTasks = state.tasks.filter(t => t.bucket === 'daily')
  const backlogTasks = state.tasks.filter(t => t.bucket === 'backlog')
  const thisMonthTasks = state.tasks.filter(t => t.bucket === 'thisMonth')
  const futureTasks = state.tasks.filter(t => t.bucket === 'future')

  return {
    state,
    loading,
    saving,
    dailyTasks,
    backlogTasks,
    thisMonthTasks,
    futureTasks,
    addTask,
    removeTask,
    toggleTask,
    editTask,
    moveTask,
    reorderTasks,
    addCategory,
    removeCategory,
    addProject,
    removeProject,
    editProject,
    addStep,
    removeStep,
    toggleStep,
    editStep,
  }
}
