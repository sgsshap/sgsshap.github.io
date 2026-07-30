import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import {
  BOTTOM_INFO_BLACK_STROKE_WIDTH_PX,
  BOTTOM_INFO_BLACK_STROKE_WIDTH_YEAR_PX,
  BOTTOM_INFO_COPYRIGHT_YEAR_STROKE_WIDTH_PX,
  BOTTOM_INFO_FOREGROUND_STROKE_WIDTH_PX,
  BOTTOM_INFO_FOREGROUND_STROKE_WIDTH_SHEN_PX,
  BOTTOM_INFO_LEGEND_ID_STROKE_WIDTH_PX,
} from '../../constants/bottomInfo'

const LAYER_SUFFIX = {
  strokeBlack: '_strokeBlack',
} as const

const CLEAR_SHADOW_PROPS = {
  shadowColor: undefined,
  shadowBlur: undefined,
  shadowOffsetX: undefined,
  shadowOffsetY: undefined,
  shadowOpacity: undefined,
} as const

export type BottomInfoForegroundStrokeOptions = {
  /** 年份段使用略宽的同色描边 */
  useYearStroke?: boolean
  /** 武将编号段 */
  useLegendIdStroke?: boolean
  /** 神 UI / 全幅白字层 */
  shenForeground?: boolean
}

export type BottomInfoBlackStrokeOptions = {
  /** 年份段使用加粗黑色外描边 */
  useYearBlackStroke?: boolean
}

/** 解析底栏黑色外描边宽度（px） */
export const resolveBottomInfoBlackStrokeWidthPx = (
  options: BottomInfoBlackStrokeOptions = {},
) =>
  options.useYearBlackStroke
    ? BOTTOM_INFO_BLACK_STROKE_WIDTH_YEAR_PX
    : BOTTOM_INFO_BLACK_STROKE_WIDTH_PX

/** 解析底栏同色描边宽度（px） */
export const resolveBottomInfoForegroundStrokeWidthPx = (
  options: BottomInfoForegroundStrokeOptions = {},
) => {
  if (options.useYearStroke) return BOTTOM_INFO_COPYRIGHT_YEAR_STROKE_WIDTH_PX
  if (options.useLegendIdStroke) return BOTTOM_INFO_LEGEND_ID_STROKE_WIDTH_PX
  if (options.shenForeground) return BOTTOM_INFO_FOREGROUND_STROKE_WIDTH_SHEN_PX
  return BOTTOM_INFO_FOREGROUND_STROKE_WIDTH_PX
}

/** 底栏文字描边：黑色外描边（神 UI）与同色细描边（普通势力） */
export type BottomInfoTextStrokeOptions = {
  blackStroke?: boolean
  foregroundStroke?: boolean
  useYearStroke?: boolean
  /** 神 UI 年份段黑描边加粗（与 {@link BOTTOM_INFO_BLACK_STROKE_WIDTH_YEAR_PX} 联动） */
  useYearBlackStroke?: boolean
  useLegendIdStroke?: boolean
  shenForeground?: boolean
}

/** 版权栏各段是否叠加黑色外描边（统一由 {@link BOTTOM_INFO_BLACK_STROKE_WIDTH_PX} 控制宽度） */
export const resolveBottomInfoCopyrightBlackStroke = (blackStrokeFlag: boolean) =>
  blackStrokeFlag && BOTTOM_INFO_BLACK_STROKE_WIDTH_PX > 0

/** 版权栏逐段描边选项（空格/键距无描边；其余字段含游卡桌游统一跟随 blackStrokeFlag） */
export const resolveBottomInfoCopyrightSegmentStrokeOptions = (
  segmentKind: string,
  blackStrokeFlag: boolean,
  foregroundStrokeFlag: boolean,
  shenForeground: boolean,
): BottomInfoTextStrokeOptions => {
  if (segmentKind === 'space' || segmentKind === 'keySpace') {
    return { blackStroke: false, foregroundStroke: false }
  }
  const blackStroke = resolveBottomInfoCopyrightBlackStroke(blackStrokeFlag)
  const isYear = segmentKind === 'year'
  return {
    blackStroke,
    foregroundStroke: foregroundStrokeFlag,
    useYearStroke: isYear && !blackStroke,
    useYearBlackStroke: isYear && blackStroke,
    shenForeground,
  }
}

/** 白字同色描边（略增粗字形） */
export const resolveBottomInfoForegroundStroke = (
  fill: string,
  strokeEnabled: boolean,
  options: BottomInfoForegroundStrokeOptions = {},
) => {
  if (!strokeEnabled) return {}
  const strokeWidth = resolveBottomInfoForegroundStrokeWidthPx(options)
  if (strokeWidth <= 0) return {}
  return {
    stroke: fill,
    strokeWidth,
    lineJoin: 'round' as const,
    lineCap: 'round' as const,
  }
}

const resolveBottomOutlineFontStyle = (fontStyle: unknown) =>
  fontStyle === 'italic' ? ('italic bold' as const) : ('bold' as const)

/** 黑描边底层（神 UI / 全幅「底部描边」） */
export const resolveBottomInfoBlackStrokeLayer = (
  strokeEnabled: boolean,
  fontStyle: unknown = undefined,
  blackStrokeOptions: BottomInfoBlackStrokeOptions = {},
) => {
  const strokeWidth = resolveBottomInfoBlackStrokeWidthPx(blackStrokeOptions)
  if (!strokeEnabled || strokeWidth <= 0) return null
  return {
    fill: '#000000',
    stroke: '#000000',
    strokeWidth,
    fontStyle: resolveBottomOutlineFontStyle(fontStyle),
    lineJoin: 'round' as const,
    lineCap: 'round' as const,
    perfectDrawEnabled: true,
  }
}

/** 测量描边时的最大外扩（与 expandBottomInfoTextLayers 层叠一致） */
export const resolveBottomInfoStrokeMeasureProps = (
  options: BottomInfoTextStrokeOptions,
  fill: string,
) => {
  const {
    blackStroke = false,
    foregroundStroke = false,
    useYearStroke = false,
    useYearBlackStroke = false,
    useLegendIdStroke = false,
    shenForeground = false,
  } = options
  if (!blackStroke && !foregroundStroke) return {}
  if (blackStroke) {
    const blackLayer = resolveBottomInfoBlackStrokeLayer(true, undefined, {
      useYearBlackStroke,
    })
    if (blackLayer) return blackLayer
  }
  return resolveBottomInfoForegroundStroke(fill, true, {
    useYearStroke,
    useLegendIdStroke,
    shenForeground,
  })
}

const withLayerName = (item: CanvasItemConfig, suffix: string, label: string) => ({
  ...item,
  code: `${item.code}${suffix}`,
  name: `${item.name ?? item.code}-${label}`,
})

/** 单段文字：可选黑描边底层 + 同色细描边前景 */
export const expandBottomInfoTextLayers = (
  item: CanvasItemConfig,
  options: BottomInfoTextStrokeOptions = {},
): CanvasItemConfig[] => {
  const {
    blackStroke = false,
    foregroundStroke = false,
    useYearStroke = false,
    useYearBlackStroke = false,
    useLegendIdStroke = false,
    shenForeground = false,
  } = options
  if (!blackStroke && !foregroundStroke) return [item]

  const fill = typeof item.fill === 'string' ? item.fill : '#FBF8F4'
  const layers: CanvasItemConfig[] = []
  const foregroundStrokeOptions = {
    useYearStroke,
    useLegendIdStroke,
    shenForeground,
  }
  const blackStrokeOptions = { useYearBlackStroke }

  if (blackStroke) {
    const blackLayer = resolveBottomInfoBlackStrokeLayer(true, item.fontStyle, blackStrokeOptions)
    if (blackLayer) {
      layers.push({
        ...withLayerName(item, LAYER_SUFFIX.strokeBlack, '黑描边'),
        ...blackLayer,
        ...CLEAR_SHADOW_PROPS,
      })
    }
  }

  layers.push({
    ...item,
    ...(foregroundStroke
      ? resolveBottomInfoForegroundStroke(fill, true, foregroundStrokeOptions)
      : {}),
    ...(blackStroke ? CLEAR_SHADOW_PROPS : {}),
  })

  return layers
}
