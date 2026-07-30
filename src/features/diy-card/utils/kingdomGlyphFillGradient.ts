import { DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR } from '@/features/diy-card/constants/customKingdomDefaults'
import {
  KINGDOM_GLYPH_TRIPLE_LAYER_GRADIENT,
} from '@/features/diy-card/constants/customKingdomGlyphGradientDefaults'
import {
  CUSTOM_COLOR_TEXT_GAMUT,
  type CustomColorTextGamutKey,
  type CustomColorTextGamutOptions,
} from '@/features/diy-card/constants/customColorPickerOptions'
import {
  CUSTOM_KINGDOM_GLYPH_END_TILT_X_RATIO,
  CUSTOM_KINGDOM_GLYPH_FILL_STOPS,
  CUSTOM_KINGDOM_GLYPH_TEXT_END_TILT_X_RATIO,
  CUSTOM_KINGDOM_GLYPH_TEXT_FILL_STOPS,
  CUSTOM_SHEN_KINGDOM_GLYPH_BRIGHTEN_STOPS,
  CUSTOM_SHEN_KINGDOM_GLYPH_TEXT_BRIGHTEN_STOPS,
  MASTER_KINGDOM_GLYPH_FILL_STOPS,
  type KingdomGlyphBrightenStop,
  type KingdomGlyphFixedColorStop,
  type KingdomGlyphToneStop,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import { hex2rgb, hslToRgb, rgbToHex, rgbToHsl } from '@/shared/utils/color'

export type CustomKingdomTextFillStyle = Pick<
  CanvasItemConfig,
  | 'fill'
  | 'fillPriority'
  | 'fillLinearGradientStartPoint'
  | 'fillLinearGradientEndPoint'
  | 'fillLinearGradientColorStops'
>

export type KingdomGlyphGradientStop =
  | KingdomGlyphToneStop
  | KingdomGlyphBrightenStop
  | KingdomGlyphFixedColorStop

/** 势力字渐变实现（停靠表在 constants；调参改本文件常量） */
export type KingdomGlyphGradientSpec = {
  endTiltXRatio: number
  gradientEndUsesFullBox?: boolean
  gradientAxisInverted?: boolean
  modulateImageLightness?: boolean
  stops: readonly KingdomGlyphGradientStop[]
  imageLightnessOrigWeight?: number
  imageLightnessGradWeight?: number
  imageTextureMix?: number
  gradientAxisSoftness?: number
  gradientStopDensity?: number
  customColorSatMul?: number
  customHighlightLightness?: number
  /** 纯黑/透明底字模：按渐变轴直接填色，不依赖原图明度 */
  useAlphaMaskGradientFill?: boolean
  /** Layer3 blend/mix 曲线柔化；官方彩色 PNG 可置 0 以保持锐利 */
  layer3ScalarSoftness?: number
}

/** 神框 PNG / 文本渐变：已调好的实现参数（一般不需再改 constants） */
const SHEN_KINGDOM_GLYPH_GRADIENT_TUNING = {
  /** 条带边缘柔化（略增可减轻生硬感，不改变 brighten 停靠位置） */
  gradientAxisSoftness: 0.034,
  /** 段内插值更密，过渡更顺滑 */
  gradientStopDensity: 0.008,
  imageLightnessOrigWeight: 0.34,
  /** 略降明度调制权重，条带对比稍柔和 */
  imageLightnessGradWeight: 0.64,
  imageTextureMix: 0.03,
  /** 锁定 hue 后的饱和度缩放（略低于 0.5 可减轻过艳） */
  customColorSatMul: 0.42,
  /** 高亮档明度顶（略低于 0.99 避免刺眼白感） */
  customHighlightLightness: 0.97,
} as const

const NORMAL_KINGDOM_GLYPH_GRADIENT: KingdomGlyphGradientSpec = {
  endTiltXRatio: CUSTOM_KINGDOM_GLYPH_END_TILT_X_RATIO,
  stops: CUSTOM_KINGDOM_GLYPH_FILL_STOPS,
}

/** 主公势力字：左上 (0,0) → 右下 (w,h) 对角渐变 */
const MASTER_KINGDOM_GLYPH_GRADIENT: KingdomGlyphGradientSpec = {
  gradientEndUsesFullBox: true,
  endTiltXRatio: 1,
  stops: MASTER_KINGDOM_GLYPH_FILL_STOPS,
  gradientStopDensity: 0.012,
}

const MASTER_SHEN_KINGDOM_GLYPH_GRADIENT: KingdomGlyphGradientSpec = {
  ...MASTER_KINGDOM_GLYPH_GRADIENT,
}

const SHEN_KINGDOM_GLYPH_GRADIENT: KingdomGlyphGradientSpec = {
  endTiltXRatio: 0,
  gradientEndUsesFullBox: true,
  modulateImageLightness: true,
  stops: CUSTOM_SHEN_KINGDOM_GLYPH_BRIGHTEN_STOPS,
  ...SHEN_KINGDOM_GLYPH_GRADIENT_TUNING,
}

const isBrightenStop = (
  stop: KingdomGlyphGradientStop,
): stop is KingdomGlyphBrightenStop => 'brighten' in stop

const isFixedColorStop = (
  stop: KingdomGlyphGradientStop,
): stop is KingdomGlyphFixedColorStop => 'color' in stop

const resolveTextGamut = (key?: CustomColorTextGamutKey): CustomColorTextGamutOptions =>
  CUSTOM_COLOR_TEXT_GAMUT[key ?? 'kingdomCustom']

const shiftLightness = (lightness: number, gamut: CustomColorTextGamutOptions) =>
  Math.min(0.98, Math.max(0.1, lightness + gamut.lightnessShift))

type ToneFn = (lightness: number, satMul?: number) => string

const buildDarkestTone = (
  tone: ToneFn,
  baseLightness: number,
  gamut: CustomColorTextGamutOptions,
) =>
  tone(
    shiftLightness(
      Math.min(gamut.darkestLightnessCap, baseLightness + gamut.darkestLightnessOffset),
      gamut,
    ),
    gamut.darkestSatMul,
  )

/** 低于此视为灰阶自定义色 */
const SHEN_CUSTOM_ACHROMATIC_SAT = 0.02
/** 低于此 orig.l 不强制顶到高亮明度，避免抗锯齿边缘光晕 */
const SHEN_GLYPH_HIGHLIGHT_EDGE_ORIG_L = 0.14
const SHEN_GLYPH_HIGHLIGHT_EDGE_RAMP = 0.36

export type ResolvedGradientStop = {
  position: number
  rgb: { red: number; green: number; blue: number }
  /** 神框条带：提亮档 / 原明度档（hue/sat 来自 shenLockedHsl） */
  shenBand?: 'brightened' | 'base'
  /** 神框：全条带锁定为用户自定义色的 hue/sat */
  shenLockedHsl?: { h: number; s: number }
  /** 神框：该停靠目标明度 */
  shenBandLightness?: number
}

type ShenGlyphToneProfile = {
  lockedH: number
  lockedS: number
  baseL: number
  highlightL: number
}

const clampLightness = (value: number) => Math.min(0.98, Math.max(0.02, value))

const cosineEase = (ratio: number) => (1 - Math.cos(Math.min(1, Math.max(0, ratio)) * Math.PI)) / 2

/** Layer3 标量曲线：段间 smootherstep，比 cosine 在拐点更柔 */
const smootherstep = (ratio: number) => {
  const t = Math.min(1, Math.max(0, ratio))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** PNG 内嵌近黑描边/叠影：叠色滤镜跳过，避免黑边被染成势力色 */
const KINGDOM_GLYPH_IMAGE_OUTLINE_MAX_LIGHTNESS = 0.28
const KINGDOM_GLYPH_IMAGE_OUTLINE_MAX_SATURATION = 0.22

const shouldPreserveKingdomGlyphImageOutlineRgb = (
  red: number,
  green: number,
  blue: number,
) => {
  const { l, s } = rgbToHsl(red, green, blue)
  return l <= KINGDOM_GLYPH_IMAGE_OUTLINE_MAX_LIGHTNESS && s <= KINGDOM_GLYPH_IMAGE_OUTLINE_MAX_SATURATION
}

/** @internal 供 kingdomFrameTint 等 PNG 叠色共用 */
export const preserveKingdomGlyphImageOutlineRgb = shouldPreserveKingdomGlyphImageOutlineRgb

const resolveShenHighlightLightness = (spec: KingdomGlyphGradientSpec) =>
  clampLightness(spec.customHighlightLightness ?? 0.98)

/** 神框：由用户色解析锁定 hue/sat 与高白/自定义两档明度 */
const resolveShenGlyphToneProfile = (
  hue: number,
  sat: number,
  lightness: number,
  spec: KingdomGlyphGradientSpec,
): ShenGlyphToneProfile => {
  const customSatMul = spec.customColorSatMul ?? 1
  const isAchromatic = sat < SHEN_CUSTOM_ACHROMATIC_SAT
  return {
    lockedH: isAchromatic ? 0 : hue,
    lockedS: isAchromatic ? sat : Math.min(1, Math.max(0, sat * customSatMul)),
    baseL: clampLightness(lightness),
    highlightL: resolveShenHighlightLightness(spec),
  }
}

const shenBandTargetLightness = (
  brighten: boolean,
  profile: ShenGlyphToneProfile,
) => (brighten ? profile.highlightL : profile.baseL)

const resolveShenHighlightEdgeGate = (origL: number) =>
  Math.min(
    1,
    Math.max(0, (origL - SHEN_GLYPH_HIGHLIGHT_EDGE_ORIG_L) / SHEN_GLYPH_HIGHLIGHT_EDGE_RAMP),
  )

const hslToneToRgb = (h: number, s: number, l: number) => {
  const out = hslToRgb(h, Math.min(1, Math.max(0, s)), clampLightness(l))
  return { red: out.red, green: out.green, blue: out.blue }
}

/** 神框：锁定 hue/sat，条带间只插值明度（高白=自定义色+提亮） */
const blendShenGradientStopRgb = (
  a: ResolvedGradientStop,
  b: ResolvedGradientStop,
  ratio: number,
) => {
  const locked = a.shenLockedHsl ?? b.shenLockedHsl
  if (!locked) {
    const t = cosineEase(ratio)
    return {
      red: Math.round(a.rgb.red + (b.rgb.red - a.rgb.red) * t),
      green: Math.round(a.rgb.green + (b.rgb.green - a.rgb.green) * t),
      blue: Math.round(a.rgb.blue + (b.rgb.blue - a.rgb.blue) * t),
    }
  }

  const t = cosineEase(ratio)
  const aL = a.shenBandLightness ?? rgbToHsl(a.rgb.red, a.rgb.green, a.rgb.blue).l
  const bL = b.shenBandLightness ?? rgbToHsl(b.rgb.red, b.rgb.green, b.rgb.blue).l
  const outL = aL + (bL - aL) * t
  return hslToneToRgb(locked.h, locked.s, outL)
}

const blendGradientStopRgb = (
  a: ResolvedGradientStop,
  b: ResolvedGradientStop,
  ratio: number,
) => {
  if (a.shenBand && b.shenBand) {
    return blendShenGradientStopRgb(a, b, ratio)
  }
  const t = cosineEase(ratio)
  return {
    red: Math.round(a.rgb.red + (b.rgb.red - a.rgb.red) * t),
    green: Math.round(a.rgb.green + (b.rgb.green - a.rgb.green) * t),
    blue: Math.round(a.rgb.blue + (b.rgb.blue - a.rgb.blue) * t),
  }
}

/** 由用户 hex + 渐变表解析各停靠色（文本填充与图片叠色共用） */
export const resolveKingdomGlyphFillGradientStops = (
  hex: string | undefined,
  spec: KingdomGlyphGradientSpec,
  textGamutKey?: CustomColorTextGamutKey,
): ResolvedGradientStop[] | null => {
  const rgb = hex2rgb(hex?.trim() || DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR)
  if (!rgb) return null

  const textGamut = resolveTextGamut(textGamutKey)
  const { h, s, l } = rgbToHsl(rgb.red, rgb.green, rgb.blue)

  const tone: ToneFn = (lightness, satMul = 1) => {
    const out = hslToRgb(
      h,
      Math.min(1, Math.max(0, s * satMul)),
      clampLightness(lightness),
    )
    return rgbToHex(out)
  }

  const shenProfile = spec.modulateImageLightness
    ? resolveShenGlyphToneProfile(h, s, l, spec)
    : undefined
  const shenLockedHsl = shenProfile
    ? { h: shenProfile.lockedH, s: shenProfile.lockedS }
    : undefined

  const resolved = spec.stops.map((stop) => {
    let hexColor: string
    let shenBand: ResolvedGradientStop['shenBand']
    let shenBandLightness: number | undefined

    if (isFixedColorStop(stop)) {
      hexColor = stop.color
    } else if (isBrightenStop(stop)) {
      if (shenProfile) {
        shenBandLightness = shenBandTargetLightness(stop.brighten, shenProfile)
        hexColor = rgbToHex(
          hslToRgb(shenProfile.lockedH, shenProfile.lockedS, shenBandLightness),
        )
        shenBand = stop.brighten ? 'brightened' : 'base'
      } else {
        hexColor = rgbToHex(rgb)
      }
    } else if (stop.useDarkestTone) {
      hexColor = buildDarkestTone(tone, l, textGamut)
    } else {
      hexColor = tone(shiftLightness(stop.lightness ?? l, textGamut), stop.satMul ?? 1)
    }

    const parsed = hex2rgb(hexColor)!
    return {
      position: stop.position,
      rgb: { red: parsed.red, green: parsed.green, blue: parsed.blue },
      shenBand,
      shenLockedHsl,
      shenBandLightness,
    }
  })

  const density = spec.gradientStopDensity
  if (density != null && density > 0) {
    return densifyResolvedGradientStops(resolved, density)
  }
  return resolved
}

/** 保持峰值停靠位置，段内 cosine 插值 densify，柔化条带边缘 */
const densifyResolvedGradientStops = (
  stops: ResolvedGradientStop[],
  positionStep: number,
): ResolvedGradientStop[] => {
  if (stops.length < 2 || positionStep <= 0) return stops
  const out: ResolvedGradientStop[] = []

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!
    const b = stops[i + 1]!
    const span = b.position - a.position
    if (span <= 0) continue
    const count = Math.max(1, Math.ceil(span / positionStep))
    for (let j = 0; j < count; j++) {
      if (i > 0 && j === 0) continue
      const ratio = j / count
      out.push({
        position: a.position + span * ratio,
        rgb: blendGradientStopRgb(a, b, ratio),
      })
    }
  }
  out.push(stops[stops.length - 1]!)
  for (const key of stops) {
    const index = out.findIndex((item) => Math.abs(item.position - key.position) < 1e-6)
    if (index >= 0) {
      out[index] = { ...key }
    } else {
      out.push({ ...key })
    }
  }
  out.sort((a, b) => a.position - b.position)
  return out
}

/** 按停靠表：1=提亮档，0=原明度档 */
const resolveShenBrightenMixAtT = (t: number, spec: KingdomGlyphGradientSpec) => {
  if (!spec.modulateImageLightness) return 0

  const keyStops = spec.stops
    .filter(isBrightenStop)
    .map((stop) => ({
      position: stop.position,
      mix: stop.brighten ? 1 : 0,
    }))
  if (keyStops.length === 0) return 0

  const clamped = Math.min(1, Math.max(0, t))
  const first = keyStops[0]!
  const last = keyStops[keyStops.length - 1]!
  if (clamped <= first.position) return first.mix
  if (clamped >= last.position) return last.mix

  for (let i = 0; i < keyStops.length - 1; i++) {
    const a = keyStops[i]!
    const b = keyStops[i + 1]!
    if (clamped >= a.position && clamped <= b.position) {
      const span = b.position - a.position
      const ratio = span > 0 ? (clamped - a.position) / span : 0
      return a.mix + (b.mix - a.mix) * cosineEase(ratio)
    }
  }
  return 0
}

const sampleGradientRgb = (t: number, stops: ResolvedGradientStop[]) => {
  const clamped = Math.min(1, Math.max(0, t))
  if (stops.length === 0) return { red: 255, green: 255, blue: 255 }
  if (clamped <= stops[0]!.position) return stops[0]!.rgb
  const last = stops[stops.length - 1]!
  if (clamped >= last.position) return last.rgb

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!
    const b = stops[i + 1]!
    if (clamped >= a.position && clamped <= b.position) {
      const span = b.position - a.position
      const ratio = span > 0 ? (clamped - a.position) / span : 0
      return blendGradientStopRgb(a, b, ratio)
    }
  }
  return last.rgb
}

const sampleGradientRgbSoftened = (
  t: number,
  stops: ResolvedGradientStop[],
  axisSoftness = 0,
) => {
  if (axisSoftness <= 0) return sampleGradientRgb(t, stops)
  const tapCount = 5
  const samples: Array<{ red: number; green: number; blue: number }> = []
  const weights: number[] = []

  for (let i = 0; i < tapCount; i++) {
    const u = (i / (tapCount - 1)) * 2 - 1
    const offset = u * axisSoftness
    const weight = 1 - Math.abs(u) * 0.75
    samples.push(sampleGradientRgb(Math.min(1, Math.max(0, t + offset)), stops))
    weights.push(weight)
  }

  let red = 0
  let green = 0
  let blue = 0
  let weightSum = 0
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!
    const weight = weights[i] ?? 0
    red += sample.red * weight
    green += sample.green * weight
    blue += sample.blue * weight
    weightSum += weight
  }
  if (weightSum <= 0) return samples[0] ?? { red: 255, green: 255, blue: 255 }
  return {
    red: Math.round(red / weightSum),
    green: Math.round(green / weightSum),
    blue: Math.round(blue / weightSum),
  }
}

/** 渐变轴终点（起点恒为左上 0,0） */
const resolveKingdomGlyphGradientEndPoint = (
  boxW: number,
  boxH: number,
  spec: KingdomGlyphGradientSpec,
) => {
  if (spec.gradientEndUsesFullBox) {
    return { x: boxW, y: boxH }
  }
  const tiltSpan = Math.min(boxW, boxH)
  return { x: tiltSpan * spec.endTiltXRatio, y: boxH }
}

/** 像素在渐变轴上的归一化位置（0 = 起点，1 = 终点） */
export const resolveKingdomGlyphGradientAxisT = (
  px: number,
  py: number,
  width: number,
  height: number,
  spec: KingdomGlyphGradientSpec,
) => {
  const boxW = Math.max(width, 1)
  const boxH = Math.max(height, 1)
  const { x: endX, y: endY } = resolveKingdomGlyphGradientEndPoint(boxW, boxH, spec)

  const lenSq = endX * endX + endY * endY
  if (lenSq < 1) return 0
  let t = (px * endX + py * endY) / lenSq
  t = Math.min(1, Math.max(0, t))
  return spec.gradientAxisInverted ? 1 - t : t
}

export const resolveKingdomGlyphFillGradientSpec = (shen: boolean): KingdomGlyphGradientSpec =>
  shen ? SHEN_KINGDOM_GLYPH_GRADIENT : NORMAL_KINGDOM_GLYPH_GRADIENT

/** 自定义势力字文本：竖向为主略拉长渐变轴（勿用全框对角，居中字会整字落高亮区） */
export const resolveCustomKingdomTextFillGradientSpec = (
  shen: boolean,
  master: boolean,
): KingdomGlyphGradientSpec => {
  if (master) {
    return resolveMasterKingdomGlyphGradientSpec(shen)
  }
  if (shen) {
    return {
      ...SHEN_KINGDOM_GLYPH_GRADIENT,
      stops: CUSTOM_SHEN_KINGDOM_GLYPH_TEXT_BRIGHTEN_STOPS,
    }
  }
  return {
    endTiltXRatio: CUSTOM_KINGDOM_GLYPH_TEXT_END_TILT_X_RATIO,
    stops: CUSTOM_KINGDOM_GLYPH_TEXT_FILL_STOPS,
  }
}

/** 主公 + 自定义势力字 / 扩展预设：深浅深浅深渐变 */
export const resolveMasterKingdomGlyphGradientSpec = (
  shen: boolean,
  options?: { alphaMask?: boolean },
): KingdomGlyphGradientSpec => {
  const base = shen ? MASTER_SHEN_KINGDOM_GLYPH_GRADIENT : MASTER_KINGDOM_GLYPH_GRADIENT
  return options?.alphaMask ? { ...base, useAlphaMaskGradientFill: true } : base
}

/** 扩展预设势力纯黑字模：沿用普通/神框渐变表，按 alpha 遮罩填色 */
export const resolvePresetKingdomGlyphGradientSpec = (shen: boolean): KingdomGlyphGradientSpec => ({
  ...resolveKingdomGlyphFillGradientSpec(shen),
  useAlphaMaskGradientFill: true,
})

type Layer3BlendStop = { position: number; blend: number }
type Layer3MixStop = { position: number; mix: number }
type Layer3AlphaStop = { position: number; alpha: number }

function sampleLayer3ScalarStops<T extends Layer3BlendStop | Layer3MixStop | Layer3AlphaStop>(
  t: number,
  stops: readonly T[],
  key: keyof T,
): number {
  if (!stops.length) return 0
  const clamped = Math.min(1, Math.max(0, t))
  const first = stops[0]!
  if (clamped <= first.position) return first[key] as number
  const last = stops[stops.length - 1]!
  if (clamped >= last.position) return last[key] as number
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!
    const b = stops[i + 1]!
    if (clamped >= a.position && clamped <= b.position) {
      const span = b.position - a.position
      if (span <= 0) return b[key] as number
      const ratio = smootherstep((clamped - a.position) / span)
      return (a[key] as number) + ((b[key] as number) - (a[key] as number)) * ratio
    }
  }
  return last[key] as number
}

const sampleLayer3ScalarStopsSoftened = <T extends Layer3BlendStop | Layer3MixStop | Layer3AlphaStop>(
  t: number,
  stops: readonly T[],
  key: keyof T,
  axisSoftness = 0,
) => {
  if (axisSoftness <= 0) return sampleLayer3ScalarStops(t, stops, key)
  const tapCount = 5
  let sum = 0
  let weightSum = 0
  for (let i = 0; i < tapCount; i++) {
    const u = (i / (tapCount - 1)) * 2 - 1
    const offset = u * axisSoftness
    const weight = 1 - Math.abs(u) * 0.75
    sum += sampleLayer3ScalarStops(Math.min(1, Math.max(0, t + offset)), stops, key) * weight
    weightSum += weight
  }
  return weightSum > 0 ? sum / weightSum : sampleLayer3ScalarStops(t, stops, key)
}

/** 段内 smootherstep densify，使 mix/blend 停靠之间过渡更顺滑 */
function densifyScalarStops<T extends { position: number }, K extends keyof T>(
  stops: readonly T[],
  positionStep: number,
  key: K,
  ease: (ratio: number) => number = smootherstep,
): T[] {
  if (stops.length < 2 || positionStep <= 0) return [...stops]
  const out: T[] = []

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!
    const b = stops[i + 1]!
    const span = b.position - a.position
    if (span <= 0) continue
    const count = Math.max(1, Math.ceil(span / positionStep))
    for (let j = 0; j < count; j++) {
      if (i > 0 && j === 0) continue
      const ratio = j / count
      const position = a.position + span * ratio
      const eased = ease(ratio)
      const aVal = a[key] as number
      const bVal = b[key] as number
      out.push({ ...a, position, [key]: aVal + (bVal - aVal) * eased } as T)
    }
  }
  out.push(stops[stops.length - 1]!)
  out.sort((a, b) => a.position - b.position)
  return out
}

const LAYER3_DENSIFY_STEP = 0.005
const LAYER3_TEXT_FILL_STEP = 0.006

const resolveLayer3ScalarSoftness = (extraAxisSoftness = 0, spec?: KingdomGlyphGradientSpec) =>
  (spec?.layer3ScalarSoftness ??
    KINGDOM_GLYPH_TRIPLE_LAYER_GRADIENT.layer3ScalarSoftness ??
    0.05) + extraAxisSoftness

const LAYER3_BLEND_STOPS_DENSE = densifyScalarStops(
  KINGDOM_GLYPH_TRIPLE_LAYER_GRADIENT.layer3BlendStops,
  LAYER3_DENSIFY_STEP,
  'blend',
)
const LAYER3_END_MIX_STOPS_DENSE = densifyScalarStops(
  KINGDOM_GLYPH_TRIPLE_LAYER_GRADIENT.layer3EndMixStops,
  LAYER3_DENSIFY_STEP,
  'mix',
)

export const resolveKingdomGlyphLayer3BlendWeight = (
  axisT: number,
  axisSoftness = 0,
  spec?: KingdomGlyphGradientSpec,
) =>
  sampleLayer3ScalarStopsSoftened(
    axisT,
    LAYER3_BLEND_STOPS_DENSE,
    'blend',
    resolveLayer3ScalarSoftness(axisSoftness, spec),
  )

const resolveKingdomGlyphLayer3EndMix = (
  axisT: number,
  axisSoftness = 0,
  spec?: KingdomGlyphGradientSpec,
) =>
  sampleLayer3ScalarStopsSoftened(
    axisT,
    LAYER3_END_MIX_STOPS_DENSE,
    'mix',
    resolveLayer3ScalarSoftness(axisSoftness, spec),
  )

export const resolveKingdomGlyphTripleLayerImageAxisSpec = (
  options?: { preserveColoredPngTexture?: boolean },
): KingdomGlyphGradientSpec => {
  const base = {
    ...KINGDOM_GLYPH_TRIPLE_LAYER_GRADIENT.image,
    stops: [] as const,
  }
  if (!options?.preserveColoredPngTexture) return base
  return {
    ...base,
    gradientAxisSoftness: 0,
    layer3ScalarSoftness: 0,
  }
}

export const resolveKingdomGlyphTripleLayerTextAxisSpec = (): KingdomGlyphGradientSpec => ({
  ...KINGDOM_GLYPH_TRIPLE_LAYER_GRADIENT.text,
  stops: [],
})

export type TripleLayerKingdomImageOptions = {
  bridgeHex: string
  endHex: string
  applyLayer12Tone: boolean
  /** 黑/灰字模走 alpha 遮罩；官方彩色 PNG 为 false 以保留纹理 */
  useAlphaMaskLayer12?: boolean
  textGamutKey?: CustomColorTextGamutKey
}

const resolveLayer12ImageRgb = (
  px: number,
  py: number,
  origR: number,
  origG: number,
  origB: number,
  width: number,
  height: number,
  bridgeHex: string,
  axisSpec: KingdomGlyphGradientSpec,
  textGamutKey: CustomColorTextGamutKey = 'kingdomGlyph',
  useAlphaMaskLayer12 = false,
) => {
  const baseStops =
    resolveKingdomGlyphFillGradientStops(
      bridgeHex,
      NORMAL_KINGDOM_GLYPH_GRADIENT,
      textGamutKey,
    ) ?? []
  if (!baseStops.length) {
    return { red: origR, green: origG, blue: origB }
  }
  const layer12Spec = useAlphaMaskLayer12
    ? { ...axisSpec, useAlphaMaskGradientFill: true }
    : {
        ...NORMAL_KINGDOM_GLYPH_GRADIENT,
        useAlphaMaskGradientFill: false,
        gradientAxisSoftness: 0,
      }
  return sampleKingdomGlyphImageGradientRgb(
    px,
    py,
    origR,
    origG,
    origB,
    width,
    height,
    baseStops,
    layer12Spec,
  )
}

const resolveLayer3EndRgb = (
  axisT: number,
  bridgeRgb: { red: number; green: number; blue: number },
  endRgb: { red: number; green: number; blue: number },
  axisSoftness = 0,
  spec?: KingdomGlyphGradientSpec,
) => {
  const mix = resolveKingdomGlyphLayer3EndMix(axisT, axisSoftness, spec)
  return {
    red: bridgeRgb.red + (endRgb.red - bridgeRgb.red) * mix,
    green: bridgeRgb.green + (endRgb.green - bridgeRgb.green) * mix,
    blue: bridgeRgb.blue + (endRgb.blue - bridgeRgb.blue) * mix,
  }
}

/**
 * 图片三层渐变：Layer1+2（原 PNG 或自定义色停靠渐变）+ Layer3 终点色
 */
export const sampleTripleLayerKingdomImageRgb = (
  px: number,
  py: number,
  origR: number,
  origG: number,
  origB: number,
  width: number,
  height: number,
  options: TripleLayerKingdomImageOptions,
  spec: KingdomGlyphGradientSpec,
) => {
  if (
    !options.useAlphaMaskLayer12 &&
    shouldPreserveKingdomGlyphImageOutlineRgb(origR, origG, origB)
  ) {
    return { red: origR, green: origG, blue: origB }
  }

  const layer12 = options.applyLayer12Tone
    ? resolveLayer12ImageRgb(
        px,
        py,
        origR,
        origG,
        origB,
        width,
        height,
        options.bridgeHex,
        spec,
        options.textGamutKey,
        options.useAlphaMaskLayer12,
      )
    : { red: origR, green: origG, blue: origB }

  const t = resolveKingdomGlyphGradientAxisT(px, py, width, height, spec)
  const axisSoftness = spec.gradientAxisSoftness ?? 0
  const blendW = resolveKingdomGlyphLayer3BlendWeight(t, axisSoftness, spec)
  if (blendW <= 0.001) return layer12

  const bridge = hex2rgb(options.bridgeHex.trim())
  const end = hex2rgb(options.endHex.trim())
  if (!bridge || !end) return layer12

  const layer3Color = resolveLayer3EndRgb(t, bridge, end, axisSoftness, spec)
  return {
    red: Math.round(layer12.red * (1 - blendW) + layer3Color.red * blendW),
    green: Math.round(layer12.green * (1 - blendW) + layer3Color.green * blendW),
    blue: Math.round(layer12.blue * (1 - blendW) + layer3Color.blue * blendW),
  }
}

const hexToRgba = (hex: string, alpha: number) => {
  const rgb = hex2rgb(hex.trim())
  if (!rgb) return `rgba(0,0,0,${alpha})`
  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${alpha})`
}

const lerpHexColor = (fromHex: string, toHex: string, ratio: number) => {
  const from = hex2rgb(fromHex.trim())
  const to = hex2rgb(toHex.trim())
  if (!from || !to) return toHex
  const t = Math.min(1, Math.max(0, ratio))
  return rgbToHex({
    red: Math.round(from.red + (to.red - from.red) * t),
    green: Math.round(from.green + (to.green - from.green) * t),
    blue: Math.round(from.blue + (to.blue - from.blue) * t),
  })
}

/** 文本 Layer3：bridge→终点色按 layer3EndMixStops 过渡，叠加强度由 layer3BlendStops 控制 */
export const buildKingdomGlyphLayer3TextFillStyle = (
  bridgeHex: string,
  endHex: string,
  height: number,
  width: number,
): CustomKingdomTextFillStyle => {
  const spec = resolveKingdomGlyphTripleLayerTextAxisSpec()
  const endPoint = resolveKingdomGlyphGradientEndPoint(width, height, spec)
  const axisSoftness = spec.gradientAxisSoftness ?? 0
  const colorStops: (number | string)[] = []
  const stepCount = Math.round(1 / LAYER3_TEXT_FILL_STEP)
  for (let i = 0; i <= stepCount; i++) {
    const axisT = Math.min(1, i * LAYER3_TEXT_FILL_STEP)
    const blend = resolveKingdomGlyphLayer3BlendWeight(axisT, axisSoftness)
    const mix = resolveKingdomGlyphLayer3EndMix(axisT, axisSoftness)
    const colorHex = lerpHexColor(bridgeHex, endHex, mix)
    colorStops.push(axisT, hexToRgba(colorHex, blend))
  }
  return {
    fillPriority: 'linear-gradient',
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: endPoint,
    fillLinearGradientColorStops: colorStops,
  }
}

/**
 * 神框文字填充：PNG 叠色会按原图明度抬高高光，纯线性渐变略偏深，仅对文本 fill 做明度/饱和度微调。
 */
const SHEN_TEXT_FILL_LIGHTNESS_LIFT = 0.065
/** 文本线性渐变在停靠色基础上略降饱和，减轻自定义色过艳 */
const SHEN_TEXT_FILL_SAT_MUL = 0.9

const liftShenTextFillGradientStops = (stops: ResolvedGradientStop[]) =>
  stops.map((stop) => {
    const hsl = rgbToHsl(stop.rgb.red, stop.rgb.green, stop.rgb.blue)
    const liftedL = clampLightness(
      (stop.shenBandLightness ?? hsl.l) + SHEN_TEXT_FILL_LIGHTNESS_LIFT,
    )
    const baseS = stop.shenLockedHsl?.s ?? hsl.s
    const softenedS = Math.min(1, Math.max(0, baseS * SHEN_TEXT_FILL_SAT_MUL))
    const rgb = hslToneToRgb(
      stop.shenLockedHsl?.h ?? hsl.h,
      softenedS,
      liftedL,
    )
    return {
      ...stop,
      rgb,
      ...(stop.shenBandLightness !== undefined ? { shenBandLightness: liftedL } : {}),
    }
  })

/** Konva 文本 fillLinearGradient*（与图片叠色同源） */
export const buildKingdomGlyphTextFillStyle = (
  hex: string | undefined,
  height: number,
  width: number,
  options?: { shen?: boolean; textGamutKey?: CustomColorTextGamutKey; master?: boolean },
): CustomKingdomTextFillStyle => {
  const spec = resolveCustomKingdomTextFillGradientSpec(
    Boolean(options?.shen),
    Boolean(options?.master),
  )
  let stops = resolveKingdomGlyphFillGradientStops(hex, spec, options?.textGamutKey)
  if (!stops?.length) {
    return { fill: DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR }
  }
  if (options?.shen) {
    stops = liftShenTextFillGradientStops(stops)
  }

  const boxH = Math.max(height, 1)
  const boxW = Math.max(width, 1)
  const endPoint = resolveKingdomGlyphGradientEndPoint(boxW, boxH, spec)

  const colorStops = stops.flatMap((stop) => [stop.position, rgbToHex(stop.rgb)])

  return {
    fillPriority: 'linear-gradient',
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: endPoint,
    fillLinearGradientColorStops: colorStops,
  }
}

/**
 * 图片叠色：神框下 hue/sat 锁定为用户自定义色，沿停靠表只调制明度；
 * 高亮区域 = 自定义色 + customHighlightLightness（brighten: true），非无彩白。
 */
export const sampleKingdomGlyphImageGradientRgb = (
  px: number,
  py: number,
  origR: number,
  origG: number,
  origB: number,
  width: number,
  height: number,
  stops: ResolvedGradientStop[],
  spec: KingdomGlyphGradientSpec,
) => {
  if (shouldPreserveKingdomGlyphImageOutlineRgb(origR, origG, origB) && !spec.useAlphaMaskGradientFill) {
    return { red: origR, green: origG, blue: origB }
  }

  const t = resolveKingdomGlyphGradientAxisT(px, py, width, height, spec)
  const gradient = sampleGradientRgbSoftened(t, stops, spec.gradientAxisSoftness ?? 0)

  if (spec.useAlphaMaskGradientFill) {
    return gradient
  }

  const orig = rgbToHsl(origR, origG, origB)
  const grad = rgbToHsl(gradient.red, gradient.green, gradient.blue)
  const locked = stops.find((stop) => stop.shenLockedHsl)?.shenLockedHsl
  const highlightMix = resolveShenBrightenMixAtT(t, spec)
  const textureMix = spec.imageTextureMix ?? 0.03
  const satFactor = 0.32 + 0.58 * orig.s

  const modulatedL = spec.modulateImageLightness
    ? clampLightness(
        orig.l *
          ((spec.imageLightnessOrigWeight ?? 0.34) +
            (spec.imageLightnessGradWeight ?? 0.68) * grad.l),
      )
    : clampLightness(orig.l)

  const gatedHighlightL = clampLightness(grad.l * resolveShenHighlightEdgeGate(orig.l))
  const outL = clampLightness(modulatedL * (1 - highlightMix) + Math.max(modulatedL, gatedHighlightL) * highlightMix)

  const outH = locked?.h ?? (grad.s < SHEN_CUSTOM_ACHROMATIC_SAT ? 0 : grad.h)
  const outS = Math.min(1, (locked?.s ?? grad.s) * satFactor)
  const out = hslToRgb(outH, outS, outL)

  return {
    red: Math.round(out.red * (1 - textureMix) + origR * textureMix),
    green: Math.round(out.green * (1 - textureMix) + origG * textureMix),
    blue: Math.round(out.blue * (1 - textureMix) + origB * textureMix),
  }
}
