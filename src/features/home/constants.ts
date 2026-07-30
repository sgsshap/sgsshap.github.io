import { BUG_FEEDBACK_SHEET_URL, LEGACY_SGS_SHAP_URL, SUGGESTION_FEEDBACK_SHEET_URL } from '@/shared/constants/site'
import {
  BrushRound,
  CodeRound,
  DevicesRound,
  GroupsRound,
  PaletteRound,
  PrintRound,
  StorageRound,
  TuneRound,
  ViewCarouselRound
} from '@vicons/material'
import type { Component } from 'vue'

/** 首页特性卡片 */
export interface HomeFeatureItem {
  dimension: string
  detail: string
  icon: Component
}

/** 贡献者招募角色 */
export interface HomeContributorRole {
  title: string
  detail: string
  icon: Component
}

/** 外部链接 */
export interface HomeExternalLink {
  label: string
  href: string
  description?: string
}

export const HOME_TAGLINE = '新一代《三国杀》制图网站'
export const HOME_SUBTITLE = '告别历史包袱，从 0 到 1 的彻底重构'

export const HOME_DEVELOPER_NOTE = [
  '曾经的 sgs-shap 陪伴了很多玩家，但由于早期的历史原因，底层设计存在诸多局限，导致代码维护困难、Bug 频出，用户体验始终无法达到理想状态。',
  '为了彻底解决这些问题，作者选择不再在旧代码上「打补丁」，而是直接推倒重来。',
  'JxShap 是从 0 到 1 重构的开源项目，抛弃陈旧技术负债，旨在构建现代化、高扩展性的制图工具，让制图变得更简单。',
] as const

export const HOME_FEATURES: readonly HomeFeatureItem[] = [
  {
    dimension: '印刷支持',
    detail: '支持制图模板「出血」功能，满足线下实体卡牌印刷需求。',
    icon: PrintRound,
  },
  {
    dimension: '设计自由',
    detail: '重构势力色系统，支持全色域自由配置。',
    icon: PaletteRound,
  },
  {
    dimension: '多端适配',
    detail: '完美兼容 iOS、安卓、Windows 多端使用场景（尽量）。',
    icon: DevicesRound,
  },
  {
    dimension: '体验优化',
    detail: '本地缓存制图历史、多语言国际化、深度主题定制。',
    icon: TuneRound,
  },
  {
    dimension: '多 UI 模板',
    detail: '复刻原 sgs-shap 模板并持续新增，提升制图体验。',
    icon: ViewCarouselRound,
  },
] as const

export const HOME_CONTRIBUTOR_ROLES: readonly HomeContributorRole[] = [
  {
    title: '前端',
    detail: '熟悉 Vue 3 / TypeScript（当前核心需求）',
    icon: CodeRound,
  },
  {
    title: '后端',
    detail: '熟悉 Spring Boot / 文件存储',
    icon: StorageRound,
  },
  {
    title: 'UI / UX',
    detail: '优化交互与视觉体验',
    icon: BrushRound,
  },
  {
    title: '爱好者',
    detail: '无论技能深浅，热心开源即可',
    icon: GroupsRound,
  },
] as const

/** 网站普通用户 QQ 群（内测群、开发群由管理员另行引导） */
export const HOME_QQ_GROUP_NAME = '网站用户群'
export const HOME_QQ_GROUP_NUMBER = '799807498'

export const HOME_CONTRIBUTOR_QUOTE =
  '「汉室衰微，本人才疏学浅」—— 诚邀志同道合的伙伴一起完善 JxShap。'

export const HOME_EXTERNAL_LINKS: readonly HomeExternalLink[] = [
  {
    label: '开源仓库',
    href: 'https://gitee.com/gxkord/open-shap2-web',
    description: 'Gitee · JxShap',
  },
  {
    label: 'BUG 反馈',
    href: BUG_FEEDBACK_SHEET_URL,
    description: '腾讯文档 · 新网站问题收集',
  },
  {
    label: '功能建议',
    href: SUGGESTION_FEEDBACK_SHEET_URL,
    description: '腾讯文档 · 新网站建议收集',
  },
  {
    label: '旧网站访问',
    href: LEGACY_SGS_SHAP_URL,
    description: '经典版制图站点',
  },
] as const
