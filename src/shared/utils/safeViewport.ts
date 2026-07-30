import {
  isEdgeChromium,
  isEdgeIOS,
  shouldUseNativeMobileKeyboardOnEdge,
} from '@/shared/utils/browserEnv'
import {
  isBrowserPageZoom,
  readStableLayoutViewportSize,
} from '@/shared/utils/viewportLayoutResize'

const KEYBOARD_SHRINK_THRESHOLD_PX = 32

const setRootLengthVar = (name: string, value: number) => {
  if (!Number.isFinite(value) || value < 0) return
  document.documentElement.style.setProperty(name, `${Math.round(value)}px`)
}

const readVirtualKeyboardHeight = (): number => {
  if (typeof navigator === 'undefined' || !('virtualKeyboard' in navigator)) return 0
  const vk = navigator.virtualKeyboard as { boundingRect?: DOMRectReadOnly }
  const height = vk.boundingRect?.height ?? 0
  return height > 0 ? height : 0
}

export type ViewportMetrics = {
  height: number
  offsetTop: number
  offsetLeft: number
  width: number
}

/** 解析当前可视区几何 */
export const resolveViewportMetrics = (): ViewportMetrics => {
  if (typeof window === 'undefined') {
    return { height: 0, offsetTop: 0, offsetLeft: 0, width: 0 }
  }

  const vv = window.visualViewport
  const innerHeight = window.innerHeight
  const innerWidth = window.innerWidth
  const clientHeight = document.documentElement.clientHeight
  const keyboardHeight = readVirtualKeyboardHeight()

  // 双指页面缩放时 visualViewport 会收缩，但 layout 不变；UI 壳层应继续按 layout 尺寸布局。
  if (isBrowserPageZoom()) {
    const { width: layoutWidth, height: layoutHeight } = readStableLayoutViewportSize()
    return {
      height: layoutHeight > 0 ? layoutHeight : innerHeight,
      width: layoutWidth > 0 ? layoutWidth : innerWidth,
      offsetTop: 0,
      offsetLeft: 0,
    }
  }

  let height = vv?.height ?? innerHeight
  let offsetTop = 0
  let offsetLeft = vv?.offsetLeft ?? 0
  let width = vv?.width ?? window.innerWidth

  if (isEdgeChromium()) {
    const layoutShrunk =
      clientHeight > 0 && clientHeight < innerHeight - KEYBOARD_SHRINK_THRESHOLD_PX
    const visualShrunk =
      Boolean(vv && vv.height > 0 && vv.height < innerHeight - KEYBOARD_SHRINK_THRESHOLD_PX)

    if (layoutShrunk) {
      height = clientHeight
    } else if (visualShrunk && vv) {
      height = vv.height
      offsetTop = Math.max(0, vv.offsetTop)
    } else if (keyboardHeight > 0) {
      height = Math.max(0, innerHeight - keyboardHeight)
      offsetTop = Math.max(0, vv?.offsetTop ?? 0)
    } else {
      height = Math.max(
        vv?.height && vv.height > 0 ? vv.height : innerHeight,
        clientHeight > 0 ? clientHeight : innerHeight,
      )
    }
  }

  return {
    height,
    offsetTop,
    offsetLeft,
    width,
  }
}

/** 将当前可视区高度写入 CSS 变量（抽屉 / overlay 限高） */
export const applySafeViewportHeight = () => {
  if (typeof window === 'undefined') return
  // EdgiOS：不写 JS 高度，完全依赖 CSS 100dvh，避免与键盘动画竞态
  if (isEdgeIOS()) return

  const root = document.documentElement

  const { height, offsetTop, offsetLeft, width } = resolveViewportMetrics()
  if (!Number.isFinite(height) || height <= 0) return

  const heightPx = `${Math.round(height)}px`
  root.style.setProperty('--app-viewport-height-js', heightPx)
  root.style.setProperty('--app-overlay-height-js', heightPx)

  if (isEdgeChromium()) {
    setRootLengthVar('--app-viewport-offset-top-js', offsetTop)
    setRootLengthVar('--app-viewport-offset-left-js', offsetLeft)
  } else {
    root.style.setProperty('--app-viewport-offset-top-js', '0px')
    root.style.setProperty('--app-viewport-offset-left-js', '0px')
  }

  setRootLengthVar('--app-viewport-width-js', width)
}

const installEdgeChromiumVirtualKeyboardBridge = () => {
  if (typeof navigator === 'undefined' || !isEdgeChromium()) return () => {}
  if (!('virtualKeyboard' in navigator)) return () => {}

  const vk = navigator.virtualKeyboard as {
    overlaysContent: boolean
    addEventListener: (type: 'geometrychange', listener: () => void) => void
    removeEventListener: (type: 'geometrychange', listener: () => void) => void
  }

  try {
    vk.overlaysContent = true
  } catch {
    return () => {}
  }

  const onGeometryChange = () => {
    applySafeViewportHeight()
  }

  vk.addEventListener('geometrychange', onGeometryChange)
  return () => {
    vk.removeEventListener('geometrychange', onGeometryChange)
  }
}

/** 监听 resize / visualViewport，持续校正 overlay 高度 */
export function installSafeViewportHeight() {
  if (typeof window === 'undefined') return () => {}
  // EdgiOS：不订阅任何 viewport 事件
  if (shouldUseNativeMobileKeyboardOnEdge()) return () => {}

  const onViewportChange = () => {
    applySafeViewportHeight()
  }

  applySafeViewportHeight()

  const disposeVirtualKeyboard = installEdgeChromiumVirtualKeyboardBridge()

  window.addEventListener('resize', onViewportChange, { passive: true })
  window.addEventListener('pageshow', onViewportChange, { passive: true })
  document.addEventListener('visibilitychange', onViewportChange, { passive: true })
  window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true })
  window.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true })

  return () => {
    disposeVirtualKeyboard()
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('pageshow', onViewportChange)
    document.removeEventListener('visibilitychange', onViewportChange)
    window.visualViewport?.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('scroll', onViewportChange)
  }
}
