import { shouldUseReducedCanvasQuality } from '@/shared/utils/deviceCapability'
import { nextTick } from 'vue'

/** 弱机额外等待一帧时间，给侧栏开关等 DOM 先完成绘制 */
const EXTRA_DEFER_MS = () => (shouldUseReducedCanvasQuality() ? 24 : 0)

/**
 * 在 Vue DOM 更新并完成至少一帧绘制后再执行任务，避免与开关动画、面板重排抢主线程。
 * @returns 取消尚未执行的任务
 */
export function scheduleAfterUiPaint(task: () => void): () => void {
  let cancelled = false
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  let rafOuter = 0
  let rafInner = 0

  const runTask = () => {
    if (cancelled) return
    const extra = EXTRA_DEFER_MS()
    if (extra > 0) {
      timeoutId = globalThis.setTimeout(task, extra)
    } else {
      task()
    }
  }

  nextTick(() => {
    if (cancelled) return
    rafOuter = globalThis.requestAnimationFrame(() => {
      if (cancelled) return
      rafInner = globalThis.requestAnimationFrame(runTask)
    })
  })

  return () => {
    cancelled = true
    globalThis.cancelAnimationFrame(rafOuter)
    globalThis.cancelAnimationFrame(rafInner)
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId)
    }
  }
}
