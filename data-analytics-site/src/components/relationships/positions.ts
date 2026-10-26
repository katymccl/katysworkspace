import { z } from 'zod'
import { STORAGE_PREFIX, readStored, writeStored } from '../../lib/storage'

/**
 * Where the user has dragged diagram boxes, saved per set of open dataset versions (the
 * relationships workspace key), so a rearranged diagram stays rearranged.
 */
export type Positions = Record<string, { x: number; y: number }>

const Schema = z.object({
  layoutKey: z.string(),
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
})

const storageKey = (layoutKey: string) => `${STORAGE_PREFIX}:diagram-positions:${hash(layoutKey)}`

export function loadPositions(layoutKey: string): Positions {
  const record = readStored(storageKey(layoutKey), Schema)
  return record && record.layoutKey === layoutKey ? record.positions : {}
}

export function savePositions(layoutKey: string, positions: Positions): void {
  writeStored(storageKey(layoutKey), { layoutKey, positions })
}

function hash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16)
}
