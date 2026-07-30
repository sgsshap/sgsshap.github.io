import type { WikiSearchType } from '@/shared/types/wiki'

export const WIKI_INTRO_STORAGE_KEY = 'shap2-wiki-intro-dismissed'

export interface WikiTypeTab {
  key: WikiSearchType
  label: string
  hint: string
}

export const WIKI_TYPE_TABS: readonly WikiTypeTab[] = [
  {
    key: 'legend',
    label: '武将',
    hint: '按武将编号归类，弱化三服分包边界',
  },
  {
    key: 'skill',
    label: '技能',
    hint: '对照线下描述规则，便于制图时少出错',
  },
  {
    key: 'image',
    label: '原画',
    hint: '精选武将/皮肤原画，支持画师与势力筛选',
  },
] as const

export const WIKI_INTRO_PARAGRAPHS = [
  {
    title: '功能说明',
    lines: [
      '百科搜索功能仍在测试阶段，数据及功能不完善，仅供参考。',
      '现诚招武将信息、技能描述、原画维护等相关贡献者。',
    ],
  },
  {
    title: '维护目的',
    lines: [
      '弱化线上三服的边界，完全用武将编号来归类武将。',
      '技能描述对照线下规则，帮助刚接触制图的人少出错。',
      '精选武将版本，帮大家找到设计和可玩性较高的版本。',
    ],
  },
] as const

export const WIKI_QQ_GROUP = '799807498'
