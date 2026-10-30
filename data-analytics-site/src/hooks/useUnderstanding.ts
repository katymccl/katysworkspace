import { useCallback, useState } from 'react'
import type { Dataset } from '../lib/datasets'
import {
  EMPTY_CONFIRMED,
  buildAiInput,
  loadConfirmed,
  loadSuggestion,
  requestUnderstanding,
  resolveUnderstanding,
  saveConfirmed,
  saveSuggestion,
  type ConfirmedDefinitions,
  type ResolvedUnderstanding,
  type StoredSuggestion,
  type UnderstandingError,
  withGlossary,
} from '../lib/understanding'
import type { GlossaryTerm } from '../lib/glossary'

export interface InterpretationState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** The latest AI suggestion for this content version; kept while re-running or after errors. */
  suggestion: StoredSuggestion | null
  error: UnderstandingError | null
}

const IDLE: InterpretationState = { status: 'idle', suggestion: null, error: null }

/** Suggestions belong to one content version of a dataset. */
const suggestionKey = (d: Dataset) => `${d.datasetId}:${d.fingerprints.content}`

/**
 * React glue for dataset understanding: AI suggestions per content version, confirmed definitions
 * per datasetId, both mirrored to browser storage. Interpretation only runs when asked.
 */
export function useUnderstanding(glossary: readonly GlossaryTerm[] = []) {
  const [interpretations, setInterpretations] = useState<Record<string, InterpretationState>>({})
  const [confirmed, setConfirmed] = useState<Record<string, ConfirmedDefinitions>>({})

  /** Restores anything saved for newly opened datasets. Call once per upload. */
  const restore = useCallback((datasets: readonly Dataset[]) => {
    setInterpretations((prev) => {
      const next = { ...prev }
      for (const d of datasets) {
        const key = suggestionKey(d)
        if (next[key]) continue
        const saved = loadSuggestion(d.datasetId, d.fingerprints.content)
        next[key] = saved ? { status: 'ready', suggestion: saved, error: null } : IDLE
      }
      return next
    })
    setConfirmed((prev) => {
      const next = { ...prev }
      for (const d of datasets) {
        if (!next[d.datasetId]) next[d.datasetId] = loadConfirmed(d.datasetId) ?? EMPTY_CONFIRMED
      }
      return next
    })
  }, [])

  const interpret = useCallback(
    async (dataset: Dataset) => {
      const key = suggestionKey(dataset)
      setInterpretations((prev) => ({
        ...prev,
        [key]: { ...(prev[key] ?? IDLE), status: 'loading', error: null },
      }))

      // Confirmed definitions and glossary meanings go along as settled facts, so a re-run builds
      // on the user's edits.
      const settled = withGlossary(
        confirmed[dataset.datasetId] ?? EMPTY_CONFIRMED,
        dataset.columns,
        glossary,
      )
      const outcome = await requestUnderstanding(
        buildAiInput(dataset.fileName, dataset.profile, settled),
      )

      if (outcome.ok) {
        const suggestion: StoredSuggestion = outcome.result
        saveSuggestion(dataset.datasetId, dataset.fingerprints.content, suggestion)
        setInterpretations((prev) => ({
          ...prev,
          [key]: { status: 'ready', suggestion, error: null },
        }))
      } else {
        setInterpretations((prev) => ({
          ...prev,
          [key]: { ...(prev[key] ?? IDLE), status: 'error', error: outcome.error },
        }))
      }
    },
    [confirmed, glossary],
  )

  const updateConfirmed = useCallback(
    (datasetId: string, update: (current: ConfirmedDefinitions) => ConfirmedDefinitions) => {
      setConfirmed((prev) => {
        const next = update(prev[datasetId] ?? EMPTY_CONFIRMED)
        saveConfirmed(datasetId, next)
        return { ...prev, [datasetId]: next }
      })
    },
    [],
  )

  const stateFor = (dataset: Dataset): InterpretationState =>
    interpretations[suggestionKey(dataset)] ?? IDLE

  const resolve = (dataset: Dataset): ResolvedUnderstanding =>
    resolveUnderstanding(
      dataset.fileName,
      dataset.columns,
      stateFor(dataset).suggestion?.understanding ?? null,
      confirmed[dataset.datasetId] ?? EMPTY_CONFIRMED,
      glossary,
    )

  return { restore, interpret, updateConfirmed, stateFor, resolve }
}
