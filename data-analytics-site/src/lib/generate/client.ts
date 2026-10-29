import Papa from 'papaparse'
import { postToAi, type AiOutcome } from '../ai/post'
import { parseCsv, type CsvData } from '../parseCsv'
import { checkLinks, type BaseSource } from './base'
import { PlanResultSchema, reconcilePlan, type PlanRequest, type PlanResult } from './plan'
import {
  GenerateResultSchema,
  reconcileGenerated,
  type GenerateRequest,
  type GenerateResult,
} from './schema'

/** A little longer than the server's own limit, so its error arrives before ours. */
const TIMEOUT_MS = 130_000

/** Asks the server for a fictional sample dataset. Never throws. */
export async function requestSample(
  request: GenerateRequest,
  signal?: AbortSignal,
): Promise<AiOutcome<GenerateResult>> {
  const outcome = await postToAi('/api/generate', request, GenerateResultSchema, {
    signal,
    timeoutMs: TIMEOUT_MS,
  })
  if (!outcome.ok) return outcome
  return {
    ok: true,
    result: { ...outcome.result, dataset: reconcileGenerated(outcome.result.dataset, request) },
  }
}

/**
 * Builds proper CSV text (quoting commas, quotes and line breaks) from a header and rows. For
 * files people will open in a spreadsheet, `forSpreadsheet` escapes values starting with `=` or `@`
 * so they can't run as formulas; `+`/`-` are left alone so negative numbers stay numbers.
 */
export function toCsvText(
  columns: readonly string[],
  rows: readonly (readonly string[])[],
  { forSpreadsheet = false } = {},
): string {
  const csv = Papa.unparse(
    { fields: [...columns], data: rows.map((r) => [...r]) },
    forSpreadsheet ? { escapeFormulae: /^[=@\t\r]/ } : {},
  )
  // End with the same line break Papa uses between rows, or a parser reading it back may take a
  // lone "\n" as part of the last value.
  return `${csv}\r\n`
}

/**
 * Turns a generated dataset into the same shape as an uploaded file by running real CSV text
 * through the normal parser, so it is profiled and fingerprinted exactly like an upload.
 */
export async function generatedToCsvData(
  result: GenerateResult,
  base?: { source: BaseSource; datasetId: string },
): Promise<{ data: CsvData; csv: string }> {
  const { dataset } = result
  const csv = toCsvText(dataset.columns, dataset.rows)
  const file = new File([csv], dataset.fileName, { type: 'text/csv' })
  const data = await parseCsv(file)
  return {
    csv,
    data: {
      ...data,
      generatedBy: {
        model: result.model,
        generatedAt: result.generatedAt,
        notes: dataset.notes,
        ...(base && {
          basedOn: {
            datasetId: base.datasetId,
            name: base.source.name,
            linkChecks: checkLinks(dataset, base.source),
          },
        }),
      },
    },
  }
}

/** Asks the server to plan a dataset (description, columns, rows) without making any rows. */
export async function requestPlan(
  request: PlanRequest,
  signal?: AbortSignal,
): Promise<AiOutcome<PlanResult>> {
  const outcome = await postToAi('/api/plan', request, PlanResultSchema, { signal })
  if (!outcome.ok) return outcome
  return { ok: true, result: { ...outcome.result, plan: reconcilePlan(outcome.result.plan) } }
}
