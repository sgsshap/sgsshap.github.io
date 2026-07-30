import { installLayoutViewportResizeListener } from '@/shared/utils/viewportLayoutResize'
import { computed, type CSSProperties, nextTick, onUnmounted, ref, type Ref } from 'vue'

/** 固定栏相对画布顶部的间距（首次固定时测量） */
type PinBarMetrics = {
  height: number
  gapAboveCanvas: number
}

/** 固定外套与浏览器视口上下间距（px） */
export const PINNED_SHELL_VIEWPORT_MARGIN_Y_PX = 16

/** 固定栏与画布之间的间距（px） */
export const PINNED_PIN_BAR_CANVAS_GAP_PX = 8

/** 固定 shell 内画布区左右内边距（px） */
export const PINNED_CANVAS_INSET_X_PX = 16

/** 固定 shell 内画布区上下内边距（px） */
export const PINNED_CANVAS_INSET_Y_PX = 12

/** @deprecated 由 PINNED_CANVAS_INSET_Y_PX 承担，保留导出避免外部引用报错 */
export const PINNED_VIEWPORT_FIT_BUFFER_PX = PINNED_CANVAS_INSET_Y_PX

type PinnedCanvasVisualSize = {
  width: number
  height: number
}

type UseDiyCanvasPinOptions = {
  /** 固定布局前按视口重新计算画布缩放 */
  onPinLayout?: () => void
  /** 固定模式下缩放后的画布占位尺寸（px） */
  getPinnedCanvasVisualSize?: () => PinnedCanvasVisualSize
  /** 视口底部预留（底部 Tab、安全区等），默认 16px */
  getBottomViewportReserve?: () => number
}

const defaultPinBarMetrics = (): PinBarMetrics => ({
  height: 52,
  gapAboveCanvas: PINNED_PIN_BAR_CANVAS_GAP_PX,
})

/**
 *
 * 将 `.diy-preview__canvas-box` 设为 `position: fixed`，滚动页面时预览画布保持可见。
 * 固定栏贴在 shell 顶部；画布在剩余区域内水平、垂直居中。
 * 支持 keep-alive 切页时 `suspendPin` / `restorePin` 保留用户「固定」意图。
 *
 * @param canvasBoxRef 已按 scale 设定尺寸的画布占位盒 DOM
 * @param pinBarRef 固定/取消固定按钮栏 DOM
 * @param stageRef 预览区容器（占位计算备用）
 * @param previewRootRef `.diy-preview` 根节点，shell 与 horizontal 居中参照
 */
export function useDiyCanvasPin(
  canvasBoxRef: Ref<HTMLElement | null>,
  pinBarRef: Ref<HTMLElement | null>,
  stageRef: Ref<HTMLElement | null>,
  previewRootRef: Ref<HTMLElement | null>,
  options?: UseDiyCanvasPinOptions,
) {
  const isPinned = ref(false)
  /** 用户是否开启固定（用于 keep-alive 切页后恢复） */
  const userWantsPin = ref(false)
  const pinPlaceholderHeight = ref(0)
  const pinBarPlaceholderHeight = ref(0)
  const pinnedBoxStyle = ref<CSSProperties>({})
  const pinBarPinnedStyle = ref<CSSProperties>({})
  const pinnedShellStyle = ref<CSSProperties>({})
  const pinBarMetrics = ref<PinBarMetrics | null>(null)

  const shouldFitPinnedViewport = () => userWantsPin.value

  const getBottomViewportReserve = () =>
    options?.getBottomViewportReserve?.() ?? PINNED_SHELL_VIEWPORT_MARGIN_Y_PX

  const getShellBounds = () => {
    const preview = previewRootRef.value
    const stage = stageRef.value
    const topInset = PINNED_SHELL_VIEWPORT_MARGIN_Y_PX
    const bottomReserve = getBottomViewportReserve()
    const previewRect = preview?.getBoundingClientRect()
    const stageRect = stage?.getBoundingClientRect()

    return {
      top: topInset,
      height: Math.max(0, window.innerHeight - topInset - bottomReserve),
      left: previewRect?.left ?? stageRect?.left ?? topInset,
      width: previewRect?.width ?? stageRect?.width ?? window.innerWidth - topInset * 2,
    }
  }

  /** 固定栏 + 与画布间距，供 updateScale 计算可用视口高度 */
  const getPinnedViewportChromeHeightPx = () => {
    const pinBar = pinBarRef.value
    const fallback = defaultPinBarMetrics()
    const barHeight = pinBar?.getBoundingClientRect().height ?? fallback.height
    return barHeight + PINNED_PIN_BAR_CANVAS_GAP_PX
  }

  /** 固定模式下 updateScale 应预留的纵向空间（shell 上下边距 + 固定栏 + 画布区内边距） */
  const getPinnedViewportVerticalReservePx = () =>
    PINNED_SHELL_VIEWPORT_MARGIN_Y_PX * 2 +
    getPinnedViewportChromeHeightPx() +
    PINNED_CANVAS_INSET_Y_PX * 2

  /** 固定模式下 shell 内可用于画布的宽高（px，已扣除内边距） */
  const getPinnedViewportFitSize = () => {
    const shell = getShellBounds()
    const chrome = getPinnedViewportChromeHeightPx()
    return {
      width: Math.max(0, shell.width - PINNED_CANVAS_INSET_X_PX * 2),
      height: Math.max(0, shell.height - chrome - PINNED_CANVAS_INSET_Y_PX * 2),
    }
  }

  const resolvePinBarMetrics = (): PinBarMetrics => {
    const pinBar = pinBarRef.value
    if (!pinBar) return defaultPinBarMetrics()
    const barRect = pinBar.getBoundingClientRect()
    return {
      height: barRect.height,
      gapAboveCanvas: PINNED_PIN_BAR_CANVAS_GAP_PX,
    }
  }

  const applyPinnedShellStyle = () => {
    const shell = getShellBounds()

    pinnedShellStyle.value = {
      position: 'fixed',
      top: `${shell.top}px`,
      bottom: `${getBottomViewportReserve()}px`,
      left: `${shell.left}px`,
      width: `${shell.width}px`,
      zIndex: 88,
    }
  }

  const applyPinnedRect = () => {
    const el = canvasBoxRef.value
    if (!el) return

    const shell = getShellBounds()
    const metrics = resolvePinBarMetrics()
    pinBarMetrics.value = metrics

    const pinBarHeight = metrics.height
    const gap = PINNED_PIN_BAR_CANVAS_GAP_PX
    const pinBarTop = shell.top
    const canvasZoneTop = shell.top + pinBarHeight + gap
    const canvasZoneHeight = Math.max(0, shell.height - pinBarHeight - gap)

    pinBarPlaceholderHeight.value = pinBarHeight + gap
    pinPlaceholderHeight.value = canvasZoneHeight

    pinBarPinnedStyle.value = {
      position: 'fixed',
      top: `${pinBarTop}px`,
      left: `${shell.left}px`,
      width: `${shell.width}px`,
      zIndex: 92,
    }

    pinnedBoxStyle.value = {
      position: 'fixed',
      top: `${canvasZoneTop}px`,
      left: `${shell.left}px`,
      width: `${shell.width}px`,
      height: `${canvasZoneHeight}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 91,
      boxSizing: 'border-box',
      padding: `${PINNED_CANVAS_INSET_Y_PX}px ${PINNED_CANVAS_INSET_X_PX}px`,
    }

    if (userWantsPin.value) {
      applyPinnedShellStyle()
    }
  }

  const refreshPinnedLayout = () => {
    if (!userWantsPin.value) return
    isPinned.value = true
    options?.onPinLayout?.()
    void nextTick(() => {
      applyPinnedRect()
      requestAnimationFrame(() => {
        if (!userWantsPin.value) return
        applyPinnedRect()
      })
    })
  }

  const clearPin = () => {
    isPinned.value = false
    pinPlaceholderHeight.value = 0
    pinBarPlaceholderHeight.value = 0
    pinnedBoxStyle.value = {}
    pinBarPinnedStyle.value = {}
    pinnedShellStyle.value = {}
    pinBarMetrics.value = null
    stopListenWindow()
  }

  /** 释放固定意图并还原布局（窄屏切换等） */
  const releasePin = () => {
    userWantsPin.value = false
    clearPin()
    void nextTick(() => options?.onPinLayout?.())
  }

  /** keep-alive 切走：仅取消 fixed，保留用户固定意图 */
  const suspendPin = () => {
    clearPin()
  }

  /** keep-alive 回到制图页：按当前布局重新计算 fixed 位置 */
  const restorePin = () => {
    if (!userWantsPin.value) return
    pinBarMetrics.value = null
    refreshPinnedLayout()
    startListenWindow()
  }

  const onWindowChange = () => {
    if (!userWantsPin.value) return
    refreshPinnedLayout()
  }

  let uninstallLayoutViewportResize: (() => void) | null = null

  const startListenWindow = () => {
    uninstallLayoutViewportResize?.()
    uninstallLayoutViewportResize = installLayoutViewportResizeListener(onWindowChange)
    window.addEventListener('scroll', onWindowChange, true)
  }

  const stopListenWindow = () => {
    uninstallLayoutViewportResize?.()
    uninstallLayoutViewportResize = null
    window.removeEventListener('scroll', onWindowChange, true)
  }

  const togglePin = () => {
    if (userWantsPin.value) {
      releasePin()
      return
    }
    userWantsPin.value = true
    pinBarMetrics.value = null
    refreshPinnedLayout()
    startListenWindow()
  }

  const pinLabel = computed(() => (isPinned.value ? '取消固定画布' : '固定画布'))

  onUnmounted(() => {
    releasePin()
  })

  return {
    /** 当前是否处于 fixed 布局 */
    isPinned,
    /** 是否应按固定视口缩小画布 */
    shouldFitPinnedViewport,
    /** 固定栏占位高度（含与画布间距） */
    getPinnedViewportChromeHeightPx,
    /** 固定模式下缩放纵向预留 */
    getPinnedViewportVerticalReservePx,
    /** 固定模式下 shell 内可用于画布的宽高 */
    getPinnedViewportFitSize,
    /** fixed 时画布占位元素高度，避免页面跳动 */
    pinPlaceholderHeight,
    /** fixed 时固定栏占位高度（含与画布间距） */
    pinBarPlaceholderHeight,
    /** 应用于画布容器的 fixed 定位样式 */
    pinnedBoxStyle,
    /** 应用于固定栏的 fixed 定位样式 */
    pinBarPinnedStyle,
    /** 固定栏 + 画布的外层半透明毛玻璃背景（画布本身不透底，见 canvas-wrap--pinned） */
    pinnedShellStyle,
    /** 切换按钮文案 */
    pinLabel,
    togglePin,
    clearPin,
    releasePin,
    suspendPin,
    restorePin,
    relayoutPin: applyPinnedRect,
  }
}
