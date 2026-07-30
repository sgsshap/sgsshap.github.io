import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  BOTTOM_INFO_DEFAULT_MARGIN_LEFT_MM,
  BOTTOM_INFO_DEFAULT_MARGIN_RIGHT_MM,
  BOTTOM_INFO_FONT_FAMILY,
  BOTTOM_INFO_MARGIN_SAFE_LEFT_MM,
  BOTTOM_INFO_MARGIN_SAFE_LEFT_SHEN_MM,
  BOTTOM_INFO_MARGIN_SAFE_RIGHT_MM,
  BOTTOM_INFO_MARGIN_SAFE_RIGHT_SHEN_MM,
} from '../../constants/bottomInfo'
import { measureCanvasTextWidth } from '../skills-desc/canvasTextMeasure'
import {
  resolveBottomInfoBlackStrokeWidthPx,
  resolveBottomInfoCopyrightBlackStroke,
  resolveBottomInfoForegroundStrokeWidthPx,
} from './strokeLayers'

export type BottomInfoHorizontalLayout = {
  marginLeftPx: number
  marginRightPx: number
  copyrightX: number
}

/** 底栏水平内边距：用户边距 + 安全区 */
export const resolveBottomInfoHorizontalLayout = (
  bottomItem: LegendInfo['renderConfig']['items']['bottomInfo'],
  mmToPx: (mm: number) => number,
  isReset: boolean,
  shenLayout: boolean,
): BottomInfoHorizontalLayout => {
  if (isReset) {
    bottomItem.marginLeft = BOTTOM_INFO_DEFAULT_MARGIN_LEFT_MM
    bottomItem.marginRight = BOTTOM_INFO_DEFAULT_MARGIN_RIGHT_MM
  }

  const marginSafeLeftMm = shenLayout
    ? BOTTOM_INFO_MARGIN_SAFE_LEFT_SHEN_MM
    : BOTTOM_INFO_MARGIN_SAFE_LEFT_MM
  const marginSafeRightMm = shenLayout
    ? BOTTOM_INFO_MARGIN_SAFE_RIGHT_SHEN_MM
    : BOTTOM_INFO_MARGIN_SAFE_RIGHT_MM

  const marginLeftPx = mmToPx(
    (bottomItem.marginLeft ?? BOTTOM_INFO_DEFAULT_MARGIN_LEFT_MM) + marginSafeLeftMm,
  )
  const marginRightPx = mmToPx(
    (bottomItem.marginRight ?? BOTTOM_INFO_DEFAULT_MARGIN_RIGHT_MM) + marginSafeRightMm,
  )

  return {
    marginLeftPx,
    marginRightPx,
    copyrightX: marginLeftPx,
  }
}

/** 武将编号描边在右缘的外扩（px），用于右对齐占位 */
export const resolveBottomInfoLegendIdStrokeOutsetPx = (
  blackStrokeFlag: boolean,
  foregroundStrokeFlag: boolean,
  shenForeground: boolean,
): number => {
  let outset = 0
  if (resolveBottomInfoCopyrightBlackStroke(blackStrokeFlag)) {
    outset = Math.max(outset, resolveBottomInfoBlackStrokeWidthPx() / 2)
  }
  if (foregroundStrokeFlag) {
    outset = Math.max(
      outset,
      resolveBottomInfoForegroundStrokeWidthPx({ useLegendIdStroke: true, shenForeground }) / 2,
    )
  }
  return outset
}

/** 整串测量编号宽度，避免逐字累加与 Konva letterSpacing 不一致 */
export const measureBottomInfoLegendIdContentWidthPx = (
  raw: string,
  fontSizePx: number,
  letterSpacingPx: number,
) =>
  measureCanvasTextWidth({
    text: raw.trim(),
    fontSizePx,
    fontFamily: BOTTOM_INFO_FONT_FAMILY,
    letterSpacingPx,
  })
