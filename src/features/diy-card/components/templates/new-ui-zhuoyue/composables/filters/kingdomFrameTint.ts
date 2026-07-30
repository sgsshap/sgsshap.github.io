import type {
  CustomColorTintGamutKey,
  CustomColorTintGamutOptions,
} from '@/features/diy-card/constants/customColorPickerOptions'
import { CUSTOM_COLOR_TINT_GAMUT } from '@/features/diy-card/constants/customColorPickerOptions'
import { preserveKingdomGlyphImageOutlineRgb } from '@/features/diy-card/utils/kingdomGlyphFillGradient'
import { hslToRgb, rgbToHsl } from '@/shared/utils/color'
import Konva from 'konva'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** 仅对高饱和（及偏亮）用户色略压饱和，避免大红大黄等在边框上过艳 */
const applyBrightColorDesaturation = (
  user: { h: number; s: number; l: number },
  sat: number,
  options: CustomColorTintGamutOptions,
) => {
  const strength = options.brightDesatStrength ?? 0
  if (strength <= 0) return sat

  const sMin = options.brightDesatSaturationMin ?? 0.85
  if (user.s < sMin) return sat

  const vivid = clamp((user.s - sMin) / (1 - sMin), 0, 1)
  const lightBoost =
    user.l >= 0.38 ? clamp((user.l - 0.38) / 0.22, 0, 1) : 0
  const desat = strength * vivid * (0.55 + 0.45 * lightBoost)
  return sat * (1 - desat)
}

const resolveChromaticLightnessScale = (
  user: { l: number },
  options: CustomColorTintGamutOptions,
) => {
  if (options.chromaticLightnessRef == null) return 1

  const ref = options.chromaticLightnessRef
  const min = options.chromaticLightnessScaleMin ?? 0.78
  const max = options.chromaticLightnessScaleMax ?? 1.22

  if (user.l <= ref) {
    return min + (1 - min) * (user.l / ref)
  }
  const t = clamp((user.l - ref) / (1 - ref), 0, 1)
  return 1 + (max - 1) * t
}

const resolveChromaticOutputLightness = (
  origL: number,
  lightnessScale: number,
  user: { l: number },
  options: CustomColorTintGamutOptions,
) => {
  const scaled = origL * lightnessScale
  const ref = options.chromaticLightnessRef
  const preserve = options.chromaticDarkPreserveRatio
  if (ref != null && preserve != null && user.l < ref) {
    return clamp(Math.max(scaled, origL * preserve), 0.02, 0.98)
  }
  return clamp(scaled, 0.02, 0.98)
}

/** 灰阶用户色：参考群字 HSL + 用户亮度；彩色用户色：沿用所选色相 */
const resolveTintColor = (
  user: { h: number; s: number; l: number },
  options: CustomColorTintGamutOptions,
) => {
  const isAchromatic = user.s < options.minUserSat
  if (isAchromatic && options.grayTintReference) {
    const ref = options.grayTintReference
    const sat = Math.min(ref.s * options.userSatScale, options.userSatCap)
    const lightnessScale =
      ref.l > 0.02 ? clamp(user.l / ref.l, 0.55, 1.45) : 1
    return { hue: ref.h, sat, lightnessScale }
  }
  if (isAchromatic) {
    const sat = Math.min(options.minUserSat * options.userSatScale, options.userSatCap)
    return { hue: user.h, sat, lightnessScale: 1 }
  }
  let sat = Math.min(user.s * options.userSatScale, options.userSatCap)
  sat = applyBrightColorDesaturation(user, sat, options)
  return {
    hue: user.h,
    sat,
    lightnessScale: resolveChromaticLightnessScale(user, options),
  }
}

/** 按取色器配置生成 Konva 像素滤镜：保留原图亮度纹理，替换用户色相或群字式银灰 */
export function createKingdomFrameTintFilter(options: CustomColorTintGamutOptions) {
  return function kingdomFrameTintFilter(this: Konva.Node, imageData: ImageData) {
    const data = imageData.data
    const ur = this.red()
    const ug = this.green()
    const ub = this.blue()
    const user = rgbToHsl(ur, ug, ub)
    const { hue, sat, lightnessScale } = resolveTintColor(user, options)
    const mix = options.originalMix

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] ?? 255
      if (a < 6) continue
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      if (preserveKingdomGlyphImageOutlineRgb(r, g, b)) continue
      const orig = rgbToHsl(r, g, b)
      let outS = sat * (options.baseSatFactor + options.textureSatWeight * orig.s)
      outS = Math.min(outS, options.maxOutSaturation)
      const tintedL = resolveChromaticOutputLightness(orig.l, lightnessScale, user, options)
      const lPreserve = options.textureLightnessPreserve ?? 0
      const outL =
        lPreserve > 0
          ? clamp(orig.l * lPreserve + tintedL * (1 - lPreserve), 0.02, 0.98)
          : tintedL
      const tinted = hslToRgb(hue, outS, outL)
      data[i] = Math.round(tinted.red * (1 - mix) + r * mix)
      data[i + 1] = Math.round(tinted.green * (1 - mix) + g * mix)
      data[i + 2] = Math.round(tinted.blue * (1 - mix) + b * mix)
    }
  }
}

const tintFilterCache = new Map<
  CustomColorTintGamutKey,
  ReturnType<typeof createKingdomFrameTintFilter>
>()

/** 获取（并缓存）指定图层用途对应的着色滤镜 */
export const getKingdomFrameTintFilter = (gamutKey: CustomColorTintGamutKey) => {
  let filter = tintFilterCache.get(gamutKey)
  if (!filter) {
    filter = createKingdomFrameTintFilter(CUSTOM_COLOR_TINT_GAMUT[gamutKey])
    tintFilterCache.set(gamutKey, filter)
  }
  return filter
}
