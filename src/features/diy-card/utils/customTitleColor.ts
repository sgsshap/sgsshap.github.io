import {
  isCustomKingdomActive,
  isDoubleKingdomRenderActive,
  isShenSingleKingdomActive,
  resolveDoubleKingdomPair,
  shouldCustomShenTitleUseKingdomColor,
  type KingdomColorSlot,
} from '@/features/diy-card/composables/doubleKingdom'
import {
  CUSTOM_TITLE_OFFICIAL_COLOR_PRESETS,
  DEFAULT_CUSTOM_TITLE_COLOR,
  DEFAULT_CUSTOM_TITLE_COLOR_SECONDARY,
  type OfficialTitleColorPresetKey,
} from '@/features/diy-card/constants/customTitleDefaults'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { hex2rgb, hslToRgb, rgbToHex, rgbToHsl } from '@/shared/utils/color'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** 过暗用户色：低于此开始提亮（对齐官方称号 L≈0.44–0.59） */
const TITLE_FILL_DARK_LIFT_START = 0.28
/** 目标中段明度（魏/蜀等官方称号） */
const TITLE_FILL_LIGHTNESS_REF = 0.48
/** 过暗时明度下限，避免糊进描边 */
const TITLE_FILL_LIGHTNESS_MIN = 0.4
/** 过亮时明度软顶 */
const TITLE_FILL_LIGHTNESS_MAX = 0.62
/** 高饱和用户色（大红大黄等）略压饱和，逻辑与 frame brightDesat 同源 */
const TITLE_FILL_BRIGHT_DESAT_STRENGTH = 0.36
const TITLE_FILL_BRIGHT_DESAT_SAT_MIN = 0.8

const applyTitleBrightDesaturation = (hsl: { h: number; s: number; l: number }) => {
  if (hsl.s < TITLE_FILL_BRIGHT_DESAT_SAT_MIN) return hsl

  const vivid = clamp((hsl.s - TITLE_FILL_BRIGHT_DESAT_SAT_MIN) / (1 - TITLE_FILL_BRIGHT_DESAT_SAT_MIN), 0, 1)
  const lightBoost =
    hsl.l >= 0.38 ? clamp((hsl.l - 0.38) / 0.22, 0, 1) : 0
  const desat = TITLE_FILL_BRIGHT_DESAT_STRENGTH * vivid * (0.55 + 0.45 * lightBoost)
  return { ...hsl, s: hsl.s * (1 - desat) }
}

const resolveTitleFillLightness = (lightness: number) => {
  if (lightness < TITLE_FILL_DARK_LIFT_START) {
    const t = lightness / TITLE_FILL_DARK_LIFT_START
    return TITLE_FILL_LIGHTNESS_MIN + (TITLE_FILL_LIGHTNESS_REF - TITLE_FILL_LIGHTNESS_MIN) * t
  }
  if (lightness < TITLE_FILL_LIGHTNESS_REF) {
    const t = (lightness - TITLE_FILL_DARK_LIFT_START) / (TITLE_FILL_LIGHTNESS_REF - TITLE_FILL_DARK_LIFT_START)
    return lightness + (TITLE_FILL_LIGHTNESS_REF - lightness) * (1 - t) * 0.32
  }
  if (lightness > TITLE_FILL_LIGHTNESS_MAX) {
    const t = clamp((lightness - TITLE_FILL_LIGHTNESS_MAX) / (1 - TITLE_FILL_LIGHTNESS_MAX), 0, 1)
    return lightness - (lightness - TITLE_FILL_LIGHTNESS_MAX) * t * 0.5
  }
  return lightness
}

/**
 * 用户自选称号色减淡：过暗提亮、过艳略降饱和/明度（官方预设 TITLE_COLORS 不经过此函数）
 */
export const toneTitleFillColorHex = (hex: string | undefined): string | undefined => {
  const trimmed = hex?.trim()
  if (!trimmed) return hex

  const rgb = hex2rgb(trimmed)
  if (!rgb) return hex

  const toned = applyTitleBrightDesaturation(rgbToHsl(rgb.red, rgb.green, rgb.blue))
  const outL = clamp(resolveTitleFillLightness(toned.l), TITLE_FILL_LIGHTNESS_MIN, 0.66)
  const outS = clamp(toned.s, 0, 1)
  return rgbToHex(hslToRgb(toned.h, outS, outL))
}

/** 取色器/自定义势力色等用户自选 hex → 减淡后的称号填色 */
export const resolveTunedTitleFillColorHex = (hex: string | undefined): string | undefined =>
  toneTitleFillColorHex(hex)

const OFFICIAL_TITLE_PRESET_BY_KEY = Object.fromEntries(
  CUSTOM_TITLE_OFFICIAL_COLOR_PRESETS.map((item) => [item.key, item.color]),
) as Record<OfficialTitleColorPresetKey, string>

const readTitleColorHex = (value: unknown, fallback: string) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || fallback
}

/** 是否启用独立自定义称号颜色（与自定义势力色无关） */
export const isCustomTitleColorActive = (info: LegendInfo) =>
  Boolean(info.renderConfig.items.title.customColorFlag)

/**
 * 称号未开自定义颜色时，是否随自定义势力色渲染（与 drawTitle/getTitleFillColor 一致）
 */
export const shouldTitleUseCustomKingdomColor = (info: LegendInfo) => {
  if (isCustomTitleColorActive(info)) return false
  if (shouldCustomShenTitleUseKingdomColor(info)) return true
  if (isShenSingleKingdomActive(info) || !info.baseInfo.masterFlag) return false
  return isCustomKingdomActive(info)
}

/** 官方预设表中某势力的称号代表色 */
export const resolveOfficialTitlePresetColor = (kingdomAssetKey: string) =>
  OFFICIAL_TITLE_PRESET_BY_KEY[kingdomAssetKey as OfficialTitleColorPresetKey]

/** 自定义称号着色时，当前槽位对应的势力 key */
export const resolveTitlePresetAssetKey = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): string | undefined => {
  if (isDoubleKingdomRenderActive(info)) {
    const pair = resolveDoubleKingdomPair(info)
    if (!pair) return undefined
    return slot === 'secondary' ? pair.secondary : pair.primary
  }
  const kingdom = info.baseInfo.kingdom?.trim()
  return kingdom || undefined
}

/** 当前槽位对应的官方称号色 */
export const resolveOfficialTitleColorForSlot = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): string | undefined => {
  const assetKey = resolveTitlePresetAssetKey(info, slot)
  if (!assetKey) return undefined
  return resolveOfficialTitlePresetColor(assetKey)
}

/** 解析自定义称号色 hex（双势力：primary=势力1、secondary=势力2；渲染单文本时取 primary） */
export const resolveCustomTitleColorHex = (
  info: LegendInfo,
  slot: KingdomColorSlot = 'single',
): string | undefined => {
  if (!isCustomTitleColorActive(info)) return undefined
  const title = info.renderConfig.items.title
  if (isDoubleKingdomRenderActive(info)) {
    if (slot === 'secondary') {
      return readTitleColorHex(
        title.customColorSecondary,
        DEFAULT_CUSTOM_TITLE_COLOR_SECONDARY,
      )
    }
    return readTitleColorHex(
      title.customColorPrimary || title.customColor,
      DEFAULT_CUSTOM_TITLE_COLOR,
    )
  }
  return readTitleColorHex(title.customColor, DEFAULT_CUSTOM_TITLE_COLOR)
}
