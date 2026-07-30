import { useAppLoadingStore, type NavigationLoadingScope } from '@/shared/stores/appLoading'
import { applySafeViewportHeight } from '@/shared/utils/safeViewport'
import type { RouteLocationNormalized, Router } from 'vue-router'

/** 同一路由下仅 query/hash 变更（抽屉、详情等），无需全站 loading */
function isSameRouteOverlayNavigation(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) {
  return to.name != null && to.name === from.name && to.path === from.path
}

/** AppShell 已就绪后的主导航：loading 仅覆盖内容区，底栏 Tab 可立即响应 */
function resolveNavigationLoadingScope(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): NavigationLoadingScope {
  if (from.name == null) return 'global'
  if (to.meta.loadingScope === 'content') return 'content'
  return 'global'
}

/** 路由懒加载时展示 loading */
export function setupRouterLoading(router: Router) {
  router.beforeEach((to, from) => {
    if (isSameRouteOverlayNavigation(to, from)) {
      return true
    }
    if (to.meta.skipNavigationLoading) {
      return true
    }
    const message = typeof to.meta.loadingHint === 'string' ? to.meta.loadingHint : undefined
    const scope = resolveNavigationLoadingScope(to, from)
    useAppLoadingStore().startNavigation(message, scope)
  })

  router.afterEach((to, from) => {
    applySafeViewportHeight()
    if (isSameRouteOverlayNavigation(to, from)) {
      return
    }
    useAppLoadingStore().finishNavigation()
  })

  router.onError(() => {
    useAppLoadingStore().finishNavigation()
  })
}
