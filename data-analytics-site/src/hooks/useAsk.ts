import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dataset } from '../lib/datasets'
import { runQuery, type QueryOutcome, type QueryTable } from '../lib/ask/execute'
import {
  buildAskRequest,
  buildSuggestRequest,
  requestAnswer,
  requestQuestions,
} from '../lib/ask/request'
import type { AskAnswer } from '../lib/ask/schema'
import { STORES, getOne, put } from '../lib/persist/db'
import { loadSuggestedQuestions, saveSuggestedQuestions } from '../lib/ask/store'
import {
  applicableConfirmations,
  loadConfirmedRelationships,
  loadRejectedRelationships,
} from '../lib/relationships/confirmed'
import {
  measureLink,
  measureOverlaps,
  type RelationshipCandidate,
} from '../lib/relationships/detect'
import { mergeRelationships, usableLinks } from '../lib/relationships/merge'
import { workspaceKey } from '../lib/relationships/request'
import { loadAnalysis } from '../lib/relationships/store'
import type { ResolvedUnderstanding, UnderstandingError } from '../lib/understanding'
import { latestVersions, relationshipInputs, summarise } from './useRelationships'

export interface AskEntry {
  id: string
  question: string
  status: 'loading' | 'done' | 'error'
  /** Claude's plan, once it arrives. */
  answer: AskAnswer | null
  /** The plan run on the data in this browser, when it was answerable. */
  outcome: QueryOutcome | null
  error: UnderstandingError | null
  /** Names of the datasets as they were when asked, for describing the plan. */
  names: Record<string, string>
}

/** Claude's suggested questions for the open datasets; only fetched when asked for. */
export interface SuggestedQuestions {
  status: 'idle' | 'loading' | 'error'
  /** Saved or freshly suggested questions; empty until there are some. */
  questions: string[]
  error: UnderstandingError | null
}

/** A workspace's saved conversation, in IndexedDB. Questions still being answered aren't saved. */
interface SavedHistory {
  workspaceId: string
  entries: AskEntry[]
}

/**
 * A conversation of questions about the open workspace's datasets, one per workspace, saved in
 * this browser. Claude plans each answer from summaries; the plan then runs here on the full rows.
 */
export function useAsk(
  datasets: readonly Dataset[],
  resolve: (d: Dataset) => ResolvedUnderstanding,
  workspaceId: string | null,
) {
  const [byWorkspace, setByWorkspace] = useState<Record<string, AskEntry[]>>({})
  const entries = useMemo(
    () => (workspaceId ? (byWorkspace[workspaceId] ?? []) : []),
    [byWorkspace, workspaceId],
  )
  /** Changes one workspace's conversation, whichever workspace is open by then. */
  const setEntriesFor = useCallback(
    (ws: string, change: (list: AskEntry[]) => AskEntry[]) =>
      setByWorkspace((all) => ({ ...all, [ws]: change(all[ws] ?? []) })),
    [],
  )

  // Load a workspace's saved conversation the first time it's opened.
  useEffect(() => {
    if (!workspaceId) return
    let live = true
    void getOne<SavedHistory>(STORES.askHistory, workspaceId).then((saved) => {
      if (!live) return
      setByWorkspace((all) =>
        workspaceId in all ? all : { ...all, [workspaceId]: saved?.entries ?? [] },
      )
    })
    return () => {
      live = false
    }
  }, [workspaceId])

  // Save each conversation that changed, leaving out questions still being answered.
  const saved = useRef<Record<string, AskEntry[]>>({})
  useEffect(() => {
    for (const [ws, list] of Object.entries(byWorkspace)) {
      if (saved.current[ws] === list) continue
      saved.current[ws] = list
      const finished = list.filter((e) => e.status !== 'loading')
      void put(STORES.askHistory, { workspaceId: ws, entries: finished } satisfies SavedHistory)
    }
  }, [byWorkspace])
  // Measuring overlaps reads every value, so do it once per set of dataset versions.
  const candidatesCache = useRef<{ key: string; candidates: RelationshipCandidate[] } | null>(null)

  const workspace = useMemo(() => latestVersions(datasets), [datasets])
  const key = useMemo(
    () =>
      workspaceKey(
        workspace.map((d) => ({ datasetId: d.datasetId, content: d.fingerprints.content })),
      ),
    [workspace],
  )

  /**
   * Summaries and links for the open datasets: what every request is built on. The links are the
   * same as on the relationships page: the user's, and Claude's latest likely or possible ones.
   */
  const context = useCallback(() => {
    const inputs = relationshipInputs(workspace)
    if (candidatesCache.current?.key !== key) {
      candidatesCache.current = { key, candidates: measureOverlaps(inputs) }
    }
    const openColumns = new Map(workspace.map((d) => [d.datasetId, new Set(d.columns)]))
    const view = mergeRelationships(
      candidatesCache.current.candidates,
      loadAnalysis(key)?.analysis ?? null,
      applicableConfirmations(loadConfirmedRelationships(), openColumns),
      applicableConfirmations(loadRejectedRelationships(), openColumns),
      (from, to) => measureLink(inputs, from, to),
    )
    return {
      summaries: workspace.map((d) => summarise(d, resolve(d))),
      links: usableLinks(view),
    }
  }, [key, workspace, resolve])

  const run = useCallback(
    async (ws: string, id: string, question: string, previousQuestions: string[]) => {
      const update = (change: Partial<AskEntry>) =>
        setEntriesFor(ws, (list) => list.map((e) => (e.id === id ? { ...e, ...change } : e)))
      const { summaries, links } = context()
      const names = Object.fromEntries(summaries.map((s) => [s.key, s.name]))

      const request = buildAskRequest(question, summaries, links, previousQuestions)
      const response = await requestAnswer(request)
      if (!response.ok) {
        update({ status: 'error', error: response.error, names })
        return
      }
      const { answer } = response.result
      const tables = new Map<string, QueryTable>(
        workspace.map((d) => [d.datasetId, { name: names[d.datasetId], rows: d.rows }]),
      )
      update({
        status: 'done',
        answer,
        outcome: answer.answerable ? runQuery(answer.plan, tables) : null,
        names,
      })
    },
    [context, workspace, setEntriesFor],
  )

  const ask = useCallback(
    (question: string) => {
      if (!workspaceId) return
      const id = crypto.randomUUID()
      const previous = entries.filter((e) => e.status === 'done').map((e) => e.question)
      setEntriesFor(workspaceId, (list) => [...list, blankEntry(id, question)])
      void run(workspaceId, id, question, previous)
    },
    [entries, run, workspaceId, setEntriesFor],
  )

  const retry = useCallback(
    (id: string) => {
      const index = entries.findIndex((e) => e.id === id)
      if (index < 0 || !workspaceId) return
      const previous = entries
        .slice(0, index)
        .filter((e) => e.status === 'done')
        .map((e) => e.question)
      setEntriesFor(workspaceId, (list) =>
        list.map((e) => (e.id === id ? blankEntry(id, e.question) : e)),
      )
      void run(workspaceId, id, entries[index].question, previous)
    },
    [entries, run, workspaceId, setEntriesFor],
  )

  const clear = useCallback(() => {
    if (workspaceId) setEntriesFor(workspaceId, () => [])
  }, [workspaceId, setEntriesFor])

  // Suggestions belong to one set of dataset versions; saved ones come back without a call.
  const [suggestState, setSuggestState] = useState<SuggestedQuestions & { key: string }>()
  const suggested: SuggestedQuestions =
    suggestState?.key === key
      ? suggestState
      : { status: 'idle', questions: loadSuggestedQuestions(key) ?? [], error: null }

  const suggestQuestions = useCallback(async () => {
    const forKey = key
    const previous = suggested.questions
    setSuggestState({ key: forKey, status: 'loading', questions: previous, error: null })
    const { summaries, links } = context()
    const response = await requestQuestions(buildSuggestRequest(summaries, links))
    if (!response.ok) {
      setSuggestState({ key: forKey, status: 'error', questions: previous, error: response.error })
      return
    }
    saveSuggestedQuestions(forKey, response.result.questions)
    setSuggestState({
      key: forKey,
      status: 'idle',
      questions: response.result.questions,
      error: null,
    })
  }, [key, context, suggested.questions])

  return {
    entries,
    ask,
    retry,
    clear,
    busy: entries.some((e) => e.status === 'loading'),
    suggested,
    suggestQuestions,
  }
}

function blankEntry(id: string, question: string): AskEntry {
  return { id, question, status: 'loading', answer: null, outcome: null, error: null, names: {} }
}
