import { isIOSWebKit } from '@/shared/utils/deviceCapability'

/** 布局视口基准（clientWidth/Height），用于与浏览器页面缩放区分 */
let trackedLayoutWidth = 0
let trackedLayoutHeight = 0

const PAGE_ZOOM_SCALE_EPSILON = 0.01

export function readLayoutViewportSize(): { width: number; height: number } {
  if (typeof document === 'undefined') {
    return { width: 0, height: 0 }
  }
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }
}

/** 页面缩放期间使用上次稳定的 layout 尺寸（iPad 上 layout 可能随 pinch 一起收缩） */
export function readStableLayoutViewportSize(): { width: number; height: number } {
  const current = readLayoutViewportSize()
  if (!isBrowserPageZoom()) return current

  if (typeof window !== 'undefined') {
    return {
      width: trackedLayoutWidth > 0 ? trackedLayoutWidth : window.innerWidth,
      height: trackedLayoutHeight > 0 ? trackedLayoutHeight : window.innerHeight,
    }
  }

  return {
    width: trackedLayoutWidth > 0 ? trackedLayoutWidth : current.width,
    height: trackedLayoutHeight > 0 ? trackedLayoutHeight : current.height,
  }
}

const readViewportZoomRatios = () => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  const { width: layoutWidth, height: layoutHeight } = readLayoutViewportSize()

  let widthRatio = 1
  let heightRatio = 1

  if (vv) {
    if (layoutWidth > 0 && vv.width > 0) {
      widthRatio = layoutWidth / vv.width
    }
    if (layoutHeight > 0 && vv.height > 0) {
      heightRatio = layoutHeight / vv.height
    }
  }

  return { widthRatio, heightRatio }
}

const isLikelyKeyboardViewportShrink = () => {
  const { widthRatio, heightRatio } = readViewportZoomRatios()
  return widthRatio <= 1 + PAGE_ZOOM_SCALE_EPSILON && heightRatio > 1 + PAGE_ZOOM_SCALE_EPSILON
}

/** 当前浏览器页面缩放倍率（1 = 100%） */
export function readBrowserPageZoomScale(): number {
  if (typeof window === 'undefined') return 1
  if (isLikelyKeyboardViewportShrink()) return 1

  const vv = window.visualViewport
  if (!vv) return 1

  if (Math.abs(vv.scale - 1) > PAGE_ZOOM_SCALE_EPSILON) {
    return vv.scale
  }

  const { widthRatio, heightRatio } = readViewportZoomRatios()
  const inferred = Math.max(widthRatio, heightRatio)
  if (inferred > 1 + PAGE_ZOOM_SCALE_EPSILON && widthRatio > 1 + PAGE_ZOOM_SCALE_EPSILON) {
    return inferred
  }

  // iPad/iOS：visualViewport.scale 偶发仍为 1，但 visual 宽度已小于 layout/inner
  if (isIOSWebKit()) {
    const innerWidth = window.innerWidth
    const innerHeight = window.innerHeight
    if (innerWidth > 0 && vv.width > 0 && vv.width < innerWidth - 8) {
      const widthZoom = innerWidth / vv.width
      const heightGap = innerHeight - vv.height
      const widthGap = innerWidth - vv.width
      if (widthGap > 8 && (heightGap < 80 || heightGap / Math.max(innerHeight, 1) < 0.12)) {
        return widthZoom
      }
      if (widthGap > 8 && heightGap > 8) {
        const wRatio = widthGap / innerWidth
        const hRatio = heightGap / innerHeight
        if (Math.abs(wRatio - hRatio) < 0.12) {
          return Math.max(widthZoom, innerHeight / Math.max(vv.height, 1))
        }
      }
    }
  }

  return 1
}

/** 浏览器双指页面缩放（非软键盘、非布局视口 resize） */
export function isBrowserPageZoom(): boolean {
  return readBrowserPageZoomScale() > 1 + PAGE_ZOOM_SCALE_EPSILON
}

const layoutResizeSubscribers = new Set<() => void>()
let layoutResizeFlushScheduled = false

/** 初始化或重置布局视口追踪基准 */
export function initLayoutViewportTracking(): void {
  const { width, height } = readLayoutViewportSize()
  trackedLayoutWidth = width
  trackedLayoutHeight = height
}

/** 布局视口相对上次基准是否变化（不修改基准） */
export function hasLayoutViewportSizeChanged(): boolean {
  const { width, height } = readLayoutViewportSize()
  return width !== trackedLayoutWidth || height !== trackedLayoutHeight
}

export function syncLayoutViewportTracking(): void {
  const { width, height } = readLayoutViewportSize()
  trackedLayoutWidth = width
  trackedLayoutHeight = height
}

const flushLayoutViewportResize = () => {
  layoutResizeFlushScheduled = false
  // iPad pinch 可能连 layout 一起收缩，此时不应重算画布或更新基准
  if (isBrowserPageZoom()) return
  if (!hasLayoutViewportSizeChanged()) return
  syncLayoutViewportTracking()
  for (const handler of layoutResizeSubscribers) {
    handler()
  }
}

const scheduleLayoutViewportResizeFlush = () => {
  if (layoutResizeFlushScheduled) return
  layoutResizeFlushScheduled = true
  requestAnimationFrame(flushLayoutViewportResize)
}

/**
 * 订阅布局视口尺寸变化（忽略浏览器页面缩放）。
 * @returns 取消订阅
 */
export function subscribeLayoutViewportResize(handler: () => void): () => void {
  layoutResizeSubscribers.add(handler)
  return () => {
    layoutResizeSubscribers.delete(handler)
  }
}

let layoutViewportListenerCount = 0

/**
 * 监听 resize / visualViewport.resize，仅在布局视口变化时分发给所有订阅者。
 * @returns 卸载函数
 */
export function installLayoutViewportResizeListener(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const unsubscribe = subscribeLayoutViewportResize(handler)

  if (layoutViewportListenerCount === 0) {
    initLayoutViewportTracking()
    window.addEventListener('resize', scheduleLayoutViewportResizeFlush)
    window.visualViewport?.addEventListener('resize', scheduleLayoutViewportResizeFlush)
  }
  layoutViewportListenerCount += 1

  return () => {
    unsubscribe()
    layoutViewportListenerCount -= 1
    if (layoutViewportListenerCount <= 0) {
      layoutViewportListenerCount = 0
      window.removeEventListener('resize', scheduleLayoutViewportResizeFlush)
      window.visualViewport?.removeEventListener('resize', scheduleLayoutViewportResizeFlush)
    }
  }
}
