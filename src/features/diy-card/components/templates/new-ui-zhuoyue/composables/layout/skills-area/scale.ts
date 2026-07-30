import type { TemplateProps } from '@/features/diy-card/composables/template'
import { ptToRefPx } from '@/features/diy-card/utils/canvas'
import { toFixed } from '@/shared/utils/object'
import {
  SKILL_DESC_AUTO_SIZE_MAX_FONT_PT,
  SKILL_DESC_AUTO_SIZE_MIN_FONT_PT,
  SKILL_DESC_MIN_FONT_PT,
  SKILL_DESC_MAX_FONT_PT,
  SKILL_DESC_ROW_SPACING_FONT_KNOTS,
} from '../../constants/skills'

/** 参考模板画布尺寸（444×600 CSS px ≈ 333×450 pt） */
export const REFERENCE_CARD_WIDTH_PX = 444
export const REFERENCE_CARD_HEIGHT_PX = 600
export const REFERENCE_CARD_WIDTH_PT = 333
export const REFERENCE_CARD_HEIGHT_PT = 450

/** 成品区宽度（扣除左右出血 / stageOrigin） */
export const resolveTrimStageWidth = (props: TemplateProps) =>
  props.stageWidth - props.stageOrigin.x * 2

/** 成品区高度（扣除上下出血 / stageOrigin） */
export const resolveTrimStageHeight = (props: TemplateProps) =>
  props.stageHeight - props.stageOrigin.y * 2

/** 将参考模板中的 px 换算为当前 Konva 成品区 px */
export const toReferenceCanvasPx = (refPx: number, trimWidth: number) =>
  refPx * (trimWidth / REFERENCE_CARD_WIDTH_PX)

/** 排版用 pt → 当前 Konva 成品区 px */
export const ptLayoutToCanvasPx = (pt: number, trimWidth: number) =>
  toReferenceCanvasPx(ptToRefPx(pt), trimWidth)

/**
 * 技能区字号 / 行距 pt → 画布 px
 * 与卓越 PS 参考画布（宽 444）一致：面板数值等同旧版 defaultSize、rowSpacing 的 px
 */
export const ptSkillDocToCanvasPx = (pt: number, trimWidth: number) =>
  (pt / REFERENCE_CARD_WIDTH_PX) * trimWidth

/** PS 绝对 Leading（pt）→ Konva lineHeight（倍数，且不小于 1） */
export const psLeadingToKonvaLineHeight = (leadingPt: number, fontSizePt: number) =>
  fontSizePt > 0 ? Math.max(1, leadingPt / fontSizePt) : 1

/** 技能描述字号（pt）→ 行距（pt），按标定点分段线性插值 */
export const resolveSkillsDescRowSpacingPt = (fontSizePt: number): number => {
  const knots = SKILL_DESC_ROW_SPACING_FONT_KNOTS
  const first = knots[0]
  if (!first) return fontSizePt
  if (fontSizePt <= first[0]) {
    return toFixed(first[1] + (fontSizePt - first[0]), 2)
  }
  for (let i = 0; i < knots.length - 1; i++) {
    const start = knots[i]
    const end = knots[i + 1]
    if (!start || !end) continue
    const [x0, y0] = start
    const [x1, y1] = end
    if (fontSizePt <= x1 + 1e-6) {
      const t = (fontSizePt - x0) / (x1 - x0)
      return toFixed(y0 + t * (y1 - y0), 2)
    }
  }
  const prev = knots[knots.length - 2]
  const last = knots[knots.length - 1]
  if (!prev || !last) return fontSizePt
  const [x0, y0] = prev
  const [x1, y1] = last
  const slope = (y1 - y0) / (x1 - x0)
  return toFixed(y1 + (fontSizePt - x1) * slope, 2)
}

/** 技能描述字号范围（pt），与自动优化开关无关 */
export const clampSkillsDescFontSizePt = (fontSizePt: number): number =>
  toFixed(
    Math.min(SKILL_DESC_MAX_FONT_PT, Math.max(SKILL_DESC_MIN_FONT_PT, fontSizePt)),
    2,
  )

/** 自动优化开启时，将技能描述字号限制在 [min, max]（pt） */
export const clampSkillsDescAutoSizeFontPt = (fontSizePt: number): number =>
  toFixed(
    Math.min(
      SKILL_DESC_AUTO_SIZE_MAX_FONT_PT,
      Math.max(SKILL_DESC_AUTO_SIZE_MIN_FONT_PT, fontSizePt),
    ),
    2,
  )

/** 用户可编辑的技能描述字号：优化字号开 → [5, 6.5]；关 → [4, 7] */
export const clampSkillsDescEditableFontSizePt = (
  fontSizePt: number,
  autoSizeEnabled: boolean,
): number =>
  autoSizeEnabled
    ? clampSkillsDescAutoSizeFontPt(fontSizePt)
    : clampSkillsDescFontSizePt(fontSizePt)
