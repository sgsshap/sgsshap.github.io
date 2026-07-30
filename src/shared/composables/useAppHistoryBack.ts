import { findAppNavItem } from '@/shared/constants/appNav'
import { useWikiDetailSubPageTitle } from '@/shared/composables/useWikiDetailSubPageTitle'
import { WIKI_PAGE_DETAIL_QUERY, clearWikiLegendVersionQuery } from '@/shared/constants/wikiRoute'
import {
  clearDiyFromWikiChrome,
  isDiyFromWikiChromeRoute,
} from '@/features/diy-card/utils/wikiToDiyNavigation'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'

export function hasAppBrowserBack(): boolean {
  if (typeof window === 'undefined') return false
  return window.history.state?.back != null
}

const PRIMARY_ROUTE_NAMES = new Set(['home', 'diy', 'wiki', 'settings'])

export function isWikiDetailRoute(route: RouteLocationNormalized): boolean {
  if (route.name !== 'wiki') return false
  const rawId = route.query[WIKI_PAGE_DETAIL_QUERY.id]
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId)
  return Number.isFinite(id) && id > 0
}

/** 菜单直达的一级页面（不含弹框/抽屉内的 query 态） */
export function isPrimaryNavRoute(route: RouteLocationNormalized): boolean {
  const name = String(route.name ?? '')
  if (!PRIMARY_ROUTE_NAMES.has(name)) return false
  if (name === 'wiki' && isWikiDetailRoute(route)) return false
  return true
}

export function resolveSubPageChrome(route: RouteLocationNormalized) {
  if (isDiyFromWikiChromeRoute(route.name)) {
    return {
      visible: true,
      title: findAppNavItem('diy')?.label ?? '在线制图',
      shareVisible: false,
    }
  }

  if (isPrimaryNavRoute(route)) {
    return { visible: false, title: '', shareVisible: false }
  }

  if (route.name === 'donation') {
    return {
      visible: true,
      title: findAppNavItem('donation')?.label ?? '支持项目',
      shareVisible: true,
    }
  }

  if (isWikiDetailRoute(route)) {
    return {
      visible: true,
      title: '',
      shareVisible: true,
    }
  }

  return { visible: false, title: '', shareVisible: false }
}

export function useAppHistoryBack() {
  const router = useRouter()
  const route = useRoute()
  const wikiDetailTitle = useWikiDetailSubPageTitle()

  const chrome = computed(() => resolveSubPageChrome(route))
  const visible = computed(() => chrome.value.visible)
  const title = computed(() => {
    if (isWikiDetailRoute(route)) {
      return wikiDetailTitle.value
    }
    return chrome.value.title
  })
  const shareVisible = computed(() => chrome.value.shareVisible)

  const goBack = () => {
    if (isDiyFromWikiChromeRoute(route.name)) {
      clearDiyFromWikiChrome()
      if (hasAppBrowserBack()) {
        void router.back()
        return
      }
      void router.push('/wiki')
      return
    }

    if (route.name === 'wiki' && isWikiDetailRoute(route)) {
      const nextQuery = clearWikiLegendVersionQuery(route.query)
      delete nextQuery[WIKI_PAGE_DETAIL_QUERY.id]
      delete nextQuery[WIKI_PAGE_DETAIL_QUERY.title]
      delete nextQuery[WIKI_PAGE_DETAIL_QUERY.type]
      void router.replace({ query: nextQuery })
      return
    }

    if (hasAppBrowserBack()) {
      void router.back()
      return
    }

    if (route.name === 'donation') {
      void router.push('/home')
    }
  }

  return {
    visible,
    title,
    shareVisible,
    goBack,
  }
}
