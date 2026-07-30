import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const DEFAULT_HINT = '页面加载中…'

export type NavigationLoadingScope = 'global' | 'content'

/** 全站加载状态：首屏启动 + 路由懒加载 */
export const useAppLoadingStore = defineStore('appLoading', () => {
  const bootstrapPending = ref(0)
  const navigationPending = ref(0)
  const hint = ref(DEFAULT_HINT)
  const navigationScope = ref<NavigationLoadingScope>('global')

  const isLoading = computed(() => bootstrapPending.value > 0 || navigationPending.value > 0)

  /** 仅首屏启动中（无路由懒加载遮罩，避免盖住主题背景纹样） */
  const isBootstrapOnly = computed(
    () => bootstrapPending.value > 0 && navigationPending.value === 0,
  )

  /** 内容区内 loading（不遮挡底栏 Tab） */
  const showContentLoading = computed(
    () => navigationPending.value > 0 && navigationScope.value === 'content',
  )

  /** 全屏 loading（首屏启动或 AppShell 尚未就绪时的路由切换） */
  const showGlobalLoading = computed(() => {
    if (bootstrapPending.value > 0) return true
    return navigationPending.value > 0 && navigationScope.value === 'global'
  })

  function startBootstrap(message = '正在启动…') {
    bootstrapPending.value += 1
    hint.value = message
  }

  function finishBootstrap() {
    bootstrapPending.value = Math.max(0, bootstrapPending.value - 1)
  }

  function startNavigation(message = DEFAULT_HINT, scope: NavigationLoadingScope = 'global') {
    navigationPending.value += 1
    hint.value = message
    navigationScope.value = scope
  }

  function finishNavigation() {
    navigationPending.value = Math.max(0, navigationPending.value - 1)
    if (navigationPending.value === 0) {
      navigationScope.value = 'global'
      if (bootstrapPending.value === 0) {
        hint.value = DEFAULT_HINT
      }
    }
  }

  return {
    hint,
    isLoading,
    isBootstrapOnly,
    showContentLoading,
    showGlobalLoading,
    startBootstrap,
    finishBootstrap,
    startNavigation,
    finishNavigation,
  }
})
