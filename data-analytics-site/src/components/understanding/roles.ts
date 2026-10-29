import type { ColumnRole } from '../../lib/understanding'

export const ROLE_LABELS: Record<ColumnRole, string> = {
  identifier: 'Identifier',
  name: 'Name',
  category: 'Category',
  measure: 'Measure',
  datetime: 'Date/time',
  flag: 'Yes/no flag',
  text: 'Free text',
  location: 'Location',
  contact: 'Contact',
  other: 'Other',
}
