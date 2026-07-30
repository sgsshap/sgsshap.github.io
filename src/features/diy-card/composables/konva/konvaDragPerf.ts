import { isIOSWebKit, shouldUseReducedCanvasQuality } from '@/shared/utils/deviceCapability'
import { ensureKonvaFilterImageCache, konvaNodeNeedsFilterCache } from '@/features/diy-card/composables/konva/konvaCache'
import Konva from 'konva'

const PERF_DRAW_KEY = '_shapPerfDraw'

const walkKonvaSubtree = (node: Konva.Node, visit: (n: Konva.Node) => void) => {
  visit(node)
  if (node instanceof Konva.Container) {
    for (const child of node.getChildren()) {
      walkKonvaSubtree(child, visit)
    }
  }
}

const shouldOptimizeKonvaDrag = () => shouldUseReducedCanvasQuality() || isIOSWebKit()

/** 拖拽期间关闭命中检测，减轻弱机 / iOS 每帧 hit 计算 */
export function beginKonvaDragPerf(): void {
  if (!shouldOptimizeKonvaDrag()) return
  Konva.hitOnDragEnabled = false
}

export function endKonvaDragPerf(): void {
  if (!shouldOptimizeKonvaDrag()) return
  Konva.hitOnDragEnabled = true
}

/**
 * 拖拽中临时清缓存、关闭 perfectDraw，松手后由 updateNode 重新 cache。
 * 带 RGB 滤镜着色的 Image 须保留 cache，否则拖拽过程中染色会消失。
 */
export function setKonvaDragSubtreePerf(root: Konva.Node, enabled: boolean): void {
  walkKonvaSubtree(root, (node) => {
    if (konvaNodeNeedsFilterCache(node)) {
      if (!enabled) {
        ensureKonvaFilterImageCache(node)
      }
      return
    }

    if (!shouldOptimizeKonvaDrag()) return

    if (enabled) {
      if (typeof node.isCached === 'function' && node.isCached()) {
        node.clearCache()
      }
      if ('perfectDrawEnabled' in node) {
        const textLike = node as Konva.Shape
        if (textLike.perfectDrawEnabled()) {
          node.setAttr(PERF_DRAW_KEY, true)
          textLike.perfectDrawEnabled(false)
        }
      }
      return
    }

    if (node.getAttr(PERF_DRAW_KEY) && 'perfectDrawEnabled' in node) {
      ;(node as Konva.Shape).perfectDrawEnabled(true)
      node.setAttr(PERF_DRAW_KEY, undefined)
    }
  })
}
