/** 导出设置：画布整体亮度范围 */
export const CANVAS_BRIGHTNESS_MIN = 0.5
export const CANVAS_BRIGHTNESS_MAX = 1.5

export const clampCanvasBrightness = (value: number): number =>
  Math.min(CANVAS_BRIGHTNESS_MAX, Math.max(CANVAS_BRIGHTNESS_MIN, value))

export const isCanvasBrightnessActive = (brightness: number): boolean =>
  Math.abs(clampCanvasBrightness(brightness) - 1) > 1e-4

/** 预览区容器 CSS 亮度（整体作用于 Konva 画布，无需逐节点滤镜） */
export const buildCanvasBrightnessCssStyle = (
  brightness: number,
): Record<string, string> | undefined => {
  if (!isCanvasBrightnessActive(brightness)) return undefined
  return { filter: `brightness(${clampCanvasBrightness(brightness)})` }
}

const loadImageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load export image for brightness adjustment'))
    img.src = dataUrl
  })

/**
 * 导出后对整图施加亮度（与预览 CSS brightness 语义一致）
 */
export const applyBrightnessToDataUrl = async (
  dataUrl: string,
  brightness: number,
  mimeType = 'image/png',
  quality = 1,
): Promise<string> => {
  const value = clampCanvasBrightness(brightness)
  if (!isCanvasBrightnessActive(value)) return dataUrl

  const img = await loadImageFromDataUrl(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  ctx.filter = `brightness(${value})`
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL(mimeType, quality)
}
