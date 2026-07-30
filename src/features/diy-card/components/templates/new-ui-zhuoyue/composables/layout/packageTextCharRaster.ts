import { resolvePackageTextGradientEndpoints } from '@/features/diy-card/utils/packageTextGradient'
import type { PackageTextCharFill, PackageTextCharRasterShadow } from '../constants/package'
import {
  DEFAULT_PACKAGE_TEXT_SYNTHETIC_BOLD_WIDTH_RATIO,
  PACKAGE_TEXT_RASTER_MIN_VISIBLE_STROKE_PX,
} from '../constants/package'
import { applyCanvasFont } from '../layers/skills-desc/canvasTextMeasure'

export type PackageTextCharRasterOptions = {
  char: string
  fontFamily: string
  fontSizePx: number
  boxWidth: number
  boxHeight: number
  scaleX?: number
  scaleY?: number
  align?: 'left' | 'center' | 'right'
  charFill: PackageTextCharFill
  syntheticBold?: boolean
  syntheticBoldWidthRatio?: number
  rasterShadow?: PackageTextCharRasterShadow
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** 角标字极小，额外超采样一档再让 Konva 缩小显示，边缘更利 */
const PACKAGE_TEXT_RASTER_SUPERSAMPLE = 2

const resolveDevicePixelRatio = () => {
  if (typeof window === 'undefined') return 1
  return clamp(window.devicePixelRatio || 1, 1, 3) * PACKAGE_TEXT_RASTER_SUPERSAMPLE
}

const snapToDevicePixel = (value: number, dpr: number) => Math.round(value * dpr) / dpr

/** 描边宽 = fontSize × ratio；过小则视为 0 */
const resolveRasterStrokeWidthPx = (fontSizePx: number, ratio: number | undefined) => {
  if (ratio === undefined || ratio <= 0) return 0
  const widthPx = fontSizePx * ratio
  return widthPx >= PACKAGE_TEXT_RASTER_MIN_VISIBLE_STROKE_PX ? widthPx : 0
}

/** 阴影模糊半径 = fontSize × ratio（与描边分开，不做 0.25px 截断） */
const resolveShadowBlurPx = (fontSizePx: number, blurRatio: number | undefined) => {
  if (blurRatio === undefined || blurRatio <= 0) return 0
  return fontSizePx * blurRatio
}

const resolveSyntheticBoldStrokeWidth = (
  syntheticBold: boolean,
  syntheticBoldWidthRatio: number | undefined,
  fontSizePx: number,
) => {
  if (!syntheticBold) return 0
  const ratio =
    syntheticBoldWidthRatio !== undefined
      ? syntheticBoldWidthRatio
      : DEFAULT_PACKAGE_TEXT_SYNTHETIC_BOLD_WIDTH_RATIO
  return resolveRasterStrokeWidthPx(fontSizePx, ratio)
}

/** 为阴影 / 描边扩展画布留白，避免文字被裁切 */
export const resolvePackageTextCharRasterPadding = (
  fontSizePx: number,
  rasterShadow: PackageTextCharRasterShadow | undefined,
  strokeWidth = 0,
) => {
  if (!rasterShadow) {
    return Math.ceil(strokeWidth * 0.5 + 1)
  }
  const offsetX = Math.abs(fontSizePx * (rasterShadow.offsetXRatio ?? 0))
  const offsetY = Math.abs(fontSizePx * (rasterShadow.offsetYRatio ?? 0))
  const blur = resolveShadowBlurPx(fontSizePx, rasterShadow.blurRatio)
  const outline = resolveRasterStrokeWidthPx(fontSizePx, rasterShadow.outlineWidthRatio)
  return Math.ceil(blur + Math.max(offsetX, offsetY) + outline + strokeWidth * 0.5 + 1)
}

const resolveCanvasFillStyle = (
  ctx: CanvasRenderingContext2D,
  charFill: PackageTextCharFill,
  width: number,
  height: number,
) => {
  if (charFill.type === 'solid') {
    return charFill.color
  }

  const boxW = Math.max(width, 1)
  const boxH = Math.max(height, 1)
  const angleDeg = charFill.angleDeg ?? 180
  const { start, end } = resolvePackageTextGradientEndpoints(boxW, boxH, angleDeg)
  const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y)
  const startAt = charFill.startAt ?? 0
  const endAt = charFill.endAt ?? 1

  if (startAt <= 0 && endAt >= 1) {
    gradient.addColorStop(0, charFill.startHex)
    gradient.addColorStop(1, charFill.endHex)
    return gradient
  }

  gradient.addColorStop(0, charFill.startHex)
  if (startAt > 0) {
    gradient.addColorStop(startAt, charFill.startHex)
  }
  gradient.addColorStop(endAt, charFill.endHex)
  if (endAt < 1) {
    gradient.addColorStop(1, charFill.endHex)
  }
  return gradient
}

const drawRasterCharGlyph = (
  ctx: CanvasRenderingContext2D,
  char: string,
  fillStyle: string | CanvasGradient,
  options: {
    syntheticBold: boolean
    strokeWidth: number
    rasterShadow?: PackageTextCharRasterShadow
    fontSizePx: number
  },
) => {
  const { syntheticBold, strokeWidth, rasterShadow, fontSizePx } = options

  if (rasterShadow) {
    const offsetX = fontSizePx * (rasterShadow.offsetXRatio ?? 0)
    const offsetY = fontSizePx * (rasterShadow.offsetYRatio ?? 0)
    const blur = resolveShadowBlurPx(fontSizePx, rasterShadow.blurRatio)

    if (blur > 0) {
      ctx.save()
      ctx.shadowColor = rasterShadow.color
      ctx.shadowBlur = blur
      ctx.shadowOffsetX = offsetX
      ctx.shadowOffsetY = offsetY
      // 阴影层用纯色占位，避免把渐变填进 shadowBlur 导致发糊、发粗
      ctx.fillStyle = rasterShadow.color
      ctx.fillText(char, 0, 0)
      ctx.restore()
    } else if (offsetX !== 0 || offsetY !== 0) {
      ctx.save()
      ctx.fillStyle = rasterShadow.color
      ctx.fillText(char, offsetX, offsetY)
      ctx.restore()
    }
  }

  const outlineWidth = resolveRasterStrokeWidthPx(
    fontSizePx,
    rasterShadow?.outlineWidthRatio,
  )
  if (outlineWidth > 0 && rasterShadow) {
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = outlineWidth
    ctx.strokeStyle = rasterShadow.color
    ctx.strokeText(char, 0, 0)
    ctx.restore()
  }

  if (syntheticBold && strokeWidth > 0) {
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = fillStyle
    ctx.strokeText(char, 0, 0)
    ctx.restore()
  }

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = fillStyle
  ctx.fillText(char, 0, 0)
}

export type PackageTextCharRasterResult = {
  canvas: HTMLCanvasElement
  /** 相对字框向外扩展的留白（layout 须同步扩大并左移 x/y） */
  paddingPx: number
}

/** Canvas 2D 栅格化角标单字（渐变 / 模拟加粗；Konva Text 渐变不可靠） */
export const renderPackageTextCharCanvas = ({
  char,
  fontFamily,
  fontSizePx,
  boxWidth,
  boxHeight,
  scaleX = 1,
  scaleY = 1,
  align = 'left',
  charFill,
  syntheticBold = false,
  syntheticBoldWidthRatio,
  rasterShadow,
}: PackageTextCharRasterOptions): PackageTextCharRasterResult => {
  const contentWidth = Math.max(boxWidth, 1)
  const contentHeight = Math.max(boxHeight, 1)
  const strokeWidth = resolveSyntheticBoldStrokeWidth(
    syntheticBold,
    syntheticBoldWidthRatio,
    fontSizePx,
  )
  const paddingPx = resolvePackageTextCharRasterPadding(fontSizePx, rasterShadow, strokeWidth)
  const cssWidth = contentWidth + paddingPx * 2
  const cssHeight = contentHeight + paddingPx * 2
  const dpr = resolveDevicePixelRatio()

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(cssWidth * dpr))
  canvas.height = Math.max(1, Math.ceil(cssHeight * dpr))

  const empty: PackageTextCharRasterResult = { canvas, paddingPx }
  const ctx = canvas.getContext('2d')
  if (!ctx || !char) return empty

  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  applyCanvasFont(ctx, fontSizePx, fontFamily)
  ctx.textBaseline = 'top'

  const glyphWidth = ctx.measureText(char).width
  const visualWidth = glyphWidth * scaleX
  const measuredHeight = fontSizePx * scaleY

  let drawX = 0
  if (align === 'center') drawX = (contentWidth - visualWidth) / 2
  else if (align === 'right') drawX = contentWidth - visualWidth
  drawX = clamp(drawX, 0, Math.max(0, contentWidth - visualWidth))

  const drawY = clamp(
    (contentHeight - measuredHeight) / 2,
    0,
    Math.max(0, contentHeight - measuredHeight),
  )

  const originX = snapToDevicePixel(paddingPx + drawX, dpr)
  const originY = snapToDevicePixel(paddingPx + drawY, dpr)

  ctx.save()
  ctx.translate(originX, originY)
  const fillStyle = resolveCanvasFillStyle(ctx, charFill, glyphWidth, fontSizePx)
  ctx.scale(scaleX, scaleY)
  drawRasterCharGlyph(ctx, char, fillStyle, {
    syntheticBold,
    strokeWidth,
    rasterShadow,
    fontSizePx,
  })
  ctx.restore()

  return { canvas, paddingPx }
}
