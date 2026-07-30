import {
  DEFAULT_SITE_FONT_KEY,
  resolveSiteFontStack,
  type SiteFontKey,
} from '@/shared/constants/siteFonts'

/** 站点 UI 默认正文字体栈（首屏 boot 前 index.css 占位，挂载后由 applySiteFontToDocument 覆盖） */
export const SITE_FONT_FAMILY = resolveSiteFontStack(DEFAULT_SITE_FONT_KEY)

export type { SiteFontKey }
