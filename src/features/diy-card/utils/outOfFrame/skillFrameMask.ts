import type { TemplateProps } from '@/features/diy-card/composables/template/types'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { resolveShenSkillDescBgBox } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/skills-desc/skillDescBg'
import {
  computeSkillsAreaLayout,
  getPublishedSkillsAreaLayout,
  type SkillsAreaLayout,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/skills-area/layout'
import { usesShenCardLayout } from '@/features/diy-card/composables/doubleKingdom'
import { resolveSkillOverlapHoleLeftMm } from '@/features/diy-card/types/diy/outOfFrame'
import { createDiyUnitConverters } from '@/features/diy-card/utils/canvas'

/** 挖洞区左右/底部分外扩，顶边与布局对齐，避免出框切线高于技能区底 */
const OVERLAP_MASK_SIDE_PAD_PX = 1.5
const OVERLAP_MASK_BOTTOM_PAD_PX = 1.5

export type StageRect = {
  x: number
  y: number
  width: number
  height: number
}

const padOverlapStageRect = (rect: StageRect): StageRect => ({
  x: rect.x - OVERLAP_MASK_SIDE_PAD_PX,
  y: rect.y,
  width: rect.width + OVERLAP_MASK_SIDE_PAD_PX * 2,
  height: rect.height + OVERLAP_MASK_BOTTOM_PAD_PX,
})

const clampOverlapRectTop = (rect: StageRect, minTop: number): StageRect => {
  if (rect.y >= minTop) return rect
  const trim = minTop - rect.y
  return {
    x: rect.x,
    y: minTop,
    width: rect.width,
    height: Math.max(0, rect.height - trim),
  }
}

/** 与 skillsDesc 底框一致：含 userMarginTop 上探 + 神势力动态底框范围 */
export const resolveSkillDescOverlapStageRectFromLayout = (
  layout: SkillsAreaLayout,
  info: LegendInfo,
  holeLeftPx: number,
  holeWidthPx: number,
  mmToPx: (mm: number) => number,
): StageRect => {
  const bgTopInsetPx = layout.userMarginTopPx
  let topY = layout.originY - bgTopInsetPx
  let bottomY = layout.originY + layout.bgHeight

  if (usesShenCardLayout(info)) {
    const bgBox = resolveShenSkillDescBgBox(layout, mmToPx)
    topY = Math.min(topY, layout.originY + bgBox.y)
    bottomY = Math.max(bottomY, layout.originY + bgBox.y + bgBox.height)
  }

  return clampOverlapRectTop(
    padOverlapStageRect({
      x: layout.originX + holeLeftPx,
      y: topY,
      width: holeWidthPx,
      height: bottomY - topY,
    }),
    topY,
  )
}

const resolveSkillZoneOverlapStageRegion = (
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const fullModeFlag = Boolean(info.renderConfig.display.fullModeFlag)
  if (fullModeFlag) return null

  const units = createDiyUnitConverters(mmToPx)
  const publishedLayout = getPublishedSkillsAreaLayout()
  const normalLayout =
    publishedLayout ??
    computeSkillsAreaLayout(info, props, units, false, maxBleedPx, {
      skipAutoSizeResolve: true,
    })
  if (!normalLayout?.blocks.length) return null

  /**
   * 保留宽相对成品区（trim）左缘；出血时 originX = innerStageBleed，须加上再换算 Stage 坐标。
   */
  const preserveTrimPx = units.mmToPx(resolveSkillOverlapHoleLeftMm(info))
  const holeLeftPx = preserveTrimPx
  const bgRightPx = normalLayout.bgOffsetX + normalLayout.bgWidth
  const holeWidthPx = bgRightPx - holeLeftPx
  if (holeWidthPx <= 0) return null

  if (normalLayout.bgHeight <= 0) return null

  return {
    layout: normalLayout,
    holeLeftPx,
    holeWidthPx,
  }
}

/** 技能区整区（含描述底/技能名列，不含左侧 kingdom_frame 保留带），用于出框/素材重叠挖洞 */
export const resolveSkillDescOverlapHoleStageMaskRects = (
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
): StageRect[] => {
  const region = resolveSkillZoneOverlapStageRegion(info, props, mmToPx, maxBleedPx)
  if (!region) return []

  const { layout, holeLeftPx, holeWidthPx } = region
  const units = createDiyUnitConverters(mmToPx)

  return [
    resolveSkillDescOverlapStageRectFromLayout(
      layout,
      info,
      holeLeftPx,
      holeWidthPx,
      units.mmToPx,
    ),
  ]
}

/** 技能区热区（与挖洞区一致），用于出框命中穿透 */
export const resolveSkillDescOnlyOverlapStageMaskRects = (
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
): StageRect[] => resolveSkillDescOverlapHoleStageMaskRects(info, props, mmToPx, maxBleedPx)

const isPointInStageRect = (x: number, y: number, rect: StageRect) =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height

/** 点击是否落在技能区（Stage 坐标系），用于出框图点击重定向到 skillsDesc */
export const isPointInSkillDescPassThroughZone = (
  stageX: number,
  stageY: number,
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const rects = resolveSkillDescOnlyOverlapStageMaskRects(info, props, mmToPx, maxBleedPx)
  return rects.some((rect) => isPointInStageRect(stageX, stageY, rect))
}

const stagePointToImageLocal = (
  stageX: number,
  stageY: number,
  image: Pick<
    CanvasItemConfig,
    'x' | 'y' | 'offsetX' | 'offsetY' | 'rotation' | 'scaleX' | 'scaleY'
  >,
) => {
  const cx = image.x ?? 0
  const cy = image.y ?? 0
  const ox = image.offsetX ?? 0
  const oy = image.offsetY ?? 0
  const sx = image.scaleX ?? 1
  const sy = image.scaleY ?? 1
  const rot = ((image.rotation ?? 0) * Math.PI) / 180
  let dx = stageX - cx
  let dy = stageY - cy
  if (rot) {
    const cos = Math.cos(-rot)
    const sin = Math.sin(-rot)
    const rx = dx * cos - dy * sin
    const ry = dx * sin + dy * cos
    dx = rx
    dy = ry
  }
  return { x: dx / sx + ox, y: dy / sy + oy }
}

type ImageOverlapTransform = Pick<
  CanvasItemConfig,
  'x' | 'y' | 'offsetX' | 'offsetY' | 'width' | 'height' | 'rotation' | 'scaleX' | 'scaleY'
>

const quadAxisAlignedBounds = (points: Array<{ x: number; y: number }>) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { minX, minY, maxX, maxY }
}

const quadSignedArea = (points: Array<{ x: number; y: number }>) => {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!
    const next = points[(i + 1) % points.length]!
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

/** Stage 坐标系矩形映射为出框图本地四边形（旋转时不能用轴对齐包围盒近似） */
export const mapStageRectToImageLocalQuad = (
  stageRect: StageRect,
  image: ImageOverlapTransform,
): Array<{ x: number; y: number }> | null => {
  const width = image.width ?? 0
  const height = image.height ?? 0
  if (width <= 0 || height <= 0) return null

  const quad = [
    stagePointToImageLocal(stageRect.x, stageRect.y, image),
    stagePointToImageLocal(stageRect.x + stageRect.width, stageRect.y, image),
    stagePointToImageLocal(stageRect.x + stageRect.width, stageRect.y + stageRect.height, image),
    stagePointToImageLocal(stageRect.x, stageRect.y + stageRect.height, image),
  ]

  if (Math.abs(quadSignedArea(quad)) < 1e-3) return null

  const bounds = quadAxisAlignedBounds(quad)
  if (bounds.maxX <= 0 || bounds.maxY <= 0 || bounds.minX >= width || bounds.minY >= height) {
    return null
  }

  return quad
}

/** 将 Stage 矩形映射到出框图本地坐标轴对齐包围盒（仅未旋转时的兼容导出） */
export const intersectStageRectWithImageLocal = (
  stageRect: StageRect,
  image: ImageOverlapTransform,
): StageRect | null => {
  const quad = mapStageRectToImageLocalQuad(stageRect, image)
  if (!quad) return null

  const width = image.width ?? 0
  const height = image.height ?? 0
  const bounds = quadAxisAlignedBounds(quad)
  const minX = Math.max(0, bounds.minX)
  const minY = Math.max(0, bounds.minY)
  const maxX = Math.min(width, bounds.maxX)
  const maxY = Math.min(height, bounds.maxY)
  const rectW = maxX - minX
  const rectH = maxY - minY
  if (rectW <= 0 || rectH <= 0) return null

  return { x: minX, y: minY, width: rectW, height: rectH }
}

export type ImageLocalHoleQuad = Array<{ x: number; y: number }>

export const buildOutOfFrameSkillOverlapClipFunc = (
  holes: ImageLocalHoleQuad[],
  width: number,
  height: number,
) => {
  return (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    for (const hole of holes) {
      if (hole.length < 3) continue
      ctx.moveTo(hole[0]!.x, hole[0]!.y)
      for (let i = 1; i < hole.length; i++) {
        const point = hole[i]!
        ctx.lineTo(point.x, point.y)
      }
      ctx.closePath()
    }
    ctx.clip('evenodd')
  }
}

export const resolveSkillOverlapLocalHoleQuads = (
  info: LegendInfo,
  props: TemplateProps,
  imageConfig: CanvasItemConfig,
  mmToPx: number,
  maxBleedPx: number,
): ImageLocalHoleQuad[] => {
  const stageRects = resolveSkillDescOverlapHoleStageMaskRects(info, props, mmToPx, maxBleedPx)
  return stageRects
    .map((rect) => mapStageRectToImageLocalQuad(rect, imageConfig))
    .filter((quad): quad is ImageLocalHoleQuad => Boolean(quad))
}

export const resolveSkillOverlapLocalHoles = (
  info: LegendInfo,
  props: TemplateProps,
  imageConfig: CanvasItemConfig,
  mmToPx: number,
  maxBleedPx: number,
): StageRect[] => {
  const stageRects = resolveSkillDescOverlapHoleStageMaskRects(info, props, mmToPx, maxBleedPx)
  return stageRects
    .map((rect) => intersectStageRectWithImageLocal(rect, imageConfig))
    .filter((rect): rect is StageRect => Boolean(rect))
}

/** 在合成画布上按当前布局挖洞（写入像素，不依赖 Konva clipFunc） */
export const applyOutOfFrameSkillOverlapHoles = (
  composited: HTMLCanvasElement,
  info: LegendInfo,
  props: TemplateProps,
  imageConfig: CanvasItemConfig,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const holes = resolveSkillOverlapLocalHoleQuads(info, props, imageConfig, mmToPx, maxBleedPx)
  if (!holes.length) return

  const displayW = imageConfig.width ?? composited.width
  const displayH = imageConfig.height ?? composited.height
  if (displayW <= 0 || displayH <= 0) return

  const scaleX = composited.width / displayW
  const scaleY = composited.height / displayH
  const ctx = composited.getContext('2d')
  if (!ctx) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, composited.width, composited.height)
  ctx.clip()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#ffffff'
  for (const hole of holes) {
    if (hole.length < 3) continue
    ctx.beginPath()
    ctx.moveTo(hole[0]!.x * scaleX, hole[0]!.y * scaleY)
    for (let i = 1; i < hole.length; i++) {
      const point = hole[i]!
      ctx.lineTo(point.x * scaleX, point.y * scaleY)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export const resolveOutOfFrameSkillOverlapClipFunc = (
  info: LegendInfo,
  props: TemplateProps,
  imageConfig: CanvasItemConfig,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const width = imageConfig.width ?? 0
  const height = imageConfig.height ?? 0
  if (width <= 0 || height <= 0) return undefined

  const localHoles = resolveSkillOverlapLocalHoleQuads(info, props, imageConfig, mmToPx, maxBleedPx)
  if (!localHoles.length) return undefined
  return buildOutOfFrameSkillOverlapClipFunc(localHoles, width, height)
}
