import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import Konva from 'konva'
import {
  QUOTE_FILL_COLOR,
  QUOTE_FONT_FAMILY,
  QUOTE_LINE_HEIGHT,
  QUOTE_SCALE_Y,
  QUOTE_SKEW_X,
  QUOTE_STROKE_COLOR,
  QUOTE_STROKE_EM,
  QUOTE_STROKE_MIN_PX,
} from '../../constants/quote'

type QuoteMeasureOptions = {
  fontSizePx: number
  fontFamily: string
  letterSpacingPx: number
}

const measureQuoteLineWidthPx = (
  lineText: string,
  { fontSizePx, fontFamily, letterSpacingPx }: QuoteMeasureOptions,
) =>
  new Konva.Text({
    text: lineText,
    fontSize: fontSizePx,
    fontFamily,
    letterSpacing: letterSpacingPx,
  }).width()

type QuoteBlockGeometry = {
  blockLeftX: number
  blockWidth: number
  visualLines: string[]
  lineStepPx: number
}

/**
 * 引言排版：整块右对齐，块内各行左缘对齐。
 * 单行时等价于右对齐；多行（手动回车或自动换行）时较短行与最长行左缘对齐。
 */
const buildQuoteBlockGeometry = (
  quoteText: string,
  quoteWidthPx: number,
  measureOptions: QuoteMeasureOptions,
  quoteX = 0,
): QuoteBlockGeometry | null => {
  if (!quoteText || quoteWidthPx <= 0) return null

  const visualLines = splitQuoteVisualLines(quoteText, quoteWidthPx, measureOptions)
  if (!visualLines.length) return null

  const { fontSizePx } = measureOptions
  const blockWidth = Math.max(
    ...visualLines.map((line) =>
      line ? measureQuoteLineWidthPx(line, measureOptions) : 0,
    ),
    0,
  )
  const blockRightX = quoteX + quoteWidthPx
  const blockLeftX = blockRightX - blockWidth

  return {
    blockLeftX,
    blockWidth,
    visualLines,
    lineStepPx: fontSizePx * QUOTE_LINE_HEIGHT,
  }
}

/** 按 Konva 换行宽度拆行（与引言测量一致） */
export const splitQuoteVisualLines = (
  text: string,
  widthPx: number,
  measureOptions: QuoteMeasureOptions,
): string[] => {
  if (!text || widthPx <= 0) return []

  const measure = (value: string) => measureQuoteLineWidthPx(value, measureOptions)

  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('')
      continue
    }
    let line = ''
    for (const char of paragraph) {
      const next = line + char
      if (measure(next) > widthPx && line) {
        lines.push(line)
        line = char
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

/** 引言块高度（与画布逐行渲染一致：行距、scaleY、skew、描边） */
export const measureQuoteBlockHeightPx = (
  text: string,
  widthPx: number,
  fontSizePx: number,
  fontFamily: string,
  letterSpacingPx = 0,
) => {
  const measureOptions = { fontSizePx, fontFamily, letterSpacingPx }
  const geometry = buildQuoteBlockGeometry(text, widthPx, measureOptions)
  if (!geometry) return 0

  const { blockLeftX, blockWidth, visualLines, lineStepPx } = geometry
  const strokeWidth =
    QUOTE_STROKE_EM > 0
      ? Math.max(QUOTE_STROKE_MIN_PX, fontSizePx * QUOTE_STROKE_EM)
      : 0
  const strokeProps =
    strokeWidth > 0 ? { stroke: '#000000', strokeWidth } : {}

  let maxBottom = 0
  visualLines.forEach((lineText, index) => {
    const node = new Konva.Text({
      text: lineText,
      fontSize: fontSizePx,
      fontFamily,
      letterSpacing: letterSpacingPx,
      width: blockWidth,
      align: 'left',
      lineHeight: QUOTE_LINE_HEIGHT,
      skewX: -QUOTE_SKEW_X,
      scaleY: QUOTE_SCALE_Y,
      x: blockLeftX,
      y: index * lineStepPx,
      ...strokeProps,
    })
    const rect = node.getClientRect({ skipTransform: false })
    maxBottom = Math.max(maxBottom, rect.y + rect.height)
  })
  return maxBottom
}

type BuildQuoteTextChildrenParams = {
  codePrefix: string
  quoteText: string
  quoteX: number
  quoteY: number
  quoteWidthPx: number
  quoteFontSizePx: number
  quoteLetterSpacingPx: number
}

/** 引言逐行文本节点（坐标相对技能描述组） */
export const buildQuoteTextChildren = ({
  codePrefix,
  quoteText,
  quoteX,
  quoteY,
  quoteWidthPx,
  quoteFontSizePx,
  quoteLetterSpacingPx,
}: BuildQuoteTextChildrenParams): CanvasItemConfig[] => {
  const measureOptions = {
    fontSizePx: quoteFontSizePx,
    fontFamily: QUOTE_FONT_FAMILY,
    letterSpacingPx: quoteLetterSpacingPx,
  }
  const geometry = buildQuoteBlockGeometry(
    quoteText,
    quoteWidthPx,
    measureOptions,
    quoteX,
  )
  if (!geometry) return []

  const { blockLeftX, blockWidth, visualLines, lineStepPx } = geometry
  const strokeProps =
    QUOTE_STROKE_EM > 0
      ? {
          stroke: QUOTE_STROKE_COLOR,
          strokeWidth: Math.max(QUOTE_STROKE_MIN_PX, quoteFontSizePx * QUOTE_STROKE_EM),
        }
      : {}

  return visualLines.map((lineText, index) => ({
    code: `${codePrefix}_quote_line_${index}`,
    name: `引言第${index + 1}行`,
    text: lineText,
    fontFamily: QUOTE_FONT_FAMILY,
    fontSize: quoteFontSizePx,
    fill: QUOTE_FILL_COLOR,
    letterSpacing: quoteLetterSpacingPx,
    width: blockWidth,
    align: 'left',
    lineHeight: QUOTE_LINE_HEIGHT,
    skewX: -QUOTE_SKEW_X,
    scaleY: QUOTE_SCALE_Y,
    x: blockLeftX,
    y: quoteY + index * lineStepPx,
    listening: false,
    ...strokeProps,
  }))
}
