<script setup lang="ts">
import { useOutOfFrameEditorBackgroundRecovery } from '@/features/diy-card/composables/outOfFrame/useOutOfFrameEditorBackgroundRecovery'
import { setOutOfFrameEditorOpen } from '@/features/diy-card/utils/historyShortcuts'
import { isIOSWebKit } from '@/shared/utils/deviceCapability'
import { scheduleAfterUiPaint } from '@/shared/utils/scheduling'
import {
  buildMattingProgress,
  compareMattingModelSize,
  getMattingAssetHint,
  MATTING_MODEL_OPTIONS,
  type MattingModelId,
  type MattingProgress,
  preloadMattingAssets,
  resolveDefaultMattingModelForViewport,
  resolveMattingModelOption,
  runAutoMattingMask,
} from '@/features/diy-card/utils/outOfFrame/autoMatting'
import {
  OUT_OF_FRAME_BRUSH_SHAPE_OPTIONS,
  type OutOfFrameBrushShape,
  type OutOfFrameBrushStampOptions,
  paintOutOfFrameBrushSegment,
  paintOutOfFrameBrushStamp,
} from '@/features/diy-card/utils/outOfFrame/brushStamp'
import {
  compositePreviewWithPaddedMaskElements,
  normalizeMaskCanvas,
} from '@/features/diy-card/utils/outOfFrame/composite'
import {
  createOutOfFramePaddedInitialMask,
  cropOutOfFrameMaskToSource,
  embedOutOfFrameMaskSnapshotInPaddedCanvas,
  loadOutOfFrameMaskIntoPaddedCanvas,
  type OutOfFrameEditorCanvasLayout,
  resolveOutOfFrameEditorCanvasLayout,
  scaleOutOfFrameEditorSourceRect,
} from '@/features/diy-card/utils/outOfFrame/editorCanvas'
import {
  fitEditorBox,
  OUT_OF_FRAME_VIEW_ZOOM_MIN,
  OUT_OF_FRAME_VIEW_ZOOM_STEP,
  resolveDefaultOutOfFrameBrushSize,
  resolveEditorImageAndViewport,
  resolveNextOutOfFrameViewZoomPercent,
  resolveOutOfFrameBrushSizeLimits,
  resolveOutOfFrameEffectiveViewZoomMaxPercent,
  resolveOutOfFramePreviewSizeForZoom,
  resolveOutOfFrameViewZoomPercentFromScale,
  resolveViewOffsetAfterZoom,
} from '@/features/diy-card/utils/outOfFrame/editorViewport'
import { isOutOfFrameImageLoaded, loadOutOfFrameImage } from '@/features/diy-card/utils/outOfFrame/imageLoader'
import {
  applyMagicWandToMask,
  type MagicWandMode,
} from '@/features/diy-card/utils/outOfFrame/magicWand'
import { resolveMagnifierPlacement } from '@/features/diy-card/utils/outOfFrame/magnifierPlacement'
import {
  ArrowBackRound,
  AutoAwesomeRound,
  AutoFixHighRound,
  BlurOnRound,
  OpenWithRound,
  VisibilityOffRound,
  VisibilityRound,
} from '@/shared/icons'
import { useSystemStore } from '@/shared/stores/system'
import { loadImageNaturalSize } from '@/shared/utils/file'
import { isTouchDevice } from '@/shared/utils/naive/touchDevice'
import {
  NButton,
  NIcon,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSpace,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui'
import {
  type Component,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from 'vue'

type EditorTool = 'erase' | 'restore' | 'feather' | 'wand' | 'pan'

const editorToolOptions: ReadonlyArray<{ value: EditorTool; label: string; icon: Component }> = [
  { value: 'erase', label: '擦除', icon: VisibilityOffRound },
  { value: 'restore', label: '还原', icon: VisibilityRound },
  { value: 'feather', label: '羽化', icon: BlurOnRound },
  { value: 'wand', label: '魔棒', icon: AutoFixHighRound },
  { value: 'pan', label: '拖拽', icon: OpenWithRound },
]

const props = defineProps<{
  show: boolean
  sourcePic: string
  maskDataUrl: string
  stageWidth: number
  stageHeight: number
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  apply: [maskDataUrl: string]
}>()

const message = useMessage()
const dialog = useDialog()
const systemStore = useSystemStore()
const isTouch = isTouchDevice()

const editorTool = ref<EditorTool>('pan')
const brushSize = ref(
  resolveDefaultOutOfFrameBrushSize(
    typeof window !== 'undefined' ? window.innerWidth : 390,
    isTouch,
  ),
)
const brushSizeLimits = computed(() => resolveOutOfFrameBrushSizeLimits(isTouch))
const brushShape = ref<OutOfFrameBrushShape>('round')
/** 擦除/还原笔刷不透明度 10–100 */
const brushOpacity = ref(100)
/** 魔棒：擦除或还原相似连通区域 */
const wandMode = ref<MagicWandMode>('erase')
/** 魔棒颜色容差 5–80 */
const wandTolerance = ref(16)
/** 软边笔刷中心实度（仅 shape=soft） */
const brushHardness = ref(85)
/** 羽化半径（蒙版像素）：类似 PS 选区羽化，对局部 alpha 做高斯柔化，只减不增 */
const featherRadius = ref(16)
const viewZoomPercent = ref(100)
const viewOffset = ref({ x: 0, y: 0 })
const initializing = ref(false)
const matting = ref(false)
const loadingProgress = ref<MattingProgress | null>(null)
const painting = ref(false)
const panning = ref(false)
const multiTouchNavigating = ref(false)
const activeTouchCount = ref(0)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 520)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
const viewportRef = ref<HTMLDivElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const displayCanvasRef = ref<HTMLCanvasElement | null>(null)
const referenceCanvasRef = ref<HTMLCanvasElement | null>(null)
const magnifierCanvasRef = ref<HTMLCanvasElement | null>(null)
const maskCanvas = shallowRef<HTMLCanvasElement | null>(null)
const sourceImage = shallowRef<HTMLImageElement | null>(null)
const imageSize = shallowRef<{ width: number; height: number } | null>(null)
const undoStack = ref<HTMLCanvasElement[]>([])
const isAtInitialMask = ref(true)
const cursorPoint = ref<{ x: number; y: number } | null>(null)
/** 笔刷在蒙版/full-res 坐标系下的位置（供放大镜采样） */
const cursorMaskPoint = ref<{ x: number; y: number } | null>(null)
const mattingAssetHint = ref('')
const mattingModel = ref<MattingModelId>(resolveDefaultMattingModelForViewport())
const mattingModelSelectOptions = MATTING_MODEL_OPTIONS.map((item) => ({
  value: item.value,
  label: `${item.label}（${item.sizeLabel}）`,
}))
const modelPreloading = ref(false)
const modelPreloadProgress = ref(0)

const INIT_TOTAL_STEPS = 3

let previewFrame = 0
let panStart: { x: number; y: number; ox: number; oy: number } | null = null
let touchNavState: {
  lastDistance: number
  lastCenter: { x: number; y: number }
} | null = null
let touchPointerSession: {
  pointerId: number
  startX: number
  startY: number
  activated: boolean
  /** 触摸激活后首帧仅更新放大镜，避免「看见圈的同时已经擦掉一块」 */
  deferPaintUntilMove: boolean
} | null = null
/** 触摸按下尚未开始涂抹时，仍显示放大镜预览 */
const touchMagnifierPreview = ref(false)
/** 触摸延迟落笔：首帧实际涂抹前再 pushUndo */
let touchPaintUndoPending = false
const TOUCH_TOOL_ACTIVATE_PX = 8
let maskCtx: CanvasRenderingContext2D | null = null
let displayCtx: CanvasRenderingContext2D | null = null
let previewBufferCanvas: HTMLCanvasElement | null = null
/** 放大镜专用：未叠加蒙版的原画（擦除时避免圈内显示已擦空白） */
let magnifierSourceBufferCanvas: HTMLCanvasElement | null = null
let referenceBufferCanvas: HTMLCanvasElement | null = null
let lastPaintPoint: { x: number; y: number } | null = null
let pendingPaintPoint: { x: number; y: number } | null = null
let pendingCursor: { x: number; y: number } | null = null
let initialLegendMaskSnapshot: HTMLCanvasElement | null = null
let featherSrcCanvas: HTMLCanvasElement | null = null
let featherBlurCanvas: HTMLCanvasElement | null = null
let strokeUndoSnapshot: HTMLCanvasElement | null = null
let featherUndoCaptured = false

/** 电脑端画布可用区域：约占视口大半，随窗口变化 */
const resolveDesktopCanvasBounds = () => {
  const maxW = Math.max(520, Math.floor((viewportWidth.value - 72) * 0.9))
  const maxH = Math.max(420, Math.floor((viewportHeight.value - 200) * 0.8))
  return { maxW, maxH }
}

const FEATHER_PATCH_MAX = 320

/** 采样与笔刷圈 1:1 同源，显示时放大像素（手机端看手指底下） */
const MAGNIFIER_OFFSET = 10
const MAGNIFIER_PIXEL_SCALE = 2.5
const MAGNIFIER_TOUCH_MIN_DISPLAY = 88
const MAGNIFIER_TOUCH_MAX_DISPLAY = 120
const MAGNIFIER_DESKTOP_MIN_DISPLAY = 64
const MAGNIFIER_VIEWPORT_PAD = 4
/** 还原模式：底层参考原画不透明度 */
const RESTORE_REFERENCE_ALPHA = 0.44
/** 擦除模式放大镜：已擦区域底层原画透明度（略透，避免纯空白） */
const ERASE_MAGNIFIER_GHOST_ALPHA = 0.75
/** 放大镜底色（纯色，不铺透明网格） */
const MAGNIFIER_BACKDROP = '#FFFFFF'

const modalStyle = computed(() =>
  isMobileLayout.value
    ? { width: 'min(100vw - 16px, 680px)' }
    : { width: `min(96vw, ${Math.max(900, viewportWidth.value - 32)}px)` },
)

const createInitialLegendMaskSnapshot = (layout: OutOfFrameEditorCanvasLayout) =>
  createOutOfFramePaddedInitialMask(layout)

const modalVisible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const isMobileLayout = computed(() => {
  if (systemStore.isDiyPcLayout) return false
  return isTouch || viewportWidth.value < 768
})

const startMattingModelPreload = (model: MattingModelId) => {
  modelPreloading.value = true
  modelPreloadProgress.value = 0
  void preloadMattingAssets(model, (progress) => {
    modelPreloadProgress.value = progress.percent
  })
    .catch(() => undefined)
    .finally(() => {
      modelPreloading.value = false
      modelPreloadProgress.value = 100
    })
}

const refreshMattingAssetHint = async (model: MattingModelId) => {
  mattingAssetHint.value = await getMattingAssetHint(model)
}

const applyMattingModel = async (model: MattingModelId) => {
  mattingModel.value = model
  await refreshMattingAssetHint(model)
  startMattingModelPreload(model)
}

const onMattingModelChange = (next: MattingModelId) => {
  if (next === mattingModel.value) return
  const prev = mattingModel.value
  const upgradeToLarger = compareMattingModelSize(prev, next) < 0

  const confirmSwitch = () => {
    void applyMattingModel(next)
  }

  if (isMobileLayout.value && upgradeToLarger) {
    const option = resolveMattingModelOption(next)
    dialog.warning({
      title: '切换为大模型',
      content: `「${option.label}」${option.sizeLabel}，移动网络下可能消耗较多流量，确定要切换吗？`,
      positiveText: '确定切换',
      negativeText: '取消',
      onPositiveClick: confirmSwitch,
    })
    return
  }

  confirmSwitch()
}

const isPaintingTool = computed(
  () =>
    editorTool.value === 'erase' ||
    editorTool.value === 'restore' ||
    editorTool.value === 'feather',
)
const isWandTool = computed(() => editorTool.value === 'wand')
const isRestoreTool = computed(
  () => editorTool.value === 'restore' || (isWandTool.value && wandMode.value === 'restore'),
)
const isEraseTool = computed(
  () => editorTool.value === 'erase' || (isWandTool.value && wandMode.value === 'erase'),
)
const brushShapeOptions = computed(() => {
  if (editorTool.value === 'restore') {
    return OUT_OF_FRAME_BRUSH_SHAPE_OPTIONS.filter((item) => item.value !== 'soft')
  }
  return OUT_OF_FRAME_BRUSH_SHAPE_OPTIONS
})
const showBrushShapeControls = computed(
  () => isPaintingTool.value && editorTool.value !== 'feather',
)
const showMagnifier = computed(
  () =>
    isPaintingTool.value &&
    Boolean(cursorMaskPoint.value) &&
    (isTouch ? painting.value || touchMagnifierPreview.value : true) &&
    !panning.value &&
    !multiTouchNavigating.value &&
    !matting.value &&
    !initializing.value,
)
const showLoadingOverlay = computed(() => matting.value || initializing.value)

const fitDisplayBox = fitEditorBox

const stageAspect = computed(() =>
  props.stageHeight > 0 ? props.stageWidth / props.stageHeight : undefined,
)

const resolveEditorLayout = (naturalW: number, naturalH: number, maxW: number, maxH: number) =>
  resolveEditorImageAndViewport(naturalW, naturalH, maxW, maxH, {
    stageAspect: stageAspect.value,
  })

const MOBILE_MODAL_CHROME_HEIGHT = 248
const MOBILE_LANDSCAPE_ASPECT = 1.12
const STAGE_HORIZONTAL_PADDING = 24
const MOBILE_MODAL_SIDE_MARGIN = 16
const MOBILE_CARD_CONTENT_PADDING = 32

const stageAvailableWidth = ref(0)
let stageResizeObserver: ResizeObserver | null = null

const estimateMobileStageWidth = () => {
  const modalW = Math.min(viewportWidth.value - MOBILE_MODAL_SIDE_MARGIN, 680)
  return Math.max(200, modalW - MOBILE_CARD_CONTENT_PADDING - STAGE_HORIZONTAL_PADDING)
}

const mobileViewportMaxWidth = computed(() =>
  stageAvailableWidth.value > 0 ? stageAvailableWidth.value : estimateMobileStageWidth(),
)

const updateStageAvailableWidth = () => {
  const stage = stageRef.value
  if (!stage) return
  stageAvailableWidth.value = Math.max(0, stage.clientWidth - STAGE_HORIZONTAL_PADDING)
  clampViewOffset()
  scheduleEditorFrame()
}

const resolveMobileCanvasBounds = (naturalW: number, naturalH: number) => {
  const maxW = mobileViewportMaxWidth.value
  const availH = Math.max(220, viewportHeight.value - MOBILE_MODAL_CHROME_HEIGHT)
  const aspect = naturalW / naturalH

  if (aspect >= MOBILE_LANDSCAPE_ASPECT) {
    const heightAtFullWidth = maxW / aspect
    const boostedHeight = Math.min(Math.round(availH * 0.82), Math.round(heightAtFullWidth * 1.5))
    const targetHeight = Math.max(Math.round(heightAtFullWidth), boostedHeight)
    const scale = targetHeight / naturalH
    const image = {
      width: Math.max(1, Math.round(naturalW * scale)),
      height: Math.max(1, Math.round(naturalH * scale)),
      scale,
    }
    return { image, viewport: { ...image } }
  }

  const maxH = Math.min(Math.round(availH * 0.86), Math.round(maxW * 1.35))
  return resolveEditorLayout(naturalW, naturalH, maxW, maxH)
}

const editorLayout = computed(() => {
  const layoutSource = canvasLayout.value
  const boxW = layoutSource.canvasWidth
  const boxH = layoutSource.canvasHeight

  if (isMobileLayout.value) {
    return resolveMobileCanvasBounds(boxW, boxH)
  }

  const { maxW, maxH } = resolveDesktopCanvasBounds()
  return resolveEditorLayout(boxW, boxH, maxW, maxH)
})

const canvasLayout = computed(() => {
  if (imageSize.value) {
    return resolveOutOfFrameEditorCanvasLayout(imageSize.value.width, imageSize.value.height)
  }
  return resolveOutOfFrameEditorCanvasLayout(props.stageWidth, props.stageHeight)
})

const displayMetrics = computed(() => editorLayout.value.image)
const viewportMetrics = computed(() => editorLayout.value.viewport)

const displaySize = computed(() => ({
  width: displayMetrics.value.width,
  height: displayMetrics.value.height,
}))

const effectiveViewZoomMax = computed(() => {
  const base = displaySize.value
  const work = canvasLayout.value
  return resolveOutOfFrameEffectiveViewZoomMaxPercent(
    base.width,
    base.height,
    work.canvasWidth,
    work.canvasHeight,
  )
})

/** 预览画布像素尺寸：随缩放提高分辨率，上限为工作画布，避免 CSS 放大发糊 */
const previewSize = computed(() => {
  const base = displaySize.value
  const work = canvasLayout.value
  return resolveOutOfFramePreviewSizeForZoom(
    base.width,
    base.height,
    work.canvasWidth,
    work.canvasHeight,
    viewZoomPercent.value,
  )
})

const resolvePreviewSizeForZoom = (zoomPercent: number) => {
  const base = displaySize.value
  const work = canvasLayout.value
  return resolveOutOfFramePreviewSizeForZoom(
    base.width,
    base.height,
    work.canvasWidth,
    work.canvasHeight,
    zoomPercent,
  )
}

const resolveCanvasContentRectInViewport = () => {
  const { width: contentW, height: contentH } = previewSize.value
  const { width: viewW, height: viewH } = viewportClipSize.value
  const ox = viewOffset.value.x
  const oy = viewOffset.value.y
  const left = (viewW - contentW) / 2 + ox
  const top = (viewH - contentH) / 2 + oy
  return { left, top, width: contentW, height: contentH }
}

const resolveZoomPivotContentCenter = () => {
  const { width: viewW, height: viewH } = viewportClipSize.value
  const ox = viewOffset.value.x
  const oy = viewOffset.value.y
  return { x: viewW / 2 + ox, y: viewH / 2 + oy }
}

const isPointOnCanvasContent = (x: number, y: number) => {
  const rect = resolveCanvasContentRectInViewport()
  return (
    x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
  )
}

let skipZoomOffsetWatch = false

const adjustViewOffsetForZoom = (
  oldPercent: number,
  newPercent: number,
  pivot: { x: number; y: number },
) => {
  const oldSize = resolvePreviewSizeForZoom(oldPercent)
  const newSize = resolvePreviewSizeForZoom(newPercent)
  viewOffset.value = resolveViewOffsetAfterZoom(
    viewOffset.value,
    pivot,
    viewportClipSize.value,
    oldSize,
    newSize,
  )
}

const viewportClipSize = computed(() => {
  const viewport = viewportMetrics.value
  let width = viewport.width
  let height = viewport.height

  if (isMobileLayout.value) {
    width = Math.min(width, mobileViewportMaxWidth.value)
  }

  return { width, height }
})

const maskScale = computed(() => {
  if (!maskCanvas.value) return displayMetrics.value.scale
  return previewSize.value.width / maskCanvas.value.width
})

const magnifierIsSquare = computed(
  () =>
    brushShape.value === 'square' &&
    (editorTool.value === 'erase' || editorTool.value === 'restore'),
)

const viewportFrameStyle = computed(() => ({
  width: `${viewportClipSize.value.width}px`,
  height: `${viewportClipSize.value.height}px`,
}))

const canvasLayerStyle = computed(() => ({
  width: `${previewSize.value.width}px`,
  height: `${previewSize.value.height}px`,
  transform: `translate(${viewOffset.value.x}px, ${viewOffset.value.y}px)`,
}))

const brushRingStyle = computed(() => {
  if (!cursorPoint.value || !isPaintingTool.value) return undefined
  const size = brushSize.value
  return {
    left: `${cursorPoint.value.x - size / 2}px`,
    top: `${cursorPoint.value.y - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  }
})

/** 采样范围 = 笔刷圈（与圈内内容 1:1 同源） */
const magnifierSampleSize = computed(() => Math.max(1, Math.round(brushSize.value)))

/** 显示尺寸 = 采样区像素放大，便于手机端辨认 */
const magnifierDisplaySize = computed(() => {
  const sample = magnifierSampleSize.value
  const scaled = Math.round(sample * MAGNIFIER_PIXEL_SCALE)
  if (isTouch) {
    return Math.min(MAGNIFIER_TOUCH_MAX_DISPLAY, Math.max(MAGNIFIER_TOUCH_MIN_DISPLAY, scaled))
  }
  return Math.max(MAGNIFIER_DESKTOP_MIN_DISPLAY, scaled)
})

/** 放大镜在笔刷旁，圈内内容与笔刷圈一致，显示更大；永不与笔刷圈重叠 */
const magnifierStyle = computed(() => {
  if (!cursorPoint.value) return undefined
  const size = magnifierDisplaySize.value
  const brushRadius = magnifierSampleSize.value / 2
  const { width: viewW, height: viewH } = viewportClipSize.value
  const { left, top } = resolveMagnifierPlacement({
    brushCx: cursorPoint.value.x,
    brushCy: cursorPoint.value.y,
    brushRadius,
    magnifierSize: size,
    viewWidth: viewW,
    viewHeight: viewH,
    gap: MAGNIFIER_OFFSET,
    viewportPad: MAGNIFIER_VIEWPORT_PAD,
  })

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${size}px`,
    height: `${size}px`,
  }
})

const canvasCursorClass = computed(() => {
  if (panning.value || multiTouchNavigating.value) {
    return 'out-of-frame-editor__canvas--grabbing'
  }
  if (editorTool.value === 'pan') {
    return 'out-of-frame-editor__canvas--grab'
  }
  if (isWandTool.value) {
    return 'out-of-frame-editor__canvas--wand'
  }
  return 'out-of-frame-editor__canvas--brush'
})

const startPan = (event: PointerEvent) => {
  panning.value = true
  cursorPoint.value = null
  panStart = {
    x: event.clientX,
    y: event.clientY,
    ox: viewOffset.value.x,
    oy: viewOffset.value.y,
  }
}

const resolveTouchDistance = (t0: Touch, t1: Touch) =>
  Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)

const resolveTouchCenterInViewport = (t0: Touch, t1: Touch) => {
  const viewport = viewportRef.value
  if (!viewport) {
    return {
      x: (t0.clientX + t1.clientX) / 2,
      y: (t0.clientY + t1.clientY) / 2,
    }
  }
  const rect = viewport.getBoundingClientRect()
  return {
    x: (t0.clientX + t1.clientX) / 2 - rect.left,
    y: (t0.clientY + t1.clientY) / 2 - rect.top,
  }
}

const applyViewportPanDelta = (dx: number, dy: number) => {
  viewOffset.value = {
    x: viewOffset.value.x + dx,
    y: viewOffset.value.y + dy,
  }
  clampViewOffset()
  scheduleEditorFrame()
}

let zoomMaxNotifiedAt = 0
const ZOOM_MAX_NOTIFY_COOLDOWN_MS = 2500

const notifyViewZoomAtMaxResolution = () => {
  const now = Date.now()
  if (now - zoomMaxNotifiedAt < ZOOM_MAX_NOTIFY_COOLDOWN_MS) return
  zoomMaxNotifiedAt = now
  message.info(`已达本图放大上限（${effectiveViewZoomMax.value}%），无法继续放大`)
}

const applyViewportZoomAtPivot = (nextPercent: number, pivot: { x: number; y: number }) => {
  const maxPercent = effectiveViewZoomMax.value
  const clamped = Math.min(nextPercent, maxPercent)
  if (nextPercent > clamped && clamped === viewZoomPercent.value) {
    notifyViewZoomAtMaxResolution()
    return
  }
  if (clamped === viewZoomPercent.value) return
  adjustViewOffsetForZoom(viewZoomPercent.value, clamped, pivot)
  skipZoomOffsetWatch = true
  viewZoomPercent.value = clamped
  clampViewOffset()
  scheduleEditorFrame()
}

const cancelActiveCanvasInteraction = () => {
  painting.value = false
  lastPaintPoint = null
  pendingPaintPoint = null
  panning.value = false
  panStart = null
  cursorPoint.value = null
  cursorMaskPoint.value = null
  touchMagnifierPreview.value = false
}

const resetTouchNavigation = () => {
  multiTouchNavigating.value = false
  touchNavState = null
}

const beginTouchNavigation = (t0: Touch, t1: Touch) => {
  multiTouchNavigating.value = true
  touchNavState = {
    lastDistance: resolveTouchDistance(t0, t1),
    lastCenter: resolveTouchCenterInViewport(t0, t1),
  }
}

const syncTouchNavigation = (t0: Touch, t1: Touch) => {
  if (!touchNavState) return
  const distance = resolveTouchDistance(t0, t1)
  const center = resolveTouchCenterInViewport(t0, t1)
  const scaleRatio = distance / touchNavState.lastDistance
  if (Math.abs(scaleRatio - 1) > 0.002) {
    const nextZoom = resolveOutOfFrameViewZoomPercentFromScale(
      viewZoomPercent.value,
      scaleRatio,
      effectiveViewZoomMax.value,
    )
    applyViewportZoomAtPivot(nextZoom, center)
  }
  applyViewportPanDelta(
    center.x - touchNavState.lastCenter.x,
    center.y - touchNavState.lastCenter.y,
  )
  touchNavState = {
    lastDistance: distance,
    lastCenter: center,
  }
}

const onViewportTouchStart = (event: TouchEvent) => {
  if (!modalVisible.value || matting.value || initializing.value) return
  activeTouchCount.value = event.touches.length
  if (event.touches.length < 2) return
  handleMultiTouchNavigationStart(event)
}

const onViewportTouchMove = (event: TouchEvent) => {
  if (!modalVisible.value || matting.value || initializing.value) return
  activeTouchCount.value = event.touches.length
  if (!multiTouchNavigating.value || event.touches.length < 2) return
  event.preventDefault()
  syncTouchNavigation(event.touches[0]!, event.touches[1]!)
}

const onViewportTouchEnd = (event: TouchEvent) => {
  activeTouchCount.value = event.touches.length
  if (event.touches.length >= 2) {
    beginTouchNavigation(event.touches[0]!, event.touches[1]!)
    return
  }
  resetTouchNavigation()
}

const clampViewOffset = () => {
  const contentW = previewSize.value.width
  const contentH = previewSize.value.height
  const viewW = viewportClipSize.value.width
  const viewH = viewportClipSize.value.height
  const maxX = Math.max(0, (contentW - viewW) / 2)
  const maxY = Math.max(0, (contentH - viewH) / 2)
  viewOffset.value = {
    x: Math.max(-maxX, Math.min(maxX, viewOffset.value.x)),
    y: Math.max(-maxY, Math.min(maxY, viewOffset.value.y)),
  }
}

const resetView = () => {
  viewZoomPercent.value = 100
  viewOffset.value = { x: 0, y: 0 }
  resetTouchNavigation()
  activeTouchCount.value = 0
}

watch(brushSize, () => {
  scheduleEditorFrame()
})

watch([brushShape, brushHardness, brushOpacity], () => {
  scheduleEditorFrame()
})

watch(editorTool, (tool) => {
  if (tool === 'restore' && brushShape.value === 'soft') {
    brushShape.value = 'round'
  }
  void nextTick(() => scheduleEditorFrame())
})

watch([wandMode], () => {
  void nextTick(() => scheduleEditorFrame())
})

watch(viewZoomPercent, (newPercent, oldPercent) => {
  if (!oldPercent || newPercent === oldPercent) return
  if (skipZoomOffsetWatch) {
    skipZoomOffsetWatch = false
    return
  }
  adjustViewOffsetForZoom(oldPercent, newPercent, resolveZoomPivotContentCenter())
  clampViewOffset()
  scheduleEditorFrame()
})

watch(effectiveViewZoomMax, (max) => {
  if (viewZoomPercent.value <= max) return
  viewZoomPercent.value = max
  clampViewOffset()
  scheduleEditorFrame()
})

const cloneMaskSnapshot = (source: HTMLCanvasElement) => {
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  const ctx = copy.getContext('2d')
  if (!ctx) throw new Error('无法复制蒙版')
  ctx.drawImage(source, 0, 0)
  return copy
}

const pushUndo = () => {
  if (!maskCanvas.value) return
  undoStack.value.push(cloneMaskSnapshot(maskCanvas.value))
  if (undoStack.value.length > 30) undoStack.value.shift()
  isAtInitialMask.value = false
}

const captureFeatherStrokeUndo = () => {
  if (!maskCanvas.value || featherUndoCaptured) return
  strokeUndoSnapshot = cloneMaskSnapshot(maskCanvas.value)
  featherUndoCaptured = true
}

const commitFeatherStrokeUndo = () => {
  if (!strokeUndoSnapshot || !featherUndoCaptured) return
  undoStack.value.push(strokeUndoSnapshot)
  if (undoStack.value.length > 30) undoStack.value.shift()
  isAtInitialMask.value = false
  strokeUndoSnapshot = null
  featherUndoCaptured = false
}

const resetFeatherStrokeUndo = () => {
  strokeUndoSnapshot = null
  featherUndoCaptured = false
}

const drawMaskToCanvas = (
  ctx: CanvasRenderingContext2D,
  dataUrl: string,
  width: number,
  height: number,
) =>
  new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const normalized = normalizeMaskCanvas(img, width, height)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(normalized, 0, 0, width, height)
      resolve()
    }
    img.onerror = () => reject(new Error('蒙版加载失败'))
    img.src = dataUrl
  })

const restoreMaskFromSnapshot = (snapshot: HTMLCanvasElement) => {
  if (!maskCanvas.value) return
  const layout = canvasLayout.value
  if (snapshot.width === layout.canvasWidth && snapshot.height === layout.canvasHeight) {
    if (!maskCtx) syncDisplayContexts()
    if (!maskCtx) return
    resetMaskCtxState()
    maskCtx.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    maskCtx.drawImage(snapshot, 0, 0)
  } else {
    const embedded = embedOutOfFrameMaskSnapshotInPaddedCanvas(snapshot, layout)
    if (!maskCtx) syncDisplayContexts()
    if (!maskCtx) return
    resetMaskCtxState()
    maskCtx.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    maskCtx.drawImage(embedded, 0, 0)
  }
  lastPaintPoint = null
  renderPreviewSync()
}

const restoreMaskFromDataUrl = async (dataUrl: string) => {
  if (!maskCanvas.value) return
  const layout = canvasLayout.value
  const restored = await loadOutOfFrameMaskIntoPaddedCanvas(dataUrl, layout)
  const ctx = maskCanvas.value.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
  ctx.drawImage(restored, 0, 0)
  renderPreviewSync()
}

const renderMagnifierSourceSync = () => {
  if (!sourceImage.value) return
  const dw = previewSize.value.width
  const dh = previewSize.value.height
  if (!magnifierSourceBufferCanvas) {
    magnifierSourceBufferCanvas = document.createElement('canvas')
  }
  if (magnifierSourceBufferCanvas.width !== dw) magnifierSourceBufferCanvas.width = dw
  if (magnifierSourceBufferCanvas.height !== dh) magnifierSourceBufferCanvas.height = dh
  const ctx = magnifierSourceBufferCanvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, dw, dh)
  const destSource = scaleOutOfFrameEditorSourceRect(
    canvasLayout.value.sourceRect,
    maskCanvas.value?.width ?? dw,
    maskCanvas.value?.height ?? dh,
    dw,
    dh,
  )
  ctx.drawImage(
    sourceImage.value,
    destSource.x,
    destSource.y,
    destSource.width,
    destSource.height,
  )
}

const renderPreviewSync = () => {
  if (!maskCanvas.value || !sourceImage.value) return
  if (!displayCtx || !maskCtx) syncDisplayContexts()
  if (!displayCtx) return
  renderMagnifierSourceSync()
  const dw = previewSize.value.width
  const dh = previewSize.value.height
  if (!previewBufferCanvas) {
    previewBufferCanvas = document.createElement('canvas')
  }
  compositePreviewWithPaddedMaskElements(
    sourceImage.value,
    maskCanvas.value,
    dw,
    dh,
    canvasLayout.value.sourceRect,
    previewBufferCanvas,
  )
  displayCtx.clearRect(0, 0, dw, dh)
  displayCtx.drawImage(previewBufferCanvas, 0, 0)
}

const renderRestoreReferenceSync = () => {
  if (!sourceImage.value || !isRestoreTool.value) return
  const dw = previewSize.value.width
  const dh = previewSize.value.height
  if (!referenceBufferCanvas) {
    referenceBufferCanvas = document.createElement('canvas')
  }
  if (referenceBufferCanvas.width !== dw) referenceBufferCanvas.width = dw
  if (referenceBufferCanvas.height !== dh) referenceBufferCanvas.height = dh
  const bufferCtx = referenceBufferCanvas.getContext('2d')
  if (!bufferCtx) return
  bufferCtx.clearRect(0, 0, dw, dh)
  bufferCtx.globalAlpha = RESTORE_REFERENCE_ALPHA
  const destSource = scaleOutOfFrameEditorSourceRect(
    canvasLayout.value.sourceRect,
    maskCanvas.value?.width ?? dw,
    maskCanvas.value?.height ?? dh,
    dw,
    dh,
  )
  bufferCtx.drawImage(
    sourceImage.value,
    destSource.x,
    destSource.y,
    destSource.width,
    destSource.height,
  )
  bufferCtx.globalAlpha = 1

  const refCanvas = referenceCanvasRef.value
  if (!refCanvas) return
  if (refCanvas.width !== dw) refCanvas.width = dw
  if (refCanvas.height !== dh) refCanvas.height = dh
  const refCtx = refCanvas.getContext('2d')
  if (!refCtx) return
  refCtx.clearRect(0, 0, dw, dh)
  refCtx.drawImage(referenceBufferCanvas, 0, 0)
}

const resolveBrushPaintOptions = (): OutOfFrameBrushStampOptions => ({
  shape: brushShape.value,
  mode: editorTool.value === 'erase' ? 'erase' : 'restore',
  hardness: brushHardness.value,
  opacity: brushOpacity.value / 100,
})

const flushPaintStroke = () => {
  if (!pendingPaintPoint || !maskCanvas.value) return
  if (!maskCtx) syncDisplayContexts()
  if (!maskCtx) return
  if (touchPaintUndoPending) {
    if (editorTool.value !== 'feather') {
      pushUndo()
    }
    touchPaintUndoPending = false
  }
  const { x, y } = pendingPaintPoint
  pendingPaintPoint = null
  const radius = resolveMaskBrushRadius()

  if (editorTool.value === 'feather') {
    paintFeatherRegion(x, y, radius)
    lastPaintPoint = { x, y }
    return
  }

  const options = resolveBrushPaintOptions()
  if (lastPaintPoint) {
    paintOutOfFrameBrushSegment(maskCtx, lastPaintPoint.x, lastPaintPoint.y, x, y, radius, options)
  }
  paintOutOfFrameBrushStamp(maskCtx, x, y, radius, options)
  lastPaintPoint = { x, y }
}

const releaseCanvasPointerCapture = (pointerId?: number) => {
  const canvas = displayCanvasRef.value
  if (!canvas) return
  const id = pointerId ?? touchPointerSession?.pointerId
  if (id == null) return
  if (canvas.hasPointerCapture(id)) {
    canvas.releasePointerCapture(id)
  }
}

const clearTouchPointerSession = () => {
  touchPointerSession = null
  touchMagnifierPreview.value = false
  touchPaintUndoPending = false
}

const abortActiveToolGesture = () => {
  if (previewFrame) {
    cancelAnimationFrame(previewFrame)
    previewFrame = 0
  }
  pendingPaintPoint = null
  pendingCursor = null
  lastPaintPoint = null

  if (painting.value) {
    if (editorTool.value === 'feather') {
      if (featherUndoCaptured && strokeUndoSnapshot) {
        restoreMaskFromSnapshot(strokeUndoSnapshot)
      }
      resetFeatherStrokeUndo()
    } else if (undoStack.value.length) {
      const snapshot = undoStack.value.pop()
      if (snapshot) restoreMaskFromSnapshot(snapshot)
    }
    renderPreviewSync()
    if (isRestoreTool.value) {
      renderRestoreReferenceSync()
    }
  }

  cancelActiveCanvasInteraction()
  resetMaskCtxState()
}

const activateEditorToolPointer = (
  event: PointerEvent,
  options?: { deferInitialStamp?: boolean },
) => {
  if (editorTool.value === 'pan') {
    startPan(event)
    return
  }

  if (editorTool.value === 'wand') {
    setCursorFromEvent(event, true)
    const point = toMaskCoords(event)
    if (point) applyMagicWandAt(point.x, point.y)
    return
  }

  painting.value = true
  if (editorTool.value === 'feather') {
    resetFeatherStrokeUndo()
  } else if (options?.deferInitialStamp) {
    touchPaintUndoPending = true
  } else {
    pushUndo()
  }
  beginPaintStroke()
  setCursorFromEvent(event, true)
  const point = toMaskCoords(event)
  if (point && !options?.deferInitialStamp) {
    pendingPaintPoint = point
    if (editorTool.value === 'feather') {
      scheduleEditorFrame()
    } else {
      flushPaintStroke()
      renderPreviewSync()
    }
  } else {
    lastPaintPoint = null
  }
}

const tryActivateTouchPointerTool = (event: PointerEvent) => {
  if (!touchPointerSession || touchPointerSession.activated) return
  if (multiTouchNavigating.value || activeTouchCount.value >= 2) return
  touchPointerSession.activated = true
  if (isPaintingTool.value) {
    touchPointerSession.deferPaintUntilMove = true
    activateEditorToolPointer(event, { deferInitialStamp: true })
    return
  }
  activateEditorToolPointer(event)
}

const handleMultiTouchNavigationStart = (event: TouchEvent) => {
  event.preventDefault()
  abortActiveToolGesture()
  releaseCanvasPointerCapture()
  clearTouchPointerSession()
  beginTouchNavigation(event.touches[0]!, event.touches[1]!)
}

const runEditorFrame = () => {
  previewFrame = 0
  if (pendingCursor) {
    cursorPoint.value = pendingCursor
    pendingCursor = null
  }
  if (pendingPaintPoint) flushPaintStroke()
  renderPreviewSync()
  if (isRestoreTool.value) {
    renderRestoreReferenceSync()
  }
  updateMagnifier()
}

const scheduleEditorFrame = () => {
  if (previewFrame) return
  previewFrame = requestAnimationFrame(runEditorFrame)
}

const resetMaskCtxState = () => {
  if (!maskCtx) syncDisplayContexts()
  if (!maskCtx) return
  maskCtx.globalCompositeOperation = 'source-over'
  maskCtx.globalAlpha = 1
}

/** 撤销/重做前取消未完成的笔刷帧，避免 rAF 在恢复蒙版后继续涂抹或擦除 */
const cancelPendingEditorWork = () => {
  if (previewFrame) {
    cancelAnimationFrame(previewFrame)
    previewFrame = 0
  }
  pendingPaintPoint = null
  pendingCursor = null
  lastPaintPoint = null
  painting.value = false
  panning.value = false
  panStart = null
  resetTouchNavigation()
  activeTouchCount.value = 0
  releaseCanvasPointerCapture()
  clearTouchPointerSession()
  resetFeatherStrokeUndo()
  resetMaskCtxState()
}

const initEditor = async () => {
  if (!props.sourcePic) return
  editorTool.value = 'pan'
  initializing.value = true
  resetView()
  loadingProgress.value = buildMattingProgress(1, INIT_TOTAL_STEPS, '读取原画', {
    detail: '获取图片原始尺寸…',
    stepRatio: 0.3,
  })
  try {
    const [naturalSize, loadedSource] = await Promise.all([
      loadImageNaturalSize(props.sourcePic),
      loadOutOfFrameImage(props.sourcePic),
    ])
    imageSize.value = naturalSize
    sourceImage.value = loadedSource

    loadingProgress.value = buildMattingProgress(2, INIT_TOTAL_STEPS, '对齐原图', {
      detail: '准备画布中…',
      stepRatio: 0.5,
    })
    const layout = resolveOutOfFrameEditorCanvasLayout(naturalSize.width, naturalSize.height)
    const canvas = document.createElement('canvas')
    canvas.width = layout.canvasWidth
    canvas.height = layout.canvasHeight
    maskCanvas.value = canvas

    loadingProgress.value = buildMattingProgress(3, INIT_TOTAL_STEPS, '准备蒙版', {
      detail: props.maskDataUrl ? '恢复已有蒙版…' : '初始化空白蒙版…',
      stepRatio: 0.7,
    })
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('无法创建蒙版画布')
    if (props.maskDataUrl) {
      const restored = await loadOutOfFrameMaskIntoPaddedCanvas(props.maskDataUrl, layout)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(restored, 0, 0)
    } else {
      const initial = createOutOfFramePaddedInitialMask(layout)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(initial, 0, 0)
    }
    undoStack.value = []
    initialLegendMaskSnapshot = createInitialLegendMaskSnapshot(layout)
    isAtInitialMask.value = !props.maskDataUrl
    await nextTick()
    updateStageAvailableWidth()
    brushSize.value = resolveDefaultOutOfFrameBrushSize(viewportClipSize.value.width, isTouch)
    syncDisplayContexts()
    lastPaintPoint = null
    pendingPaintPoint = null
    renderPreviewSync()
    loadingProgress.value = buildMattingProgress(3, INIT_TOTAL_STEPS, '准备完成', {
      detail: '编辑器已就绪',
      stepRatio: 1,
    })
    mattingModel.value = resolveDefaultMattingModelForViewport()
    await refreshMattingAssetHint(mattingModel.value)
    startMattingModelPreload(mattingModel.value)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '编辑器初始化失败')
    modalVisible.value = false
  } finally {
    initializing.value = false
    loadingProgress.value = null
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) void initEditor()
  },
)

const toMaskCoords = (event: PointerEvent) => {
  const canvas = displayCanvasRef.value
  if (!canvas || !maskCanvas.value) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = ((event.clientX - rect.left) / rect.width) * maskCanvas.value.width
  const y = ((event.clientY - rect.top) / rect.height) * maskCanvas.value.height
  return { x, y }
}

const setCursorFromEvent = (event: PointerEvent, immediate = false) => {
  const viewport = viewportRef.value
  if (!viewport) return
  const rect = viewport.getBoundingClientRect()
  const point = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
  if (isPaintingTool.value) {
    cursorMaskPoint.value = toMaskCoords(event)
  } else if (isWandTool.value) {
    cursorMaskPoint.value = null
  } else {
    cursorMaskPoint.value = null
  }
  if (immediate || !painting.value) {
    cursorPoint.value = point
    pendingCursor = null
    if (isPaintingTool.value) scheduleEditorFrame()
    return
  }
  pendingCursor = point
  scheduleEditorFrame()
}

const syncDisplayContexts = () => {
  displayCtx = displayCanvasRef.value?.getContext('2d') ?? null
  maskCtx = maskCanvas.value?.getContext('2d', { willReadFrequently: true }) ?? null
}

const releaseEditorResources = () => {
  cancelPendingEditorWork()
  maskCanvas.value = null
  sourceImage.value = null
  imageSize.value = null
  undoStack.value = []
  initialLegendMaskSnapshot = null
  previewBufferCanvas = null
  magnifierSourceBufferCanvas = null
  referenceBufferCanvas = null
  featherSrcCanvas = null
  featherBlurCanvas = null
  maskCtx = null
  displayCtx = null
}

watch(
  modalVisible,
  (visible) => {
    setOutOfFrameEditorOpen(visible)
    if (!visible) {
      if (maskCanvas.value || previewFrame) {
        releaseEditorResources()
      }
      return
    }
    void nextTick(() => {
      updateStageAvailableWidth()
      if (!stageRef.value || stageResizeObserver) return
      stageResizeObserver = new ResizeObserver(() => {
        updateStageAvailableWidth()
      })
      stageResizeObserver.observe(stageRef.value)
    })
  },
  { immediate: true },
)

const smoothBrushFalloff = (t: number) => t * t * (3 - 2 * t)

const resolveMaskBrushRadius = () => Math.max(1, brushSize.value / 2 / maskScale.value)

const updateMagnifier = () => {
  if (!showMagnifier.value || !cursorMaskPoint.value || !maskCanvas.value) return
  if (isEraseTool.value) {
    if (!magnifierSourceBufferCanvas || !previewBufferCanvas) return
    if (magnifierSourceBufferCanvas.width !== previewSize.value.width) {
      renderMagnifierSourceSync()
    }
  } else if (!previewBufferCanvas) {
    return
  }
  const magnifierCanvas = magnifierCanvasRef.value
  if (!magnifierCanvas) return
  const ctx = magnifierCanvas.getContext('2d')
  if (!ctx) return

  const sampleSize = magnifierSampleSize.value
  const displaySize = magnifierDisplaySize.value
  if (magnifierCanvas.width !== displaySize) magnifierCanvas.width = displaySize
  if (magnifierCanvas.height !== displaySize) magnifierCanvas.height = displaySize

  const sampleCanvas = previewBufferCanvas ?? magnifierSourceBufferCanvas!
  const previewScale = previewSize.value.width / maskCanvas.value.width
  const px = cursorMaskPoint.value.x * previewScale
  const py = cursorMaskPoint.value.y * previewScale
  const half = sampleSize / 2
  const sx = Math.max(0, Math.min(sampleCanvas.width - sampleSize, px - half))
  const sy = Math.max(0, Math.min(sampleCanvas.height - sampleSize, py - half))

  const center = displaySize / 2
  const radius = displaySize / 2

  ctx.clearRect(0, 0, displaySize, displaySize)
  ctx.save()
  if (magnifierIsSquare.value) {
    ctx.beginPath()
    ctx.rect(0, 0, displaySize, displaySize)
    ctx.clip()
  } else {
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.clip()
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = MAGNIFIER_BACKDROP
  ctx.fillRect(0, 0, displaySize, displaySize)

  if (isEraseTool.value && magnifierSourceBufferCanvas && previewBufferCanvas) {
    ctx.globalAlpha = ERASE_MAGNIFIER_GHOST_ALPHA
    ctx.drawImage(
      magnifierSourceBufferCanvas,
      sx,
      sy,
      sampleSize,
      sampleSize,
      0,
      0,
      displaySize,
      displaySize,
    )
    ctx.globalAlpha = 1
    ctx.drawImage(
      previewBufferCanvas,
      sx,
      sy,
      sampleSize,
      sampleSize,
      0,
      0,
      displaySize,
      displaySize,
    )
  } else {
    if (isRestoreTool.value && referenceBufferCanvas) {
      ctx.drawImage(
        referenceBufferCanvas,
        sx,
        sy,
        sampleSize,
        sampleSize,
        0,
        0,
        displaySize,
        displaySize,
      )
    }
    if (previewBufferCanvas) {
      ctx.drawImage(
        previewBufferCanvas,
        sx,
        sy,
        sampleSize,
        sampleSize,
        0,
        0,
        displaySize,
        displaySize,
      )
    }
  }
  ctx.restore()
}

const FEATHER_BLUR_RADIUS_CAP = 48

const resolveMaskFeatherRadius = () =>
  Math.min(FEATHER_BLUR_RADIUS_CAP, Math.max(1, featherRadius.value / maskScale.value))

const readMaskVisibility = (data: Uint8ClampedArray, pixelIndex: number) =>
  data[pixelIndex * 4 + 3]!

const blurVisibilityPatch = (
  visibility: Uint8ClampedArray,
  patchW: number,
  patchH: number,
  blurRadius: number,
) => {
  if (!featherSrcCanvas) featherSrcCanvas = document.createElement('canvas')
  if (!featherBlurCanvas) featherBlurCanvas = document.createElement('canvas')
  featherSrcCanvas.width = patchW
  featherSrcCanvas.height = patchH
  featherBlurCanvas.width = patchW
  featherBlurCanvas.height = patchH
  const srcCtx = featherSrcCanvas.getContext('2d')
  const blurCtx = featherBlurCanvas.getContext('2d')
  if (!srcCtx || !blurCtx) return visibility

  const imageData = srcCtx.createImageData(patchW, patchH)
  const { data } = imageData
  for (let i = 0; i < visibility.length; i++) {
    const v = visibility[i]!
    const idx = i * 4
    data[idx] = v
    data[idx + 1] = v
    data[idx + 2] = v
    data[idx + 3] = 255
  }
  srcCtx.putImageData(imageData, 0, 0)
  blurCtx.clearRect(0, 0, patchW, patchH)
  blurCtx.filter = `blur(${blurRadius}px)`
  blurCtx.drawImage(featherSrcCanvas, 0, 0)
  blurCtx.filter = 'none'
  const blurred = blurCtx.getImageData(0, 0, patchW, patchH).data
  const out = new Uint8ClampedArray(visibility.length)
  for (let i = 0; i < visibility.length; i++) {
    out[i] = blurred[i * 4]!
  }
  return out
}

/** 羽化：沿笔刷柔化边缘并局部降低透明度，已擦除区域不恢复 */
const paintFeatherRegion = (cx: number, cy: number, brushRadius: number) => {
  if (!maskCtx || !maskCanvas.value) return
  captureFeatherStrokeUndo()

  const blurRadius = resolveMaskFeatherRadius()
  const margin = Math.ceil(blurRadius * 1.2) + 2
  const maskW = maskCanvas.value.width
  const maskH = maskCanvas.value.height
  const span = Math.min(FEATHER_PATCH_MAX, Math.ceil(brushRadius + margin + blurRadius) * 2)
  const x0 = Math.max(0, Math.floor(cx - span / 2))
  const y0 = Math.max(0, Math.floor(cy - span / 2))
  const x1b = Math.min(maskW, Math.ceil(cx + span / 2))
  const y1b = Math.min(maskH, Math.ceil(cy + span / 2))
  const patchW = x1b - x0
  const patchH = y1b - y0
  if (patchW <= 0 || patchH <= 0) return

  const imageData = maskCtx.getImageData(x0, y0, patchW, patchH)
  const { data } = imageData
  const patchPixels = patchW * patchH
  const sourceVisibility = new Uint8ClampedArray(patchPixels)

  for (let i = 0; i < patchPixels; i++) {
    sourceVisibility[i] = readMaskVisibility(data, i)
  }

  const blurredVisibility = blurVisibilityPatch(sourceVisibility, patchW, patchH, blurRadius)
  const dimStrength = Math.min(0.72, 0.28 + blurRadius / 96)

  for (let py = 0; py < patchH; py++) {
    const gy = y0 + py
    for (let px = 0; px < patchW; px++) {
      const gx = x0 + px
      const dist = Math.hypot(gx - cx, gy - cy)
      if (dist > brushRadius) continue

      const soft = smoothBrushFalloff(1 - dist / brushRadius)
      if (soft <= 0) continue

      const alphaIdx = py * patchW + px
      const currentVisibility = sourceVisibility[alphaIdx]!
      if (currentVisibility <= 0) continue

      const blurredTarget = blurredVisibility[alphaIdx]!
      const softenTarget = Math.min(
        blurredTarget,
        Math.round(currentVisibility * (1 - dimStrength * soft)),
      )
      const newVisibility = Math.round(
        currentVisibility + (softenTarget - currentVisibility) * soft,
      )
      if (newVisibility >= currentVisibility) continue

      const idx = alphaIdx * 4
      data[idx] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = newVisibility
    }
  }

  maskCtx.putImageData(imageData, x0, y0)
}

const beginPaintStroke = () => {
  if (!maskCtx) syncDisplayContexts()
  if (!maskCtx) return
  lastPaintPoint = null
  if (editorTool.value === 'feather') return
  maskCtx.globalCompositeOperation =
    editorTool.value === 'erase' ? 'destination-out' : 'source-over'
  maskCtx.globalAlpha = 1
}

const queuePaintAt = (x: number, y: number) => {
  pendingPaintPoint = { x, y }
  scheduleEditorFrame()
}

const applyMagicWandAt = (x: number, y: number) => {
  if (!maskCanvas.value || !sourceImage.value) return
  if (!maskCtx) syncDisplayContexts()
  if (!maskCtx) return

  pushUndo()
  resetMaskCtxState()
  const affected = applyMagicWandToMask(
    sourceImage.value,
    maskCtx,
    maskCanvas.value.width,
    maskCanvas.value.height,
    x,
    y,
    {
      mode: wandMode.value,
      tolerance: wandTolerance.value,
      sourceRect: canvasLayout.value.sourceRect,
    },
  )
  if (affected === 0) {
    undoStack.value.pop()
    message.info('未选中相似区域，可调高容差后重试')
    return
  }
  renderPreviewSync()
  if (isRestoreTool.value) {
    renderRestoreReferenceSync()
  }
}

const onPointerDown = (event: PointerEvent) => {
  if (matting.value || initializing.value) return
  if (multiTouchNavigating.value || activeTouchCount.value >= 2) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  displayCanvasRef.value?.setPointerCapture(event.pointerId)

  if (isTouch && event.pointerType === 'touch') {
    touchPointerSession = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      activated: false,
      deferPaintUntilMove: false,
    }
    if (isPaintingTool.value) {
      touchMagnifierPreview.value = true
      setCursorFromEvent(event, true)
    }
    return
  }

  activateEditorToolPointer(event)
}

const onPointerMove = (event: PointerEvent) => {
  if (matting.value || initializing.value) return
  if (multiTouchNavigating.value || activeTouchCount.value >= 2) {
    if (touchPointerSession && event.pointerId === touchPointerSession.pointerId) {
      abortActiveToolGesture()
      releaseCanvasPointerCapture(event.pointerId)
      clearTouchPointerSession()
    }
    return
  }

  if (touchPointerSession && event.pointerId === touchPointerSession.pointerId) {
    if (!touchPointerSession.activated) {
      const dx = event.clientX - touchPointerSession.startX
      const dy = event.clientY - touchPointerSession.startY
      if (!isWandTool.value && Math.hypot(dx, dy) >= TOUCH_TOOL_ACTIVATE_PX) {
        tryActivateTouchPointerTool(event)
      }
      if (!touchPointerSession.activated) {
        if (isPaintingTool.value || isWandTool.value) setCursorFromEvent(event, true)
        return
      }
    }

    if (touchPointerSession.deferPaintUntilMove) {
      touchPointerSession.deferPaintUntilMove = false
      if (isPaintingTool.value) setCursorFromEvent(event, true)
      return
    }
  }

  if (panning.value && panStart) {
    event.preventDefault()
    viewOffset.value = {
      x: panStart.ox + (event.clientX - panStart.x),
      y: panStart.oy + (event.clientY - panStart.y),
    }
    clampViewOffset()
    return
  }

  if (!displayCanvasRef.value?.hasPointerCapture(event.pointerId) && !painting.value) {
    if (isPaintingTool.value || isWandTool.value) setCursorFromEvent(event, true)
    return
  }

  event.preventDefault()
  if (isPaintingTool.value) setCursorFromEvent(event, painting.value)
  if (!painting.value) return
  const point = toMaskCoords(event)
  if (point) queuePaintAt(point.x, point.y)
}

const endPointer = (event: PointerEvent) => {
  if (touchPointerSession && event.pointerId === touchPointerSession.pointerId) {
    if (
      !touchPointerSession.activated &&
      !multiTouchNavigating.value &&
      activeTouchCount.value <= 1 &&
      isWandTool.value
    ) {
      tryActivateTouchPointerTool(event)
    }
    clearTouchPointerSession()
  }

  if (painting.value && pendingPaintPoint) {
    flushPaintStroke()
    renderPreviewSync()
  }
  if (painting.value && editorTool.value === 'feather') {
    commitFeatherStrokeUndo()
  }
  painting.value = false
  lastPaintPoint = null
  pendingPaintPoint = null
  panning.value = false
  panStart = null
  if (displayCanvasRef.value?.hasPointerCapture(event.pointerId)) {
    displayCanvasRef.value.releasePointerCapture(event.pointerId)
  }
  if (!panning.value) {
    cursorPoint.value = null
    cursorMaskPoint.value = null
    touchMagnifierPreview.value = false
  }
}

const undo = () => {
  if (!undoStack.value.length || !maskCanvas.value) return
  cancelPendingEditorWork()
  const prev = undoStack.value.pop()
  if (!prev) return
  restoreMaskFromSnapshot(prev)
  isAtInitialMask.value = false
}

/** 重做：还原为武将图初始蒙版（全图可见，无抠图/涂抹） */
const resetToInitialMask = () => {
  if (!maskCanvas.value || !initialLegendMaskSnapshot || isAtInitialMask.value) return
  cancelPendingEditorWork()
  pushUndo()
  restoreMaskFromSnapshot(initialLegendMaskSnapshot)
  isAtInitialMask.value = true
}

const rerunMatting = async () => {
  if (!imageSize.value) return
  pushUndo()
  matting.value = true
  loadingProgress.value = buildMattingProgress(1, 5, '准备智能抠图', {
    detail: '即将开始处理…',
    stepRatio: 0,
  })
  try {
    const mask = await runAutoMattingMask(
      props.sourcePic,
      imageSize.value.width,
      imageSize.value.height,
      (progress) => {
        loadingProgress.value = progress
      },
      mattingModel.value,
    )
    await restoreMaskFromDataUrl(mask)
    message.success('智能抠图完成，可继续用笔刷修整')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '智能抠图失败，请改用手动涂抹')
  } finally {
    matting.value = false
    loadingProgress.value = null
  }
}

const handleApply = () => {
  if (!maskCanvas.value) return
  const layout = canvasLayout.value
  const cropped = cropOutOfFrameMaskToSource(maskCanvas.value, layout)
  const dataUrl = cropped.toDataURL('image/png')
  modalVisible.value = false
  const emitApply = () => emit('apply', dataUrl)
  if (isIOSWebKit()) {
    scheduleAfterUiPaint(emitApply)
  } else {
    emitApply()
  }
}

const onViewportWheel = (event: WheelEvent) => {
  if (!modalVisible.value || matting.value || initializing.value) return

  const viewport = viewportRef.value
  if (!viewport) return
  const rect = viewport.getBoundingClientRect()
  const vx = event.clientX - rect.left
  const vy = event.clientY - rect.top
  const pivot = isPointOnCanvasContent(vx, vy) ? { x: vx, y: vy } : resolveZoomPivotContentCenter()

  if (event.ctrlKey || event.altKey) {
    event.preventDefault()
    const next =
      event.ctrlKey && !event.altKey
        ? resolveOutOfFrameViewZoomPercentFromScale(
            viewZoomPercent.value,
            Math.exp(-event.deltaY * 0.01),
            effectiveViewZoomMax.value,
          )
        : resolveNextOutOfFrameViewZoomPercent(
            viewZoomPercent.value,
            event.deltaY,
            effectiveViewZoomMax.value,
          )
    applyViewportZoomAtPivot(next, pivot)
    return
  }

  if (event.deltaX === 0 && event.deltaY === 0) return

  event.preventDefault()
  applyViewportPanDelta(-event.deltaX, -event.deltaY)
}

const onKeyDown = (event: KeyboardEvent) => {
  if (!modalVisible.value || matting.value || initializing.value) return
  if (!(event.ctrlKey || event.metaKey)) return

  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey) {
    if (!undoStack.value.length) return
    event.preventDefault()
    void undo()
    return
  }
  if (key === 'y' || (key === 'z' && event.shiftKey)) {
    if (isAtInitialMask.value) return
    event.preventDefault()
    resetToInitialMask()
  }
}

const onViewportResize = () => {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  updateStageAvailableWidth()
  clampViewOffset()
  syncDisplayContexts()
  scheduleEditorFrame()
}

/** 移动端切后台后 Canvas 常被系统清空，回前台时重同步上下文并重绘 */
const recoverEditorSurface = async () => {
  if (!modalVisible.value || initializing.value || matting.value) return
  if (!maskCanvas.value || !props.sourcePic) return

  await nextTick()

  const displayCanvas = displayCanvasRef.value
  const { width, height } = previewSize.value
  if (displayCanvas) {
    if (displayCanvas.width !== width) displayCanvas.width = width
    if (displayCanvas.height !== height) displayCanvas.height = height
  }

  syncDisplayContexts()

  if (!isOutOfFrameImageLoaded(sourceImage.value)) {
    try {
      sourceImage.value = await loadOutOfFrameImage(props.sourcePic)
    } catch (error) {
      console.error(error)
      return
    }
  }

  renderPreviewSync()
  if (isRestoreTool.value) {
    renderRestoreReferenceSync()
  }
  if (showMagnifier.value) {
    updateMagnifier()
  }
}

useOutOfFrameEditorBackgroundRecovery({
  enabled: () => modalVisible.value && !initializing.value && !matting.value,
  recover: recoverEditorSurface,
})

onMounted(() => {
  globalThis.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onViewportResize)
})

onUnmounted(() => {
  setOutOfFrameEditorOpen(false)
  stageResizeObserver?.disconnect()
  stageResizeObserver = null
  globalThis.removeEventListener('keydown', onKeyDown)
  if (previewFrame) cancelAnimationFrame(previewFrame)
  previewFrame = 0
  previewBufferCanvas = null
  magnifierSourceBufferCanvas = null
  referenceBufferCanvas = null
  maskCtx = null
  displayCtx = null
  initialLegendMaskSnapshot = null
  featherSrcCanvas = null
  featherBlurCanvas = null
  window.removeEventListener('resize', onViewportResize)
})
</script>

<template>
  <n-modal
    v-model:show="modalVisible"
    class="out-of-frame-modal"
    preset="card"
    title="人物出框编辑"
    :style="modalStyle"
    :mask-closable="false"
    :closable="false"
    :auto-focus="false"
  >
    <template #header-extra>
      <n-space :size="8" class="out-of-frame-editor__header-actions">
        <n-button :size="isMobileLayout ? 'small' : 'large'" @click="modalVisible = false"
          >取消</n-button
        >
        <n-button
          type="primary"
          :size="isMobileLayout ? 'small' : 'large'"
          :disabled="matting || initializing"
          @click="handleApply"
        >
          应用
        </n-button>
      </n-space>
    </template>
    <div
      class="out-of-frame-editor"
      :class="{
        'out-of-frame-editor--touch': isTouch,
        'out-of-frame-editor--mobile': isMobileLayout,
      }"
    >
      <div class="out-of-frame-editor__toolbar">
        <div class="out-of-frame-editor__toolbar-main">
          <div class="out-of-frame-editor__tools-grid" role="radiogroup" aria-label="编辑工具">
            <button
              v-for="item in editorToolOptions"
              :key="item.value"
              type="button"
              role="radio"
              :aria-checked="editorTool === item.value"
              class="out-of-frame-editor__tool-btn"
              :class="[
                `out-of-frame-editor__tool-btn--${item.value}`,
                { 'out-of-frame-editor__tool-btn--active': editorTool === item.value },
              ]"
              :disabled="matting || initializing"
              @click="editorTool = item.value"
            >
              <span class="out-of-frame-editor__tool-label">
                <n-icon :size="15"><component :is="item.icon" /></n-icon>
                <span class="out-of-frame-editor__tool-text">{{ item.label }}</span>
              </span>
            </button>
          </div>
          <div class="out-of-frame-editor__op-row">
            <n-button
              class="out-of-frame-editor__matting-btn"
              type="warning"
              size="medium"
              strong
              :loading="matting"
              :disabled="initializing"
              @click="rerunMatting"
            >
              <template #icon>
                <n-icon :size="18"><AutoAwesomeRound /></n-icon>
              </template>
              <span class="out-of-frame-editor__matting-btn-label">
                {{ modelPreloading && !matting ? '模型加载中…' : '智能抠图' }}
              </span>
            </n-button>
            <n-space :size="8" class="out-of-frame-editor__actions">
              <n-tooltip v-if="!isMobileLayout" trigger="hover">
                <template #trigger>
                  <n-button
                    size="medium"
                    :disabled="!undoStack.length || matting || initializing"
                    @click="undo"
                  >
                    <template #icon
                      ><n-icon><ArrowBackRound /></n-icon
                    ></template>
                    撤销
                  </n-button>
                </template>
                Ctrl+Z
              </n-tooltip>
              <n-button
                v-else
                size="medium"
                :disabled="!undoStack.length || matting || initializing"
                @click="undo"
              >
                <template #icon
                  ><n-icon><ArrowBackRound /></n-icon
                ></template>
                撤销
              </n-button>
              <n-tooltip v-if="!isMobileLayout" trigger="hover">
                <template #trigger>
                  <n-button
                    size="medium"
                    :disabled="isAtInitialMask || matting || initializing"
                    @click="resetToInitialMask"
                  >
                    重做
                  </n-button>
                </template>
                还原为武将图初始状态（Ctrl+Y）
              </n-tooltip>
              <n-button
                v-else
                size="medium"
                :disabled="isAtInitialMask || matting || initializing"
                @click="resetToInitialMask"
              >
                重做
              </n-button>
            </n-space>
          </div>
        </div>
        <div class="out-of-frame-editor__toolbar-row out-of-frame-editor__toolbar-row--model">
          <label class="out-of-frame-editor__model-label">
            <span class="out-of-frame-editor__model-label-text">抠图模型</span>
            <n-select
              :value="mattingModel"
              :options="mattingModelSelectOptions"
              size="medium"
              class="out-of-frame-editor__model-select"
              :disabled="matting || initializing"
              @update:value="onMattingModelChange"
            />
          </label>
        </div>
        <div class="out-of-frame-editor__toolbar-row out-of-frame-editor__toolbar-row--sliders">
          <div v-show="showBrushShapeControls" class="out-of-frame-editor__brush-shape">
            <span>形状</span>
            <n-radio-group
              v-model:value="brushShape"
              size="small"
              :disabled="matting || initializing"
            >
              <n-radio-button
                v-for="item in brushShapeOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </n-radio-button>
            </n-radio-group>
          </div>
          <div
            v-show="showBrushShapeControls && brushShape === 'soft'"
            class="out-of-frame-editor__brush-hardness"
          >
            <span>硬度 {{ brushHardness }}%</span>
            <n-slider
              v-model:value="brushHardness"
              :min="20"
              :max="100"
              :step="5"
              :disabled="matting || initializing"
              class="out-of-frame-editor__brush-hardness-slider"
            />
          </div>
          <div
            v-show="editorTool === 'erase' || editorTool === 'restore'"
            class="out-of-frame-editor__brush-opacity"
          >
            <span>不透明度 {{ brushOpacity }}%</span>
            <n-slider
              v-model:value="brushOpacity"
              :min="10"
              :max="100"
              :step="5"
              :disabled="matting || initializing"
              class="out-of-frame-editor__brush-opacity-slider"
            />
          </div>
          <div v-show="isWandTool" class="out-of-frame-editor__wand-mode">
            <span>魔棒</span>
            <n-radio-group
              v-model:value="wandMode"
              size="small"
              :disabled="matting || initializing"
            >
              <n-radio-button value="erase">擦除相似</n-radio-button>
              <n-radio-button value="restore">还原相似</n-radio-button>
            </n-radio-group>
          </div>
          <div v-show="isWandTool" class="out-of-frame-editor__wand-tolerance">
            <span>容差 {{ wandTolerance }}</span>
            <n-slider
              v-model:value="wandTolerance"
              :min="5"
              :max="80"
              :step="1"
              :disabled="matting || initializing"
              class="out-of-frame-editor__wand-tolerance-slider"
            />
          </div>
          <div v-show="isPaintingTool" class="out-of-frame-editor__brush">
            <span>粗细 {{ brushSize }}px</span>
            <n-slider
              v-model:value="brushSize"
              :min="brushSizeLimits.min"
              :max="brushSizeLimits.max"
              :step="brushSizeLimits.step"
              :disabled="matting || initializing"
              class="out-of-frame-editor__brush-slider"
            />
          </div>
          <div v-show="editorTool === 'feather'" class="out-of-frame-editor__feather">
            <span>羽化半径 {{ featherRadius }}px</span>
            <n-slider
              v-model:value="featherRadius"
              :min="2"
              :max="48"
              :step="1"
              :disabled="matting || initializing"
              class="out-of-frame-editor__feather-slider"
            />
          </div>
          <div class="out-of-frame-editor__zoom">
            <div class="out-of-frame-editor__zoom-controls">
              <span class="out-of-frame-editor__zoom-label">
                缩放：{{ viewZoomPercent }}%（最大{{ effectiveViewZoomMax }}%）
              </span>
              <n-slider
                v-model:value="viewZoomPercent"
                :min="OUT_OF_FRAME_VIEW_ZOOM_MIN"
                :max="effectiveViewZoomMax"
                :step="OUT_OF_FRAME_VIEW_ZOOM_STEP"
                :disabled="matting || initializing"
                class="out-of-frame-editor__zoom-slider"
              />
            </div>
            <p class="out-of-frame-editor__zoom-note">
              不同图片，最大缩放上限会有差异（最大为1:1 原图像素）
            </p>
          </div>
        </div>
      </div>

      <div v-if="modelPreloading && !matting && !initializing" class="out-of-frame-editor__preload">
        <div class="out-of-frame-editor__preload-inner">
          <span class="out-of-frame-editor__preload-pulse" aria-hidden="true" />
          <span class="out-of-frame-editor__preload-label">抠图模型加载中</span>
          <div
            class="out-of-frame-editor__preload-track"
            role="progressbar"
            :aria-valuenow="modelPreloadProgress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="out-of-frame-editor__preload-fill"
              :style="{ width: `${modelPreloadProgress}%` }"
            />
          </div>
          <span class="out-of-frame-editor__preload-percent">{{ modelPreloadProgress }}%</span>
        </div>
      </div>

      <div ref="stageRef" class="out-of-frame-editor__stage">
        <div
          ref="viewportRef"
          class="out-of-frame-editor__viewport"
          :style="viewportFrameStyle"
          @wheel.prevent="onViewportWheel"
          @touchstart.capture="onViewportTouchStart"
          @touchmove.capture="onViewportTouchMove"
          @touchend.capture="onViewportTouchEnd"
          @touchcancel.capture="onViewportTouchEnd"
        >
          <div class="out-of-frame-editor__canvas-layer" :style="canvasLayerStyle">
            <div class="out-of-frame-editor__canvas-wrap">
              <canvas
                v-show="isRestoreTool"
                ref="referenceCanvasRef"
                class="out-of-frame-editor__canvas out-of-frame-editor__canvas--reference"
                :width="previewSize.width"
                :height="previewSize.height"
              />
              <canvas
                ref="displayCanvasRef"
                class="out-of-frame-editor__canvas out-of-frame-editor__canvas--preview"
                :class="canvasCursorClass"
                :width="previewSize.width"
                :height="previewSize.height"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="endPointer"
                @pointercancel="endPointer"
                @contextmenu.prevent
              />
            </div>
          </div>
          <div
            v-if="showMagnifier"
            class="out-of-frame-editor__magnifier"
            :class="{
              'out-of-frame-editor__magnifier--erase': editorTool === 'erase',
              'out-of-frame-editor__magnifier--restore': editorTool === 'restore',
              'out-of-frame-editor__magnifier--feather': editorTool === 'feather',
              'out-of-frame-editor__magnifier--square': magnifierIsSquare,
            }"
            :style="magnifierStyle"
          >
            <canvas
              ref="magnifierCanvasRef"
              class="out-of-frame-editor__magnifier-canvas"
              :width="magnifierDisplaySize"
              :height="magnifierDisplaySize"
            />
          </div>
          <div
            v-if="
              cursorPoint &&
              isPaintingTool &&
              !(showMagnifier && isTouch) &&
              !panning &&
              !matting &&
              !initializing
            "
            class="out-of-frame-editor__brush-ring"
            :class="{
              'out-of-frame-editor__brush-ring--erase': editorTool === 'erase',
              'out-of-frame-editor__brush-ring--restore': editorTool === 'restore',
              'out-of-frame-editor__brush-ring--feather': editorTool === 'feather',
              'out-of-frame-editor__brush-ring--round':
                brushShape === 'round' || editorTool === 'feather',
              'out-of-frame-editor__brush-ring--soft':
                brushShape === 'soft' && editorTool !== 'feather',
              'out-of-frame-editor__brush-ring--square': brushShape === 'square',
            }"
            :style="brushRingStyle"
          />

          <div
            v-if="showLoadingOverlay && loadingProgress"
            class="out-of-frame-editor__overlay"
            :class="{
              'out-of-frame-editor__overlay--matting': matting,
              'out-of-frame-editor__overlay--dark': systemStore.isDark,
            }"
          >
            <div
              class="out-of-frame-editor__loading"
              :class="{
                'out-of-frame-editor__loading--matting': matting,
                'out-of-frame-editor__loading--dark': systemStore.isDark,
              }"
            >
              <div class="out-of-frame-editor__loading-head">
                <span class="out-of-frame-editor__loading-title">{{ loadingProgress.title }}</span>
                <span class="out-of-frame-editor__loading-percent"
                  >{{ loadingProgress.percent }}%</span
                >
              </div>
              <div class="out-of-frame-editor__loading-track">
                <div
                  class="out-of-frame-editor__loading-fill"
                  :class="{
                    'out-of-frame-editor__loading-fill--active': loadingProgress.percent < 100,
                  }"
                  :style="{ width: `${loadingProgress.percent}%` }"
                />
              </div>
              <p class="out-of-frame-editor__loading-detail">
                {{ loadingProgress.detail || (matting ? '正在处理，请稍候…' : '准备中…') }}
              </p>
              <span class="out-of-frame-editor__loading-step">
                步骤 {{ loadingProgress.step }} / {{ loadingProgress.totalSteps }}
              </span>
            </div>
          </div>
        </div>

        <div class="out-of-frame-editor__hint">
          <div v-if="isMobileLayout" class="out-of-frame-editor__hint-chips">
            <span class="out-of-frame-editor__hint-chip out-of-frame-editor__hint-chip--canvas">
              <strong>画布</strong>
              <span class="out-of-frame-editor__shortcut">双指捏合缩放 · 双指拖移</span>
            </span>
          </div>
          <div v-else class="out-of-frame-editor__hint-chips">
            <span class="out-of-frame-editor__hint-chip out-of-frame-editor__hint-chip--zoom">
              <strong>缩放</strong>
              <span class="out-of-frame-editor__shortcut"><kbd>Alt</kbd>+滚轮 · 触控板捏合</span>
            </span>
            <span class="out-of-frame-editor__hint-chip out-of-frame-editor__hint-chip--nav">
              <strong>拖移</strong>
              <span class="out-of-frame-editor__shortcut">触控板双指可拖移画布</span>
            </span>
          </div>
          <p v-if="mattingAssetHint" class="out-of-frame-editor__hint-extra">
            {{ mattingAssetHint }}
          </p>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.out-of-frame-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.out-of-frame-editor__toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.out-of-frame-editor__toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  min-height: 30px;
}

.out-of-frame-editor__toolbar-main {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.out-of-frame-editor__tools-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 4px;
  width: 100%;
}

.out-of-frame-editor__tool-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  margin: 0;
  padding: 6px 10px;
  min-height: 32px;
  border: 1px solid color-mix(in srgb, var(--border-color) 88%, transparent);
  border-radius: 6px;
  background: var(--card-color);
  cursor: pointer;
  color: inherit;
  font: inherit;
  line-height: 1.2;
  box-sizing: border-box;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.out-of-frame-editor__tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.out-of-frame-editor__tool-btn:not(:disabled):active {
  transform: scale(0.98);
}

.out-of-frame-editor__tool-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

.out-of-frame-editor__tool-btn--erase:not(.out-of-frame-editor__tool-btn--active) {
  color: #c45656;
  background-color: color-mix(in srgb, #d03050 10%, var(--card-color));
  border-color: color-mix(in srgb, #d03050 24%, var(--border-color));
}

.out-of-frame-editor__tool-btn--erase.out-of-frame-editor__tool-btn--active {
  background-color: #d03050;
  border-color: #d03050;
  color: #fff;
}

.out-of-frame-editor__tool-btn--restore:not(.out-of-frame-editor__tool-btn--active) {
  color: #529b2e;
  background-color: color-mix(in srgb, #18a058 10%, var(--card-color));
  border-color: color-mix(in srgb, #18a058 24%, var(--border-color));
}

.out-of-frame-editor__tool-btn--restore.out-of-frame-editor__tool-btn--active {
  background-color: #18a058;
  border-color: #18a058;
  color: #fff;
}

.out-of-frame-editor__tool-btn--feather:not(.out-of-frame-editor__tool-btn--active) {
  color: #7c3aed;
  background-color: color-mix(in srgb, #7c3aed 12%, var(--card-color));
  border-color: color-mix(in srgb, #7c3aed 24%, var(--border-color));
}

.out-of-frame-editor__tool-btn--feather.out-of-frame-editor__tool-btn--active {
  background-color: #7c3aed;
  border-color: #7c3aed;
  color: #fff;
}

.out-of-frame-editor__tool-btn--wand:not(.out-of-frame-editor__tool-btn--active) {
  color: #d97706;
  background-color: color-mix(in srgb, #f59e0b 12%, var(--card-color));
  border-color: color-mix(in srgb, #f59e0b 24%, var(--border-color));
}

.out-of-frame-editor__tool-btn--wand.out-of-frame-editor__tool-btn--active {
  background-color: #f59e0b;
  border-color: #f59e0b;
  color: #fff;
}

.out-of-frame-editor__tool-btn--pan:not(.out-of-frame-editor__tool-btn--active) {
  color: #2563b8;
  background-color: color-mix(in srgb, #2080f0 12%, var(--card-color));
  border-color: color-mix(in srgb, #2080f0 24%, var(--border-color));
}

.out-of-frame-editor__tool-btn--pan.out-of-frame-editor__tool-btn--active {
  background-color: #2080f0;
  border-color: #2080f0;
  color: #fff;
}

.out-of-frame-editor__tool-btn--active .out-of-frame-editor__tool-label,
.out-of-frame-editor__tool-btn--active .out-of-frame-editor__tool-label :deep(.n-icon) {
  color: inherit;
}

.out-of-frame-editor__op-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex: 0 0 auto;
  min-width: 0;
}

.out-of-frame-editor__toolbar-row--model {
  width: 100%;
}

.out-of-frame-editor__model-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-color-2);
}

.out-of-frame-editor__model-label-text {
  flex-shrink: 0;
  white-space: nowrap;
}

.out-of-frame-editor__model-select {
  width: min(380px, 100%);
  min-width: 0;
}

@media (min-width: 769px) {
  .out-of-frame-editor__model-label {
    font-size: 14px;
    gap: 12px;
  }

  .out-of-frame-editor__model-select {
    width: 400px;
    min-width: 400px;
  }

  .out-of-frame-editor__model-select :deep(.n-base-selection) {
    min-height: 36px;
  }

  .out-of-frame-editor__model-select :deep(.n-base-selection-label) {
    font-size: 14px;
  }
}

.out-of-frame-editor--touch .out-of-frame-editor__model-label {
  width: 100%;
}

.out-of-frame-editor--touch .out-of-frame-editor__model-select {
  flex: 1;
  width: auto;
  min-width: 0;
}

.out-of-frame-editor__actions {
  margin-left: auto;
  flex-shrink: 0;
}

.out-of-frame-editor__matting-btn {
  flex-shrink: 0;
  width: 132px;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 10px rgba(240, 160, 32, 0.38);
}

.out-of-frame-editor__matting-btn-label {
  display: inline-block;
  width: 5.5em;
  text-align: center;
}

.out-of-frame-editor__matting-btn:not(.n-button--disabled):hover {
  box-shadow: 0 4px 14px rgba(240, 160, 32, 0.48);
}

.out-of-frame-editor--touch .out-of-frame-editor__matting-btn-label {
  width: auto;
}

@media (min-width: 769px) {
  .out-of-frame-editor__toolbar-main {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }

  .out-of-frame-editor__tools-grid {
    flex: 1 1 280px;
    min-width: 0;
    gap: 6px;
  }

  .out-of-frame-editor:not(.out-of-frame-editor--mobile) .out-of-frame-editor__tool-btn {
    padding: 8px 14px;
    min-height: 38px;
    border-radius: 7px;
  }

  .out-of-frame-editor:not(.out-of-frame-editor--mobile) .out-of-frame-editor__tool-label {
    gap: 6px;
    font-size: 13px;
  }

  .out-of-frame-editor:not(.out-of-frame-editor--mobile)
    .out-of-frame-editor__tool-label
    :deep(.n-icon) {
    font-size: 17px !important;
  }

  .out-of-frame-editor:not(.out-of-frame-editor--mobile)
    .out-of-frame-editor__actions
    :deep(.n-button) {
    min-height: 38px;
    padding-inline: 14px;
    font-weight: 600;
  }

  .out-of-frame-editor__op-row {
    width: auto;
    flex: 0 0 auto;
    margin-left: auto;
  }
}

.out-of-frame-editor--mobile .out-of-frame-editor__tools-grid {
  flex-wrap: nowrap;
  gap: 4px;
}

.out-of-frame-editor--mobile .out-of-frame-editor__tool-btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 6px 2px;
  min-height: 42px;
}

.out-of-frame-editor--mobile .out-of-frame-editor__tool-label {
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  width: 100%;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
}

.out-of-frame-editor--mobile .out-of-frame-editor__tool-text {
  display: block;
  white-space: nowrap;
}

.out-of-frame-editor--mobile .out-of-frame-editor__tool-label :deep(.n-icon) {
  font-size: 16px !important;
}

.out-of-frame-editor--mobile .out-of-frame-editor__op-row {
  gap: 10px;
}

.out-of-frame-editor--mobile .out-of-frame-editor__op-row .out-of-frame-editor__matting-btn {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 40px;
}

.out-of-frame-editor--mobile .out-of-frame-editor__actions {
  margin-left: 0;
  flex-shrink: 0;
}

.out-of-frame-editor__brush,
.out-of-frame-editor__brush-opacity,
.out-of-frame-editor__brush-shape,
.out-of-frame-editor__brush-hardness,
.out-of-frame-editor__wand-mode,
.out-of-frame-editor__wand-tolerance,
.out-of-frame-editor__feather {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-color-2);
}

.out-of-frame-editor__zoom {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  flex: 1 1 100%;
  font-size: 13px;
  color: var(--text-color-2);
}

.out-of-frame-editor__zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.out-of-frame-editor__zoom-label {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  flex-shrink: 0;
}

.out-of-frame-editor__zoom-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-color-3);
}

.out-of-frame-editor__brush-shape :deep(.n-radio-button) {
  min-width: 52px;
  padding-inline: 8px;
}

.out-of-frame-editor__brush-hardness-slider,
.out-of-frame-editor__brush-opacity-slider,
.out-of-frame-editor__wand-tolerance-slider {
  width: 88px;
}

.out-of-frame-editor__brush-slider {
  width: 120px;
}

.out-of-frame-editor__feather-slider {
  width: 100px;
}

.out-of-frame-editor__zoom-slider {
  width: 100px;
}

.out-of-frame-editor--touch .out-of-frame-editor__brush-slider {
  flex: 1;
  min-width: 100px;
}

.out-of-frame-editor--touch .out-of-frame-editor__feather-slider {
  flex: 1;
  min-width: 80px;
}

.out-of-frame-editor__preload {
  display: flex;
  justify-content: center;
}

.out-of-frame-editor__preload-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(100%, 420px);
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, var(--border-color));
  background: color-mix(in srgb, var(--card-color) 88%, var(--primary-color) 12%);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.out-of-frame-editor__preload-pulse {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-color);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary-color) 45%, transparent);
  animation: out-of-frame-preload-pulse 1.6s ease-out infinite;
}

.out-of-frame-editor__preload-label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-1);
  letter-spacing: 0.02em;
}

.out-of-frame-editor__preload-track {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-color-3) 16%, transparent);
}

.out-of-frame-editor__preload-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--primary-color) 82%, #fff 18%),
    var(--primary-color)
  );
  transition: width 0.25s ease;
}

.out-of-frame-editor__preload-percent {
  flex-shrink: 0;
  min-width: 2.8em;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary-color);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

@keyframes out-of-frame-preload-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary-color) 42%, transparent);
  }
  70% {
    box-shadow: 0 0 0 8px transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

.out-of-frame-editor__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--body-color) 92%, #000 8%);
  overscroll-behavior: none;
  touch-action: none;
  overflow: hidden;
}

.out-of-frame-editor__viewport {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);
  background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 20px 20px;
  overscroll-behavior: none;
  touch-action: none;
}

.out-of-frame-editor__canvas-layer {
  flex-shrink: 0;
  transform-origin: center center;
  will-change: transform;
}

.out-of-frame-editor__canvas-wrap {
  position: relative;
  line-height: 0;
  background: repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 50% / 16px 16px;
}

.out-of-frame-editor__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.out-of-frame-editor__canvas--reference {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.out-of-frame-editor__canvas--preview {
  position: relative;
  z-index: 1;
}

.out-of-frame-editor__magnifier {
  position: absolute;
  z-index: 5;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
  box-sizing: border-box;
  border: 2px solid;
  background: color-mix(in srgb, var(--body-color) 92%, #000 8%);
}

.out-of-frame-editor__magnifier--erase {
  border-color: rgba(245, 108, 108, 0.9);
  box-shadow: 0 0 10px rgba(245, 108, 108, 0.28);
}

.out-of-frame-editor__magnifier--restore {
  border-color: rgba(103, 194, 58, 0.9);
  box-shadow: 0 0 10px rgba(103, 194, 58, 0.28);
}

.out-of-frame-editor__magnifier--feather {
  border-color: rgba(124, 58, 237, 0.9);
  border-style: dashed;
  box-shadow: 0 0 10px rgba(124, 58, 237, 0.22);
}

.out-of-frame-editor__magnifier--square {
  border-radius: 4px;
}

.out-of-frame-editor__magnifier--square .out-of-frame-editor__magnifier-canvas {
  border-radius: 2px;
}

.out-of-frame-editor__magnifier-canvas {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.out-of-frame-editor__canvas--brush,
.out-of-frame-editor__canvas--wand {
  cursor: crosshair;
}

.out-of-frame-editor__canvas--grab {
  cursor: grab;
}

.out-of-frame-editor__canvas--grabbing {
  cursor: grabbing;
}

.out-of-frame-editor__brush-ring {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  border-radius: 50%;
  border: 2px solid;
  box-sizing: border-box;
}

.out-of-frame-editor__brush-ring--erase {
  border-color: rgba(245, 108, 108, 0.9);
  background: rgba(245, 108, 108, 0.12);
}

.out-of-frame-editor__brush-ring--restore {
  border-color: rgba(103, 194, 58, 0.9);
  background: rgba(103, 194, 58, 0.12);
}

.out-of-frame-editor__brush-ring--feather {
  border-color: rgba(124, 58, 237, 0.9);
  background: rgba(124, 58, 237, 0.1);
  border-style: dashed;
}

.out-of-frame-editor__brush-ring--round {
  border-radius: 50%;
}

.out-of-frame-editor__brush-ring--soft {
  border-radius: 50%;
  border-width: 1.5px;
  filter: blur(0.2px);
}

.out-of-frame-editor__brush-ring--square {
  border-radius: 2px;
}

.out-of-frame-editor__overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(6px);
}

.out-of-frame-editor__overlay--matting {
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
}

.out-of-frame-editor__overlay--dark {
  background: rgba(10, 12, 16, 0.82);
}

.out-of-frame-editor__overlay--dark.out-of-frame-editor__overlay--matting {
  background: rgba(10, 12, 16, 0.9);
}

.out-of-frame-editor__loading {
  width: min(100%, 360px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 20px;
  border-radius: 14px;
  border: 1px solid #e2e6ed;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
}

.out-of-frame-editor__loading--dark {
  border-color: rgba(255, 255, 255, 0.1);
  background: #24262b;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.out-of-frame-editor__loading--matting {
  gap: 8px;
  padding: 16px 18px;
}

.out-of-frame-editor__loading-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.out-of-frame-editor__loading-title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 0.01em;
}

.out-of-frame-editor__loading--dark .out-of-frame-editor__loading-title {
  color: rgba(255, 255, 255, 0.92);
}

.out-of-frame-editor__loading--matting .out-of-frame-editor__loading-title {
  font-size: 15px;
}

.out-of-frame-editor__loading-percent {
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
  color: #2080f0;
  font-variant-numeric: tabular-nums;
}

.out-of-frame-editor__loading--dark .out-of-frame-editor__loading-percent {
  color: #63a4ff;
}

.out-of-frame-editor__loading--matting .out-of-frame-editor__loading-percent {
  font-size: 20px;
}

.out-of-frame-editor__loading-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e8eaef;
}

.out-of-frame-editor__loading--dark .out-of-frame-editor__loading-track {
  background: rgba(255, 255, 255, 0.12);
}

.out-of-frame-editor__loading--matting .out-of-frame-editor__loading-track {
  height: 9px;
}

.out-of-frame-editor__loading-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5cadff, #2080f0);
  transition: width 0.28s ease;
}

.out-of-frame-editor__loading-fill--active {
  background-size: 200% 100%;
  animation: out-of-frame-loading-shimmer 1.4s linear infinite;
  background-image: linear-gradient(90deg, #7ec0ff 0%, #2080f0 45%, #7ec0ff 90%);
}

.out-of-frame-editor__loading--dark .out-of-frame-editor__loading-fill {
  background: linear-gradient(90deg, #7eb8ff, #4a9eff);
}

.out-of-frame-editor__loading--dark .out-of-frame-editor__loading-fill--active {
  background-image: linear-gradient(90deg, #9ccaff 0%, #4a9eff 45%, #9ccaff 90%);
}

.out-of-frame-editor__loading-detail {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  color: #1a1a1a;
  background: #f4f6fa;
  border: 1px solid #e2e6ed;
}

.out-of-frame-editor__loading--dark .out-of-frame-editor__loading-detail {
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.out-of-frame-editor__loading--matting .out-of-frame-editor__loading-detail {
  font-size: 13px;
}

.out-of-frame-editor__loading-step {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
}

.out-of-frame-editor__loading--dark .out-of-frame-editor__loading-step {
  color: rgba(255, 255, 255, 0.52);
}

.out-of-frame-editor__loading--matting .out-of-frame-editor__loading-step {
  font-size: 12px;
}

@keyframes out-of-frame-loading-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.out-of-frame-editor__hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.out-of-frame-editor__hint-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.out-of-frame-editor__hint-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.35;
  color: var(--text-color-2);
  background: color-mix(in srgb, var(--text-color-3) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
}

.out-of-frame-editor__hint-chip strong {
  font-weight: 700;
  color: var(--text-color-1);
}

.out-of-frame-editor__hint-chip--erase strong {
  color: #e85d5d;
}

.out-of-frame-editor__hint-chip--restore strong {
  color: #5daf34;
}

.out-of-frame-editor__hint-chip--feather strong {
  color: #7c3aed;
}

.out-of-frame-editor__hint-chip--wand strong {
  color: #d97706;
}

.out-of-frame-editor__hint-chip--pan strong {
  color: #2080f0;
}

.out-of-frame-editor__hint-chip--zoom {
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  border-color: color-mix(in srgb, #f59e0b 32%, var(--border-color));
}

.out-of-frame-editor__hint-chip--zoom strong {
  color: #d97706;
}

.out-of-frame-editor__hint-chip--zoom .out-of-frame-editor__shortcut {
  color: color-mix(in srgb, #b45309 55%, var(--text-color-2));
}

.out-of-frame-editor__hint-chip--zoom kbd {
  border-color: color-mix(in srgb, #f59e0b 40%, var(--border-color));
  background: color-mix(in srgb, #f59e0b 14%, var(--body-color));
  color: #b45309;
}

.out-of-frame-editor__hint-chip--nav {
  background: color-mix(in srgb, #2080f0 14%, transparent);
  border-color: color-mix(in srgb, #2080f0 32%, var(--border-color));
}

.out-of-frame-editor__hint-chip--nav strong {
  color: #2080f0;
}

.out-of-frame-editor__hint-chip--nav .out-of-frame-editor__shortcut {
  color: color-mix(in srgb, #1860c0 50%, var(--text-color-2));
}

.out-of-frame-editor__hint-chip--canvas {
  background: color-mix(in srgb, #7c3aed 12%, transparent);
  border-color: color-mix(in srgb, #7c3aed 30%, var(--border-color));
}

.out-of-frame-editor__hint-chip--canvas strong {
  color: #7c3aed;
}

.out-of-frame-editor__hint-chip--canvas .out-of-frame-editor__shortcut {
  color: color-mix(in srgb, #6d28d9 50%, var(--text-color-2));
}

.out-of-frame-editor__shortcut {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.84em;
  font-weight: 500;
  line-height: 1.2;
  color: var(--text-color-3);
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.out-of-frame-editor__shortcut kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.45em;
  height: 1.5em;
  padding: 0 0.35em;
  font-family: inherit;
  font-size: 0.95em;
  font-weight: 600;
  line-height: 1;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--border-color) 90%, transparent);
  background: color-mix(in srgb, var(--body-color) 88%, var(--text-color-3) 12%);
  color: var(--text-color-2);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--border-color) 70%, transparent);
}

.out-of-frame-editor__hint-chip .out-of-frame-editor__shortcut {
  margin-left: 2px;
}

.out-of-frame-editor__hint-extra {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-color-3);
  text-align: center;
}

.out-of-frame-editor__header-actions :deep(.n-space) {
  gap: 8px !important;
}

.out-of-frame-editor__header-actions :deep(.n-button) {
  min-width: 72px;
  padding-inline: 16px;
  font-weight: 600;
}

@media (min-width: 769px) {
  .out-of-frame-editor__header-actions :deep(.n-button) {
    min-width: 104px;
    padding-inline: 22px;
  }
}

.out-of-frame-editor--mobile .out-of-frame-editor__toolbar {
  gap: 10px;
}

.out-of-frame-editor--mobile .out-of-frame-editor__toolbar-row--sliders {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  font-size: 14px;
}

.out-of-frame-editor--mobile .out-of-frame-editor__toolbar-row--sliders > * {
  width: 100%;
  min-width: 0;
}

.out-of-frame-editor--mobile .out-of-frame-editor__brush,
.out-of-frame-editor--mobile .out-of-frame-editor__brush-opacity,
.out-of-frame-editor--mobile .out-of-frame-editor__brush-shape,
.out-of-frame-editor--mobile .out-of-frame-editor__brush-hardness,
.out-of-frame-editor--mobile .out-of-frame-editor__wand-mode,
.out-of-frame-editor--mobile .out-of-frame-editor__wand-tolerance,
.out-of-frame-editor--mobile .out-of-frame-editor__feather,
.out-of-frame-editor--mobile .out-of-frame-editor__zoom {
  flex-wrap: nowrap;
}

.out-of-frame-editor--mobile .out-of-frame-editor__zoom-controls {
  flex-wrap: wrap;
  width: 100%;
}

.out-of-frame-editor--mobile .out-of-frame-editor__zoom-note {
  font-size: 12px;
}

.out-of-frame-editor--mobile .out-of-frame-editor__brush-shape :deep(.n-radio-group),
.out-of-frame-editor--mobile .out-of-frame-editor__wand-mode :deep(.n-radio-group) {
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.out-of-frame-editor--mobile .out-of-frame-editor__brush-slider,
.out-of-frame-editor--mobile .out-of-frame-editor__zoom-controls .out-of-frame-editor__zoom-slider,
.out-of-frame-editor--mobile .out-of-frame-editor__feather-slider,
.out-of-frame-editor--mobile .out-of-frame-editor__brush-hardness-slider,
.out-of-frame-editor--mobile .out-of-frame-editor__brush-opacity-slider,
.out-of-frame-editor--mobile .out-of-frame-editor__wand-tolerance-slider {
  flex: 1;
  width: auto;
  min-width: 0;
}

:global(.out-of-frame-modal .n-card) {
  max-height: var(--app-overlay-max-height);
  display: flex;
  flex-direction: column;
}

:global(.out-of-frame-modal .n-card__content) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

:global(.out-of-frame-modal .n-card-header) {
  flex-shrink: 0;
  align-items: center;
}

:global(.out-of-frame-modal .n-card-header__extra) {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  :global(.out-of-frame-modal .n-card) {
    max-height: var(--app-overlay-max-height);
  }
}
</style>
