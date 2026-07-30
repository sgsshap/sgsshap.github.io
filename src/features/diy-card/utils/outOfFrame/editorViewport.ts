export type EditorFitBox = {
  width: number
  height: number
  scale: number
}

export type EditorImageViewportLayout = {
  image: EditorFitBox
  viewport: EditorFitBox
}

/** 原图宽高比低于此值视为「窄图」，编辑器视口会适当加宽 */
export const NARROW_IMAGE_ASPECT_THRESHOLD = 0.72

/** 无画布参考时的视口最小宽高比（宽 / 高） */
export const DEFAULT_VIEWPORT_ASPECT_FLOOR = 0.78

export const fitEditorBox = (
  boxWidth: number,
  boxHeight: number,
  maxW: number,
  maxH: number,
): EditorFitBox => {
  const scale = Math.min(maxW / boxWidth, maxH / boxHeight, 1)
  return {
    width: Math.max(1, Math.round(boxWidth * scale)),
    height: Math.max(1, Math.round(boxHeight * scale)),
    scale,
  }
}

const resolveViewportAspectFloor = (stageAspect?: number) => {
  if (stageAspect != null && stageAspect > 0) {
    return Math.min(Math.max(stageAspect, 0.55), 0.92)
  }
  return DEFAULT_VIEWPORT_ASPECT_FLOOR
}

/**
 * 计算编辑器内图片显示尺寸与可操作视口尺寸。
 * 窄图时视口会加宽，图片仍按原图比例 contain 居中（不拉伸）。
 */
export const resolveEditorImageAndViewport = (
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
  options?: {
    stageAspect?: number
    narrowAspectThreshold?: number
    viewportAspectFloor?: number
  },
): EditorImageViewportLayout => {
  const image = fitEditorBox(naturalW, naturalH, maxW, maxH)
  const aspect = naturalW / naturalH
  const threshold = options?.narrowAspectThreshold ?? NARROW_IMAGE_ASPECT_THRESHOLD

  if (aspect >= threshold) {
    return { image, viewport: { ...image } }
  }

  const floorAspect =
    options?.viewportAspectFloor ?? resolveViewportAspectFloor(options?.stageAspect)
  const targetViewportWidth = Math.min(
    maxW,
    Math.max(image.width, Math.round(image.height * floorAspect)),
  )

  return {
    image,
    viewport: {
      width: Math.max(image.width, targetViewportWidth),
      height: image.height,
      scale: image.scale,
    },
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** 桌面端默认笔刷（视口 CSS px） */
export const OUT_OF_FRAME_DESKTOP_BRUSH_SIZE_PX = 48

/**
 * 按视口宽度估算默认笔刷粗细（视口 CSS px）。
 * 移动端约为视口宽 9%，限制在 28–44，避免默认圈过大遮屏。
 */
export const resolveDefaultOutOfFrameBrushSize = (
  viewportWidth: number,
  touch = false,
) => {
  if (!touch) return OUT_OF_FRAME_DESKTOP_BRUSH_SIZE_PX
  const width = Math.max(280, Math.round(viewportWidth))
  return clamp(Math.round(width * 0.09), 28, 44)
}

export const resolveOutOfFrameBrushSizeLimits = (touch = false) => ({
  min: 8,
  max: touch ? 200 : 160,
  step: 2,
})

export const OUT_OF_FRAME_VIEW_ZOOM_MIN = 100
export const OUT_OF_FRAME_VIEW_ZOOM_MAX = 1000
export const OUT_OF_FRAME_VIEW_ZOOM_STEP = 10

/** 预览画布像素尺寸：随缩放提高分辨率，上限为工作画布（原图 + 留白） */
export const resolveOutOfFramePreviewSizeForZoom = (
  displayWidth: number,
  displayHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  zoomPercent: number,
) => {
  const zoom = zoomPercent / 100
  let width = Math.max(1, Math.round(displayWidth * zoom))
  let height = Math.max(1, Math.round(displayHeight * zoom))
  width = Math.min(width, canvasWidth)
  height = Math.min(height, canvasHeight)
  return { width, height }
}

/**
 * 有效缩放上限：预览像素达到工作画布尺寸时，继续放大不会更清晰。
 */
export const resolveOutOfFrameEffectiveViewZoomMaxPercent = (
  displayWidth: number,
  displayHeight: number,
  canvasWidth: number,
  canvasHeight: number,
) => {
  if (displayWidth <= 0 || displayHeight <= 0) {
    return OUT_OF_FRAME_VIEW_ZOOM_MAX
  }

  const rawMax = Math.min(
    (canvasWidth / displayWidth) * 100,
    (canvasHeight / displayHeight) * 100,
    OUT_OF_FRAME_VIEW_ZOOM_MAX,
  )
  const stepped = Math.floor(rawMax / OUT_OF_FRAME_VIEW_ZOOM_STEP) * OUT_OF_FRAME_VIEW_ZOOM_STEP
  return Math.max(OUT_OF_FRAME_VIEW_ZOOM_MIN, stepped)
}

export const isOutOfFrameViewZoomAtMaxResolution = (
  displayWidth: number,
  displayHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  zoomPercent: number,
) => {
  const preview = resolveOutOfFramePreviewSizeForZoom(
    displayWidth,
    displayHeight,
    canvasWidth,
    canvasHeight,
    zoomPercent,
  )
  return preview.width >= canvasWidth && preview.height >= canvasHeight
}

/** Alt+滚轮缩放：与编辑器缩放滑块同档步进 */
export const resolveNextOutOfFrameViewZoomPercent = (
  current: number,
  wheelDeltaY: number,
  maxPercent = OUT_OF_FRAME_VIEW_ZOOM_MAX,
) => {
  const delta = wheelDeltaY > 0 ? -OUT_OF_FRAME_VIEW_ZOOM_STEP : OUT_OF_FRAME_VIEW_ZOOM_STEP
  return clamp(current + delta, OUT_OF_FRAME_VIEW_ZOOM_MIN, maxPercent)
}

/** 双指捏合 / 触控板捏合：按连续比例缩放 */
export const resolveOutOfFrameViewZoomPercentFromScale = (
  current: number,
  scaleRatio: number,
  maxPercent = OUT_OF_FRAME_VIEW_ZOOM_MAX,
) =>
  clamp(Math.round(current * scaleRatio), OUT_OF_FRAME_VIEW_ZOOM_MIN, maxPercent)

/** 缩放后平移偏移：pivot 为视口内坐标，默认取画布中心时可传 viewW/2+ox */
export const resolveViewOffsetAfterZoom = (
  offset: { x: number; y: number },
  pivot: { x: number; y: number },
  viewport: { width: number; height: number },
  sizeBefore: { width: number; height: number },
  sizeAfter: { width: number; height: number },
) => {
  const ratioX = sizeAfter.width / sizeBefore.width
  const ratioY = sizeAfter.height / sizeBefore.height
  return {
    x: (1 - ratioX) * (pivot.x - viewport.width / 2) + ratioX * offset.x,
    y: (1 - ratioY) * (pivot.y - viewport.height / 2) + ratioY * offset.y,
  }
}
