import { useDiyHistoryStore } from '@/features/diy-card/stores'
import {
  resolveHistoryRecordInput,
  type DiyHistoryRecordInput,
  type DiyHistoryRecordOptions,
} from '@/features/diy-card/types/diy/history'

export type DiyRecordInput = DiyHistoryRecordOptions | DiyHistoryRecordInput

let suppressRecordUntil = 0

/**
 * 批量写入数据（如读取进度）后短暂忽略连带触发的 record，避免误记「修改 技能描述」等
 */
export function suppressHistoryRecord(ms = 1000) {
  suppressRecordUntil = Date.now() + ms
}

const isImportHistoryRecord = (input: DiyRecordInput) => {
  if ('operation' in input) {
    return input.operation === 'import'
  }
  return input.category === 'import'
}

const isHistoryRecordSuppressed = (input: DiyRecordInput) => {
  if (Date.now() >= suppressRecordUntil) return false
  if (isImportHistoryRecord(input)) return false
  return true
}

/**
 * 写入一条操作历史（在各按钮/操作完成并改完数据后自行调用）
 *
 * @example
 * record({ operation: 'move', itemName: '武将名' })
 * record({ operation: 'modify', itemName: '武将图' })
 * record({ operation: 'modify', itemName: '技能描述', detail: '【咆哮】' })
 * record({ operation: 'modify', itemName: '水印开关', before: false, after: true })
 */
export function record(input: DiyRecordInput) {
  const historyStore = useDiyHistoryStore()
  if (historyStore.isRestoring) return
  if (historyStore.isBootstrapping) return
  if (isHistoryRecordSuppressed(input)) return

  const resolved =
    'operation' in input ? resolveHistoryRecordInput(input) : input
  historyStore.record(resolved)
}

/**
 * 画布与模板加载完成后写入「初始状态」锚点（须在首次 record 之前调用）
 */
export async function initDiyHistory() {
  await useDiyHistoryStore().ensureHistoryBootstrapped()
}

/**
 * 重置画布：按工厂默认值重新创建武将/牌面信息，不读取历史锚点，并记入操作历史（可撤销）
 */
export async function resetCanvasToInitial() {
  const historyStore = useDiyHistoryStore()
  await historyStore.resetToInitialState()
}

/** 从零开始：清空历史 → 重置画布 → 写入「初始状态」（不可撤销） */
export async function resetCanvasAndHistoryCompletely() {
  const historyStore = useDiyHistoryStore()
  await historyStore.resetCanvasAndHistoryCompletely()
}

/** 读取 .shap 进度后的历史记录，列表文案固定为「读取进度」 */
export function recordReadProgress() {
  const historyStore = useDiyHistoryStore()
  if (historyStore.isRestoring) return
  if (historyStore.isBootstrapping) return

  historyStore.record({
    category: 'import',
    label: '读取进度',
    force: true,
  })
}
