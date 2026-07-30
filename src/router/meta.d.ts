import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    keepAlive?: boolean
    loadingHint?: string
    /** 在 AppShell 内切换时使用内容区 loading，不遮挡底栏 Tab */
    loadingScope?: 'content'
    /** 目标页自有加载态（如制图页画布 loading），跳过路由切换遮罩 */
    skipNavigationLoading?: boolean
  }
}
