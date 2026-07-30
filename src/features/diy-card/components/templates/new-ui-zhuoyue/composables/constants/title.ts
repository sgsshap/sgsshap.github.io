import { findLayoutByCharCount, type TextLayoutRule } from '../layout/textLayout'

/** 称号各字数默认布局 */
export const TITLE_LAYOUTS: TextLayoutRule[] = [
  { countRange: [0, 1], fontSize: 12, characterSpacingPt: 2.69, x: 3.7, y: 18 },
  { countRange: [2], fontSize: 12, characterSpacingPt: 2.69, x: 3.7, y: 17 },
  { countRange: [3], fontSize: 12, characterSpacingPt: 2.69, x: 3.8, y: 16 },
  { countRange: [4], fontSize: 11, characterSpacingPt: 0.54, x: 4.1, y: 15 },
  { countRange: [5, Infinity], fontSize: 10, characterSpacingPt: 0, x: 4.3, y: 14 },
]

/** 神势力称号各字数默认字间距（pt），竖排行高基准 */
export const TITLE_SHEN_CHARACTER_SPACING_RULES: ReadonlyArray<
  Pick<TextLayoutRule, 'countRange' | 'characterSpacingPt'>
> = [
  { countRange: [0, 1], characterSpacingPt: 5.38 },
  { countRange: [2], characterSpacingPt: 5.38 },
  { countRange: [3], characterSpacingPt: 5.38 },
  { countRange: [4], characterSpacingPt: 2 },
  { countRange: [5, Infinity], characterSpacingPt: 1 },
]

/** 神势力称号相对 TITLE_LAYOUTS 默认位置的 X 偏移（mm） */
export const TITLE_SHEN_LAYOUT_OFFSET_X_MM = 50
/** 神势力称号相对 TITLE_LAYOUTS 默认位置的 Y 偏移（mm） */
export const TITLE_SHEN_LAYOUT_OFFSET_Y_MM = -5

/**
 * 称号默认字间距（pt）
 * @param charCount 称号字数
 * @param layoutAsShen 是否神势力布局
 */
export const resolveTitleDefaultCharacterSpacingPt = (
  charCount: number,
  layoutAsShen: boolean,
): number => {
  const rules = layoutAsShen ? TITLE_SHEN_CHARACTER_SPACING_RULES : TITLE_LAYOUTS
  return findLayoutByCharCount(rules as TextLayoutRule[], charCount)!.characterSpacingPt
}

/** 称号默认颜色：神 / 魏 / 蜀 / 吴 / 群 / 晋 */
export const TITLE_COLORS = ['#FFFF48', '#4D6993', '#C97E62', '#85AE6D', '#959394', '#BD6EB9']

/** 称号图层字体 */
export const TITLE_FONT_FAMILY = '华康新篆体'
