import type { DatasetProfile, IdentifierReason } from '../profiling'
import type { ConfirmedDefinitions } from './definitions'
import { OUTPUT_LIMITS, REQUEST_LIMITS, type UnderstandingRequest } from './schema'

/**
 * Builds the compact summary sent for AI interpretation from a deterministic profile, plus any
 * definitions the user has confirmed. Only profile facts and a few short sample values go out; the
 * rows themselves never leave the browser.
 */
export function buildAiInput(
  fileName: string,
  profile: DatasetProfile,
  confirmed?: ConfirmedDefinitions,
): UnderstandingRequest {
  const request: UnderstandingRequest = {
    fileName: clip(fileName, REQUEST_LIMITS.maxTextLength),
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    malformedRowCount: profile.malformedRowCount,
    columns: profile.columns.slice(0, REQUEST_LIMITS.maxColumns).map((c) => ({
      name: clip(c.name, REQUEST_LIMITS.maxTextLength),
      inferredType: c.inferredType,
      missingRatio: c.missingRatio,
      distinctCount: c.distinctCount,
      uniquenessRatio: c.uniquenessRatio,
      // A flag the user removed is not evidence worth sending.
      identifierReasons: (c.isPotentialIdentifier ? c.identifierReasons : [])
        .slice(0, REQUEST_LIMITS.maxReasonsPerColumn)
        .map((r) => clip(reasonLabel(r), REQUEST_LIMITS.maxTextLength)),
      numericStats: c.numericStats
        ? {
            min: c.numericStats.min,
            max: c.numericStats.max,
            mean: c.numericStats.mean,
            median: c.numericStats.median,
          }
        : null,
      topValues: (c.topValues ?? []).slice(0, REQUEST_LIMITS.maxValuesPerColumn).map((v) => ({
        value: clip(v.value, REQUEST_LIMITS.maxValueLength),
        count: v.count,
      })),
      sampleValues: c.sampleValues
        .slice(0, REQUEST_LIMITS.maxValuesPerColumn)
        .map((v) => clip(v, REQUEST_LIMITS.maxValueLength)),
    })),
  }
  const confirmedContext = confirmedForRequest(confirmed, profile)
  return confirmedContext ? { ...request, confirmed: confirmedContext } : request
}

/** Confirmed definitions for columns that exist in this file, clipped to limits; null if none. */
function confirmedForRequest(
  confirmed: ConfirmedDefinitions | undefined,
  profile: DatasetProfile,
): UnderstandingRequest['confirmed'] | null {
  if (!confirmed) return null
  const columns = profile.columns
    .slice(0, REQUEST_LIMITS.maxColumns)
    .map((c) => ({ name: c.name, ...confirmed.columns[c.name] }))
    .filter((c) => c.description !== undefined || c.role !== undefined)
    .map((c) => ({
      name: clip(c.name, REQUEST_LIMITS.maxTextLength),
      ...(c.description !== undefined && {
        description: clip(c.description, OUTPUT_LIMITS.columnDescription),
      }),
      ...(c.role !== undefined && { role: c.role }),
    }))
  const context = {
    ...(confirmed.name !== undefined && { name: clip(confirmed.name, OUTPUT_LIMITS.name) }),
    ...(confirmed.description !== undefined && {
      description: clip(confirmed.description, OUTPUT_LIMITS.description),
    }),
    ...(confirmed.rowMeaning !== undefined && {
      rowMeaning: clip(confirmed.rowMeaning, OUTPUT_LIMITS.rowMeaning),
    }),
    columns,
  }
  const hasAny = columns.length > 0 || Object.keys(context).length > 1
  return hasAny ? context : null
}

/** Short, model-readable form of an identifier reason, e.g. `paired-values with "Library ID"`. */
function reasonLabel(reason: IdentifierReason): string {
  switch (reason.kind) {
    case 'entity-name':
      return `entity-name for "${reason.idColumn}"`
    case 'paired-values':
      return `paired-values with "${reason.withColumn}"`
    case 'mostly-unique':
      return `mostly-unique (${reason.repeatedValueCount} values repeat)`
    default:
      return reason.kind
  }
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s
}
