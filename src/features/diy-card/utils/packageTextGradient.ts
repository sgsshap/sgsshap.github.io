import {
  resolvePackageTextBadgeGradientAngleDeg,
  resolvePackageTextBadgeGradientEndAt,
  resolvePackageTextBadgeGradientStartAt,
  type PackageTextBadgeGradient,
  type PackageTextCharFill,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/package'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import { hex2rgb, rgbToHex } from '@/shared/utils/color'

export type PackageTextLinearGradientStyle = Pick<
  CanvasItemConfig,
  | 'fillPriority'
  | 'fillLinearGradientStartPoint'
  | 'fillLinearGradientEndPoint'
  | 'fillLinearGradientColorStops'
>

export type PackageTextStrokeLinearGradientStyle = Pick<
  CanvasItemConfig,
  | 'strokeLinearGradientStartPoint'
  | 'strokeLinearGradientEndPoint'
  | 'strokeLinearGradientColorStops'
>

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const lerpChannel = (from: number, to: number, ratio: number) =>
  Math.round(from + (to - from) * ratio)

export const lerpPackageTextHexColor = (fromHex: string, toHex: string, ratio: number) => {
  const from = hex2rgb(fromHex)
  const to = hex2rgb(toHex)
  if (!from || !to) return fromHex
  const t = clamp(ratio, 0, 1)
  return rgbToHex({
    red: lerpChannel(from.red, to.red, t),
    green: lerpChannel(from.green, to.green, t),
    blue: lerpChannel(from.blue, to.blue, t),
  })
}

/** Konva 线性渐变停靠（含 startAt / endAt 过渡区间与两端纯色平台） */
export const buildPackageTextBadgeGradientColorStops = (
  startHex: string,
  endHex: string,
  gradient: PackageTextBadgeGradient,
): (number | string)[] => {
  const startAt = resolvePackageTextBadgeGradientStartAt(gradient)
  const endAt = resolvePackageTextBadgeGradientEndAt(gradient)

  if (startAt <= 0 && endAt >= 1) {
    return [0, startHex, 1, endHex]
  }

  const stops: (number | string)[] = [0, startHex]

  if (startAt > 0) {
    stops.push(startAt, startHex)
  }

  stops.push(endAt, endHex)

  if (endAt < 1) {
    stops.push(1, endHex)
  }

  return stops
}

/** 角标底图渐变：将 PNG 像素映射到组内 layout 坐标后再采样轴位置 */
export type PackageTextGradientLayoutContext = {
  layoutWidth: number
  layoutHeight: number
  imageWidth: number
  imageHeight: number
}

export const resolvePackageTextGradientAxisTInLayoutBox = (
  cachePx: number,
  cachePy: number,
  context: PackageTextGradientLayoutContext,
  gradient: PackageTextBadgeGradient,
  cacheSize?: { width: number; height: number },
) => {
  const boxW = Math.max(context.layoutWidth, 1)
  const boxH = Math.max(context.layoutHeight, 1)
  const imgW = Math.max(context.imageWidth, 1)
  const imgH = Math.max(context.imageHeight, 1)
  const cacheW = Math.max(cacheSize?.width ?? imgW, 1)
  const cacheH = Math.max(cacheSize?.height ?? imgH, 1)
  const fitScale = Math.min(boxW / imgW, boxH / imgH)
  const fitW = imgW * fitScale
  const fitH = imgH * fitScale
  // cache 像素线性映射到底图 contain 后的显示区域，渐变轴与 PNG 内容对齐
  const localX = (cachePx / cacheW) * fitW
  const localY = (cachePy / cacheH) * fitH
  return resolvePackageTextGradientAxisT(localX, localY, fitW, fitH, gradient)
}

/** 按轴位置 t（0–1）采样双色渐变 */
export const samplePackageTextBadgeGradientHex = (
  axisT: number,
  startHex: string,
  endHex: string,
  gradient: PackageTextBadgeGradient,
) => {
  const startAt = resolvePackageTextBadgeGradientStartAt(gradient)
  const endAt = resolvePackageTextBadgeGradientEndAt(gradient)
  const t = clamp(axisT, 0, 1)
  if (t <= startAt) return startHex
  if (t >= endAt) return endHex
  const span = endAt - startAt
  if (span < 1e-6) return endHex
  return lerpPackageTextHexColor(startHex, endHex, (t - startAt) / span)
}

/** 按 CSS 角度解析渐变轴起终点（过矩形中心，t=0 为起点色侧） */
export const resolvePackageTextGradientEndpoints = (
  width: number,
  height: number,
  angleDeg: number,
) => {
  const boxW = Math.max(width, 1)
  const boxH = Math.max(height, 1)
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const cx = boxW / 2
  const cy = boxH / 2
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  let halfLen = 0
  if (absDx > 1e-6 && absDy > 1e-6) {
    halfLen = Math.min(boxW / 2 / absDx, boxH / 2 / absDy)
  } else if (absDx > 1e-6) {
    halfLen = boxW / 2
  } else {
    halfLen = boxH / 2
  }
  return {
    start: { x: cx - dx * halfLen, y: cy - dy * halfLen },
    end: { x: cx + dx * halfLen, y: cy + dy * halfLen },
  }
}

/** 渐变轴起点（相对字框/底图像素坐标） */
export const resolvePackageTextGradientStartPoint = (
  width: number,
  height: number,
  gradient: PackageTextBadgeGradient,
) =>
  resolvePackageTextGradientEndpoints(
    width,
    height,
    resolvePackageTextBadgeGradientAngleDeg(gradient),
  ).start

/** 渐变轴终点（相对字框/底图像素坐标） */
export const resolvePackageTextGradientEndPoint = (
  width: number,
  height: number,
  gradient: PackageTextBadgeGradient,
) =>
  resolvePackageTextGradientEndpoints(
    width,
    height,
    resolvePackageTextBadgeGradientAngleDeg(gradient),
  ).end

/** 像素在渐变轴上的归一化位置（0 = 起点，1 = 终点） */
export const resolvePackageTextGradientAxisT = (
  px: number,
  py: number,
  width: number,
  height: number,
  gradient: PackageTextBadgeGradient,
) => {
  const boxW = Math.max(width, 1)
  const boxH = Math.max(height, 1)
  const start = resolvePackageTextGradientStartPoint(boxW, boxH, gradient)
  const end = resolvePackageTextGradientEndPoint(boxW, boxH, gradient)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1) return 0
  const relX = px - start.x
  const relY = py - start.y
  return clamp((relX * dx + relY * dy) / lenSq, 0, 1)
}

/** 双色线性填充渐变（Konva Text fillLinearGradient*） */
export const buildPackageTextFillLinearGradientStyle = (
  startHex: string,
  endHex: string,
  width: number,
  height: number,
  gradient: PackageTextBadgeGradient,
): PackageTextLinearGradientStyle => {
  const boxW = Math.max(width, 1)
  const boxH = Math.max(height, 1)
  return {
    fillPriority: 'linear-gradient',
    fillLinearGradientStartPoint: resolvePackageTextGradientStartPoint(boxW, boxH, gradient),
    fillLinearGradientEndPoint: resolvePackageTextGradientEndPoint(boxW, boxH, gradient),
    fillLinearGradientColorStops: buildPackageTextBadgeGradientColorStops(startHex, endHex, gradient),
  }
}

/** 逐字文字填充样式（相对单字 Konva Text 字框） */
export const buildPackageTextCharFillStyle = (
  charFill: PackageTextCharFill,
  charWidth: number,
  charHeight: number,
  fontSizePx: number,
): Pick<
  CanvasItemConfig,
  | 'fill'
  | 'fillPriority'
  | 'fillLinearGradientStartPoint'
  | 'fillLinearGradientEndPoint'
  | 'fillLinearGradientColorStops'
> => {
  if (charFill.type === 'solid') {
    return { fill: charFill.color }
  }

  const gradientSpan = Math.max(fontSizePx, charHeight * 0.82, 1)
  return {
    fillPriority: 'linear-gradient',
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: 0, y: gradientSpan },
    fillLinearGradientColorStops: [0, charFill.startHex, 1, charFill.endHex],
  }
}

/** 双色线性描边渐变（Konva Text strokeLinearGradient*） */
export const buildPackageTextStrokeLinearGradientStyle = (
  startHex: string,
  endHex: string,
  width: number,
  height: number,
  gradient: PackageTextBadgeGradient,
): PackageTextStrokeLinearGradientStyle => {
  const boxW = Math.max(width, 1)
  const boxH = Math.max(height, 1)
  return {
    strokeLinearGradientStartPoint: resolvePackageTextGradientStartPoint(boxW, boxH, gradient),
    strokeLinearGradientEndPoint: resolvePackageTextGradientEndPoint(boxW, boxH, gradient),
    strokeLinearGradientColorStops: buildPackageTextBadgeGradientColorStops(startHex, endHex, gradient),
  }
}

/**
 * 描边渐变轴对齐角标排版区域（非单字框），使左上字偏起点色、右下字偏终点色。
 * charOrigin 为 Konva Text 在角标组内的左上角坐标。
 */
export const buildPackageTextStrokeLinearGradientStyleInLayoutSpace = (
  startHex: string,
  endHex: string,
  layout: {
    offsetX: number
    offsetY: number
    layoutWidth: number
    layoutHeight: number
  },
  charOrigin: { x: number; y: number },
  gradient: PackageTextBadgeGradient,
): PackageTextStrokeLinearGradientStyle => {
  const { offsetX, offsetY, layoutWidth, layoutHeight } = layout
  const boxW = Math.max(layoutWidth, 1)
  const boxH = Math.max(layoutHeight, 1)
  const layoutStart = resolvePackageTextGradientStartPoint(boxW, boxH, gradient)
  const layoutEnd = resolvePackageTextGradientEndPoint(boxW, boxH, gradient)
  const globalStart = { x: offsetX + layoutStart.x, y: offsetY + layoutStart.y }
  const globalEnd = { x: offsetX + layoutEnd.x, y: offsetY + layoutEnd.y }
  return {
    strokeLinearGradientStartPoint: {
      x: globalStart.x - charOrigin.x,
      y: globalStart.y - charOrigin.y,
    },
    strokeLinearGradientEndPoint: {
      x: globalEnd.x - charOrigin.x,
      y: globalEnd.y - charOrigin.y,
    },
    strokeLinearGradientColorStops: buildPackageTextBadgeGradientColorStops(startHex, endHex, gradient),
  }
}
