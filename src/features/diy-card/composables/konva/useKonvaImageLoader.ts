import type { useDiyStore } from '@/features/diy-card/stores'
import {
  isPersistedImageRef,
  resolvePersistedImageSrc,
} from '@/features/diy-card/stores/history/persistSnapshot'
import {
  acquireImageLoadSlot,
  releaseImageLoadSlot,
  runWithImageLoadSlot,
  type ImageLoadPriority,
} from '@/features/diy-card/composables/konva/imageLoadConcurrency'

/**
 * Konva 图片加载
 *
 * 模板 layers 中加载静态图、武将图等时使用；配合 `createTrackedKonvaImageLoader` 可纳入 DIY loading 统计。
 */

const DEFAULT_IMAGE_LOAD_TIMEOUT_MS = 30_000
const LOCAL_IMAGE_LOAD_TIMEOUT_MS = 12_000
const IMAGE_DECODE_GRACE_MS = 120
const IMAGE_LOAD_RETRY_DELAYS_MS = [0, 400, 1200] as const
const PERSISTED_REF_RESOLVE_RETRIES = 10
const PERSISTED_REF_RESOLVE_DELAY_MS = 40

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

type ImageLoadOptions = {
  crossOrigin?: string | null
  timeoutMs: number
}

const isImageElementReady = (imgObj: HTMLImageElement) =>
  imgObj.complete && imgObj.naturalWidth > 0 && imgObj.naturalHeight > 0

const loadImageElement = (
  src: string,
  { crossOrigin = null, timeoutMs }: ImageLoadOptions,
): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const imgObj = new Image()
    if (crossOrigin) {
      imgObj.crossOrigin = crossOrigin
    }
    let settled = false
    let decodeGraceTimer: ReturnType<typeof globalThis.setTimeout> | undefined

    const settle = (action: 'resolve' | 'reject', value?: HTMLImageElement | Error) => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timer)
      if (decodeGraceTimer !== undefined) {
        globalThis.clearTimeout(decodeGraceTimer)
      }
      imgObj.onload = null
      imgObj.onerror = null
      if (action === 'resolve' && value instanceof HTMLImageElement) {
        resolve(value)
        return
      }
      reject(value instanceof Error ? value : new Error(`image load failed: ${src}`))
    }

    const resolveIfReady = () => {
      if (!isImageElementReady(imgObj)) return false
      settle('resolve', imgObj)
      return true
    }

    const rejectTimeout = () => {
      if (resolveIfReady()) return
      // Network 已返回但 onload 尚未调度时，再给解码/主线程一小段宽限
      decodeGraceTimer = globalThis.setTimeout(() => {
        if (resolveIfReady()) return
        settle('reject', new Error(`image load timeout: ${src}`))
      }, IMAGE_DECODE_GRACE_MS)
    }

    const timer = globalThis.setTimeout(rejectTimeout, timeoutMs)

    imgObj.onload = () => {
      if (!isImageElementReady(imgObj)) {
        settle('reject', new Error(`image has zero dimensions: ${src}`))
        return
      }
      settle('resolve', imgObj)
    }
    imgObj.onerror = () => settle('reject', new Error(`image load failed: ${src}`))
    imgObj.src = src

    if (resolveIfReady()) return
  })

const loadImageViaFetchBlob = async (
  src: string,
  timeoutMs: number,
): Promise<HTMLImageElement> => {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(src, { signal: controller.signal, cache: 'force-cache' })
    if (!response.ok) {
      throw new Error(`image fetch failed: ${response.status} ${src}`)
    }
    const blob = await response.blob()
    if (blob.size <= 0) {
      throw new Error(`image fetch empty: ${src}`)
    }
    const objectUrl = URL.createObjectURL(blob)
    try {
      return await loadImageElement(objectUrl, {
        crossOrigin: null,
        timeoutMs: Math.min(timeoutMs, IMAGE_DECODE_GRACE_MS + 2_000),
      })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } finally {
    globalThis.clearTimeout(timer)
  }
}

const isRemoteImageUrl = (src: string) => /^https?:\/\//i.test(src)
const isDataImageUrl = (src: string) => /^data:/i.test(src)

const templateImageTasks = new Map<string, Promise<HTMLImageElement>>()

const resolveLoadableImageSrc = async (src: string): Promise<string> => {
  const trimmed = src.trim()
  if (!trimmed) {
    throw new Error('empty image src')
  }
  if (!isPersistedImageRef(trimmed)) {
    return trimmed
  }

  for (let attempt = 0; attempt < PERSISTED_REF_RESOLVE_RETRIES; attempt += 1) {
    const resolved = resolvePersistedImageSrc(trimmed)
    if (!isPersistedImageRef(resolved)) {
      return resolved
    }
    if (attempt < PERSISTED_REF_RESOLVE_RETRIES - 1) {
      await sleep(PERSISTED_REF_RESOLVE_DELAY_MS)
    }
  }

  throw new Error(`unresolved persisted image ref: ${src}`)
}

const loadKonvaImageAttempts = async (
  normalized: string,
  timeoutMs: number,
  priority: ImageLoadPriority,
): Promise<HTMLImageElement> => {
  const localTimeoutMs = Math.min(timeoutMs, LOCAL_IMAGE_LOAD_TIMEOUT_MS)
  const attempts: Array<() => Promise<HTMLImageElement>> = isDataImageUrl(normalized)
    ? [
        () =>
          runWithImageLoadSlot(
            () => loadImageElement(normalized, { crossOrigin: null, timeoutMs: localTimeoutMs }),
            priority,
          ),
      ]
    : isRemoteImageUrl(normalized)
      ? [
          () =>
            runWithImageLoadSlot(
              () => loadImageElement(normalized, { crossOrigin: 'Anonymous', timeoutMs }),
              priority,
            ),
          () =>
            runWithImageLoadSlot(
              () => loadImageElement(normalized, { crossOrigin: null, timeoutMs }),
              priority,
            ),
          () => runWithImageLoadSlot(() => loadImageViaFetchBlob(normalized, timeoutMs), priority),
        ]
      : [
          // 同源模板素材：fetch 完成即表示 Network 已返回，比 <img> 等 onload 更可靠
          () =>
            runWithImageLoadSlot(() => loadImageViaFetchBlob(normalized, localTimeoutMs), priority),
          () =>
            runWithImageLoadSlot(
              () =>
                loadImageElement(normalized, { crossOrigin: null, timeoutMs: localTimeoutMs }),
              priority,
            ),
        ]

  let lastError: Error | undefined
  for (let round = 0; round < IMAGE_LOAD_RETRY_DELAYS_MS.length; round += 1) {
    if (round > 0) {
      await sleep(IMAGE_LOAD_RETRY_DELAYS_MS[round]!)
    }
    for (const attempt of attempts) {
      try {
        return await attempt()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  throw lastError ?? new Error(`image load failed: ${normalized}`)
}

/**
 * 加载 Konva 可用的图片对象
 * @param src 图片地址
 */
export type KonvaImageLoadOptions = {
  timeoutMs?: number
  priority?: ImageLoadPriority
  /**
   * 为 true 时走 <img> 直链并在解码过程中回调 onProgress（类似浏览器逐行刷新）。
   * 仅对 http(s)/同源相对路径生效；data URL 与 fetch-blob 回退路径仍一次性解码。
   */
  progressive?: boolean
  /** progressive 模式下每次 rAF 触发，用于提前 updateNode / batchDraw */
  onProgress?: (image: HTMLImageElement) => void
}

const loadKonvaImageProgressive = async (
  normalized: string,
  timeoutMs: number,
  priority: ImageLoadPriority,
  onProgress?: (image: HTMLImageElement) => void,
): Promise<HTMLImageElement> => {
  const crossOriginAttempts: Array<string | null> = isRemoteImageUrl(normalized)
    ? ['Anonymous', null]
    : [null]

  let lastError: Error | undefined
  for (const crossOrigin of crossOriginAttempts) {
    await acquireImageLoadSlot(priority)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const imgObj = new Image()
        if (crossOrigin) {
          imgObj.crossOrigin = crossOrigin
        }

        let settled = false
        let decodeGraceTimer: ReturnType<typeof globalThis.setTimeout> | undefined
        let rafId = 0

        const emitProgress = () => {
          onProgress?.(imgObj)
        }

        const stopProgressLoop = () => {
          if (rafId) {
            globalThis.cancelAnimationFrame(rafId)
            rafId = 0
          }
        }

        const tickProgress = () => {
          emitProgress()
          if (!imgObj.complete) {
            rafId = globalThis.requestAnimationFrame(tickProgress)
          }
        }

        const settle = (action: 'resolve' | 'reject', value?: HTMLImageElement | Error) => {
          if (settled) return
          settled = true
          stopProgressLoop()
          globalThis.clearTimeout(timer)
          if (decodeGraceTimer !== undefined) {
            globalThis.clearTimeout(decodeGraceTimer)
          }
          imgObj.onload = null
          imgObj.onerror = null
          if (action === 'resolve' && value instanceof HTMLImageElement) {
            resolve(value)
            return
          }
          reject(value instanceof Error ? value : new Error(`image load failed: ${normalized}`))
        }

        const resolveIfReady = () => {
          if (!isImageElementReady(imgObj)) return false
          emitProgress()
          settle('resolve', imgObj)
          return true
        }

        const rejectTimeout = () => {
          if (resolveIfReady()) return
          decodeGraceTimer = globalThis.setTimeout(() => {
            if (resolveIfReady()) return
            settle('reject', new Error(`image load timeout: ${normalized}`))
          }, IMAGE_DECODE_GRACE_MS)
        }

        const timer = globalThis.setTimeout(rejectTimeout, timeoutMs)

        imgObj.onload = () => {
          if (!isImageElementReady(imgObj)) {
            settle('reject', new Error(`image has zero dimensions: ${normalized}`))
            return
          }
          emitProgress()
          settle('resolve', imgObj)
        }
        imgObj.onerror = () => settle('reject', new Error(`image load failed: ${normalized}`))

        imgObj.src = normalized
        emitProgress()
        if (resolveIfReady()) return
        rafId = globalThis.requestAnimationFrame(tickProgress)
      })
      return img
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    } finally {
      releaseImageLoadSlot()
    }
  }

  throw lastError ?? new Error(`image load failed: ${normalized}`)
}

export async function loadKonvaImage(
  src: string,
  options: KonvaImageLoadOptions = {},
): Promise<HTMLImageElement> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMAGE_LOAD_TIMEOUT_MS
  const priority = options.priority ?? 'normal'
  const normalized = await resolveLoadableImageSrc(src)

  if (options.progressive && !isDataImageUrl(normalized)) {
    return loadKonvaImageProgressive(normalized, timeoutMs, priority, options.onProgress)
  }

  const shouldShareTask = !isRemoteImageUrl(normalized) && !isDataImageUrl(normalized)
  const cacheKey = shouldShareTask ? `${priority}:${normalized}` : normalized
  if (shouldShareTask) {
    const cached = templateImageTasks.get(cacheKey)
    if (cached) return cached
  }

  const task = loadKonvaImageAttempts(normalized, timeoutMs, priority).catch((error) => {
    if (shouldShareTask) {
      templateImageTasks.delete(cacheKey)
    }
    throw error
  })

  if (shouldShareTask) {
    templateImageTasks.set(cacheKey, task)
  }

  return task
}

/**
 * 创建带 diyStore loading 登记的图片加载器
 * @param diyStore DIY 全局 store
 */
export function createTrackedKonvaImageLoader(diyStore: ReturnType<typeof useDiyStore>) {
  /**
   * @param taskId 加载任务 id
   * @param label 遮罩展示文案
   * @param src 图片地址
   * @param options 超时与队列优先级（武将图等首屏关键素材应传 high）
   */
  return (taskId: string, label: string, src: string, options?: KonvaImageLoadOptions) =>
    diyStore.runWithLoading(taskId, label, () => loadKonvaImage(src, options))
}
