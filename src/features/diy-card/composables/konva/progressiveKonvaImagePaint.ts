import type Konva from 'konva'

/** vue-konva 组件实例 */
type KonvaComponentRef = { getNode?: () => Konva.Node } | null | undefined

/**
 * 在图片解码过程中反复 batchDraw，实现类似浏览器 img 的逐行刷新效果。
 * @returns 停止 progressive 重绘
 */
export const scheduleProgressiveKonvaRepaint = (
  resolveNode: () => KonvaComponentRef,
): (() => void) => {
  let rafId = 0
  let stopped = false

  const tick = () => {
    if (stopped) return
    const node = resolveNode()?.getNode?.()
    node?.getLayer()?.batchDraw()
    rafId = globalThis.requestAnimationFrame(tick)
  }

  rafId = globalThis.requestAnimationFrame(tick)

  return () => {
    stopped = true
    if (rafId) {
      globalThis.cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}
