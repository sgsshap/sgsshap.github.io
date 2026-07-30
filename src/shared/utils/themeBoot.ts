import {
  applySiteFontToDocument,
  DEFAULT_SITE_FONT_KEY,
  isSiteFontKey,
  type SiteFontKey,
} from '@/shared/constants/siteFonts'
import type { ThemeKey, ThemeMode } from '@/shared/themes'
import { hasDecorativeDocumentBackground } from '@/shared/themes/decorativeBackground'
import { themeSurfaceColors } from '@/shared/themes/surfaceColors'

export const SYSTEM_PREFS_KEY = 'shap2-system-prefs'

export type SystemPrefs = {
  themeKey: ThemeKey
  followSystemTheme: boolean
  themeMode: ThemeMode
  siteFontKey?: SiteFontKey
}

const THEME_CLASS_PREFIX = 'theme-'
const MODE_CLASSES: ThemeMode[] = ['light', 'dark']
const THEME_KEYS = Object.keys(themeSurfaceColors) as ThemeKey[]

function isThemeKey(value: string): value is ThemeKey {
  return THEME_KEYS.includes(value as ThemeKey)
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 读取本地主题偏好 */
export function readSystemPrefs(): SystemPrefs | null {
  try {
    const raw = localStorage.getItem(SYSTEM_PREFS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<SystemPrefs>
    if (!data.themeKey || !isThemeKey(data.themeKey)) return null
    if (typeof data.followSystemTheme !== 'boolean') return null
    if (data.themeMode !== 'light' && data.themeMode !== 'dark') return null
    const siteFontKey =
      data.siteFontKey && isSiteFontKey(data.siteFontKey) ? data.siteFontKey : DEFAULT_SITE_FONT_KEY
    return {
      themeKey: data.themeKey,
      followSystemTheme: data.followSystemTheme,
      themeMode: data.themeMode,
      siteFontKey,
    }
  } catch {
    return null
  }
}

/** 写入本地主题偏好 */
export function writeSystemPrefs(prefs: SystemPrefs) {
  localStorage.setItem(SYSTEM_PREFS_KEY, JSON.stringify(prefs))
}

/** 解析首屏/启动时应使用的深浅色 */
export function resolveThemeMode(prefs: SystemPrefs | null): ThemeMode {
  if (!prefs || prefs.followSystemTheme) {
    return prefersDark() ? 'dark' : 'light'
  }
  return prefs.themeMode
}

function clearDocumentBackgroundInline(html: HTMLElement, body: HTMLElement) {
  html.style.removeProperty('background-color')
  html.style.removeProperty('background-image')
  body.style.backgroundColor = 'transparent'
  body.style.removeProperty('background-image')
}

function applyDocumentSurfaceInline(
  html: HTMLElement,
  body: HTMLElement,
  themeKey: ThemeKey,
  mode: ThemeMode,
) {
  const surface = themeSurfaceColors[themeKey][mode]
  html.style.backgroundColor = surface
  body.style.backgroundColor = surface
  html.style.removeProperty('background-image')
  body.style.removeProperty('background-image')
}

export const resolveSiteFontKey = (prefs: SystemPrefs | null): SiteFontKey =>
  prefs?.siteFontKey && isSiteFontKey(prefs.siteFontKey) ? prefs.siteFontKey : DEFAULT_SITE_FONT_KEY

/** 在 Vue 挂载前同步 html/body 的主题类与背景，避免白屏闪屏 */
export function applyDocumentTheme(prefs: SystemPrefs | null) {
  applySiteFontToDocument(resolveSiteFontKey(prefs))
  const themeKey = prefs?.themeKey ?? 'qun'
  const mode = resolveThemeMode(prefs)
  const decorativeBg = hasDecorativeDocumentBackground(themeKey)

  const html = document.documentElement
  const body = document.body
  const themeClass = `${THEME_CLASS_PREFIX}${themeKey}`

  for (const key of THEME_KEYS) {
    html.classList.remove(`${THEME_CLASS_PREFIX}${key}`)
    body.classList.remove(`${THEME_CLASS_PREFIX}${key}`)
  }
  for (const item of MODE_CLASSES) {
    html.classList.remove(item)
    body.classList.remove(item)
  }

  html.classList.add(themeClass, mode)
  body.classList.add(themeClass, mode)
  html.style.colorScheme = mode

  if (decorativeBg) {
    clearDocumentBackgroundInline(html, body)
  } else {
    applyDocumentSurfaceInline(html, body, themeKey, mode)
  }
}
