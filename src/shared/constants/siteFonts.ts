/** 站点 UI 正文字体选项（与 public/diy/fonts/font.css 站点区 @font-face 一致，不影响 Konva 制图字体） */
export type SiteFontKey = 'lxgw-wenkai' | 'source-han-sans' | 'misans' | 'alimama-fangyuan'

export type SiteFontDefinition = {
  key: SiteFontKey
  /** 设置页展示名 */
  label: string
  /** @font-face 注册的 font-family */
  family: string
  fallbacks: readonly string[]
}

export const DEFAULT_SITE_FONT_KEY: SiteFontKey = 'lxgw-wenkai'

export const SITE_FONT_DEFINITIONS: Record<SiteFontKey, SiteFontDefinition> = {
  'lxgw-wenkai': {
    key: 'lxgw-wenkai',
    label: '霞鹜文楷',
    family: '霞鹜文楷',
    fallbacks: ['KaiTi', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
  },
  'source-han-sans': {
    key: 'source-han-sans',
    label: '思源黑体',
    family: '思源黑体',
    fallbacks: ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
  },
  misans: {
    key: 'misans',
    label: 'MiSans',
    family: 'MiSans',
    fallbacks: ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
  },
  'alimama-fangyuan': {
    key: 'alimama-fangyuan',
    label: '阿里妈妈方圆',
    family: '阿里妈妈方圆',
    fallbacks: ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
  },
}

export const SITE_FONT_OPTIONS = Object.values(SITE_FONT_DEFINITIONS).map((item) => ({
  label: item.label,
  value: item.key,
}))

export const isSiteFontKey = (value: string): value is SiteFontKey =>
  Object.prototype.hasOwnProperty.call(SITE_FONT_DEFINITIONS, value)

const quoteFontName = (name: string) => `"${name}"`

/** CSS `font-family` 栈（写入 --site-font-family） */
export const resolveSiteFontStack = (key: SiteFontKey = DEFAULT_SITE_FONT_KEY) => {
  const def = SITE_FONT_DEFINITIONS[key]
  return [quoteFontName(def.family), ...def.fallbacks.map(quoteFontName)].join(', ')
}

/** Naive UI themeOverrides.common.fontFamily */
export const resolveSiteFontFamilyForNaive = resolveSiteFontStack

export const applySiteFontToDocument = (key: SiteFontKey = DEFAULT_SITE_FONT_KEY) => {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--site-font-family', resolveSiteFontStack(key))
}
