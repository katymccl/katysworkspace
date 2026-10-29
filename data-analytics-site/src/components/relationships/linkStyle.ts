import type { CSSProperties } from 'react'
import type { Cardinality } from '../../lib/relationships/detect'
import type { DiagramLink } from '../../lib/relationships/merge'
import type { Verdict } from '../../lib/relationships/schema'

/**
 * How sure we are about a link: the user's decision (confirmed, or marked not related) beats
 * everything, then the AI verdict when there is one, then the value evidence.
 */
export type Confidence = 'confirmed' | 'firm' | 'tentative' | 'faint' | 'rejected'

export function linkConfidence(item: {
  verdict: Verdict | null
  confirmed: boolean
  rejected?: boolean
  strength?: DiagramLink['strength']
  source?: DiagramLink['source']
}): Confidence {
  if (item.confirmed) return 'confirmed'
  if (item.rejected) return 'rejected'
  if (item.verdict === 'likely') return 'firm'
  if (item.verdict === 'possible') return 'tentative'
  if (item.verdict === 'unlikely' || item.source === 'ai') return 'faint'
  if (item.strength === 'strong') return 'firm'
  if (item.strength === 'moderate') return 'tentative'
  return 'faint'
}

/** One hue throughout; confidence is shown by line pattern and weight, never by colour alone. */
const STYLES: Record<Confidence, { color: string; dash?: string; width: number }> = {
  confirmed: { color: '#4d4183', width: 3 },
  firm: { color: '#7960bd', width: 2 },
  tentative: { color: '#9c7feb', dash: '6 4', width: 1.75 },
  faint: { color: '#94a3b8', dash: '2 4', width: 1.5 },
  rejected: { color: '#cbd5e1', dash: '1 5', width: 1.5 },
}

export function linkStyle(
  item: Parameters<typeof linkConfidence>[0],
  selected: boolean,
): { color: string; line: CSSProperties } {
  const s = STYLES[linkConfidence(item)]
  return {
    color: s.color,
    line: {
      stroke: s.color,
      strokeWidth: selected ? s.width + 1.5 : s.width,
      ...(s.dash && { strokeDasharray: s.dash }),
    },
  }
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  confirmed: 'Thick line with ✓: confirmed by you',
  firm: 'Solid: strong evidence',
  tentative: 'Dashed: possible',
  faint: 'Dotted: weak or AI-only',
  rejected: '✕: marked not related (only shown with hidden links)',
}

/** Which ends of a link get an arrowhead: the side (or sides) where each value appears once. */
export type ArrowHeads = 'end' | 'both' | 'none'

/**
 * Heads for a link drawn from its "many" side to its "one" side. Only many → one has a direction;
 * one ↔ one points both ways and many ↔ many neither, so the order datasets were loaded in never
 * changes the picture. Links without a known cardinality (AI or drawn) get none.
 */
export function arrowHeads(cardinality: Cardinality | null): ArrowHeads {
  return cardinality === 'many-to-one' ? 'end' : cardinality === 'one-to-one' ? 'both' : 'none'
}

export function cardinalityLabel(c: Cardinality): string {
  return c === 'many-to-one' ? 'many → one' : c === 'one-to-one' ? 'one ↔ one' : 'many ↔ many'
}
