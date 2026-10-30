import { postToAi, type AiOutcome } from '../ai/post'
import type { DatasetProfile } from '../profiling'
import type { ColumnRole } from '../understanding/schema'
import { OUTPUT_LIMITS, REQUEST_LIMITS } from '../understanding/schema'
import type { ConfirmedRelationship } from './confirmed'
import type { RelationshipCandidate } from './detect'
import {
  RELATIONSHIP_LIMITS,
  RelationshipResultSchema,
  reconcileAnalysis,
  type RelationshipRequest,
  type RelationshipResult,
} from './schema'

/** What the browser knows about a dataset when asking about relationships. */
export interface DatasetSummary {
  key: string
  fileName: string
  /** Display name: confirmed, else AI-suggested, else the file name. */
  name: string
  description: string | null
  rowMeaning: string | null
  profile: DatasetProfile
  /**
   * Column meanings and roles (confirmed, from the glossary, or suggested) where known, and the
   * glossary term each column follows.
   */
  columnDefinitions: ReadonlyMap<
    string,
    { description: string | null; role: ColumnRole | null; glossaryTerm?: string | null }
  >
}

/**
 * Builds the request: dataset summaries (definitions and profile basics, no rows) plus the
 * value-based candidates, whose shared examples are the only cell values sent.
 */
export function buildRelationshipRequest(
  datasets: readonly DatasetSummary[],
  candidates: readonly RelationshipCandidate[],
  confirmed: readonly ConfirmedRelationship[] = [],
  rejected: readonly ConfirmedRelationship[] = [],
): RelationshipRequest {
  const t = (s: string, max: number = REQUEST_LIMITS.maxTextLength) =>
    s.length > max ? s.slice(0, max) : s
  return {
    datasets: datasets.slice(0, RELATIONSHIP_LIMITS.maxDatasets).map((d) => ({
      key: t(d.key),
      name: t(d.name, OUTPUT_LIMITS.name),
      fileName: t(d.fileName),
      ...(d.description && { description: t(d.description, OUTPUT_LIMITS.description) }),
      ...(d.rowMeaning && { rowMeaning: t(d.rowMeaning, OUTPUT_LIMITS.rowMeaning) }),
      rowCount: d.profile.rowCount,
      columns: d.profile.columns.slice(0, REQUEST_LIMITS.maxColumns).map((c) => {
        const def = d.columnDefinitions.get(c.name)
        return {
          name: t(c.name),
          type: c.inferredType,
          ...(def?.role && { role: def.role }),
          ...(def?.glossaryTerm && { glossaryTerm: t(def.glossaryTerm) }),
          ...(def?.description && {
            description: t(def.description, OUTPUT_LIMITS.columnDescription),
          }),
          isPotentialIdentifier: c.isPotentialIdentifier,
          distinctCount: c.distinctCount,
        }
      }),
    })),
    candidates: candidates.slice(0, RELATIONSHIP_LIMITS.maxCandidates).map((c) =>
      c.kind === 'key-link'
        ? {
            ...c,
            id: t(c.id, 500),
            sharedExamples: c.sharedExamples.map((v) => t(v, REQUEST_LIMITS.maxValueLength)),
          }
        : { ...c, id: t(c.id, 500) },
    ),
    ...(confirmed.length > 0 && { confirmed: decisionsForRequest(confirmed) }),
    ...(rejected.length > 0 && { rejected: decisionsForRequest(rejected) }),
  }
}

function decisionsForRequest(list: readonly ConfirmedRelationship[]) {
  return {
    links: list
      .filter((c) => c.kind === 'link')
      .slice(0, RELATIONSHIP_LIMITS.maxConfirmed)
      .map((c) => ({ from: c.from, to: c.to })),
    similar: list
      .filter((c) => c.kind === 'similar')
      .slice(0, RELATIONSHIP_LIMITS.maxConfirmed)
      .map((c) => ({ datasets: c.datasets })),
  }
}

export async function requestRelationships(
  request: RelationshipRequest,
  signal?: AbortSignal,
): Promise<AiOutcome<RelationshipResult>> {
  const outcome = await postToAi('/api/relationships', request, RelationshipResultSchema, {
    signal,
  })
  if (!outcome.ok) return outcome
  return {
    ok: true,
    result: { ...outcome.result, analysis: reconcileAnalysis(outcome.result.analysis, request) },
  }
}

/**
 * Identifies one set of dataset versions, so a saved analysis is only reused for exactly the
 * datasets (and contents) it was made for.
 */
export function workspaceKey(datasets: readonly { datasetId: string; content: string }[]): string {
  return datasets
    .map((d) => `${d.datasetId}:${d.content}`)
    .sort()
    .join('|')
}
