import { scheduleAfterUiPaint } from '@/shared/utils/scheduling/scheduleAfterUiPaint'

/**
 * 低优先级任务（如历史快照 JSON），在浏览器空闲时执行，避免与开关交互抢主线程。
 */
export function scheduleIdleTask(task: () => void): () => void {
  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(task, { timeout: 250 })
    return () => globalThis.cancelIdleCallback(id)
  }
  return scheduleAfterUiPaint(task)
}
