import {
  isCustomKingdomActive,
  usesShenCardLayout,
} from '@/features/diy-card/composables/doubleKingdom'
import type { KingdomColorSlot } from '@/features/diy-card/composables/doubleKingdom'
import {
  isCustomKingdomGlyphColorActive,
  isKingdomGlyphOfficialGradientActive,
} from '@/features/diy-card/utils/customKingdomGlyphColor'
import type { CustomColorTextGamutKey } from '@/features/diy-card/constants/customColorPickerOptions'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  resolveKingdomGlyphFillGradientSpec,
  resolveKingdomGlyphFillGradientStops,
  resolveKingdomGlyphTripleLayerImageAxisSpec,
  sampleKingdomGlyphImageGradientRgb,
  sampleTripleLayerKingdomImageRgb,
  type KingdomGlyphGradientSpec,
  type ResolvedGradientStop,
  type TripleLayerKingdomImageOptions,
} from '@/features/diy-card/utils/kingdomGlyphFillGradient'
import { rgbToHex } from '@/shared/utils/color'
import Konva from 'konva'

type GradientTintCacheKey = string

const buildGradientTintCacheKey = (
  red: number,
  green: number,
  blue: number,
  gamutKey: CustomColorTextGamutKey,
  spec: KingdomGlyphGradientSpec,
) =>
  `${red},${green},${blue},${gamutKey},${spec.modulateImageLightness ? 'shen' : 'normal'},${spec.useAlphaMaskGradientFill ? 'mask' : 'mod'}`

/** 神框 + 势力字颜色：用自定义势力字渐变叠盖 PNG 原图渐变 */
export function createKingdomGlyphGradientTintFilter(
  stops: ResolvedGradientStop[],
  spec: KingdomGlyphGradientSpec,
) {
  return function kingdomGlyphGradientTintFilter(this: Konva.Node, imageData: ImageData) {
    const data = imageData.data
    const width = Math.max(1, imageData.width)
    const height = Math.max(1, imageData.height)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const a = data[i + 3] ?? 255
        if (a < 6) continue
        const r = data[i]!
        const g = data[i + 1]!
        const b = data[i + 2]!
        const out = sampleKingdomGlyphImageGradientRgb(
          x,
          y,
          r,
          g,
          b,
          width,
          height,
          stops,
          spec,
        )
        data[i] = out.red
        data[i + 1] = out.green
        data[i + 2] = out.blue
      }
    }
  }
}

/** 三层渐变：Layer1+2 + Layer3 终点色 */
export function createTripleLayerKingdomImageTintFilter(
  options: TripleLayerKingdomImageOptions,
  spec: KingdomGlyphGradientSpec,
) {
  return function tripleLayerKingdomImageTintFilter(this: Konva.Node, imageData: ImageData) {
    const data = imageData.data
    const width = Math.max(1, imageData.width)
    const height = Math.max(1, imageData.height)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const a = data[i + 3] ?? 255
        if (a < 6) continue
        const r = data[i]!
        const g = data[i + 1]!
        const b = data[i + 2]!
        const out = sampleTripleLayerKingdomImageRgb(
          x,
          y,
          r,
          g,
          b,
          width,
          height,
          options,
          spec,
        )
        data[i] = out.red
        data[i + 1] = out.green
        data[i + 2] = out.blue
      }
    }
  }
}

const filterCache = new Map<
  GradientTintCacheKey,
  ReturnType<typeof createKingdomGlyphGradientTintFilter>
>()
const tripleLayerFilterCache = new Map<
  string,
  ReturnType<typeof createTripleLayerKingdomImageTintFilter>
>()

/** 获取（并缓存）势力字图片渐变叠色滤镜 */
export const getKingdomGlyphGradientTintFilter = (
  red: number,
  green: number,
  blue: number,
  info: LegendInfo,
  gamutKey: CustomColorTextGamutKey = 'kingdomGlyph',
  specOverride?: KingdomGlyphGradientSpec,
) => {
  const spec =
    specOverride ?? resolveKingdomGlyphFillGradientSpec(usesShenCardLayout(info))
  const cacheKey = buildGradientTintCacheKey(red, green, blue, gamutKey, spec)
  let filter = filterCache.get(cacheKey)
  if (!filter) {
    const hex = rgbToHex({
      red: Math.round(red),
      green: Math.round(green),
      blue: Math.round(blue),
    })
    const stops = resolveKingdomGlyphFillGradientStops(hex, spec, gamutKey) ?? []
    filter = createKingdomGlyphGradientTintFilter(stops, spec)
    filterCache.set(cacheKey, filter)
  }
  return filter
}

/** 魏蜀吴群晋：Layer1+2（原图 / 自定义色停靠渐变）+ Layer3 终点色 */
export const getTripleLayerKingdomImageTintFilter = (options: TripleLayerKingdomImageOptions) => {
  const gamut = options.textGamutKey ?? 'kingdomGlyph'
  const mask = options.useAlphaMaskLayer12 ? 1 : 0
  const cacheKey = `triple:${options.bridgeHex}:${options.endHex}:${options.applyLayer12Tone ? 1 : 0}:${mask}:${gamut}`
  let filter = tripleLayerFilterCache.get(cacheKey)
  if (!filter) {
    const spec = resolveKingdomGlyphTripleLayerImageAxisSpec({
      preserveColoredPngTexture: !options.useAlphaMaskLayer12,
    })
    filter = createTripleLayerKingdomImageTintFilter(options, spec)
    tripleLayerFilterCache.set(cacheKey, filter)
  }
  return filter
}

/** @deprecated 使用 getTripleLayerKingdomImageTintFilter */
export const getOfficialKingdomGlyphGradientTintFilter = (
  bridgeHex: string,
  endHex: string,
  applyLayer12Tone = false,
) =>
  getTripleLayerKingdomImageTintFilter({ bridgeHex, endHex, applyLayer12Tone })

/**
 * 预设势力字 PNG：「势力字 → 自定义颜色」时用神框竖向渐变叠盖原图（无需开启自定义势力）
 * 双势力与单势力共用 kingdomGlyph 平面着色（kingdomFrameTint）
 */
export const shouldOverlayCustomKingdomGradientOnGlyphImage = (
  info: LegendInfo,
  _slot: KingdomColorSlot,
  preserveOriginal: boolean,
) => {
  if (isKingdomGlyphOfficialGradientActive(info)) {
    return false
  }
  if (
    !isCustomKingdomGlyphColorActive(info) ||
    isCustomKingdomActive(info) ||
    preserveOriginal
  ) {
    return false
  }
  return usesShenCardLayout(info)
}
