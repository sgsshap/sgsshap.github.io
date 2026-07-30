import type { PageQuery } from '@/shared/types/api'

export type WikiSearchType = 'legend' | 'image' | 'skill'

export interface WikiSearchQuery extends PageQuery {
  type?: WikiSearchType
  searchType?: number
}

export interface WikiSearchTag {
  value: string
  type?: 'default' | 'info' | 'success' | 'warning' | 'error'
}

export interface WikiSearchCardItem {
  id: number
  name: string
  type: WikiSearchType
  img: string
  desc: string
  /** 原画备注（列表单独展示，避免被关联武将文案覆盖） */
  remark?: string
  /** 关联武将（原画列表/标题） */
  legends?: string
  number?: string
  painter?: string
  quality?: string
  tags?: WikiSearchTag[]
  loading: boolean
}

export interface WikiLegendSelectPayload {
  type: 'legend'
  data: {
    legend: Record<string, unknown>
    version: Record<string, unknown>
    versionLabel?: string
  }
}

export interface WikiImageSelectPayload {
  type: 'image'
  data: {
    url: string
    title: string
    painter: string
  }
}

export interface WikiSkillSelectPayload {
  type: 'skill'
  skillIndex: number
  data: {
    name: string
    desc: string
  }
}
