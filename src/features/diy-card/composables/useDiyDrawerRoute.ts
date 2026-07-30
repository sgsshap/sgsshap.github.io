import {
  buildOpenSimpleOverlayQuery,
  clearAllDiyOverlayQuery,
  isOutOfFrameOverlayOpen,
  isResourceSearchDrawerOpen,
  isSettingsOverlayOpen,
} from '@/features/diy-card/constants/diyDrawerRoute'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** 制图页抽屉/全屏浮层与 Vue Router 历史栈同步，支持浏览器返回关闭 */
export function useDiyDrawerRoute() {
  const route = useRoute()
  const router = useRouter()

  const isSettingsOpen = computed(() => isSettingsOverlayOpen(route.query))
  const isOutOfFrameOpen = computed(() => isOutOfFrameOverlayOpen(route.query))
  const isResourceSearchOpen = computed(() => isResourceSearchDrawerOpen(route.query))

  const openSettings = () => {
    void router.push({ query: buildOpenSimpleOverlayQuery(route.query, 'settings') })
  }

  const openOutOfFrame = () => {
    void router.push({ query: buildOpenSimpleOverlayQuery(route.query, 'outOfFrame') })
  }

  const dismissOverlay = () => {
    if (isSettingsOpen.value || isOutOfFrameOpen.value || isResourceSearchOpen.value) {
      void router.back()
      return true
    }
    return false
  }

  const dismissOverlayReplace = () => {
    void router.replace({ query: clearAllDiyOverlayQuery(route.query) })
  }

  const handleDrawerShowUpdate = (visible: boolean) => {
    if (!visible) {
      dismissOverlay()
    }
  }

  return {
    isSettingsOpen,
    isOutOfFrameOpen,
    isResourceSearchOpen,
    openSettings,
    openOutOfFrame,
    dismissOverlay,
    dismissOverlayReplace,
    handleDrawerShowUpdate,
  }
}
