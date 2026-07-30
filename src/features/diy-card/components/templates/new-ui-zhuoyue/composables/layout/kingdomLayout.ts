import {
  DEFAULT_PRESET_KINGDOM_LAYOUT_TUNE,
  resolveKingdomPreset,
  type PresetKingdomGlyphLayout,
} from '@/features/diy-card/constants/kingdomPresets'
import { resolveKingdomGlyphFontSizePx } from '@/features/diy-card/utils/customKingdomFontSize'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import {
  CUSTOM_KINGDOM_LAYOUT,
  CUSTOM_SHEN_KINGDOM_LAYOUT,
  DOUBLE_KINGDOM_GLYPH_DEFAULT_WIDTH_PX,
  DOUBLE_KINGDOM_GLYPH_LAYOUT,
  DOUBLE_KINGDOM_GLYPH_LAYOUT_FALLBACK,
  KINGDOMS_POSITION_INFO,
  type CustomKingdomTextMode,
  type DoubleKingdomGlyphLayoutEntry,
  type DoubleKingdomGlyphSlot,
  type KingdomGlyphPositionMm,
} from '../constants/kingdom'

type KingdomLayoutAssetKey = keyof typeof DOUBLE_KINGDOM_GLYPH_LAYOUT | 'custom'

type KingdomStripImage = Pick<HTMLImageElement, 'width' | 'height'>

type CustomKingdomLayoutPreset = typeof CUSTOM_KINGDOM_LAYOUT | typeof CUSTOM_SHEN_KINGDOM_LAYOUT

type ShenFramePresetKingdomGlyphKey = keyof typeof CUSTOM_SHEN_KINGDOM_LAYOUT.presetGlyph

/** 读取双势力预设字布局（已知 key 用表，其余走 FALLBACK） */
export const resolveDoubleKingdomGlyphLayoutEntry = (
  assetKey: string,
  slot: DoubleKingdomGlyphSlot,
): DoubleKingdomGlyphLayoutEntry =>
  DOUBLE_KINGDOM_GLYPH_LAYOUT[assetKey as KingdomLayoutAssetKey]?.[slot] ??
  DOUBLE_KINGDOM_GLYPH_LAYOUT_FALLBACK[slot]

/** 双势力预设字显示尺寸：统一默认宽度 × 布局 scale，高度保持素材宽高比 */
export const resolveDoubleKingdomGlyphSizePx = (image: KingdomStripImage, layoutScale: number) => {
  const width = DOUBLE_KINGDOM_GLYPH_DEFAULT_WIDTH_PX * layoutScale
  const height = (image.height / image.width) * width
  return { width, height }
}

const resolveShenFrameKingdomGlyphLayout = (kingdom: string): KingdomGlyphPositionMm => {
  const table = CUSTOM_SHEN_KINGDOM_LAYOUT.presetGlyph
  if (kingdom in table) {
    return table[kingdom as ShenFramePresetKingdomGlyphKey]
  }
  return table.shen
}

/** 单势力预设 PNG 字布局：神框 / 普通框 */
export const resolvePresetKingdomGlyphLayoutMm = (
  kingdom: string,
  useShenFrameLayout: boolean,
): KingdomGlyphPositionMm => {
  if (useShenFrameLayout) {
    return resolveShenFrameKingdomGlyphLayout(kingdom)
  }
  const key = kingdom as keyof typeof KINGDOMS_POSITION_INFO
  return KINGDOMS_POSITION_INFO[key] ?? KINGDOMS_POSITION_INFO.shen
}

const resolveCustomKingdomLayoutPreset = (isShen: boolean): CustomKingdomLayoutPreset =>
  isShen ? CUSTOM_SHEN_KINGDOM_LAYOUT : CUSTOM_KINGDOM_LAYOUT

export const resolveCustomKingdomDefaultFontSizePt = (
  isShen: boolean,
  mode: CustomKingdomTextMode = 'dual',
) => {
  const layout = resolveCustomKingdomLayoutPreset(isShen)
  return mode === 'single' ? layout.singleFontSizePt : layout.dualFontSizePt
}

export const resolveCustomKingdomSingleTextMm = (isShen: boolean) =>
  resolveCustomKingdomLayoutPreset(isShen).singleTextMm

/**
 * 扩展预设势力 PNG 字布局：基准与自定义势力单字一致（singleTextMm + 单字默认字号），
 * 再叠加各预设 layout 微调（神 / 普通框共用）。
 */
export const resolveExtensionPresetKingdomGlyphLayout = (
  presetKey: string,
  useShenFrameLayout: boolean,
  mmToPixel: number,
  renderObj?: LayoutItem,
): PresetKingdomGlyphLayout => {
  const { x, y } = resolveCustomKingdomSingleTextMm(useShenFrameLayout)
  const baseWidthPx = renderObj
    ? resolveKingdomGlyphFontSizePx(renderObj, mmToPixel, useShenFrameLayout, 'single')
    : resolveCustomKingdomDefaultFontSizePt(useShenFrameLayout, 'single') *
      (25.4 / 72) *
      mmToPixel

  const preset = resolveKingdomPreset(presetKey)
  const tune = preset?.layout ?? DEFAULT_PRESET_KINGDOM_LAYOUT_TUNE

  return {
    originXMm: x + tune.offsetXMm,
    originYMm: y + tune.offsetYMm,
    widthPx: baseWidthPx * tune.scale,
  }
}

export const resolveCustomKingdomDefaultDualCharSpacingMm = (isShen: boolean) =>
  resolveCustomKingdomLayoutPreset(isShen).dualCharSpacingMm

/** 自定义双字某槽位布局（mm）；spacingMm 为第二字相对第一字的水平间距 */
export const resolveCustomKingdomDualCharSlotMm = (
  slot: DoubleKingdomGlyphSlot,
  spacingMm: number = CUSTOM_KINGDOM_LAYOUT.dualCharSpacingMm,
  isShen = false,
) => {
  const layout = resolveCustomKingdomLayoutPreset(isShen)
  const top = layout.dualCharTopMm
  if (slot === 'top') return { x: top.x, y: top.y }
  return {
    x: top.x + spacingMm,
    y: top.y + spacingMm * layout.dualCharSpacingYRatio,
  }
}

/** 自定义双字组锚点（双势力字与单势力双字组左上角对齐） */
export const resolveCustomKingdomDualGroupAnchorMm = (
  spacingMm: number = CUSTOM_KINGDOM_LAYOUT.dualCharSpacingMm,
  isShen = false,
) => {
  const top = resolveCustomKingdomDualCharSlotMm('top', spacingMm, isShen)
  const bottom = resolveCustomKingdomDualCharSlotMm('bottom', spacingMm, isShen)
  return {
    x: Math.min(top.x, bottom.x),
    y: Math.min(top.y, bottom.y),
  }
}
