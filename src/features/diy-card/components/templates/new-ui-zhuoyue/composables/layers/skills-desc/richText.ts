import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import {
  resolveSkillDescStrokeEm,
  SKILL_DESC_SUIT_COLOR_RED,
  SKILL_DESC_UNDERLINE_OFFSET_FROM_TOP_EM,
  SKILL_DESC_UNDERLINE_THICKNESS_EM,
} from '../../constants/skills'
import {
  expandBottomInfoTextLayers,
  resolveBottomInfoCopyrightBlackStroke,
} from '../bottom-info/strokeLayers'
import { measureCanvasTextWidth } from './canvasTextMeasure'

export type SkillDescSpanStyle = {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  color: string
  /** <full> 全角格：占 1em 字宽并在格内居中（含衍生技字体） */
  fullWidthCell?: boolean
}

export type SkillDescGlyph = {
  char: string
  style: SkillDescSpanStyle
}

export type SkillDescRichTextLayout = {
  height: number
  width: number
  items: CanvasItemConfig[]
}

const createDefaultStyle = (color: string): SkillDescSpanStyle => ({
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color,
  fullWidthCell: false,
})

/** 较长闭合标签须排在 </s>、</b> 等短标签之前，避免 </span> 被误识别为 </s> */
const TAG_TOKEN_RE =
  /<br\s*\/?>|<\/?bi>|<\/?b>|<\/?i>|<span\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')\s*>|<\/span>|<\/?u>|<\/?full>|<\/?s>|&nbsp;/gi

/** 保留用户输入的弯引号/中文标点，勿转为 ASCII 直引号（否则画布上会显示为英文引号） */
export const normalizeSkillDescMarkupInput = (raw: string) => raw

const styleKey = (style: SkillDescSpanStyle) =>
  [
    style.bold ? 1 : 0,
    style.italic ? 1 : 0,
    style.underline ? 1 : 0,
    style.strikethrough ? 1 : 0,
    style.color,
    style.fullWidthCell ? 1 : 0,
  ].join('|')

const cloneStyle = (style: SkillDescSpanStyle): SkillDescSpanStyle => ({ ...style })

const normalizeSkillDescFillColor = (color: string, fallback: string) => {
  const trimmed = color.trim()
  if (!trimmed) return fallback
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`
  return trimmed
}

const parseSpanColor = (styleAttr: string, fallback: string) => {
  const match = /color:\s*([^;'"]+)/i.exec(styleAttr)
  const raw = match?.[1]?.trim()
  if (!raw) return fallback
  return normalizeSkillDescFillColor(raw, fallback)
}

const resolveSuitColor = (char: string) => {
  if (char === '♦' || char === '♥') return SKILL_DESC_SUIT_COLOR_RED
  if (char === '♣' || char === '♠') return '#000000'
  return undefined
}

const pushGlyphs = (
  glyphs: SkillDescGlyph[],
  text: string,
  style: SkillDescSpanStyle,
) => {
  for (const char of text) {
    if (char === '\r') continue
    const suitColor = resolveSuitColor(char)
    glyphs.push({
      char: char === '\n' ? '\n' : char,
      style: suitColor ? { ...style, color: suitColor } : style,
    })
  }
}

type RichTextStrokeMode = 'skillDesc' | 'bottomInfo'

type RichTextRenderContext = {
  fontSizePx: number
  fontFamily: string
  letterSpacingPx: number
  /** Konva Text lineHeight（与 layout 行距一致，避免默认 1 裁切高字形顶部） */
  lineHeight: number
  strokeMode: RichTextStrokeMode
  /** 衍生技描述：正文与加粗使用独立描边标量 */
  derivedSkillFlag?: boolean
  /** 技能描述「新版字体」开关（衍生技描边仅新字体启用） */
  newFontFlag?: boolean
  /** 技能描述「加粗」开关 */
  textBoldFlag?: boolean
  defaultFill: string
  bottomInfoBlackStroke?: boolean
  bottomInfoForegroundStroke?: boolean
  bottomInfoShenForeground?: boolean
  bottomInfoLegendIdStroke?: boolean
  segmentName?: string
}

type MarkupStyleStack = { tag: string; style: SkillDescSpanStyle }[]

const pushStyleTag = (
  stack: MarkupStyleStack,
  tag: string,
  patch: Partial<SkillDescSpanStyle>,
) => {
  const parent = stack[stack.length - 1]!.style
  stack.push({ tag, style: { ...parent, ...patch } })
}

const popToTag = (stack: MarkupStyleStack, tag: string) => {
  while (stack.length > 1) {
    const top = stack[stack.length - 1]!
    stack.pop()
    if (top.tag === tag) break
  }
}

const OPEN_TAG_PATCHES: Record<string, Partial<SkillDescSpanStyle>> = {
  '<b>': { bold: true },
  '<i>': { italic: true },
  '<bi>': { bold: true, italic: true },
  '<s>': { strikethrough: true },
  '<u>': { underline: true },
  '<full>': { fullWidthCell: true },
}

const CLOSE_TAGS = new Set(['b', 'i', 'bi', 's', 'u', 'full', 'span'])

const applyMarkupToken = (
  token: string,
  match: RegExpExecArray,
  glyphs: SkillDescGlyph[],
  stack: MarkupStyleStack,
) => {
  const currentStyle = () => stack[stack.length - 1]!.style

  if (token === '<br>' || token === '<br/>') {
    glyphs.push({ char: '\n', style: cloneStyle(currentStyle()) })
    return
  }

  const openPatch = OPEN_TAG_PATCHES[token]
  if (openPatch) {
    pushStyleTag(stack, token.slice(1, -1), openPatch)
    return
  }

  if (token.startsWith('</')) {
    const tag = token.slice(2, -1)
    if (CLOSE_TAGS.has(tag)) popToTag(stack, tag)
    return
  }

  if (token.startsWith('<span')) {
    const styleAttr = match[1] ?? match[2] ?? ''
    const color = parseSpanColor(styleAttr, currentStyle().color)
    pushStyleTag(stack, 'span', { color })
    return
  }

  if (token === '&nbsp;') {
    pushGlyphs(glyphs, '\u00A0', cloneStyle(currentStyle()))
  }
}

/** 解析技能描述标记为带样式的字序列 */
export const parseSkillDescMarkup = (
  raw: string,
  defaultColor = '#000000',
): SkillDescGlyph[] => {
  const markup = normalizeSkillDescMarkupInput(raw)
  const glyphs: SkillDescGlyph[] = []
  const stack: MarkupStyleStack = [
    { tag: 'root', style: cloneStyle(createDefaultStyle(defaultColor)) },
  ]

  let lastIndex = 0
  let match: RegExpExecArray | null
  TAG_TOKEN_RE.lastIndex = 0

  while ((match = TAG_TOKEN_RE.exec(markup)) !== null) {
    if (match.index > lastIndex) {
      pushGlyphs(
        glyphs,
        markup.slice(lastIndex, match.index),
        cloneStyle(stack[stack.length - 1]!.style),
      )
    }

    applyMarkupToken(match[0].toLowerCase(), match, glyphs, stack)
    lastIndex = TAG_TOKEN_RE.lastIndex
  }

  if (lastIndex < markup.length) {
    pushGlyphs(glyphs, markup.slice(lastIndex), cloneStyle(stack[stack.length - 1]!.style))
  }

  return glyphs
}

type MeasureContext = {
  fontSizePx: number
  fontFamily: string
  letterSpacingPx: number
}

const measureCache = new Map<string, number>()

const measureTextWidth = (
  text: string,
  ctx: MeasureContext,
  style: SkillDescSpanStyle,
) => {
  if (!text) return 0
  const cacheKey = `${text}|${ctx.fontFamily}|${ctx.fontSizePx}|${ctx.letterSpacingPx}|${style.italic ? 1 : 0}|${style.bold ? 1 : 0}`
  const cached = measureCache.get(cacheKey)
  if (cached !== undefined) return cached

  const width = measureCanvasTextWidth({
    text,
    fontSizePx: ctx.fontSizePx,
    fontFamily: ctx.fontFamily,
    letterSpacingPx: ctx.letterSpacingPx,
    italic: style.italic,
    bold: style.bold,
  })

  measureCache.set(cacheKey, width)
  return width
}

/** <full> 全角格宽度：1em，与中文汉字占位一致 */
const resolveFullWidthCellWidthPx = (ctx: MeasureContext) => ctx.fontSizePx

const measureGlyphWidth = (glyph: SkillDescGlyph, ctx: MeasureContext) => {
  if (glyph.char === '\n') return 0
  if (glyph.style.fullWidthCell) {
    return resolveFullWidthCellWidthPx(ctx)
  }
  return measureTextWidth(glyph.char, ctx, glyph.style)
}

/** 全角格内将字形水平居中 */
const resolveFullWidthCellTextOffsetPx = (
  text: string,
  cellWidthPx: number,
  measureCtx: MeasureContext,
  style: SkillDescSpanStyle,
) => {
  const naturalWidth = measureTextWidth(text, measureCtx, style)
  return Math.max(0, (cellWidthPx - naturalWidth) / 2)
}

const resolveStroke = (
  style: SkillDescSpanStyle,
  ctx: Pick<
    RichTextRenderContext,
    'fontSizePx' | 'strokeMode' | 'defaultFill' | 'derivedSkillFlag' | 'newFontFlag' | 'textBoldFlag'
  >,
) => {
  if (ctx.strokeMode === 'bottomInfo') {
    return {}
  }

  const strokeEm =
    ctx.strokeMode === 'skillDesc'
      ? resolveSkillDescStrokeEm(
          Boolean(ctx.textBoldFlag),
          Boolean(ctx.derivedSkillFlag),
          style.bold,
          Boolean(ctx.newFontFlag),
        )
      : 0
  if (strokeEm <= 0) {
    return { stroke: '', strokeWidth: 0, fillAfterStrokeEnabled: false }
  }

  /** 有色字用同色描边（与黑字描边粗细一致，避免纯 fill 在 Konva 10 下不生效） */
  const strokeColor =
    ctx.strokeMode === 'skillDesc' && style.color !== ctx.defaultFill
      ? style.color
      : '#000000'
  return {
    stroke: strokeColor,
    strokeWidth: ctx.fontSizePx * strokeEm,
    /** 描边在底层，减轻 Konva 默认「描边叠在填充上」导致的偏粗观感 */
    fillAfterStrokeEnabled: true,
  }
}

const resolveFontStyle = (style: SkillDescSpanStyle) => {
  if (style.italic) return 'italic' as const
  return 'normal' as const
}

/** 删除线仍走 Konva textDecoration；下划线自绘以控制贴字高度 */
const resolveTextDecoration = (style: SkillDescSpanStyle) =>
  style.strikethrough ? 'line-through' : undefined

const buildSkillDescUnderlineLayer = (
  code: string,
  boxX: number,
  y: number,
  spanWidth: number,
  fontSizePx: number,
  fill: string,
): CanvasItemConfig => ({
  code: `${code}_underline`,
  name: '技能描述下划线',
  x: boxX,
  y: y + fontSizePx * SKILL_DESC_UNDERLINE_OFFSET_FROM_TOP_EM,
  width: spanWidth,
  height: Math.max(1, fontSizePx * SKILL_DESC_UNDERLINE_THICKNESS_EM),
  fill,
  listening: false,
})

type PlacedGlyph = SkillDescGlyph & { x: number; y: number; width: number }

/** 不能出现在行首的标点、闭括号与连接符（含 / 等运算符） */
const LINE_START_FORBIDDEN_CHARS = new Set([
  '，', '。', '、', '；', '：', '！', '？',
  '」', '』', '）', '】', '》', '〉', '〕', '〗', '〙', '〛', '﹚', '﹜',
  ',', '.', ';', ':', '!', '?', ')', ']', '}', '"', "'", '…', '·', '—', '–',
  '’', '”', '％', '‰', '℃', '°',
  '/', '\\', '|', '~', '×', '÷', '±', '＋', '－', '＝', '＜', '＞', '•', '※',
])

const isLineStartForbidden = (char: string) => LINE_START_FORBIDDEN_CHARS.has(char)

const interGlyphGapPx = (ctx: MeasureContext) => ctx.letterSpacingPx

const measureLineWidth = (line: SkillDescGlyph[], ctx: MeasureContext) =>
  line.reduce((sum, glyph, index) => {
    const gap = index > 0 ? interGlyphGapPx(ctx) : 0
    return sum + gap + measureGlyphWidth(glyph, ctx)
  }, 0)

/** 将行首禁用的标点挪到上一行末尾，必要时从上一行借字 */
const relocateLeadingPunctuation = (
  current: SkillDescGlyph[],
  previous: SkillDescGlyph[],
  lineWidthPx: number,
  ctx: MeasureContext,
) => {
  const maxInnerPasses = current.length + previous.length + 4
  let innerPasses = 0

  while (current.length > 0 && isLineStartForbidden(current[0]!.char)) {
    if (innerPasses++ >= maxInnerPasses) break

    const punctuation = current.shift()!
    const previousWithPunctuation = [...previous, punctuation]

    if (measureLineWidth(previousWithPunctuation, ctx) > lineWidthPx && previous.length > 0) {
      const borrowed = previous.pop()!
      current.unshift(borrowed)
      // 借到的仍是行首禁则字（如「】」），继续挪会死循环；还原本次 shift，允许行首标点
      if (isLineStartForbidden(borrowed.char)) {
        current.splice(1, 0, punctuation)
        break
      }
    }

    previous.push(punctuation)
  }
}

/**
 * 行首不得为标点：将标点挪到上一行末尾；
 * 若上一行因此超宽，则从上一行末尾借一字到本行开头（凑字），再由两端对齐拉伸字间距消化。
 */
const fixPunctuationLineBreaks = (
  lines: SkillDescGlyph[][],
  lineWidthPx: number,
  ctx: MeasureContext,
) => {
  if (lines.length <= 1) return lines

  const maxOuterPasses = Math.max(
    lines.length * lines.reduce((sum, line) => sum + line.length, 0),
    1,
  )

  let lineIndex = 1
  let outerPasses = 0
  while (lineIndex < lines.length) {
    if (outerPasses++ > maxOuterPasses) break

    const current = lines[lineIndex]!
    const previous = lines[lineIndex - 1]!

    if (!current.length) {
      lines.splice(lineIndex, 1)
      continue
    }

    if (!isLineStartForbidden(current[0]!.char) || !previous.length) {
      lineIndex += 1
      continue
    }

    relocateLeadingPunctuation(current, previous, lineWidthPx, ctx)

    if (!current.length) {
      lines.splice(lineIndex, 1)
      continue
    }

    lineIndex += 1
  }

  return lines
}

const breakParagraph = (
  glyphs: SkillDescGlyph[],
  lineWidthPx: number,
  ctx: MeasureContext,
) => {
  const lines: SkillDescGlyph[][] = []
  let current: SkillDescGlyph[] = []
  let currentWidth = 0

  const flushLine = () => {
    if (current.length) lines.push(current)
    current = []
    currentWidth = 0
  }

  for (const glyph of glyphs) {
    if (glyph.char === '\n') {
      flushLine()
      continue
    }

    const gap = current.length > 0 ? interGlyphGapPx(ctx) : 0
    const width = measureGlyphWidth(glyph, ctx)
    if (current.length > 0 && currentWidth + gap + width > lineWidthPx) {
      if (isLineStartForbidden(glyph.char)) {
        const last = current.pop()!
        const removedGap = current.length > 0 ? interGlyphGapPx(ctx) : 0
        currentWidth -= removedGap + measureGlyphWidth(last, ctx)
        flushLine()
        current.push(last)
        currentWidth += measureGlyphWidth(last, ctx)
      } else {
        flushLine()
      }
    }
    const pushGap = current.length > 0 ? interGlyphGapPx(ctx) : 0
    current.push(glyph)
    currentWidth += pushGap + width
  }
  flushLine()
  return lines
}

const justifyLine = (
  line: SkillDescGlyph[],
  lineWidthPx: number,
  lineY: number,
  shouldJustify: boolean,
  ctx: MeasureContext,
): PlacedGlyph[] => {
  const widths = line.map((glyph) => measureGlyphWidth(glyph, ctx))
  const gapCount = Math.max(line.length - 1, 0)
  const baseGap = interGlyphGapPx(ctx)
  const naturalWidth = widths.reduce((sum, w) => sum + w, 0) + baseGap * gapCount
  const extraGap =
    shouldJustify && gapCount > 0 && naturalWidth <= lineWidthPx
      ? (lineWidthPx - naturalWidth) / gapCount
      : 0
  const totalGap = baseGap + extraGap

  let x = 0
  return line.map((glyph, index) => {
    const width = widths[index] ?? 0
    const placed: PlacedGlyph = { ...glyph, x, y: lineY, width }
    x += width + (index < gapCount ? totalGap : 0)
    return placed
  })
}

const appendSkillDescTextSegment = (
  items: CanvasItemConfig[],
  params: {
    style: SkillDescSpanStyle
    text: string
    boxX: number
    textX: number
    y: number
    spanWidth: number
    extraLetterSpacing: number
    measureCtx: MeasureContext
    renderCtx: RichTextRenderContext
    nextCode: (style: SkillDescSpanStyle) => string
  },
) => {
  const {
    style,
    text,
    boxX,
    textX,
    y,
    spanWidth,
    extraLetterSpacing,
    measureCtx,
    renderCtx,
    nextCode,
  } = params
  const code = nextCode(style)
  const baseItem = {
    code,
    name: renderCtx.segmentName ?? '技能描述片段',
    text,
    x: textX,
    y,
    fontSize: measureCtx.fontSizePx,
    fontFamily: measureCtx.fontFamily,
    lineHeight: renderCtx.lineHeight,
    fill: style.color,
    letterSpacing: measureCtx.letterSpacingPx + extraLetterSpacing,
    fontStyle: resolveFontStyle(style),
    textDecoration: resolveTextDecoration(style),
    ...resolveStroke(style, renderCtx),
    listening: false,
  } as CanvasItemConfig

  items.push(
    ...expandBottomInfoTextLayers(baseItem, {
      blackStroke: Boolean(renderCtx.bottomInfoBlackStroke),
      foregroundStroke: Boolean(renderCtx.bottomInfoForegroundStroke),
      useLegendIdStroke: Boolean(renderCtx.bottomInfoLegendIdStroke),
      shenForeground: Boolean(renderCtx.bottomInfoShenForeground),
    }),
  )

  if (style.underline && renderCtx.strokeMode === 'skillDesc') {
    items.push(
      buildSkillDescUnderlineLayer(
        code,
        boxX,
        y,
        spanWidth,
        measureCtx.fontSizePx,
        style.color,
      ),
    )
  }
}

const mergeLineGlyphs = (
  placed: PlacedGlyph[],
  measureCtx: MeasureContext,
  renderCtx: RichTextRenderContext,
  nextCode: (style: SkillDescSpanStyle) => string,
): CanvasItemConfig[] => {
  const items: CanvasItemConfig[] = []
  let index = 0

  while (index < placed.length) {
    const first = placed[index]!

    if (first.style.fullWidthCell) {
      const glyph = first
      const textX =
        glyph.x +
        resolveFullWidthCellTextOffsetPx(
          glyph.char,
          glyph.width,
          measureCtx,
          glyph.style,
        )
      appendSkillDescTextSegment(items, {
        style: glyph.style,
        text: glyph.char,
        boxX: glyph.x,
        textX,
        y: glyph.y,
        spanWidth: glyph.width,
        extraLetterSpacing: 0,
        measureCtx,
        renderCtx,
        nextCode,
      })
      index += 1
      continue
    }

    const key = styleKey(first.style)
    let end = index + 1
    while (end < placed.length && styleKey(placed[end]!.style) === key) end += 1

    const chunk = placed.slice(index, end)
    const text = chunk.map((g) => g.char).join('')
    const boxX = chunk[0]!.x
    const y = chunk[0]!.y
    const naturalWidth = measureTextWidth(text, measureCtx, first.style)
    const spanEnd = chunk[chunk.length - 1]!
    const spanWidth = spanEnd.x + spanEnd.width - boxX
    const extraLetterSpacing =
      text.length > 1 ? (spanWidth - naturalWidth) / (text.length - 1) : 0

    appendSkillDescTextSegment(items, {
      style: first.style,
      text,
      boxX,
      textX: boxX,
      y,
      spanWidth,
      extraLetterSpacing,
      measureCtx,
      renderCtx,
      nextCode,
    })

    index = end
  }

  return items
}

const layoutLineInline = (
  line: SkillDescGlyph[],
  lineY: number,
  measureCtx: MeasureContext,
): PlacedGlyph[] => {
  let x = 0
  return line.map((glyph) => {
    const width = measureGlyphWidth(glyph, measureCtx)
    const placed: PlacedGlyph = { ...glyph, x, y: lineY, width }
    x += width
    return placed
  })
}

const alignPlacedLines = (
  placed: PlacedGlyph[],
  align: 'left' | 'right',
  containerWidthPx?: number,
) => {
  if (align !== 'right' || !containerWidthPx) return placed

  const lineWidths = new Map<number, number>()
  placed.forEach((glyph) => {
    const end = glyph.x + glyph.width
    lineWidths.set(glyph.y, Math.max(lineWidths.get(glyph.y) ?? 0, end))
  })

  return placed.map((glyph) => {
    const lineWidth = lineWidths.get(glyph.y) ?? 0
    const offset = Math.max(0, containerWidthPx - lineWidth)
    return { ...glyph, x: glyph.x + offset }
  })
}

export type SkillDescRichTextOptions = {
  raw: string
  fontSizePx: number
  fontFamily: string
  widthPx: number
  lineHeight: number
  letterSpacingPx: number
  codePrefix: string
  /** 仅测高，跳过 Konva 片段合并（自动优化字号 / layout 测高用） */
  measureOnly?: boolean
  /** 衍生技：使用衍生描边标量 */
  derivedSkillFlag?: boolean
  /** 技能描述「新版字体」开关 */
  newFontFlag?: boolean
  /** 技能描述「加粗」开关 */
  textBoldFlag?: boolean
}

/** 排版技能描述富文本，返回 Konva 子节点配置与总高度 */
export const layoutSkillDescRichText = (
  options: SkillDescRichTextOptions,
): SkillDescRichTextLayout => {
  const measureOnly = options.measureOnly === true
  if (!measureOnly) {
    measureCache.clear()
  }

  const {
    raw,
    fontSizePx,
    fontFamily,
    widthPx,
    lineHeight,
    letterSpacingPx,
    codePrefix,
    derivedSkillFlag,
    newFontFlag,
    textBoldFlag,
  } = options

  const glyphs = parseSkillDescMarkup(raw.trim() || ' ')
  const measureCtx: MeasureContext = { fontSizePx, fontFamily, letterSpacingPx }
  const renderCtx: RichTextRenderContext = {
    fontSizePx,
    fontFamily,
    letterSpacingPx,
    lineHeight,
    strokeMode: 'skillDesc',
    derivedSkillFlag: Boolean(derivedSkillFlag),
    newFontFlag: Boolean(newFontFlag),
    textBoldFlag: Boolean(textBoldFlag),
    defaultFill: '#000000',
    segmentName: '技能描述片段',
  }
  const lineHeightPx = fontSizePx * lineHeight

  const paragraphs: SkillDescGlyph[][] = [[]]
  for (const glyph of glyphs) {
    if (glyph.char === '\n') {
      paragraphs.push([])
      continue
    }
    paragraphs[paragraphs.length - 1]!.push(glyph)
  }

  while (paragraphs.length > 0 && paragraphs[0]!.length === 0) {
    paragraphs.shift()
  }
  while (paragraphs.length > 0 && paragraphs[paragraphs.length - 1]!.length === 0) {
    paragraphs.pop()
  }
  if (!paragraphs.length) {
    paragraphs.push([])
  }

  const placedLines: PlacedGlyph[] = []
  let lineIndex = 0

  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!paragraph.length) {
      if (paragraphIndex < paragraphs.length - 1) lineIndex += 1
      return
    }

    const lines = fixPunctuationLineBreaks(
      breakParagraph(paragraph, widthPx, measureCtx),
      widthPx,
      measureCtx,
    )
    lines.forEach((line, lineInParagraph) => {
      /** 仅自动换行形成的中间行两端对齐；段落末行（含用户回车前的行）保持自然字距 */
      const shouldJustify = lineInParagraph < lines.length - 1
      const y = lineIndex * lineHeightPx
      placedLines.push(...justifyLine(line, widthPx, y, shouldJustify, measureCtx))
      lineIndex += 1
    })
  })

  const lineCount = Math.max(lineIndex, 1)
  const height = lineCount * lineHeightPx
  const contentWidth = placedLines.reduce(
    (max, glyph) => Math.max(max, glyph.x + glyph.width),
    0,
  )
  if (measureOnly) {
    return { height, width: Math.max(contentWidth, widthPx), items: [] }
  }

  const items: CanvasItemConfig[] = []
  let segmentIndex = 0
  const nextCode = (style: SkillDescSpanStyle) => {
    const styleSig = styleKey(style).replace(/\|/g, '-')
    return `${codePrefix}_${segmentIndex++}_${styleSig}`
  }

  let cursor = 0
  while (cursor < placedLines.length) {
    const lineY = placedLines[cursor]!.y
    const lineGlyphs: PlacedGlyph[] = []
    while (cursor < placedLines.length && placedLines[cursor]!.y === lineY) {
      lineGlyphs.push(placedLines[cursor]!)
      cursor += 1
    }
    items.push(...mergeLineGlyphs(lineGlyphs, measureCtx, renderCtx, nextCode))
  }

  return { height, width: Math.max(contentWidth, widthPx), items }
}

export type InlineRichTextOptions = {
  raw: string
  fontSizePx: number
  fontFamily: string
  defaultFill: string
  codePrefix: string
  align?: 'left' | 'right'
  containerWidthPx?: number
  lineHeight?: number
  letterSpacingPx?: number
  blackStrokeFlag?: boolean
  foregroundStrokeFlag?: boolean
  shenForeground?: boolean
}

/** 单行/多行横排富文本（无两端对齐），用于武将编号等 */
export const layoutInlineRichText = (
  options: InlineRichTextOptions,
): SkillDescRichTextLayout => {
  measureCache.clear()

  const {
    raw,
    fontSizePx,
    fontFamily,
    defaultFill,
    codePrefix,
    align = 'left',
    containerWidthPx,
    lineHeight = 1,
    letterSpacingPx = 0,
    blackStrokeFlag = false,
    foregroundStrokeFlag = false,
    shenForeground = false,
  } = options

  const glyphs = parseSkillDescMarkup(raw.trim(), defaultFill)
  const measureCtx: MeasureContext = { fontSizePx, fontFamily, letterSpacingPx }
  const renderCtx: RichTextRenderContext = {
    fontSizePx,
    fontFamily,
    letterSpacingPx,
    lineHeight,
    strokeMode: 'bottomInfo',
    defaultFill,
    bottomInfoBlackStroke: resolveBottomInfoCopyrightBlackStroke(blackStrokeFlag),
    bottomInfoForegroundStroke: foregroundStrokeFlag,
    bottomInfoShenForeground: shenForeground,
    bottomInfoLegendIdStroke: true,
    segmentName: '武将编号片段',
  }
  const lineHeightPx = fontSizePx * lineHeight

  const lines: SkillDescGlyph[][] = [[]]
  glyphs.forEach((glyph) => {
    if (glyph.char === '\n') {
      lines.push([])
      return
    }
    lines[lines.length - 1]!.push(glyph)
  })

  let placedLines: PlacedGlyph[] = []
  lines.forEach((line, lineIndex) => {
    if (!line.length) return
    const y = lineIndex * lineHeightPx
    placedLines.push(...layoutLineInline(line, y, measureCtx))
  })

  if (!placedLines.length) {
    return { height: lineHeightPx, width: 0, items: [] }
  }

  placedLines = alignPlacedLines(placedLines, align, containerWidthPx)

  const lineCount = Math.max(
    ...placedLines.map((glyph) => Math.floor(glyph.y / lineHeightPx) + 1),
    1,
  )
  const height = lineCount * lineHeightPx
  const contentWidth = placedLines.reduce(
    (max, glyph) => Math.max(max, glyph.x + glyph.width),
    0,
  )

  const items: CanvasItemConfig[] = []
  let segmentIndex = 0
  const nextCode = (style: SkillDescSpanStyle) => {
    const styleSig = styleKey(style).replace(/\|/g, '-')
    return `${codePrefix}_${segmentIndex++}_${styleSig}`
  }

  let cursor = 0
  while (cursor < placedLines.length) {
    const lineY = placedLines[cursor]!.y
    const lineGlyphs: PlacedGlyph[] = []
    while (cursor < placedLines.length && placedLines[cursor]!.y === lineY) {
      lineGlyphs.push(placedLines[cursor]!)
      cursor += 1
    }
    items.push(...mergeLineGlyphs(lineGlyphs, measureCtx, renderCtx, nextCode))
  }

  return {
    height,
    width: align === 'right' && containerWidthPx ? containerWidthPx : contentWidth,
    items,
  }
}

const richTextHeightCache = new Map<string, number>()
const RICH_TEXT_HEIGHT_CACHE_LIMIT = 512

const buildRichTextHeightCacheKey = (
  options: Omit<SkillDescRichTextOptions, 'codePrefix' | 'measureOnly'>,
) =>
  [
    options.raw,
    options.fontFamily,
    options.fontSizePx,
    options.widthPx,
    options.lineHeight,
    options.letterSpacingPx,
    options.derivedSkillFlag ? 1 : 0,
    options.newFontFlag ? 1 : 0,
    options.textBoldFlag ? 1 : 0,
  ].join('|')

/** 测量技能描述富文本块高度（带缓存，测高路径不构建 Konva 节点） */
export const measureSkillDescRichTextHeight = (
  options: Omit<SkillDescRichTextOptions, 'codePrefix' | 'measureOnly'>,
) => {
  const cacheKey = buildRichTextHeightCacheKey(options)
  const cached = richTextHeightCache.get(cacheKey)
  if (cached !== undefined) return cached

  const height = layoutSkillDescRichText({
    ...options,
    codePrefix: 'measure',
    measureOnly: true,
  }).height

  if (richTextHeightCache.size >= RICH_TEXT_HEIGHT_CACHE_LIMIT) {
    richTextHeightCache.clear()
  }
  richTextHeightCache.set(cacheKey, height)
  return height
}
