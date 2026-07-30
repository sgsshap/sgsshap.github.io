import type { CustomKingdomTextMode } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import { resolveCustomKingdomDefaultFontSizePt } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/kingdomLayout'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'

const PT_TO_MM = 25.4 / 72

const ptToPx = (pt: number, mmToPixel: number) => pt * PT_TO_MM * mmToPixel

export const resolveKingdomGlyphFontSizePt = (
  item: LayoutItem,
  isShen = false,
  mode: CustomKingdomTextMode = 'dual',
) =>
  typeof item.size === 'number' && item.size > 0
    ? item.size
    : resolveCustomKingdomDefaultFontSizePt(isShen, mode)

/** 读取势力字渲染字号（px） */
export const resolveKingdomGlyphFontSizePx = (
  item: LayoutItem,
  mmToPixel: number,
  isShen = false,
  mode: CustomKingdomTextMode = 'dual',
) => ptToPx(resolveKingdomGlyphFontSizePt(item, isShen, mode), mmToPixel)

/** 初始化 renderConfig.size（pt） */
export const ensureKingdomGlyphFontSizeItem = (
  item: LayoutItem,
  isShen = false,
  mode: CustomKingdomTextMode = 'dual',
) => {
  if (typeof item.size === 'number' && item.size > 0) return
  item.size = resolveCustomKingdomDefaultFontSizePt(isShen, mode)
  item.scale = 1
}

export const resolveKingdomTextBoxFromFontSizePx = (fontSizePx: number) => ({
  width: fontSizePx,
  height: fontSizePx,
})
