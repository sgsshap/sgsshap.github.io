import type { useDiyStore } from '@/features/diy-card/stores'
import FontFaceObserver from 'fontfaceobserver'

type DiyStore = ReturnType<typeof useDiyStore>

export type LoadWebFontFamilyOptions = {
  diyStore?: DiyStore
  /** runWithLoading 展示用，如「武将名字体」 */
  label?: string
  taskId?: string
  /** document.fonts.load/check 用的描述符，须与 Konva Text 一致（如 bold 16px） */
  probe?: string
}

const FONT_LOAD_TIMEOUT_MS = 12_000
const FONT_FACE_OBSERVER_TIMEOUT_MS = 12_000
const FONT_WAIT_POLL_MS = 250
const FONT_WAIT_DEFAULT_TIMEOUT_MS = 45_000

const fontLoadTasks = new Map<string, Promise<boolean>>()

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

export const buildFontProbe = (
  family: string,
  style: 'normal' | 'bold' = 'normal',
  size = '16px',
) => `${style} ${size} "${family}"`

export const isWebFontFamilyReady = (probe: string) =>
  typeof document !== 'undefined' && Boolean(document.fonts?.check(probe))

const resolveFontProbe = (family: string, probe?: string) =>
  probe ?? buildFontProbe(family)

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = globalThis.setTimeout(
          () => reject(new Error(`${label} timeout after ${timeoutMs}ms`)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer !== undefined) {
      globalThis.clearTimeout(timer)
    }
  }
}

const loadFontFamilyOnce = async (family: string, probe: string): Promise<boolean> => {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      // 不可先用 check 短路：族名可能与系统字体同名（如「隶书」「微软雅黑」），
      // check 为 true 时 @font-face 仍可能未加载，Konva 会先用系统字重绘。
      await withTimeout(
        document.fonts.load(probe),
        FONT_LOAD_TIMEOUT_MS,
        `document.fonts.load("${family}")`,
      )
      if (isWebFontFamilyReady(probe)) return true
    } catch {
      /* FontFaceObserver 兜底 */
    }
  }
  try {
    await new FontFaceObserver(family).load(null, FONT_FACE_OBSERVER_TIMEOUT_MS)
  } catch {
    return isWebFontFamilyReady(probe)
  }
  return isWebFontFamilyReady(probe)
}

/**
 * 慢网下在首次 load 超时后继续等待字体就绪（轮询 + loadingdone）
 */
export const waitForWebFontFamily = async (
  family: string,
  options: { probe?: string; timeoutMs?: number } = {},
): Promise<boolean> => {
  const probe = resolveFontProbe(family, options.probe)
  const timeoutMs = options.timeoutMs ?? FONT_WAIT_DEFAULT_TIMEOUT_MS

  if (isWebFontFamilyReady(probe)) return true

  const deadline = Date.now() + timeoutMs

  const tryLoad = async () => {
    if (typeof document === 'undefined' || !document.fonts) return false
    try {
      await document.fonts.load(probe)
    } catch {
      /* 慢网继续轮询 */
    }
    return isWebFontFamilyReady(probe)
  }

  while (Date.now() < deadline) {
    if (await tryLoad()) return true
    await sleep(FONT_WAIT_POLL_MS)
  }

  return isWebFontFamilyReady(probe)
}

/**
 * 字体晚于首屏渲染就绪时回调（如 font-display:swap 或慢网补拉）
 * @returns 取消监听
 */
export const whenWebFontFamilyReady = (
  family: string,
  callback: () => void,
  options: { probe?: string; timeoutMs?: number } = {},
): (() => void) => {
  const probe = resolveFontProbe(family, options.probe)
  const timeoutMs = options.timeoutMs ?? FONT_WAIT_DEFAULT_TIMEOUT_MS

  if (isWebFontFamilyReady(probe)) {
    callback()
    return () => undefined
  }

  let cancelled = false
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined

  const cleanup = () => {
    cancelled = true
    if (timer !== undefined) {
      globalThis.clearTimeout(timer)
      timer = undefined
    }
    document.fonts?.removeEventListener('loadingdone', onLoadingDone)
  }

  const tryFire = async () => {
    if (cancelled || !isWebFontFamilyReady(probe)) return
    try {
      await document.fonts?.load(probe)
    } catch {
      /* ignore */
    }
    if (cancelled || !isWebFontFamilyReady(probe)) return
    cleanup()
    callback()
  }

  const onLoadingDone = () => {
    void tryFire()
  }

  document.fonts?.addEventListener('loadingdone', onLoadingDone)
  timer = globalThis.setTimeout(() => cleanup(), timeoutMs)

  void (async () => {
    const deadline = Date.now() + timeoutMs
    while (!cancelled && Date.now() < deadline) {
      await tryLoadProbe(probe)
      if (cancelled) return
      if (isWebFontFamilyReady(probe)) {
        cleanup()
        callback()
        return
      }
      await sleep(FONT_WAIT_POLL_MS)
    }
  })()

  return cleanup
}

const tryLoadProbe = async (probe: string) => {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await document.fonts.load(probe)
  } catch {
    /* ignore */
  }
}

/**
 * 按需加载 Web 字体（同族名并发调用共享同一 Promise）
 * @returns 字体是否已可用于 Konva 测量/渲染
 */
export const loadWebFontFamily = (
  family: string,
  options?: LoadWebFontFamilyOptions,
): Promise<boolean> => {
  const probe = resolveFontProbe(family, options?.probe)
  const cacheKey = `${family}::${probe}`
  const cached = fontLoadTasks.get(cacheKey)
  if (cached) return cached

  const task = (async (): Promise<boolean> => {
    const run = () => loadFontFamilyOnce(family, probe)
    let ready: boolean
    if (options?.diyStore && options.label) {
      ready = await options.diyStore.runWithLoading(
        options.taskId ?? `font:${family}`,
        options.label,
        run,
      )
    } else {
      ready = await run()
    }
    if (!ready) {
      fontLoadTasks.delete(cacheKey)
    }
    return ready
  })()

  fontLoadTasks.set(cacheKey, task)
  return task
}

export type LoadWebFontFamiliesOptions = {
  diyStore?: DiyStore
  /** runWithLoading 展示用，如「底部信息字体」 */
  label?: string
  /** 各字体族对应的 probe；未指定时用 buildFontProbe(family) */
  probes?: Record<string, string | undefined>
}

/** 按需批量加载 Web 字体（自动去重） */
export const loadWebFontFamilies = async (
  families: readonly string[],
  options?: LoadWebFontFamiliesOptions,
): Promise<boolean[]> => {
  const unique = [...new Set(families.filter(Boolean))]
  if (!unique.length) return []

  return Promise.all(
    unique.map((family) =>
      loadWebFontFamily(family, {
        diyStore: options?.diyStore,
        label: options?.label,
        probe: options?.probes?.[family],
      }),
    ),
  )
}
