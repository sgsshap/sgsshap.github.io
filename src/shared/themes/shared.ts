import { SITE_FONT_FAMILY } from '@/shared/constants/siteFont'
import { DEFAULT_GLOBAL_LOADING_EFFECT } from '@/shared/loading/registry'
import type { GlobalLoadingEffectId } from '@/shared/loading/types'
import { rgba } from '@/shared/utils/color'
import type { GlobalThemeOverrides } from 'naive-ui'

const RADIUS_SM = '4px'
const RADIUS_MD = '8px'
const BORDER_WIDTH = '1px'
const BORDER_WIDTH_THICK = '2px'

export type ThemePalette = {
  brandRgb: string
  inverseRgb: string
  successRgb: string
  infoRgb: string
  warningRgb: string
  errorRgb: string
}

export type ThemeMode = 'light' | 'dark'

export type ThemeSeries = {
  label: string
  description: string
  /** GlobalLoading 动画，未配置则用默认 yinYang */
  loadingEffect?: GlobalLoadingEffectId
  light: ThemePalette
  dark: ThemePalette
}

const border = (rgb: string, alpha: number) => `${BORDER_WIDTH} solid ${rgba(rgb, alpha)}`
const borderFocus = (rgb: string) => `${BORDER_WIDTH_THICK} solid ${rgba(rgb, 0.6)}`

/** 在同一色相下微调亮度，用于区分下拉面板 / 禁用输入底 */
const tweakSurfaceRgb = (rgb: string, delta: number): string => {
  const parts = rgb.split(',').map((part) => Number(part.trim()))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return rgb
  }
  const r = parts[0]!
  const g = parts[1]!
  const b = parts[2]!
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `${clamp(r + delta)}, ${clamp(g + delta)}, ${clamp(b + delta)}`
}

type ThemeTokens = {
  isDark: boolean
  brandAlpha: number
  primaryRgb: string
  surfaceRgb: string
  textRgb: string
  borderRgb: string
  supplAlpha: number
  selectMenuRgb: string
  disabledInputBg: string
  fieldTextColor: string
  fieldPlaceholderColor: string
  fieldTextColorDisabled: string
  palette: ThemePalette
}

const buildThemeTokens = (palette: ThemePalette, mode: ThemeMode): ThemeTokens => {
  const isDark = mode === 'dark'
  const brandAlpha = isDark ? 0.91 : 1
  const primaryRgb = isDark ? palette.inverseRgb : palette.brandRgb
  const surfaceRgb = isDark ? palette.brandRgb : palette.inverseRgb
  const textRgb = isDark ? palette.inverseRgb : palette.brandRgb
  const borderRgb = isDark ? palette.inverseRgb : palette.brandRgb
  const supplAlpha = isDark ? 0.15 : 0.08
  const selectMenuRgb = tweakSurfaceRgb(surfaceRgb, isDark ? 20 : 12)
  const disabledInputRgb = tweakSurfaceRgb(surfaceRgb, isDark ? -32 : -20)
  const disabledInputBg = rgba(disabledInputRgb, isDark ? 0.96 : 0.98)

  return {
    isDark,
    brandAlpha,
    primaryRgb,
    surfaceRgb,
    textRgb,
    borderRgb,
    supplAlpha,
    selectMenuRgb,
    disabledInputBg,
    fieldTextColor: rgba(textRgb, isDark ? 0.9 : 0.91),
    fieldPlaceholderColor: rgba(textRgb, isDark ? 0.45 : 0.4),
    fieldTextColorDisabled: rgba(textRgb, isDark ? 0.45 : 0.4),
    palette,
  }
}

const buildCommonOverrides = (tokens: ThemeTokens) => ({
  baseColor: rgba(tokens.surfaceRgb, tokens.isDark ? 0.96 : 1),
  textColorBase: rgba(tokens.textRgb, tokens.isDark ? 0.9 : 0.91),
  borderRadius: RADIUS_SM,
  fontFamily: SITE_FONT_FAMILY,
  fontFamilyMono: SITE_FONT_FAMILY,
  primaryColor: rgba(tokens.primaryRgb, 1),
  primaryColorHover: rgba(tokens.primaryRgb, 0.85),
  primaryColorPressed: rgba(tokens.primaryRgb, 0.7),
  primaryColorSuppl: rgba(tokens.primaryRgb, tokens.supplAlpha),
  successColor: rgba(tokens.palette.successRgb, 1),
  successColorHover: rgba(tokens.palette.successRgb, 0.85),
  successColorPressed: rgba(tokens.palette.successRgb, 0.7),
  successColorSuppl: rgba(tokens.palette.successRgb, tokens.supplAlpha),
  infoColor: rgba(tokens.palette.infoRgb, 1),
  infoColorHover: rgba(tokens.palette.infoRgb, 0.85),
  infoColorPressed: rgba(tokens.palette.infoRgb, 0.7),
  infoColorSuppl: rgba(tokens.palette.infoRgb, tokens.supplAlpha),
  warningColor: rgba(tokens.palette.warningRgb, 1),
  warningColorHover: rgba(tokens.palette.warningRgb, 0.85),
  warningColorPressed: rgba(tokens.palette.warningRgb, 0.7),
  warningColorSuppl: rgba(tokens.palette.warningRgb, tokens.supplAlpha),
  errorColor: rgba(tokens.palette.errorRgb, 1),
  errorColorHover: rgba(tokens.palette.errorRgb, 0.85),
  errorColorPressed: rgba(tokens.palette.errorRgb, 0.7),
  errorColorSuppl: rgba(tokens.palette.errorRgb, tokens.supplAlpha),
  /** InternalSelection / Input 禁用态底，避免与下拉面板（popover 色链）糊成一团 */
  inputColorDisabled: tokens.disabledInputBg,
})

const buildButtonOverrides = (tokens: ThemeTokens) => ({
  textColorPrimary: rgba(tokens.isDark ? tokens.palette.brandRgb : tokens.palette.inverseRgb, 1),
  textColorPrimaryHover: rgba(tokens.isDark ? tokens.palette.brandRgb : tokens.palette.inverseRgb, 1),
  textColorPrimaryPressed: rgba(
    tokens.isDark ? tokens.palette.brandRgb : tokens.palette.inverseRgb,
    0.8,
  ),
  colorPrimary: rgba(tokens.primaryRgb, tokens.isDark ? 0.85 : 1),
  colorPrimaryHover: rgba(tokens.primaryRgb, 0.85),
  colorPrimaryPressed: rgba(tokens.primaryRgb, 0.7),
  colorPrimaryFocus: rgba(tokens.primaryRgb, 1),
  borderPrimary: rgba(tokens.primaryRgb, 1),
  borderPrimaryHover: rgba(tokens.primaryRgb, 0.85),
  borderPrimaryPressed: rgba(tokens.primaryRgb, 0.7),
  colorPrimarySuppl: rgba(tokens.palette.inverseRgb, tokens.isDark ? 0.15 : 1),
  textColorPrimarySuppl: rgba(
    tokens.isDark ? tokens.palette.inverseRgb : tokens.palette.brandRgb,
    tokens.isDark ? 0.9 : 1,
  ),
  borderPrimarySuppl: rgba(tokens.primaryRgb, tokens.isDark ? 0.25 : 1),
  borderRadius: RADIUS_SM,
})

const buildFieldOverrides = (tokens: ThemeTokens) => ({
  textColor: tokens.fieldTextColor,
  color: rgba(tokens.surfaceRgb, tokens.brandAlpha),
  colorDisabled: tokens.disabledInputBg,
  border: border(tokens.borderRgb, tokens.isDark ? 0.25 : 0.1),
  borderHover: borderFocus(tokens.borderRgb),
  borderFocus: borderFocus(tokens.borderRgb),
  borderRadius: RADIUS_SM,
  placeholderColor: tokens.fieldPlaceholderColor,
})

const buildInternalSelectionOverrides = (tokens: ThemeTokens) => ({
  colorDisabled: tokens.disabledInputBg,
  textColor: tokens.fieldTextColor,
  placeholderColor: tokens.fieldPlaceholderColor,
  placeholderColorDisabled: tokens.fieldTextColorDisabled,
  textColorDisabled: tokens.fieldTextColorDisabled,
  border: border(tokens.borderRgb, tokens.isDark ? 0.3 : 0.14),
  borderHover: borderFocus(tokens.borderRgb),
  borderFocus: borderFocus(tokens.borderRgb),
})

export const createThemeOverrides = (
  palette: ThemePalette,
  mode: ThemeMode,
): GlobalThemeOverrides => {
  const tokens = buildThemeTokens(palette, mode)

  return {
    common: buildCommonOverrides(tokens),
    Button: buildButtonOverrides(tokens),
    Input: buildFieldOverrides(tokens),
    Select: buildFieldOverrides(tokens),
    Card: {
      color: rgba(tokens.surfaceRgb, tokens.brandAlpha),
      borderColor: rgba(tokens.borderRgb, tokens.isDark ? 0.25 : 0.1),
      borderRadius: RADIUS_MD,
    },
    Modal: {
      color: rgba(tokens.surfaceRgb, tokens.brandAlpha),
      borderRadius: RADIUS_MD,
    },
    Tag: {
      color: rgba(tokens.palette.brandRgb, tokens.isDark ? 0.85 : 0.08),
      textColor: rgba(tokens.textRgb, tokens.isDark ? 0.9 : 1),
      borderColor: rgba(tokens.borderRgb, tokens.isDark ? 0.25 : 0.1),
      borderRadius: RADIUS_SM,
    },
    InternalSelectMenu: {
      color: rgba(tokens.selectMenuRgb, 1),
    },
    InternalSelection: buildInternalSelectionOverrides(tokens),
  }
}

export const buildThemeEntry = (series: ThemeSeries) => ({
  label: series.label,
  description: series.description,
  loadingEffect: series.loadingEffect ?? DEFAULT_GLOBAL_LOADING_EFFECT,
  light: createThemeOverrides(series.light, 'light'),
  dark: createThemeOverrides(series.dark, 'dark'),
})

type StyleRadiusConfig = {
  field: string
  button?: string
  card: string
  modal: string
  tag: string
}

const applyStyleRadiusTokens = (
  overrides: GlobalThemeOverrides,
  fontFamily: string,
  radii: StyleRadiusConfig,
): GlobalThemeOverrides => {
  const fieldRadius = radii.field
  const buttonRadius = radii.button ?? fieldRadius
  return {
    ...overrides,
    common: {
      ...overrides.common,
      borderRadius: fieldRadius,
      fontFamily,
    },
    Button: {
      ...overrides.Button,
      borderRadius: buttonRadius,
    },
    Input: {
      ...overrides.Input,
      borderRadius: fieldRadius,
    },
    Select: {
      ...overrides.Select,
      borderRadius: fieldRadius,
    },
    Card: {
      ...overrides.Card,
      borderRadius: radii.card,
    },
    Modal: {
      ...overrides.Modal,
      borderRadius: radii.modal,
    },
    Tag: {
      ...overrides.Tag,
      borderRadius: radii.tag,
    },
  }
}

const SHUIMO_FONT = SITE_FONT_FAMILY

const applyShuimoStyleTokens = (overrides: GlobalThemeOverrides): GlobalThemeOverrides =>
  applyStyleRadiusTokens(overrides, SHUIMO_FONT, {
    field: '6px',
    card: '8px',
    modal: '18px',
    tag: '999px',
  })

/** 水墨丹青：在palette之上叠加-serif、圆角与钤印式 Tag */
export const buildShuimoThemeEntry = (series: ThemeSeries) => ({
  label: series.label,
  description: series.description,
  loadingEffect: series.loadingEffect ?? DEFAULT_GLOBAL_LOADING_EFFECT,
  light: applyShuimoStyleTokens(createThemeOverrides(series.light, 'light')),
  dark: applyShuimoStyleTokens(createThemeOverrides(series.dark, 'dark')),
})

const SHANHAI_FONT = SITE_FONT_FAMILY

const applyShanhaiStyleTokens = (overrides: GlobalThemeOverrides): GlobalThemeOverrides =>
  applyStyleRadiusTokens(overrides, SHANHAI_FONT, {
    field: '8px',
    card: '14px',
    modal: '18px',
    tag: '6px',
  })

/** 山海异闻：serif + 略扩圆角；配色见 shanhai.ts */
export const buildShanhaiThemeEntry = (series: ThemeSeries) => ({
  label: series.label,
  description: series.description,
  loadingEffect: series.loadingEffect ?? DEFAULT_GLOBAL_LOADING_EFFECT,
  light: applyShanhaiStyleTokens(createThemeOverrides(series.light, 'light')),
  dark: applyShanhaiStyleTokens(createThemeOverrides(series.dark, 'dark')),
})

const MINIMAL_LINE_FONT = SITE_FONT_FAMILY

const applyMinimalLineStyleTokens = (overrides: GlobalThemeOverrides): GlobalThemeOverrides =>
  applyStyleRadiusTokens(overrides, MINIMAL_LINE_FONT, {
    field: '2px',
    card: '4px',
    modal: '8px',
    tag: '2px',
  })

/** 极简线条：几何无衬线 + 小圆角；配色见 minimal-line.ts */
export const buildMinimalLineThemeEntry = (series: ThemeSeries) => ({
  label: series.label,
  description: series.description,
  loadingEffect: series.loadingEffect ?? DEFAULT_GLOBAL_LOADING_EFFECT,
  light: applyMinimalLineStyleTokens(createThemeOverrides(series.light, 'light')),
  dark: applyMinimalLineStyleTokens(createThemeOverrides(series.dark, 'dark')),
})

type KingdomElevatedSurfaces = {
  light: { cardRgb: string; fieldRgb?: string }
  dark: { cardRgb: string; fieldRgb?: string }
}

/** 卡片/输入区略高于页面底，避免与 body 同色发闷 */
const applyKingdomElevatedSurfaces = (
  overrides: GlobalThemeOverrides,
  cardRgb: string,
  fieldRgb: string,
  mode: ThemeMode,
): GlobalThemeOverrides => {
  const cardColor = rgba(cardRgb, mode === 'dark' ? 0.96 : 1)
  const fieldColor = rgba(fieldRgb, mode === 'dark' ? 0.91 : 1)
  return {
    ...overrides,
    Card: { ...overrides.Card, color: cardColor },
    Modal: { ...overrides.Modal, color: cardColor },
    Input: { ...overrides.Input, color: fieldColor },
    Select: { ...overrides.Select, color: fieldColor },
  }
}

/** 魏蜀吴等势力主题：palette + 抬升卡片/输入底色 */
export const buildKingdomThemeEntry = (
  series: ThemeSeries,
  surfaces: KingdomElevatedSurfaces,
) => ({
  label: series.label,
  description: series.description,
  loadingEffect: series.loadingEffect ?? DEFAULT_GLOBAL_LOADING_EFFECT,
  light: applyKingdomElevatedSurfaces(
    createThemeOverrides(series.light, 'light'),
    surfaces.light.cardRgb,
    surfaces.light.fieldRgb ?? surfaces.light.cardRgb,
    'light',
  ),
  dark: applyKingdomElevatedSurfaces(
    createThemeOverrides(series.dark, 'dark'),
    surfaces.dark.cardRgb,
    surfaces.dark.fieldRgb ?? surfaces.dark.cardRgb,
    'dark',
  ),
})
