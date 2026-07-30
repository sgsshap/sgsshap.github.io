import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'

const LINKED_LAYOUT_KEYS = [
  'x',
  'y',
  'width',
  'height',
  'scaleX',
  'scaleY',
  'rotation',
  'originX',
  'originY',
  'offsetX',
  'offsetY',
] as const satisfies readonly (keyof CanvasItemConfig)[]

/** 联动态：从原画 Konva 配置复制几何到出框，避免 mm 往返与 center pivot 偏差 */
export const applyLinkedOutOfFrameLayoutFromLegendImage = (
  target: CanvasItemConfig,
  source: CanvasItemConfig | undefined,
): boolean => {
  if (!source || typeof source.width !== 'number' || typeof source.height !== 'number') {
    return false
  }
  for (const key of LINKED_LAYOUT_KEYS) {
    const value = source[key]
    if (typeof value === 'number') {
      target[key] = value
    }
  }
  return true
}

export const resolveLinkedOutOfFrameDisplaySizePx = (source: CanvasItemConfig) => {
  const scaleX = source.scaleX ?? 1
  const scaleY = source.scaleY ?? 1
  const width = typeof source.width === 'number' ? source.width * scaleX : 0
  const height = typeof source.height === 'number' ? source.height * scaleY : 0
  return { width, height }
}
