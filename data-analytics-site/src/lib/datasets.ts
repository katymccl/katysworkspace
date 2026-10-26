import type { CsvData } from './parseCsv'

export interface Dataset extends CsvData {
  id: string
}

/** What the main panel is showing. */
export type View = { kind: 'upload' } | { kind: 'all' } | { kind: 'dataset'; id: string }

export function toDataset(data: CsvData): Dataset {
  return { ...data, id: crypto.randomUUID() }
}
