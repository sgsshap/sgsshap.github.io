import { loadOutOfFrameImage } from '@/features/diy-card/utils/outOfFrame/imageLoader'
import { calculateFitSize } from '@/features/diy-card/utils/canvas'
import { capOutOfFrameDimensionsForDevice } from '@/shared/utils/deviceCapability'

/** 出框合成相对画布显示尺寸的清晰度倍率（略大于 1，减轻卡面缩放发糊） */
export const OUT_OF_FRAME_DISPLAY_QUALITY_SCALE = 1.25

export const resolveOutOfFrameOutputSize = (
  naturalWidth: number,
  naturalHeight: number,
  displayWidth: number,
  displayHeight: number,
) => {
  const natW = Math.max(1, Math.round(naturalWidth))
  const natH = Math.max(1, Math.round(naturalHeight))
  const naturalRatio = natW / natH
  const floorW = Math.round(displayWidth * OUT_OF_FRAME_DISPLAY_QUALITY_SCALE)
  const floorH = Math.round(displayHeight * OUT_OF_FRAME_DISPLAY_QUALITY_SCALE)

  // 须同时满足清晰度下限并保持原图比例；不可对宽高独立取 max（会拉伸合成图）
  let targetW = Math.max(natW, floorW)
  let targetH = targetW / naturalRatio
  const minH = Math.max(natH, floorH)
  if (targetH < minH) {
    targetH = minH
    targetW = targetH * naturalRatio
  }

  return capOutOfFrameDimensionsForDevice(Math.round(targetW), Math.round(targetH))
}

const withHighQualitySmoothing = (ctx: CanvasRenderingContext2D) => {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
}

/** 将蒙版缩放到目标尺寸（蒙版 alpha 通道表示可见度） */
export const normalizeMaskCanvas = (
  maskSource: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const w = Math.round(width)
  const h = Math.round(height)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建蒙版画布')

  withHighQualitySmoothing(ctx)
  ctx.drawImage(maskSource, 0, 0, w, h)
  return canvas
}

/** 原图 × 蒙版合成（蒙版 alpha 表示可见区域；按 cover 绘制，禁止拉伸） */
export const compositeFullWithMaskElements = (
  source: HTMLImageElement,
  mask: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const w = Math.round(width)
  const h = Math.round(height)
  const natW = Math.max(1, source.naturalWidth || source.width)
  const natH = Math.max(1, source.naturalHeight || source.height)
  const { finalWidth, finalHeight } = calculateFitSize(w, h, natW, natH, 'cover')
  const offsetX = (w - finalWidth) / 2
  const offsetY = (h - finalHeight) / 2

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')

  withHighQualitySmoothing(ctx)
  ctx.drawImage(source, offsetX, offsetY, finalWidth, finalHeight)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, offsetX, offsetY, finalWidth, finalHeight)
  ctx.globalCompositeOperation = 'source-over'

  return out
}

/**
 * 编辑器交互预览：在目标尺寸直接合成，跳过蒙版归一化与像素扫描。
 * 仅用于编辑器内实时预览（蒙版由编辑器写入，已是 alpha 格式）。
 */
export const compositePreviewWithMaskElements = (
  source: HTMLImageElement,
  mask: HTMLCanvasElement,
  outWidth: number,
  outHeight: number,
  out?: HTMLCanvasElement,
): HTMLCanvasElement => {
  const w = Math.round(outWidth)
  const h = Math.round(outHeight)
  const canvas = out ?? document.createElement('canvas')
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(source, 0, 0, w, h)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  return canvas
}

/**
 * 编辑器预览：原图居中绘制在工作画布上，再与整幅蒙版合成。
 * 留白区无原图像素，便于笔刷超出原图边缘修整。
 */
export const compositePreviewWithPaddedMaskElements = (
  source: HTMLImageElement,
  mask: HTMLCanvasElement,
  outWidth: number,
  outHeight: number,
  sourceRect: { x: number; y: number; width: number; height: number },
  out?: HTMLCanvasElement,
): HTMLCanvasElement => {
  const w = Math.round(outWidth)
  const h = Math.round(outHeight)
  const canvas = out ?? document.createElement('canvas')
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')

  const scaleX = w / mask.width
  const scaleY = h / mask.height
  const destSource = {
    x: sourceRect.x * scaleX,
    y: sourceRect.y * scaleY,
    width: sourceRect.width * scaleX,
    height: sourceRect.height * scaleY,
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(source, destSource.x, destSource.y, destSource.width, destSource.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  return canvas
}

/** 原图与蒙版按原生像素尺寸合成（保持原图横纵比，与 legendImage cover 对齐） */
export const compositeFullWithMask = async (
  sourcePic: string,
  maskDataUrl: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> => {
  const [source, mask] = await Promise.all([
    loadOutOfFrameImage(sourcePic),
    loadOutOfFrameImage(maskDataUrl),
  ])
  return compositeFullWithMaskElements(source, mask, width, height)
}

export const canvasToDataUrl = (canvas: HTMLCanvasElement) => canvas.toDataURL('image/png')

/** 将原图缩放到指定尺寸，供智能抠图使用 */
export const scaleSourceToDataUrl = async (
  sourcePic: string,
  width: number,
  height: number,
): Promise<string> => {
  const source = await loadOutOfFrameImage(sourcePic)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width)
  canvas.height = Math.round(height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  withHighQualitySmoothing(ctx)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
