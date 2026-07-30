import type { DiyHistoryCategory } from '@/features/diy-card/types/diy/history'
import { scheduleCanvasVisualSettled } from '@/features/diy-card/composables/preview/canvasVisualSettled'
import { useDiyHistoryStore, useDiyStore } from '@/features/diy-card/stores'
import { record } from '@/features/diy-card/utils/diyHistoryRecord'
import { scheduleAfterUiPaint } from '@/shared/utils/scheduling'
import { formatPresetKingdomHistoryLabel } from '@/features/diy-card/constants/kingdomPresets'
import { formatOrderedKingdoms, getKingdomLabel } from '@/shared/utils/kingdom'

export type HistoryValueFormat =
  | 'default'
  | 'bool'
  | 'yesNo'
  | 'kingdom'
  | 'kingdoms'
  | 'presetKingdom'

/** 历史列表中的字段值展示 */
export function formatHistoryValue(
  value: unknown,
  format: HistoryValueFormat = 'default',
): string {
  if (value === undefined || value === null) return '空'

  if (typeof value === 'boolean') {
    if (format === 'yesNo') return value ? '是' : '否'
    return value ? '开' : '关'
  }

  if (typeof value === 'number') return String(value)

  if (typeof value === 'string') {
    if (format === 'kingdom') return getKingdomLabel(value) || value
    if (format === 'presetKingdom') {
      const label = formatPresetKingdomHistoryLabel(value)
      return label || '空'
    }
    if (
      value.startsWith('data:image') ||
      value.includes('/diy/shared/images/') ||
      value.includes('/assets/images/') ||
      value.includes('/images/')
    )
      return '已更换'
    const text = value.trim()
    if (!text) return '空'
    return text.length > 24 ? `${text.slice(0, 24)}…` : text
  }

  if (Array.isArray(value)) {
    if (format === 'kingdoms') {
      return formatOrderedKingdoms(value) || '空'
    }
    return value.length ? `${value.length} 项` : '空'
  }

  return String(value)
}

export interface RecordModifyOptions {
  category?: DiyHistoryCategory
  /** 完整文案，优先级最高 */
  label?: string
  /**
   * 无前后对比时的补充：修改 {字段}：{detail}
   * 例：detail 为「【咆哮】」→ 修改 技能描述：【咆哮】
   */
  detail?: string
  format?: HistoryValueFormat
  /** 有前后对比时放最后：修改 {字段}：{before} → {after} */
  before?: unknown
  after?: unknown
  /** 与当前指针快照相同时也写入历史（角标等异步 settle 后补记） */
  force?: boolean
}

/** 生成「修改」类历史文案 */
export function buildModifyLabel(field: string, options?: RecordModifyOptions): string {
  if (options?.label) return options.label

  const format = options?.format ?? 'default'
  const hasDiff = options?.before !== undefined || options?.after !== undefined

  if (hasDiff) {
    return `修改 ${field}：${formatHistoryValue(options?.before, format)} → ${formatHistoryValue(options?.after, format)}`
  }

  if (options?.detail) {
    return `修改 ${field}：${options.detail}`
  }

  return `修改 ${field}`
}

/**
 * 记录配置项修改
 *
 * @example
 * recordModify('武将图', { category: 'baseInfo' })
 * recordModify('技能描述', { detail: '【咆哮】', category: 'skills' })
 * recordModify('水印开关', { category: 'watermark', format: 'bool', before: false, after: true })
 */
export function recordModify(field: string, options?: RecordModifyOptions) {
  if (options?.before !== undefined || options?.after !== undefined) {
    if (Object.is(options.before, options.after)) return
    if (
      options.format === 'kingdoms' &&
      JSON.stringify(options.before) === JSON.stringify(options.after)
    ) {
      return
    }
  }

  record({
    category: options?.category ?? 'other',
    label: buildModifyLabel(field, options),
    force: options?.force,
  })
}

/**
 * 文本输入 blur 时记录历史。
 * 画布 settle 可能已把 layout 写回当前指针快照，须 force 避免与 prev 签名相同被去重。
 */
export function recordTextBlurModify(
  field: string,
  before: string,
  after: string,
  options?: Omit<RecordModifyOptions, 'before' | 'after' | 'force'>,
) {
  if (before === after) return
  recordModify(field, { ...options, before, after, force: true })
}

/**
 * blur 时以当前历史指针快照为 before（比 focus 缓存更可靠，避免删字后 settle 竞态）
 * @deprecated 优先使用 createTextBlurHistoryHandlers（focus 缓存更可靠）
 */
export function recordTextBlurModifyAgainstHistory(
  field: string,
  after: string,
  readBefore: (snapshot: import('@/features/diy-card/types/diy/history').DiyInfoSnapshot) => string,
  options?: Omit<RecordModifyOptions, 'before' | 'after' | 'force'>,
) {
  const historyStore = useDiyHistoryStore()
  const entry = historyStore.currentEntry
  const before = entry ? readBefore(entry.snapshot) : after
  recordTextBlurModify(field, before, after, options)
}

/** focus 缓存 + blur 记录，避免画布 settle 抢先更新指针快照导致漏记 */
export function createTextBlurHistoryHandlers(
  field: string,
  getValue: () => string,
  options?: Omit<RecordModifyOptions, 'before' | 'after' | 'force'>,
) {
  let focusValue = ''
  return {
    onFocus: () => {
      focusValue = getValue()
    },
    onBlur: () => {
      recordTextBlurModify(field, focusValue, getValue(), options)
    },
  }
}

/**
 * 更新字段并写入历史（开关、数字、单选等即时生效控件）
 */
export function applyFieldChange<T>(
  field: string,
  prev: T,
  next: T,
  apply: (value: T) => void,
  options?: Omit<RecordModifyOptions, 'before' | 'after'> & {
    format?: HistoryValueFormat
    after?: () => void
  },
) {
  if (Object.is(prev, next)) return
  apply(next)
  scheduleCanvasVisualSettled({
    isCanvasLoading: () => useDiyStore().isCanvasLoading,
  })
  const { after, format, ...rest } = options ?? {}
  scheduleAfterUiPaint(() => {
    recordModify(field, { ...rest, format, before: prev, after: next })
    after?.()
  })
}
