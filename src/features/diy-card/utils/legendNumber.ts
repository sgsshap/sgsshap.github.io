import { getLegendNumber } from '@/features/diy-card/api/wiki'
import { getDoubleKingdomList } from '@/features/diy-card/composables/doubleKingdom'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { isSuccess } from '@/shared/api'

/** 组装 /wiki/legend-number 查询用的势力参数（双势力用 & 连接） */
export const resolveLegendNumberQueryKingdom = (info: LegendInfo) => {
  if (info.renderConfig.items.kingdom.doubleKingdom) {
    const list = getDoubleKingdomList(info)
    if (list.length > 0) return list.join('&')
  }
  return info.baseInfo.kingdom || ''
}

/** 按名称 + 势力从编号表查询武将编号（取首个匹配） */
export const fetchLegendNumberForLegend = async (info: LegendInfo): Promise<string | null> => {
  const name = info.baseInfo.name.trim()
  if (!name) return null

  const kingdom = resolveLegendNumberQueryKingdom(info)
  const res = await getLegendNumber(name, kingdom)
  if (!isSuccess(res)) return null

  const first = res.data?.find((item) => typeof item === 'string' && item.trim())
  return first?.trim() ?? null
}
