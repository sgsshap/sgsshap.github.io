import {
  isPackageTextBadgeKind,
  resolvePackageTextBadgeDefaultColor,
  resolvePackageTextBadgeDefaultColorEnd,
  resolvePackageTextBadgeTextDefaults,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/package'
import { scheduleCanvasVisualSettled } from '@/features/diy-card/composables/preview/canvasVisualSettled'
import { useDiyHistoryStore, useDiyStore } from '@/features/diy-card/stores'
import {
  createDefaultPackageIdentify,
  isPackageIdentifyActive,
} from '@/features/diy-card/types/diy/packageIdentify'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  recordModify,
  type RecordModifyOptions,
} from '@/features/diy-card/utils/diyHistoryField'
import { scheduleAfterUiPaint } from '@/shared/utils/scheduling'

/**
 * 恢复/导入快照后补全角标字段（兼容旧进度无 customColorEnd、packageIdentify 缺字段）。
 */
export const normalizeLegendPackageFields = (info: LegendInfo) => {
  if (!info.baseInfo.packageIdentify) {
    info.baseInfo.packageIdentify = createDefaultPackageIdentify()
  }

  const identify = info.baseInfo.packageIdentify
  const name = identify.name

  if (isPackageTextBadgeKind(name)) {
    const defaults = resolvePackageTextBadgeTextDefaults(name)
    identify.textFlag = true
    identify.maxLength = defaults.maxLength
    if (!identify.text?.trim()) {
      identify.text = defaults.defaultText
    }
  }

  const pkg = info.renderConfig?.items?.package
  if (!pkg) return

  if (isPackageTextBadgeKind(name)) {
    if (!pkg.customColor?.trim()) {
      pkg.customColor = resolvePackageTextBadgeDefaultColor(name)
    }
    if (!pkg.customColorEnd?.trim()) {
      pkg.customColorEnd = resolvePackageTextBadgeDefaultColorEnd(name)
    }
    return
  }

  if (!isPackageIdentifyActive(identify)) {
    pkg.customColor = resolvePackageTextBadgeDefaultColor('text_ccxh')
    pkg.customColorEnd = resolvePackageTextBadgeDefaultColorEnd('text_ccxh')
  }
}

/**
 * 角标配置变更写入操作历史。
 * force：画布 settle 可能已把当前指针快照同步为最新，避免 dedup 吞掉历史条目。
 */
export const recordPackageConfigChange = (field: string, options?: RecordModifyOptions) => {
  const historyStore = useDiyHistoryStore()
  if (historyStore.isRestoring || historyStore.isBootstrapping) return

  scheduleCanvasVisualSettled({ isCanvasLoading: () => useDiyStore().isCanvasLoading })
  scheduleAfterUiPaint(() => {
    recordModify(field, { ...options, force: true })
  })
}
