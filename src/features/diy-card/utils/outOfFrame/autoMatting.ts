import { loadOutOfFrameImage } from '@/features/diy-card/utils/outOfFrame/imageLoader'
import {
  buildMattingConfig,
  clearMattingPreloadCache,
  MATTING_MAX_EDGE,
  preloadMattingAssets,
  resolveDefaultMattingModelForViewport,
  resolveMattingModelOption,
  type MattingModelId,
  type MattingRuntimeConfig,
} from '@/features/diy-card/utils/outOfFrame/mattingConfig'
import {
  markMattingGpuUnavailable,
  runWithMattingGpuErrorWatch,
  shouldFallbackMattingToCpu,
} from '@/features/diy-card/utils/outOfFrame/mattingGpuSupport'
import { buildMattingProgress, type MattingProgress } from '@/features/diy-card/utils/outOfFrame/mattingProgress'

export type { MattingProgress } from '@/features/diy-card/utils/outOfFrame/mattingProgress'
export { buildMattingProgress } from '@/features/diy-card/utils/outOfFrame/mattingProgress'

export { preloadMattingAssets, getMattingAssetHint } from '@/features/diy-card/utils/outOfFrame/mattingConfig'
export type { MattingModelId, MattingModelOption } from '@/features/diy-card/utils/outOfFrame/mattingConfig'
export {
  MATTING_MODEL_OPTIONS,
  resolveDefaultMattingModel,
  resolveDefaultMattingModelForViewport,
  resolveMattingModelOption,
  compareMattingModelSize,
} from '@/features/diy-card/utils/outOfFrame/mattingConfig'

const MATTING_TOTAL_STEPS = 5
const MATTING_NOISE_FLOOR = 1

type MattingGeometry = {
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  squareSize: number
  nativeWidth: number
  nativeHeight: number
}

type AlphaMask = {
  data: Uint8Array
  width: number
  height: number
}

const resolveMattingGeometry = (
  nativeWidth: number,
  nativeHeight: number,
): MattingGeometry => {
  const natW = Math.max(1, Math.round(nativeWidth))
  const natH = Math.max(1, Math.round(nativeHeight))
  const maxEdge = Math.max(natW, natH)
  const scale = Math.min(1, MATTING_MAX_EDGE / maxEdge)
  const cropWidth = Math.max(1, Math.round(natW * scale))
  const cropHeight = Math.max(1, Math.round(natH * scale))
  const squareSize = Math.max(cropWidth, cropHeight)

  return {
    cropX: Math.round((squareSize - cropWidth) / 2),
    cropY: Math.round((squareSize - cropHeight) / 2),
    cropWidth,
    cropHeight,
    squareSize,
    nativeWidth: natW,
    nativeHeight: natH,
  }
}

/** 竖图垫成正方形：边缘延展填充留白 */
const buildEdgePaddedSquareSource = async (
  sourcePic: string,
  geometry: MattingGeometry,
): Promise<string> => {
  const source = await loadOutOfFrameImage(sourcePic)
  const { cropWidth, cropHeight, squareSize, cropX, cropY } = geometry

  const imageCanvas = document.createElement('canvas')
  imageCanvas.width = cropWidth
  imageCanvas.height = cropHeight
  const imageCtx = imageCanvas.getContext('2d')
  if (!imageCtx) throw new Error('无法创建画布上下文')
  imageCtx.imageSmoothingEnabled = true
  imageCtx.imageSmoothingQuality = 'high'
  imageCtx.drawImage(source, 0, 0, cropWidth, cropHeight)

  const squareCanvas = document.createElement('canvas')
  squareCanvas.width = squareSize
  squareCanvas.height = squareSize
  const ctx = squareCanvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')

  ctx.drawImage(imageCanvas, cropX, cropY)

  if (cropX > 0) {
    ctx.drawImage(imageCanvas, 0, 0, 1, cropHeight, 0, cropY, cropX, cropHeight)
  }
  const rightPadX = cropX + cropWidth
  if (rightPadX < squareSize) {
    const padW = squareSize - rightPadX
    ctx.drawImage(
      imageCanvas,
      cropWidth - 1,
      0,
      1,
      cropHeight,
      rightPadX,
      cropY,
      padW,
      cropHeight,
    )
  }
  if (cropY > 0) {
    ctx.drawImage(imageCanvas, 0, 0, cropWidth, 1, cropX, 0, cropWidth, cropY)
  }
  const bottomPadY = cropY + cropHeight
  if (bottomPadY < squareSize) {
    const padH = squareSize - bottomPadY
    ctx.drawImage(
      imageCanvas,
      0,
      cropHeight - 1,
      cropWidth,
      1,
      cropX,
      bottomPadY,
      cropWidth,
      padH,
    )
  }

  return squareCanvas.toDataURL('image/png')
}

const blobToImage = (blob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('抠图结果加载失败'))
    }
    image.src = url
  })

/**
 * imgly segmentForeground 蒙版：可见度在 RGB 三通道（三通道相同），alpha 常为 255。
 * 若优先读 alpha 会把背景也当成不透明，预览就会出现满屏棋盘格。
 */
const readSegmentationMaskSample = (data: Uint8ClampedArray, offset: number): number => {
  const r = data[offset]!
  const g = data[offset + 1]!
  const b = data[offset + 2]!
  const a = data[offset + 3]!
  const rgbPeak = Math.max(r, g, b)
  if (rgbPeak > MATTING_NOISE_FLOOR) return rgbPeak
  return a > MATTING_NOISE_FLOOR ? a : 0
}

const parseAlpha8Blob = async (blob: Blob): Promise<AlphaMask> => {
  const widthMatch = blob.type.match(/width=(\d+)/i)
  const heightMatch = blob.type.match(/height=(\d+)/i)
  const width = widthMatch ? Number(widthMatch[1]) : 0
  const height = heightMatch ? Number(heightMatch[1]) : 0
  if (!width || !height) throw new Error('抠图蒙版尺寸解析失败')

  const raw = new Uint8Array(await blob.arrayBuffer())
  const pixelCount = width * height
  if (raw.length === pixelCount) {
    return { data: raw, width, height }
  }
  if (raw.length === pixelCount * 4) {
    const alpha = new Uint8Array(pixelCount)
    for (let p = 0; p < pixelCount; p++) {
      const i = p * 4
      const rgbPeak = Math.max(raw[i]!, raw[i + 1]!, raw[i + 2]!)
      if (rgbPeak > MATTING_NOISE_FLOOR) {
        alpha[p] = rgbPeak
        continue
      }
      const a = raw[i + 3]!
      alpha[p] = a > MATTING_NOISE_FLOOR ? a : 0
    }
    return { data: alpha, width, height }
  }
  throw new Error('抠图蒙版数据长度不匹配')
}

const parseSegmentForegroundMaskBlob = async (blob: Blob): Promise<AlphaMask> => {
  if (blob.type.includes('image/x-alpha8')) {
    return parseAlpha8Blob(blob)
  }

  const image = await blobToImage(blob)
  const width = image.naturalWidth
  const height = image.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建蒙版画布')
  ctx.drawImage(image, 0, 0)
  const { data } = ctx.getImageData(0, 0, width, height)
  const alpha = new Uint8Array(width * height)
  for (let p = 0; p < alpha.length; p++) {
    alpha[p] = readSegmentationMaskSample(data, p * 4)
  }
  return { data: alpha, width, height }
}

const cropAlphaMask = (source: AlphaMask, geometry: MattingGeometry): AlphaMask => {
  const { cropX, cropY, cropWidth, cropHeight } = geometry
  const out = new Uint8Array(cropWidth * cropHeight)
  for (let row = 0; row < cropHeight; row++) {
    const srcRow = cropY + row
    if (srcRow < 0 || srcRow >= source.height) continue
    for (let col = 0; col < cropWidth; col++) {
      const srcCol = cropX + col
      if (srcCol < 0 || srcCol >= source.width) continue
      out[row * cropWidth + col] = source.data[srcRow * source.width + srcCol]!
    }
  }
  return { data: out, width: cropWidth, height: cropHeight }
}

const resizeAlphaMask = (
  source: AlphaMask,
  targetWidth: number,
  targetHeight: number,
): AlphaMask => {
  const tw = Math.max(1, Math.round(targetWidth))
  const th = Math.max(1, Math.round(targetHeight))
  if (source.width === tw && source.height === th) return source

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = source.width
  srcCanvas.height = source.height
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })
  if (!srcCtx) throw new Error('无法创建蒙版画布')

  const srcImage = srcCtx.createImageData(source.width, source.height)
  for (let p = 0; p < source.data.length; p++) {
    const offset = p * 4
    const value = source.data[p]!
    srcImage.data[offset] = 255
    srcImage.data[offset + 1] = 255
    srcImage.data[offset + 2] = 255
    srcImage.data[offset + 3] = value
  }
  srcCtx.putImageData(srcImage, 0, 0)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = tw
  outCanvas.height = th
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true })
  if (!outCtx) throw new Error('无法创建蒙版画布')
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'
  outCtx.drawImage(srcCanvas, 0, 0, tw, th)

  const { data } = outCtx.getImageData(0, 0, tw, th)
  const out = new Uint8Array(tw * th)
  for (let p = 0; p < out.length; p++) {
    out[p] = data[p * 4 + 3]!
  }
  return { data: out, width: tw, height: th }
}

/** 笔刷蒙版：白底 RGB + alpha 表示可见度 */
const alphaMaskToBrushDataUrl = (mask: AlphaMask): string => {
  const canvas = document.createElement('canvas')
  canvas.width = mask.width
  canvas.height = mask.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建蒙版画布')

  const image = ctx.createImageData(mask.width, mask.height)
  for (let p = 0; p < mask.data.length; p++) {
    const visibility = mask.data[p]! <= MATTING_NOISE_FLOOR ? 0 : mask.data[p]!
    const offset = p * 4
    image.data[offset] = 255
    image.data[offset + 1] = 255
    image.data[offset + 2] = 255
    image.data[offset + 3] = visibility
  }
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

const withPngOutput = (config: MattingRuntimeConfig): MattingRuntimeConfig => ({
  ...config,
  output: {
    ...config.output,
    format: 'image/png',
    quality: 1,
  },
})

const runSegmentation = async (
  source: string,
  config: MattingRuntimeConfig,
  onProgress?: (progress: MattingProgress) => void,
) => {
  const { segmentForeground } = await import('@imgly/background-removal')

  let runtimeConfig = config
  for (let attempt = 0; attempt < 2; attempt++) {
    const watched = await runWithMattingGpuErrorWatch(() =>
      segmentForeground(source, runtimeConfig),
    )
    const shouldFallback = shouldFallbackMattingToCpu(
      runtimeConfig.device,
      watched.ok ? undefined : watched.error,
      watched.webgpuErrors,
    )

    if (watched.ok && !shouldFallback) {
      return watched.result
    }

    if (!shouldFallback) {
      if (watched.ok) {
        throw new Error(watched.webgpuErrors[0] ?? 'WebGPU 推理失败')
      }
      throw watched.error
    }

    if (runtimeConfig.device === 'cpu') {
      throw watched.ok
        ? new Error(watched.webgpuErrors[0] ?? 'CPU 推理失败')
        : !watched.ok
          ? watched.error
          : new Error('CPU 推理失败')
    }

    markMattingGpuUnavailable(!watched.ok ? watched.error : watched.webgpuErrors[0])
    clearMattingPreloadCache(config.model)
    onProgress?.(
      buildMattingProgress(4, MATTING_TOTAL_STEPS, '智能抠图', {
        detail: 'GPU 不可用，改用 CPU 重试…',
        stepRatio: 0.45,
      }),
    )
    runtimeConfig = { ...runtimeConfig, device: 'cpu' }
  }

  throw new Error('智能抠图推理失败')
}

/** 浏览器端 WASM 智能抠图，返回与原图同尺寸的蒙版 data URL */
export const runAutoMattingMask = async (
  sourcePic: string,
  nativeWidth: number,
  nativeHeight: number,
  onProgress?: (progress: MattingProgress) => void,
  model: MattingModelId = resolveDefaultMattingModelForViewport(),
): Promise<string> => {
  const geometry = resolveMattingGeometry(nativeWidth, nativeHeight)

  onProgress?.(
    buildMattingProgress(1, MATTING_TOTAL_STEPS, '准备原画', {
      detail: '按原图比例垫成正方形（边缘延展），避免竖图压扁…',
      stepRatio: 0.2,
    }),
  )
  const squareSource = await buildEdgePaddedSquareSource(sourcePic, geometry)

  onProgress?.(
    buildMattingProgress(2, MATTING_TOTAL_STEPS, '加载抠图模型', {
      detail: '正在准备 WASM 与神经网络…',
      stepRatio: 0.1,
    }),
  )

  const [config] = await Promise.all([
    buildMattingConfig(model, onProgress),
    preloadMattingAssets(model, onProgress).catch(() => undefined),
  ])

  onProgress?.(
    buildMattingProgress(3, MATTING_TOTAL_STEPS, '初始化推理引擎', {
      detail: '正在启动 ONNX 运行时…',
      stepRatio: 0.5,
    }),
  )

  onProgress?.(
    buildMattingProgress(4, MATTING_TOTAL_STEPS, '智能抠图', {
      detail: `「${resolveMattingModelOption(model).label}」推理中（${geometry.squareSize}×${geometry.squareSize}）…`,
      stepRatio: 0.15,
    }),
  )

  const maskBlob = await runSegmentation(squareSource, withPngOutput(config), onProgress)

  onProgress?.(
    buildMattingProgress(5, MATTING_TOTAL_STEPS, '生成蒙版', {
      detail: '正在转换为笔刷蒙版…',
      stepRatio: 0.7,
    }),
  )

  const squareMask = await parseSegmentForegroundMaskBlob(maskBlob)
  const croppedMask = cropAlphaMask(squareMask, geometry)
  const nativeMask = resizeAlphaMask(croppedMask, geometry.nativeWidth, geometry.nativeHeight)
  const maskDataUrl = alphaMaskToBrushDataUrl(nativeMask)

  onProgress?.(
    buildMattingProgress(5, MATTING_TOTAL_STEPS, '完成', {
      detail: '智能抠图已完成',
      stepRatio: 1,
    }),
  )
  return maskDataUrl
}

/** 创建全白蒙版（未抠图时的初始状态） */
export const createFullWhiteMaskDataUrl = (width: number, height: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width)
  canvas.height = Math.round(height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建蒙版画布')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
