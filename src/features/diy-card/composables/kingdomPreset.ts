import { KINGDOM_DISPLAY_ORDER } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import { resolveKingdomPreset } from '@/features/diy-card/constants/kingdomPresets'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  applyCustomKingdomPresetKingdom,
  applyCustomKingdomShenKingdom,
  ensureCustomKingdomSetup,
  hasCustomKingdomGlyphText,
  isCustomKingdomActive,
  isDoubleKingdomRenderActive,
  isMasterFlagActive,
  resetCustomKingdomGlyphLayout,
} from '@/features/diy-card/composables/doubleKingdom'
import { resolveKingdomSelectionSignature } from '@/features/diy-card/utils/customKingdomGlyphColor'
import { syncFrameSrcToKingdom } from '@/features/diy-card/utils/syncFrameKingdom'

/** 是否选中扩展预设势力（与魏蜀吴群晋 PNG 隔离） */
export const isPresetKingdomActive = (info: LegendInfo) =>
  Boolean(resolveKingdomPreset(info.renderConfig.items.kingdom.presetKingdomKey ?? ''))

/** 当前生效的扩展预设势力 */
export const resolveActiveKingdomPreset = (info: LegendInfo) =>
  resolveKingdomPreset(info.renderConfig.items.kingdom.presetKingdomKey ?? '')

/**
 * 主公 + 势力字走金色渐变（覆盖势力字自定义颜色、自定义势力色 / 预设历史色）：
 * - 扩展预设 PNG
 * - 单势力自定义势力字（填写了 customText）
 */
export const shouldUseMasterKingdomGlyphStyle = (info: LegendInfo) => {
  if (!isMasterFlagActive(info)) return false
  if (isPresetKingdomActive(info)) return true
  if (isDoubleKingdomRenderActive(info)) return false
  return hasCustomKingdomGlyphText(info)
}

/** 主公 + 官方势力字 PNG（非扩展预设、无自定义字）：使用 *_master 素材原图 */
export const shouldUseMasterKingdomGlyphAsset = (info: LegendInfo) =>
  isMasterFlagActive(info) &&
  !isPresetKingdomActive(info) &&
  !hasCustomKingdomGlyphText(info)

/** 预设势力着色/remount 签名（customColor + 主公金色） */
export const resolvePresetKingdomChromeTintKey = (info: LegendInfo): string => {
  const kingdom = info.renderConfig.items.kingdom
  const presetKey = kingdom.presetKingdomKey?.trim()
  if (!presetKey) return ''
  const master = shouldUseMasterKingdomGlyphStyle(info) ? ':master' : ''
  return `${presetKey}:${kingdom.customColor?.trim() ?? ''}${master}`
}

/** frame kingdom_frame / hp 等着色 remount 签名（预设 + 自定义势力色；主公切换须含 master） */
export const resolveKingdomChromeTintKey = (info: LegendInfo): string => {
  if (isPresetKingdomActive(info)) {
    return `preset:${resolvePresetKingdomChromeTintKey(info)}`
  }
  if (!isCustomKingdomActive(info)) return ''
  const kingdom = info.renderConfig.items.kingdom
  const selectionSuffix = hasCustomKingdomGlyphText(info)
    ? ''
    : `:${resolveKingdomSelectionSignature(info)}`
  if (isDoubleKingdomRenderActive(info)) {
    return `dual:${kingdom.customColorPrimary}:${kingdom.customColorSecondary}${selectionSuffix}`
  }
  return `single:${kingdom.customColor}${selectionSuffix}`
}

/** 填写自定义势力字时清除扩展预设势力 */
export const clearPresetKingdomWhenCustomTextFilled = (info: LegendInfo): boolean => {
  const kingdom = info.renderConfig.items.kingdom
  if (!kingdom.presetKingdomKey?.trim()) return false
  if (!hasCustomKingdomGlyphText(info)) return false
  kingdom.presetKingdomKey = ''
  return true
}

export const buildPresetKingdomLayoutKey = (
  presetKey: string,
  useShenFrameLayout: boolean,
  masterFlag = false,
) => {
  const preset = resolveKingdomPreset(presetKey)
  if (!preset) {
    return `preset:${presetKey}:${useShenFrameLayout ? 'shen' : 'normal'}:${masterFlag ? 1 : 0}`
  }
  const tune = preset.layout
  return `preset:${preset.key}:${useShenFrameLayout ? 'shen' : 'normal'}:${preset.isShen ? 1 : 0}:${masterFlag ? 1 : 0}:${tune.scale}:${tune.offsetXMm}:${tune.offsetYMm}`
}

/** 应用 / 清除扩展预设势力：进入自定义势力单势力模式，仅写入势力色（不改自定义势力字） */
export const applyKingdomPresetSelection = (info: LegendInfo, key: string | null | undefined) => {
  const kingdom = info.renderConfig.items.kingdom
  const trimmed = key?.trim() ?? ''

  if (!trimmed) {
    kingdom.presetKingdomKey = ''
    ensureCustomKingdomSetup(info)
    return
  }

  const preset = resolveKingdomPreset(trimmed)
  if (!preset) {
    kingdom.presetKingdomKey = ''
    return
  }

  kingdom.presetKingdomKey = preset.key
  kingdom.customKingdomFlag = true
  kingdom.doubleKingdom = false
  kingdom.customColor = preset.color
  kingdom.glyphColorFlag = false
  kingdom.glyphGradientFlag = false

  if (preset.isShen) {
    applyCustomKingdomShenKingdom()
    resetCustomKingdomGlyphLayout(true)
  } else {
    applyCustomKingdomPresetKingdom(KINGDOM_DISPLAY_ORDER)
    resetCustomKingdomGlyphLayout(false)
  }

  ensureCustomKingdomSetup(info)
  syncFrameSrcToKingdom(info)
}
