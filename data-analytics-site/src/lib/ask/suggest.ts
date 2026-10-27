import type { DatasetProfile } from '../profiling'

/**
 * A few starter questions built from a dataset's columns, so a blank box isn't the only way in:
 * a count over time for date columns, a breakdown by a small category, and a total of a number.
 */
export function suggestQuestions(
  datasets: readonly { name: string; profile: DatasetProfile }[],
  max = 3,
): string[] {
  const out: string[] = []
  for (const { name, profile } of datasets) {
    const cols = profile.columns
    const date = cols.find((c) => c.inferredType === 'date')
    const category = cols.find(
      (c) =>
        (c.inferredType === 'string' || c.inferredType === 'boolean') &&
        !c.isPotentialIdentifier &&
        c.distinctCount >= 2 &&
        c.distinctCount <= 30,
    )
    const measure = cols.find(
      (c) =>
        (c.inferredType === 'decimal' || c.inferredType === 'integer') && !c.isPotentialIdentifier,
    )
    if (category) out.push(`How many rows in ${name} are there for each ${category.name}?`)
    if (measure && category) out.push(`What is the total ${measure.name} by ${category.name}?`)
    else if (measure) out.push(`What are the highest and lowest ${measure.name} in ${name}?`)
    if (date) out.push(`How many rows in ${name} are there per month, by ${date.name}?`)
  }
  return [...new Set(out)].slice(0, max)
}
