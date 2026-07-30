import { DIY_MATTING_MODELS_SEGMENT } from '@/features/diy-card/constants/publicAssets'
import type { MattingProgress } from '@/features/diy-card/utils/outOfFrame/mattingProgress'
import { buildMattingProgress } from '@/features/diy-card/utils/outOfFrame/mattingProgress'
import {
  isMattingGpuSessionBlocked,
  probeMattingWebGpuBasic,
} from '@/features/diy-card/utils/outOfFrame/mattingGpuSupport'
import { isDiyPcLayoutViewport, isNarrowViewport } from '@/shared/utils/deviceCapability'
import { isTouchDevice } from '@/shared/utils/naive/touchDevice'

const PACKAGE_VERSION = '1.7.0'

/** 推理用最大边长（imgly 内部固定 1024；此处仅用于方形垫图尺寸上限） */
export const MATTING_MAX_EDGE = 2048

const REMOTE_PUBLIC_PATH = `https://staticimgly.com/@imgly/background-removal-data/${PACKAGE_VERSION}/dist/`

export type MattingModelId = 'isnet_quint8' | 'isnet_fp16' | 'isnet'

export type MattingModelOption = {
  value: MattingModelId
  /** 展示名 */
  label: string
  /** 模型体积说明（仅 ONNX 权重，不含共享 WASM） */
  sizeLabel: string
  /** 体积档位，用于判断「小→大」切换 */
  sizeRank: number
}

export const MATTING_MODEL_OPTIONS: MattingModelOption[] = [
  { value: 'isnet_quint8', label: '轻量', sizeLabel: '约 42MB', sizeRank: 0 },
  { value: 'isnet_fp16', label: '标准', sizeLabel: '约 84MB', sizeRank: 1 },
  { value: 'isnet', label: '精细', sizeLabel: '约 168MB', sizeRank: 2 },
]

export const resolveMattingModelOption = (model: MattingModelId) =>
  MATTING_MODEL_OPTIONS.find((item) => item.value === model) ?? MATTING_MODEL_OPTIONS[0]!

/**
 * imgly 在 WebGPU 上对 fp16/fp32 有硬件加速；quint8 量化模型走 CPU+SIMD 更合适。
 * 部分浏览器 / 驱动 WebGPU 与 ONNX 算子不兼容，会自动回退 CPU。
 */
export const resolveMattingDevice = (model: MattingModelId): 'cpu' | 'gpu' => {
  if (model === 'isnet_quint8') return 'cpu'
  if (isMattingGpuSessionBlocked()) return 'cpu'
  return 'gpu'
}

export const resolveMattingDeviceAsync = async (
  model: MattingModelId,
): Promise<'cpu' | 'gpu'> => {
  if (model === 'isnet_quint8') return 'cpu'
  if (isMattingGpuSessionBlocked()) return 'cpu'
  const webGpuReady = await probeMattingWebGpuBasic()
  return webGpuReady ? 'gpu' : 'cpu'
}

/** 手机/窄屏默认轻量；电脑默认标准 */
export const resolveDefaultMattingModel = (isMobile = false): MattingModelId =>
  isMobile ? 'isnet_quint8' : 'isnet_fp16'

export const resolveDefaultMattingModelForViewport = (): MattingModelId =>
  resolveDefaultMattingModel(!isDiyPcLayoutViewport() && (isTouchDevice() || isNarrowViewport()))

/** 返回值 < 0 表示从 prev 切换到 next 为「小→大」 */
export const compareMattingModelSize = (prev: MattingModelId, next: MattingModelId) =>
  resolveMattingModelOption(prev).sizeRank - resolveMattingModelOption(next).sizeRank

let resolvedPublicPath: string | null = null
const preloadPromises = new Map<string, Promise<void>>()

const buildMattingPreloadKey = (model: MattingModelId, device: 'cpu' | 'gpu') =>
  `${model}:${device}`

/** GPU 回退 CPU 后清除预加载缓存，避免沿用失败的 WebGPU 会话 */
export const clearMattingPreloadCache = (model?: MattingModelId) => {
  if (!model) {
    preloadPromises.clear()
    return
  }
  for (const key of preloadPromises.keys()) {
    if (key.startsWith(`${model}:`)) {
      preloadPromises.delete(key)
    }
  }
}

/** 将 Vite base 相对路径转为库可用的绝对 publicPath */
const resolveLocalPublicPath = (): string | null => {
  if (typeof window === 'undefined') return null
  const baseUrl = import.meta.env.BASE_URL || '/'
  const joined = `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}${DIY_MATTING_MODELS_SEGMENT}/`
  return new URL(joined, window.location.origin).href
}

const mapDownloadProgress = (
  key: string,
  current: number,
  total: number,
  onProgress?: (progress: MattingProgress) => void,
) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  onProgress?.(
    buildMattingProgress(2, 5, '加载抠图模型', {
      detail: `正在下载 ${key}（${percent}%）…`,
      stepRatio: total > 0 ? current / total : 0,
    }),
  )
}

/** 优先使用 public/diy/matting-models 本地资源，避免境外 CDN 极慢 */
export const resolveMattingPublicPath = async (): Promise<string> => {
  if (resolvedPublicPath) return resolvedPublicPath
  const localPublicPath = resolveLocalPublicPath()
  if (localPublicPath) {
    try {
      const res = await fetch(new URL('resources.json', localPublicPath).href, { method: 'HEAD' })
      if (res.ok) {
        resolvedPublicPath = localPublicPath.endsWith('/') ? localPublicPath : `${localPublicPath}/`
        return resolvedPublicPath
      }
    } catch {
      // ignore
    }
  }
  resolvedPublicPath = REMOTE_PUBLIC_PATH
  return resolvedPublicPath
}

export type MattingOutputFormat = 'image/png' | 'image/x-alpha8'

export type MattingRuntimeConfig = {
  publicPath: string
  model: MattingModelId
  device: 'cpu' | 'gpu'
  rescale: boolean
  output: {
    format: MattingOutputFormat
    quality: number
  }
  progress?: (key: string, current: number, total: number) => void
}

export const buildMattingConfig = async (
  model: MattingModelId,
  onProgress?: (progress: MattingProgress) => void,
): Promise<MattingRuntimeConfig> => {
  const publicPath = await resolveMattingPublicPath()
  const device = await resolveMattingDeviceAsync(model)
  return {
    publicPath,
    model,
    device,
    rescale: true,
    output: {
      format: 'image/png',
      quality: 1,
    },
    progress: (key, current, total) => {
      mapDownloadProgress(key, current, total, onProgress)
    },
  }
}

/** 打开编辑器时后台预加载 WASM + 模型，减少点击「智能抠图」后的等待 */
export const preloadMattingAssets = (
  model: MattingModelId,
  onProgress?: (progress: MattingProgress) => void,
) =>
  (async () => {
    const config = await buildMattingConfig(model, onProgress)
    const key = buildMattingPreloadKey(model, config.device)
    const cached = preloadPromises.get(key)
    if (cached) return cached

    const promise = (async () => {
      const { preload } = await import('@imgly/background-removal')
      await preload(config)
    })().catch((error) => {
      preloadPromises.delete(key)
      throw error
    })

    preloadPromises.set(key, promise)
    return promise
  })()

export const isMattingUsingLocalAssets = () => {
  const local = resolveLocalPublicPath()
  return Boolean(local && resolvedPublicPath === local)
}

export const getMattingAssetHint = async (model: MattingModelId) => {
  const publicPath = await resolveMattingPublicPath()
  const local = resolveLocalPublicPath()
  const { label, sizeLabel } = resolveMattingModelOption(model)
  const deviceNote =
    resolveMattingDevice(model) === 'gpu' ? 'GPU 加速（不可用时自动改 CPU）' : 'CPU 运行'
  const qualityNote =
    model === 'isnet'
      ? '发丝/半透明材质边缘略好，多数立绘与标准差别不大'
      : model === 'isnet_fp16'
        ? '速度与质量平衡，电脑端首选'
        : '体积小，适合手机；电脑端不会比标准更快'
  const sourceNote =
    local && publicPath === local
      ? '已从本地加载'
      : '首次需从网络下载，若很慢请运行 pnpm setup:matting-models'
  return `当前模型：${label}（${sizeLabel} · ${deviceNote}）。${qualityNote}。${sourceNote}。`
}
