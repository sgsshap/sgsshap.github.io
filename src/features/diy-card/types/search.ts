import type { PageQuery } from '@/shared/types/api'
export type {
  WikiImageSelectPayload,
  WikiLegendSelectPayload,
  WikiSearchCardItem,
  WikiSearchQuery,
  WikiSearchTag,
  WikiSearchType,
  WikiSkillSelectPayload,
} from '@/shared/types/wiki'

export type DiySearchMode = 'legend' | 'image' | 'skill' | 'package'

export interface MaterialSearchQuery extends PageQuery {
  type?: string
}

export interface MaterialSearchCardItem {
  id: number
  name: string
  type: string
  img: string
  desc: string
  loading: boolean
}

export interface MaterialSelectPayload {
  type: 'material'
  data: {
    url: string
  }
}

export type DiySearchSelectPayload =
  | import('@/shared/types/wiki').WikiLegendSelectPayload
  | import('@/shared/types/wiki').WikiImageSelectPayload
  | import('@/shared/types/wiki').WikiSkillSelectPayload
  | MaterialSelectPayload
