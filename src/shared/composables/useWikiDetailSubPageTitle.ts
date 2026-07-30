import { getDict, isSuccess } from '@/shared/api'
import { getImageWiki, getLegendWiki, getSkillWiki } from '@/shared/api/wiki'
import { WIKI_PAGE_DETAIL_QUERY } from '@/shared/constants/wikiRoute'
import {
  formatImageWikiSubPageTitle,
  formatLegendWikiSubPageTitle,
  formatSkillWikiSubPageTitle,
  formatWikiSubPageTitleFallback,
} from '@/shared/utils/wikiSubPageTitle'
import type { WikiSearchType } from '@/shared/types/wiki'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const parseWikiDetailType = (raw: unknown): WikiSearchType | null => {
  if (raw === 'legend' || raw === 'skill' || raw === 'image') return raw
  return null
}

const readQueryValue = (raw: unknown): string =>
  String(Array.isArray(raw) ? raw[0] : raw ?? '')

export function useWikiDetailSubPageTitle() {
  const route = useRoute()
  const title = ref('')
  let requestId = 0

  const sync = async () => {
    const type = parseWikiDetailType(route.query[WIKI_PAGE_DETAIL_QUERY.type])
    const id = Number(readQueryValue(route.query[WIKI_PAGE_DETAIL_QUERY.id]))
    const queryTitle = readQueryValue(route.query[WIKI_PAGE_DETAIL_QUERY.title])

    if (!type || !Number.isFinite(id) || id <= 0) {
      title.value = queryTitle || '百科详情'
      return
    }

    title.value = formatWikiSubPageTitleFallback(type, queryTitle)

    const currentRequest = ++requestId
    try {
      const kingdomRes = await getDict('kingdom')
      const kingdomOptions = isSuccess(kingdomRes) ? kingdomRes.data.itemList ?? [] : []

      let formatted = ''
      if (type === 'legend') {
        const res = await getLegendWiki(id)
        if (!isSuccess(res)) throw new Error(res.message || '武将加载失败')
        formatted = formatLegendWikiSubPageTitle(res.data, kingdomOptions)
      } else if (type === 'skill') {
        const res = await getSkillWiki(id)
        if (!isSuccess(res)) throw new Error(res.message || '技能加载失败')
        formatted = formatSkillWikiSubPageTitle(res.data)
      } else {
        const res = await getImageWiki(id)
        if (!isSuccess(res)) throw new Error(res.message || '原画加载失败')
        formatted = formatImageWikiSubPageTitle(res.data, kingdomOptions)
      }

      if (currentRequest === requestId) {
        title.value = formatted
      }
    } catch {
      // 保留 query / fallback 标题
    }
  }

  watch(
    () => [
      route.query[WIKI_PAGE_DETAIL_QUERY.type],
      route.query[WIKI_PAGE_DETAIL_QUERY.id],
      route.query[WIKI_PAGE_DETAIL_QUERY.title],
    ] as const,
    () => {
      void sync()
    },
    { immediate: true },
  )

  return title
}
