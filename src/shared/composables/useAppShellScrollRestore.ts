import {
  readAppShellScrollTop,
  setAppShellScrollTop,
} from '@/shared/composables/useScrollToTop'
import { clearDiyFromWikiChrome } from '@/features/diy-card/utils/wikiToDiyNavigation'
import { useAppLoadingStore } from '@/shared/stores/appLoading'
import type { RouteLocationNormalizedLoadedGeneric, Router } from 'vue-router'
import { nextTick, watch } from 'vue'

/** 各主导航页独立记住 AppShell 滚动位置（按 route.name） */
const scrollPositions = new Map<string, number>()

const resolveScrollKey = (route: RouteLocationNormalizedLoadedGeneric) =>
  String(route.name ?? route.path)

const isCrossPageNavigation = (
  from: RouteLocationNormalizedLoadedGeneric,
  to: RouteLocationNormalizedLoadedGeneric,
) => Boolean(from.name && to.name && from.name !== to.name)

const saveScrollForRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  scrollPositions.set(resolveScrollKey(route), readAppShellScrollTop())
}

const scheduleRestoreScroll = (top: number) => {
  const apply = () => setAppShellScrollTop(top)

  void nextTick(() => {
    apply()
    requestAnimationFrame(() => {
      apply()
      requestAnimationFrame(apply)
    })
  })
}

const restoreScrollForRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  scheduleRestoreScroll(scrollPositions.get(resolveScrollKey(route)) ?? 0)
}

/**
 * 主导航切换时保存/恢复各页滚动位置。
 * 须在 AppShell 挂载一次；同 name 的 query 变更（如百科进详情）不介入，由页面自行处理。
 */
export function useAppShellScrollRestore(router: Router) {
  const appLoadingStore = useAppLoadingStore()
  let pendingRestoreRoute: RouteLocationNormalizedLoadedGeneric | null = null

  router.beforeEach((to, from) => {
    if (from.name === 'diy' && to.name !== 'diy') {
      clearDiyFromWikiChrome()
    }

    if (isCrossPageNavigation(from, to)) {
      saveScrollForRoute(from)
      pendingRestoreRoute = to
    } else {
      pendingRestoreRoute = null
    }
    return true
  })

  router.afterEach((to, from) => {
    if (!isCrossPageNavigation(from, to)) return

    pendingRestoreRoute = to
    if (!appLoadingStore.showContentLoading) {
      restoreScrollForRoute(to)
      pendingRestoreRoute = null
    }
  })

  watch(
    () => appLoadingStore.showContentLoading,
    (loading) => {
      if (loading || !pendingRestoreRoute) return
      restoreScrollForRoute(pendingRestoreRoute)
      pendingRestoreRoute = null
    },
  )
}
