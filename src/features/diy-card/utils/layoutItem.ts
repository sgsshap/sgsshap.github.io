import { SKILL_DESC_DEFAULT_FONT_SIZE_PT } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import { isKingdomGlyphCode } from '@/features/diy-card/composables/doubleKingdom'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import { isNameSplitCharCode } from '@/features/diy-card/utils/nameSplit'

/** 通过 renderConfig.size（pt）控制字号的图层 code */
const FONT_SIZE_ITEM_CODES = new Set([
  'name',
  'title',
  'watermark',
  'quote',
  'skillsDesc',
])

/** 是否通过 renderConfig.size（pt）控制字号，而非 scale 缩放 */
export const isKingdomFontSizeItem = (item: LayoutItem) =>
  item.code === 'kingdom' || isKingdomGlyphCode(item.code)

export const layoutUsesFontSize = (item: LayoutItem) =>
  FONT_SIZE_ITEM_CODES.has(item.code) ||
  isNameSplitCharCode(item.code) ||
  (isKingdomFontSizeItem(item) && typeof item.size === 'number' && item.size > 0)

export const hasLayoutFontSize = (item: LayoutItem) =>
  layoutUsesFontSize(item) && typeof item.size === 'number' && item.size > 0

/** 技能描述字号（pt） */
export const resolveSkillsDescFontSize = (
  item: LayoutItem,
  fallbackPt = SKILL_DESC_DEFAULT_FONT_SIZE_PT,
) => {
  if (typeof item.size === 'number' && item.size > 0) return item.size
  return fallbackPt
}
