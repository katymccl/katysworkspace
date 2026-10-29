/**
 * Combines value-based candidates, the AI's judgement and the user's confirmations into what the
 * diagram and list show. Pure. Without an AI analysis, every candidate is shown on its value
 * evidence alone; confirmations always win.
 */
import { isConfirmed, relationshipId, type ConfirmedRelationship } from './confirmed'
import type {
  Cardinality,
  ColumnRef,
  KeyLinkCandidate,
  RelationshipCandidate,
  SimilarStructureCandidate,
  Strength,
} from './detect'
import type { RelationshipAnalysis, Verdict } from './schema'

export interface DiagramLink {
  id: string
  from: ColumnRef
  to: ColumnRef
  /** From the values when there is evidence; null for links without value evidence. */
  cardinality: Cardinality | null
  /**
   * `values`: found in the data (maybe also judged by AI). `ai`: suggested by the AI only.
   * `user`: confirmed by the user, with no current value evidence or AI suggestion.
   */
  source: 'values' | 'ai' | 'user'
  strength: Strength | null
  evidence: KeyLinkCandidate | null
  /** The AI's judgement, when it has run. */
  verdict: Verdict | null
  description: string | null
  /** The user has confirmed this relationship. */
  confirmed: boolean
  /** The user has marked this as not a relationship. */
  rejected: boolean
}

export interface DiagramSimilarity {
  id: string
  datasets: [string, string]
  sharedColumns: string[]
  similarity: number
  /** Nearly identical column sets are strong evidence; partial overlap is moderate. */
  strength: Strength
  verdict: Verdict | null
  description: string | null
  confirmed: boolean
  rejected: boolean
}

export interface RelationshipView {
  links: DiagramLink[]
  similar: DiagramSimilarity[]
  summary: string | null
  questions: RelationshipAnalysis['questions']
}

export function mergeRelationships(
  candidates: readonly RelationshipCandidate[],
  analysis: RelationshipAnalysis | null,
  confirmed: readonly ConfirmedRelationship[] = [],
  rejected: readonly ConfirmedRelationship[] = [],
): RelationshipView {
  const linkRejected = (from: ColumnRef, to: ColumnRef) =>
    isConfirmed(rejected, { kind: 'link', from, to })
  const judged = new Map(
    (analysis?.links ?? []).filter((l) => l.candidateId).map((l) => [l.candidateId, l]),
  )
  const judgedSimilar = new Map((analysis?.similarDatasets ?? []).map((s) => [s.candidateId, s]))
  const linkConfirmed = (from: ColumnRef, to: ColumnRef) =>
    isConfirmed(confirmed, { kind: 'link', from, to })

  const links: DiagramLink[] = candidates
    .filter((c): c is KeyLinkCandidate => c.kind === 'key-link')
    .map((c) => ({
      id: c.id,
      from: c.from,
      to: c.to,
      cardinality: c.cardinality,
      source: 'values',
      strength: c.strength,
      evidence: c,
      verdict: judged.get(c.id)?.verdict ?? null,
      description: judged.get(c.id)?.description ?? null,
      confirmed: linkConfirmed(c.from, c.to),
      rejected: linkRejected(c.from, c.to),
    }))

  for (const l of analysis?.links ?? []) {
    if (l.candidateId) continue
    const link: ConfirmedRelationship = { kind: 'link', from: l.from, to: l.to }
    if (links.some((existing) => sameLink(existing, link))) continue
    links.push({
      id: relationshipId(link),
      from: l.from,
      to: l.to,
      cardinality: null,
      source: 'ai',
      strength: null,
      evidence: null,
      verdict: l.verdict,
      description: l.description,
      confirmed: linkConfirmed(l.from, l.to),
      rejected: linkRejected(l.from, l.to),
    })
  }

  // Confirmed links stay on the diagram even when nothing currently suggests them.
  for (const c of confirmed) {
    if (c.kind !== 'link' || links.some((l) => sameLink(l, c))) continue
    links.push({
      id: relationshipId(c),
      from: c.from,
      to: c.to,
      cardinality: null,
      source: 'user',
      strength: null,
      evidence: null,
      verdict: null,
      description: null,
      confirmed: true,
      rejected: false,
    })
  }

  const similar: DiagramSimilarity[] = candidates
    .filter((c): c is SimilarStructureCandidate => c.kind === 'similar-structure')
    .map((c) => ({
      id: c.id,
      datasets: c.datasets,
      sharedColumns: c.sharedColumns,
      similarity: c.similarity,
      strength: c.similarity >= 0.9 ? 'strong' : 'moderate',
      verdict: judgedSimilar.get(c.id)?.verdict ?? null,
      description: judgedSimilar.get(c.id)?.description ?? null,
      confirmed: isConfirmed(confirmed, { kind: 'similar', datasets: c.datasets }),
      rejected: isConfirmed(rejected, { kind: 'similar', datasets: c.datasets }),
    }))

  return {
    links,
    similar,
    summary: analysis?.summary ?? null,
    questions: analysis?.questions ?? [],
  }
}

/** Whether two links join the same pair of columns, in either direction. */
function sameLink(a: { from: ColumnRef; to: ColumnRef }, b: { from: ColumnRef; to: ColumnRef }) {
  return isConfirmed([{ kind: 'link', from: a.from, to: a.to }], {
    kind: 'link',
    from: b.from,
    to: b.to,
  })
}

/**
 * Shown by default: confirmed relationships always; otherwise everything except what the user
 * marked "not related" or the AI judged unlikely.
 */
export function isShown(item: {
  verdict: Verdict | null
  confirmed: boolean
  rejected: boolean
}): boolean {
  if (item.confirmed) return true
  return !item.rejected && item.verdict !== 'unlikely'
}

/** The confirmation that a drawn item stands for, for toggling it. */
export function asConfirmation(item: DiagramLink | DiagramSimilarity): ConfirmedRelationship {
  return 'datasets' in item
    ? { kind: 'similar', datasets: item.datasets }
    : { kind: 'link', from: item.from, to: item.to }
}
