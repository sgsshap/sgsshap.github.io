import {
  WHITE_BORDER_AMBIENT_SHADOW_ALPHA,
  WHITE_BORDER_AMBIENT_SHADOW_BLUR_MM,
  WHITE_BORDER_CORNER_MM,
  WHITE_BORDER_PREVIEW_MM,
  WHITE_BORDER_SHADOW_ALPHA,
  WHITE_BORDER_SHADOW_BLUR_MM,
  WHITE_BORDER_SHADOW_OFFSET_X_MM,
  WHITE_BORDER_SHADOW_OFFSET_Y_MM,
} from '@/features/diy-card/constants/canvasPreview'
import type { TemplateInfo } from '@/features/diy-card/types/template'

const MM_TO_INCH = 25.4

const mmToPxAtPpi = (mm: number, ppi: number) => Math.round((mm / MM_TO_INCH) * ppi)

export interface WhiteBorderExportLayout {
  outputWidthPx: number
  outputHeightPx: number
  cardWidthPx: number
  cardHeightPx: number
  borderPx: number
  cornerRadiusPx: number
  shadowOffsetXPx: number
  shadowOffsetYPx: number
  shadowBlurPx: number
  shadowAlpha: number
  ambientShadowBlurPx: number
  ambientShadowAlpha: number
}

export interface ExportCanvasMetrics {
  /** 导出图物理宽（mm） */
  widthMm: number
  /** 导出图物理高（mm） */
  heightMm: number
  /** 目标导出宽（px） */
  targetWidthPx: number
  /** 目标导出高（px） */
  targetHeightPx: number
  /** Stage 上裁切区左上角 x（px） */
  cropX: number
  /** Stage 上裁切区左上角 y（px） */
  cropY: number
  /** Stage 上裁切区宽（px） */
  cropWidth: number
  /** Stage 上裁切区高（px） */
  cropHeight: number
  /** Konva toDataURL 使用的 pixelRatio */
  pixelRatio: number
  /** 圆角白边合成参数（开启 whiteBorder 时存在） */
  whiteBorder?: WhiteBorderExportLayout
}

/**
 * 按模板物理尺寸与 PPI 计算导出参数
 *
 * - 出血关闭：仅成品区 template.width × height（mm），裁切 stageConfig 区域
 * - 出血开启：成品 + 两侧出血，裁切整个 finalStage（与预览一致）
 * - 圆角白边：成品 + 两侧 3mm 白边，裁切 stageConfig 后再合成圆角
 */
export const resolveExportCanvasMetrics = (options: {
  template: Pick<TemplateInfo, 'width' | 'height'>
  ppi: number
  stageWidth: number
  stageHeight: number
  trimWidth: number
  trimHeight: number
  bleedFlag: boolean
  /** 用户当前出血宽度（mm），仅 bleedFlag 为 true 时生效 */
  bleedMm: number
  /** 是否导出圆角白边（与出血互斥） */
  whiteBorder?: boolean
}): ExportCanvasMetrics => {
  const {
    template,
    ppi,
    stageWidth,
    stageHeight,
    trimWidth,
    trimHeight,
    bleedFlag,
    bleedMm,
    whiteBorder = false,
  } = options

  const bleedMarginMm = bleedFlag ? bleedMm : 0
  const whiteBorderMarginMm = whiteBorder ? WHITE_BORDER_PREVIEW_MM : 0
  const widthMm = template.width + bleedMarginMm * 2 + whiteBorderMarginMm * 2
  const heightMm = template.height + bleedMarginMm * 2 + whiteBorderMarginMm * 2

  const targetWidthPx = mmToPxAtPpi(widthMm, ppi)
  const targetHeightPx = mmToPxAtPpi(heightMm, ppi)
  const cardWidthPx = mmToPxAtPpi(template.width, ppi)
  const cardHeightPx = mmToPxAtPpi(template.height, ppi)

  const includeBleed = bleedFlag && bleedMarginMm > 0
  const cropX = 0
  const cropY = 0
  const cropWidth = includeBleed ? stageWidth : trimWidth
  const cropHeight = includeBleed ? stageHeight : trimHeight

  const captureWidthPx = whiteBorder ? cardWidthPx : targetWidthPx
  const captureHeightPx = whiteBorder ? cardHeightPx : targetHeightPx
  const pixelRatio = Math.max(captureWidthPx / cropWidth, captureHeightPx / cropHeight)

  const whiteBorderLayout: WhiteBorderExportLayout | undefined = whiteBorder
    ? {
        outputWidthPx: targetWidthPx,
        outputHeightPx: targetHeightPx,
        cardWidthPx,
        cardHeightPx,
        borderPx: mmToPxAtPpi(whiteBorderMarginMm, ppi),
        cornerRadiusPx: mmToPxAtPpi(WHITE_BORDER_CORNER_MM, ppi),
        shadowOffsetXPx: mmToPxAtPpi(WHITE_BORDER_SHADOW_OFFSET_X_MM, ppi),
        shadowOffsetYPx: mmToPxAtPpi(WHITE_BORDER_SHADOW_OFFSET_Y_MM, ppi),
        shadowBlurPx: mmToPxAtPpi(WHITE_BORDER_SHADOW_BLUR_MM, ppi),
        shadowAlpha: WHITE_BORDER_SHADOW_ALPHA,
        ambientShadowBlurPx: mmToPxAtPpi(WHITE_BORDER_AMBIENT_SHADOW_BLUR_MM, ppi),
        ambientShadowAlpha: WHITE_BORDER_AMBIENT_SHADOW_ALPHA,
      }
    : undefined

  return {
    widthMm,
    heightMm,
    targetWidthPx,
    targetHeightPx,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    pixelRatio,
    whiteBorder: whiteBorderLayout,
  }
}

const clipRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('导出圆角白边：图片加载失败'))
    img.src = src
  })

const drawWhiteBorderCardShadow = (
  ctx: CanvasRenderingContext2D,
  layout: WhiteBorderExportLayout,
  offsetX: number,
  offsetY: number,
  blur: number,
  alpha: number,
) => {
  ctx.save()
  ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`
  ctx.shadowOffsetX = offsetX
  ctx.shadowOffsetY = offsetY
  ctx.shadowBlur = blur
  clipRoundRect(
    ctx,
    layout.borderPx,
    layout.borderPx,
    layout.cardWidthPx,
    layout.cardHeightPx,
    layout.cornerRadiusPx,
  )
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()
}

/**
 * 将成品图合成到带 3mm 白边与圆角的导出画布上
 */
export const composeWhiteBorderExport = async (
  cardDataUrl: string,
  layout: WhiteBorderExportLayout,
  mimeType: string,
  quality: number,
): Promise<string> => {
  const img = await loadImageElement(cardDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = layout.outputWidthPx
  canvas.height = layout.outputHeightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('导出圆角白边：无法创建 Canvas 上下文')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, layout.outputWidthPx, layout.outputHeightPx)

  const {
    borderPx,
    cardWidthPx,
    cardHeightPx,
    cornerRadiusPx,
    shadowOffsetXPx,
    shadowOffsetYPx,
    shadowBlurPx,
    shadowAlpha,
    ambientShadowBlurPx,
    ambientShadowAlpha,
  } = layout

  drawWhiteBorderCardShadow(ctx, layout, 0, 0, ambientShadowBlurPx, ambientShadowAlpha)
  drawWhiteBorderCardShadow(
    ctx,
    layout,
    shadowOffsetXPx,
    shadowOffsetYPx,
    shadowBlurPx,
    shadowAlpha,
  )

  ctx.save()
  clipRoundRect(ctx, borderPx, borderPx, cardWidthPx, cardHeightPx, cornerRadiusPx)
  ctx.clip()
  ctx.drawImage(img, borderPx, borderPx, cardWidthPx, cardHeightPx)
  ctx.restore()

  return canvas.toDataURL(mimeType, quality)
}
