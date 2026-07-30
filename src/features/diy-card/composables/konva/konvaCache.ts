import { getKonvaHighCachePixelRatio, getKonvaPixelRatioCap } from '@/shared/utils/deviceCapability'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import Konva from 'konva'

type TintImageConfig = CanvasItemConfig & {
  red?: number
  green?: number
  blue?: number
}

const MAX_FILTER_CACHE_DEFER_ATTEMPTS = 16

const konvaConfigHasImageFilters = (config: CanvasItemConfig) => {
  const tint = config as TintImageConfig
  return Boolean(tint.image && Array.isArray(tint.filters) && tint.filters.length >= 1)
}

/** kingdomFrameTint 等着色滤镜依赖 node.red/green/blue */
const konvaConfigUsesRgbTint = (config: CanvasItemConfig) => {
  const tint = config as TintImageConfig
  return (
    typeof tint.red === 'number' &&
    typeof tint.green === 'number' &&
    typeof tint.blue === 'number'
  )
}

/** 将配置中的 RGB / 滤镜同步到 Konva Image（vue-konva 展平子节点时 attrs 可能滞后） */
export const syncKonvaTintAttrsFromConfig = (
  node: Konva.Node,
  sourceConfig: CanvasItemConfig,
) => {
  if (!konvaConfigNeedsFilterCache(sourceConfig)) return
  if (node.getType() !== 'Image') return
  const tint = sourceConfig as TintImageConfig
  const image = node as Konva.Image
  if (konvaConfigUsesRgbTint(sourceConfig)) {
    image.red(tint.red!)
    image.green(tint.green!)
    image.blue(tint.blue!)
  } else {
    image.red(255)
    image.green(255)
    image.blue(255)
  }
  if (Array.isArray(tint.filters) && tint.filters.length > 0) {
    image.filters(tint.filters as unknown as Parameters<Konva.Image['filters']>[0])
  }
}

/** Konva Image 挂载自定义滤镜时须离屏 cache，否则滤镜不生效（含势力字三层渐变等无 RGB 的像素滤镜） */
export const konvaConfigNeedsFilterCache = (config: CanvasItemConfig) =>
  konvaConfigHasImageFilters(config)

/** 运行时 Konva 节点是否依赖离屏 cache 才能正确显示滤镜着色 */
export const konvaNodeNeedsFilterCache = (node: Konva.Node) => {
  if (node.getType() !== 'Image') return false
  if (node.getAttr(KONVA_CACHE_LAYER_CODE_ATTR)) return true
  const filters = node.filters?.()
  return Array.isArray(filters) && filters.length > 0
}

export const walkKonvaSubtree = (node: Konva.Node, visit: (n: Konva.Node) => void) => {
  visit(node)
  if (node instanceof Konva.Container) {
    for (const child of node.getChildren()) {
      walkKonvaSubtree(child, visit)
    }
  }
}

/** 清除文本/容器离屏缓存并触发重绘（多层叠字在 cache 后易出现仅描边可见） */
export const invalidateKonvaTextSubtree = (root: Konva.Node) => {
  walkKonvaSubtree(root, (node) => {
    if (typeof node.isCached === 'function' && node.isCached()) {
      node.clearCache()
    }
  })
  root.getLayer()?.batchDraw()
}

/** 仅清除 Text 离屏缓存，避免误清技能框 left/right 等着色 Image 的滤镜 cache */
export const invalidateKonvaTextNodesInSubtree = (root: Konva.Node) => {
  walkKonvaSubtree(root, (node) => {
    if (node.getType() !== 'Text') return
    if (typeof node.isCached === 'function' && node.isCached()) {
      node.clearCache()
    }
  })
  root.getLayer()?.batchDraw()
}

const isKonvaImageReady = (node: Konva.Node) => {
  if (node.getType() !== 'Image') return true
  const img = (node as Konva.Image).image()
  if (!(img instanceof HTMLImageElement)) return true
  return img.complete && img.naturalWidth > 0
}

/** kingdomFrameTint 读取 node.red/green/blue；属性未同步前 cache 会烘焙成黑色 */
export const isKonvaTintAttrsSynced = (node: Konva.Node, sourceConfig?: CanvasItemConfig) => {
  if (!sourceConfig || !konvaConfigNeedsFilterCache(sourceConfig)) return true
  if (!konvaConfigUsesRgbTint(sourceConfig)) return true
  const tint = sourceConfig as TintImageConfig
  return (
    node.red() === tint.red &&
    node.green() === tint.green &&
    node.blue() === tint.blue
  )
}

const konvaImageCropMatchesConfig = (node: Konva.Image, sourceConfig: CanvasItemConfig) => {
  const cfgCrop = sourceConfig.crop
  if (!cfgCrop) return true
  const crop = node.crop()
  return (
    crop?.x === cfgCrop.x &&
    crop?.y === cfgCrop.y &&
    crop?.width === cfgCrop.width &&
    crop?.height === cfgCrop.height
  )
}

/** 配置已不再着色但节点仍残留滤镜/cache 时清除（如「从零开始」关自定义势力） */
export const clearKonvaFilterPreviewFromNode = (node: Konva.Node) => {
  if (typeof node.isCached === 'function' && node.isCached()) {
    node.clearCache()
  }
  if (node.getType() !== 'Image') return
  const image = node as Konva.Image
  if (Array.isArray(image.filters?.()) && image.filters!().length > 0) {
    image.filters([])
  }
  image.setAttr(KONVA_CACHE_LAYER_CODE_ATTR, undefined)
  image.setAttr(KONVA_CACHE_HIGH_DPR_ATTR, undefined)
  image.setAttr(KONVA_CACHE_TINT_RGB_ATTR, undefined)
  image.setAttr(KONVA_CACHE_FILTER_SIGNATURE_ATTR, undefined)
  image.setAttr(KONVA_CACHE_IMAGE_SOURCE_ATTR, undefined)
}

/** 预览区滤镜 Image 的离屏 cache 是否仍与当前配置一致（避免 clearCache 造成着色闪一下） */
export const konvaFilterPreviewCacheUpToDate = (
  node: Konva.Node,
  sourceConfig?: CanvasItemConfig,
) => {
  if (!sourceConfig || !konvaConfigNeedsFilterCache(sourceConfig)) {
    if (konvaNodeNeedsFilterCache(node)) return false
    return true
  }
  // 配置需要着色 cache，但 Konva 节点尚未挂上 filters / cache — 不能跳过
  if (!konvaNodeNeedsFilterCache(node)) return false
  if (typeof node.isCached !== 'function' || !node.isCached()) return false
  if (!isKonvaTintAttrsSynced(node, sourceConfig)) return false
  if (konvaConfigUsesRgbTint(sourceConfig)) {
    const tint = sourceConfig as TintImageConfig
    const bakedRgb = node.getAttr(KONVA_CACHE_TINT_RGB_ATTR) as string | undefined
    const expectedRgb = `${tint.red},${tint.green},${tint.blue}`
    if (bakedRgb !== expectedRgb) return false
  } else if (node.getAttr(KONVA_CACHE_TINT_RGB_ATTR)) {
    return false
  }
  const expectedFilterSignature = sourceConfig.filterCacheSignature
  if (expectedFilterSignature !== undefined) {
    if (node.getAttr(KONVA_CACHE_FILTER_SIGNATURE_ATTR) !== expectedFilterSignature) {
      return false
    }
  } else if (node.getAttr(KONVA_CACHE_FILTER_SIGNATURE_ATTR)) {
    return false
  }
  if (node.getType() !== 'Image') return true
  const image = node as Konva.Image
  const nodeImage = image.image()
  const configImage = sourceConfig.image
  const bakedImage = node.getAttr(KONVA_CACHE_IMAGE_SOURCE_ATTR)
  if (configImage && nodeImage !== configImage) return false
  if (bakedImage !== undefined && bakedImage !== nodeImage) return false
  // 仅位移变化时 cache 内容仍有效，勿 clearCache（改描述时底图/技能框会随布局移动）
  return (
    image.width() === sourceConfig.width &&
    image.height() === sourceConfig.height &&
    image.scaleX() === (sourceConfig.scaleX ?? 1) &&
    image.scaleY() === (sourceConfig.scaleY ?? 1) &&
    konvaImageCropMatchesConfig(image, sourceConfig)
  )
}

const canCacheKonvaFilterNode = (node: Konva.Node, sourceConfig?: CanvasItemConfig) =>
  isKonvaImageReady(node) && isKonvaTintAttrsSynced(node, sourceConfig)

const writeKonvaNodeCache = (
  node: Konva.Node,
  layerCode: string,
  highDprCacheCodes?: ReadonlySet<string> | readonly string[],
  sourceConfig?: CanvasItemConfig,
) => {
  const highDpr = resolveLayerCachePixelRatio(layerCode, highDprCacheCodes) > getDefaultCachePixelRatio()
  node.setAttr(KONVA_CACHE_LAYER_CODE_ATTR, layerCode)
  node.setAttr(KONVA_CACHE_HIGH_DPR_ATTR, highDpr)
  if (sourceConfig && konvaConfigNeedsFilterCache(sourceConfig) && konvaConfigUsesRgbTint(sourceConfig)) {
    const tint = sourceConfig as TintImageConfig
    node.setAttr(
      KONVA_CACHE_TINT_RGB_ATTR,
      `${tint.red},${tint.green},${tint.blue}`,
    )
  } else {
    node.setAttr(KONVA_CACHE_TINT_RGB_ATTR, undefined)
  }
  if (sourceConfig?.filterCacheSignature) {
    node.setAttr(KONVA_CACHE_FILTER_SIGNATURE_ATTR, sourceConfig.filterCacheSignature)
  } else {
    node.setAttr(KONVA_CACHE_FILTER_SIGNATURE_ATTR, undefined)
  }
  if (node.getType() === 'Image') {
    node.setAttr(KONVA_CACHE_IMAGE_SOURCE_ATTR, (node as Konva.Image).image())
  } else {
    node.setAttr(KONVA_CACHE_IMAGE_SOURCE_ATTR, undefined)
  }
  node.clearCache()
  node.cache({
    pixelRatio: resolveLayerCachePixelRatio(layerCode, highDprCacheCodes),
    imageSmoothingEnabled: true,
  })
}

/** 滤镜着色 Image 在 cache 丢失时补回（拖拽过程中 Konva 可能临时失效 cache） */
export const ensureKonvaFilterImageCache = (node: Konva.Node, sourceConfig?: CanvasItemConfig) => {
  if (!konvaNodeNeedsFilterCache(node)) return
  if (typeof node.isCached === 'function' && node.isCached()) return
  const layerCode = (node.getAttr('code') as string | undefined) ?? 'kingdom'
  cacheKonvaNode(node, layerCode, undefined, sourceConfig)
}

export const ensureKonvaFilterImageCacheInSubtree = (root: Konva.Node) => {
  walkKonvaSubtree(root, (node) => ensureKonvaFilterImageCache(node))
}

/** 记录图层 code，供导出后恢复预览缓存 */
export const KONVA_CACHE_LAYER_CODE_ATTR = 'cacheLayerCode'

/** 记录是否使用高 DPR 缓存 */
export const KONVA_CACHE_HIGH_DPR_ATTR = 'cacheHighDpr'

/** 上次离屏 cache 烘焙时的 RGB（与 node.red 可能已同步但位图仍是旧色） */
export const KONVA_CACHE_TINT_RGB_ATTR = 'cacheTintRgb'

/** 上次离屏 cache 烘焙时的像素滤镜签名（角标渐变等无 RGB 滤镜） */
export const KONVA_CACHE_FILTER_SIGNATURE_ATTR = 'cacheFilterSignature'

/** 上次离屏 cache 烘焙时的 image 源（canvas 挖洞等会换引用但尺寸不变） */
export const KONVA_CACHE_IMAGE_SOURCE_ATTR = 'cacheImageSource'

/** 预览区默认 Konva 离屏缓存 pixelRatio */
export function getDefaultCachePixelRatio() {
  return Math.min(Math.max(globalThis.devicePixelRatio || 1, 1), getKonvaPixelRatioCap())
}

/** 按图层 code 解析预览缓存 pixelRatio */
export function resolveLayerCachePixelRatio(
  layerCode: string,
  highDprCacheCodes?: ReadonlySet<string> | readonly string[],
) {
  const highSet =
    highDprCacheCodes instanceof Set ? highDprCacheCodes : new Set(highDprCacheCodes ?? [])
  return highSet.has(layerCode) ? getKonvaHighCachePixelRatio() : getDefaultCachePixelRatio()
}

/** 写入预览用离屏缓存（updateNode 后调用） */
export function cacheKonvaNode(
  node: Konva.Node,
  layerCode: string,
  highDprCacheCodes?: ReadonlySet<string> | readonly string[],
  sourceConfig?: CanvasItemConfig,
  deferAttempt = 0,
) {
  if (!canCacheKonvaFilterNode(node, sourceConfig)) {
    if (deferAttempt >= MAX_FILTER_CACHE_DEFER_ATTEMPTS) {
      return
    }
    if (node.getType() === 'Image') {
      const img = (node as Konva.Image).image()
      if (img instanceof HTMLImageElement && !img.complete) {
        img.addEventListener(
          'load',
          () => cacheKonvaNode(node, layerCode, highDprCacheCodes, sourceConfig, deferAttempt),
          { once: true },
        )
        return
      }
    }
    requestAnimationFrame(() =>
      cacheKonvaNode(node, layerCode, highDprCacheCodes, sourceConfig, deferAttempt + 1),
    )
    return
  }

  writeKonvaNodeCache(node, layerCode, highDprCacheCodes, sourceConfig)
}

/** 导出后恢复预览缓存 */
export function restoreKonvaNodePreviewCache(node: Konva.Node) {
  const layerCode = node.getAttr(KONVA_CACHE_LAYER_CODE_ATTR) as string | undefined
  if (!layerCode) return

  const highDpr = Boolean(node.getAttr(KONVA_CACHE_HIGH_DPR_ATTR))
  node.clearCache()
  node.cache({
    pixelRatio: highDpr ? getKonvaHighCachePixelRatio() : getDefaultCachePixelRatio(),
    imageSmoothingEnabled: true,
  })
}
