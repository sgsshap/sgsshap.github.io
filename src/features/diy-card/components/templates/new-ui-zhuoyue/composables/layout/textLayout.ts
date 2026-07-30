/** 按字数分段的文字布局规则 */
export interface TextLayoutRule {
  /** 适用字数区间，单元素为精确匹配 */
  countRange: number[]
  /** 字号 */
  fontSize: number
  /** 竖排字间距 */
  characterSpacingPt: number
  /** 起始 x（mm） */
  x: number
  /** 起始 y（mm） */
  y: number
}

/**
 * 按字数匹配布局规则
 * @param layouts 布局表
 * @param count 当前字数
 */
export function findLayoutByCharCount(layouts: TextLayoutRule[], count: number) {
  return layouts.find((item) => {
    const range = item.countRange
    if (range.length <= 1) {
      return range[0] === count
    }
    const [min = 0, max = min] = range
    return min <= count && count <= max
  })
}

const matchesLayoutMm = (item: { x: number; y: number }, x: number, y: number) =>
  Math.abs(item.x - x) < 0.02 && Math.abs(item.y - y) < 0.02

/**
 * 持久化坐标是否仍为「另一势力布局模式」下的工厂预设。
 * 切神/刷新后历史快照可能早于布局重算，需按当前模式重算默认位。
 */
export const isStaleShenTextPresetLayout = (
  item: { x: number; y: number },
  layouts: TextLayoutRule[],
  charCount: number,
  shenOffsetX: number,
  shenOffsetY: number,
  layoutAsShen: boolean,
) => {
  const table = findLayoutByCharCount(layouts, charCount)
  if (!table) return false

  const normalX = table.x
  const normalY = table.y
  const shenX = table.x + shenOffsetX
  const shenY = table.y + shenOffsetY
  const expectedX = layoutAsShen ? shenX : normalX
  const expectedY = layoutAsShen ? shenY : normalY

  if (matchesLayoutMm(item, expectedX, expectedY)) return false

  const staleX = layoutAsShen ? normalX : shenX
  const staleY = layoutAsShen ? normalY : shenY
  return matchesLayoutMm(item, staleX, staleY)
}
