import { useCallback, useMemo, useState } from 'react'
import type { Dataset } from '../lib/datasets'
import {
  measureLink,
  measureOverlaps,
  type ColumnRef,
  type RelationshipCandidate,
  type RelationshipInput,
} from '../lib/relationships/detect'
import {
  applicableConfirmations,
  isConfirmed,
  loadConfirmedRelationships,
  loadRejectedRelationships,
  saveConfirmedRelationships,
  saveRejectedRelationships,
  toggleConfirmed,
  withoutRelationship,
  type ConfirmedRelationship,
} from '../lib/relationships/confirmed'
import { mergeRelationships, type RelationshipView } from '../lib/relationships/merge'
import {
  buildRelationshipRequest,
  requestRelationships,
  workspaceKey,
  type DatasetSummary,
} from '../lib/relationships/request'
import type { RelationshipResult } from '../lib/relationships/schema'
import { loadAnalysis, saveAnalysis } from '../lib/relationships/store'
import type { ResolvedUnderstanding, UnderstandingError } from '../lib/understanding'

export interface AnalysisState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  result: RelationshipResult | null
  error: UnderstandingError | null
}

/**
 * The workspace's relationships: Claude's analysis on request, decided from overlaps measured in
 * the browser, plus the user's own decisions. Only the latest open version of each dataset takes
 * part.
 */
export function useRelationships(
  datasets: readonly Dataset[],
  resolve: (d: Dataset) => ResolvedUnderstanding,
) {
  const workspace = useMemo(() => latestVersions(datasets), [datasets])
  const key = workspaceKey(
    workspace.map((d) => ({ datasetId: d.datasetId, content: d.fingerprints.content })),
  )

  const inputs = useMemo(() => relationshipInputs(workspace), [workspace])
  // Evidence for Claude, and for the links it or the user picks; never drawn on its own.
  const candidates: RelationshipCandidate[] = useMemo(() => measureOverlaps(inputs), [inputs])
  const measure = useCallback(
    (from: ColumnRef, to: ColumnRef) => measureLink(inputs, from, to),
    [inputs],
  )

  // Every decision the user has made (confirmed, or "not related"), saved in this browser; only
  // those whose datasets and columns are open take part. A relationship is never in both lists.
  const [allConfirmed, setAllConfirmed] = useState<ConfirmedRelationship[]>(
    loadConfirmedRelationships,
  )
  const [allRejected, setAllRejected] = useState<ConfirmedRelationship[]>(loadRejectedRelationships)
  const openColumns = useMemo(
    () => new Map(workspace.map((d) => [d.datasetId, new Set(d.columns)])),
    [workspace],
  )
  const confirmed = useMemo(
    () => applicableConfirmations(allConfirmed, openColumns),
    [allConfirmed, openColumns],
  )
  const rejected = useMemo(
    () => applicableConfirmations(allRejected, openColumns),
    [allRejected, openColumns],
  )

  /** Toggles one list, and removes the relationship from the other when adding it. */
  const decide = useCallback(
    (relationship: ConfirmedRelationship, decision: 'confirmed' | 'rejected') => {
      // Work out both new lists from the current ones, then set and save each once.
      const [current, other] =
        decision === 'confirmed' ? [allConfirmed, allRejected] : [allRejected, allConfirmed]
      const adding = !isConfirmed(current, relationship)
      const nextCurrent = toggleConfirmed(current, relationship)
      const nextOther = adding ? withoutRelationship(other, relationship) : other
      const [nextConfirmed, nextRejected] =
        decision === 'confirmed' ? [nextCurrent, nextOther] : [nextOther, nextCurrent]
      setAllConfirmed(nextConfirmed)
      setAllRejected(nextRejected)
      saveConfirmedRelationships(nextConfirmed)
      saveRejectedRelationships(nextRejected)
    },
    [allConfirmed, allRejected],
  )
  const toggle = useCallback((r: ConfirmedRelationship) => decide(r, 'confirmed'), [decide])
  const toggleRejected = useCallback((r: ConfirmedRelationship) => decide(r, 'rejected'), [decide])
  /** Confirms a relationship the user drew; one already confirmed stays as it is. */
  const confirm = useCallback(
    (r: ConfirmedRelationship) => {
      if (!isConfirmed(allConfirmed, r)) decide(r, 'confirmed')
    },
    [allConfirmed, decide],
  )

  const [states, setStates] = useState<Record<string, AnalysisState>>({})
  const saved = useMemo(() => loadAnalysis(key), [key])
  const state: AnalysisState =
    states[key] ??
    (saved
      ? { status: 'ready', result: saved, error: null }
      : { status: 'idle', result: null, error: null })

  const analyse = useCallback(async () => {
    const previous = state.result
    setStates((s) => ({ ...s, [key]: { status: 'loading', result: previous, error: null } }))
    const request = buildRelationshipRequest(
      workspace.map((d) => summarise(d, resolve(d))),
      candidates,
      confirmed,
      rejected,
    )
    const outcome = await requestRelationships(request)
    if (outcome.ok) {
      saveAnalysis(key, outcome.result)
      setStates((s) => ({ ...s, [key]: { status: 'ready', result: outcome.result, error: null } }))
    } else {
      setStates((s) => ({
        ...s,
        [key]: { status: 'error', result: previous, error: outcome.error },
      }))
    }
  }, [key, workspace, candidates, confirmed, rejected, resolve, state.result])

  const view: RelationshipView = useMemo(
    () =>
      mergeRelationships(
        candidates,
        state.result?.analysis ?? null,
        confirmed,
        rejected,
        measure,
      ),
    [candidates, state.result, confirmed, rejected, measure],
  )

  return {
    workspace,
    view,
    state,
    analyse,
    toggleConfirmed: toggle,
    toggleRejected,
    confirm,
    layoutKey: key,
  }
}

/** The open datasets as relationship measuring takes them. */
export function relationshipInputs(workspace: readonly Dataset[]): RelationshipInput[] {
  return workspace.map((d) => ({
    key: d.datasetId,
    fileName: d.fileName,
    columns: d.columns,
    rows: d.rows,
    profile: d.profile,
  }))
}

/** Keeps the most recently opened copy of each dataset, in the order they were opened. */
export function latestVersions(datasets: readonly Dataset[]): Dataset[] {
  const latest = new Map<string, Dataset>()
  for (const d of datasets) latest.set(d.datasetId, d)
  return datasets.filter((d) => latest.get(d.datasetId) === d)
}

export function summarise(d: Dataset, resolved: ResolvedUnderstanding): DatasetSummary {
  return {
    key: d.datasetId,
    fileName: d.fileName,
    name: resolved.name.value ?? d.fileName,
    description: resolved.description.value,
    rowMeaning: resolved.rowMeaning.value,
    profile: d.profile,
    columnDefinitions: new Map(
      resolved.columns.map((c) => [
        c.name,
        { description: c.description.value, role: c.role.value },
      ]),
    ),
  }
}
