import type { DictItem } from '@/shared/types/api'
import { getWikiKingdomLabel } from '@/shared/utils/dict'

export interface WikiLegendNavigationTarget {
  key: string
  legendId: number
  versionId: number | null
  title: string
  label: string
}

const resolveLegendId = (row: Record<string, unknown>): number | null => {
  const legendId = Number(row.legendId)
  return Number.isFinite(legendId) && legendId > 0 ? legendId : null
}

const resolveVersionId = (row: Record<string, unknown>): number | null => {
  for (const candidate of [row.versionId, row.legendVersionId]) {
    const versionId = Number(candidate)
    if (Number.isFinite(versionId) && versionId > 0) {
      return versionId
    }
  }

  return null
}

export const parseImageWikiLegendLinks = (
  list: unknown,
  kingdomOptions: DictItem[],
): WikiLegendNavigationTarget[] => {
  if (!Array.isArray(list)) return []

  return list.flatMap((item, index) => {
    const row = item as Record<string, unknown>
    const legendId = resolveLegendId(row)
    if (!legendId) return []

    const versionId = resolveVersionId(row)
    const legendName = String(row.legendName ?? '').trim() || '武将'
    const kingdom = getWikiKingdomLabel(String(row.legendKingdom ?? ''), kingdomOptions)
    const label = kingdom ? `【${kingdom}】${legendName}` : legendName

    return [{
      key: `${legendId}-${versionId ?? index}`,
      legendId,
      versionId,
      title: legendName,
      label,
    }]
  })
}

export const parseSkillWikiLegendLinks = (list: unknown): WikiLegendNavigationTarget[] => {
  if (!Array.isArray(list)) return []

  return list.flatMap((item) => {
    const row = item as Record<string, unknown>
    const legendId = resolveLegendId(row)
    if (!legendId) return []

    const versionId = resolveVersionId(row)
    if (!versionId) return []

    const legendLabel = String(row.legendLabel ?? row.legendName ?? '').trim() || '武将'
    const versionLabel = String(row.versionLabel ?? '').trim()
    const label = versionLabel ? `${versionLabel} · ${legendLabel}` : legendLabel

    return [{
      key: `${legendId}-${versionId}`,
      legendId,
      versionId,
      title: legendLabel,
      label,
    }]
  })
}
