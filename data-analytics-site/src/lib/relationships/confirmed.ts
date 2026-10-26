/**
 * Relationships the user has decided on: confirmed ("these are related") or rejected ("not
 * related"). Two separate lists, stored apart from AI judgements and keyed by datasetId and column
 * name so they survive re-uploads and new versions. Pure helpers plus guarded storage.
 */
import { z } from 'zod'
import { STORAGE_PREFIX, readStored, writeStored } from '../storage'
import { refId, type ColumnRef } from './detect'

export type ConfirmedRelationship =
  { kind: 'link'; from: ColumnRef; to: ColumnRef } | { kind: 'similar'; datasets: [string, string] }

/** The id the diagram uses for a relationship, so confirmations line up with what is drawn. */
export function relationshipId(r: ConfirmedRelationship): string {
  return r.kind === 'link'
    ? `${refId(r.from)}->${refId(r.to)}`
    : `${r.datasets[0]}~${r.datasets[1]}`
}

/**
 * Same relationship regardless of direction: a link confirmed as A→B also matches B→A, and
 * "same columns" between A and B matches B and A.
 */
function canonicalKey(r: ConfirmedRelationship): string {
  if (r.kind === 'similar') return `similar:${[...r.datasets].sort().join('~')}`
  return `link:${[refId(r.from), refId(r.to)].sort().join('<>')}`
}

export function isConfirmed(
  confirmed: readonly ConfirmedRelationship[],
  r: ConfirmedRelationship,
): boolean {
  const key = canonicalKey(r)
  return confirmed.some((c) => canonicalKey(c) === key)
}

/** Returns a new list with the relationship confirmed, or un-confirmed if it already was. */
export function toggleConfirmed(
  confirmed: readonly ConfirmedRelationship[],
  r: ConfirmedRelationship,
): ConfirmedRelationship[] {
  const key = canonicalKey(r)
  return isConfirmed(confirmed, r)
    ? confirmed.filter((c) => canonicalKey(c) !== key)
    : [...confirmed, r]
}

/** Returns a new list without the relationship (in either direction). */
export function withoutRelationship(
  list: readonly ConfirmedRelationship[],
  r: ConfirmedRelationship,
): ConfirmedRelationship[] {
  const key = canonicalKey(r)
  return list.filter((c) => canonicalKey(c) !== key)
}

/** Decisions whose datasets are open and whose columns still exist. */
export function applicableConfirmations(
  confirmed: readonly ConfirmedRelationship[],
  columnsByDataset: ReadonlyMap<string, ReadonlySet<string>>,
): ConfirmedRelationship[] {
  const has = (ref: ColumnRef) => columnsByDataset.get(ref.dataset)?.has(ref.column) ?? false
  return confirmed.filter((c) =>
    c.kind === 'link'
      ? has(c.from) && has(c.to)
      : columnsByDataset.has(c.datasets[0]) && columnsByDataset.has(c.datasets[1]),
  )
}

const ref = z.object({ dataset: z.string(), column: z.string() })
const StoredSchema = z.array(
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('link'), from: ref, to: ref }),
    z.object({ kind: z.literal('similar'), datasets: z.tuple([z.string(), z.string()]) }),
  ]),
)
const CONFIRMED_KEY = `${STORAGE_PREFIX}:relationships:confirmed`
const REJECTED_KEY = `${STORAGE_PREFIX}:relationships:rejected`

export function loadConfirmedRelationships(): ConfirmedRelationship[] {
  return readStored(CONFIRMED_KEY, StoredSchema) ?? []
}

export function saveConfirmedRelationships(confirmed: readonly ConfirmedRelationship[]): void {
  writeStored(CONFIRMED_KEY, confirmed)
}

export function loadRejectedRelationships(): ConfirmedRelationship[] {
  return readStored(REJECTED_KEY, StoredSchema) ?? []
}

export function saveRejectedRelationships(rejected: readonly ConfirmedRelationship[]): void {
  writeStored(REJECTED_KEY, rejected)
}
