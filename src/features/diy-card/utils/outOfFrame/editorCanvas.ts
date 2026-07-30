import { normalizeMaskCanvas } from '@/features/diy-card/utils/outOfFrame/composite'
import { loadOutOfFrameImage } from '@/features/diy-card/utils/outOfFrame/imageLoader'
import { capOutOfFrameDimensionsForDevice } from '@/shared/utils/deviceCapability'

/** 工作画布相对原图的单边留白（像素，基于原图分辨率） */
export const OUT_OF_FRAME_EDITOR_BLEED_MIN_PX = 48
export const OUT_OF_FRAME_EDITOR_BLEED_RATIO = 0.1

export type OutOfFrameEditorSourceRect = {
  x: number
  y: number
  width: number
  height: number
}

export type OutOfFrameEditorCanvasLayout = {
  canvasWidth: number
  canvasHeight: number
  bleed: number
  sourceRect: OutOfFrameEditorSourceRect
}

export const resolveOutOfFrameEditorBleed = (naturalW: number, naturalH: number) =>
  Math.max(
    OUT_OF_FRAME_EDITOR_BLEED_MIN_PX,
    Math.round(Math.max(naturalW, naturalH) * OUT_OF_FRAME_EDITOR_BLEED_RATIO),
  )

export const resolveOutOfFrameEditorCanvasLayout = (
  naturalW: number,
  naturalH: number,
): OutOfFrameEditorCanvasLayout => {
  const { width: natW, height: natH } = capOutOfFrameDimensionsForDevice(
    Math.round(naturalW),
    Math.round(naturalH),
  )
  const bleed = resolveOutOfFrameEditorBleed(natW, natH)
  return {
    canvasWidth: natW + bleed * 2,
    canvasHeight: natH + bleed * 2,
    bleed,
    sourceRect: { x: bleed, y: bleed, width: natW, height: natH },
  }
}

/** 初始蒙版：原图区域全可见，留白区透明，便于笔刷超出原图边缘操作 */
export const createOutOfFramePaddedInitialMask = (
  layout: OutOfFrameEditorCanvasLayout,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = layout.canvasWidth
  canvas.height = layout.canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建初始蒙版')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const { x, y, width, height } = layout.sourceRect
  ctx.fillStyle = 'rgba(255,255,255,1)'
  ctx.fillRect(x, y, width, height)
  return canvas
}

const drawMaskIntoPaddedCanvas = (
  ctx: CanvasRenderingContext2D,
  layout: OutOfFrameEditorCanvasLayout,
  maskSource: HTMLImageElement | HTMLCanvasElement,
  maskNaturalW: number,
  maskNaturalH: number,
) => {
  ctx.clearRect(0, 0, layout.canvasWidth, layout.canvasHeight)
  const { x, y, width, height } = layout.sourceRect

  if (maskNaturalW === layout.canvasWidth && maskNaturalH === layout.canvasHeight) {
    ctx.drawImage(maskSource, 0, 0)
    return
  }

  const normalized = normalizeMaskCanvas(maskSource, width, height)
  ctx.drawImage(normalized, x, y, width, height)
}

export const loadOutOfFrameMaskIntoPaddedCanvas = async (
  maskDataUrl: string,
  layout: OutOfFrameEditorCanvasLayout,
): Promise<HTMLCanvasElement> => {
  const maskImage = await loadOutOfFrameImage(maskDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = layout.canvasWidth
  canvas.height = layout.canvasHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建蒙版画布')
  drawMaskIntoPaddedCanvas(
    ctx,
    layout,
    maskImage,
    maskImage.naturalWidth || maskImage.width,
    maskImage.naturalHeight || maskImage.height,
  )
  return canvas
}

export const embedOutOfFrameMaskSnapshotInPaddedCanvas = (
  snapshot: HTMLCanvasElement,
  layout: OutOfFrameEditorCanvasLayout,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = layout.canvasWidth
  canvas.height = layout.canvasHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建蒙版画布')
  drawMaskIntoPaddedCanvas(ctx, layout, snapshot, snapshot.width, snapshot.height)
  return canvas
}

/** 应用时裁回原图尺寸，与卡面合成管线保持一致 */
export const cropOutOfFrameMaskToSource = (
  paddedMask: HTMLCanvasElement,
  layout: OutOfFrameEditorCanvasLayout,
): HTMLCanvasElement => {
  const { x, y, width, height } = layout.sourceRect
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法裁剪蒙版')
  ctx.drawImage(paddedMask, x, y, width, height, 0, 0, width, height)
  return canvas
}

export const scaleOutOfFrameEditorSourceRect = (
  sourceRect: OutOfFrameEditorSourceRect,
  maskWidth: number,
  maskHeight: number,
  outWidth: number,
  outHeight: number,
) => {
  const scaleX = outWidth / maskWidth
  const scaleY = outHeight / maskHeight
  return {
    x: sourceRect.x * scaleX,
    y: sourceRect.y * scaleY,
    width: sourceRect.width * scaleX,
    height: sourceRect.height * scaleY,
  }
}
