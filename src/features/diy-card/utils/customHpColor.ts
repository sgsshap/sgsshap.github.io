import {
  isDoubleKingdomRenderActive,
  resolveDoubleKingdomPair,
  type KingdomColorSlot,
} from '@/features/diy-card/composables/doubleKingdom'
import {
  CUSTOM_HP_OFFICIAL_COLOR_PRESETS,
  DEFAULT_CUSTOM_HP_COLOR,
  DEFAULT_CUSTOM_HP_COLOR_SECONDARY,
  type OfficialHpColorPresetKey,
} from '@/features/diy-card/constants/customHpDefaults'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { hex2rgb } from '@/shared/utils/color'

const OFFICIAL_HP_PRESET_BY_KEY = Object.fromEntries(
  CUSTOM_HP_OFFICIAL_COLOR_PRESETS.map((item) => [item.key, item.color]),
) as Record<OfficialHpColorPresetKey, string>

const normalizeHpHex = (hex: string) => {
  const trimmed = hex.trim().toUpperCase()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

/** 是否启用独立自定义体力着色（与势力色无关） */
export const isCustomHpColorActive = (info: LegendInfo) =>
  Boolean(info.renderConfig.items.hp.customColorFlag)

const readHpColorHex = (value: unknown, fallback: string) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || fallback
}

/** 解析自定义体力色 hex（双势力：primary=full、secondary=half） */
export const resolveCustomHpColorHex = (
  info: LegendInfo,
  slot: KingdomColorSlot = 'single',
): string | undefined => {
  if (!isCustomHpColorActive(info)) return undefined
  const hp = info.renderConfig.items.hp
  if (isDoubleKingdomRenderActive(info)) {
    if (slot === 'secondary') {
      return readHpColorHex(hp.customColorSecondary, DEFAULT_CUSTOM_HP_COLOR_SECONDARY)
    }
    return readHpColorHex(
      hp.customColorPrimary || hp.customColor,
      DEFAULT_CUSTOM_HP_COLOR,
    )
  }
  return readHpColorHex(hp.customColor, DEFAULT_CUSTOM_HP_COLOR)
}

/** 解析为 Konva 滤镜 RGB 分量 */
export const resolveCustomHpColorRgb = (info: LegendInfo, slot: KingdomColorSlot = 'single') => {
  const hex = resolveCustomHpColorHex(info, slot)
  return hex ? hex2rgb(hex) : undefined
}

/** 官方预设表中某势力的代表色 */
export const resolveOfficialHpPresetColor = (kingdomAssetKey: string) =>
  OFFICIAL_HP_PRESET_BY_KEY[kingdomAssetKey as OfficialHpColorPresetKey]

/**
 * 自定义体力着色时，当前槽位对应的势力素材 key（用于与官方色比对）
 */
export const resolveHpPresetAssetKey = (
  info: LegendInfo,
  slot: KingdomColorSlot,
  actualKingdom?: string,
): string | undefined => {
  if (isDoubleKingdomRenderActive(info)) {
    const pair = resolveDoubleKingdomPair(info)
    if (!pair) return undefined
    return slot === 'secondary' ? pair.secondary : pair.primary
  }
  const kingdom = actualKingdom ?? info.baseInfo.kingdom?.trim()
  return kingdom || undefined
}

/** 当前槽位对应的官方体力色（CUSTOM_HP_OFFICIAL_COLOR_PRESETS） */
export const resolveOfficialHpColorForSlot = (
  info: LegendInfo,
  slot: KingdomColorSlot,
  actualKingdom?: string,
): string | undefined => {
  const assetKey = resolveHpPresetAssetKey(info, slot, actualKingdom)
  if (!assetKey) return undefined
  return resolveOfficialHpPresetColor(assetKey)
}

/**
 * 所选颜色与当前势力官方预设一致时，保留原 PNG，不叠 kingdomFrameTint
 */
export const shouldPreserveOriginalHpAsset = (
  info: LegendInfo,
  slot: KingdomColorSlot,
  actualKingdom?: string,
): boolean => {
  const hpHex = resolveCustomHpColorHex(info, slot)
  const assetKey = resolveHpPresetAssetKey(info, slot, actualKingdom)
  if (!hpHex || !assetKey) return false
  const official = resolveOfficialHpPresetColor(assetKey)
  if (!official) return false
  return normalizeHpHex(hpHex) === normalizeHpHex(official)
}

/** 双势力 + 自定义体力色：full / half 分档着色 */
export const resolveCustomHpTintTierFilters = (
  info: LegendInfo,
  buildTierFilters: (rgb: { red: number; green: number; blue: number }) => Record<string, unknown>,
  getBaseFilters: () => Record<string, unknown>,
) => {
  if (!isCustomHpColorActive(info)) return null
  if (isDoubleKingdomRenderActive(info)) {
    const fullPreserve = shouldPreserveOriginalHpAsset(info, 'primary')
    const halfPreserve = shouldPreserveOriginalHpAsset(info, 'secondary')
    return {
      full: fullPreserve
        ? getBaseFilters()
        : buildTierFilters(resolveCustomHpColorRgb(info, 'primary')!),
      half: halfPreserve
        ? getBaseFilters()
        : buildTierFilters(resolveCustomHpColorRgb(info, 'secondary')!),
    }
  }
  if (shouldPreserveOriginalHpAsset(info, 'single')) {
    const base = getBaseFilters()
    return { full: base, half: base }
  }
  const filters = buildTierFilters(resolveCustomHpColorRgb(info, 'single')!)
  return { full: filters, half: filters }
}
