import { shouldUseReducedCanvasQuality } from '@/shared/utils/deviceCapability'
import { nextTick } from 'vue'

/** 与 Naive UI n-switch 默认 transition 对齐（约 0.3s cubic-bezier） */
export const getSwitchTransitionMs = () => (shouldUseReducedCanvasQuality() ? 320 : 300)

/**
 * 在侧栏开关 transition 结束后再执行任务，避免与滑块动画抢主线程。
 * @returns 取消尚未执行的任务
 */
export function scheduleAfterSwitchTransition(task: () => void): () => void {
  let cancelled = false
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  let rafOuter = 0
  let rafInner = 0

  const runAfterTransition = () => {
    if (cancelled) return
    timeoutId = globalThis.setTimeout(task, getSwitchTransitionMs())
  }

  nextTick(() => {
    if (cancelled) return
    rafOuter = globalThis.requestAnimationFrame(() => {
      if (cancelled) return
      rafInner = globalThis.requestAnimationFrame(runAfterTransition)
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
