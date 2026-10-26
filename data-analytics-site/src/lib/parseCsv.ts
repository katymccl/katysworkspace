import Papa from 'papaparse'

export type CsvRow = Record<string, string>

export interface CsvData {
  fileName: string
  fileSize: number
  columns: string[]
  rows: CsvRow[]
  /** Row-level problems PapaParse reported (e.g. wrong field count). */
  warnings: string[]
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

export function parseCsv(file: File): Promise<CsvData> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const columns = results.meta.fields ?? []
        if (columns.length === 0) {
          reject(new Error('The file has no header row.'))
          return
        }
        resolve({
          fileName: file.name,
          fileSize: file.size,
          columns,
          rows: results.data,
          warnings: results.errors.map((e) =>
            e.row !== undefined ? `Row ${e.row + 2}: ${e.message}` : e.message,
          ),
        })
      },
      error: (error) => reject(error),
    })
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
