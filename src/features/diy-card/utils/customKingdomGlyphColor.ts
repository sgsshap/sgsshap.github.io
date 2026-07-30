import {
  isCustomKingdomActive,
  hasCustomKingdomGlyphText,
  isCustomShenKingdomActive,
  isDoubleKingdomRenderActive,
  isDoubleKingdomSingleGlyphMode,
  isMasterFlagActive,
  resolveCustomKingdomColorHex,
  resolveDoubleKingdomPair,
  resolveDoubleKingdomSingleGlyphRole,
  usesShenCardLayout,
  type KingdomColorSlot,
} from '@/features/diy-card/composables/doubleKingdom'
import { MASTER_KINGDOM_GLYPH_DARK_HEX } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import { DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR, DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR_SECONDARY } from '@/features/diy-card/constants/customKingdomGlyphGradientDefaults'
import {
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS,
  DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR,
  DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR_SECONDARY,
  type OfficialKingdomGlyphColorPresetKey,
} from '@/features/diy-card/constants/customKingdomGlyphDefaults'
import type { CustomColorTextGamutKey } from '@/features/diy-card/constants/customColorPickerOptions'
import { shouldUseMasterKingdomGlyphAsset, shouldUseMasterKingdomGlyphStyle, isPresetKingdomActive } from '@/features/diy-card/composables/kingdomPreset'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { hex2rgb, hslToRgb, rgbToHsl } from '@/shared/utils/color'

/** 魏/群字 PNG 高光偏亮，图片着色略压暗并提高饱和 */
const GLYPH_IMAGE_TINT_TUNED_ASSET_KEYS = new Set<OfficialKingdomGlyphColorPresetKey>([
  'wei',
  'qun',
])
const GLYPH_IMAGE_TINT_LIGHTNESS_MUL = 0.92
const GLYPH_IMAGE_TINT_SATURATION_MUL = 1.45
const GLYPH_IMAGE_TINT_MIN_SATURATION = 0.14
const GLYPH_IMAGE_TINT_MAX_SATURATION = 0.8

const applyKingdomGlyphImageTintTune = (
  rgb: { red: number; green: number; blue: number },
  assetKey: string | undefined,
) => {
  if (!assetKey || !GLYPH_IMAGE_TINT_TUNED_ASSET_KEYS.has(assetKey as OfficialKingdomGlyphColorPresetKey)) {
    return rgb
  }
  const hsl = rgbToHsl(rgb.red, rgb.green, rgb.blue)
  const sat = Math.min(
    GLYPH_IMAGE_TINT_MAX_SATURATION,
    Math.max(GLYPH_IMAGE_TINT_MIN_SATURATION, hsl.s * GLYPH_IMAGE_TINT_SATURATION_MUL),
  )
  const lightness = Math.min(0.98, Math.max(0.02, hsl.l * GLYPH_IMAGE_TINT_LIGHTNESS_MUL))
  return hslToRgb(hsl.h, sat, lightness)
}

const OFFICIAL_GLYPH_PRESET_BY_KEY = Object.fromEntries(
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS.map((item) => [item.key, item.color]),
) as Record<OfficialKingdomGlyphColorPresetKey, string>

const normalizeGlyphHex = (hex: string) => {
  const trimmed = hex.trim().toUpperCase()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

const readGlyphColorHex = (value: unknown, fallback: string) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || fallback
}

/** 是否启用势力字单独变色（与「自定义势力」内的势力色无关；主公打开时不生效） */
export const isCustomKingdomGlyphColorActive = (info: LegendInfo) =>
  Boolean(info.renderConfig.items.kingdom.glyphColorFlag) && !isMasterFlagActive(info)

/** 非神势力字渐变：神势力 / 神框 / 主公不适用；扩展预设官方 PNG 字可用 */
export const isKingdomGlyphOfficialGradientEligible = (info: LegendInfo) => {
  if (isMasterFlagActive(info)) return false
  if (usesShenCardLayout(info)) return false
  if (info.baseInfo.kingdom === 'shen' || isCustomShenKingdomActive(info)) return false
  return true
}

/** 详细设置「势力字渐变」是否生效（须先开启势力字自定义颜色） */
export const isKingdomGlyphOfficialGradientActive = (info: LegendInfo) =>
  Boolean(info.renderConfig.items.kingdom.glyphGradientFlag) &&
  isCustomKingdomGlyphColorActive(info) &&
  isKingdomGlyphOfficialGradientEligible(info)

/** 势力字渐变终点色 hex（按槽位：双势力左右各一） */
export const resolveKingdomGlyphGradientEndColorHex = (
  info: LegendInfo,
  slot: KingdomColorSlot = 'single',
): string => {
  const kingdom = info.renderConfig.items.kingdom
  if (isDoubleKingdomRenderActive(info)) {
    if (isDoubleKingdomSingleGlyphMode(info)) {
      const role = resolveDoubleKingdomSingleGlyphRole(info)
      if (role === 'secondary') {
        return readGlyphColorHex(
          kingdom.glyphGradientEndColorSecondary,
          DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR_SECONDARY,
        )
      }
      return readGlyphColorHex(
        kingdom.glyphGradientEndColorPrimary || kingdom.glyphGradientEndColor,
        DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR,
      )
    }
    if (slot === 'secondary') {
      return readGlyphColorHex(
        kingdom.glyphGradientEndColorSecondary,
        DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR_SECONDARY,
      )
    }
    return readGlyphColorHex(
      kingdom.glyphGradientEndColorPrimary || kingdom.glyphGradientEndColor,
      DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR,
    )
  }
  return readGlyphColorHex(
    kingdom.glyphGradientEndColor,
    DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR,
  )
}

/** Layer1+2 桥接色：势力字自定义色 > 自定义势力色 > 官方势力色 */
export const resolveKingdomGlyphLayer12BridgeHex = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): string | undefined => resolveKingdomGlyphTextColorHex(info, slot)

/** 图片 Layer1+2 是否走 CUSTOM_KINGDOM_GLYPH_FILL_STOPS 叠色（自定义势力字色 / 仅改色） */
export const shouldApplyKingdomGlyphLayer12Tone = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): boolean => {
  if (isCustomKingdomGlyphColorActive(info)) return true
  if (
    isCustomKingdomActive(info) &&
    !hasCustomKingdomGlyphText(info) &&
    resolveCustomKingdomColorHex(info, slot)
  ) {
    return true
  }
  return false
}

/**
 * 三层渐变 Layer1+2 是否按 alpha 遮罩填色（纯黑/灰字模）。
 * 官方魏蜀吴群晋彩色 PNG 须保留原图明度纹理，不可走遮罩否则边缘发糊。
 */
export const shouldUseAlphaMaskKingdomGlyphLayer12 = (info: LegendInfo): boolean =>
  isPresetKingdomActive(info) ||
  (isCustomKingdomActive(info) && hasCustomKingdomGlyphText(info))

/** 渐变起点：当前槽位官方势力色（Layer3 过渡用） */
export const resolveOfficialKingdomGlyphGradientStartHex = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): string | undefined => {
  const fromSlot = resolveOfficialKingdomGlyphColorForSlot(info, slot)
  if (fromSlot) return fromSlot
  if (hasCustomKingdomGlyphText(info)) {
    const kingdom = info.baseInfo.kingdom?.trim()
    if (kingdom && kingdom !== 'shen') {
      return resolveOfficialKingdomGlyphPresetColor(kingdom)
    }
  }
  return undefined
}

/** 势力字单独变色 hex（双势力：primary=左、secondary=右） */
export const resolveCustomKingdomGlyphColorHex = (
  info: LegendInfo,
  slot: KingdomColorSlot = 'single',
): string | undefined => {
  if (!isCustomKingdomGlyphColorActive(info)) return undefined
  const kingdom = info.renderConfig.items.kingdom
  if (isDoubleKingdomRenderActive(info)) {
    if (isDoubleKingdomSingleGlyphMode(info)) {
      const role = resolveDoubleKingdomSingleGlyphRole(info)
      if (role === 'secondary') {
        return readGlyphColorHex(
          kingdom.glyphColorSecondary,
          DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR_SECONDARY,
        )
      }
      return readGlyphColorHex(
        kingdom.glyphColorPrimary || kingdom.glyphColor,
        DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR,
      )
    }
    if (slot === 'secondary') {
      return readGlyphColorHex(
        kingdom.glyphColorSecondary,
        DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR_SECONDARY,
      )
    }
    return readGlyphColorHex(
      kingdom.glyphColorPrimary || kingdom.glyphColor,
      DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR,
    )
  }
  return readGlyphColorHex(kingdom.glyphColor, DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR)
}

/** 解析为 Konva 滤镜 RGB 分量 */
export const resolveCustomKingdomGlyphColorRgb = (
  info: LegendInfo,
  slot: KingdomColorSlot = 'single',
) => {
  const hex = resolveCustomKingdomGlyphColorHex(info, slot)
  return hex ? hex2rgb(hex) : undefined
}

/** 势力字 PNG 着色 RGB（魏/群等素材按 GLYPH_IMAGE_TINT_* 微调） */
export const resolveKingdomGlyphImageTintRgb = (
  info: LegendInfo,
  slot: KingdomColorSlot = 'single',
  assetKeyOverride?: string,
) => {
  if (shouldUseMasterKingdomGlyphAsset(info)) {
    return undefined
  }
  let hex = resolveCustomKingdomGlyphColorHex(info, slot)
  // 自定义势力色 + 官方 PNG 字：复用势力字自定义色管线（kingdomGlyph 色域 + 魏/群压暗）
  if (!hex && isCustomKingdomActive(info) && !hasCustomKingdomGlyphText(info)) {
    hex = resolveCustomKingdomColorHex(info, slot)
  }
  if (!hex) return undefined
  const rgb = hex2rgb(hex)
  if (!rgb) return undefined
  const assetKey =
    assetKeyOverride ?? resolveKingdomGlyphPresetAssetKey(info, slot)
  return applyKingdomGlyphImageTintTune(rgb, assetKey)
}

/** 当前势力选择签名（单势力 / 双势力 / 主公），用于画布 remount */
export const resolveKingdomSelectionSignature = (info: LegendInfo): string => {
  if (isDoubleKingdomRenderActive(info)) {
    const pair = resolveDoubleKingdomPair(info)
    if (!pair) return 'dual:'
    if (isDoubleKingdomSingleGlyphMode(info)) {
      return `dual:${pair.primary}+${pair.secondary}:1g:${resolveDoubleKingdomSingleGlyphRole(info)}`
    }
    return `dual:${pair.primary}+${pair.secondary}`
  }
  const master = isMasterFlagActive(info) ? ':master' : ''
  return `${info.baseInfo.kingdom ?? ''}${master}`
}

/**
 * 预设势力字 PNG 对应的素材 key（自定义势力文字模式返回 undefined）
 */
export const resolveKingdomGlyphPresetAssetKey = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): string | undefined => {
  if (isDoubleKingdomRenderActive(info)) {
    const pair = resolveDoubleKingdomPair(info)
    if (!pair) return undefined
    if (isDoubleKingdomSingleGlyphMode(info)) {
      const role = resolveDoubleKingdomSingleGlyphRole(info)
      return role === 'secondary' ? pair.secondary : pair.primary
    }
    return slot === 'secondary' ? pair.secondary : pair.primary
  }

  if (isCustomKingdomActive(info) && hasCustomKingdomGlyphText(info)) return undefined

  const kingdom = info.baseInfo.kingdom?.trim()
  return kingdom || undefined
}

/** 官方预设表中某势力的代表色 */
export const resolveOfficialKingdomGlyphPresetColor = (kingdomAssetKey: string) =>
  OFFICIAL_GLYPH_PRESET_BY_KEY[kingdomAssetKey as OfficialKingdomGlyphColorPresetKey]

/** 当前槽位对应的官方势力字色（CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS） */
export const resolveOfficialKingdomGlyphColorForSlot = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): string | undefined => {
  const assetKey = resolveKingdomGlyphPresetAssetKey(info, slot)
  if (!assetKey) return undefined
  return resolveOfficialKingdomGlyphPresetColor(assetKey)
}

/**
 * 所选颜色与当前势力官方预设一致时，保留原 PNG/白字，不叠 kingdomFrameTint
 * （原图已烘焙发光渐变，滤镜只适合灰阶/自定义势力底图再着色）
 */
export const shouldPreserveOriginalKingdomGlyphAsset = (
  info: LegendInfo,
  slot: KingdomColorSlot,
  assetKeyOverride?: string,
): boolean => {
  // 主公 + 官方势力字 PNG：直接使用 *_master.png，不再叠着色滤镜
  if (shouldUseMasterKingdomGlyphAsset(info)) {
    return true
  }
  if (isKingdomGlyphOfficialGradientActive(info)) {
    return false
  }
  // 势力字自定义颜色：始终走着色管线，切势力时须换字模 PNG，不可因与官方色相同而跳过
  if (isCustomKingdomGlyphColorActive(info)) {
    return false
  }
  const glyphHex = resolveCustomKingdomGlyphColorHex(info, slot)
  const assetKey = assetKeyOverride ?? resolveKingdomGlyphPresetAssetKey(info, slot)
  if (!glyphHex || !assetKey) return false
  const official = resolveOfficialKingdomGlyphPresetColor(assetKey)
  if (!official) return false
  return normalizeGlyphHex(glyphHex) === normalizeGlyphHex(official)
}

/**
 * 势力字文本渐变 / 叠层用色（优先级）：
 * 1. 势力字 → 自定义颜色
 * 2. 武将势力 → 自定义势力色（须开启自定义势力）
 * 3. 当前势力官方预设色（CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS）
 */
export const resolveKingdomGlyphTextColorHex = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): string | undefined => {
  if (shouldUseMasterKingdomGlyphStyle(info)) {
    return MASTER_KINGDOM_GLYPH_DARK_HEX
  }

  const glyphHex = resolveCustomKingdomGlyphColorHex(info, slot)
  if (glyphHex) return glyphHex

  if (isCustomKingdomActive(info)) {
    const customKingdomHex = resolveCustomKingdomColorHex(info, slot)
    if (customKingdomHex) return customKingdomHex
  }

  return resolveOfficialKingdomGlyphColorForSlot(info, slot)
}

/** 势力字文本叠层色域：自定义字色走 kingdomGlyph，自定义势力色走 kingdomCustom */
export const resolveKingdomGlyphTextGamutKey = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): CustomColorTextGamutKey => {
  if (shouldUseMasterKingdomGlyphStyle(info)) {
    return 'kingdomCustom'
  }
  if (isCustomKingdomGlyphColorActive(info)) {
    return 'kingdomGlyph'
  }
  if (isCustomKingdomActive(info) && resolveCustomKingdomColorHex(info, slot)) {
    return 'kingdomCustom'
  }
  return 'kingdomGlyph'
}
