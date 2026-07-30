import { useDiyStore } from '@/features/diy-card/stores'
import { registerFloatPreviewLiveRefresh } from '@/features/diy-card/composables/preview/floatPreviewLiveRefresh'
import { debounce } from '@/shared/utils/scheduling'
import {
  getFloatPreviewImmediateMinIntervalMs,
  getFloatPreviewMinRefreshIntervalMs,
  getFloatPreviewRefreshDebounceMs,
  getFloatPreviewSnapshotPixelRatio,
} from '@/shared/utils/deviceCapability'
import { installLayoutViewportResizeListener } from '@/shared/utils/viewportLayoutResize'
import type { Stage } from 'konva/lib/Stage'
import { computed, nextTick, onUnmounted, ref, type Ref, watch } from 'vue'

const DRAG_THRESHOLD = 6
const TABBAR_RESERVE = 72
/** 悬挂预览统一默认边距（右上，避开详细设置顶栏 title / 关闭钮） */
const FLOAT_DEFAULT_MARGIN = 12
/** 顶栏 title 区域高度（详细设置抽屉 header），悬挂预览默认在其下方 */
const FLOAT_TOP_TITLE_RESERVE = 52
/** 紧凑悬挂：占一角；上限随视口放大（原固定 144×208 在大屏上过小） */
const COMPACT_VIEWPORT_WIDTH_RATIO = 0.3
const COMPACT_VIEWPORT_HEIGHT_RATIO = 0.24
const COMPACT_MIN_WIDTH = 84

/** 视口越大，悬挂预览上限越高（线性放大，避免 4K 屏过大） */
const resolveCompactFloatLimits = () => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    viewportWidthRatio: COMPACT_VIEWPORT_WIDTH_RATIO,
    viewportHeightRatio: COMPACT_VIEWPORT_HEIGHT_RATIO,
    minWidth: COMPACT_MIN_WIDTH,
    maxWidth: Math.round(
      Math.min(vw * COMPACT_VIEWPORT_WIDTH_RATIO, 80 + vw * 0.09),
    ),
    maxHeight: Math.round(
      Math.min(vh * 0.36, 120 + vh * 0.11),
    ),
  }
}
/** 点击放大：占屏更大，仅展开时拦截操作 */
const EXPANDED_VIEWPORT_WIDTH_RATIO = 0.88
const EXPANDED_VIEWPORT_HEIGHT_RATIO = 0.52
/** 悬挂预览 canvas  backing store 像素比（小图也尽量用足 DPR） */
const getFloatPreviewCanvasDpr = (displayWidth: number) => {
  const device = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  const minReadable = displayWidth >= 84 ? 1.75 : 2
  return Math.min(2.25, Math.max(device, minReadable))
}

/** 悬挂预览从 Stage 合并后的最大长边（px），避免全分辨率截图占满 GPU 内存 */
const FLOAT_PREVIEW_SOURCE_MAX_LONG_EDGE = 560

const releaseCanvasBuffer = (canvas: HTMLCanvasElement | null) => {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

/** 悬挂预览浮层左上角坐标（相对视口） */
export interface FloatPreviewPosition {
  x: number
  y: number
}

/** 悬挂预览弹出/收起方向（取当前位置离视口四边最近的一侧） */
export type FloatPopEdge = 'left' | 'right' | 'top' | 'bottom'

/** Konva Stage 逻辑尺寸（用于计算浮层宽高比） */
export interface StagePixelSize {
  width: number
  height: number
}

const resolveAspectBox = (
  stageWidth: number,
  stageHeight: number,
  opts: {
    viewportWidthRatio: number
    viewportHeightRatio: number
    minWidth: number
    maxWidth: number
    maxHeight: number
  },
) => {
  const safeW = Math.max(stageWidth, 1)
  const safeH = Math.max(stageHeight, 1)
  const aspect = safeW / safeH

  const maxW = Math.min(window.innerWidth * opts.viewportWidthRatio, opts.maxWidth)
  const maxH = Math.min(window.innerHeight * opts.viewportHeightRatio, opts.maxHeight)

  let width = maxW
  let height = width / aspect
  if (height > maxH) {
    height = maxH
    width = height * aspect
  }

  width = Math.max(opts.minWidth, width)
  height = width / aspect

  return {
    width: Math.round(width),
    height: Math.round(height),
  }
}

const FLOAT_SCROLL_HIDDEN_THRESHOLD = 0.08
/** PC 宽屏：锚点未完整进入视口时即显示悬挂预览 */
const FLOAT_PARTIAL_VISIBILITY_THRESHOLD = 0.98

const resolveObserverThresholds = (partialMode: boolean) =>
  partialMode
    ? [0, 0.08, 0.25, 0.5, 0.75, 0.9, 0.95, 0.98, 1]
    : [0, FLOAT_SCROLL_HIDDEN_THRESHOLD]

const resolveCanvasNeedsFloatPreview = (
  entry: IntersectionObserverEntry,
  partialMode: boolean,
) => {
  if (!entry.isIntersecting) return true
  if (partialMode) {
    return entry.intersectionRatio < FLOAT_PARTIAL_VISIBILITY_THRESHOLD
  }
  return false
}

/** 按画布宽高比计算紧凑悬挂预览尺寸 */
export function resolveFloatDimensions(stageWidth: number, stageHeight: number) {
  return resolveAspectBox(stageWidth, stageHeight, resolveCompactFloatLimits())
}

/** 放大层预览尺寸（上限同样随视口略增） */
export function resolveExpandedFloatDimensions(stageWidth: number, stageHeight: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return resolveAspectBox(stageWidth, stageHeight, {
    viewportWidthRatio: EXPANDED_VIEWPORT_WIDTH_RATIO,
    viewportHeightRatio: EXPANDED_VIEWPORT_HEIGHT_RATIO,
    minWidth: COMPACT_MIN_WIDTH,
    maxWidth: Math.round(Math.min(vw * 0.88, 280 + vw * 0.12)),
    maxHeight: Math.round(Math.min(vh * 0.58, 360 + vh * 0.14)),
  })
}

/**
 * 合并各 Layer 的 scene canvas（Konva 10 content 为 div，无单一 _canvas）
 */
const mergeStageLayerCanvases = (stage: Stage): HTMLCanvasElement | null => {
  const layers = stage.getLayers().filter((layer) => layer.visible())
  if (layers.length === 0) return null

  const pixelRatio = layers[0]!.getCanvas().getPixelRatio()
  const width = Math.round(stage.width() * pixelRatio)
  const height = Math.round(stage.height() * pixelRatio)
  if (width <= 0 || height <= 0) return null

  const merged = document.createElement('canvas')
  merged.width = width
  merged.height = height
  const ctx = merged.getContext('2d')
  if (!ctx) return null

  for (const layer of layers) {
    const native = layer.getNativeCanvasElement()
    if (native.width > 0 && native.height > 0) {
      ctx.drawImage(native, 0, 0)
    }
  }

  return merged
}

/** 合并 Stage 图层并降采样，供悬挂预览使用（减 GPU / 内存峰值） */
const mergeStageLayerCanvasesForPreview = (stage: Stage): HTMLCanvasElement | null => {
  const merged = mergeStageLayerCanvases(stage)
  if (!merged) return null

  const longEdge = Math.max(merged.width, merged.height)
  if (longEdge <= FLOAT_PREVIEW_SOURCE_MAX_LONG_EDGE) {
    return merged
  }

  const scale = FLOAT_PREVIEW_SOURCE_MAX_LONG_EDGE / longEdge
  const scaled = document.createElement('canvas')
  scaled.width = Math.max(1, Math.round(merged.width * scale))
  scaled.height = Math.max(1, Math.round(merged.height * scale))
  const ctx = scaled.getContext('2d')
  if (!ctx) return merged
  ctx.drawImage(merged, 0, 0, scaled.width, scaled.height)
  releaseCanvasBuffer(merged)
  return scaled
}

/**
 * 悬挂预览（手机单列 / Pad 窄屏双栏 / PC 宽屏画布展示不全）
 *
 * 当主画布滚出视口（IntersectionObserver）时，在屏幕边缘显示紧凑预览：
 * 预览图区域 pointer-events: none，不挡下方操作；顶栏可拖动，轻点回画布，「放大」打开大图层。
 *
 * @param canvasAnchorRef 用于观测可见性的锚点元素
 * @param getStage 获取当前 Konva Stage 实例
 * @param getStageSize 获取画布宽高
 * @param enabled 是否启用（通常绑定窄屏 breakpoint）
 * @param externalForceShow 外部要求显示（如手机全屏详细设置抽屉），与滚出视口逻辑 OR 合并
 * @param partialVisibilityMode PC 宽屏等：锚点未完整进入视口时也显示（不仅滚出视口）
 */
export function useDiyCanvasFloatPreview(
  canvasAnchorRef: Ref<HTMLElement | null>,
  getStage: () => Stage | null | undefined,
  getStageSize: () => StagePixelSize,
  enabled: Ref<boolean>,
  /** 外部要求显示（如手机全屏详细设置抽屉），与滚出视口逻辑 OR 合并 */
  externalForceShow?: Ref<boolean>,
  partialVisibilityMode?: Ref<boolean>,
) {
  const showFloat = ref(false)
  /** 画布锚点是否已滚出视口（IntersectionObserver） */
  const canvasHiddenByScroll = ref(false)
  const floatExpanded = ref(false)
  const floatCanvasRef = ref<HTMLCanvasElement | null>(null)
  const floatExpandedCanvasRef = ref<HTMLCanvasElement | null>(null)
  const floatCanvasReady = ref(false)
  const floatExpandedCanvasReady = ref(false)
  /** 关窗动画进行中：避免收起时闪出「正在生成预览」 */
  const floatModalClosing = ref(false)
  const floatPos = ref<FloatPreviewPosition>({ x: 0, y: FLOAT_TOP_TITLE_RESERVE })
  const floatPopEdge = ref<FloatPopEdge>('right')
  const hasUserFloatPosition = ref(false)
  const floatDimensions = ref(resolveFloatDimensions(1, 1))
  const floatExpandedDimensions = ref(resolveExpandedFloatDimensions(1, 1))

  let observer: IntersectionObserver | null = null
  let dragPointerId: number | null = null
  let dragStart = { x: 0, y: 0, posX: 0, posY: 0 }
  let didDrag = false
  let drawToken = 0
  let modalPaintGeneration = 0
  let modalPaintRetryId: ReturnType<typeof globalThis.setTimeout> | null = null
  let refreshDebounceId: ReturnType<typeof globalThis.setTimeout> | null = null
  /** 最近一次成功的 Stage 快照，用于弹窗首帧即时绘制 */
  let cachedStageSnapshot: HTMLCanvasElement | null = null
  /** 用户主动关窗（叉号/遮罩/关闭按钮）时为 true，用于与意外 update:show 区分 */
  let modalUserDismissed = false
  const floatModalPaintKey = ref(0)

  const MODAL_PAINT_RETRY_MS = 80
  const MODAL_PAINT_MAX_ATTEMPTS = 32

  let lastFloatPreviewRefreshAt = 0

  const clearModalPaintRetry = () => {
    if (modalPaintRetryId) {
      globalThis.clearTimeout(modalPaintRetryId)
      modalPaintRetryId = null
    }
  }

  const isModalPaintSessionActive = (generation: number) =>
    floatExpanded.value && generation === modalPaintGeneration

  const diyStore = useDiyStore()

  const shouldRefreshFloatPreview = () =>
    enabled.value && (showFloat.value || floatExpanded.value)

  const executeFloatPreviewRefresh = () => {
    if (diyStore.isCanvasLoading) {
      scheduleFloatPreviewRefresh(getFloatPreviewRefreshDebounceMs())
      return
    }
    lastFloatPreviewRefreshAt = Date.now()
    if (floatExpanded.value) {
      refreshFloatModalCanvas(false)
    }
    if (showFloat.value) {
      refreshFloatPreview()
    }
  }

  const scheduleFloatPreviewRefresh = (delay?: number) => {
    if (!shouldRefreshFloatPreview()) return
    if (refreshDebounceId) globalThis.clearTimeout(refreshDebounceId)

    const isImmediate = delay !== undefined && delay <= 0
    const debounceMs = isImmediate ? 0 : (delay ?? getFloatPreviewRefreshDebounceMs())
    const minInterval = isImmediate
      ? getFloatPreviewImmediateMinIntervalMs()
      : getFloatPreviewMinRefreshIntervalMs()
    const elapsed = Date.now() - lastFloatPreviewRefreshAt
    const waitMs = Math.max(debounceMs, minInterval - elapsed)

    const run = () => {
      refreshDebounceId = null
      globalThis.requestAnimationFrame(() => {
        if (!shouldRefreshFloatPreview()) return
        executeFloatPreviewRefresh()
      })
    }

    if (waitMs <= 0) {
      run()
      return
    }

    refreshDebounceId = globalThis.setTimeout(run, waitMs)
  }

  const floatWrapStyle = computed(() => ({
    width: `${floatDimensions.value.width}px`,
    height: `${floatDimensions.value.height}px`,
    left: `${floatPos.value.x}px`,
    top: `${floatPos.value.y}px`,
  }))

  const floatExpandedPanelStyle = computed(() => ({
    width: `${floatExpandedDimensions.value.width}px`,
    height: `${floatExpandedDimensions.value.height}px`,
  }))

  const updateFloatDimensions = () => {
    const { width, height } = getStageSize()
    floatDimensions.value = resolveFloatDimensions(width, height)
    floatExpandedDimensions.value = resolveExpandedFloatDimensions(width, height)
  }

  const clampPosition = (x: number, y: number): FloatPreviewPosition => {
    const { width, height } = floatDimensions.value
    const maxX = Math.max(8, window.innerWidth - width - 8)
    const maxY = Math.max(FLOAT_TOP_TITLE_RESERVE, window.innerHeight - height - TABBAR_RESERVE)
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(FLOAT_TOP_TITLE_RESERVE, y), maxY),
    }
  }

  const resolveDefaultPosition = (): FloatPreviewPosition => {
    const { width } = floatDimensions.value
    return clampPosition(
      window.innerWidth - width - FLOAT_DEFAULT_MARGIN,
      FLOAT_TOP_TITLE_RESERVE,
    )
  }

  const resolveNearestPopEdge = (pos: FloatPreviewPosition): FloatPopEdge => {
    const { width, height } = floatDimensions.value
    const distLeft = pos.x
    const distRight = window.innerWidth - (pos.x + width)
    const distTop = pos.y
    const distBottom = window.innerHeight - (pos.y + height)
    const min = Math.min(distLeft, distRight, distTop, distBottom)
    if (min === distLeft) return 'left'
    if (min === distRight) return 'right'
    if (min === distTop) return 'top'
    return 'bottom'
  }

  const updateFloatPopEdge = () => {
    floatPopEdge.value = resolveNearestPopEdge(floatPos.value)
  }

  const applyFloatPositionForShow = () => {
    updateFloatDimensions()
    floatPos.value = hasUserFloatPosition.value
      ? clampPosition(floatPos.value.x, floatPos.value.y)
      : resolveDefaultPosition()
    updateFloatPopEdge()
  }

  const initDefaultPosition = () => {
    updateFloatDimensions()
    floatPos.value = resolveDefaultPosition()
    updateFloatPopEdge()
  }

  const paintSourceToCanvas = (
    target: HTMLCanvasElement,
    displaySize: { width: number; height: number },
    source: CanvasImageSource,
  ) => {
    const { width: dw, height: dh } = displaySize
    const dpr = getFloatPreviewCanvasDpr(dw)

    target.width = Math.round(dw * dpr)
    target.height = Math.round(dh * dpr)

    const ctx = target.getContext('2d')
    if (!ctx) return false

    ctx.clearRect(0, 0, target.width, target.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, target.width, target.height)
    return true
  }

  const paintCompactPreview = (source: CanvasImageSource) => {
    const compact = floatCanvasRef.value
    if (!compact) {
      floatCanvasReady.value = false
      return false
    }
    if (paintSourceToCanvas(compact, floatDimensions.value, source)) {
      floatCanvasReady.value = true
      return true
    }
    floatCanvasReady.value = false
    return false
  }

  const paintExpandedPreview = (source: CanvasImageSource) => {
    if (!floatExpanded.value) return false
    const expanded = floatExpandedCanvasRef.value
    // 弹窗已开但 canvas 尚未挂载：保持 loading，不当作绘制失败
    if (!expanded) return false
    if (paintSourceToCanvas(expanded, floatExpandedDimensions.value, source)) {
      floatExpandedCanvasReady.value = true
      clearModalPaintRetry()
      return true
    }
    return false
  }

  const paintExpandedFromCompactCanvas = () => {
    const compact = floatCanvasRef.value
    if (!compact || compact.width <= 0 || compact.height <= 0) return false
    return paintExpandedPreview(compact)
  }

  const updateCachedStageSnapshot = (source: CanvasImageSource) => {
    const width =
      source instanceof HTMLImageElement
        ? source.naturalWidth
        : source instanceof HTMLCanvasElement
          ? source.width
          : 0
    const height =
      source instanceof HTMLImageElement
        ? source.naturalHeight
        : source instanceof HTMLCanvasElement
          ? source.height
          : 0
    if (width <= 0 || height <= 0) return

    if (!cachedStageSnapshot) {
      cachedStageSnapshot = document.createElement('canvas')
    }
    cachedStageSnapshot.width = width
    cachedStageSnapshot.height = height
    const ctx = cachedStageSnapshot.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(source, 0, 0, width, height)
  }

  const paintModalFromCache = () => {
    if (!cachedStageSnapshot) return false
    return paintExpandedPreview(cachedStageSnapshot)
  }

  const paintModalInstant = () => {
    if (paintModalFromCache()) return true
    return paintExpandedFromCompactCanvas()
  }

  const paintSourceToFloatTargets = (source: CanvasImageSource) => {
    updateFloatDimensions()
    const compactOk = paintCompactPreview(source)
    const expandedOk = floatExpanded.value ? paintExpandedPreview(source) : true
    return compactOk && expandedOk
  }

  const loadSourceFromDataUrl = (stage: Stage, token: number) => {
    try {
      const dataUrl = stage.toDataURL({
        pixelRatio: getFloatPreviewSnapshotPixelRatio(),
        mimeType: 'image/jpeg',
        quality: 0.92,
      })
      const img = new Image()
      img.onload = () => {
        if (token !== drawToken) return
        if (paintSourceToFloatTargets(img)) {
          updateCachedStageSnapshot(img)
        }
      }
      img.onerror = () => {
        if (token === drawToken) {
          floatCanvasReady.value = false
        }
      }
      img.src = dataUrl
    } catch {
      if (token === drawToken) {
        floatCanvasReady.value = false
      }
    }
  }

  const runStageSnapshot = (
    isActive: () => boolean,
    paint: (source: CanvasImageSource) => boolean,
    onFail: () => void,
    warmupFrames = 0,
  ) => {
    const stage = getStage()
    if (!stage) {
      onFail()
      return
    }

    stage.batchDraw()

    const snapshot = () => {
      if (!isActive()) return

      const merged = mergeStageLayerCanvasesForPreview(stage)
      if (merged && paint(merged)) {
        releaseCanvasBuffer(merged)
        return
      }

      try {
        const dataUrl = stage.toDataURL({
          pixelRatio: getFloatPreviewSnapshotPixelRatio(),
          mimeType: 'image/jpeg',
          quality: 0.92,
        })
        const img = new Image()
        img.onload = () => {
          if (!isActive()) return
          if (!paint(img)) onFail()
        }
        img.onerror = () => onFail()
        img.src = dataUrl
      } catch {
        onFail()
      }
    }

    const scheduleSnapshot = () => {
      if (warmupFrames > 0) {
        requestAnimationFrame(() => runStageSnapshot(isActive, paint, onFail, warmupFrames - 1))
        return
      }
      requestAnimationFrame(snapshot)
    }

    scheduleSnapshot()
  }

  const drawFloatModalCanvas = (generation: number) => {
    if (!floatExpanded.value) return

    const isActive = () => floatExpanded.value && generation === modalPaintGeneration

    runStageSnapshot(
      isActive,
      (source) => {
        updateFloatDimensions()
        const ok = paintExpandedPreview(source)
        if (ok) updateCachedStageSnapshot(source)
        return ok
      },
      () => {
        if (!isActive() || floatExpandedCanvasReady.value) return
        modalPaintRetryId = globalThis.setTimeout(() => {
          modalPaintRetryId = null
          if (isActive() && !floatExpandedCanvasReady.value) {
            drawFloatModalCanvas(generation)
          }
        }, MODAL_PAINT_RETRY_MS)
      },
      1,
    )
  }

  const drawFloatCanvas = (token: number) => {
    const stage = getStage()
    const hasCompactTarget = Boolean(floatCanvasRef.value)
    if (!stage || !hasCompactTarget) {
      if (hasCompactTarget || !floatExpanded.value) {
        floatCanvasReady.value = false
      }
      return
    }

    stage.batchDraw()

    const snapshot = () => {
      if (token !== drawToken) return

      const merged = mergeStageLayerCanvasesForPreview(stage)
      if (merged) {
        updateFloatDimensions()
        updateCachedStageSnapshot(merged)
        paintCompactPreview(merged)
        releaseCanvasBuffer(merged)
        return
      }

      loadSourceFromDataUrl(stage, token)
    }

    requestAnimationFrame(snapshot)
  }

  const refreshFloatPreview = (retry = 0) => {
    if (retry === 0) {
      drawToken++
    }
    const token = drawToken

    requestAnimationFrame(() => {
      const hasCompactTarget = Boolean(floatCanvasRef.value)
      const hasExpandedTarget = Boolean(floatExpandedCanvasRef.value) && floatExpanded.value
      if (!hasCompactTarget && !hasExpandedTarget) {
        if (retry < 16) {
          setTimeout(() => refreshFloatPreview(retry + 1), 60)
        }
        return
      }
      drawFloatCanvas(token)
    })
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    didDrag = false
    dragPointerId = event.pointerId
    dragStart = {
      x: event.clientX,
      y: event.clientY,
      posX: floatPos.value.x,
      posY: floatPos.value.y,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (dragPointerId !== event.pointerId) return
    const dx = event.clientX - dragStart.x
    const dy = event.clientY - dragStart.y
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      didDrag = true
    }
    floatPos.value = clampPosition(dragStart.posX + dx, dragStart.posY + dy)
  }

  const onPointerUp = (event: PointerEvent) => {
    if (dragPointerId !== event.pointerId) return
    dragPointerId = null
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    if (didDrag) {
      hasUserFloatPosition.value = true
      updateFloatPopEdge()
      return
    }
    // 延后一帧打开，避免同一次点击落在刚出现的遮罩上导致弹窗立刻关闭
    requestAnimationFrame(() => openFloatExpanded())
  }

  const beginModalPaintSession = () => {
    clearModalPaintRetry()
    modalPaintGeneration += 1
    floatExpandedCanvasReady.value = false
    return modalPaintGeneration
  }

  const scheduleModalPaintRetry = (generation: number, attempt: number) => {
    if (!isModalPaintSessionActive(generation) || floatExpandedCanvasReady.value) return
    if (attempt >= MODAL_PAINT_MAX_ATTEMPTS) return

    clearModalPaintRetry()
    modalPaintRetryId = globalThis.setTimeout(() => {
      modalPaintRetryId = null
      if (!isModalPaintSessionActive(generation) || floatExpandedCanvasReady.value) return
      runModalPaintAttempt(generation, attempt + 1)
    }, MODAL_PAINT_RETRY_MS)
  }

  const runModalPaintAttempt = (generation: number, attempt: number) => {
    if (!isModalPaintSessionActive(generation)) return
    if (floatExpandedCanvasReady.value) return

    const retryLater = () => scheduleModalPaintRetry(generation, attempt)

    if (diyStore.isCanvasLoading || !getStage()) {
      retryLater()
      return
    }

    if (!floatExpandedCanvasRef.value) {
      retryLater()
      return
    }

    updateFloatDimensions()

    if (paintModalInstant()) {
      return
    }

    drawFloatModalCanvas(generation)
    if (!floatExpandedCanvasReady.value) {
      retryLater()
    }
  }

  const openFloatExpanded = () => {
    if (!enabled.value) return
    modalUserDismissed = false
    floatModalClosing.value = false
    updateFloatDimensions()
    floatModalPaintKey.value += 1
    floatExpanded.value = true
    const generation = beginModalPaintSession()
    void nextTick(() => {
      void nextTick(() => {
        requestAnimationFrame(() => runModalPaintAttempt(generation, 0))
      })
    })
  }

  const refreshFloatModalCanvas = (bumpGeneration = true) => {
    if (!floatExpanded.value) return
    const generation = bumpGeneration ? beginModalPaintSession() : modalPaintGeneration
    void nextTick(() => {
      requestAnimationFrame(() => runModalPaintAttempt(generation, 0))
    })
  }

  const onFloatModalAfterEnter = () => {
    if (!floatExpanded.value || floatExpandedCanvasReady.value) return
    runModalPaintAttempt(modalPaintGeneration, 0)
  }

  const closeFloatExpanded = () => {
    modalUserDismissed = true
    floatModalClosing.value = true
    clearModalPaintRetry()
    floatExpanded.value = false
    modalPaintGeneration += 1
  }

  const onFloatModalAfterLeave = () => {
    floatModalClosing.value = false
    floatExpandedCanvasReady.value = false
  }

  const onFloatModalShowUpdate = (show: boolean) => {
    if (show) {
      if (!modalUserDismissed) {
        floatExpanded.value = true
      }
      return
    }
    if (modalUserDismissed) {
      floatExpanded.value = false
      modalUserDismissed = false
      clearModalPaintRetry()
      return
    }
    // 意外关窗（如预览层 DOM 变化）：保持打开，不脉冲、不进入「正在生成预览」
    floatExpanded.value = true
  }

  const setupObserver = () => {
    observer?.disconnect()
    if (!enabled.value || !canvasAnchorRef.value) {
      canvasHiddenByScroll.value = false
      syncShowFloat()
      return
    }

    const partialMode = Boolean(partialVisibilityMode?.value)
    observer = new IntersectionObserver(
      (entries) => {
        if (!enabled.value) {
          canvasHiddenByScroll.value = false
          syncShowFloat()
          return
        }
        const entry = entries[0]
        if (!entry) return
        canvasHiddenByScroll.value = resolveCanvasNeedsFloatPreview(
          entry,
          Boolean(partialVisibilityMode?.value),
        )
        syncShowFloat()
      },
      { threshold: resolveObserverThresholds(partialMode) },
    )
    observer.observe(canvasAnchorRef.value)
  }

  const syncShowFloat = () => {
    if (!enabled.value) {
      showFloat.value = false
      return
    }
    const shouldShow =
      canvasHiddenByScroll.value || Boolean(externalForceShow?.value)
    const wasVisible = showFloat.value
    if (shouldShow && !wasVisible) {
      applyFloatPositionForShow()
    }
    showFloat.value = shouldShow
    if (shouldShow && !wasVisible) {
      void nextTick(() => {
        void nextTick(() => refreshFloatPreview())
      })
    }
  }

  if (externalForceShow) {
    watch(externalForceShow, () => {
      if (!enabled.value) return
      syncShowFloat()
    })
  }

  watch(
    [enabled, canvasAnchorRef, () => partialVisibilityMode?.value],
    () => {
      if (!enabled.value) {
        observer?.disconnect()
        canvasHiddenByScroll.value = false
        syncShowFloat()
        return
      }
      setupObserver()
    },
    { immediate: true },
  )

  watch(showFloat, (visible) => {
    if (visible) {
      floatCanvasReady.value = false
      void nextTick(() => {
        void nextTick(() => refreshFloatPreview())
      })
    } else {
      floatCanvasReady.value = false
      if (!floatExpanded.value) {
        drawToken++
        if (refreshDebounceId) {
          globalThis.clearTimeout(refreshDebounceId)
          refreshDebounceId = null
        }
      }
    }
  })

  watch(floatExpanded, (expanded) => {
    if (!expanded) {
      clearModalPaintRetry()
    }
  })

  watch(
    () => diyStore.canvasVisualSettledRevision,
    () => {
      if (!shouldRefreshFloatPreview()) return
      scheduleFloatPreviewRefresh()
    },
  )

  const onResize = debounce(() => {
    updateFloatDimensions()
    floatPos.value = clampPosition(floatPos.value.x, floatPos.value.y)
    updateFloatPopEdge()
    if (shouldRefreshFloatPreview()) {
      refreshFloatPreview()
    }
  }, 150)

  let uninstallLayoutViewportResize: (() => void) | null = null

  uninstallLayoutViewportResize = installLayoutViewportResizeListener(onResize)
  initDefaultPosition()
  registerFloatPreviewLiveRefresh(scheduleFloatPreviewRefresh)

  onUnmounted(() => {
    registerFloatPreviewLiveRefresh(null)
    observer?.disconnect()
    uninstallLayoutViewportResize?.()
    uninstallLayoutViewportResize = null
    onResize.cancel()
    clearModalPaintRetry()
    if (refreshDebounceId) globalThis.clearTimeout(refreshDebounceId)
    drawToken++
  })

  const hideFloatPreview = () => {
    modalUserDismissed = true
    closeFloatExpanded()
    canvasHiddenByScroll.value = false
    showFloat.value = false
    floatCanvasReady.value = false
    cachedStageSnapshot = null
    drawToken++
    if (refreshDebounceId) {
      globalThis.clearTimeout(refreshDebounceId)
      refreshDebounceId = null
    }
    observer?.disconnect()
    observer = null
  }

  return {
    showFloat,
    floatExpanded,
    floatModalPaintKey,
    floatCanvasRef,
    floatExpandedCanvasRef,
    floatCanvasReady,
    floatExpandedCanvasReady,
    floatModalClosing,
    floatPopEdge,
    floatWrapStyle,
    floatExpandedPanelStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    closeFloatExpanded,
    onFloatModalShowUpdate,
    onFloatModalAfterEnter,
    onFloatModalAfterLeave,
    scheduleFloatPreviewRefresh,
    updateFloatDimensions,
    hideFloatPreview,
    setupObserver,
  }
}
