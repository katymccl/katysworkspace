import { toCsvText } from '../generate/client'
import { parseCsv, type CsvData, type CsvRow } from '../parseCsv'

/**
 * The cleaned rows (and columns, which splitting may change) as a new version of the dataset:
 * written out as CSV and read back through the normal parser, so it is profiled and fingerprinted
 * exactly like an uploaded file.
 */
export async function cleanedCsvData(
  original: CsvData,
  columns: readonly string[],
  rows: readonly CsvRow[],
): Promise<CsvData> {
  const csv = toCsvText(
    columns,
    rows.map((row) => columns.map((c) => row[c] ?? '')),
  )
  const data = await parseCsv(new File([csv], original.fileName, { type: 'text/csv' }))
  return {
    ...data,
    ...(original.generatedBy && { generatedBy: original.generatedBy }),
    cleanedAt: new Date().toISOString(),
  }
}
