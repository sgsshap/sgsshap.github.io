import type { DictItem } from '@/shared/types/api'
import { getKingdomLabel as getKingdomLabelFromKey } from '@/shared/utils/kingdom'

export const getLabel = (value: string | undefined, options: DictItem[]) => {
  if (!value || options.length === 0) {
    return ''
  }
  return options.find((item) => item.value === value)?.label ?? ''
}

export const getNameLabel = (name: string, name2?: string, name3?: string) => {
  const split = '、'
  return `${name}${name2 ? split + name2 : ''}${name3 ? split + name3 : ''}`
}

/** 百科势力字段（可能含 & 连接的双势力） */
export const getWikiKingdomLabel = (kingdom: string | undefined, kingdomOptions: DictItem[]) => {
  if (!kingdom) {
    return ''
  }
  if (kingdomOptions.length === 0) {
    return getKingdomLabelFromKey(kingdom.split('&')[0] ?? kingdom)
  }
  const split = '&'
  return kingdom
    .split('&')
    .map((part) => getLabel(part, kingdomOptions) || getKingdomLabelFromKey(part))
    .join(split)
}
