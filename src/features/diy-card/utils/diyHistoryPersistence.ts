import {
  DIY_HISTORY_STORAGE_VERSION,
  invalidateHistoryStorageCache,
  readHistoryStorage,
  wipeHistoryStorage,
  writeHistoryStorage,
  type PersistedHistoryStack,
  type PersistedHistoryState,
} from '@/features/diy-card/utils/diyHistoryStorage'

export const DIY_HISTORY_PERSIST_VERSION = DIY_HISTORY_STORAGE_VERSION

export type { PersistedHistoryStack, PersistedHistoryState }

export const invalidatePersistedHistorySessionCache = invalidateHistoryStorageCache

export const loadPersistedHistoryState = readHistoryStorage

export const savePersistedHistoryState = async (state: PersistedHistoryState): Promise<boolean> => {
  return writeHistoryStorage(state)
}

export const clearPersistedHistoryState = wipeHistoryStorage
