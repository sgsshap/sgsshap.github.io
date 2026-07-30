import { type ThemeKey, type ThemeMode, themes } from '@/shared/themes'
import {
  DEFAULT_SITE_FONT_KEY,
  applySiteFontToDocument,
  isSiteFontKey,
  resolveSiteFontFamilyForNaive,
  SITE_FONT_OPTIONS,
  type SiteFontKey,
} from '@/shared/constants/siteFonts'
import {
  readSystemPrefs,
  type SystemPrefs,
  writeSystemPrefs,
} from '@/shared/utils/themeBoot'
import { DIY_PC_LAYOUT_MIN_WIDTH } from '@/shared/utils/deviceCapability'
import {
  initLayoutViewportTracking,
  installLayoutViewportResizeListener,
} from '@/shared/utils/viewportLayoutResize'
import { darkTheme, lightTheme, useOsTheme } from 'naive-ui'
import { defineStore } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

const savedPrefs = readSystemPrefs()

/**
 * 全局系统状态：响应式布局断点、画布可视区域上限、Naive UI 主题与深浅色。
 * 制图页与 App 根组件均依赖本 store，属跨业务域共享状态。
 */
export const useSystemStore = defineStore('system', () => {
  // ==================== 布局断点 ====================

  /** 当前是否为窄屏（小于画布最大宽度 × 2） */
  const isNarrowScreen = ref(false)

  /** 小屏手机（单列窄卡片，与 Pad 区分） */
  const isCompactPhone = ref(false)

  /**
   * 制图页是否使用 PC 双栏（左预览+素材 / 右配置、固定画布等）。
   * 与 isNarrowScreen 解耦：Pad 横屏可 PC 布局 + 底部 Tab。
   */
  const isDiyPcLayout = ref(false)

  const COMPACT_PHONE_MAX_WIDTH = 640

  /** 预览区画布逻辑宽度上限（px） */
  const canvasMaxWidth = ref(640)

  /** 预览区画布逻辑高度上限（px） */
  const canvasMaxHeight = ref(640)

  /** 窄屏判定阈值：与制图页移动端布局、底部导航切换一致 */
  const narrowScreenWidth = computed(() => {
    return canvasMaxWidth.value * 2
  })

  // ==================== 主题 ====================

  const osTheme = useOsTheme()

  /** 可选主题系列（键名 → 展示名） */
  const themeOptions = Object.entries(themes).map(([key, theme]) => ({
    label: theme.label,
    value: key as ThemeKey,
  }))

  /** 当前选中的主题系列 */
  const themeKey = ref<ThemeKey>(savedPrefs?.themeKey ?? 'qun')

  /** 是否跟随操作系统深浅色 */
  const followSystemTheme = ref(savedPrefs?.followSystemTheme ?? true)

  /** 手动指定的深浅色（仅在未跟随系统时生效） */
  const themeMode = ref<ThemeMode>(
    savedPrefs?.themeMode ?? (osTheme.value === 'dark' ? 'dark' : 'light'),
  )

  /** 站点 UI 正文字体（不影响 Konva 制图） */
  const siteFontKey = ref<SiteFontKey>(
    savedPrefs?.siteFontKey && isSiteFontKey(savedPrefs.siteFontKey)
      ? savedPrefs.siteFontKey
      : DEFAULT_SITE_FONT_KEY,
  )

  const siteFontOptions = SITE_FONT_OPTIONS

  /** 解析后的实际深浅色 */
  const resolvedThemeMode = computed<ThemeMode>(() => {
    if (followSystemTheme.value) {
      return osTheme.value === 'dark' ? 'dark' : 'light'
    }
    return themeMode.value
  })

  const activeTheme = computed(() => themes[themeKey.value])
  const activeThemeDescription = computed(() => activeTheme.value.description)
  const isDark = computed(() => resolvedThemeMode.value === 'dark')
  const currentTheme = computed(() => (isDark.value ? darkTheme : lightTheme))
  const currentThemeOverrides = computed(() => {
    const base = activeTheme.value[resolvedThemeMode.value]
    const fontFamily = resolveSiteFontFamilyForNaive(siteFontKey.value)
    return {
      ...base,
      common: {
        ...base.common,
        fontFamily,
        fontFamilyMono: fontFamily,
      },
    }
  })

  const currentPrefs = (): SystemPrefs => ({
    themeKey: themeKey.value,
    followSystemTheme: followSystemTheme.value,
    themeMode: themeMode.value,
    siteFontKey: siteFontKey.value,
  })

  /**
   * 切换主题系列
   */
  const setTheme = (key: ThemeKey) => {
    if (!themes[key]) return
    themeKey.value = key
  }

  /**
   * 手动设置深浅色
   */
  const setThemeMode = (mode: ThemeMode) => {
    themeMode.value = mode
  }

  /**
   * 开关「跟随系统深浅色」
   */
  const setFollowSystemTheme = (follow: boolean) => {
    followSystemTheme.value = follow
  }

  /** 切换站点 UI 正文字体 */
  const setSiteFont = (key: SiteFontKey) => {
    if (!isSiteFontKey(key)) return
    siteFontKey.value = key
    applySiteFontToDocument(key)
  }

  watch(
    [themeKey, followSystemTheme, themeMode, siteFontKey, () => osTheme.value],
    () => {
      writeSystemPrefs(currentPrefs())
    },
    { immediate: false },
  )

  // ==================== 生命周期 ====================

  onMounted(() => {
    const syncViewport = () => {
      const width = window.innerWidth
      isNarrowScreen.value = width < narrowScreenWidth.value
      isCompactPhone.value = width < COMPACT_PHONE_MAX_WIDTH
      isDiyPcLayout.value = width >= DIY_PC_LAYOUT_MIN_WIDTH
    }
    initLayoutViewportTracking()
    syncViewport()
    installLayoutViewportResizeListener(syncViewport)
  })

  return {
    isNarrowScreen,
    isCompactPhone,
    isDiyPcLayout,
    canvasMaxWidth,
    canvasMaxHeight,
    isDark,
    activeTheme,
    currentTheme,
    currentThemeOverrides,
    activeThemeDescription,
    themeKey,
    followSystemTheme,
    themeMode,
    themeOptions,
    siteFontKey,
    siteFontOptions,
    setTheme,
    setThemeMode,
    setFollowSystemTheme,
    setSiteFont,
    osTheme,
  }
})
