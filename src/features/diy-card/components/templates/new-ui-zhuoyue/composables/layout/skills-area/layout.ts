import {
  isMasterFlagActive,
  usesShenCardLayout,
} from '@/features/diy-card/composables/doubleKingdom'
import type { TemplateProps } from '@/features/diy-card/composables/template'
import {
  psTrackingToLetterSpacingPx,
  type DiyUnitConverters,
} from '@/features/diy-card/utils/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { toFixed } from '@/shared/utils/object'
import {
  BOTTOM_INFO_GAP_BELOW_LINE_MM,
  BOTTOM_INFO_HEIGHT_MM,
  BOTTOM_INFO_HEIGHT_SHEN_MM,
} from '../../constants/bottomInfo'
import { FULL_FRAME_SKILL_NAME_SPACING_MM } from '../../constants/fullFrame'
import {
  QUOTE_DEFAULT_MARGIN_BOTTOM_MM,
  QUOTE_DEFAULT_MARGIN_LEFT_MM,
  QUOTE_DEFAULT_MARGIN_RIGHT_MM,
  QUOTE_DEFAULT_MARGIN_TOP_MM,
  QUOTE_DEFAULT_TRACKING,
  QUOTE_FONT_FAMILY,
  QUOTE_MARGIN_RIGHT_SKEW_EXTRA_MM,
} from '../../constants/quote'
import {
  SKILL_DESC_AUTO_SIZE_FIT_SLACK_PX,
  SKILL_DESC_AUTO_SIZE_HEIGHT_RATIO,
  SKILL_DESC_AUTO_SIZE_MAX_FONT_PT,
  SKILL_DESC_AUTO_SIZE_ONE_STEP_RELAX_PX,
  SKILL_DESC_AUTO_SIZE_MIN_FONT_PT,
  SKILL_DESC_AUTO_SIZE_STEP_PT,
  SKILL_DESC_AUTO_OPTIMIZE_DEFAULT,
  SKILL_DESC_AUTO_SIZE_DEFAULT,
  ensureSkillsDescAutoOptimizeDefault,
  ensureSkillsDescAutoSizeDefault,
  resolveSkillsDescAutoSizeFlag,
  SKILL_DESC_BG_OPAQUE_DEFAULT,
  SKILL_DESC_BG_OPAQUE_SHEN_DEFAULT,
  SKILL_DESC_DEFAULT_FONT_SIZE_PT,
  SKILL_DESC_DEFAULT_MARGIN_BOTTOM_MM,
  SKILL_DESC_DEFAULT_MARGIN_LEFT_MM,
  SKILL_DESC_DEFAULT_MARGIN_RIGHT_MM,
  SKILL_DESC_DEFAULT_MARGIN_TOP_MM,
  SKILL_DESC_DEFAULT_PARA_SPACING_MM,
  SKILL_DESC_DEFAULT_SINGLE_LINE_PARA_SPACING_MM,
  SKILL_DESC_DEFAULT_TRACKING,
  SKILL_DESC_FIRST_BLOCK_MIN_MM,
  SKILL_DESC_FIRST_BLOCK_MIN_SHEN_MM,
  SKILL_DESC_LINE_WIDTH_MM,
  SKILL_DESC_LINE_X_MM,
  SKILL_DESC_MARGIN_SAFE_BOTTOM_MM,
  SKILL_DESC_MARGIN_SAFE_BOTTOM_SHEN_MM,
  SKILL_DESC_MARGIN_SAFE_LEFT_MM,
  SKILL_DESC_MARGIN_SAFE_LEFT_SHEN_MM,
  SKILL_DESC_MARGIN_SAFE_RIGHT_MM,
  SKILL_DESC_MARGIN_SAFE_RIGHT_SHEN_MM,
  SKILL_DESC_MARGIN_SAFE_TOP_MM,
  SKILL_DESC_MARGIN_SAFE_TOP_SHEN_MM,
  SKILL_DESC_MIN_HEIGHT_MM,
  SKILL_DESC_MIN_HEIGHT_SHEN_MM,
  SKILL_DESC_QUOTE_MIN_FONT_PT,
  SKILL_DESC_QUOTE_SIZE_DELTA_PT,
  SKILL_DESC_MARGIN_BOTTOM_NORMAL_BIAS_MM,
  SKILL_NAME_DEFAULT_MARGIN_TOP_MM,
  SKILL_NAME_FONT_SIZE_PT,
  SKILL_NAME_ORIGIN_X_MM,
  SKILL_NAME_ORIGIN_X_SHEN_MM,
  SKILL_NAME_ORIGIN_Y_MM,
  SKILL_NAME_ORIGIN_Y_SHEN_MM,
  SKILL_NAME_TRACKING,
} from '../../constants/skills'
import { resolveSkillDescFontFamily, resolveSkillDescRawFromItem } from '../../layers/skills-desc/formatDesc'
import { measureQuoteBlockHeightPx } from '../../layers/skills-desc/quoteLines'
import { measureSkillDescRichTextHeight } from '../../layers/skills-desc/richText'
import {
  resolveShenSkillNameBadgeHeightPx,
  resolveShenSkillNameVisualCenterEstimatePx,
  resolveSkillNameBadgeHeightPx,
} from '../../layers/skills-name/skillNameFrame'
import { resolveSkillsDescFontSize } from '@/features/diy-card/utils/layoutItem'
import {
  psLeadingToKonvaLineHeight,
  clampSkillsDescAutoSizeFontPt,
  clampSkillsDescEditableFontSizePt,
  clampSkillsDescFontSizePt,
  resolveSkillsDescRowSpacingPt,
  resolveTrimStageHeight,
  resolveTrimStageWidth,
} from './scale'

const resolveSkillDescLetterSpacingPx = (spacingValue: number, fontSizePx: number) =>
  psTrackingToLetterSpacingPx(spacingValue, fontSizePx)

const resolveQuoteLetterSpacingPx = (
  quoteItem: LegendInfo['renderConfig']['items']['quote'],
  fontSizePx: number,
) =>
  resolveSkillDescLetterSpacingPx(
    typeof quoteItem.characterSpacing === 'number'
      ? quoteItem.characterSpacing
      : QUOTE_DEFAULT_TRACKING,
    fontSizePx,
  )

export type SkillBlockLayout = {
  index: number
  descY: number
  /** 描述正文测量高度（不含段间距） */
  descTextHeight: number
  /** 本技能与下一技能之间的空隙（画布 px，最后一段为下边距） */
  paraGapPx: number
  /** descTextHeight + paraGapPx */
  descHeight: number
  nameY: number
}

export type SkillsAreaLayout = {
  originX: number
  originY: number
  width: number
  height: number
  textInsetPx: number
  textWidthPx: number
  fontSizePx: number
  rowSpacingPx: number
  /** Konva lineHeight（PS 绝对 Leading ÷ 字号） */
  lineHeight: number
  letterSpacingPx: number
  badgeHeightPx: number
  quoteText: string
  /** 引言 x（相对技能区组，px；= 描述内盒左缘 + 引言左边距） */
  quoteX: number
  quoteY: number
  quoteWidthPx: number
  quoteHeight: number
  quoteFontSizePx: number
  quoteLetterSpacingPx: number
  /** 技能描述正文底缘 y（相对技能区组顶部，px） */
  skillsEndY: number
  /** 分隔线 x（相对技能描述组左侧，px） */
  dividerLineX: number
  /** 分隔线 y（相对技能描述组顶部，px） */
  dividerLineY: number
  /** 分隔线渲染宽（px） */
  dividerLineWidthPx: number
  /** 分隔线渲染高（px，由宽按素材比例推导） */
  dividerLineHeightPx: number
  /** 底部信息组 originY（画布绝对坐标，px） */
  bottomInfoOriginY: number
  /** 底栏区域高度（px） */
  bottomInfoHeightPx: number
  /** 技能描述热区高度（至分隔线顶缘，px） */
  skillsDescHitHeight: number
  /** 半透明底：相对组原点左偏移（延伸至模板 maxBleed 非出血预留区） */
  bgOffsetX: number
  /** 半透明底宽（成品区宽 + 左右 maxBleed） */
  bgWidth: number
  /** 半透明底高（内容高 + 底部 maxBleed） */
  bgHeight: number
  /** 用户上边距（px，不含安全区） */
  userMarginTopPx: number
  /** 技能区最小高度（px，含分隔线锚点约束） */
  minHeightPx: number
  blocks: SkillBlockLayout[]
}

/** 技能块布局签名：描述/技能名 Y 与高度变化时才需重载 skillsName */
export const skillsAreaBlockLayoutSignature = (layout: SkillsAreaLayout) =>
  layout.blocks
    .map((block) =>
      [
        block.descY,
        block.nameY,
        block.descTextHeight,
        block.descHeight,
      ].join(':'),
    )
    .join('|')

let publishedSkillsAreaBlockLayoutSignature = ''
let publishedSkillsAreaLayout: SkillsAreaLayout | null = null

export const publishSkillsAreaLayout = (layout: SkillsAreaLayout) => {
  publishedSkillsAreaBlockLayoutSignature = skillsAreaBlockLayoutSignature(layout)
  publishedSkillsAreaLayout = layout
}

/** @deprecated 请改用 publishSkillsAreaLayout */
export const publishSkillsAreaBlockLayoutSignature = (layout: SkillsAreaLayout) => {
  publishSkillsAreaLayout(layout)
}

export const getSkillsAreaBlockLayoutSignature = () => publishedSkillsAreaBlockLayoutSignature

export const getPublishedSkillsAreaLayout = () => publishedSkillsAreaLayout

export const clearPublishedSkillsAreaLayout = () => {
  publishedSkillsAreaBlockLayoutSignature = ''
  publishedSkillsAreaLayout = null
}

/** 技能区最小高度（mm）；未配置时使用模板默认值 */
export const resolveSkillsDescMinHeightMm = (
  info: LegendInfo,
  shenLayout?: boolean,
): number => {
  const custom = info.renderConfig.items.skillsDesc.minHeightMm
  if (typeof custom === 'number' && Number.isFinite(custom) && custom >= 0) {
    return custom
  }
  const shen = shenLayout ?? usesShenCardLayout(info)
  return shen ? SKILL_DESC_MIN_HEIGHT_SHEN_MM : SKILL_DESC_MIN_HEIGHT_MM
}

/** 神/普通卡面布局切换时，技能区最小高度回退为当前布局默认值 */
export const resetSkillsDescMinHeightOnShenLayoutChange = (
  info: LegendInfo,
  previousUsesShenLayout: boolean,
): boolean => {
  const nextUsesShenLayout = usesShenCardLayout(info)
  if (previousUsesShenLayout === nextUsesShenLayout) return false
  delete info.renderConfig.items.skillsDesc.minHeightMm
  return true
}

/** 由描述字号推导引言字号（pt，带上限下限） */
export const computeQuoteFontSizeFromSkillsDescPt = (descFontSizePt: number) =>
  toFixed(
    Math.max(
      descFontSizePt - SKILL_DESC_QUOTE_SIZE_DELTA_PT,
      SKILL_DESC_QUOTE_MIN_FONT_PT,
    ),
    2,
  )

const resolveQuoteFontSizePt = (
  descFontSizePt: number,
  quoteItem: LegendInfo['renderConfig']['items']['quote'],
  isReset: boolean,
) => {
  const autoPt = computeQuoteFontSizeFromSkillsDescPt(descFontSizePt)
  if (isReset || typeof quoteItem.size !== 'number' || quoteItem.size <= 0) {
    quoteItem.size = autoPt
  }
  return quoteItem.size
}

let dividerLineNaturalSize: { width: number; height: number } | null = null

/** 登记 line.png 固有尺寸，供布局按宽高比推导分隔线高度 */
export const setSkillDescDividerLineNaturalSize = (width: number, height: number) => {
  dividerLineNaturalSize = { width, height }
}

/** 分隔线高度：指定宽 × 素材宽高比 */
export const resolveSkillDescDividerLineHeightPx = (
  lineWidthPx: number,
  assetWidth: number,
  assetHeight: number,
) => (assetWidth > 0 ? lineWidthPx * (assetHeight / assetWidth) : 0)

type LayoutSkillDescBlocksParams = {
  info: LegendInfo
  marginTopPx: number
  paraSpacingPx: number
  singleLineParaSpacingPx: number
  fontSizePx: number
  textWidthPx: number
  lineHeight: number
  letterSpacingPx: number
  descFirstLineCenterPx: number
  nameVisualCenterEstimatePx: number
  mmToPx: (mm: number) => number
}

/** 自上而下排版技能描述正文 */
const layoutSkillDescBlocks = ({
  info,
  marginTopPx,
  paraSpacingPx,
  singleLineParaSpacingPx,
  fontSizePx,
  textWidthPx,
  lineHeight,
  letterSpacingPx,
  descFirstLineCenterPx,
  nameVisualCenterEstimatePx,
  mmToPx,
}: LayoutSkillDescBlocksParams) => {
  const blocks: SkillBlockLayout[] = []
  let cursorY = marginTopPx
  const lineHeightPx = fontSizePx * lineHeight
  const blockMinMm = usesShenCardLayout(info)
    ? SKILL_DESC_FIRST_BLOCK_MIN_SHEN_MM
    : SKILL_DESC_FIRST_BLOCK_MIN_MM

  info.baseInfo.skills.forEach((skill, index) => {
    const fontFamily = resolveSkillDescFontFamily(skill, info)
    const measureOptions = {
      raw: resolveSkillDescRawFromItem(skill.desc ?? '', info.renderConfig.items.skillsDesc),
      fontSizePx,
      fontFamily,
      widthPx: textWidthPx,
      lineHeight,
      letterSpacingPx,
      derivedSkillFlag: Boolean(skill.derivedFlag),
      newFontFlag: Boolean(info.renderConfig.items.skillsDesc.newFontFlag),
      textBoldFlag: Boolean(info.renderConfig.items.skillsDesc.textBoldFlag),
    }
    const rawDescTextHeight = measureSkillDescRichTextHeight(measureOptions)
    const isLastSkill = index >= info.baseInfo.skills.length - 1
    let descTextHeight = rawDescTextHeight
    if (!isLastSkill) {
      descTextHeight = Math.max(descTextHeight, mmToPx(blockMinMm))
    }

    const isSingleLine =
      lineHeightPx > 0 && rawDescTextHeight <= lineHeightPx + 0.01
    const paraGapPx = isLastSkill
      ? 0
      : isSingleLine
        ? singleLineParaSpacingPx
        : paraSpacingPx
    const blockHeight = descTextHeight + paraGapPx

    blocks.push({
      index,
      descY: cursorY,
      descTextHeight,
      paraGapPx,
      descHeight: blockHeight,
      nameY: resolveSkillNameGroupAlignY(
        info,
        cursorY,
        descFirstLineCenterPx,
        nameVisualCenterEstimatePx,
        mmToPx,
      ),
    })
    cursorY += blockHeight
  })

  return { blocks, skillsEndY: cursorY }
}

type LayoutQuoteAndDividerParams = {
  skillsEndY: number
  hasQuote: boolean
  quoteText: string
  quoteWidthPx: number
  quoteFontSizePx: number
  quoteLetterSpacingPx: number
  quoteMarginTopPx: number
  quoteMarginBottomPx: number
  marginBottomPx: number
  minHeightPx: number
}

/**
 * 自上而下：技能描述底缘 → 分隔线；引言锚定在分隔线上方（描述少时贴底，描述多时不低于描述+上边距）。
 * 引言上边距可为负，用于与描述重叠。
 */
const layoutQuoteAndDivider = ({
  skillsEndY,
  hasQuote,
  quoteText,
  quoteWidthPx,
  quoteFontSizePx,
  quoteLetterSpacingPx,
  quoteMarginTopPx,
  quoteMarginBottomPx,
  marginBottomPx,
  minHeightPx,
}: LayoutQuoteAndDividerParams) => {
  const contentBottomWithoutQuote = skillsEndY + marginBottomPx
  const dividerLineYWithoutQuote = Math.max(contentBottomWithoutQuote, minHeightPx)

  if (!hasQuote || quoteWidthPx <= 0) {
    return { skillsEndY, quoteY: 0, quoteHeight: 0, dividerLineY: dividerLineYWithoutQuote }
  }

  const quoteHeight = measureQuoteBlockHeightPx(
    quoteText,
    quoteWidthPx,
    quoteFontSizePx,
    QUOTE_FONT_FAMILY,
    quoteLetterSpacingPx,
  )

  const stackedQuoteBottom =
    skillsEndY + quoteMarginTopPx + quoteHeight + quoteMarginBottomPx + marginBottomPx
  const dividerLineY = Math.max(stackedQuoteBottom, minHeightPx)

  const bottomAnchoredQuoteY =
    dividerLineY - marginBottomPx - quoteMarginBottomPx - quoteHeight
  const quoteY = Math.max(skillsEndY + quoteMarginTopPx, bottomAnchoredQuoteY)

  return { skillsEndY, quoteY, quoteHeight, dividerLineY }
}

export type ComputeSkillsAreaLayoutOptions = {
  /** 测算指定字号时使用，跳过自动优化 */
  fontSizePtOverride?: number
  /** 技能名/底栏等只读布局时跳过自动优化，避免与 skillsDesc 重载重复测高 */
  skipAutoSizeResolve?: boolean
  /** 自动优化测高：不套用技能区最小高度，避免虚高导致字号偏小 */
  ignoreMinHeightForMeasure?: boolean
}

const applySkillsAreaLayoutReset = (info: LegendInfo) => {
  const descItem = info.renderConfig.items.skillsDesc
  const nameItem = info.renderConfig.items.skillsName
  const quoteItem = info.renderConfig.items.quote
  const defaultFontSizePt = SKILL_DESC_DEFAULT_FONT_SIZE_PT

  descItem.manualSizeFlag = false
  descItem.size = defaultFontSizePt
  descItem.characterSpacing = SKILL_DESC_DEFAULT_TRACKING
  descItem.rowSpacing = resolveSkillsDescRowSpacingPt(defaultFontSizePt)
  nameItem.size = SKILL_NAME_FONT_SIZE_PT
  nameItem.characterSpacing = SKILL_NAME_TRACKING
  descItem.marginRight = SKILL_DESC_DEFAULT_MARGIN_RIGHT_MM
  descItem.paraSpacing = SKILL_DESC_DEFAULT_PARA_SPACING_MM
  descItem.singleLineParaSpacing = SKILL_DESC_DEFAULT_SINGLE_LINE_PARA_SPACING_MM
  descItem.marginTop = SKILL_DESC_DEFAULT_MARGIN_TOP_MM
  descItem.marginLeft = SKILL_DESC_DEFAULT_MARGIN_LEFT_MM
  nameItem.marginTop = SKILL_NAME_DEFAULT_MARGIN_TOP_MM
  quoteItem.marginTop = QUOTE_DEFAULT_MARGIN_TOP_MM
  quoteItem.marginBottom = QUOTE_DEFAULT_MARGIN_BOTTOM_MM
  quoteItem.marginLeft = QUOTE_DEFAULT_MARGIN_LEFT_MM
  quoteItem.marginRight = QUOTE_DEFAULT_MARGIN_RIGHT_MM
  quoteItem.characterSpacing = QUOTE_DEFAULT_TRACKING
  quoteItem.manualSizeFlag = false
  descItem.marginBottom = SKILL_DESC_DEFAULT_MARGIN_BOTTOM_MM
  descItem.bgOpaque = resolveSkillDescBackgroundOpaqueDefault(info)
  descItem.autoOptimizeFlag = SKILL_DESC_AUTO_OPTIMIZE_DEFAULT
  descItem.autoOptimizeSizeFlag = SKILL_DESC_AUTO_SIZE_DEFAULT
  delete descItem.minHeightMm
}

const resolveSkillsAreaFontSizePt = (
  descItem: LegendInfo['renderConfig']['items']['skillsDesc'],
  options: ComputeSkillsAreaLayoutOptions | undefined,
  isReset: boolean,
) => {
  const defaultFontSizePt = SKILL_DESC_DEFAULT_FONT_SIZE_PT
  let fontSizePt = isReset
    ? defaultFontSizePt
    : resolveSkillsDescFontSize(descItem, defaultFontSizePt)

  if (options?.fontSizePtOverride !== undefined) {
    return options.fontSizePtOverride
  }

  fontSizePt = resolveSkillsDescFontSize(descItem, defaultFontSizePt)
  return resolveSkillsDescAutoSizeFlag(
    descItem.autoOptimizeSizeFlag,
    descItem.autoOptimizeFlag,
  )
    ? clampSkillsDescAutoSizeFontPt(fontSizePt)
    : clampSkillsDescFontSizePt(fontSizePt)
}

/** 根据当前模板数据计算技能区布局（skillsDesc / skillsName 共用） */
export const computeSkillsAreaLayout = (
  info: LegendInfo,
  props: TemplateProps,
  units: DiyUnitConverters,
  isReset: boolean,
  maxBleedPx = 0,
  options?: ComputeSkillsAreaLayoutOptions,
): SkillsAreaLayout => {
  const descItem = info.renderConfig.items.skillsDesc
  ensureSkillsDescAutoOptimizeDefault(descItem)
  ensureSkillsDescAutoSizeDefault(descItem)
  const descSizeBeforeResolve = descItem.size
  const quoteItem = info.renderConfig.items.quote
  const shenLayout = usesShenCardLayout(info)
  const trimWidth = resolveTrimStageWidth(props)
  /** 字号/行距：印刷 pt → 画布 px（与 PS、水印 ptToPx 一致） */
  const toSkillTextPx = (pt: number) => units.ptToPx(pt)
  const { mmToPx } = units

  const defaultFontSizePt = SKILL_DESC_DEFAULT_FONT_SIZE_PT
  let fontSizePt = resolveSkillsAreaFontSizePt(descItem, options, isReset)
  if (!descItem.size || descItem.size <= 0) {
    descItem.size = fontSizePt
  }

  if (isReset) {
    applySkillsAreaLayoutReset(info)
    fontSizePt = defaultFontSizePt
  }

  resolveSkillsDescAutoSizeOnLayout(info, props, units, maxBleedPx, options)

  fontSizePt = resolveSkillsAreaFontSizePt(descItem, options, isReset)
  descItem.size = fontSizePt

  if (!descItem.size || descItem.size <= 0) {
    descItem.size = fontSizePt
  }

  if (
    options?.fontSizePtOverride === undefined &&
    typeof descSizeBeforeResolve === 'number' &&
    descSizeBeforeResolve > 0 &&
    toFixed(descSizeBeforeResolve, 2) !== toFixed(fontSizePt, 2)
  ) {
    syncQuoteFontSizeFromSkillsDesc(info, fontSizePt, { force: true })
  }

  const fontSizePx = toSkillTextPx(fontSizePt)
  const autoRowSpacingPt = resolveSkillsDescRowSpacingPt(fontSizePt)
  const isMeasuringFontSize = options?.fontSizePtOverride !== undefined
  const sizeChanged =
    !isMeasuringFontSize &&
    typeof descSizeBeforeResolve === 'number' &&
    descSizeBeforeResolve > 0 &&
    toFixed(descSizeBeforeResolve, 2) !== toFixed(fontSizePt, 2)

  if (
    !isMeasuringFontSize &&
    (isReset || !descItem.rowSpacing || descItem.rowSpacing <= 0 || sizeChanged)
  ) {
    descItem.rowSpacing = autoRowSpacingPt
  }

  const rowSpacingPt = isMeasuringFontSize ? autoRowSpacingPt : descItem.rowSpacing
  const rowSpacingPx = toSkillTextPx(rowSpacingPt)
  const lineHeight = psLeadingToKonvaLineHeight(rowSpacingPt, fontSizePt)
  const letterSpacingPx = resolveSkillDescLetterSpacingPx(descItem.characterSpacing, fontSizePx)
  const toSkillDescMarginPx = (userMm: number, safeMm: number) => mmToPx(userMm + safeMm)
  const userMarginTopPx = mmToPx(descItem.marginTop ?? 0)
  const marginSafeTopMm = shenLayout
    ? SKILL_DESC_MARGIN_SAFE_TOP_SHEN_MM
    : SKILL_DESC_MARGIN_SAFE_TOP_MM
  const marginSafeRightMm = shenLayout
    ? SKILL_DESC_MARGIN_SAFE_RIGHT_SHEN_MM
    : SKILL_DESC_MARGIN_SAFE_RIGHT_MM
  const marginSafeBottomMm = shenLayout
    ? SKILL_DESC_MARGIN_SAFE_BOTTOM_SHEN_MM
    : SKILL_DESC_MARGIN_SAFE_BOTTOM_MM
  const marginSafeLeftMm = shenLayout
    ? SKILL_DESC_MARGIN_SAFE_LEFT_SHEN_MM
    : SKILL_DESC_MARGIN_SAFE_LEFT_MM
  const quoteText = (info.baseInfo.quote ?? '').replace(/ /g, ' ')
  const hasQuote = Boolean(quoteText)
  /** 用户上边距只影响背景/边框，不参与正文排版（避免整块描述区下移） */
  const marginTopLayoutPx = mmToPx(marginSafeTopMm)
  const marginBottomUserMm = descItem.marginBottom ?? 0
  const marginBottomLayoutMm =
    shenLayout || hasQuote
      ? marginBottomUserMm
      : marginBottomUserMm + SKILL_DESC_MARGIN_BOTTOM_NORMAL_BIAS_MM
  const marginBottomPx = toSkillDescMarginPx(marginBottomLayoutMm, marginSafeBottomMm)
  const paraSpacingPx = Math.max(0, mmToPx(descItem.paraSpacing ?? 0))
  const singleLineParaSpacingPx = Math.max(
    0,
    mmToPx(
      descItem.singleLineParaSpacing ?? SKILL_DESC_DEFAULT_SINGLE_LINE_PARA_SPACING_MM,
    ),
  )
  const marginRightPx = toSkillDescMarginPx(descItem.marginRight ?? 0, marginSafeRightMm)
  const marginLeftPx = toSkillDescMarginPx(descItem.marginLeft ?? 0, marginSafeLeftMm)
  const textInsetPx = marginLeftPx
  const width = trimWidth
  const textWidthPx = width - textInsetPx - marginRightPx
  const badgeHeightPx = shenLayout
    ? resolveShenSkillNameBadgeHeightPx(units.mmToPx)
    : resolveSkillNameBadgeHeightPx(units.mmToPx)
  const descFirstLineCenterPx = resolveSkillDescFirstLineCenterPx(fontSizePx)
  const nameVisualCenterEstimatePx = shenLayout
    ? resolveShenSkillNameVisualCenterEstimatePx(units.mmToPx, fontSizePx)
    : badgeHeightPx / 2

  /** 技能描述内边距盒（四边距 + 安全区，相对技能区组原点） */
  const descInnerLeftPx = marginLeftPx
  const descInnerRightPx = width - marginRightPx
  const descInnerWidthPx = descInnerRightPx - descInnerLeftPx

  const quoteMarginTopMm = quoteItem.marginTop ?? QUOTE_DEFAULT_MARGIN_TOP_MM
  const quoteMarginLeftMm = Math.max(0, quoteItem.marginLeft ?? QUOTE_DEFAULT_MARGIN_LEFT_MM)
  const quoteMarginRightMm = Math.max(0, quoteItem.marginRight ?? QUOTE_DEFAULT_MARGIN_RIGHT_MM)
  const quoteMarginBottomMm = Math.max(0, quoteItem.marginBottom ?? QUOTE_DEFAULT_MARGIN_BOTTOM_MM)
  const quoteMarginTopPx = mmToPx(quoteMarginTopMm)
  const quoteMarginLeftPx = mmToPx(quoteMarginLeftMm)
  const quoteMarginRightPx = mmToPx(quoteMarginRightMm + QUOTE_MARGIN_RIGHT_SKEW_EXTRA_MM)
  const quoteMarginBottomPx = mmToPx(quoteMarginBottomMm)

  /** 引言可用区：在描述内边距盒基础上再内缩引言左右边距 */
  const quoteX = descInnerLeftPx + quoteMarginLeftPx
  const quoteWidthPx = Math.max(0, descInnerWidthPx - quoteMarginLeftPx - quoteMarginRightPx)

  const quoteFontSizePt =
    options?.fontSizePtOverride !== undefined
      ? computeQuoteFontSizeFromSkillsDescPt(fontSizePt)
      : resolveQuoteFontSizePt(fontSizePt, quoteItem, isReset)
  const quoteFontSizePx = toSkillTextPx(quoteFontSizePt)
  const quoteLetterSpacingPx = resolveQuoteLetterSpacingPx(quoteItem, quoteFontSizePx)

  const minHeightPx = mmToPx(resolveSkillsDescMinHeightMm(info, shenLayout))
  const blocks = layoutSkillDescBlocks({
    info,
    marginTopPx: marginTopLayoutPx,
    paraSpacingPx,
    singleLineParaSpacingPx,
    fontSizePx,
    textWidthPx,
    lineHeight,
    letterSpacingPx,
    descFirstLineCenterPx,
    nameVisualCenterEstimatePx,
    mmToPx,
  })

  const { skillsEndY, quoteY, quoteHeight, dividerLineY } = layoutQuoteAndDivider({
    skillsEndY: blocks.skillsEndY,
    hasQuote,
    quoteText,
    quoteWidthPx,
    quoteFontSizePx,
    quoteLetterSpacingPx,
    quoteMarginTopPx,
    quoteMarginBottomPx,
    marginBottomPx,
    minHeightPx: options?.ignoreMinHeightForMeasure ? 0 : minHeightPx,
  })

  // 底栏锚点：分隔线 → 底栏（HEIGHT）→ GAP_BELOW_LINE → 底部信息
  const bottomInfoGapBelowLinePx = mmToPx(BOTTOM_INFO_GAP_BELOW_LINE_MM)
  const bottomInfoHeightPx = mmToPx(
    shenLayout ? BOTTOM_INFO_HEIGHT_SHEN_MM : BOTTOM_INFO_HEIGHT_MM,
  )
  const dividerLineWidthPx = mmToPx(SKILL_DESC_LINE_WIDTH_MM)
  const dividerLineX = mmToPx(SKILL_DESC_LINE_X_MM)
  const dividerLineHeightPx = shenLayout
    ? 0
    : dividerLineNaturalSize
      ? resolveSkillDescDividerLineHeightPx(
          dividerLineWidthPx,
          dividerLineNaturalSize.width,
          dividerLineNaturalSize.height,
        )
      : 0
  const bottomBarTopY = dividerLineY + dividerLineHeightPx
  // 技能区组 originY：自成品区底向上叠；用户上边距仅抬高背景上缘，不改变正文锚点
  const anchorDividerY = dividerLineY
  const contentHeight = anchorDividerY + dividerLineHeightPx + bottomInfoHeightPx

  const originX = props.stageOrigin.x
  const trimHeight = props.stageHeight - props.stageOrigin.y * 2
  const originY = props.stageOrigin.y + trimHeight - contentHeight
  const bottomInfoOriginY = originY + bottomBarTopY + bottomInfoGapBelowLinePx
  const skillsDescHitHeight = dividerLineY
  const bleedExtendPx = Math.max(0, maxBleedPx)
  const bgOffsetX = -bleedExtendPx
  const bgWidth = width + bleedExtendPx * 2
  const bgHeight = contentHeight + bleedExtendPx

  return {
    originX,
    originY,
    width,
    height: contentHeight,
    bgOffsetX,
    bgWidth,
    bgHeight,
    textInsetPx,
    textWidthPx,
    fontSizePx,
    rowSpacingPx,
    lineHeight,
    letterSpacingPx,
    badgeHeightPx,
    quoteText,
    quoteX,
    quoteY,
    quoteWidthPx,
    quoteHeight,
    quoteFontSizePx,
    quoteLetterSpacingPx,
    skillsEndY,
    dividerLineX,
    dividerLineY,
    dividerLineWidthPx,
    dividerLineHeightPx,
    bottomInfoOriginY,
    bottomInfoHeightPx,
    skillsDescHitHeight,
    userMarginTopPx,
    minHeightPx,
    blocks: blocks.blocks,
  }
}

export type FullBleedSkillsNameLayout = {
  originX: number
  originY: number
  width: number
  height: number
  spacingPx: number
  blocks: Array<{ index: number; nameY: number }>
}

/** 全幅模式技能区顶缘（画布绝对 y，px）：成品区底缘上移 × SKILL_DESC_AUTO_SIZE_HEIGHT_RATIO */
export const resolveFullBleedSkillZoneTopY = (props: TemplateProps) => {
  const trimHeight = resolveTrimStageHeight(props)
  return props.stageOrigin.y + trimHeight * (1 - SKILL_DESC_AUTO_SIZE_HEIGHT_RATIO)
}

/** 全幅模式：技能名标签自上而下固定间距排版 */
export const computeFullFrameSkillsNameLayout = (
  info: LegendInfo,
  props: TemplateProps,
  units: DiyUnitConverters,
): FullBleedSkillsNameLayout => {
  const trimWidth = resolveTrimStageWidth(props)
  const originX = props.stageOrigin.x
  const originY = resolveFullBleedSkillZoneTopY(props)
  const spacingPx = units.mmToPx(FULL_FRAME_SKILL_NAME_SPACING_MM)
  const nameMarginTopPx = units.mmToPx(info.renderConfig.items.skillsName.marginTop ?? 0)
  const badgeHeightPx = resolveSkillNameBadgeHeightPx(units.mmToPx)
  const skillCount = info.baseInfo.skills.length
  const height =
    skillCount > 0
      ? nameMarginTopPx + (skillCount - 1) * spacingPx + badgeHeightPx
      : badgeHeightPx + nameMarginTopPx
  const blocks = info.baseInfo.skills.map((_, index) => ({
    index,
    nameY: nameMarginTopPx + index * spacingPx,
  }))

  return {
    originX,
    originY,
    width: trimWidth,
    height,
    spacingPx,
    blocks,
  }
}

/** 技能描述首行纵向中心（相对描述块顶部，px） */
export const resolveSkillDescFirstLineCenterPx = (fontSizePx: number) => fontSizePx / 2

/** 技能名可见内容纵向中心（相对框组顶部，px） */
export const resolveSkillNameVisualCenterPx = (
  parts: Array<{ y: number; height: number }>,
) => {
  const top = Math.min(...parts.map((part) => part.y))
  const bottom = Math.max(...parts.map((part) => part.y + part.height))
  return (top + bottom) / 2
}

/** 技能名框组对齐 Y（不含用户上边距；布局/神势力背景用） */
export const resolveSkillNameGroupAlignY = (
  info: LegendInfo,
  descY: number,
  descFirstLineCenterPx: number,
  nameVisualCenterPx: number,
  mmToPx: (mm: number) => number,
) =>
  descY +
  descFirstLineCenterPx -
  nameVisualCenterPx +
  mmToPx(usesShenCardLayout(info) ? SKILL_NAME_ORIGIN_Y_SHEN_MM : SKILL_NAME_ORIGIN_Y_MM)

/** 技能名框组 originY：对齐基线 + 用户上边距（仅 skillsName 渲染使用） */
export const resolveSkillNameGroupY = (
  info: LegendInfo,
  descY: number,
  descFirstLineCenterPx: number,
  nameVisualCenterPx: number,
  mmToPx: (mm: number) => number,
) =>
  resolveSkillNameGroupAlignY(info, descY, descFirstLineCenterPx, nameVisualCenterPx, mmToPx) +
  mmToPx(info.renderConfig.items.skillsName.marginTop ?? 0)

export const resolveSkillNameOriginX = (
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: (mm: number) => number,
) =>
  props.stageOrigin.x +
  mmToPx(usesShenCardLayout(info) ? SKILL_NAME_ORIGIN_X_SHEN_MM : SKILL_NAME_ORIGIN_X_MM)

/** 当前卡面（普通 / 神）对应的技能描述背景默认不透明度（0–1） */
export const resolveSkillDescBackgroundOpaqueDefault = (info: LegendInfo) =>
  usesShenCardLayout(info)
    ? SKILL_DESC_BG_OPAQUE_SHEN_DEFAULT
    : SKILL_DESC_BG_OPAQUE_DEFAULT

/** 技能描述背景不透明度（0–1）；面板 bgOpaque，缺省按势力取默认常量 */
export const resolveSkillDescBackgroundOpaque = (info: LegendInfo) => {
  const raw = info.renderConfig.items.skillsDesc.bgOpaque
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return resolveSkillDescBackgroundOpaqueDefault(info)
  }
  return Math.min(1, Math.max(0, raw))
}

export const resolveSkillDescBackgroundColor = (info: LegendInfo) => {
  if (usesShenCardLayout(info)) return 'rgba(255, 255, 255, 0)'
  const bgOpaque = resolveSkillDescBackgroundOpaque(info)
  if (isMasterFlagActive(info)) return `rgba(235, 220, 168, ${bgOpaque})`
  return `rgba(255, 255, 255, ${bgOpaque})`
}

/** 引言字号随描述同步（quote = desc - delta pt，有下限）；锁定或手动改过引言字号时跳过，除非 force */
export const syncQuoteFontSizeFromSkillsDesc = (
  info: LegendInfo,
  fontSizePt: number,
  options?: { force?: boolean },
) => {
  const quoteItem = info.renderConfig.items.quote
  if (quoteItem.lockSizeFlag) return
  if (quoteItem.manualSizeFlag && !options?.force) return
  if (options?.force) {
    quoteItem.manualSizeFlag = false
  }
  quoteItem.size = computeQuoteFontSizeFromSkillsDescPt(fontSizePt)
}

export const markQuoteManualFontSize = (info: LegendInfo) => {
  info.renderConfig.items.quote.manualSizeFlag = true
}

type ApplySkillsDescFontSizeOptions = {
  /** 用户手动改字号时为 true，自动优化开启时保留手动值 */
  markManual?: boolean
}

/** 写入技能描述字号，并按标定点联动行距与引言（所有改描述字号的入口应优先走此函数） */
export const applySkillsDescFontSizePt = (
  info: LegendInfo,
  fontSizePt: number,
  options?: ApplySkillsDescFontSizeOptions,
) => {
  const descItem = info.renderConfig.items.skillsDesc
  const autoSizeEnabled = resolveSkillsDescAutoSizeFlag(
    descItem.autoOptimizeSizeFlag,
    descItem.autoOptimizeFlag,
  )
  const prevSizePt = descItem.size
  const clamped = clampSkillsDescEditableFontSizePt(
    fontSizePt,
    autoSizeEnabled,
  )
  if (options?.markManual && autoSizeEnabled) {
    descItem.manualSizeFlag = true
  }
  descItem.size = clamped
  descItem.rowSpacing = resolveSkillsDescRowSpacingPt(clamped)
  if (
    typeof prevSizePt !== 'number' ||
    prevSizePt <= 0 ||
    toFixed(prevSizePt, 2) !== toFixed(clamped, 2)
  ) {
    syncQuoteFontSizeFromSkillsDesc(info, clamped, { force: true })
  }
  return clamped
}

/** 用户手动写入引言字号（与描述联动解耦） */
export const applyQuoteFontSizePt = (info: LegendInfo, fontSizePt: number) => {
  const clamped = toFixed(Math.max(fontSizePt, SKILL_DESC_QUOTE_MIN_FONT_PT), 2)
  info.renderConfig.items.quote.size = clamped
  markQuoteManualFontSize(info)
  return clamped
}

/** 测量指定字号下技能区（描述+引言+分隔线）总高（px） */
export const measureSkillsBottomBlockHeightPx = (
  info: LegendInfo,
  props: TemplateProps,
  units: DiyUnitConverters,
  fontSizePt: number,
  maxBleedPx = 0,
  options?: { forAutoSize?: boolean },
) =>
  computeSkillsAreaLayout(info, props, units, false, maxBleedPx, {
    fontSizePtOverride: fontSizePt,
    skipAutoSizeResolve: true,
    ignoreMinHeightForMeasure: options?.forAutoSize,
  }).height

let skillsDescAutoSizeSyncing = false

/** 自动优化字号写入 renderConfig 时置位，避免 skillsDesc 深层 watch 重复触发 */
export const isSkillsDescAutoSizeSyncing = () => skillsDescAutoSizeSyncing

export const markSkillsDescManualFontSize = (info: LegendInfo) => {
  const descItem = info.renderConfig.items.skillsDesc
  if (
    !resolveSkillsDescAutoSizeFlag(descItem.autoOptimizeSizeFlag, descItem.autoOptimizeFlag)
  )
    return
  descItem.manualSizeFlag = true
}

export const clearSkillsDescManualFontSize = (info: LegendInfo) => {
  info.renderConfig.items.skillsDesc.manualSizeFlag = false
}

const resolveSkillsDescAutoSizeOnLayout = (
  info: LegendInfo,
  props: TemplateProps,
  units: DiyUnitConverters,
  maxBleedPx: number,
  options?: {
    fontSizePtOverride?: number
    skipAutoSizeResolve?: boolean
  },
) => {
  const descItem = info.renderConfig.items.skillsDesc
  if (
    !resolveSkillsDescAutoSizeFlag(descItem.autoOptimizeSizeFlag, descItem.autoOptimizeFlag) ||
    options?.fontSizePtOverride !== undefined ||
    options?.skipAutoSizeResolve
  ) {
    return
  }

  if (!descItem.manualSizeFlag) {
    syncAutoOptimizedSkillsDescFontSizePt(info, props, units, maxBleedPx)
    return
  }

  // 用户手动字号：仅钳制在自动优化区间 [5, 6.5] pt，不因溢出再缩小
  const manualPt = clampSkillsDescAutoSizeFontPt(
    descItem.size || SKILL_DESC_DEFAULT_FONT_SIZE_PT,
  )
  if (descItem.size !== manualPt) {
    applySkillsDescFontSizePt(info, manualPt)
  }
}

const syncAutoOptimizedSkillsDescFontSizePt = (
  info: LegendInfo,
  props: TemplateProps,
  units: DiyUnitConverters,
  maxBleedPx = 0,
): number => {
  const descItem = info.renderConfig.items.skillsDesc
  const allowGrow = !descItem.manualSizeFlag
  skillsDescAutoSizeSyncing = true
  try {
    const fontSizePt = applySkillsDescFontSizePt(
      info,
      resolveAutoOptimizedSkillsDescFontSizePt(info, props, units, maxBleedPx, { allowGrow }),
    )
    return fontSizePt
  } finally {
    skillsDescAutoSizeSyncing = false
  }
}

const enumerateAutoSizeFontPtSteps = (): number[] => {
  const steps: number[] = []
  for (
    let pt = SKILL_DESC_AUTO_SIZE_MIN_FONT_PT;
    pt <= SKILL_DESC_AUTO_SIZE_MAX_FONT_PT + 1e-6;
    pt += SKILL_DESC_AUTO_SIZE_STEP_PT
  ) {
    steps.push(toFixed(pt, 2))
  }
  return steps
}

const AUTO_SIZE_FONT_PT_STEPS = enumerateAutoSizeFontPtSteps()

const resolveAutoSizeStepIndex = (fontSizePt: number) => {
  const clamped = clampSkillsDescAutoSizeFontPt(fontSizePt)
  let idx = AUTO_SIZE_FONT_PT_STEPS.findIndex((step) => Math.abs(step - clamped) < 1e-3)
  if (idx >= 0) return idx
  idx = AUTO_SIZE_FONT_PT_STEPS.findIndex((step) => step >= clamped - 1e-6)
  return idx >= 0 ? idx : AUTO_SIZE_FONT_PT_STEPS.length - 1
}

export type ResolveAutoOptimizedSkillsDescFontSizeOptions = {
  /** 为 false 时保留用户手动字号，仅在溢出时缩小 */
  allowGrow?: boolean
}

/** 在 [min, max] 内搜索最大可用描述字号（技能区总高 ≤ 成品区高 × ratio） */
export const resolveAutoOptimizedSkillsDescFontSizePt = (
  info: LegendInfo,
  props: TemplateProps,
  units: DiyUnitConverters,
  maxBleedPx = 0,
  options?: ResolveAutoOptimizedSkillsDescFontSizeOptions,
): number => {
  const allowGrow = options?.allowGrow !== false
  const maxHeightPx = resolveTrimStageHeight(props) * SKILL_DESC_AUTO_SIZE_HEIGHT_RATIO
  const fitHeightLimitPx = maxHeightPx + SKILL_DESC_AUTO_SIZE_FIT_SLACK_PX

  const measureHeightPx = (fontSizePt: number) =>
    measureSkillsBottomBlockHeightPx(info, props, units, fontSizePt, maxBleedPx, {
      forAutoSize: true,
    })

  const fits = (fontSizePt: number) => measureHeightPx(fontSizePt) <= fitHeightLimitPx

  let bestFit = SKILL_DESC_AUTO_SIZE_MIN_FONT_PT
  for (const candidate of AUTO_SIZE_FONT_PT_STEPS) {
    if (fits(candidate)) bestFit = candidate
  }

  if (allowGrow) {
    const bestIdx = resolveAutoSizeStepIndex(bestFit)
    if (bestIdx < AUTO_SIZE_FONT_PT_STEPS.length - 1) {
      const nextPt = AUTO_SIZE_FONT_PT_STEPS[bestIdx + 1]!
      const overflowPx = measureHeightPx(nextPt) - fitHeightLimitPx
      if (overflowPx <= SKILL_DESC_AUTO_SIZE_ONE_STEP_RELAX_PX) {
        return nextPt
      }
    }
    return bestFit
  }

  const currentPt = clampSkillsDescAutoSizeFontPt(
    info.renderConfig.items.skillsDesc.size || SKILL_DESC_DEFAULT_FONT_SIZE_PT,
  )
  if (fits(currentPt)) return currentPt
  return bestFit
}

/** 开启自动优化时，根据当前技能内容回写描述字号/行距/引言字号 */
export const applySkillsDescAutoSizeIfEnabled = (
  info: LegendInfo,
  props: TemplateProps,
  units: DiyUnitConverters,
  maxBleedPx = 0,
) => {
  const descItem = info.renderConfig.items.skillsDesc
  if (
    !resolveSkillsDescAutoSizeFlag(descItem.autoOptimizeSizeFlag, descItem.autoOptimizeFlag) ||
    descItem.manualSizeFlag
  )
    return
  syncAutoOptimizedSkillsDescFontSizePt(info, props, units, maxBleedPx)
}
