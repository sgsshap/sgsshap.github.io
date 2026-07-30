/** 技能描述排版专用：Canvas 2D 测宽，避免逐字 new Konva.Text 阻塞主线程 */
let measureCanvas: HTMLCanvasElement | null = null
let measureContext: CanvasRenderingContext2D | null = null

const getMeasureContext = () => {
  if (typeof document === 'undefined') return null
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
    measureContext = measureCanvas.getContext('2d')
  }
  return measureContext
}

export type CanvasTextMeasureOptions = {
  text: string
  fontSizePx: number
  fontFamily: string
  letterSpacingPx: number
  italic?: boolean
  bold?: boolean
}

export const applyCanvasFont = (
  context: CanvasRenderingContext2D,
  fontSizePx: number,
  fontFamily: string,
  italic = false,
  bold = false,
) => {
  const fontStyle = italic ? 'italic' : 'normal'
  const fontWeight = bold ? 'bold' : 'normal'
  context.font = `${fontStyle} ${fontWeight} ${fontSizePx}px "${fontFamily}"`
}

export const measureCanvasTextWidth = ({
  text,
  fontSizePx,
  fontFamily,
  letterSpacingPx,
  italic = false,
  bold = false,
}: CanvasTextMeasureOptions): number => {
  if (!text) return 0

  const context = getMeasureContext()
  if (!context) return text.length * fontSizePx

  applyCanvasFont(context, fontSizePx, fontFamily, italic, bold)

  let width = context.measureText(text).width
  if (text.length > 1 && letterSpacingPx !== 0) {
    width += letterSpacingPx * (text.length - 1)
  }
  return width
}

export type CanvasTextBaselineMetrics = {
  width: number
  ascentPx: number
  descentPx: number
}

const DEFAULT_ASCENT_RATIO = 0.82
const DEFAULT_DESCENT_RATIO = 0.18

/** Canvas 2D 基线测量：混排多字体时比 Konva getSelfRect 底边对齐更跨端一致 */
export const measureCanvasTextBaseline = (
  options: CanvasTextMeasureOptions,
): CanvasTextBaselineMetrics => {
  const { text, fontSizePx, fontFamily, italic = false, bold = false } = options
  const width = measureCanvasTextWidth(options)
  if (!text) {
    return { width, ascentPx: 0, descentPx: 0 }
  }

  const context = getMeasureContext()
  if (!context) {
    return {
      width,
      ascentPx: fontSizePx * DEFAULT_ASCENT_RATIO,
      descentPx: fontSizePx * DEFAULT_DESCENT_RATIO,
    }
  }

  applyCanvasFont(context, fontSizePx, fontFamily, italic, bold)
  const metrics = context.measureText(text)
  const ascentPx =
    metrics.fontBoundingBoxAscent ??
    metrics.actualBoundingBoxAscent ??
    fontSizePx * DEFAULT_ASCENT_RATIO
  const descentPx =
    metrics.fontBoundingBoxDescent ??
    metrics.actualBoundingBoxDescent ??
    fontSizePx * DEFAULT_DESCENT_RATIO

  return { width, ascentPx, descentPx }
}

/** 与 Konva.Text 非 legacy 渲染一致的 baseline 距节点顶偏移（padding=0, lineHeight=1） */
export const resolveKonvaAlphabeticBaselineOffsetPx = (
  metrics: CanvasTextBaselineMetrics,
  fontSizePx: number,
  lineHeight = 1,
) => {
  const lineHeightPx = fontSizePx * lineHeight
  return (metrics.ascentPx - metrics.descentPx) / 2 + lineHeightPx / 2
}
