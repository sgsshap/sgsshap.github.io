export const DIY_EXPORT_PERSIST_VERSION = 1
export const DIY_EXPORT_SETTINGS_STORAGE_KEY = 'shap-diy-export-settings-v1'

export interface PersistedExportSettings {
  version: typeof DIY_EXPORT_PERSIST_VERSION
  savedAt: number
  ppi: number
  format: string
  brightness: number
  whiteBorder: boolean
  bleedFlag: boolean
  bleedValue: number
}

export const savePersistedExportSettings = async (
  settings: PersistedExportSettings,
): Promise<void> => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DIY_EXPORT_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.warn('[diy-export] persist settings failed', error)
  }
}

export const loadPersistedExportSettings = async (): Promise<PersistedExportSettings | null> => {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(DIY_EXPORT_SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedExportSettings
    if (!parsed || parsed.version !== DIY_EXPORT_PERSIST_VERSION) return null
    return parsed
  } catch (error) {
    console.warn('[diy-export] load persisted settings failed', error)
    return null
  }
}
