import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** 百科原画高清预览浮层 — 与路由 query 同步，支持系统返回键关闭 */
export const WIKI_IMAGE_FULL_QUERY_KEY = 'imageFull'

export function useWikiImageFullRouteOverlay() {
  const route = useRoute()
  const router = useRouter()

  const visible = computed(() => route.query[WIKI_IMAGE_FULL_QUERY_KEY] === '1')

  const open = () => {
    if (visible.value) return
    void router.push({
      query: { ...route.query, [WIKI_IMAGE_FULL_QUERY_KEY]: '1' },
    })
  }

  const handleShowUpdate = (show: boolean) => {
    if (!show && route.query[WIKI_IMAGE_FULL_QUERY_KEY] === '1') {
      void router.back()
    }
  }

  return {
    visible,
    open,
    handleShowUpdate,
  }
}
