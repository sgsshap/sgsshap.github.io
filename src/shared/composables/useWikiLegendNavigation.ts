import { buildResourceSearchDetailQuery, isResourceSearchDrawerOpen } from '@/features/diy-card/constants/diyDrawerRoute'
import { WIKI_IMAGE_FULL_QUERY_KEY } from '@/shared/composables/useWikiImageFullRouteOverlay'
import { buildWikiLegendDetailQuery } from '@/shared/constants/wikiRoute'
import type { WikiLegendNavigationTarget } from '@/shared/utils/wikiLegendLink'
import type { LocationQueryRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

const stripOverlayQueries = (query: LocationQueryRaw): LocationQueryRaw => {
  const nextQuery = { ...query }
  delete nextQuery[WIKI_IMAGE_FULL_QUERY_KEY]
  return nextQuery
}

export function useWikiLegendNavigation() {
  const route = useRoute()
  const router = useRouter()

  const navigateToLegend = (target: WikiLegendNavigationTarget) => {
    const isDiyResourceSearch = route.name === 'diy' && isResourceSearchDrawerOpen(route.query)

    if (isDiyResourceSearch) {
      void router.push({
        query: stripOverlayQueries(
          buildResourceSearchDetailQuery(route.query, {
            mode: 'legend',
            id: target.legendId,
            title: target.title,
            versionId: target.versionId,
          }),
        ),
      })
      return
    }

    void router.push({
      query: stripOverlayQueries(
        buildWikiLegendDetailQuery(route.query, {
          legendId: target.legendId,
          title: target.title,
          versionId: target.versionId,
        }),
      ),
    })
  }

  return {
    navigateToLegend,
  }
}
