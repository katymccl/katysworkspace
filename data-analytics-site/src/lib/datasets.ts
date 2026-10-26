import type { CsvData } from './parseCsv'
import { profileDataset, type DatasetProfile } from './profiling'

export interface Dataset extends CsvData {
  id: string
  /** Computed once on upload; each dataset is profiled independently. */
  profile: DatasetProfile
}

/** What the main panel is showing. */
export type View =
  | { kind: 'home' }
  | { kind: 'upload' }
  | { kind: 'all' }
  | { kind: 'dataset'; id: string }

export function toDataset(data: CsvData): Dataset {
  return { ...data, id: crypto.randomUUID(), profile: profileDataset(data) }
}
