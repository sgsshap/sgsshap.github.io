import type { ThemeKey } from '@/shared/themes'

/**
 * 背景由 theme CSS 绘制（html 渐变 / ::before 纹样，body 须透明）。
 * 勿在 themeBoot 上写 inline 不透明底色，否则会盖住纹样。
 */
export const THEMES_WITH_DECORATIVE_DOCUMENT_BG: readonly ThemeKey[] = [
  'shuimo',
  'shanhai',
  'minimalLine',
]

export function hasDecorativeDocumentBackground(themeKey: ThemeKey): boolean {
  return THEMES_WITH_DECORATIVE_DOCUMENT_BG.includes(themeKey)
}
