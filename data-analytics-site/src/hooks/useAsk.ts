import { useCallback, useRef, useState } from 'react'
import type { Dataset } from '../lib/datasets'
import { runQuery, type QueryOutcome, type QueryTable } from '../lib/ask/execute'
import { buildAskRequest, requestAnswer } from '../lib/ask/request'
import type { AskAnswer } from '../lib/ask/schema'
import {
  applicableConfirmations,
  loadConfirmedRelationships,
  loadRejectedRelationships,
} from '../lib/relationships/confirmed'
import { detectRelationships, type RelationshipCandidate } from '../lib/relationships/detect'
import { workspaceKey } from '../lib/relationships/request'
import type { ResolvedUnderstanding, UnderstandingError } from '../lib/understanding'
import { latestVersions, summarise } from './useRelationships'

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

/**
 * A conversation of questions about the open datasets. Claude plans each answer from summaries;
 * the plan then runs here on the full rows. Lives as long as the app, not in storage, since
 * answers belong to the exact data that was open.
 */
export function useAsk(
  datasets: readonly Dataset[],
  resolve: (d: Dataset) => ResolvedUnderstanding,
) {
  const [entries, setEntries] = useState<AskEntry[]>([])
  // Finding links reads every value, so do it once per set of dataset versions.
  const candidatesCache = useRef<{ key: string; candidates: RelationshipCandidate[] } | null>(null)

  const run = useCallback(
    async (id: string, question: string, previousQuestions: string[]) => {
      const update = (change: Partial<AskEntry>) =>
        setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...change } : e)))
      const workspace = latestVersions(datasets)
      const key = workspaceKey(
        workspace.map((d) => ({ datasetId: d.datasetId, content: d.fingerprints.content })),
      )
      if (candidatesCache.current?.key !== key) {
        candidatesCache.current = {
          key,
          candidates: detectRelationships(
            workspace.map((d) => ({
              key: d.datasetId,
              fileName: d.fileName,
              columns: d.columns,
              rows: d.rows,
              profile: d.profile,
            })),
          ),
        }
      }
      const openColumns = new Map(workspace.map((d) => [d.datasetId, new Set(d.columns)]))
      const summaries = workspace.map((d) => summarise(d, resolve(d)))
      const names = Object.fromEntries(summaries.map((s) => [s.key, s.name]))

      const request = buildAskRequest(
        question,
        summaries,
        candidatesCache.current.candidates,
        applicableConfirmations(loadConfirmedRelationships(), openColumns),
        applicableConfirmations(loadRejectedRelationships(), openColumns),
        previousQuestions,
      )
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
    [datasets, resolve],
  )

  const ask = useCallback(
    (question: string) => {
      const id = crypto.randomUUID()
      const previous = entries.filter((e) => e.status === 'done').map((e) => e.question)
      setEntries((list) => [...list, blankEntry(id, question)])
      void run(id, question, previous)
    },
    [entries, run],
  )

  const retry = useCallback(
    (id: string) => {
      const index = entries.findIndex((e) => e.id === id)
      if (index < 0) return
      const previous = entries
        .slice(0, index)
        .filter((e) => e.status === 'done')
        .map((e) => e.question)
      setEntries((list) => list.map((e) => (e.id === id ? blankEntry(id, e.question) : e)))
      void run(id, entries[index].question, previous)
    },
    [entries, run],
  )

  const clear = useCallback(() => setEntries([]), [])

  return { entries, ask, retry, clear, busy: entries.some((e) => e.status === 'loading') }
}

function blankEntry(id: string, question: string): AskEntry {
  return { id, question, status: 'loading', answer: null, outcome: null, error: null, names: {} }
}
