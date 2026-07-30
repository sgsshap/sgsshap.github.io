import type { GameInfo } from '@/features/diy-card/types/diy/game'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import type { MarkInfo } from '@/features/diy-card/types/diy/mark'
import type { TemplateType } from '@/features/diy-card/types/template'

/** 与 legend / game / mark 域 store 一一对应 */
export type DiyInfoKind = 'legend' | 'game' | 'mark'

/** 单次修改所属的数据分区（便于历史列表分类展示） */
export type DiyHistoryCategory =
  | 'baseInfo'
  | 'renderConfig'
  | 'skills'
  | 'layout'
  | 'watermark'
  | 'import'
  | 'reset'
  | 'template'
  | 'other'

export type DiyInfoSnapshot = LegendInfo | GameInfo | MarkInfo

/** 可显式传入的历史操作类型 */
export type DiyHistoryOperationType =
  | 'move'
  | 'scale'
  | 'rotate'
  | 'switchTemplate'
  | 'modify'
  | 'reset'
  | 'import'
  | 'other'

/** 元素位移前后状态（可选，供后续 diff / 展示） */
export interface DiyHistoryLayoutState {
  x?: number
  y?: number
  scale?: number
  rotation?: number
}

export interface DiyHistoryRecordInput {
  category: DiyHistoryCategory
  label: string
  /** 为 true 时跳过去重（如读取 .shap 进度，layout 可能变化但语义签名相同） */
  force?: boolean
}

/**
 * 创建历史记录：操作类型、元素名等；前后状态放最后（可选）
 * 未传 label 时按 operation 生成展示文案
 */
export interface DiyHistoryRecordOptions {
  operation: DiyHistoryOperationType
  /** 字段/元素展示名，如「武将名」「体力」 */
  itemName?: string
  category?: DiyHistoryCategory
  /** 完整文案，优先级最高 */
  label?: string
  /**
   * operation 为 modify 且无前后对比时的补充
   * 例：detail「【咆哮】」→ 修改 技能描述：【咆哮】
   */
  detail?: string
  /** 有前后对比时放最后 */
  before?: DiyHistoryLayoutState | unknown
  after?: DiyHistoryLayoutState | unknown
}

export function resolveHistoryRecordInput(options: DiyHistoryRecordOptions): DiyHistoryRecordInput {
  if (options.label) {
    return {
      category: options.category ?? 'other',
      label: options.label,
    }
  }

  switch (options.operation) {
    case 'move':
      return { category: 'layout', label: buildMoveLayoutLabel(options.itemName) }
    case 'scale':
      return { category: 'layout', label: buildScaleLayoutLabel(options.itemName) }
    case 'rotate':
      return { category: 'layout', label: buildRotateLayoutLabel(options.itemName) }
    case 'switchTemplate':
      return {
        category: 'template',
        label: buildSwitchTemplateLabel(options.itemName),
      }
    case 'import':
      return { category: 'import', label: options.label ?? '导入' }
    case 'reset':
      return { category: 'reset', label: '重置画布' }
    case 'modify': {
      const field = options.itemName ?? ''
      if (options.before !== undefined || options.after !== undefined) {
        const prev =
          options.before === undefined || options.before === null
            ? '空'
            : String(options.before)
        const next =
          options.after === undefined || options.after === null ? '空' : String(options.after)
        return {
          category: options.category ?? 'other',
          label: field ? `修改 ${field}：${prev} → ${next}` : `修改：${prev} → ${next}`,
        }
      }
      if (options.detail) {
        return {
          category: options.category ?? 'other',
          label: field ? `修改 ${field}：${options.detail}` : `修改：${options.detail}`,
        }
      }
      return {
        category: options.category ?? 'other',
        label: field ? `修改 ${field}` : '修改',
      }
    }
    default:
      return { category: options.category ?? 'other', label: '修改' }
  }
}

export interface DiyHistoryEntry {
  id: string
  category: DiyHistoryCategory
  label: string
  infoKind: DiyInfoKind
  templateName: string
  createdAt: number
  snapshot: DiyInfoSnapshot
  /** 画布就绪后的锚点快照，不展示在操作历史、不可单独撤销到此步之前 */
  isAnchor?: boolean
}

export const DIY_HISTORY_MAX_ENTRIES = 50

/** 画布元素位移类操作的历史文案：移动 {元素名} */
export function buildMoveLayoutLabel(itemName?: string): string {
  return itemName && itemName !== 'unknown' ? `移动 ${itemName}` : '移动 画布元素'
}

/** 缩放：缩放 {元素名} */
export function buildScaleLayoutLabel(itemName?: string): string {
  return itemName && itemName !== 'unknown' ? `缩放 ${itemName}` : '缩放 画布元素'
}

/** 旋转：旋转 {元素名} */
export function buildRotateLayoutLabel(itemName?: string): string {
  return itemName && itemName !== 'unknown' ? `旋转 ${itemName}` : '旋转 画布元素'
}

/** 切换模板的历史文案：切换模板 {模板展示名} */
export function buildSwitchTemplateLabel(templateLabel?: string): string {
  return templateLabel ? `切换模板 ${templateLabel}` : '切换模板'
}

export const DIY_HISTORY_CATEGORY_LABELS: Record<DiyHistoryCategory, string> = {
  baseInfo: '基础信息',
  renderConfig: '样式配置',
  skills: '技能',
  layout: '画布布局',
  watermark: '水印',
  import: '导入',
  reset: '重置',
  template: '模板',
  other: '其他',
}

/** 由模板业务类型映射到域 store */
export function resolveInfoKind(templateType: TemplateType): DiyInfoKind {
  switch (templateType) {
    case 'game':
      return 'game'
    case 'mark':
      return 'mark'
    default:
      return 'legend'
  }
}
