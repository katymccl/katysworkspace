/**
 * sema's IndexedDB database: workspaces, their datasets (rows included) and Ask your data history,
 * kept in this browser. localStorage holds the small things (descriptions, decisions); this holds
 * what's too big for it.
 *
 * IndexedDB can be missing or blocked (some private windows, blocked site data), so every call
 * resolves rather than throws: reads give empty results and writes report false. The app then
 * keeps working in memory.
 */

const DB_NAME = 'sema'
const VERSION = 1

export const STORES = {
  workspaces: 'workspaces',
  datasets: 'datasets',
  askHistory: 'askHistory',
} as const
export type StoreName = (typeof STORES)[keyof typeof STORES]

let opening: Promise<IDBDatabase | null> | null = null

/** The open database, or null when IndexedDB isn't available. Opened once and shared. */
export function openDb(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const request = indexedDB.open(DB_NAME, VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORES.workspaces)) {
          db.createObjectStore(STORES.workspaces, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.datasets)) {
          const datasets = db.createObjectStore(STORES.datasets, { keyPath: 'id' })
          datasets.createIndex('workspaceId', 'workspaceId')
        }
        if (!db.objectStoreNames.contains(STORES.askHistory)) {
          db.createObjectStore(STORES.askHistory, { keyPath: 'workspaceId' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

/** Forgets the shared connection, so the next call opens afresh (for tests). */
export function resetDbConnection(): void {
  opening = null
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => { readonly result: unknown },
  fallback: T,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve) => {
        if (!db) return resolve(fallback)
        try {
          const tx = db.transaction(store, mode)
          const request = work(tx.objectStore(store))
          // Writes count once the transaction commits, not when the request succeeds.
          tx.oncomplete = () => resolve(request.result as T)
          tx.onerror = () => resolve(fallback)
          tx.onabort = () => resolve(fallback)
        } catch {
          resolve(fallback)
        }
      }),
  )
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return run<T[]>(store, 'readonly', (s) => s.getAll(), [])
}

export function getAllByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
  return run<T[]>(store, 'readonly', (s) => s.index(index).getAll(value), [])
}

export function getOne<T>(store: StoreName, key: IDBValidKey): Promise<T | null> {
  return run<T | null>(store, 'readonly', (s) => s.get(key), null).then(
    (v) => v ?? null,
  )
}

/** Saves a record (replacing one with the same key). Resolves false if it couldn't be saved. */
export function put(store: StoreName, value: unknown): Promise<boolean> {
  return run<IDBValidKey | false>(store, 'readwrite', (s) => s.put(value), false).then(
    (key) => key !== false,
  )
}

export function remove(store: StoreName, key: IDBValidKey): Promise<boolean> {
  // A successful delete has no result, so count anything but the failure value as done.
  return run<undefined | false>(store, 'readwrite', (s) => s.delete(key), false).then(
    (r) => r !== false,
  )
}
