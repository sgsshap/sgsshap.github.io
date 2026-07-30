import Konva from 'konva'

/** 吸附判定距离（px）；仅当元素边进入该范围时才贴齐画布边缘 */
export const STAGE_EDGE_SNAP_THRESHOLD = 5

/** 贴边后需拖离更远才解除（防止沿边缘滑动时抖动） */
export const STAGE_EDGE_SNAP_RELEASE_THRESHOLD = STAGE_EDGE_SNAP_THRESHOLD + 6

const SNAP_GUIDE_LAYER_NAME = 'diy-snap-guides'

/**
 * 吸附提示配色
 * - 靠近：琥珀色虚线 + 边中点短刻度
 * - 已贴边：绿色加粗对齐线 + 边中点圆点（不改动图片本身）
 */
const SNAP_NEAR_COLOR = '#fbbf24'
const SNAP_LOCKED_COLOR = '#22c55e'
const SNAP_LOCKED_FILL = 'rgba(34, 197, 94, 0.2)'
const SNAP_LOCKED_GLOW = '#ffffff'

export interface StageContentBounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** mm 坐标原点（px），与 DiyPreview canvasOrigin / mergeConfig origin 一致 */
export const resolveStageContentOriginFromDiy = (diyStore: { innerStageBleed: number }) => ({
  x: diyStore.innerStageBleed,
  y: diyStore.innerStageBleed,
})

export interface StageEdgeSnapState {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

export const createStageContentBounds = (
  stageOrigin: { x: number; y: number },
  stageWidth: number,
  stageHeight: number,
): StageContentBounds => ({
  left: stageOrigin.x,
  top: stageOrigin.y,
  right: stageOrigin.x + stageWidth,
  bottom: stageOrigin.y + stageHeight,
})

/** 画布内容区边界（成品区 trim，与 mm 布局原点 innerStageBleed 一致） */
export const resolveStageContentBoundsFromDiy = (diyStore: {
  innerStageBleed: number
  stageConfig: { width: number; height: number }
}) => {
  const origin = resolveStageContentOriginFromDiy(diyStore)
  return createStageContentBounds(origin, diyStore.stageConfig.width, diyStore.stageConfig.height)
}

/**
 * 画布边缘吸附边界（Konva Stage 外缘，即 finalStageConfig）。
 * 开启出血时贴齐画布外缘，而非成品区红色虚线框（stageConfig + innerStageBleed）。
 */
export const resolveCanvasEdgeBoundsFromDiy = (diyStore: {
  finalStageConfig: { width: number; height: number }
}) =>
  createStageContentBounds({ x: 0, y: 0 }, diyStore.finalStageConfig.width, diyStore.finalStageConfig.height)

/** 根据画布尺寸微调提示线粗细（大图略粗、小图略细） */
export const resolveSnapGuideMetrics = (bounds: StageContentBounds) => {
  const contentWidth = bounds.right - bounds.left
  const contentHeight = bounds.bottom - bounds.top
  const minSide = Math.min(contentWidth, contentHeight)
  const scale = Math.min(1.35, Math.max(0.85, minSide / 520))
  return {
    bracketArm: Math.round(16 * scale),
    nearStroke: Math.max(2, 2.2 * scale),
    lockedStroke: Math.max(3.5, 3.8 * scale),
    alignTickHalf: Math.round(14 * scale),
    markerRadius: Math.max(5, 4.5 * scale),
  }
}

let snapGuideMetrics = resolveSnapGuideMetrics({
  left: 0,
  top: 0,
  right: 520,
  bottom: 740,
})

/**
 * 节点在 Stage 坐标系下的布局包围盒（px）
 * - 中心锚点（offset）：用 x/y 反推未旋转矩形的 origin，与 mergeConfig / 拖拽落库一致
 * - 旋转时不可用 getClientRect（会得到 AABB，落库后拖拽跟手变差）
 * - Group：子节点阴影/描边会让 getClientRect 偏大
 */
export const getNodeBox = (node: Konva.Node) => {
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  const width = node.width() * scaleX
  const height = node.height() * scaleY
  const useLayoutBox =
    node.getType() === 'Group' ||
    (width > 0 && height > 0 && (node.offsetX() !== 0 || node.offsetY() !== 0))

  if (useLayoutBox) {
    return {
      originX: node.x() - node.offsetX() * scaleX,
      originY: node.y() - node.offsetY() * scaleY,
      width,
      height,
    }
  }

  const stage = node.getStage()
  if (stage) {
    const rect = node.getClientRect({ relativeTo: stage, skipShadow: true })
    if (rect.width > 0 && rect.height > 0) {
      return {
        originX: rect.x,
        originY: rect.y,
        width: rect.width,
        height: rect.height,
      }
    }
  }

  return {
    originX: node.x() - node.offsetX() * scaleX,
    originY: node.y() - node.offsetY() * scaleY,
    width,
    height,
  }
}

const setNodePositionFromOrigin = (node: Konva.Node, originX: number, originY: number) => {
  node.position({
    x: originX + node.offsetX() * node.scaleX(),
    y: originY + node.offsetY() * node.scaleY(),
  })
}

export interface StageEdgeSnapOptions {
  threshold?: number
  /** 本次拖拽起点相对位移（px），用于 cover 大图同时靠近上下边时判断吸哪一侧 */
  axisDeltaX?: number
  axisDeltaY?: number
  /** 拖拽过程已锁定的边（沿边缘滑动时保持该轴贴边） */
  lockedEdges?: StageEdgeSnapState
}

/** 元素在该轴上是否铺满或超出画布（如 cover 自适应后的武将图；含 mm↔px 换算误差容差） */
export const isAxisFilledSpan = (size: number, boundMin: number, boundMax: number) => {
  const span = boundMax - boundMin
  return size >= span - STAGE_EDGE_SNAP_THRESHOLD
}

const fillsAxisSpan = isAxisFilledSpan

type AxisSnapInput = {
  origin: number
  size: number
  boundMin: number
  boundMax: number
  threshold: number
  axisDelta?: number
}

type AxisSnapResult = {
  nextOrigin: number
  snappedMin: boolean
  snappedMax: boolean
}

const buildAxisSnapResult = (
  nextOrigin: number,
  snappedMin: boolean,
  snappedMax: boolean,
): AxisSnapResult => ({ nextOrigin, snappedMin, snappedMax })

const SNAP_ALIGN_EPSILON = 0.5

/** 元素该轴尺寸是否与画布同高/同宽（cover 自适应后高度贴齐画布） */
const exactlyFillsAxisSpan = (size: number, boundMin: number, boundMax: number) =>
  Math.abs(size - (boundMax - boundMin)) <= SNAP_ALIGN_EPSILON

const isAlignedToMin = (origin: number, boundMin: number) =>
  Math.abs(origin - boundMin) <= SNAP_ALIGN_EPSILON

const isAlignedToMax = (origin: number, size: number, boundMax: number) =>
  Math.abs(origin + size - boundMax) <= SNAP_ALIGN_EPSILON

/**
 * cover 轴贴边状态：
 * - 尺寸刚好等于画布：贴一边即上下/左右同时亮
 * - 超出画布：只亮实际贴齐的那一边
 */
const resolveFilledSpanSnapState = (
  nextOrigin: number,
  size: number,
  boundMin: number,
  boundMax: number,
  canSnapMin: boolean,
  canSnapMax: boolean,
): Pick<AxisSnapResult, 'snappedMin' | 'snappedMax'> => {
  if (!canSnapMin && !canSnapMax) {
    return { snappedMin: false, snappedMax: false }
  }
  if (exactlyFillsAxisSpan(size, boundMin, boundMax)) {
    return { snappedMin: true, snappedMax: true }
  }
  return {
    snappedMin: isAlignedToMin(nextOrigin, boundMin),
    snappedMax: isAlignedToMax(nextOrigin, size, boundMax),
  }
}

const resolveFilledSpanSnapOrigin = (
  origin: number,
  size: number,
  boundMin: number,
  boundMax: number,
  canSnapMin: boolean,
  canSnapMax: boolean,
  distMin: number,
  distMax: number,
  /** 正=向 max 侧缘移动（X 向右 / Y 向下） */
  axisDelta: number,
) => {
  if (exactlyFillsAxisSpan(size, boundMin, boundMax) && (canSnapMin || canSnapMax)) {
    return boundMin
  }
  if (canSnapMin && canSnapMax) {
    if (axisDelta > 0.5) return boundMax - size
    if (axisDelta < -0.5) return boundMin
    if (isAlignedToMin(origin, boundMin)) return boundMin
    if (isAlignedToMax(origin, size, boundMax)) return boundMax - size
    if (distMax < distMin - 0.5) return boundMax - size
    if (distMin < distMax - 0.5) return boundMin
    return origin
  }
  if (canSnapMax) return boundMax - size
  if (canSnapMin) return boundMin
  return origin
}

/** cover 大图可移动区间 [boundMax - size, boundMin] */
const clampAxisOrigin = (origin: number, size: number, boundMin: number, boundMax: number) =>
  Math.min(boundMin, Math.max(boundMax - size, origin))

const resolveDualEdgeSnapOrigin = (
  origin: number,
  size: number,
  boundMin: number,
  boundMax: number,
  distMin: number,
  distMax: number,
  axisDelta: number,
) => {
  if (axisDelta > 0.5) return boundMax - size
  if (axisDelta < -0.5) return boundMin
  if (isAlignedToMin(origin, boundMin)) return boundMin
  if (isAlignedToMax(origin, size, boundMax)) return boundMax - size
  if (distMax < distMin - 0.5) return boundMax - size
  if (distMin < distMax - 0.5) return boundMin
  return origin
}

/**
 * 单轴吸附
 * - 铺满/超出该轴（cover 武将图）：按移动方向吸一侧；仅当尺寸刚好等于画布时标记双边贴齐
 * - 未铺满：只吸附距离更近的一侧
 */
const snapOnAxis = ({
  origin,
  size,
  boundMin,
  boundMax,
  threshold,
  axisDelta = 0,
}: AxisSnapInput): AxisSnapResult => {
  const distMin = Math.abs(origin - boundMin)
  const distMax = Math.abs(origin + size - boundMax)
  const canSnapMin = distMin <= threshold
  const canSnapMax = distMax <= threshold

  if (!canSnapMin && !canSnapMax) {
    return buildAxisSnapResult(origin, false, false)
  }

  if (fillsAxisSpan(size, boundMin, boundMax)) {
    const nextOrigin = clampAxisOrigin(
      resolveFilledSpanSnapOrigin(
        origin,
        size,
        boundMin,
        boundMax,
        canSnapMin,
        canSnapMax,
        distMin,
        distMax,
        axisDelta,
      ),
      size,
      boundMin,
      boundMax,
    )
    const filledSpanState = resolveFilledSpanSnapState(
      nextOrigin,
      size,
      boundMin,
      boundMax,
      canSnapMin,
      canSnapMax,
    )
    return buildAxisSnapResult(nextOrigin, filledSpanState.snappedMin, filledSpanState.snappedMax)
  }

  if (canSnapMin && canSnapMax) {
    const nextOrigin = resolveDualEdgeSnapOrigin(
      origin,
      size,
      boundMin,
      boundMax,
      distMin,
      distMax,
      axisDelta,
    )
    const snappedMax = nextOrigin + size >= boundMax - 0.5
    return buildAxisSnapResult(nextOrigin, !snappedMax, snappedMax)
  }

  if (canSnapMax) {
    return buildAxisSnapResult(boundMax - size, false, true)
  }

  return buildAxisSnapResult(boundMin, true, false)
}

type AxisEdgeKeys = { min: keyof StageEdgeSnapState; max: keyof StageEdgeSnapState }

const applyFilledOrLockedAxisSnap = ({
  origin,
  size,
  boundMin,
  boundMax,
  threshold,
  axisDelta,
  snap,
  locked,
  edgeKeys,
}: {
  origin: number
  size: number
  boundMin: number
  boundMax: number
  threshold: number
  axisDelta: number
  snap: AxisSnapResult
  locked?: StageEdgeSnapState
  edgeKeys: AxisEdgeKeys
}): AxisSnapResult => {
  const distMin = Math.abs(origin - boundMin)
  const distMax = Math.abs(origin + size - boundMax)
  const canSnapMin = distMin <= threshold
  const canSnapMax = distMax <= threshold
  const lockedMin = Boolean(locked?.[edgeKeys.min])
  const lockedMax = Boolean(locked?.[edgeKeys.max])
  const fillsSpan = fillsAxisSpan(size, boundMin, boundMax)

  if (fillsSpan) {
    const inSnapZone = canSnapMin || canSnapMax || lockedMin || lockedMax
    if (!inSnapZone) {
      return buildAxisSnapResult(origin, false, false)
    }

    const nextOrigin = clampAxisOrigin(
      resolveFilledSpanSnapOrigin(
        origin,
        size,
        boundMin,
        boundMax,
        canSnapMin || lockedMin,
        canSnapMax || lockedMax,
        distMin,
        distMax,
        axisDelta,
      ),
      size,
      boundMin,
      boundMax,
    )
    const filledSpanState = resolveFilledSpanSnapState(
      nextOrigin,
      size,
      boundMin,
      boundMax,
      canSnapMin || lockedMin,
      canSnapMax || lockedMax,
    )
    return buildAxisSnapResult(nextOrigin, filledSpanState.snappedMin, filledSpanState.snappedMax)
  }

  let nextOrigin = snap.nextOrigin
  let snappedMin = snap.snappedMin
  let snappedMax = snap.snappedMax

  if (lockedMin && lockedMax) {
    nextOrigin =
      Math.abs(origin + size - boundMax) <= Math.abs(origin - boundMin)
        ? boundMax - size
        : boundMin
    snappedMin = isAlignedToMin(nextOrigin, boundMin)
    snappedMax = isAlignedToMax(nextOrigin, size, boundMax)
  } else if (lockedMin) {
    nextOrigin = boundMin
    snappedMin = true
    snappedMax = false
  } else if (lockedMax) {
    nextOrigin = boundMax - size
    snappedMin = false
    snappedMax = true
  }

  return buildAxisSnapResult(nextOrigin, snappedMin, snappedMax)
}

/** 计算吸附结果（不移动节点，供拖拽过程预览） */
export const resolveStageEdgeSnap = (
  node: Konva.Node,
  bounds: StageContentBounds,
  options: StageEdgeSnapOptions = {},
): { state: StageEdgeSnapState; nextOriginX: number; nextOriginY: number } => {
  const { originX, originY, width, height } = getNodeBox(node)
  const threshold = options.threshold ?? STAGE_EDGE_SNAP_THRESHOLD
  const locked = options.lockedEdges

  const snapX = applyFilledOrLockedAxisSnap({
    origin: originX,
    size: width,
    boundMin: bounds.left,
    boundMax: bounds.right,
    threshold,
    axisDelta: options.axisDeltaX ?? 0,
    snap: snapOnAxis({
      origin: originX,
      size: width,
      boundMin: bounds.left,
      boundMax: bounds.right,
      threshold,
      axisDelta: options.axisDeltaX ?? 0,
    }),
    locked,
    edgeKeys: { min: 'left', max: 'right' },
  })
  const snapY = applyFilledOrLockedAxisSnap({
    origin: originY,
    size: height,
    boundMin: bounds.top,
    boundMax: bounds.bottom,
    threshold,
    axisDelta: options.axisDeltaY ?? 0,
    snap: snapOnAxis({
      origin: originY,
      size: height,
      boundMin: bounds.top,
      boundMax: bounds.bottom,
      threshold,
      axisDelta: options.axisDeltaY ?? 0,
    }),
    locked,
    edgeKeys: { min: 'top', max: 'bottom' },
  })

  return {
    state: {
      left: snapX.snappedMin,
      right: snapX.snappedMax,
      top: snapY.snappedMin,
      bottom: snapY.snappedMax,
    },
    nextOriginX: snapX.nextOrigin,
    nextOriginY: snapY.nextOrigin,
  }
}

/**
 * 将节点吸附到画布边缘，返回各边是否已吸附
 */
export const applyStageEdgeSnap = (
  node: Konva.Node,
  bounds: StageContentBounds,
  options: StageEdgeSnapOptions = {},
): StageEdgeSnapState => {
  const { originX, originY } = getNodeBox(node)
  const resolved = resolveStageEdgeSnap(node, bounds, options)
  if (
    Math.abs(resolved.nextOriginX - originX) > 0.01 ||
    Math.abs(resolved.nextOriginY - originY) > 0.01
  ) {
    setNodePositionFromOrigin(node, resolved.nextOriginX, resolved.nextOriginY)
  }
  return resolved.state
}

/** 是否靠近画布边缘（用于拖拽过程提示） */
export const getStageEdgeProximity = (
  node: Konva.Node,
  bounds: StageContentBounds,
  threshold = STAGE_EDGE_SNAP_THRESHOLD,
): StageEdgeSnapState => {
  const { originX, originY, width, height } = getNodeBox(node)
  const nearLeft = Math.abs(originX - bounds.left) <= threshold
  const nearRight = Math.abs(originX + width - bounds.right) <= threshold
  const nearTop = Math.abs(originY - bounds.top) <= threshold
  const nearBottom = Math.abs(originY + height - bounds.bottom) <= threshold
  // 仅尺寸刚好等于画布时，贴一边视为双边都靠近；超出画布只报实际靠近的边
  const exactX = exactlyFillsAxisSpan(width, bounds.left, bounds.right)
  const exactY = exactlyFillsAxisSpan(height, bounds.top, bounds.bottom)

  return {
    left: nearLeft || (exactX && nearRight),
    right: nearRight || (exactX && nearLeft),
    top: nearTop || (exactY && nearBottom),
    bottom: nearBottom || (exactY && nearTop),
  }
}

const hasAnyEdge = (state: StageEdgeSnapState) =>
  state.left || state.right || state.top || state.bottom

const getSnapGuideLayer = (stage: Konva.Stage) => {
  const existing = stage.findOne(
    (node: Konva.Node) => node.name() === SNAP_GUIDE_LAYER_NAME,
  ) as Konva.Layer | undefined
  if (existing) {
    existing.destroyChildren()
    return existing
  }
  const layer = new Konva.Layer({ name: SNAP_GUIDE_LAYER_NAME, listening: false })
  stage.add(layer)
  return layer
}

type SnapEdge = keyof StageEdgeSnapState

type NodeBox = { originX: number; originY: number; width: number; height: number }

const addGuideStroke = (
  layer: Konva.Layer,
  points: number[],
  locked: boolean,
  strokeWidth?: number,
) => {
  const width = strokeWidth ?? (locked ? snapGuideMetrics.lockedStroke : snapGuideMetrics.nearStroke)

  if (locked) {
    layer.add(
      new Konva.Line({
        points,
        stroke: SNAP_LOCKED_GLOW,
        strokeWidth: width + 4,
        lineCap: 'round',
        lineJoin: 'round',
        shadowColor: '#000000',
        shadowBlur: 6,
        shadowOpacity: 0.45,
        listening: false,
      }),
    )
  }

  layer.add(
    new Konva.Line({
      points,
      stroke: locked ? SNAP_LOCKED_COLOR : SNAP_NEAR_COLOR,
      strokeWidth: width,
      dash: locked ? undefined : [8, 5],
      lineCap: 'round',
      lineJoin: 'round',
      shadowColor: '#000000',
      shadowBlur: locked ? 5 : 2,
      shadowOpacity: locked ? 0.5 : 0.35,
      listening: false,
    }),
  )
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** 贴边边中心圆点坐标（相对画布边内缩，避免贴边被裁切只显示半圆） */
const resolveSnapEdgeMarker = (bounds: StageContentBounds, edge: SnapEdge, box: NodeBox) => {
  const pad = snapGuideMetrics.markerRadius + 3
  const cx = clamp(
    box.originX + box.width / 2,
    bounds.left + pad,
    bounds.right - pad,
  )
  const cy = clamp(
    box.originY + box.height / 2,
    bounds.top + pad,
    bounds.bottom - pad,
  )

  if (edge === 'top') {
    return { x: cx, y: bounds.top + pad }
  }
  if (edge === 'bottom') {
    return { x: cx, y: bounds.bottom - pad }
  }
  if (edge === 'left') {
    return { x: bounds.left + pad, y: cy }
  }
  return { x: bounds.right - pad, y: cy }
}

/** 画布边缘对齐线：靠近为短刻度，已贴边为沿元素投影的加粗整段线 */
const addCanvasEdgeAlignGuide = (
  layer: Konva.Layer,
  bounds: StageContentBounds,
  edge: SnapEdge,
  box: NodeBox,
  locked: boolean,
) => {
  const x1 = Math.max(bounds.left, box.originX)
  const x2 = Math.min(bounds.right, box.originX + box.width)
  const y1 = Math.max(bounds.top, box.originY)
  const y2 = Math.min(bounds.bottom, box.originY + box.height)
  if (x2 <= x1 || y2 <= y1) return

  if (locked) {
    const isHorizontal = edge === 'top' || edge === 'bottom'
    const edgeCoord = isHorizontal
      ? edge === 'top'
        ? bounds.top
        : bounds.bottom
      : edge === 'left'
        ? bounds.left
        : bounds.right
    const points = isHorizontal
      ? [x1, edgeCoord, x2, edgeCoord]
      : [edgeCoord, y1, edgeCoord, y2]

    addGuideStroke(layer, points, true, snapGuideMetrics.lockedStroke + 1.5)
    return
  }

  const isHorizontal = edge === 'top' || edge === 'bottom'
  const edgeCoord = isHorizontal
    ? edge === 'top'
      ? bounds.top
      : bounds.bottom
    : edge === 'left'
      ? bounds.left
      : bounds.right
  const cx = clamp(box.originX + box.width / 2, bounds.left, bounds.right)
  const cy = clamp(box.originY + box.height / 2, bounds.top, bounds.bottom)
  const half = snapGuideMetrics.alignTickHalf
  const points = isHorizontal
    ? [cx - half, edgeCoord, cx + half, edgeCoord]
    : [edgeCoord, cy - half, edgeCoord, cy + half]

  addGuideStroke(layer, points, false)
}

/** 贴边边中心圆点（完整显示，不贴画布裁切） */
const addSnapEdgeMarker = (layer: Konva.Layer, x: number, y: number) => {
  const r = snapGuideMetrics.markerRadius
  layer.add(
    new Konva.Circle({
      x,
      y,
      radius: r + 3,
      fill: SNAP_LOCKED_GLOW,
      shadowColor: '#000000',
      shadowBlur: 5,
      shadowOpacity: 0.35,
      listening: false,
    }),
  )
  layer.add(
    new Konva.Circle({
      x,
      y,
      radius: r,
      stroke: SNAP_LOCKED_COLOR,
      strokeWidth: 2,
      fill: SNAP_LOCKED_FILL,
      listening: false,
    }),
  )
  layer.add(
    new Konva.Circle({
      x,
      y,
      radius: r * 0.35,
      fill: SNAP_LOCKED_COLOR,
      listening: false,
    }),
  )
}

/** 在元素贴边一侧画直角括号，标明「元素的这条边」正在对齐 */
const addElementEdgeBrackets = (
  layer: Konva.Layer,
  box: NodeBox,
  edge: SnapEdge,
  locked: boolean,
) => {
  const arm = locked ? snapGuideMetrics.bracketArm + 2 : snapGuideMetrics.bracketArm
  const { originX: x, originY: y, width: w, height: h } = box
  const x2 = x + w
  const y2 = y + h
  const stroke = locked ? snapGuideMetrics.lockedStroke + 1 : snapGuideMetrics.nearStroke

  const segments: number[][] =
    edge === 'top'
      ? [
          [x, y, x, y - arm],
          [x, y, x + arm, y],
          [x2, y, x2, y - arm],
          [x2, y, x2 - arm, y],
        ]
      : edge === 'bottom'
        ? [
            [x, y2, x, y2 + arm],
            [x, y2, x + arm, y2],
            [x2, y2, x2, y2 + arm],
            [x2, y2, x2 - arm, y2],
          ]
        : edge === 'left'
          ? [
              [x, y, x - arm, y],
              [x, y, x, y + arm],
              [x, y2, x - arm, y2],
              [x, y2, x, y2 - arm],
            ]
          : [
              [x2, y, x2 + arm, y],
              [x2, y, x2, y + arm],
              [x2, y2, x2 + arm, y2],
              [x2, y2, x2, y2 - arm],
            ]

  for (const points of segments) {
    addGuideStroke(layer, points, locked, stroke)
  }
}

/** 已贴边：该边中点圆点 */
const addSnapAnchor = (
  layer: Konva.Layer,
  bounds: StageContentBounds,
  edge: SnapEdge,
  box: NodeBox,
) => {
  const { x, y } = resolveSnapEdgeMarker(bounds, edge, box)
  addSnapEdgeMarker(layer, x, y)
}

const SNAP_EDGES: SnapEdge[] = ['left', 'right', 'top', 'bottom']

/**
 * 绘制吸附提示：元素贴边括号 + 画布边缘对齐线；已贴边时加粗对齐线 + 边中点圆点
 */
export const updateStageEdgeSnapGuides = (
  stage: Konva.Stage | null,
  bounds: StageContentBounds,
  proximity: StageEdgeSnapState,
  snapped: StageEdgeSnapState,
  node?: Konva.Node,
) => {
  if (!stage) return

  if (!hasAnyEdge(proximity) && !hasAnyEdge(snapped)) {
    clearStageEdgeSnapGuides(stage)
    return
  }

  const layer = getSnapGuideLayer(stage)
  snapGuideMetrics = resolveSnapGuideMetrics(bounds)
  const nodeBox = node ? getNodeBox(node) : null

  if (!nodeBox) return

  const displaySnapped = { ...snapped }
  const displayProximity = { ...proximity }
  const exactY = exactlyFillsAxisSpan(nodeBox.height, bounds.top, bounds.bottom)
  const exactX = exactlyFillsAxisSpan(nodeBox.width, bounds.left, bounds.right)
  const yActive =
    snapped.top ||
    snapped.bottom ||
    proximity.top ||
    proximity.bottom
  const xActive =
    snapped.left ||
    snapped.right ||
    proximity.left ||
    proximity.right

  // 仅宽高刚好等于画布时，贴一边同时显示对边提示线
  if (exactY && yActive) {
    displaySnapped.top = true
    displaySnapped.bottom = true
    displayProximity.top = true
    displayProximity.bottom = true
  }
  if (exactX && xActive) {
    displaySnapped.left = true
    displaySnapped.right = true
    displayProximity.left = true
    displayProximity.right = true
  }

  for (const edge of SNAP_EDGES) {
    const isLocked = displaySnapped[edge]
    const isNear = displayProximity[edge] && !isLocked
    if (!isLocked && !isNear) continue

    addCanvasEdgeAlignGuide(layer, bounds, edge, nodeBox, isLocked)
    addElementEdgeBrackets(layer, nodeBox, edge, isLocked)
    if (isLocked) {
      addSnapAnchor(layer, bounds, edge, nodeBox)
    }
  }

  layer.moveToTop()
  layer.batchDraw()
}

export const clearStageEdgeSnapGuides = (stage: Konva.Stage | null) => {
  if (!stage) return
  const layer = stage.findOne((node: Konva.Node) => node.name() === SNAP_GUIDE_LAYER_NAME)
  layer?.destroy()
  stage.batchDraw()
}
