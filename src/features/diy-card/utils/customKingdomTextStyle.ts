import { DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR } from '@/features/diy-card/constants/customKingdomDefaults'
import type { CustomColorTextGamutKey } from '@/features/diy-card/constants/customColorPickerOptions'
import {
  buildKingdomGlyphTextFillStyle,
  buildKingdomGlyphLayer3TextFillStyle,
  type CustomKingdomTextFillStyle,
} from '@/features/diy-card/utils/kingdomGlyphFillGradient'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import { hex2rgb, hslToRgb, rgbToHex, rgbToHsl } from '@/shared/utils/color'

/** 神势力字外发光杂色颗粒（RGB，不含 alpha） */
const SHEN_KINGDOM_TEXT_GLOW_GRAIN_PALETTE = [
  [255, 248, 200],
  [255, 238, 170],
  [255, 252, 225],
  [248, 228, 155],
  [255, 244, 185],
] as const

export type { CustomKingdomTextFillStyle } from '@/features/diy-card/utils/kingdomGlyphFillGradient'

export type CustomKingdomTextLayerInput = {
  code: string
  name: string
  text: string
  fontSize: number
  /** 当前字号（pt），用于按 20pt 标定值等比缩放描边/阴影 */
  fontSizePt: number
  fontFamily: string
  width: number
  height: number
  listening?: boolean
}

/** 视觉效果标定字号（pt）；描边/阴影/发光参数均按此字号调参 */
export const KINGDOM_TEXT_STYLE_REF_FONT_PT = 20

const scaleKingdomTextFromRefPt = (valueAtRefPt: number, fontSizePt: number) =>
  valueAtRefPt * (fontSizePt / KINGDOM_TEXT_STYLE_REF_FONT_PT)

const kingdomTextBoxMetric = (mul: number, boxH: number) => boxH * mul

const resolveKingdomTextRgb = (hex: string | undefined) => {
  const rgb = hex2rgb(hex?.trim() || DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR)
  if (!rgb) return null
  return { rgb, hsl: rgbToHsl(rgb.red, rgb.green, rgb.blue) }
}

type KingdomTextGlowSpec = {
  fill: string
  shadowColor: string
  shadowBlurMul: number
}

const buildKingdomTextGlowSpecs = (
  hex: string | undefined,
  shen: boolean,
): KingdomTextGlowSpec[] => {
  if (shen) {
    return []
  }

  const resolved = resolveKingdomTextRgb(hex)
  if (!resolved) {
    return [
      {
        fill: 'rgba(209, 49, 93, 0.34)',
        shadowColor: 'rgba(209, 49, 93, 0.76)',
        shadowBlurMul: 0.18,
      },
    ]
  }

  const { rgb, hsl } = resolved
  const { h, s } = hsl
  const soft = rgbToHex(hslToRgb(h, Math.min(0.55, s * 0.45), 0.88))
  const mid = rgbToHex(hslToRgb(h, Math.min(0.65, s * 0.55), 0.78))
  const outerFill = `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.34)`
  const outerShadow = `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.76)`

  return [
    {
      fill: outerFill,
      shadowColor: outerShadow,
      shadowBlurMul: 0.18,
    },
    {
      fill: `${soft}72`,
      shadowColor: `${mid}a8`,
      shadowBlurMul: 0.12,
    },
  ]
}

const buildKingdomTextGlowLayerConfigs = (
  code: string,
  name: string,
  textBase: Record<string, unknown>,
  boxH: number,
  specs: KingdomTextGlowSpec[],
): CanvasItemConfig[] =>
  specs.map((spec, index) => ({
    code: `${code}-glow-outer-${index + 1}`,
    name: `${name}-外发光-${index + 1}`,
    ...textBase,
    fill: spec.fill,
    shadowColor: spec.shadowColor,
    shadowBlur: kingdomTextBoxMetric(spec.shadowBlurMul, boxH),
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    listening: false,
  })) as CanvasItemConfig[]

type KingdomTextGlowGrainSpec = {
  shadowColor: string
  shadowBlurMul: number
  offsetXMul: number
  offsetYMul: number
}

/** 外发光杂色颗粒：固定角度分布，导出/预览结果一致 */
const KINGDOM_TEXT_GLOW_GRAIN_PATTERN = [
  { angle: 0.04, dist: 0.017, hueShift: -16, satMul: 0.9, light: 0.84, alpha: 0.34, blurMul: 0.0085 },
  { angle: 0.14, dist: 0.013, hueShift: 11, satMul: 1.06, light: 0.9, alpha: 0.28, blurMul: 0.0065 },
  { angle: 0.23, dist: 0.019, hueShift: -8, satMul: 0.95, light: 0.88, alpha: 0.31, blurMul: 0.0075 },
  { angle: 0.33, dist: 0.012, hueShift: 18, satMul: 1.1, light: 0.92, alpha: 0.24, blurMul: 0.0055 },
  { angle: 0.42, dist: 0.016, hueShift: -5, satMul: 0.88, light: 0.86, alpha: 0.3, blurMul: 0.007 },
  { angle: 0.51, dist: 0.014, hueShift: 14, satMul: 1.02, light: 0.91, alpha: 0.27, blurMul: 0.006 },
  { angle: 0.61, dist: 0.018, hueShift: -12, satMul: 0.93, light: 0.87, alpha: 0.32, blurMul: 0.008 },
  { angle: 0.69, dist: 0.011, hueShift: 9, satMul: 1.08, light: 0.93, alpha: 0.22, blurMul: 0.005 },
  { angle: 0.78, dist: 0.015, hueShift: -18, satMul: 0.86, light: 0.85, alpha: 0.29, blurMul: 0.0068 },
  { angle: 0.86, dist: 0.013, hueShift: 7, satMul: 1.04, light: 0.89, alpha: 0.26, blurMul: 0.0062 },
  { angle: 0.93, dist: 0.017, hueShift: -10, satMul: 0.97, light: 0.88, alpha: 0.3, blurMul: 0.0072 },
  { angle: 0.98, dist: 0.012, hueShift: 16, satMul: 1.12, light: 0.94, alpha: 0.23, blurMul: 0.0058 },
] as const

const buildKingdomTextGlowGrainColor = (
  pattern: (typeof KINGDOM_TEXT_GLOW_GRAIN_PATTERN)[number],
  shen: boolean,
  hsl: { h: number; s: number; l: number } | null,
) => {
  if (shen) {
    const palette = SHEN_KINGDOM_TEXT_GLOW_GRAIN_PALETTE
    const pick = palette[Math.floor(pattern.angle * 100) % palette.length] ?? palette[0]
    return `rgba(${pick[0]}, ${pick[1]}, ${pick[2]}, ${pattern.alpha})`
  }

  if (!hsl) {
    return `rgba(209, 49, 93, ${pattern.alpha})`
  }

  const hue = (hsl.h * 360 + pattern.hueShift + 360) % 360 / 360
  const tinted = hslToRgb(
    hue,
    Math.min(1, Math.max(0, hsl.s * pattern.satMul)),
    Math.min(0.96, Math.max(0.72, pattern.light)),
  )
  return `rgba(${tinted.red}, ${tinted.green}, ${tinted.blue}, ${pattern.alpha})`
}

const buildKingdomTextGlowGrainSpecs = (
  hex: string | undefined,
  shen: boolean,
): KingdomTextGlowGrainSpec[] => {
  if (shen) {
    return []
  }

  const resolved = resolveKingdomTextRgb(hex)

  return KINGDOM_TEXT_GLOW_GRAIN_PATTERN.map((pattern) => {
    const angleRad = pattern.angle * Math.PI * 2
    return {
      shadowColor: buildKingdomTextGlowGrainColor(pattern, shen, resolved?.hsl ?? null),
      shadowBlurMul: pattern.blurMul,
      offsetXMul: Math.cos(angleRad) * pattern.dist,
      offsetYMul: Math.sin(angleRad) * pattern.dist,
    }
  })
}

const buildKingdomTextGlowGrainLayerConfigs = (
  code: string,
  name: string,
  textBase: Record<string, unknown>,
  boxH: number,
  specs: KingdomTextGlowGrainSpec[],
): CanvasItemConfig[] =>
  specs.map((spec, index) => ({
    code: `${code}-glow-grain-${index + 1}`,
    name: `${name}-外发光-杂色-${index + 1}`,
    ...textBase,
    fill: 'rgba(255, 255, 255, 0)',
    shadowColor: spec.shadowColor,
    shadowBlur: kingdomTextBoxMetric(spec.shadowBlurMul, boxH),
    shadowOffsetX: kingdomTextBoxMetric(spec.offsetXMul, boxH),
    shadowOffsetY: kingdomTextBoxMetric(spec.offsetYMul, boxH),
    listening: false,
  })) as CanvasItemConfig[]

type KingdomTextTightShadowSpec = {
  fill: string
  shadowColor: string
  blurMul: number
}

/** 叠影模拟黑边：10 档渐变，略降浓度避免过深 */
const KINGDOM_TEXT_TIGHT_SHADOW_LAYERS: KingdomTextTightShadowSpec[] = [
  {
    fill: 'rgba(0, 0, 0, 0.38)',
    shadowColor: 'rgba(0, 0, 0, 0.34)',
    blurMul: 0.179,
  },
  {
    fill: 'rgba(0, 0, 0, 0.42)',
    shadowColor: 'rgba(0, 0, 0, 0.38)',
    blurMul: 0.162,
  },
  {
    fill: 'rgba(0, 0, 0, 0.47)',
    shadowColor: 'rgba(0, 0, 0, 0.43)',
    blurMul: 0.146,
  },
  {
    fill: 'rgba(0, 0, 0, 0.51)',
    shadowColor: 'rgba(0, 0, 0, 0.47)',
    blurMul: 0.131,
  },
  {
    fill: 'rgba(0, 0, 0, 0.54)',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    blurMul: 0.118,
  },
  {
    fill: 'rgba(0, 0, 0, 0.57)',
    shadowColor: 'rgba(0, 0, 0, 0.53)',
    blurMul: 0.106,
  },
  {
    fill: 'rgba(0, 0, 0, 0.58)',
    shadowColor: 'rgba(0, 0, 0, 0.54)',
    blurMul: 0.095,
  },
  {
    fill: 'rgba(0, 0, 0, 0.61)',
    shadowColor: 'rgba(0, 0, 0, 0.57)',
    blurMul: 0.085,
  },
  {
    fill: 'rgba(0, 0, 0, 0.64)',
    shadowColor: 'rgba(0, 0, 0, 0.6)',
    blurMul: 0.076,
  },
  {
    fill: 'rgba(0, 0, 0, 0.66)',
    shadowColor: 'rgba(0, 0, 0, 0.62)',
    blurMul: 0.068,
  },
]

const KINGDOM_TEXT_TIGHT_SHADOW_STACK_COUNT = 2

type KingdomTextInnerGlowSpec = {
  stroke: string
  /** 20pt 标定下的描边宽（px） */
  strokeWidthAtRefPt: number
}

const buildKingdomTextInnerGlowSpecs = (
  hex: string | undefined,
  shen: boolean,
): KingdomTextInnerGlowSpec[] => {
  if (shen) {
    return []
  }

  const resolved = resolveKingdomTextRgb(hex)
  const midTint = resolved
    ? rgbToHex(
        hslToRgb(
          resolved.hsl.h,
          Math.min(0.42, resolved.hsl.s * 0.38),
          Math.min(0.94, resolved.hsl.l + 0.28),
        ),
      )
    : '#f0c8d4'

  return [
    { stroke: `${midTint}38`, strokeWidthAtRefPt: 0.23 },
    { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidthAtRefPt: 0.19 },
    { stroke: 'rgba(255, 255, 255, 0.6)', strokeWidthAtRefPt: 0.17 },
  ]
}

const buildKingdomTextInnerGlowLayerConfigs = (
  code: string,
  name: string,
  textBase: Record<string, unknown>,
  fontSizePt: number,
  specs: KingdomTextInnerGlowSpec[],
): CanvasItemConfig[] =>
  specs.map((spec, index) => ({
    code: `${code}-inner-glow-${index + 1}`,
    name: `${name}-内发光-${index + 1}`,
    ...textBase,
    fill: 'rgba(255, 255, 255, 0)',
    stroke: spec.stroke,
    strokeWidth: scaleKingdomTextFromRefPt(spec.strokeWidthAtRefPt, fontSizePt),
    globalCompositeOperation: 'source-atop',
    listening: false,
  })) as CanvasItemConfig[]

const buildKingdomTextTightShadowCoreLayerConfigs = (
  code: string,
  name: string,
  textBase: Record<string, unknown>,
  boxH: number,
  stackIndex: number,
): CanvasItemConfig[] => {
  const suffix = stackIndex > 0 ? `-s${stackIndex + 1}` : ''

  return [
    {
      code: `${code}-tight-shadow-core-1${suffix}`,
      name: `${name}-叠影-核1${suffix}`,
      ...textBase,
      fill: 'rgba(0, 0, 0, 0.63)',
      shadowColor: 'rgba(0, 0, 0, 0.59)',
      shadowBlur: kingdomTextBoxMetric(0.016, boxH),
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      listening: false,
    },
    {
      code: `${code}-tight-shadow-core-2${suffix}`,
      name: `${name}-叠影-核2${suffix}`,
      ...textBase,
      fill: 'rgba(0, 0, 0, 0.59)',
      shadowColor: 'rgba(0, 0, 0, 0.55)',
      shadowBlur: kingdomTextBoxMetric(0.011, boxH),
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      listening: false,
    },
    {
      code: `${code}-tight-shadow-core-3${suffix}`,
      name: `${name}-叠影-核3${suffix}`,
      ...textBase,
      fill: 'rgba(0, 0, 0, 0.55)',
      listening: false,
    },
  ] as CanvasItemConfig[]
}

const buildKingdomTextTightShadowLayerConfigs = (
  code: string,
  name: string,
  textBase: Record<string, unknown>,
  boxH: number,
): CanvasItemConfig[] => {
  const layers: CanvasItemConfig[] = []

  for (let stack = 0; stack < KINGDOM_TEXT_TIGHT_SHADOW_STACK_COUNT; stack++) {
    const layerOffset = stack * KINGDOM_TEXT_TIGHT_SHADOW_LAYERS.length

    layers.push(
      ...KINGDOM_TEXT_TIGHT_SHADOW_LAYERS.map((spec, index) => ({
        code: `${code}-tight-shadow-${layerOffset + index + 1}`,
        name: `${name}-叠影-${layerOffset + index + 1}`,
        ...textBase,
        fill: spec.fill,
        shadowColor: spec.shadowColor,
        shadowBlur: kingdomTextBoxMetric(spec.blurMul, boxH),
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        listening: false,
      })) as CanvasItemConfig[],
    )

    layers.push(
      ...buildKingdomTextTightShadowCoreLayerConfigs(code, name, textBase, boxH, stack),
    )
  }

  return layers
}

/** 自定义势力字填充（渐变停靠见 constants `CUSTOM_KINGDOM_GLYPH_TEXT_FILL_STOPS`） */
export const buildCustomKingdomTextFillStyle = (
  hex: string | undefined,
  height: number,
  width: number,
  options?: { textGamutKey?: CustomColorTextGamutKey; master?: boolean },
): CustomKingdomTextFillStyle =>
  buildKingdomGlyphTextFillStyle(hex, height, width, {
    shen: false,
    textGamutKey: options?.textGamutKey,
    master: options?.master,
  })

/** 神框 / 神势力自定义字填充（渐变停靠见 constants `CUSTOM_SHEN_KINGDOM_GLYPH_TEXT_BRIGHTEN_STOPS`） */
export const buildCustomShenKingdomTextFillStyle = (
  hex: string | undefined,
  height: number,
  width: number,
  options?: { textGamutKey?: CustomColorTextGamutKey; master?: boolean },
): CustomKingdomTextFillStyle =>
  buildKingdomGlyphTextFillStyle(hex, height, width, {
    shen: true,
    textGamutKey: options?.textGamutKey,
    master: options?.master,
  })

/**
 * 自定义势力字叠层：外发光 → 叠影 → 渐变填充 → 内发光
 * 神框：仅叠影 + 渐变填充（白/自定义色条带在 fill 内，无外发光/内发光溢出）
 */
export const buildCustomKingdomTextLayerConfigs = (
  input: CustomKingdomTextLayerInput,
  hex: string | undefined,
  options?: {
    shen?: boolean
    textGamutKey?: CustomColorTextGamutKey
    master?: boolean
    officialGradient?: { endHex: string }
  },
): CanvasItemConfig[] => {
  const { code, name, text, fontSize, fontSizePt, fontFamily, width, height } = input
  const boxH = Math.max(height, 1)
  const isShen = Boolean(options?.shen)
  const textGamutKey = options?.textGamutKey
  const master = Boolean(options?.master)
  const boxW = Math.max(width, 1)

  const textBase = {
    text,
    fontSize,
    fontFamily,
    width,
    height,
    originX: 0,
    originY: 0,
    align: 'center' as const,
    verticalAlign: 'middle' as const,
    perfectDrawEnabled: false,
    lineJoin: 'round' as const,
    lineCap: 'round' as const,
  }

  const fillStyle: CustomKingdomTextFillStyle = isShen
    ? buildCustomShenKingdomTextFillStyle(hex, boxH, boxW, { textGamutKey, master })
    : buildCustomKingdomTextFillStyle(hex, boxH, boxW, { textGamutKey, master })
  const glowSpecs = buildKingdomTextGlowSpecs(hex, isShen)
  const glowGrainSpecs = buildKingdomTextGlowGrainSpecs(hex, isShen)
  const innerGlowSpecs = buildKingdomTextInnerGlowSpecs(hex, isShen)
  const listening = input.listening ?? false

  const layerConfigs: CanvasItemConfig[] = [
    ...buildKingdomTextGlowLayerConfigs(code, name, textBase, boxH, glowSpecs),
    ...buildKingdomTextGlowGrainLayerConfigs(code, name, textBase, boxH, glowGrainSpecs),
    ...buildKingdomTextTightShadowLayerConfigs(code, name, textBase, boxH),
    {
      code: `${code}-fill`,
      name,
      ...textBase,
      ...fillStyle,
      listening,
    },
  ]

  if (options?.officialGradient) {
    layerConfigs.push({
      code: `${code}-fill-layer3`,
      name: `${name}-终点色渐变`,
      ...textBase,
      ...buildKingdomGlyphLayer3TextFillStyle(
        hex ?? '',
        options.officialGradient.endHex,
        boxH,
        boxW,
      ),
      globalCompositeOperation: 'source-atop',
      listening: false,
    })
  }

  layerConfigs.push(
    ...buildKingdomTextInnerGlowLayerConfigs(code, name, textBase, fontSizePt, innerGlowSpecs),
  )

  return layerConfigs
}

export type PresetKingdomImageLayerInput = {
  code: string
  name: string
  image: HTMLImageElement
  width: number
  height: number
  /** 当前字号（pt），用于按 20pt 标定值等比缩放内发光 */
  fontSizePt: number
  listening?: boolean
}

const parseCssColorAlpha = (color: string): number => {
  const rgbaMatch = color.match(
    /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+))?\s*\)/,
  )
  if (rgbaMatch) {
    return rgbaMatch[1] !== undefined ? Number.parseFloat(rgbaMatch[1]) : 1
  }
  if (color.length === 9 && color.startsWith('#')) {
    return Number.parseInt(color.slice(7, 9), 16) / 255
  }
  if (color.length === 5 && color.startsWith('#')) {
    const alphaNibble = color.slice(4, 5)
    return Number.parseInt(`${alphaNibble}${alphaNibble}`, 16) / 255
  }
  return 1
}

const buildKingdomImageShadowLayerConfig = (
  code: string,
  name: string,
  imageBase: Record<string, unknown>,
  boxH: number,
  layerCode: string,
  layerLabel: string,
  spec: {
    fill?: string
    shadowColor?: string
    blurMul?: number
    shadowBlur?: number
    shadowOffsetX?: number
    shadowOffsetY?: number
  },
  extra: Record<string, unknown> = {},
): CanvasItemConfig => {
  const fillAlpha = spec.fill ? parseCssColorAlpha(spec.fill) : 0
  const shadowBlur =
    spec.shadowBlur ??
    (spec.blurMul !== undefined ? kingdomTextBoxMetric(spec.blurMul, boxH) : undefined)
  return {
    code: layerCode,
    name: `${name}-${layerLabel}`,
    ...imageBase,
    opacity: fillAlpha,
    ...(spec.shadowColor ? { shadowColor: spec.shadowColor } : {}),
    ...(shadowBlur !== undefined ? { shadowBlur } : {}),
    shadowOffsetX: spec.shadowOffsetX ?? 0,
    shadowOffsetY: spec.shadowOffsetY ?? 0,
    ...(fillAlpha <= 0 && spec.shadowColor
      ? { shadowOpacity: 1, shadowEnabled: true }
      : {}),
    listening: false,
    ...extra,
  } as CanvasItemConfig
}

const buildKingdomImageGlowLayerConfigs = (
  code: string,
  name: string,
  imageBase: Record<string, unknown>,
  boxH: number,
  specs: KingdomTextGlowSpec[],
): CanvasItemConfig[] =>
  specs.map((spec, index) =>
    buildKingdomImageShadowLayerConfig(
      code,
      name,
      imageBase,
      boxH,
      `${code}-glow-outer-${index + 1}`,
      `外发光-${index + 1}`,
      {
        fill: spec.fill,
        shadowColor: spec.shadowColor,
        blurMul: spec.shadowBlurMul,
      },
    ),
  )

const buildKingdomImageGlowGrainLayerConfigs = (
  code: string,
  name: string,
  imageBase: Record<string, unknown>,
  boxH: number,
  specs: KingdomTextGlowGrainSpec[],
): CanvasItemConfig[] =>
  specs.map((spec, index) =>
    buildKingdomImageShadowLayerConfig(
      code,
      name,
      imageBase,
      boxH,
      `${code}-glow-grain-${index + 1}`,
      `外发光-杂色-${index + 1}`,
      {
        fill: 'rgba(255, 255, 255, 0)',
        shadowColor: spec.shadowColor,
        blurMul: spec.shadowBlurMul,
        shadowOffsetX: kingdomTextBoxMetric(spec.offsetXMul, boxH),
        shadowOffsetY: kingdomTextBoxMetric(spec.offsetYMul, boxH),
      },
    ),
  )

const buildKingdomImageTightShadowCoreLayerConfigs = (
  code: string,
  name: string,
  imageBase: Record<string, unknown>,
  boxH: number,
  stackIndex: number,
): CanvasItemConfig[] => {
  const suffix = stackIndex > 0 ? `-s${stackIndex + 1}` : ''

  return [
    buildKingdomImageShadowLayerConfig(
      code,
      name,
      imageBase,
      boxH,
      `${code}-tight-shadow-core-1${suffix}`,
      `叠影-核1${suffix}`,
      {
        fill: 'rgba(0, 0, 0, 0.63)',
        shadowColor: 'rgba(0, 0, 0, 0.59)',
        blurMul: 0.016,
      },
    ),
    buildKingdomImageShadowLayerConfig(
      code,
      name,
      imageBase,
      boxH,
      `${code}-tight-shadow-core-2${suffix}`,
      `叠影-核2${suffix}`,
      {
        fill: 'rgba(0, 0, 0, 0.59)',
        shadowColor: 'rgba(0, 0, 0, 0.55)',
        blurMul: 0.011,
      },
    ),
    buildKingdomImageShadowLayerConfig(
      code,
      name,
      imageBase,
      boxH,
      `${code}-tight-shadow-core-3${suffix}`,
      `叠影-核3${suffix}`,
      { fill: 'rgba(0, 0, 0, 0.55)' },
    ),
  ]
}

const buildKingdomImageTightShadowLayerConfigs = (
  code: string,
  name: string,
  imageBase: Record<string, unknown>,
  boxH: number,
): CanvasItemConfig[] => {
  const layers: CanvasItemConfig[] = []

  for (let stack = 0; stack < KINGDOM_TEXT_TIGHT_SHADOW_STACK_COUNT; stack++) {
    const layerOffset = stack * KINGDOM_TEXT_TIGHT_SHADOW_LAYERS.length

    layers.push(
      ...KINGDOM_TEXT_TIGHT_SHADOW_LAYERS.map((spec, index) =>
        buildKingdomImageShadowLayerConfig(
          code,
          name,
          imageBase,
          boxH,
          `${code}-tight-shadow-${layerOffset + index + 1}`,
          `叠影-${layerOffset + index + 1}`,
          {
            fill: spec.fill,
            shadowColor: spec.shadowColor,
            blurMul: spec.blurMul,
          },
        ),
      ),
    )

    layers.push(
      ...buildKingdomImageTightShadowCoreLayerConfigs(code, name, imageBase, boxH, stack),
    )
  }

  return layers
}

const buildKingdomImageInnerGlowLayerConfigs = (
  code: string,
  name: string,
  imageBase: Record<string, unknown>,
  fontSizePt: number,
  specs: KingdomTextInnerGlowSpec[],
): CanvasItemConfig[] =>
  specs.map((spec, index) =>
    buildKingdomImageShadowLayerConfig(
      code,
      name,
      imageBase,
      1,
      `${code}-inner-glow-${index + 1}`,
      `内发光-${index + 1}`,
      {
        fill: 'rgba(255, 255, 255, 0)',
        shadowColor: spec.stroke,
        shadowBlur: scaleKingdomTextFromRefPt(spec.strokeWidthAtRefPt, fontSizePt),
      },
      { globalCompositeOperation: 'source-atop' },
    ),
  )

/**
 * 预设势力 PNG 叠层：外发光 → 叠影 → 渐变填充 → 内发光
 * 参数与 {@link buildCustomKingdomTextLayerConfigs} 同源；阴影 blur 按 width（字号方盒边长）标定，与文字 height 一致
 */
export const buildPresetKingdomImageLayerConfigs = (
  input: PresetKingdomImageLayerInput,
  hex: string | undefined,
  options?: { shen?: boolean; master?: boolean },
): CanvasItemConfig[] => {
  const { code, name, image, width, height, fontSizePt } = input
  // 阴影/发光标定高度：与自定义势力字 boxH 一致（字号方盒边长），勿用 PNG 视觉高度
  const boxH = Math.max(width, 1)
  const isShen = Boolean(options?.shen)
  const listening = input.listening ?? false

  const imageBase = {
    image,
    width,
    height,
    originX: 0,
    originY: 0,
  }

  const glowSpecs = buildKingdomTextGlowSpecs(hex, isShen)
  const glowGrainSpecs = buildKingdomTextGlowGrainSpecs(hex, isShen)
  const innerGlowSpecs = buildKingdomTextInnerGlowSpecs(hex, isShen)

  return [
    ...buildKingdomImageGlowLayerConfigs(code, name, imageBase, boxH, glowSpecs),
    ...buildKingdomImageGlowGrainLayerConfigs(code, name, imageBase, boxH, glowGrainSpecs),
    ...buildKingdomImageTightShadowLayerConfigs(code, name, imageBase, boxH),
    {
      code: `${code}-fill`,
      name,
      ...imageBase,
      listening,
    },
    ...buildKingdomImageInnerGlowLayerConfigs(code, name, imageBase, fontSizePt, innerGlowSpecs),
  ]
}
