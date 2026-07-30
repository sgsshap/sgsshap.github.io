import { useDiyStore } from '../stage/diy'
import {
  DIY_EXPORT_PERSIST_VERSION,
  loadPersistedExportSettings,
  savePersistedExportSettings,
  type PersistedExportSettings,
} from '@/features/diy-card/utils/diyExportPersistence'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const PERSIST_DEBOUNCE_MS = 500
const VALID_PPI = new Set([150, 300, 600])
const VALID_FORMAT = new Set(['png', 'jpg'])

/**
 * 导出与预览相关参数：分辨率、图片格式、画布亮度等。
 * 亮度为画布级整体调整（预览 CSS / 导出后处理），不触发全量重载。
 */
export const useExportStore = defineStore('export', () => {
  const diyStore = useDiyStore()
  let settingsHydrated = false
  let persistTimer: ReturnType<typeof globalThis.setTimeout> | undefined

  // ==================== 分辨率与格式 ====================

  /** 导出 PPI */
  const ppi = ref(600)

  const ppiOptions = ref([
    { label: '普通 (150 PPI)', value: 150 },
    { label: '高清 (300 PPI)', value: 300 },
    { label: '超清 (600 PPI)', value: 600 },
  ])

  /** 导出文件扩展名 */
  const format = ref('png')

  const formatOptions = ref([
    { label: 'png', value: 'png', mineType: 'image/png' },
    { label: 'jpg', value: 'jpg', mineType: 'image/jpeg' },
  ])

  /** 与 format 对应的 MIME，供下载 / Blob 使用 */
  const mineType = computed(() => {
    return formatOptions.value.find((item) => item.value === format.value)?.mineType
  })

  // ==================== 画面效果 ====================

  /** 画布整体亮度（0.5–1.5） */
  const brightness = ref(1)

  /** 圆角白边预览（与出血互斥）：画布圆角 + 出血区白底遮挡，非导出留白 */
  const whiteBorder = ref(false)

  /** 仅切换圆角白边；与出血互斥时须由 UI 先走出血关闭确认（含原画重铺提示） */
  const setWhiteBorder = (flag: boolean) => {
    whiteBorder.value = flag
  }

  const buildPersistedSettings = (): PersistedExportSettings => ({
    version: DIY_EXPORT_PERSIST_VERSION,
    savedAt: Date.now(),
    ppi: ppi.value,
    format: format.value,
    brightness: brightness.value,
    whiteBorder: whiteBorder.value,
    bleedFlag: diyStore.bleedFlag,
    bleedValue: diyStore.bleedValue,
  })

  const schedulePersistSettings = () => {
    if (!settingsHydrated || typeof localStorage === 'undefined') return
    if (persistTimer) globalThis.clearTimeout(persistTimer)
    persistTimer = globalThis.setTimeout(() => {
      persistTimer = undefined
      void savePersistedExportSettings(buildPersistedSettings()).catch((error) => {
        console.warn('[diy-export] persist settings failed', error)
      })
    }, PERSIST_DEBOUNCE_MS)
  }

  const applyPersistedSettings = (saved: PersistedExportSettings) => {
    if (VALID_PPI.has(saved.ppi)) {
      ppi.value = saved.ppi
    }
    if (VALID_FORMAT.has(saved.format)) {
      format.value = saved.format
    }
    if (typeof saved.brightness === 'number' && saved.brightness >= 0.5 && saved.brightness <= 1.5) {
      brightness.value = saved.brightness
    }
    if (typeof saved.bleedValue === 'number' && saved.bleedValue > 0) {
      diyStore.bleedValue = saved.bleedValue
    }
    if (saved.whiteBorder) {
      whiteBorder.value = true
      diyStore.setBleedFlag(false)
    } else {
      whiteBorder.value = false
      diyStore.setBleedFlag(Boolean(saved.bleedFlag))
    }
  }

  const restorePersistedSettings = async () => {
    const saved = await loadPersistedExportSettings()
    if (saved) {
      applyPersistedSettings(saved)
    }
    settingsHydrated = true
  }

  void restorePersistedSettings()

  watch(
    [ppi, format, brightness, whiteBorder, () => diyStore.bleedFlag, () => diyStore.bleedValue],
    () => {
      schedulePersistSettings()
    },
  )

  return {
    ppi,
    ppiOptions,
    format,
    formatOptions,
    mineType,
    brightness,
    whiteBorder,
    setWhiteBorder,
  }
})
