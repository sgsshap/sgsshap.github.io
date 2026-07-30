import {
  isPackageTextBadgeKind,
  resolvePackageTextBadgeDefaultColor,
  resolvePackageTextBadgeDefaultColorEnd,
  type PackageTextBadgeKind,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/package'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { hex2rgb, hslToRgb, rgbToHex, rgbToHsl } from '@/shared/utils/color'

type PackageRenderItem = LegendInfo['renderConfig']['items']['package']

const readPackageColorHex = (value: unknown, fallback: string) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || fallback
}

/** 解析文字角标底图着色 hex（始终启用；空值回退到该种类预设默认色） */
export const resolvePackageCustomColorHex = (
  packageItem: PackageRenderItem,
  kind: PackageTextBadgeKind,
): string => readPackageColorHex(packageItem.customColor, resolvePackageTextBadgeDefaultColor(kind))

/** 解析文字角标渐变终点 hex（空值回退到该种类预设 defaultCustomColorEnd） */
export const resolvePackageCustomColorEndHex = (
  packageItem: PackageRenderItem,
  kind: PackageTextBadgeKind,
): string =>
  readPackageColorHex(packageItem.customColorEnd, resolvePackageTextBadgeDefaultColorEnd(kind))

/** 解析为 Konva 滤镜 RGB 分量 */
export const resolvePackageCustomColorRgb = (
  packageItem: PackageRenderItem,
  kind: PackageTextBadgeKind,
) => {
  const hex = resolvePackageCustomColorHex(packageItem, kind)
  return hex2rgb(hex) ?? undefined
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export type PackageTextStrokeColorAdjust = {
  /** 相对角标色亮度偏移，负=略加深 */
  lightnessDelta?: number
  /** 相对角标色饱和度偏移，正=更饱和 */
  saturationDelta?: number
}

/** 角标色微调后转 hex（外描边：略加深 + 提高饱和度） */
export const adjustPackageColorHexForStroke = (
  hex: string,
  adjust: PackageTextStrokeColorAdjust = {},
) => {
  const rgb = hex2rgb(hex)
  if (!rgb) return hex
  const { h, s, l } = rgbToHsl(rgb.red, rgb.green, rgb.blue)
  const lightnessDelta = adjust.lightnessDelta ?? -0.08
  const saturationDelta = adjust.saturationDelta ?? 0.12
  const nextS = clamp(s + saturationDelta, 0, 1)
  const nextL = clamp(l + lightnessDelta, 0.08, 0.95)
  return rgbToHex(hslToRgb(h, nextS, nextL))
}

/** 切换文字角标种类时，写入该种类 constants 中的默认着色 */
export const applyPackageTextBadgeDefaultColor = (
  packageItem: PackageRenderItem,
  identifyName: string,
) => {
  if (!isPackageTextBadgeKind(identifyName)) return
  packageItem.customColor = resolvePackageTextBadgeDefaultColor(identifyName)
  packageItem.customColorEnd = resolvePackageTextBadgeDefaultColorEnd(identifyName)
}
