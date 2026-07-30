import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  BOTTOM_INFO_COPYRIGHT_BODY_SIZE_PT,
  BOTTOM_INFO_COPYRIGHT_KEY_LETTER_SPACING_PT,
  BOTTOM_INFO_COPYRIGHT_KEY_SIZE_PT,
  BOTTOM_INFO_COPYRIGHT_KEY_Y_OFFSET_MM,
  BOTTOM_INFO_COPYRIGHT_KEY_Y_OFFSET_SHEN_MM,
  BOTTOM_INFO_COPYRIGHT_PUBLISHER_SIZE_PT,
  BOTTOM_INFO_COPYRIGHT_PUBLISHER_Y_OFFSET_MM,
  BOTTOM_INFO_COPYRIGHT_PUBLISHER_Y_OFFSET_STROKE_MM,
  BOTTOM_INFO_COPYRIGHT_ROW_Y_OFFSET_MM,
  BOTTOM_INFO_COPYRIGHT_SPACE_SIZE_PT,
  BOTTOM_INFO_COPYRIGHT_SYMBOL_LETTER_SPACING_PT,
  BOTTOM_INFO_COPYRIGHT_SYMBOL_SIZE_PT,
  BOTTOM_INFO_COPYRIGHT_VALUE_SIZE_PT,
  BOTTOM_INFO_COPYRIGHT_VALUE_Y_OFFSET_MM,
  BOTTOM_INFO_COPYRIGHT_VALUE_Y_OFFSET_SHEN_MM,
  BOTTOM_INFO_COPYRIGHT_YEAR_LETTER_SPACING_PT,
  BOTTOM_INFO_COPYRIGHT_YEAR_SIZE_PT,
  BOTTOM_INFO_COPYRIGHT_YEAR_SIZE_SHEN_PT,
  BOTTOM_INFO_COPYRIGHT_YEAR_Y_OFFSET_MM,
  BOTTOM_INFO_COPYRIGHT_YEAR_Y_OFFSET_SHEN_MM,
  BOTTOM_INFO_FONT_FAMILY,
  BOTTOM_INFO_ID_FONT_FAMILY,
  BOTTOM_INFO_PUBLISHER_FONT_FAMILY,
  BOTTOM_INFO_YEAR_FONT_FAMILY,
} from '../../constants/bottomInfo'
import {
  measureCanvasTextBaseline,
  resolveKonvaAlphabeticBaselineOffsetPx,
  type CanvasTextBaselineMetrics,
} from '../skills-desc/canvasTextMeasure'
import {
  expandBottomInfoTextLayers,
  resolveBottomInfoCopyrightBlackStroke,
  resolveBottomInfoCopyrightSegmentStrokeOptions,
} from './strokeLayers'

export type CopyrightSegmentKind =
  | 'symbol'
  | 'year'
  | 'space'
  | 'body'
  | 'publisher'
  | 'key'
  | 'keySpace'
  | 'value'

export type CopyrightSegment = {
  kind: CopyrightSegmentKind
  text: string
}

/** 解析版权栏：`™&© {year} {publisher} .{key}: {value}`（publisher 段按位置识别，不限定字面文案） */
export const parseCopyrightSegments = (copyright: string): CopyrightSegment[] => {
  if (!copyright) return []

  const copyIdx = copyright.indexOf('© ')
  if (copyIdx < 0) {
    return [{ kind: 'body', text: copyright }]
  }

  const segments: CopyrightSegment[] = []

  segments.push({ kind: 'symbol', text: copyright.slice(0, copyIdx + 1) })

  let pos = copyIdx + 1

  let spaceAfterSymbol = ''
  while (pos < copyright.length && /\s/.test(copyright.charAt(pos))) {
    spaceAfterSymbol += copyright.charAt(pos)
    pos += 1
  }
  let yearDigits = ''
  while (pos < copyright.length && /\d/.test(copyright.charAt(pos))) {
    yearDigits += copyright.charAt(pos)
    pos += 1
  }
  if (spaceAfterSymbol) segments.push({ kind: 'space', text: spaceAfterSymbol })
  if (yearDigits) segments.push({ kind: 'year', text: yearDigits })

  let spaceAfterYear = ''
  while (pos < copyright.length && /\s/.test(copyright.charAt(pos))) {
    spaceAfterYear += copyright.charAt(pos)
    pos += 1
  }

  const markerIdx = copyright.indexOf(' .', pos)
  const colonIdx = markerIdx >= 0 ? copyright.indexOf(': ', markerIdx) : -1
  if (markerIdx < 0 || colonIdx <= markerIdx) {
    if (spaceAfterYear) segments.push({ kind: 'space', text: spaceAfterYear })
    const publisherText = copyright.slice(pos)
    if (publisherText) segments.push({ kind: 'publisher', text: publisherText })
    return segments
  }

  if (spaceAfterYear) segments.push({ kind: 'space', text: spaceAfterYear })
  const publisherText = copyright.slice(pos, markerIdx)
  if (publisherText) segments.push({ kind: 'publisher', text: publisherText })

  segments.push({ kind: 'space', text: ' ' })
  segments.push({ kind: 'body', text: '.' })
  const keyText = copyright.slice(markerIdx + 2, colonIdx)
  if (keyText) segments.push({ kind: 'key', text: keyText })
  segments.push({ kind: 'body', text: ':' })
  segments.push({ kind: 'keySpace', text: ' ' })

  const valueText = copyright.slice(colonIdx + 2)
  if (valueText) segments.push({ kind: 'value', text: valueText })

  return segments
}

const sizePtForKind = (kind: CopyrightSegmentKind, shenForeground: boolean) => {
  switch (kind) {
    case 'symbol':
      return BOTTOM_INFO_COPYRIGHT_SYMBOL_SIZE_PT
    case 'year':
      return shenForeground
        ? BOTTOM_INFO_COPYRIGHT_YEAR_SIZE_SHEN_PT
        : BOTTOM_INFO_COPYRIGHT_YEAR_SIZE_PT
    case 'space':
      return BOTTOM_INFO_COPYRIGHT_SPACE_SIZE_PT
    case 'publisher':
      return BOTTOM_INFO_COPYRIGHT_PUBLISHER_SIZE_PT
    case 'key':
    case 'keySpace':
      return BOTTOM_INFO_COPYRIGHT_KEY_SIZE_PT
    case 'value':
      return BOTTOM_INFO_COPYRIGHT_VALUE_SIZE_PT
    default:
      return BOTTOM_INFO_COPYRIGHT_BODY_SIZE_PT
  }
}

const letterSpacingPtForKind = (kind: CopyrightSegmentKind, text: string) => {
  switch (kind) {
    case 'symbol':
      return BOTTOM_INFO_COPYRIGHT_SYMBOL_LETTER_SPACING_PT
    case 'year':
      return BOTTOM_INFO_COPYRIGHT_YEAR_LETTER_SPACING_PT
    case 'key':
    case 'keySpace':
      return BOTTOM_INFO_COPYRIGHT_KEY_LETTER_SPACING_PT
    case 'body':
      if (text === '.' || text === ':') {
        return BOTTOM_INFO_COPYRIGHT_KEY_LETTER_SPACING_PT
      }
      return 0
    default:
      return 0
  }
}

const fontFamilyForKind = (kind: CopyrightSegmentKind) => {
  if (kind === 'publisher') return BOTTOM_INFO_PUBLISHER_FONT_FAMILY
  switch (kind) {
    case 'symbol':
    case 'key':
    case 'keySpace':
      return BOTTOM_INFO_ID_FONT_FAMILY
    case 'year':
      return BOTTOM_INFO_YEAR_FONT_FAMILY
    case 'space':
    case 'body':
    case 'value':
      return BOTTOM_INFO_FONT_FAMILY
    default:
      return BOTTOM_INFO_FONT_FAMILY
  }
}

type LayoutCopyrightSegmentsParams = {
  copyright: string
  codePrefix: string
  originX: number
  fill: string
  /** 神 UI / 全幅黑色外描边 */
  blackStrokeFlag: boolean
  /** 普通势力同色细描边（对应旧站 textBoldFlag 默认开启） */
  foregroundStrokeFlag: boolean
  /** 神 UI / 全幅前景描边宽度档位 */
  shenForeground: boolean
  ptToPx: (pt: number) => number
  mmToPx: (mm: number) => number
}

const yOffsetMmForKind = (
  kind: CopyrightSegmentKind,
  blackStrokeFlag: boolean,
  shenForeground: boolean,
) => {
  if (kind === 'year') {
    return shenForeground
      ? BOTTOM_INFO_COPYRIGHT_YEAR_Y_OFFSET_SHEN_MM
      : BOTTOM_INFO_COPYRIGHT_YEAR_Y_OFFSET_MM
  }
  if (kind === 'key') {
    return shenForeground
      ? BOTTOM_INFO_COPYRIGHT_KEY_Y_OFFSET_SHEN_MM
      : BOTTOM_INFO_COPYRIGHT_KEY_Y_OFFSET_MM
  }
  if (kind === 'value') {
    return shenForeground
      ? BOTTOM_INFO_COPYRIGHT_VALUE_Y_OFFSET_SHEN_MM
      : BOTTOM_INFO_COPYRIGHT_VALUE_Y_OFFSET_MM
  }
  if (kind !== 'publisher') return 0
  return resolveBottomInfoCopyrightBlackStroke(blackStrokeFlag)
    ? BOTTOM_INFO_COPYRIGHT_PUBLISHER_Y_OFFSET_STROKE_MM
    : BOTTOM_INFO_COPYRIGHT_PUBLISHER_Y_OFFSET_MM
}

type PreparedCopyrightSegment = {
  segment: CopyrightSegment
  index: number
  fontSizePx: number
  fontFamily: string
  letterSpacingPx: number
  metrics: CanvasTextBaselineMetrics
  yOffsetPx: number
}

const measureCopyrightSegment = (
  segment: CopyrightSegment,
  index: number,
  ptToPx: (pt: number) => number,
  mmToPx: (mm: number) => number,
  blackStrokeFlag: boolean,
  shenForeground: boolean,
): PreparedCopyrightSegment => {
  const fontSizePt = sizePtForKind(segment.kind, shenForeground)
  const fontSizePx = ptToPx(fontSizePt)
  const fontFamily = fontFamilyForKind(segment.kind)
  const letterSpacingPx = ptToPx(letterSpacingPtForKind(segment.kind, segment.text))
  const metrics = measureCanvasTextBaseline({
    text: segment.text,
    fontSizePx,
    fontFamily,
    letterSpacingPx,
  })

  return {
    segment,
    index,
    fontSizePx,
    fontFamily,
    letterSpacingPx,
    metrics,
    yOffsetPx: mmToPx(yOffsetMmForKind(segment.kind, blackStrokeFlag, shenForeground)),
  }
}

/** 按当前版权/编号内容解析底部信息实际需要的 Web 字体族 */
export const resolveBottomInfoFontFamilies = (
  info: LegendInfo,
  showFlag: boolean,
): string[] => {
  if (!showFlag) return []

  const families = new Set<string>()

  if (info.baseInfo.copyright) {
    for (const segment of parseCopyrightSegments(info.baseInfo.copyright)) {
      families.add(fontFamilyForKind(segment.kind))
    }
  }

  if (info.baseInfo.legendId) {
    families.add(BOTTOM_INFO_FONT_FAMILY)
  }

  return [...families]
}

/** 版权栏共享 alphabetic baseline（与 {@link layoutCopyrightSegments} 一致） */
export const resolveBottomInfoCopyrightBaselineY = (
  copyright: string,
  ptToPx: (pt: number) => number,
  mmToPx: (mm: number) => number,
  blackStrokeFlag: boolean,
  shenForeground: boolean,
): number | null => {
  const segments = parseCopyrightSegments(copyright)
  if (!segments.length) return null

  const prepared = segments.map((segment, index) =>
    measureCopyrightSegment(segment, index, ptToPx, mmToPx, blackStrokeFlag, shenForeground),
  )
  const baselineY = Math.max(
    ...prepared.map((item) =>
      resolveKonvaAlphabeticBaselineOffsetPx(item.metrics, item.fontSizePx),
    ),
    0,
  )
  return baselineY + mmToPx(BOTTOM_INFO_COPYRIGHT_ROW_Y_OFFSET_MM)
}

/** 版权栏逐段横排（各段独立字号；共享 alphabetic baseline） */
export const layoutCopyrightSegments = ({
  copyright,
  codePrefix,
  originX,
  fill,
  blackStrokeFlag,
  foregroundStrokeFlag,
  shenForeground,
  ptToPx,
  mmToPx,
}: LayoutCopyrightSegmentsParams): CanvasItemConfig[] => {
  const segments = parseCopyrightSegments(copyright)
  if (!segments.length) return []

  const prepared = segments.map((segment, index) =>
    measureCopyrightSegment(segment, index, ptToPx, mmToPx, blackStrokeFlag, shenForeground),
  )

  const baselineY = Math.max(
    ...prepared.map((item) =>
      resolveKonvaAlphabeticBaselineOffsetPx(item.metrics, item.fontSizePx),
    ),
    0,
  )
  const rowOffsetPx = mmToPx(BOTTOM_INFO_COPYRIGHT_ROW_Y_OFFSET_MM)
  let cursorX = originX

  return prepared.flatMap(
    ({ segment, index, fontSizePx, fontFamily, letterSpacingPx, metrics, yOffsetPx }) => {
      const x = cursorX
      cursorX += metrics.width
      const baselineOffsetPx = resolveKonvaAlphabeticBaselineOffsetPx(metrics, fontSizePx)
      const y = baselineY - baselineOffsetPx + yOffsetPx + rowOffsetPx
      const code = `${codePrefix}_copyright_${segment.kind}_${index}`
      const name = `版权-${segment.kind}`

      return expandBottomInfoTextLayers(
        {
          code,
          name,
          text: segment.text,
          fontFamily:
            segment.kind === 'publisher'
              ? BOTTOM_INFO_PUBLISHER_FONT_FAMILY
              : fontFamily,
          fontSize: fontSizePx,
          letterSpacing: letterSpacingPx,
          fill,
          x,
          y,
          listening: false,
        } as CanvasItemConfig,
        resolveBottomInfoCopyrightSegmentStrokeOptions(
          segment.kind,
          blackStrokeFlag,
          foregroundStrokeFlag,
          shenForeground,
        ),
      )
    },
  )
}
