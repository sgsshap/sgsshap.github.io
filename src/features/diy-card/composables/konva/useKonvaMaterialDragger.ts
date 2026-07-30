import { scheduleFloatPreviewLiveRefresh } from '@/features/diy-card/composables/preview/floatPreviewLiveRefresh'
import {
  beginKonvaDragPerf,
  endKonvaDragPerf,
  setKonvaDragSubtreePerf,
} from '@/features/diy-card/composables/konva/konvaDragPerf'
import { ensureKonvaFilterImageCacheInSubtree } from '@/features/diy-card/composables/konva/konvaCache'
import {
  applyStageEdgeSnap,
  clearStageEdgeSnapGuides,
  getNodeBox,
  isAxisFilledSpan,
  resolveCanvasEdgeBoundsFromDiy,
  resolveStageContentOriginFromDiy,
  getStageEdgeProximity,
  STAGE_EDGE_SNAP_RELEASE_THRESHOLD,
  STAGE_EDGE_SNAP_THRESHOLD,
  type StageEdgeSnapState,
  updateStageEdgeSnapGuides,
} from '@/features/diy-card/composables/konva/konvaStageEdgeSnap'
import { resolveKingdomLayoutItem } from '@/features/diy-card/composables/doubleKingdom'
import { useDiyStore, useDiyHistoryStore, useInfoStore } from '@/features/diy-card/stores'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { findCustomMaterial } from '@/features/diy-card/utils/customMaterial'
import { record } from '@/features/diy-card/utils/diyHistoryRecord'
import {
  isNameSplitCharCode,
  resolveNameLayoutItem,
  syncSplitCharAnchorFromBox,
} from '@/features/diy-card/utils/nameSplit'
import { isTouchDevice } from '@/shared/utils/naive/touchDevice'
import Konva from 'konva'

const MOBILE_LONG_PRESS_DELAY = 450
const MOBILE_LONG_PRESS_MOVE_TOLERANCE = 8

const SNAP_EDGES: (keyof StageEdgeSnapState)[] = ['left', 'right', 'top', 'bottom']

const createEmptySnapLocks = (): StageEdgeSnapState => ({
  left: false,
  right: false,
  top: false,
  bottom: false,
})

const edgeDistance = (
  box: ReturnType<typeof getNodeBox>,
  bounds: ReturnType<typeof resolveCanvasEdgeBoundsFromDiy>,
  edge: keyof StageEdgeSnapState,
) => {
  switch (edge) {
    case 'left':
      return Math.abs(box.originX - bounds.left)
    case 'right':
      return Math.abs(box.originX + box.width - bounds.right)
    case 'top':
      return Math.abs(box.originY - bounds.top)
    case 'bottom':
      return Math.abs(box.originY + box.height - bounds.bottom)
  }
}

/** 根据拖拽中的原始位置（吸附修正前）判断是否解除贴边锁定 */
const releaseSnapLocks = (
  locks: StageEdgeSnapState,
  box: ReturnType<typeof getNodeBox>,
  bounds: ReturnType<typeof resolveCanvasEdgeBoundsFromDiy>,
  axisDelta: { axisDeltaX: number; axisDeltaY: number },
): StageEdgeSnapState => {
  const next = { ...locks }
  const horizontalDominant =
    Math.abs(axisDelta.axisDeltaX) > Math.abs(axisDelta.axisDeltaY) + 2
  const verticalDominant =
    Math.abs(axisDelta.axisDeltaY) > Math.abs(axisDelta.axisDeltaX) + 2
  const fillsY = isAxisFilledSpan(box.height, bounds.top, bounds.bottom)
  const fillsX = isAxisFilledSpan(box.width, bounds.left, bounds.right)

  if (fillsY && (next.top || next.bottom)) {
    const distTop = edgeDistance(box, bounds, 'top')
    const distBottom = edgeDistance(box, bounds, 'bottom')
    const inSnapZone =
      distTop <= STAGE_EDGE_SNAP_THRESHOLD || distBottom <= STAGE_EDGE_SNAP_THRESHOLD
    const shouldRelease =
      distTop > STAGE_EDGE_SNAP_RELEASE_THRESHOLD &&
      distBottom > STAGE_EDGE_SNAP_RELEASE_THRESHOLD
    if (shouldRelease && !inSnapZone) {
      next.top = false
      next.bottom = false
    }
  }

  if (fillsX && (next.left || next.right)) {
    const distLeft = edgeDistance(box, bounds, 'left')
    const distRight = edgeDistance(box, bounds, 'right')
    const inSnapZone =
      distLeft <= STAGE_EDGE_SNAP_THRESHOLD || distRight <= STAGE_EDGE_SNAP_THRESHOLD
    const shouldRelease =
      distLeft > STAGE_EDGE_SNAP_RELEASE_THRESHOLD &&
      distRight > STAGE_EDGE_SNAP_RELEASE_THRESHOLD
    if (shouldRelease && !inSnapZone) {
      next.left = false
      next.right = false
    }
  }

  for (const edge of SNAP_EDGES) {
    if (!next[edge]) continue
    if ((edge === 'top' || edge === 'bottom') && fillsY) continue
    if ((edge === 'left' || edge === 'right') && fillsX) continue

    const releaseOppositeOnSameAxis =
      (edge === 'left' && next.right) ||
      (edge === 'right' && next.left) ||
      (edge === 'top' && next.bottom) ||
      (edge === 'bottom' && next.top)

    if (
      (edge === 'left' || edge === 'right') &&
      horizontalDominant &&
      (next.top || next.bottom) &&
      edgeDistance(box, bounds, edge) > STAGE_EDGE_SNAP_THRESHOLD
    ) {
      next[edge] = false
      continue
    }
    if (
      (edge === 'top' || edge === 'bottom') &&
      verticalDominant &&
      (next.left || next.right) &&
      edgeDistance(box, bounds, edge) > STAGE_EDGE_SNAP_THRESHOLD
    ) {
      next[edge] = false
      continue
    }

    if (edgeDistance(box, bounds, edge) > STAGE_EDGE_SNAP_RELEASE_THRESHOLD) {
      next[edge] = false
      continue
    }

    if (releaseOppositeOnSameAxis) {
      next[edge] = false
    }
  }
  return next
}

const acquireSnapLocks = (
  locks: StageEdgeSnapState,
  snapped: StageEdgeSnapState,
): StageEdgeSnapState => {
  const next = { ...locks }
  for (const edge of SNAP_EDGES) {
    if (snapped[edge]) next[edge] = true
  }
  return next
}

/** 触摸主输入时走长按拖拽，键鼠桌面（含 Win11 混合设备）直接 draggable */
const prefersTouchLongPressDrag = () => isTouchDevice()

const resolveMaterialLayoutItem = (info: LegendInfo, materialCode: string) => {
  const items = info.renderConfig.items as Record<string, LayoutItem>
  return (
    resolveNameLayoutItem(info, materialCode) ??
    resolveKingdomLayoutItem(info, materialCode) ??
    findCustomMaterial(info, materialCode) ??
    items[materialCode]
  )
}

/** useKonvaMaterialDragger 入参 */
export interface KonvaMaterialDraggerOptions {
  /** 开始拖拽时选中图层（通常触发 emit('click', code)） */
  onDragSelect: (code: string) => void
  /** 拖拽结束后落库布局（写回 renderConfig）并刷新 Konva */
  syncMaterialLayout: (materialCode: string) => void
}

/**
 * 可编辑图层拖拽
 *
 * - 键鼠桌面：`draggable: true`，dragstart/dragend（Win11 混合设备不因 Touch API 误判）
 * - 触摸主输入：长按约 450ms 后启用拖拽，移动超过容差取消长按
 * - `editable.snapToStageEdge`：拖拽时吸附画布边缘并显示参考线（边界随当前画布尺寸/出血实时计算）
 *
 * 仅当 `renderObj.editable.movable` 为 true 时返回事件配置。
 */
export function useKonvaMaterialDragger(options: KonvaMaterialDraggerOptions) {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const { onDragSelect, syncMaterialLayout } = options
  const dragLongPressTimers: Record<string, ReturnType<typeof globalThis.setTimeout> | undefined> =
    {}
  const dragLongPressStartPointMap: Record<string, { x: number; y: number } | undefined> = {}
  /** 拖拽起点包围盒，用于判断吸附方向 */
  const dragSnapStartBoxMap: Record<string, { originX: number; originY: number } | undefined> = {}
  /** 贴边锁定：沿边缘滑动时保持该边对齐，避免 cover 大图抖动 */
  const dragSnapLockMap: Record<string, StageEdgeSnapState | undefined> = {}
  /** 合并同帧多次 dragmove 的吸附计算，减轻 iOS 每帧整树遍历 */
  const dragMoveFrameMap: Record<string, number | undefined> = {}
  let dragFloatPreviewRefreshRaf = 0

  const scheduleDragFloatPreviewRefresh = () => {
    if (dragFloatPreviewRefreshRaf) return
    dragFloatPreviewRefreshRaf = globalThis.requestAnimationFrame(() => {
      dragFloatPreviewRefreshRaf = 0
      scheduleFloatPreviewLiveRefresh()
    })
  }

  const scheduleEdgeSnapDrag = (
    node: Konva.Node,
    renderObj: LayoutItem,
    code: string,
  ) => {
    const prev = dragMoveFrameMap[code]
    if (prev) cancelAnimationFrame(prev)
    dragMoveFrameMap[code] = requestAnimationFrame(() => {
      dragMoveFrameMap[code] = undefined
      handleEdgeSnapDrag(node, renderObj, code)
    })
  }

  const shouldSnapToStageEdge = (renderObj: LayoutItem) =>
    Boolean(renderObj.editable?.snapToStageEdge && renderObj.rotation === 0)

  const resolveDragAxisDelta = (code: string, node: Konva.Node) => {
    const start = dragSnapStartBoxMap[code]
    if (!start) return { axisDeltaX: 0, axisDeltaY: 0 }
    const box = getNodeBox(node)
    return {
      axisDeltaX: box.originX - start.originX,
      axisDeltaY: box.originY - start.originY,
    }
  }

  const handleEdgeSnapDrag = (node: Konva.Node, renderObj: LayoutItem, code: string) => {
    if (!shouldSnapToStageEdge(renderObj)) {
      clearStageEdgeSnapGuides(node.getStage())
      return
    }
    const canvasBounds = resolveCanvasEdgeBoundsFromDiy(diyStore)
    const stage = node.getStage()
    const rawBox = getNodeBox(node)
    const axisDelta = resolveDragAxisDelta(code, node)
    const locks = dragSnapLockMap[code] ?? createEmptySnapLocks()
    // 须用吸附前的原始位置判断解锁：锁定边会把节点拉回边缘，导致距离永远小于释放阈值
    const releasedLocks = releaseSnapLocks(locks, rawBox, canvasBounds, axisDelta)
    const snapped = applyStageEdgeSnap(node, canvasBounds, {
      ...axisDelta,
      lockedEdges: releasedLocks,
    })
    dragSnapLockMap[code] = acquireSnapLocks(releasedLocks, snapped)
    const proximity = getStageEdgeProximity(node, canvasBounds)
    updateStageEdgeSnapGuides(stage, canvasBounds, proximity, snapped, node)
  }

  /**
   * 为可移动图层生成 Konva 拖拽 / 触摸事件配置
   * @param renderObj 图层布局配置
   * @param code 图层 code
   */
  const getDragger = (renderObj: LayoutItem, code: string) => {
    if (!renderObj.editable?.movable) return {}
    const getContainerNode = (e: Konva.KonvaEventObject<DragEvent | TouchEvent>) =>
      (e.currentTarget || e.target) as Konva.Node
    const getTouchPoint = (event: TouchEvent) => {
      const touch = event.touches?.[0] || event.changedTouches?.[0]
      if (!touch) return undefined
      return { x: touch.clientX, y: touch.clientY }
    }

    const clearLongPressTimer = () => {
      const timer = dragLongPressTimers[code]
      if (timer) {
        clearTimeout(timer)
        dragLongPressTimers[code] = undefined
      }
      dragLongPressStartPointMap[code] = undefined
    }

    const finishDrag = (node: Konva.Node) => {
      clearStageEdgeSnapGuides(node.getStage())
      const canvasBounds = resolveCanvasEdgeBoundsFromDiy(diyStore)
      const contentOrigin = resolveStageContentOriginFromDiy(diyStore)
      if (shouldSnapToStageEdge(renderObj)) {
        const locks = dragSnapLockMap[code] ?? createEmptySnapLocks()
        const axisDelta = resolveDragAxisDelta(code, node)
        const releasedLocks = releaseSnapLocks(locks, getNodeBox(node), canvasBounds, axisDelta)
        applyStageEdgeSnap(node, canvasBounds, {
          ...axisDelta,
          lockedEdges: releasedLocks,
        })
      }
      dragSnapStartBoxMap[code] = undefined
      dragSnapLockMap[code] = undefined
      const { originX, originY } = getNodeBox(node)
      if (prefersTouchLongPressDrag()) {
        node.draggable(false)
      }
      requestAnimationFrame(() => {
        const mmToPx = diyStore.mmToPx
        const liveInfo = infoStore.info as LegendInfo
        const liveRenderObj = resolveMaterialLayoutItem(liveInfo, code)
        if (!liveRenderObj) return
        liveRenderObj.x = Number(((originX - contentOrigin.x) / mmToPx).toFixed(2))
        liveRenderObj.y = Number(((originY - contentOrigin.y) / mmToPx).toFixed(2))
        if (isNameSplitCharCode(code)) {
          syncSplitCharAnchorFromBox(liveRenderObj)
        }
        syncMaterialLayout(code)
        scheduleFloatPreviewLiveRefresh()
        record({ operation: 'move', itemName: liveRenderObj.name })
        const historyStore = useDiyHistoryStore()
        if (historyStore.bootstrappedKinds[historyStore.activeInfoKind]) {
          historyStore.syncLayoutSnapshotNow()
          void historyStore.persistNow()
        }
      })
    }

    return {
      draggable: !prefersTouchLongPressDrag(),
      onDragstart: (e: Konva.KonvaEventObject<DragEvent>) => {
        beginKonvaDragPerf()
        const node = getContainerNode(e)
        ensureKonvaFilterImageCacheInSubtree(node)
        setKonvaDragSubtreePerf(node, true)
        const box = getNodeBox(node)
        dragSnapStartBoxMap[code] = { originX: box.originX, originY: box.originY }
        dragSnapLockMap[code] = createEmptySnapLocks()
        onDragSelect(code)
      },
      onDragmove: (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = getContainerNode(e)
        scheduleDragFloatPreviewRefresh()
        if (shouldSnapToStageEdge(renderObj)) {
          scheduleEdgeSnapDrag(node, renderObj, code)
        }
      },
      onDragend: (e: Konva.KonvaEventObject<DragEvent>) => {
        const pending = dragMoveFrameMap[code]
        if (pending) {
          cancelAnimationFrame(pending)
          dragMoveFrameMap[code] = undefined
        }
        clearLongPressTimer()
        const node = getContainerNode(e)
        setKonvaDragSubtreePerf(node, false)
        endKonvaDragPerf()
        finishDrag(node)
      },
      onTouchstart: (e: Konva.KonvaEventObject<TouchEvent>) => {
        if (!prefersTouchLongPressDrag()) return
        clearLongPressTimer()
        const node = getContainerNode(e)
        dragLongPressTimers[code] = globalThis.setTimeout(() => {
          node.draggable(true)
          node.startDrag()
        }, MOBILE_LONG_PRESS_DELAY)
        dragLongPressStartPointMap[code] = getTouchPoint(e.evt)
      },
      onTouchmove: (e: Konva.KonvaEventObject<TouchEvent>) => {
        if (!prefersTouchLongPressDrag()) return
        const startPoint = dragLongPressStartPointMap[code]
        if (!startPoint || !dragLongPressTimers[code]) return
        const currentPoint = getTouchPoint(e.evt)
        if (!currentPoint) return
        const offsetX = currentPoint.x - startPoint.x
        const offsetY = currentPoint.y - startPoint.y
        const moveDistance = Math.hypot(offsetX, offsetY)
        if (moveDistance > MOBILE_LONG_PRESS_MOVE_TOLERANCE) {
          clearLongPressTimer()
        }
      },
      onTouchend: () => {
        if (!prefersTouchLongPressDrag()) return
        clearLongPressTimer()
      },
      onTouchcancel: () => {
        if (!prefersTouchLongPressDrag()) return
        clearLongPressTimer()
      },
    }
  }

  return { getDragger }
}
