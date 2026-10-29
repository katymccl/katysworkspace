import {
  Calendar,
  CircleSlash,
  Hash,
  Shuffle,
  ToggleLeft,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { InferredType } from '../../lib/profiling'

export const TYPE_META: Record<
  InferredType,
  { label: string; description: string; Icon: LucideIcon }
> = {
  integer: { label: 'Integer', description: 'Whole numbers', Icon: Hash },
  decimal: { label: 'Decimal', description: 'Numbers with decimals', Icon: Hash },
  boolean: { label: 'Boolean', description: 'True/false or yes/no values', Icon: ToggleLeft },
  date: { label: 'Date', description: 'Calendar dates or date-times', Icon: Calendar },
  string: { label: 'String', description: 'Text values', Icon: Type },
  mixed: { label: 'Mixed', description: 'Values of more than one type', Icon: Shuffle },
  empty: { label: 'Empty', description: 'Every value is missing', Icon: CircleSlash },
}

/** Order used whenever types are listed together. */
export const TYPE_ORDER: readonly InferredType[] = [
  'integer',
  'decimal',
  'boolean',
  'date',
  'string',
  'mixed',
  'empty',
]
