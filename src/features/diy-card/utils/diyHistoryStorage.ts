import { mergeRuntimePersistedBinaryAssets } from '@/features/diy-card/stores/history/persistSnapshot'
import type {
  DiyHistoryEntry,
  DiyInfoKind,
} from '@/features/diy-card/types/diy/history'

/** localStorage 元数据键（DevTools → Application → Local Storage） */
export const DIY_HISTORY_META_STORAGE_KEY = 'shap-diy-history-meta-v1'
/** Cache API 桶名（DevTools → Application → Cache Storage） */
export const DIY_HISTORY_ASSET_CACHE_NAME = 'shap-diy-history-assets-v1'

export const DIY_HISTORY_STORAGE_VERSION = 4 as const

export interface PersistedHistoryStack {
  entries: DiyHistoryEntry[]
  index: number
}

export interface PersistedHistoryState {
  version: typeof DIY_HISTORY_STORAGE_VERSION
  savedAt: number
  lastActiveInfoKind?: DiyInfoKind
  binaryAssets?: Record<string, string>
  stacks: Record<DiyInfoKind, PersistedHistoryStack>
  bootstrappedKinds: Record<DiyInfoKind, boolean>
}

type LeanHistoryRecord = Omit<PersistedHistoryState, 'binaryAssets'> & {
  assetKeys: string[]
}

const isSupportedVersion = (version: unknown): version is PersistedHistoryState['version'] =>
  version === DIY_HISTORY_STORAGE_VERSION

let memoryCache: PersistedHistoryState | null = null
let ioChain: Promise<unknown> = Promise.resolve()

const runSerialized = <T>(task: () => Promise<T>): Promise<T> => {
  const next = ioChain.then(task, task)
  ioChain = next.catch(() => undefined)
  return next
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const isStorageAvailable = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const openAssetCache = async (): Promise<Cache | null> => {
  if (typeof caches === 'undefined') return null
  try {
    return await caches.open(DIY_HISTORY_ASSET_CACHE_NAME)
  } catch (error) {
    console.warn('[diy-history-storage] cache open failed', error)
    return null
  }
}

const assetCacheRequest = (key: string) =>
  new Request(`${globalThis.location.origin}/__shap-diy-asset/${encodeURIComponent(key)}`)

const readAssetsFromCache = async (assetKeys: readonly string[]) => {
  const binaryAssets: Record<string, string> = {}
  if (!assetKeys.length) return binaryAssets

  const cache = await openAssetCache()
  if (!cache) return binaryAssets

  await Promise.all(
    assetKeys.map(async (key) => {
      try {
        const response = await cache.match(assetCacheRequest(key))
        if (!response) return
        const data = await response.text()
        if (data) binaryAssets[key] = data
      } catch {
        /* 单个 asset 失败不影响整体恢复 */
      }
    }),
  )

  return binaryAssets
}

/** 尽力写入 Cache；失败仅打日志，不阻断 localStorage 元数据持久化 */
const writeAssetsToCache = async (
  assets: Record<string, string>,
  previousKeys: readonly string[],
): Promise<boolean> => {
  const cache = await openAssetCache()
  const assetEntries = Object.entries(assets)
  if (!cache) {
    if (assetEntries.length > 0) {
      console.warn('[diy-history-storage] Cache API unavailable, binary assets not cached')
    }
    return assetEntries.length === 0
  }

  const nextKeys = new Set(Object.keys(assets))
  const writeResults = await Promise.all([
    ...assetEntries.map(async ([key, data]) => {
      try {
        await cache.put(assetCacheRequest(key), new Response(data))
        return true
      } catch (error) {
        console.warn('[diy-history-storage] asset write failed', key, error)
        return false
      }
    }),
    ...previousKeys
      .filter((key) => !nextKeys.has(key))
      .map(async (key) => {
        try {
          await cache.delete(assetCacheRequest(key))
          return true
        } catch {
          return true
        }
      }),
  ])

  const failedWrites = writeResults.slice(0, assetEntries.length).filter((ok) => !ok).length
  if (failedWrites > 0) {
    console.warn(
      `[diy-history-storage] ${failedWrites} asset(s) failed to write; history meta was still saved`,
    )
    return false
  }
  return true
}

export const invalidateHistoryStorageCache = () => {
  memoryCache = null
}

export const readHistoryStorage = (): Promise<PersistedHistoryState | null> =>
  runSerialized(async () => {
    if (memoryCache && isSupportedVersion(memoryCache.version)) {
      mergeRuntimePersistedBinaryAssets(memoryCache.binaryAssets ?? {})
      return memoryCache
    }
    if (!isStorageAvailable()) return null

    try {
      const raw = localStorage.getItem(DIY_HISTORY_META_STORAGE_KEY)
      if (!raw) return null

      const lean = JSON.parse(raw) as LeanHistoryRecord
      if (!lean || !isSupportedVersion(lean.version)) return null

      const binaryAssets = await readAssetsFromCache(lean.assetKeys ?? [])
      mergeRuntimePersistedBinaryAssets(binaryAssets)
      const hydrated: PersistedHistoryState = { ...lean, binaryAssets }
      memoryCache = hydrated
      return hydrated
    } catch (error) {
      console.warn('[diy-history-storage] read failed', error)
      memoryCache = null
      return null
    }
  })

export const writeHistoryStorage = (state: PersistedHistoryState): Promise<boolean> =>
  runSerialized(async () => {
    if (!isStorageAvailable()) return false

    const assets = state.binaryAssets ?? {}
    const assetKeys = Object.keys(assets)

    let lean: LeanHistoryRecord
    try {
      lean = cloneJson({
        ...state,
        version: DIY_HISTORY_STORAGE_VERSION,
        binaryAssets: undefined,
        assetKeys,
      })
    } catch (error) {
      console.warn('[diy-history-storage] state is not JSON-serializable', error)
      return false
    }

    let previousKeys: string[] = []
    try {
      const previousRaw = localStorage.getItem(DIY_HISTORY_META_STORAGE_KEY)
      if (previousRaw) {
        const previous = JSON.parse(previousRaw) as LeanHistoryRecord
        previousKeys = previous.assetKeys ?? []
      }
    } catch {
      previousKeys = []
    }

    try {
      localStorage.setItem(DIY_HISTORY_META_STORAGE_KEY, JSON.stringify(lean))
    } catch (error) {
      console.warn('[diy-history-storage] localStorage write failed (quota?)', error)
      return false
    }

    if (assetKeys.length > 0) {
      await writeAssetsToCache(assets, previousKeys)
    } else if (previousKeys.length > 0) {
      await writeAssetsToCache({}, previousKeys)
    }

    mergeRuntimePersistedBinaryAssets(assets)
    memoryCache = { ...state, binaryAssets: assets }
    return true
  })

export const wipeHistoryStorage = (): Promise<void> =>
  runSerialized(async () => {
    memoryCache = null
    if (isStorageAvailable()) {
      try {
        localStorage.removeItem(DIY_HISTORY_META_STORAGE_KEY)
      } catch (error) {
        console.warn('[diy-history-storage] localStorage wipe failed', error)
      }
    }

    if (typeof caches !== 'undefined') {
      try {
        await caches.delete(DIY_HISTORY_ASSET_CACHE_NAME)
      } catch (error) {
        console.warn('[diy-history-storage] cache wipe failed', error)
      }
    }
  })

/** @deprecated 旧 IndexedDB 库名；启动时删除，避免 DevTools/旧代码继续触发 DatabaseClosedError */
export const LEGACY_INDEXED_DB_NAMES = [
  'shap-diy-history',
  'shap-diy-session-v1',
  'shap-diy-export-v1',
] as const

export const deleteLegacyHistoryIndexedDatabases = (): void => {
  if (typeof indexedDB === 'undefined') return
  for (const dbName of LEGACY_INDEXED_DB_NAMES) {
    try {
      indexedDB.deleteDatabase(dbName)
    } catch {
      /* ignore */
    }
  }
}

export const DIY_HISTORY_DB_NAME = 'shap-diy-session-v1'
