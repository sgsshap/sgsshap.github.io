export type MagicWandMode = 'erase' | 'restore'

export type MagicWandOptions = {
  mode: MagicWandMode
  /** 0–100，越大选区越宽 */
  tolerance: number
  /** 原图在工作蒙版上的区域；留白区不参与取样 */
  sourceRect?: {
    x: number
    y: number
    width: number
    height: number
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const resolveColorThreshold = (tolerance: number) =>
  Math.round(clamp(tolerance, 0, 100) * 0.85 + 4)

const colorWithinTolerance = (
  r0: number,
  g0: number,
  b0: number,
  r: number,
  g: number,
  b: number,
  threshold: number,
) =>
  Math.max(Math.abs(r - r0), Math.abs(g - g0), Math.abs(b - b0)) <= threshold

/**
 * 按原图颜色连通区域更新蒙版：擦除=透明，还原=不透明。
 * @returns 影响的像素数
 */
export const applyMagicWandToMask = (
  source: HTMLImageElement,
  maskCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  options: MagicWandOptions,
): number => {
  const w = Math.round(width)
  const h = Math.round(height)
  if (w <= 0 || h <= 0) return 0

  const sx = clamp(Math.floor(seedX), 0, w - 1)
  const sy = clamp(Math.floor(seedY), 0, h - 1)

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = w
  sourceCanvas.height = h
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) return 0
  sourceCtx.clearRect(0, 0, w, h)
  const rect = options.sourceRect
  if (rect) {
    sourceCtx.drawImage(
      source,
      0,
      0,
      source.naturalWidth || source.width,
      source.naturalHeight || source.height,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    )
  } else {
    sourceCtx.drawImage(source, 0, 0, w, h)
  }
  const sourceData = sourceCtx.getImageData(0, 0, w, h).data

  const maskData = maskCtx.getImageData(0, 0, w, h)
  const maskPixels = maskData.data

  const seedIdx = sy * w + sx
  const seedOffset = seedIdx * 4
  const seedR = sourceData[seedOffset]!
  const seedG = sourceData[seedOffset + 1]!
  const seedB = sourceData[seedOffset + 2]!
  const threshold = resolveColorThreshold(options.tolerance)

  const visited = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  queue[tail++] = seedIdx
  visited[seedIdx] = 1

  let affected = 0
  const targetAlpha = options.mode === 'erase' ? 0 : 255

  while (head < tail) {
    const idx = queue[head++]!
    const x = idx % w
    const y = (idx / w) | 0
    const srcOffset = idx * 4
    const r = sourceData[srcOffset]!
    const g = sourceData[srcOffset + 1]!
    const b = sourceData[srcOffset + 2]!

    if (
      idx !== seedIdx &&
      !colorWithinTolerance(seedR, seedG, seedB, r, g, b, threshold)
    ) {
      continue
    }

    const maskOffset = idx * 4 + 3
    const prevAlpha = maskPixels[maskOffset]!
    if (prevAlpha !== targetAlpha) {
      maskPixels[maskOffset] = targetAlpha
      maskPixels[idx * 4] = 255
      maskPixels[idx * 4 + 1] = 255
      maskPixels[idx * 4 + 2] = 255
      affected++
    }

    if (x > 0) pushNeighbor(idx - 1)
    if (x < w - 1) pushNeighbor(idx + 1)
    if (y > 0) pushNeighbor(idx - w)
    if (y < h - 1) pushNeighbor(idx + w)
  }

  function pushNeighbor(nextIdx: number) {
    if (visited[nextIdx]) return
    const off = nextIdx * 4
    if (
      !colorWithinTolerance(
        seedR,
        seedG,
        seedB,
        sourceData[off]!,
        sourceData[off + 1]!,
        sourceData[off + 2]!,
        threshold,
      )
    ) {
      return
    }
    visited[nextIdx] = 1
    queue[tail++] = nextIdx
  }

  if (affected > 0) {
    maskCtx.putImageData(maskData, 0, 0)
  }
  return affected
}
