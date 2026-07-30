import {
  isCustomKingdomActive,
  hasCustomKingdomColor,
  hasCustomKingdomGlyphText,
  isCustomShenKingdomActive,
  isDoubleKingdomRenderActive,
  resolveCustomKingdomColorRgb,
  isMasterFlagActive,
  usesShenCardLayout,
  type KingdomColorSlot,
} from '@/features/diy-card/composables/doubleKingdom'
import { MASTER_KINGDOM_GLYPH_DARK_HEX } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import {
  isPresetKingdomActive,
  shouldUseMasterKingdomGlyphAsset,
  shouldUseMasterKingdomGlyphStyle,
} from '@/features/diy-card/composables/kingdomPreset'
import { resolveCustomHpTintTierFilters } from '@/features/diy-card/utils/customHpColor'
import {
  isCustomKingdomGlyphColorActive,
  isKingdomGlyphOfficialGradientActive,
  resolveCustomKingdomGlyphColorRgb,
  resolveKingdomGlyphImageTintRgb,
  resolveKingdomGlyphGradientEndColorHex,
  resolveKingdomGlyphLayer12BridgeHex,
  resolveKingdomGlyphTextGamutKey,
  shouldApplyKingdomGlyphLayer12Tone,
  shouldPreserveOriginalKingdomGlyphAsset,
  shouldUseAlphaMaskKingdomGlyphLayer12,
} from '@/features/diy-card/utils/customKingdomGlyphColor'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import Konva from 'konva'
import { markRaw } from 'vue'
import type { CustomColorTintGamutKey } from '@/features/diy-card/constants/customColorPickerOptions'
import { getKingdomFrameTintFilter } from './kingdomFrameTint'
import {
  getKingdomGlyphGradientTintFilter,
  getTripleLayerKingdomImageTintFilter,
  shouldOverlayCustomKingdomGradientOnGlyphImage,
} from './kingdomGlyphGradientTint'
import {
  resolveMasterKingdomGlyphGradientSpec,
  resolvePresetKingdomGlyphGradientSpec,
} from '@/features/diy-card/utils/kingdomGlyphFillGradient'
import { hex2rgb } from '@/shared/utils/color'

/**
 * 自定义势力色与各图层 HSL 保纹理着色
 * @param info 武将牌模板数据
 * @param getFilters 无着色时的图层合成配置
 */
export function useKingdomTint(
  info: LegendInfo,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
) {
  const isCustomKingdomColorActive = () => hasCustomKingdomColor(info)

  /** HSL 保纹理着色（色域见 CUSTOM_COLOR_TINT_GAMUT，按图层用途区分） */
  const getTintFilters = (
    rgb: { red: number; green: number; blue: number },
    gamutKey: CustomColorTintGamutKey,
  ) => ({
    red: rgb.red,
    green: rgb.green,
    blue: rgb.blue,
    globalCompositeOperation: 'source-over' as const,
    filters: markRaw([getKingdomFrameTintFilter(gamutKey)]),
  })

  /** 自定义势力色 → 势力图层图片（kingdomCustom 色域） */
  const getCustomKingdomLayerColorFilters = (slot: KingdomColorSlot = 'single') => {
    if (shouldUseMasterKingdomGlyphAsset(info)) {
      return getFilters()
    }
    if (!isCustomKingdomActive(info)) {
      return getFilters()
    }
    const rgbColor = resolveCustomKingdomColorRgb(info, slot)
    if (rgbColor) {
      return getTintFilters(rgbColor, 'kingdomCustom')
    }
    return getFilters()
  }

  /** 边框 frame / kingdom_frame 着色 RGB：自定义势力色优先，自定义神势力可回落势力字色 */
  const resolveFrameBorderTintRgb = (slot: KingdomColorSlot = 'single') => {
    if (isCustomKingdomActive(info)) {
      return resolveCustomKingdomColorRgb(info, slot)
    }
    if (isCustomShenKingdomActive(info) && isCustomKingdomGlyphColorActive(info)) {
      return resolveCustomKingdomGlyphColorRgb(info, slot)
    }
    return undefined
  }

  /** 自定义势力色 → 边框 frame + kingdom_frame（frame 色域） */
  const getFrameBorderColorFilters = (slot: KingdomColorSlot = 'single') => {
    const rgbColor = resolveFrameBorderTintRgb(slot)
    if (rgbColor) {
      return getTintFilters(rgbColor, 'frame')
    }
    return getFilters()
  }

  /** 自定义势力色 → 体力（hp 色域；与边框/势力字分离） */
  const getHpTintFromKingdomColorFilters = (slot: KingdomColorSlot = 'single') => {
    if (isMasterFlagActive(info)) return getFilters()
    if (!isCustomKingdomActive(info)) return getFilters()
    const rgbColor = resolveCustomKingdomColorRgb(info, slot)
    if (rgbColor) {
      return getTintFilters(rgbColor, 'hp')
    }
    return getFilters()
  }

  /**
   * 边框 / 体力 / 技能框等着色底图：自定义势力下除势力字外统一魏（神势力用神）。
   */
  const getTemplateAssetKingdom = (actualKingdom: string) => {
    if (isCustomKingdomActive(info)) {
      if (!isDoubleKingdomRenderActive(info)) {
        return isCustomShenKingdomActive(info) ? 'shen' : 'wei'
      }
      return 'wei'
    }
    return actualKingdom
  }

  /**
   * 势力字 PNG 素材：仅改色时沿用所选魏蜀吴群晋；填写自定义势力字时仍走魏/神灰底。
   */
  const getKingdomGlyphAssetKingdom = (actualKingdom: string) => {
    if (
      isCustomKingdomActive(info) &&
      hasCustomKingdomGlyphText(info) &&
      !isDoubleKingdomRenderActive(info)
    ) {
      return isCustomShenKingdomActive(info) ? 'shen' : 'wei'
    }
    return actualKingdom
  }

  /** 双势力自定义色：frame/hp 始终双档着色；单势力字仅影响势力条/字槽位，不关闭双档渐变 */
  const useDualCustomKingdomColor = () =>
    isCustomKingdomColorActive() && isDoubleKingdomRenderActive(info)

  /** 独立自定义体力色（hp 色域；双势力支持 full/half 两档） */
  const getCustomHpTintTierFilters = () =>
    resolveCustomHpTintTierFilters(
      info,
      (rgb) => getTintFilters(rgb, 'hp'),
      getFilters,
    )

  /** 势力字单独变色（kingdomGlyph 色域） */
  const getCustomKingdomGlyphColorFilters = (
    slot: KingdomColorSlot = 'single',
    assetKeyOverride?: string,
  ) => {
    const rgb = resolveKingdomGlyphImageTintRgb(info, slot, assetKeyOverride)
    if (!rgb) return null
    return getTintFilters(rgb, 'kingdomGlyph')
  }

  /** 扩展预设 PNG：走与自定义势力字相同的竖向渐变叠色（kingdomCustom 色域） */
  const resolvePresetKingdomGlyphGradientFilters = (slot: KingdomColorSlot = 'single') => {
    if (shouldUseMasterKingdomGlyphStyle(info)) {
      const rgb = hex2rgb(MASTER_KINGDOM_GLYPH_DARK_HEX)
      if (!rgb) return getFilters()
      const gradientSpec = resolveMasterKingdomGlyphGradientSpec(usesShenCardLayout(info), {
        alphaMask: true,
      })
      return {
        red: rgb.red,
        green: rgb.green,
        blue: rgb.blue,
        globalCompositeOperation: 'source-over' as const,
        filters: markRaw([
          getKingdomGlyphGradientTintFilter(
            rgb.red,
            rgb.green,
            rgb.blue,
            info,
            'kingdomCustom',
            gradientSpec,
          ),
        ]),
      }
    }

    const rgb =
      resolveKingdomGlyphImageTintRgb(info, slot) ?? resolveCustomKingdomColorRgb(info, slot)
    if (!rgb) return getFilters()
    const gamutKey = resolveKingdomGlyphTextGamutKey(info, slot)
    const gradientSpec = resolvePresetKingdomGlyphGradientSpec(usesShenCardLayout(info))
    return {
      red: rgb.red,
      green: rgb.green,
      blue: rgb.blue,
      globalCompositeOperation: 'source-over' as const,
      filters: markRaw([
        getKingdomGlyphGradientTintFilter(
          rgb.red,
          rgb.green,
          rgb.blue,
          info,
          gamutKey,
          gradientSpec,
        ),
      ]),
    }
  }

  /** 势力字着色：神框预设 PNG 走神框 brighten 渐变叠盖，其余走 kingdomGlyph 平面着色 */
  const resolveKingdomGlyphTintFilters = (
    slot: KingdomColorSlot = 'single',
    assetKeyOverride?: string,
  ) => {
    if (shouldUseMasterKingdomGlyphAsset(info)) {
      return getFilters()
    }
    if (isKingdomGlyphOfficialGradientActive(info)) {
      const bridgeHex = resolveKingdomGlyphLayer12BridgeHex(info, slot)
      const endHex = resolveKingdomGlyphGradientEndColorHex(info, slot)
      if (bridgeHex && endHex) {
        return {
          ...getFilters(),
          filters: markRaw([
            getTripleLayerKingdomImageTintFilter({
              bridgeHex,
              endHex,
              applyLayer12Tone: shouldApplyKingdomGlyphLayer12Tone(info, slot),
              useAlphaMaskLayer12: shouldUseAlphaMaskKingdomGlyphLayer12(info),
              textGamutKey: resolveKingdomGlyphTextGamutKey(info, slot),
            }),
          ]),
        }
      }
    }
    if (isPresetKingdomActive(info) && !isKingdomGlyphOfficialGradientActive(info)) {
      return resolvePresetKingdomGlyphGradientFilters(slot)
    }
    const preserveOriginal = shouldPreserveOriginalKingdomGlyphAsset(
      info,
      slot,
      assetKeyOverride,
    )
    if (preserveOriginal) {
      return getFilters()
    }
    const glyphRgb = resolveKingdomGlyphImageTintRgb(info, slot, assetKeyOverride)
    const glyphFilters = getCustomKingdomGlyphColorFilters(slot, assetKeyOverride)
    if (
      glyphRgb &&
      glyphFilters &&
      isCustomKingdomGlyphColorActive(info) &&
      shouldOverlayCustomKingdomGradientOnGlyphImage(info, slot, preserveOriginal)
    ) {
      return {
        ...glyphFilters,
        filters: markRaw([
          getKingdomGlyphGradientTintFilter(
            glyphRgb.red,
            glyphRgb.green,
            glyphRgb.blue,
            info,
            'kingdomGlyph',
          ),
        ]),
      }
    }
    if (glyphFilters) return glyphFilters
    return getCustomKingdomLayerColorFilters(slot)
  }

  /** 技能框 left/right：自定义势力色着色（主公时仍与非主公一致，不同于边框 kingdom_frame 条） */
  const resolveSkillFrameSideTintFilters = (slot: KingdomColorSlot = 'single') => {
    if (!isCustomKingdomActive(info)) return getFilters()
    const rgbColor = resolveFrameBorderTintRgb(slot)
    if (rgbColor) {
      return getFrameBorderColorFilters(slot)
    }
    return getFilters()
  }

  /** 边框两侧 kingdom_frame：自定义势力色或自定义神势力字色，frame 色域；主公用 master 条素材，与魏蜀吴群一致不着色 */
  const resolveKingdomFrameStripTintFilters = (slot: KingdomColorSlot = 'single') => {
    if (isMasterFlagActive(info)) {
      return getFilters()
    }
    if (resolveFrameBorderTintRgb(slot)) {
      return getFrameBorderColorFilters(slot)
    }
    return getFilters()
  }

  /** 神框布局下是否仍对 frame 底图做着色（自定义神 + 已配置着色源） */
  const shouldTintShenFrameLayout = () =>
    isCustomShenKingdomActive(info) && Boolean(resolveFrameBorderTintRgb('single'))

  return {
    isCustomKingdomColorActive,
    useDualCustomKingdomColor,
    getCustomKingdomLayerColorFilters,
    getFrameBorderColorFilters,
    getCustomHpTintTierFilters,
    getCustomKingdomGlyphColorFilters,
    resolveKingdomGlyphTintFilters,
    resolveKingdomFrameStripTintFilters,
    resolveSkillFrameSideTintFilters,
    getHpTintFromKingdomColorFilters,
    getTemplateAssetKingdom,
    getKingdomGlyphAssetKingdom,
    shouldTintShenFrameLayout,
  }
}
