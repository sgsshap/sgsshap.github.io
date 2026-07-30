/** 普通势力体力组起点 x（mm，相对成品区左上） */
export const HP_ORIGIN_X_MM = 11.2
/** 普通势力体力组起点 y（mm） */
export const HP_ORIGIN_Y_MM = 1.5

/** 神势力体力组起点 x（mm） */
export const HP_SHEN_ORIGIN_X_MM = 12.2
/** 神势力体力组起点 y（mm） */
export const HP_SHEN_ORIGIN_Y_MM = 1.8

/** 按布局模式解析体力组默认起点（mm） */
export const resolveHpOriginMm = (layoutAsShen: boolean) =>
  layoutAsShen
    ? { x: HP_SHEN_ORIGIN_X_MM, y: HP_SHEN_ORIGIN_Y_MM }
    : { x: HP_ORIGIN_X_MM, y: HP_ORIGIN_Y_MM }

/** 持久化坐标是否仍为另一布局模式下的工厂预设 */
export const isStaleHpPresetLayout = (
  item: { x: number; y: number; name: string },
  layoutAsShen: boolean,
) => {
  if (item.name === 'unknown') return false

  const matchesMm = (x: number, y: number, target: { x: number; y: number }) =>
    Math.abs(x - target.x) < 0.02 && Math.abs(y - target.y) < 0.02

  const expected = resolveHpOriginMm(layoutAsShen)
  if (matchesMm(item.x, item.y, expected)) return false

  const stale = resolveHpOriginMm(!layoutAsShen)
  return matchesMm(item.x, item.y, stale)
}

/** 勾玉水平单位宽度（px，相邻 origin 步进） */
export const HP_ICON_UNIT_WIDTH = 27

/** 满血勾玉缩放 */
export const HP_NORMAL_ICON_SCALE = 0.47

/** 空血勾玉缩放 */
export const HP_EMPTY_ICON_SCALE = 0.49

/** 护甲勾玉缩放 */
export const HP_SHIELD_ICON_SCALE = 0.45

/** 数字模式体力/护甲文字起始 y（mm，相对 hp 组内顶部） */
export const HP_TEXT_Y_MM = 1.4

/** 空勾玉相对满血的垂直微调（mm，负值上移） */
export const HP_EMPTY_ICON_Y_MM = -0.1

/** 文字模式（体力+护甲超过展示上限）字号 px */
export const HP_LIMITED_TEXT_FONT_SIZE = 22

/**
 * 文字模式数字与乘号：纯白字芯 + 纯黑硬描边 + 硬偏移阴影（无 blur）。
 */
export const resolveHpLimitedTextKonvaStyle = (fontSize = HP_LIMITED_TEXT_FONT_SIZE) => ({
  stroke: '#000000',
  strokeWidth: Math.max(1.6, fontSize * 0.09),
  fillAfterStrokeEnabled: true,
  shadowColor: '#000000',
  shadowBlur: 0,
  shadowOffsetX: 2,
  shadowOffsetY: 4,
})
