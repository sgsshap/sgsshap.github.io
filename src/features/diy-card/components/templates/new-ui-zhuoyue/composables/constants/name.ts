import type { TextLayoutRule } from '../layout/textLayout'

/** 武将名各字数默认布局 */
export const NAME_LAYOUTS: TextLayoutRule[] = [
  { countRange: [0, 2], fontSize: 22, characterSpacingPt: 7.71, x: 2, y: 33 },
  { countRange: [3], fontSize: 20, characterSpacingPt: 1.59, x: 2.4, y: 34 },
  { countRange: [4], fontSize: 18, characterSpacingPt: 1.08, x: 2.8, y: 32 },
  { countRange: [5], fontSize: 16, characterSpacingPt: 0, x: 3.2, y: 30 },
  { countRange: [6], fontSize: 14, characterSpacingPt: 0, x: 3.6, y: 30 },
  { countRange: [7], fontSize: 14, characterSpacingPt: 0, x: 3.6, y: 28 },
  { countRange: [8, Infinity], fontSize: 12, characterSpacingPt: 0, x: 3.9, y: 28 },
]

/** 神势力武将名相对 NAME_LAYOUTS 默认位置的 X 偏移（mm） */
export const NAME_SHEN_LAYOUT_OFFSET_X_MM = 50
/** 神势力武将名相对 NAME_LAYOUTS 默认位置的 Y 偏移（mm） */
export const NAME_SHEN_LAYOUT_OFFSET_Y_MM = -3
