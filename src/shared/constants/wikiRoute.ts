import type { LocationQuery, LocationQueryRaw } from 'vue-router'

/** 百科页详情路由 query */
export const WIKI_PAGE_DETAIL_QUERY = {
  type: 'type',
  id: 'id',
  title: 'title',
} as const

/** 武将详情预选版本（百科页与制图资源搜索抽屉共用） */
export const WIKI_LEGEND_VERSION_QUERY_KEY = 'versionId'

export const parseWikiLegendVersionId = (query: LocationQuery): number | null => {
  const raw = query[WIKI_LEGEND_VERSION_QUERY_KEY]
  const value = Array.isArray(raw) ? raw[0] : raw
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export const clearWikiLegendVersionQuery = (query: LocationQuery): LocationQueryRaw => {
  const nextQuery: LocationQueryRaw = { ...query }
  delete nextQuery[WIKI_LEGEND_VERSION_QUERY_KEY]
  return nextQuery
}

export const buildWikiLegendDetailQuery = (
  query: LocationQuery,
  payload: { legendId: number; title: string; versionId?: number | null },
): LocationQueryRaw => {
  const nextQuery = clearWikiLegendVersionQuery({
    ...query,
    [WIKI_PAGE_DETAIL_QUERY.type]: 'legend',
    [WIKI_PAGE_DETAIL_QUERY.id]: String(payload.legendId),
    [WIKI_PAGE_DETAIL_QUERY.title]: payload.title,
  })

  if (payload.versionId && payload.versionId > 0) {
    nextQuery[WIKI_LEGEND_VERSION_QUERY_KEY] = String(payload.versionId)
  }

  return nextQuery
}
