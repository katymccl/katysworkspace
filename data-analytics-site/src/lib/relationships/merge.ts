/**
 * Combines Claude's analysis and the user's decisions into what the diagram and list show, with
 * the measured overlap behind each line. Pure. Only Claude's links and the user's confirmed or
 * drawn links are drawn: measurements alone never are. Confirmations always win.
 */
import { isConfirmed, relationshipId, type ConfirmedRelationship } from './confirmed'
import type {
  Cardinality,
  ColumnRef,
  KeyLinkCandidate,
  RelationshipCandidate,
  SimilarStructureCandidate,
} from './detect'
import type { RelationshipAnalysis, Verdict } from './schema'

export interface DiagramLink {
  id: string
  from: ColumnRef
  to: ColumnRef
  /** From the measured values; null when the columns share no values. */
  cardinality: Cardinality | null
  /** `ai`: listed by Claude (and maybe confirmed since). `user`: confirmed or drawn by the user. */
  source: 'ai' | 'user'
  /** How the two columns' values overlap, measured in the browser; null if a column isn't open. */
  evidence: KeyLinkCandidate | null
  /** Claude's judgement, for links it listed. */
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

/**
 * The links and similar datasets to show. `measure` gives the overlap of two columns that aren't
 * among the measured candidates (such as a link the user drew between columns sharing nothing).
 */
export function mergeRelationships(
  candidates: readonly RelationshipCandidate[],
  analysis: RelationshipAnalysis | null,
  confirmed: readonly ConfirmedRelationship[] = [],
  rejected: readonly ConfirmedRelationship[] = [],
  measure: (from: ColumnRef, to: ColumnRef) => KeyLinkCandidate | null = () => null,
): RelationshipView {
  const overlaps = candidates.filter((c): c is KeyLinkCandidate => c.kind === 'key-link')
  const evidenceFor = (from: ColumnRef, to: ColumnRef) =>
    overlaps.find((o) => sameLink(o, { from, to })) ?? measure(from, to)
  const decided = (list: readonly ConfirmedRelationship[], from: ColumnRef, to: ColumnRef) =>
    isConfirmed(list, { kind: 'link', from, to })

  const links: DiagramLink[] = []
  const add = (
    from: ColumnRef,
    to: ColumnRef,
    source: DiagramLink['source'],
    judged: { verdict: Verdict; description: string } | null,
  ) => {
    if (links.some((l) => sameLink(l, { from, to }))) return
    const evidence = evidenceFor(from, to)
    // Point the way the values do (many → one) when they say; otherwise as given.
    const [f, t] = evidence ? [evidence.from, evidence.to] : [from, to]
    links.push({
      id: evidence?.id ?? relationshipId({ kind: 'link', from: f, to: t }),
      from: f,
      to: t,
      cardinality: evidence && evidence.sharedCount > 0 ? evidence.cardinality : null,
      source,
      evidence,
      verdict: judged?.verdict ?? null,
      description: judged?.description ?? null,
      confirmed: decided(confirmed, f, t),
      rejected: decided(rejected, f, t),
    })
  }

  for (const l of analysis?.links ?? []) {
    // Claude names a candidate by id; its own from and to are kept for links without one.
    const candidate = l.candidateId ? overlaps.find((o) => o.id === l.candidateId) : undefined
    add(candidate?.from ?? l.from, candidate?.to ?? l.to, 'ai', l)
  }
  // Confirmed links stay on the diagram whatever Claude said.
  for (const c of confirmed) if (c.kind === 'link') add(c.from, c.to, 'user', null)

  const judgedSimilar = new Map((analysis?.similarDatasets ?? []).map((s) => [s.candidateId, s]))
  const similar: DiagramSimilarity[] = candidates
    .filter((c): c is SimilarStructureCandidate => c.kind === 'similar-structure')
    .map((c) => ({
      id: c.id,
      datasets: c.datasets,
      sharedColumns: c.sharedColumns,
      similarity: c.similarity,
      verdict: judgedSimilar.get(c.id)?.verdict ?? null,
      description: judgedSimilar.get(c.id)?.description ?? null,
      confirmed: isConfirmed(confirmed, { kind: 'similar', datasets: c.datasets }),
      rejected: isConfirmed(rejected, { kind: 'similar', datasets: c.datasets }),
    }))
    // Like links, similar datasets are only shown once Claude or the user has said so.
    .filter((s) => s.verdict !== null || s.confirmed || s.rejected)

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
 * marked "not related" or Claude judged unlikely.
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
/**
 * Links Ask your data may match rows along: confirmed ones, and Claude's likely or possible ones,
 * never those marked "not related".
 */
export function usableLinks(view: RelationshipView): DiagramLink[] {
  return view.links.filter(
    (l) => !l.rejected && (l.confirmed || l.verdict === 'likely' || l.verdict === 'possible'),
  )
}

export function asConfirmation(item: DiagramLink | DiagramSimilarity): ConfirmedRelationship {
  return 'datasets' in item
    ? { kind: 'similar', datasets: item.datasets }
    : { kind: 'link', from: item.from, to: item.to }
}
