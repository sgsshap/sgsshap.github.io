import {
  WIKI_LEGEND_VERSION_QUERY_KEY,
  WIKI_PAGE_DETAIL_QUERY,
  clearWikiLegendVersionQuery,
} from '@/shared/constants/wikiRoute'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'

/** 制图页顶层浮层（详细设置抽屉、人物出框弹框等）— query 键名 */
export const DIY_OVERLAY_QUERY = {
  panel: 'overlay',
} as const

/** @deprecated 请改用 DIY_OVERLAY_QUERY */
export const DIY_DRAWER_QUERY = DIY_OVERLAY_QUERY

/** 制图页百科搜索浮层标识 */
export const DIY_WIKI_OVERLAY_VALUE = 'wiki' as const

/** 制图页角标/素材搜索浮层标识 */
export const DIY_MATERIAL_OVERLAY_VALUE = 'material' as const

/** 资源搜索抽屉 — 与百科页共用 type/id/title，通过 overlay 区分百科与素材 */
export const DIY_RESOURCE_SEARCH_QUERY = {
  overlay: DIY_OVERLAY_QUERY.panel,
  type: WIKI_PAGE_DETAIL_QUERY.type,
  id: WIKI_PAGE_DETAIL_QUERY.id,
  title: WIKI_PAGE_DETAIL_QUERY.title,
} as const

/** @deprecated 旧版 rs/rsId/rsTitle，仅用于读取兼容 */
const LEGACY_RESOURCE_SEARCH_QUERY = {
  mode: 'rs',
  id: 'rsId',
  title: 'rsTitle',
} as const

export type DiySimpleOverlayPanel = 'settings' | 'outOfFrame'

/** @deprecated 请改用 DiySimpleOverlayPanel */
export type DiySimpleDrawerPanel = DiySimpleOverlayPanel

export type DiyResourceSearchRouteMode = 'legend' | 'image' | 'skill' | 'package'

const LEGACY_OVERLAY_QUERY_KEY = 'drawer'

const readQueryScalar = (raw: unknown): string => {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value != null ? String(value) : ''
}

const parseResourceSearchType = (value: unknown): DiyResourceSearchRouteMode | null => {
  const type = readQueryScalar(value)
  if (type === 'legend' || type === 'image' || type === 'skill' || type === 'package') {
    return type
  }
  return null
}

const parseWikiSearchType = (value: unknown): 'legend' | 'image' | 'skill' | null => {
  const type = readQueryScalar(value)
  if (type === 'legend' || type === 'image' || type === 'skill') return type
  return null
}

const parseMaterialSearchType = (value: unknown): 'package' | null =>
  readQueryScalar(value) === 'package' ? 'package' : null

const resolveResourceSearchOverlay = (mode: DiyResourceSearchRouteMode): string =>
  mode === 'package' ? DIY_MATERIAL_OVERLAY_VALUE : DIY_WIKI_OVERLAY_VALUE

const readSimpleOverlayPanel = (query: LocationQuery): DiySimpleOverlayPanel | null =>
  parseDiySimpleOverlayPanel(query[DIY_OVERLAY_QUERY.panel])
  ?? parseDiySimpleOverlayPanel(query[LEGACY_OVERLAY_QUERY_KEY])

export const parseDiySimpleOverlayPanel = (value: unknown): DiySimpleOverlayPanel | null => {
  if (value === 'settings' || value === 'outOfFrame') return value
  return null
}

/** @deprecated 请改用 parseDiySimpleOverlayPanel */
export const parseDiySimpleDrawerPanel = parseDiySimpleOverlayPanel

export const isWikiResourceOverlayOpen = (query: LocationQuery) =>
  readQueryScalar(query[DIY_OVERLAY_QUERY.panel]) === DIY_WIKI_OVERLAY_VALUE

export const isMaterialResourceOverlayOpen = (query: LocationQuery) =>
  readQueryScalar(query[DIY_OVERLAY_QUERY.panel]) === DIY_MATERIAL_OVERLAY_VALUE

export const parseResourceSearchRouteMode = (query: LocationQuery): DiyResourceSearchRouteMode | null => {
  if (isWikiResourceOverlayOpen(query)) {
    const wikiType = parseWikiSearchType(query[DIY_RESOURCE_SEARCH_QUERY.type])
    if (wikiType) return wikiType
    // 兼容误写成 overlay=wiki&type=package 的旧链接
    if (parseMaterialSearchType(query[DIY_RESOURCE_SEARCH_QUERY.type])) return 'package'
  }

  if (isMaterialResourceOverlayOpen(query)) {
    const materialType = parseMaterialSearchType(query[DIY_RESOURCE_SEARCH_QUERY.type])
    if (materialType) return materialType
  }

  return parseResourceSearchType(query[LEGACY_RESOURCE_SEARCH_QUERY.mode])
}

export const readResourceSearchDetailId = (query: LocationQuery): number | null => {
  const rawId = query[DIY_RESOURCE_SEARCH_QUERY.id] ?? query[LEGACY_RESOURCE_SEARCH_QUERY.id]
  const id = Number(readQueryScalar(rawId))
  return Number.isFinite(id) && id > 0 ? id : null
}

export const readResourceSearchDetailTitle = (query: LocationQuery): string => {
  const rawTitle = query[DIY_RESOURCE_SEARCH_QUERY.title] ?? query[LEGACY_RESOURCE_SEARCH_QUERY.title]
  return readQueryScalar(rawTitle) || '详情'
}

export const isSettingsOverlayOpen = (query: LocationQuery) =>
  readSimpleOverlayPanel(query) === 'settings'

/** @deprecated 请改用 isSettingsOverlayOpen */
export const isSettingsDrawerOpen = isSettingsOverlayOpen

export const isOutOfFrameOverlayOpen = (query: LocationQuery) =>
  readSimpleOverlayPanel(query) === 'outOfFrame'

/** @deprecated 请改用 isOutOfFrameOverlayOpen */
export const isOutOfFrameDrawerOpen = isOutOfFrameOverlayOpen

export const isResourceSearchDrawerOpen = (query: LocationQuery) =>
  parseResourceSearchRouteMode(query) !== null

export const isAnyDiyOverlayOpen = (query: LocationQuery) =>
  isSettingsOverlayOpen(query) ||
  isOutOfFrameOverlayOpen(query) ||
  isResourceSearchDrawerOpen(query)

/** @deprecated 请改用 isAnyDiyOverlayOpen */
export const isAnyDiyDrawerOverlayOpen = isAnyDiyOverlayOpen

export const clearSimpleOverlayQuery = (query: LocationQuery): LocationQueryRaw => {
  const nextQuery: LocationQueryRaw = { ...query }
  delete nextQuery[DIY_OVERLAY_QUERY.panel]
  delete nextQuery[LEGACY_OVERLAY_QUERY_KEY]
  return nextQuery
}

/** @deprecated 请改用 clearSimpleOverlayQuery */
export const clearSimpleDrawerQuery = clearSimpleOverlayQuery

export const clearResourceSearchQuery = (query: LocationQuery): LocationQueryRaw => {
  const nextQuery: LocationQueryRaw = clearWikiLegendVersionQuery(query)
  const overlay = readQueryScalar(nextQuery[DIY_OVERLAY_QUERY.panel])
  if (overlay === DIY_WIKI_OVERLAY_VALUE || overlay === DIY_MATERIAL_OVERLAY_VALUE) {
    delete nextQuery[DIY_OVERLAY_QUERY.panel]
  }
  delete nextQuery[DIY_RESOURCE_SEARCH_QUERY.type]
  delete nextQuery[DIY_RESOURCE_SEARCH_QUERY.id]
  delete nextQuery[DIY_RESOURCE_SEARCH_QUERY.title]
  delete nextQuery[LEGACY_RESOURCE_SEARCH_QUERY.mode]
  delete nextQuery[LEGACY_RESOURCE_SEARCH_QUERY.id]
  delete nextQuery[LEGACY_RESOURCE_SEARCH_QUERY.title]
  return nextQuery
}

export const clearAllDiyOverlayQuery = (query: LocationQuery): LocationQueryRaw => {
  const nextQuery = clearSimpleOverlayQuery(query)
  delete nextQuery[DIY_RESOURCE_SEARCH_QUERY.type]
  delete nextQuery[DIY_RESOURCE_SEARCH_QUERY.id]
  delete nextQuery[DIY_RESOURCE_SEARCH_QUERY.title]
  delete nextQuery[LEGACY_RESOURCE_SEARCH_QUERY.mode]
  delete nextQuery[LEGACY_RESOURCE_SEARCH_QUERY.id]
  delete nextQuery[LEGACY_RESOURCE_SEARCH_QUERY.title]
  delete nextQuery[WIKI_LEGEND_VERSION_QUERY_KEY]
  return nextQuery
}

/** @deprecated 请改用 clearAllDiyOverlayQuery */
export const clearAllDiyDrawerQuery = clearAllDiyOverlayQuery

export const buildOpenSimpleOverlayQuery = (
  query: LocationQuery,
  panel: DiySimpleOverlayPanel,
): LocationQueryRaw => {
  const nextQuery = clearAllDiyOverlayQuery(query)
  nextQuery[DIY_OVERLAY_QUERY.panel] = panel
  return nextQuery
}

/** @deprecated 请改用 buildOpenSimpleOverlayQuery */
export const buildOpenSimpleDrawerQuery = buildOpenSimpleOverlayQuery

export const buildResourceSearchListQuery = (
  query: LocationQuery,
  mode: DiyResourceSearchRouteMode,
): LocationQueryRaw => {
  const nextQuery = clearAllDiyOverlayQuery(query)
  nextQuery[DIY_OVERLAY_QUERY.panel] = resolveResourceSearchOverlay(mode)
  nextQuery[DIY_RESOURCE_SEARCH_QUERY.type] = mode
  return nextQuery
}

export const buildResourceSearchDetailQuery = (
  query: LocationQuery,
  payload: { mode: DiyResourceSearchRouteMode; id: number; title: string; versionId?: number | null },
): LocationQueryRaw => {
  const nextQuery: LocationQueryRaw = {
    ...query,
    [DIY_OVERLAY_QUERY.panel]: resolveResourceSearchOverlay(payload.mode),
    [DIY_RESOURCE_SEARCH_QUERY.type]: payload.mode,
    [DIY_RESOURCE_SEARCH_QUERY.id]: String(payload.id),
    [DIY_RESOURCE_SEARCH_QUERY.title]: payload.title,
  }

  if (payload.versionId && payload.versionId > 0) {
    nextQuery[WIKI_LEGEND_VERSION_QUERY_KEY] = String(payload.versionId)
  } else {
    delete nextQuery[WIKI_LEGEND_VERSION_QUERY_KEY]
  }

  return nextQuery
}
