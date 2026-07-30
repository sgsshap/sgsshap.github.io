import type { DictItem } from '@/shared/types/api'
import type { WikiSearchCardItem, WikiSearchType } from '@/shared/types/wiki'
import { getNameLabel, getWikiKingdomLabel } from '@/shared/utils/dict'

const WIKI_SUB_PAGE_TITLE_PREFIXES = ['武将百科：', '技能百科：', '原画百科：'] as const

export const stripWikiSubPageTitlePrefix = (title: string): string => {
  const trimmed = title.trim()
  for (const prefix of WIKI_SUB_PAGE_TITLE_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim()
    }
  }
  return trimmed
}

export function formatLegendWikiSubPageTitle(
  data: Record<string, unknown>,
  kingdomOptions: DictItem[] = [],
): string {
  const kingdom = getWikiKingdomLabel(String(data.kingdom ?? ''), kingdomOptions)
  const name = getNameLabel(
    String(data.name ?? ''),
    data.name2 ? String(data.name2) : undefined,
    data.name3 ? String(data.name3) : undefined,
  )
  const number = String(data.number ?? '').trim()
  const namePart = kingdom ? `【${kingdom}】${name}` : name
  const suffix = number ? `-${number}` : ''
  return `${namePart}${suffix}`
}

export function formatSkillWikiSubPageTitle(data: Record<string, unknown>): string {
  return String(data.name ?? '').trim() || '技能'
}

const resolveImageLegendNames = (
  data: Record<string, unknown>,
  kingdomOptions: DictItem[],
): string => {
  const legends = String(data.legends ?? '').trim()
  if (legends) return legends

  const list = data.legendImageList
  if (!Array.isArray(list)) return ''

  return list
    .map((item) => {
      const row = item as Record<string, unknown>
      const legendName = String(row.legendName ?? '').trim()
      if (!legendName) return ''
      const kingdom = getWikiKingdomLabel(String(row.legendKingdom ?? ''), kingdomOptions)
      return kingdom ? `【${kingdom}】${legendName}` : legendName
    })
    .filter(Boolean)
    .join('、')
}

export function formatImageWikiSubPageTitle(
  data: Record<string, unknown>,
  kingdomOptions: DictItem[] = [],
): string {
  const title = String(data.title ?? '').trim() || '原画'
  const legendName = resolveImageLegendNames(data, kingdomOptions)
  const suffix = legendName ? `-${legendName}` : ''
  return `${title}${suffix}`
}

export function formatWikiSubPageTitleFromCard(item: WikiSearchCardItem): string {
  if (item.type === 'legend') {
    const number = item.number?.trim()
    const numberSuffix = number && number !== '—' ? `-${number}` : ''
    return `${item.name}${numberSuffix}`
  }
  if (item.type === 'skill') {
    return item.name
  }
  const legends = item.legends?.trim()
  const suffix = legends ? `-${legends}` : ''
  return `${item.name}${suffix}`
}

export function formatWikiSubPageTitleFallback(
  type: WikiSearchType,
  queryTitle: string,
): string {
  const title = stripWikiSubPageTitlePrefix(queryTitle)
  if (title) return title
  if (type === 'legend') return '武将详情'
  if (type === 'skill') return '技能'
  return '原画'
}
