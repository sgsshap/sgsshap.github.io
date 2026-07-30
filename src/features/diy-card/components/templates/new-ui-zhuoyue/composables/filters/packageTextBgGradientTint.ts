import type {
  PackageTextBadgeGradient,
  PackageTextBgGradientTintOptions,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/package'
import {
  DEFAULT_PACKAGE_GRADIENT_TINT_LIGHTNESS_TEXTURE,
  resolvePackageTextBadgeGradientAngleDeg,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/package'
import {
  CUSTOM_COLOR_TINT_GAMUT,
  type CustomColorTintGamutOptions,
} from '@/features/diy-card/constants/customColorPickerOptions'
import { preserveKingdomGlyphImageOutlineRgb } from '@/features/diy-card/utils/kingdomGlyphFillGradient'
import {
  resolvePackageTextGradientAxisTInLayoutBox,
  samplePackageTextBadgeGradientHex,
  type PackageTextGradientLayoutContext,
} from '@/features/diy-card/utils/packageTextGradient'
import { hex2rgb, hslToRgb, rgbToHsl } from '@/shared/utils/color'
import Konva from 'konva'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const PACKAGE_TINT_OPTIONS: CustomColorTintGamutOptions = CUSTOM_COLOR_TINT_GAMUT.package

export type ResolvedPackageTextBgGradientTint = {
  gamut: CustomColorTintGamutOptions
  lightnessTexture: number
}

export const resolvePackageTextBgGradientTint = (
  tintOptions?: PackageTextBgGradientTintOptions,
): ResolvedPackageTextBgGradientTint => ({
  gamut: {
    ...PACKAGE_TINT_OPTIONS,
    ...tintOptions?.gamut,
  },
  lightnessTexture: clamp(
    tintOptions?.lightnessTexture ?? DEFAULT_PACKAGE_GRADIENT_TINT_LIGHTNESS_TEXTURE,
    0,
    1,
  ),
})

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
  return {
    hue: user.h,
    sat: Math.min(user.s * options.userSatScale, options.userSatCap),
    lightnessScale: 1,
  }
}

/**
 * 渐变底图着色：用户色提供色相/饱和度，原图亮度纹理按 lightnessTexture 混入。
 * 血点标等扁平素材用低 lightnessTexture，避免终点色偏暗；光感圆标用高值保留纹路。
 */
const tintPixelWithGradientUserHex = (
  r: number,
  g: number,
  b: number,
  userHex: string,
  options: CustomColorTintGamutOptions,
  lightnessTexture: number,
) => {
  const userRgb = hex2rgb(userHex)
  if (!userRgb) return { red: r, green: g, blue: b }
  const user = rgbToHsl(userRgb.red, userRgb.green, userRgb.blue)
  const { hue, sat, lightnessScale } = resolveTintColor(user, options)
  const mix = options.originalMix
  const orig = rgbToHsl(r, g, b)
  let outS = sat * (options.baseSatFactor + options.textureSatWeight * orig.s)
  outS = Math.min(outS, options.maxOutSaturation)
  const texture = clamp(lightnessTexture, 0, 1)
  const outL = clamp(
    user.l * (1 - texture) + orig.l * lightnessScale * texture,
    0.02,
    0.98,
  )
  const tinted = hslToRgb(hue, outS, outL)
  return {
    red: Math.round(tinted.red * (1 - mix) + r * mix),
    green: Math.round(tinted.green * (1 - mix) + g * mix),
    blue: Math.round(tinted.blue * (1 - mix) + b * mix),
  }
}

type GradientTintKey = string

const buildGradientTintCacheKey = (
  startHex: string,
  endHex: string,
  gradient: PackageTextBadgeGradient,
  layout: PackageTextGradientLayoutContext,
  tint: ResolvedPackageTextBgGradientTint,
) =>
  [
    startHex,
    endHex,
    resolvePackageTextBadgeGradientAngleDeg(gradient),
    gradient.startAt ?? 0,
    gradient.endAt ?? 1,
    tint.lightnessTexture,
    tint.gamut.baseSatFactor,
    tint.gamut.textureSatWeight,
    tint.gamut.maxOutSaturation,
    tint.gamut.originalMix,
    `${layout.layoutWidth}x${layout.layoutHeight}@${layout.imageWidth}x${layout.imageHeight}`,
  ].join(':')

/** 角标底图双色线性渐变着色（沿 layout 区渐变轴插值后套用 package 色域） */
export function createPackageTextBgGradientTintFilter(
  startHex: string,
  endHex: string,
  gradient: PackageTextBadgeGradient,
  layout: PackageTextGradientLayoutContext,
  tintOptions?: PackageTextBgGradientTintOptions,
) {
  const tint = resolvePackageTextBgGradientTint(tintOptions)
  return function packageTextBgGradientTintFilter(this: Konva.Node, imageData: ImageData) {
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
        if (preserveKingdomGlyphImageOutlineRgb(r, g, b)) continue

        const axisT = resolvePackageTextGradientAxisTInLayoutBox(
          x,
          y,
          layout,
          gradient,
          { width, height },
        )
        const userHex = samplePackageTextBadgeGradientHex(axisT, startHex, endHex, gradient)
        const out = tintPixelWithGradientUserHex(
          r,
          g,
          b,
          userHex,
          tint.gamut,
          tint.lightnessTexture,
        )
        data[i] = out.red
        data[i + 1] = out.green
        data[i + 2] = out.blue
      }
    }
  }
}

const filterCache = new Map<
  GradientTintKey,
  ReturnType<typeof createPackageTextBgGradientTintFilter>
>()

export const getPackageTextBgGradientTintFilter = (
  startHex: string,
  endHex: string,
  gradient: PackageTextBadgeGradient,
  layout: PackageTextGradientLayoutContext,
  tintOptions?: PackageTextBgGradientTintOptions,
) => {
  const tint = resolvePackageTextBgGradientTint(tintOptions)
  const key = buildGradientTintCacheKey(startHex, endHex, gradient, layout, tint)
  let filter = filterCache.get(key)
  if (!filter) {
    filter = createPackageTextBgGradientTintFilter(
      startHex,
      endHex,
      gradient,
      layout,
      tintOptions,
    )
    filterCache.set(key, filter)
  }
  return filter
}

/** 渐变底图 cache 签名（起终点 + 方向 + layout + 着色参数变化时须重烘焙） */
export const buildPackageTextBgGradientCacheSignature = (
  startHex: string,
  endHex: string,
  gradient: PackageTextBadgeGradient,
  layout: PackageTextGradientLayoutContext,
  tintOptions?: PackageTextBgGradientTintOptions,
) => buildGradientTintCacheKey(startHex, endHex, gradient, layout, resolvePackageTextBgGradientTint(tintOptions))
