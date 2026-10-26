import type { z } from 'zod'

/**
 * Guarded access to this browser's localStorage. Storage can be unavailable (private windows,
 * blocked site data) or hold stale shapes, so reads validate and fall back to null, and writes
 * fail silently: the app keeps working in memory.
 */

/** Prefix for every key sema stores. v2: dataset records keep every file name. */
export const STORAGE_PREFIX = 'sema.v2'

export function readStored<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable: keep working in memory for this session.
  }
}
