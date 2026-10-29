import type { ColumnProfile, IdentifierReason } from '../../lib/profiling'

export function describeReason(reason: IdentifierReason): string {
  switch (reason.kind) {
    case 'id-header':
      return 'Header names an ID'
    case 'name-header':
      return 'Header names a name'
    case 'entity-name':
      return `Names what "${reason.idColumn}" identifies`
    case 'id-like-values':
      return 'Values look like codes'
    case 'sequential-values':
      return 'Numbers count up in order'
    case 'unique-values':
      return 'Every value is present and unique'
  }
}

/** One-line explanation for a star, e.g. "Potential identifier: Header names an ID; Values look like codes". */
export function identifierLabel(column: ColumnProfile): string {
  return `Potential identifier: ${column.identifierReasons.map(describeReason).join('; ')}`
}
