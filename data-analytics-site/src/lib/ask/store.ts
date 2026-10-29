import { z } from 'zod'
import { STORAGE_PREFIX, readStored, writeStored } from '../storage'

/**
 * Claude's suggested questions, saved per set of open dataset versions so reopening the same
 * files shows them again without another call. Only the most recent few sets are kept.
 */

const KEY = `${STORAGE_PREFIX}:suggested-questions`
const KEEP = 10

const Saved = z.array(z.object({ workspace: z.string(), questions: z.array(z.string()) }))

export function loadSuggestedQuestions(workspace: string): string[] | null {
  return readStored(KEY, Saved)?.find((s) => s.workspace === workspace)?.questions ?? null
}

export function saveSuggestedQuestions(workspace: string, questions: readonly string[]): void {
  const others = (readStored(KEY, Saved) ?? []).filter((s) => s.workspace !== workspace)
  writeStored(KEY, [{ workspace, questions }, ...others].slice(0, KEEP))
}
