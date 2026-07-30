import { CUSTOM_KINGDOM_CUSTOM_COLOR_SWATCHES } from '@/features/diy-card/constants/customKingdomDefaults'
import {
  CUSTOM_KINGDOM_GLYPH_COLOR_SWATCHES,
  KINGDOM_GLYPH_GRAY_TINT_REFERENCE_HEX,
} from '@/features/diy-card/constants/customKingdomGlyphDefaults'
import { CUSTOM_HP_COLOR_SWATCHES } from '@/features/diy-card/constants/customHpDefaults'
import { CUSTOM_TITLE_COLOR_SWATCHES } from '@/features/diy-card/constants/customTitleDefaults'
import { COLOR_PICKER_HEX_MODES } from '@/shared/constants/colorPicker'
import { hex2rgb, rgbToHsl } from '@/shared/utils/color'

/** 详细设置里各「自定义颜色」取色器（绑定 OtherConfig / LegendConfig 的 n-color-picker） */
export type CustomColorPickerKey = 'kingdomGlyph' | 'hp' | 'title' | 'kingdomCustom' | 'package'

/**
 * 画布 Konva 着色色域（按图层用途区分，互不复用）
 *
 * - userSatScale / userSatCap：用户所选颜色的饱和度上限
 * - baseSatFactor / textureSatWeight：与原图纹理饱和度的混合
 * - maxOutSaturation：输出饱和度硬顶（0–1）
 * - originalMix：保留原像素比例（越小着色越强）
 * - minUserSat：低于此值视为灰阶用户色
 * - grayTintReference：灰阶时沿用的参考 HSL（势力字默认群字银灰），走彩色管线保纹理
 * - chromaticLightnessRef / chromaticLightnessScaleMin|Max：彩色用户色按所选亮度缩放纹理明度（暗色侧保守、亮色侧可略提亮）
 * - chromaticDarkPreserveRatio：用户色偏暗时，单像素明度不低于 orig.l × 该比例，避免纹理糊成一片
 * - textureLightnessPreserve：输出明度向原图 orig.l 回混，保留明暗纹理（仅 frame / 势力图层）
 * - brightDesatStrength / brightDesatSaturationMin：仅对高饱和（及偏亮）用户色额外压饱和
 */
export interface CustomColorTintGamutOptions {
  userSatScale: number
  userSatCap: number
  baseSatFactor: number
  textureSatWeight: number
  maxOutSaturation: number
  originalMix: number
  minUserSat: number
  grayTintReference?: { h: number; s: number; l: number }
  chromaticLightnessRef?: number
  chromaticLightnessScaleMin?: number
  chromaticLightnessScaleMax?: number
  chromaticDarkPreserveRatio?: number
  textureLightnessPreserve?: number
  brightDesatStrength?: number
  brightDesatSaturationMin?: number
}

const resolveGrayTintReferenceHsl = (hex: string) => {
  const rgb = hex2rgb(hex)
  if (!rgb) return undefined
  return rgbToHsl(rgb.red, rgb.green, rgb.blue)
}

/** 自定义势力字（文本模式）渐变/描边色域 */
export interface CustomColorTextGamutOptions {
  darkestSatMul: number
  lightnessShift: number
  darkestLightnessCap: number
  darkestLightnessOffset: number
}

/** `n-color-picker` 面板选项（modes / 预设色块等） */
export interface CustomColorPickerUiOptions {
  modes: typeof COLOR_PICKER_HEX_MODES
  showAlpha: boolean
  swatches?: string[]
}

/**
 * 画布图片模式 Konva `kingdomFrameTint` 色域
 * 与取色器一一对应：势力字 / 体力 / 边框 / 自定义势力图层
 */
export type CustomColorTintGamutKey =
  | 'kingdomGlyph'
  | 'hp'
  | 'frame'
  | 'kingdomCustom'
  | 'package'

/** 势力字（图片模式滤镜 + 单独变色） */
const KINGDOM_GLYPH_TINT_GAMUT: CustomColorTintGamutOptions = {
  userSatScale: 1,
  userSatCap: 1,
  baseSatFactor: 0.52,
  textureSatWeight: 0.95,
  maxOutSaturation: 0.98,
  originalMix: 0.03,
  minUserSat: 0.02,
  grayTintReference: resolveGrayTintReferenceHsl(KINGDOM_GLYPH_GRAY_TINT_REFERENCE_HEX),
}

/** 体力图标 */
const HP_TINT_GAMUT: CustomColorTintGamutOptions = {
  userSatScale: 0.95,
  userSatCap: 0.92,
  baseSatFactor: 0.34,
  textureSatWeight: 0.82,
  maxOutSaturation: 0.88,
  originalMix: 0.06,
  minUserSat: 0.035,
}

/** 边框底图 frame + 两侧 kingdom_frame（自定义势力色着色时） */
const FRAME_TINT_GAMUT: CustomColorTintGamutOptions = {
  userSatScale: 1,
  userSatCap: 1,
  baseSatFactor: 0.32,
  textureSatWeight: 0.9,
  maxOutSaturation: 0.9,
  originalMix: 0.08,
  minUserSat: 0.02,
  chromaticLightnessRef: 0.38,
  chromaticLightnessScaleMin: 0.9,
  chromaticLightnessScaleMax: 1.1,
  chromaticDarkPreserveRatio: 0.58,
  textureLightnessPreserve: 0.3,
  brightDesatStrength: 0.38,
  brightDesatSaturationMin: 0.8,
}

/** 自定义势力模式下的势力图层图片着色 */
const KINGDOM_CUSTOM_LAYER_TINT_GAMUT: CustomColorTintGamutOptions = {
  ...FRAME_TINT_GAMUT,
}

/** 文字角标底图（blood_point / ccxh）：略强着色，接近旧站 hue-rotate 观感 */
const PACKAGE_TEXT_BG_TINT_GAMUT: CustomColorTintGamutOptions = {
  userSatScale: 1,
  userSatCap: 1,
  baseSatFactor: 0.42,
  textureSatWeight: 0.92,
  maxOutSaturation: 0.96,
  originalMix: 0.02,
  minUserSat: 0.02,
}

export const CUSTOM_COLOR_TINT_GAMUT: Record<
  CustomColorTintGamutKey,
  CustomColorTintGamutOptions
> = {
  kingdomGlyph: KINGDOM_GLYPH_TINT_GAMUT,
  hp: HP_TINT_GAMUT,
  frame: FRAME_TINT_GAMUT,
  kingdomCustom: KINGDOM_CUSTOM_LAYER_TINT_GAMUT,
  package: PACKAGE_TEXT_BG_TINT_GAMUT,
}

const KINGDOM_GLYPH_TEXT_GAMUT: CustomColorTextGamutOptions = {
  darkestSatMul: 0.64,
  lightnessShift: -0.02,
  darkestLightnessCap: 0.88,
  darkestLightnessOffset: 0.15,
}

const KINGDOM_CUSTOM_TEXT_GAMUT: CustomColorTextGamutOptions = {
  darkestSatMul: 0.48,
  lightnessShift: -0.03,
  darkestLightnessCap: 0.83,
  darkestLightnessOffset: 0.13,
}

/** 自定义势力字文本叠层（势力字单独变色 / 自定义势力文字） */
export type CustomColorTextGamutKey = 'kingdomGlyph' | 'kingdomCustom'

export const CUSTOM_COLOR_TEXT_GAMUT: Record<
  CustomColorTextGamutKey,
  CustomColorTextGamutOptions
> = {
  kingdomGlyph: KINGDOM_GLYPH_TEXT_GAMUT,
  kingdomCustom: KINGDOM_CUSTOM_TEXT_GAMUT,
}

/** 各取色器 UI（绑定到 OtherConfig 的 n-color-picker） */
export const CUSTOM_COLOR_PICKER_UI: Record<CustomColorPickerKey, CustomColorPickerUiOptions> = {
  kingdomGlyph: {
    modes: COLOR_PICKER_HEX_MODES,
    showAlpha: false,
    swatches: CUSTOM_KINGDOM_GLYPH_COLOR_SWATCHES,
  },
  hp: {
    modes: COLOR_PICKER_HEX_MODES,
    showAlpha: false,
    swatches: CUSTOM_HP_COLOR_SWATCHES,
  },
  title: {
    modes: COLOR_PICKER_HEX_MODES,
    showAlpha: false,
    swatches: CUSTOM_TITLE_COLOR_SWATCHES,
  },
  kingdomCustom: {
    modes: COLOR_PICKER_HEX_MODES,
    showAlpha: false,
    swatches: CUSTOM_KINGDOM_CUSTOM_COLOR_SWATCHES,
  },
  package: {
    modes: COLOR_PICKER_HEX_MODES,
    showAlpha: false,
  },
}
