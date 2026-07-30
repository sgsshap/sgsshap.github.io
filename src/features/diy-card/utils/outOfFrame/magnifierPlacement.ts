export type MagnifierPlacement = {
  left: number
  top: number
}

export type ResolveMagnifierPlacementOptions = {
  brushCx: number
  brushCy: number
  brushRadius: number
  magnifierSize: number
  viewWidth: number
  viewHeight: number
  gap?: number
  viewportPad?: number
  /** 0 = 最优先左上，依次 TR / BR / BL */
  quadrantPreference?: readonly number[]
}

const DEFAULT_GAP = 10
const DEFAULT_PAD = 4
const DEFAULT_QUADRANT_PREFERENCE = [0, 1, 3, 2] as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const magnifierOverlapsBrush = (
  left: number,
  top: number,
  brushCx: number,
  brushCy: number,
  brushRadius: number,
  magnifierSize: number,
  minGap: number,
) => {
  const mcx = left + magnifierSize / 2
  const mcy = top + magnifierSize / 2
  const magnifierRadius = magnifierSize / 2
  return Math.hypot(mcx - brushCx, mcy - brushCy) < brushRadius + magnifierRadius + minGap
}

const clampMagnifierToViewport = (
  left: number,
  top: number,
  size: number,
  viewW: number,
  viewH: number,
  pad: number,
) => {
  const maxLeft = Math.max(pad, viewW - size - pad)
  const maxTop = Math.max(pad, viewH - size - pad)
  return {
    left: clamp(left, pad, maxLeft),
    top: clamp(top, pad, maxTop),
  }
}

const magnifierVisibleArea = (
  left: number,
  top: number,
  size: number,
  viewW: number,
  viewH: number,
  pad: number,
) => {
  const visLeft = Math.max(left, pad)
  const visTop = Math.max(top, pad)
  const visRight = Math.min(left + size, viewW - pad)
  const visBottom = Math.min(top + size, viewH - pad)
  return Math.max(0, visRight - visLeft) * Math.max(0, visBottom - visTop)
}

const pushMagnifierAwayFromBrush = (
  left: number,
  top: number,
  brushCx: number,
  brushCy: number,
  brushRadius: number,
  magnifierSize: number,
  minGap: number,
) => {
  const magnifierRadius = magnifierSize / 2
  const minCenterDist = brushRadius + magnifierRadius + minGap
  const mcx = left + magnifierSize / 2
  const mcy = top + magnifierSize / 2
  const dx = mcx - brushCx
  const dy = mcy - brushCy
  const dist = Math.hypot(dx, dy)

  if (dist >= minCenterDist) {
    return { left, top }
  }

  if (dist > 0.001) {
    const scale = minCenterDist / dist
    return {
      left: brushCx + dx * scale - magnifierSize / 2,
      top: brushCy + dy * scale - magnifierSize / 2,
    }
  }

  return {
    left: brushCx - minCenterDist - magnifierSize / 2,
    top: brushCy - minCenterDist - magnifierSize / 2,
  }
}

const buildQuadrantAnchors = (
  brushCx: number,
  brushCy: number,
  brushRadius: number,
  magnifierSize: number,
  gap: number,
) => [
  {
    left: brushCx - brushRadius - gap - magnifierSize,
    top: brushCy - brushRadius - gap - magnifierSize,
  },
  { left: brushCx + brushRadius + gap, top: brushCy - brushRadius - gap - magnifierSize },
  {
    left: brushCx - brushRadius - gap - magnifierSize,
    top: brushCy + brushRadius + gap,
  },
  { left: brushCx + brushRadius + gap, top: brushCy + brushRadius + gap },
]

/** 从锚点出发：先贴进视口，再沿远离笔刷方向推开，直到不重叠 */
const settleMagnifierFromAnchor = (
  anchorLeft: number,
  anchorTop: number,
  brushCx: number,
  brushCy: number,
  brushRadius: number,
  magnifierSize: number,
  viewW: number,
  viewH: number,
  gap: number,
  pad: number,
): MagnifierPlacement | null => {
  let { left, top } = clampMagnifierToViewport(
    anchorLeft,
    anchorTop,
    magnifierSize,
    viewW,
    viewH,
    pad,
  )

  for (let i = 0; i < 20; i++) {
    if (!magnifierOverlapsBrush(left, top, brushCx, brushCy, brushRadius, magnifierSize, gap)) {
      return { left, top }
    }

    const pushed = pushMagnifierAwayFromBrush(
      left,
      top,
      brushCx,
      brushCy,
      brushRadius,
      magnifierSize,
      gap,
    )
    const next = clampMagnifierToViewport(
      pushed.left,
      pushed.top,
      magnifierSize,
      viewW,
      viewH,
      pad,
    )

    if (next.left === left && next.top === top) {
      break
    }
    left = next.left
    top = next.top
  }

  if (!magnifierOverlapsBrush(left, top, brushCx, brushCy, brushRadius, magnifierSize, gap)) {
    return { left, top }
  }
  return null
}

const resolveFallbackMagnifierPlacement = (
  brushCx: number,
  brushCy: number,
  brushRadius: number,
  magnifierSize: number,
  viewW: number,
  viewH: number,
  gap: number,
  pad: number,
): MagnifierPlacement => {
  const maxLeft = Math.max(pad, viewW - magnifierSize - pad)
  const maxTop = Math.max(pad, viewH - magnifierSize - pad)
  const cornerSeeds = [
    { left: pad, top: pad },
    { left: maxLeft, top: pad },
    { left: pad, top: maxTop },
    { left: maxLeft, top: maxTop },
  ]

  let best: MagnifierPlacement = { left: pad, top: pad }
  let bestScore = -1

  for (const seed of cornerSeeds) {
    const settled = settleMagnifierFromAnchor(
      seed.left,
      seed.top,
      brushCx,
      brushCy,
      brushRadius,
      magnifierSize,
      viewW,
      viewH,
      gap,
      pad,
    )
    if (!settled) continue
    const area = magnifierVisibleArea(
      settled.left,
      settled.top,
      magnifierSize,
      viewW,
      viewH,
      pad,
    )
    const dist = Math.hypot(
      settled.left + magnifierSize / 2 - brushCx,
      settled.top + magnifierSize / 2 - brushCy,
    )
    const score = area + dist * 0.05
    if (score > bestScore) {
      bestScore = score
      best = settled
    }
  }

  if (bestScore >= 0) {
    return best
  }

  const viewCx = viewW / 2
  const viewCy = viewH / 2
  const dx = viewCx - brushCx
  const dy = viewCy - brushCy
  const len = Math.hypot(dx, dy) || 1
  const magnifierRadius = magnifierSize / 2
  const minCenterDist = brushRadius + magnifierRadius + gap
  const seedLeft = brushCx + (dx / len) * minCenterDist - magnifierRadius
  const seedTop = brushCy + (dy / len) * minCenterDist - magnifierRadius
  const settled = settleMagnifierFromAnchor(
    seedLeft,
    seedTop,
    brushCx,
    brushCy,
    brushRadius,
    magnifierSize,
    viewW,
    viewH,
    gap,
    pad,
  )
  return settled ?? clampMagnifierToViewport(seedLeft, seedTop, magnifierSize, viewW, viewH, pad)
}

/**
 * 解析放大镜位置：优先笔刷左上方，贴边时自动换象限；
 * 始终保证在视口内可见且不与笔刷圈重叠。
 */
export const resolveMagnifierPlacement = (
  options: ResolveMagnifierPlacementOptions,
): MagnifierPlacement => {
  const {
    brushCx,
    brushCy,
    brushRadius,
    magnifierSize,
    viewWidth,
    viewHeight,
    gap = DEFAULT_GAP,
    viewportPad = DEFAULT_PAD,
    quadrantPreference = DEFAULT_QUADRANT_PREFERENCE,
  } = options

  if (magnifierSize <= 0 || viewWidth <= 0 || viewHeight <= 0) {
    return { left: viewportPad, top: viewportPad }
  }

  const anchors = buildQuadrantAnchors(brushCx, brushCy, brushRadius, magnifierSize, gap)

  let best: MagnifierPlacement | null = null
  let bestScore = -1

  quadrantPreference.forEach((anchorIndex, preferenceRank) => {
    const anchor = anchors[anchorIndex]
    if (!anchor) return
    const settled = settleMagnifierFromAnchor(
      anchor.left,
      anchor.top,
      brushCx,
      brushCy,
      brushRadius,
      magnifierSize,
      viewWidth,
      viewHeight,
      gap,
      viewportPad,
    )
    if (!settled) return

    const visible = magnifierVisibleArea(
      settled.left,
      settled.top,
      magnifierSize,
      viewWidth,
      viewHeight,
      viewportPad,
    )
    const minVisible = magnifierSize * magnifierSize * 0.35
    if (visible < minVisible) return

    const priorityBonus = (quadrantPreference.length - preferenceRank) * 1_000_000
    const score = visible + priorityBonus
    if (score > bestScore) {
      bestScore = score
      best = settled
    }
  })

  if (best) {
    return best
  }

  return resolveFallbackMagnifierPlacement(
    brushCx,
    brushCy,
    brushRadius,
    magnifierSize,
    viewWidth,
    viewHeight,
    gap,
    viewportPad,
  )
}
