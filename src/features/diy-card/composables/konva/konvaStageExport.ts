import {
  getDefaultCachePixelRatio,
  restoreKonvaNodePreviewCache,
} from '@/features/diy-card/composables/konva/konvaCache'
import Konva from 'konva'
import type { Stage } from 'konva/lib/Stage'

export type StageExportConfig = NonNullable<Parameters<Stage['toDataURL']>[0]>

/** 节点原图相对当前显示尺寸的最大可用 pixelRatio（避免离屏 cache 放大素材） */
const resolveNodeSourcePixelRatioCap = (node: Konva.Shape): number | undefined => {
  if (node.getType() !== 'Image') return undefined
  const imageNode = node as Konva.Image
  const img = imageNode.image()
  if (!(img instanceof HTMLImageElement) || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return undefined
  }
  const width = imageNode.width() * Math.abs(imageNode.scaleX())
  const height = imageNode.height() * Math.abs(imageNode.scaleY())
  if (width <= 0 || height <= 0) return undefined
  return Math.min(img.naturalWidth / width, img.naturalHeight / height)
}

/**
 * 导出滤镜离屏缓存 pixelRatio：
 * - 不低于导出倍率
 * - 尽量利用预览 DPR 与原图分辨率做超采样（300 PPI 时 export≈1.62、DPR≈2，旧逻辑只用 1.62 会偏糊）
 */
const resolveExportFilterCachePixelRatio = (
  node: Konva.Shape,
  exportPixelRatio: number,
): number => {
  const supersampleTarget = Math.max(exportPixelRatio, getDefaultCachePixelRatio())
  const sourceCap = resolveNodeSourcePixelRatioCap(node)
  if (sourceCap === undefined) {
    return supersampleTarget
  }
  return Math.max(exportPixelRatio, Math.min(supersampleTarget, sourceCap))
}

/** 导出时是否须重建离屏 cache 才能正确写入图层着色滤镜 */
const needsExportFilterCache = (node: Konva.Node): node is Konva.Shape => {
  if (!(node instanceof Konva.Shape)) return false
  const filters = node.filters()
  return Boolean(filters && filters.length > 0)
}

/** 导出前为带滤镜节点重建高分辨率离屏缓存（Konva 滤镜仅对 cache 后的 Shape 生效） */
const cacheFilteredNodesForExport = (stage: Stage, exportPixelRatio: number): Konva.Shape[] => {
  const nodes = stage.find((node: Konva.Node) => needsExportFilterCache(node)) as Konva.Shape[]
  for (const node of nodes) {
    node.clearCache()
    node.cache({
      pixelRatio: resolveExportFilterCachePixelRatio(node, exportPixelRatio),
      imageSmoothingEnabled: true,
    })
  }
  return nodes
}

/**
 * 导出 Stage 为 DataURL
 *
 * 导出前临时清除各节点离屏缓存，避免预览用低 pixelRatio 位图被 toDataURL 放大导致文字发糊；
 * 带滤镜的 Image（frame/hp 改色等）须按导出 pixelRatio 重新 cache，否则滤镜不会写入导出图；
 * 导出完成后按节点记录恢复预览缓存。
 */
export function captureStageDataURL(stage: Stage, config: StageExportConfig): string {
  const cachedNodes: Konva.Node[] = []
  stage.find((node: Konva.Node) => {
    if (node.isCached()) {
      cachedNodes.push(node)
    }
    return false
  })

  for (const node of cachedNodes) {
    node.clearCache()
  }

  const exportPixelRatio = config.pixelRatio ?? 1
  const exportFilterNodes = cacheFilteredNodesForExport(stage, exportPixelRatio)

  try {
    stage.batchDraw()
    return stage.toDataURL({
      ...config,
      imageSmoothingEnabled: true,
    })
  } finally {
    for (const node of exportFilterNodes) {
      node.clearCache()
    }
    for (const node of cachedNodes) {
      restoreKonvaNodePreviewCache(node)
    }
    stage.batchDraw()
  }
}
