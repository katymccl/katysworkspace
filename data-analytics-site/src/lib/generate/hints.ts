import type { DatasetProfile } from '../profiling'
import { headerWords, idEntity, isKeyColumn } from '../profiling/identifiers'

/** Example text for the generator's empty fields, made from the base dataset's own columns. */
export interface BaseHints {
  description: string
  columns: string
}

/**
 * Suggests what a related dataset could list, from things the base refers to: an ID column whose
 * values repeat (`customer_id` in orders → customers), else a repeated label column (`Region` →
 * regions). Falls back to a neutral example. Pure.
 */
export function baseHints(name: string, profile: DatasetProfile): BaseHints {
  const ref = referencedThing(profile)
  if (!ref) {
    return {
      description: `e.g. Details about the things listed in ${name}`,
      columns: 'name\ncategory\namount: 1 to 100',
    }
  }
  return {
    description: `e.g. One row per ${ref.entity} in ${name}, with a few details about each`,
    columns: `${ref.column}\nname\nstarted_year: 2010 to 2024`,
  }
}

function referencedThing(profile: DatasetProfile): { column: string; entity: string } | null {
  const usable = profile.columns.filter((c) => c.nonMissingCount > 0)

  // A repeating ID points at something described elsewhere; a unique one names this file's rows.
  for (const c of usable) {
    const entity = idEntity(c.name)
    if (entity && !c.isUnique) return { column: c.name, entity }
  }

  const label = usable.find(
    (c) =>
      c.inferredType === 'string' &&
      !isKeyColumn(c) &&
      c.distinctCount >= 2 &&
      c.distinctCount <= c.nonMissingCount / 2,
  )
  if (label) return { column: label.name, entity: headerWords(label.name).join(' ') }
  return null
}
