import type { DatasetProfile } from './types'

/**
 * Applies the user's "not an identifier" choices: listed columns with identifier reasons lose the
 * flag (reasons are kept), and every other column with reasons has it. Columns are matched by name.
 * Pure; returns the same profile when nothing changes.
 */
export function withDismissedIdentifiers(
  profile: DatasetProfile,
  dismissedNames: readonly string[],
): DatasetProfile {
  const dismissed = new Set(dismissedNames)
  let changed = false
  const columns = profile.columns.map((c) => {
    const identifierDismissed = c.identifierReasons.length > 0 && dismissed.has(c.name)
    if (identifierDismissed === c.identifierDismissed) return c
    changed = true
    return { ...c, identifierDismissed, isPotentialIdentifier: !identifierDismissed }
  })
  return changed ? { ...profile, columns } : profile
}
