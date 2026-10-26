import type { MatchReason } from './identity'
import type { CsvData } from './parseCsv'
import { profileDataset, type DatasetProfile } from './profiling'

export interface Dataset extends CsvData {
  /** Identifies this open copy in the app (two uploads of one file get different ids). */
  id: string
  /** Stable identity across uploads; definitions and AI suggestions are stored against it. */
  datasetId: string
  /** How this upload was matched to datasetId. */
  matchedBy: MatchReason
  /** Computed once on upload; each dataset is profiled independently. */
  profile: DatasetProfile
}

/** What the main panel is showing. */
export type View =
  | { kind: 'home' }
  /** baseId: an open dataset to pre-select as the base for generating a related one. */
  | { kind: 'upload'; baseId?: string }
  | { kind: 'all' }
  | { kind: 'dataset'; id: string }

export function toDataset(
  data: CsvData,
  identity: { datasetId: string; matchedBy: MatchReason },
): Dataset {
  return { ...data, ...identity, id: crypto.randomUUID(), profile: profileDataset(data) }
}
