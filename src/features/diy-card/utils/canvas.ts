import {
  isFactoryKingdomGlyphLayout,
  isFactoryKingdomRootLayout,
  isKingdomGlyphCode,
} from '@/features/diy-card/composables/doubleKingdom'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import { isLegendImageFactoryLayout } from '@/features/diy-card/utils/legendImageLayout'
import { isPackageTextBadgeCanvasConfig } from '@/features/diy-card/utils/packageGroupLayout'
import { hasLayoutFontSize, layoutUsesFontSize } from '@/features/diy-card/utils/layoutItem'
import { toFixed } from '@/shared/utils/object'

type FitMode = 'cover' | 'width-fit' | 'height-fit'

/**
 * 计算图片默认尺寸
 * @param containerWidth 容器宽度
 * @param containerHeight 容器高度
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @param mode 缩放模式
 */
export const calculateFitSize = (
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  mode: FitMode = 'cover',
) => {
  let finalWidth, finalHeight

  switch (mode) {
    case 'width-fit':
      // 宽铺满：强制宽度等于容器宽度
      finalWidth = containerWidth
      finalHeight = (containerWidth / imageWidth) * imageHeight
      break

    case 'height-fit':
      // 高铺满：强制高度等于容器高度
      finalHeight = containerHeight
      finalWidth = (containerHeight / imageHeight) * imageWidth
      break

    case 'cover':
    default:
      // 覆盖：按比例缩放
      {
        const scaleW = containerWidth / imageWidth
        const scaleH = containerHeight / imageHeight

        const scale = Math.max(scaleW, scaleH)

        finalWidth = imageWidth * scale
        finalHeight = imageHeight * scale
      }
      break
  }

  return { finalWidth, finalHeight }
}

/** DIY 画布 mm/pt ↔ px 换算器 */
export type DiyUnitConverters = {
  mmToPx: (mm: number) => number
  pxToMm: (px: number) => number
  ptToPx: (pt: number) => number
  pxToPt: (px: number) => number
}

// 印刷单位换算：1 inch = 25.4 mm；1 pt = 1/72 inch
const MM_PER_INCH = 25.4
const PT_TO_MM = MM_PER_INCH / 72

export const mmToPx = (mm: number, mmToPixel: number) => mm * mmToPixel
export const pxToMm = (px: number, mmToPixel: number) => px / mmToPixel
export const ptToPx = (pt: number, mmToPixel: number) => pt * PT_TO_MM * mmToPixel
export const pxToPt = (px: number, mmToPixel: number) => px / (PT_TO_MM * mmToPixel)

/** 参考模板 CSS px → pt（96dpi：1px = 0.75pt） */
export const refPxToPt = (px: number) => px * 0.75
export const ptToRefPx = (pt: number) => pt / 0.75

/**
 * 竖排字间距（pt）→ Konva lineHeight 增量
 */
export const ptCharacterSpacingToLineHeight = (
  spacingPt: number,
  fontSizePx: number,
  mmToPixel: number,
) => {
  if (fontSizePx <= 0) return 1
  const extraPx = ptToPx(spacingPt, mmToPixel)
  return 1 + extraPx / fontSizePx
}

/**
 * PS 字距（±1000 整数 tracking）→ Konva letterSpacing（px）
 * 例：-25 / 1000 × 字号 px
 */
export const psTrackingToLetterSpacingPx = (tracking: number, fontSizePx: number) =>
  (tracking / 1000) * fontSizePx

/**
 * 创建 DIY 画布单位换算器
 * @param mmToPixel store 中的 mm→px 比例
 */
export const createDiyUnitConverters = (mmToPixel: number): DiyUnitConverters => ({
  mmToPx: (mm: number) => mmToPx(mm, mmToPixel),
  pxToMm: (px: number) => pxToMm(px, mmToPixel),
  ptToPx: (pt: number) => ptToPx(pt, mmToPixel),
  pxToPt: (px: number) => pxToPt(px, mmToPixel),
})

const resetRenderObj = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  origin: { x: number; y: number },
  converters: DiyUnitConverters,
) => {
  renderObj.name = config.name || '未知'
  renderObj.code = config.code || 'unknown'

  // origin/width/height/fontSize 来自模板渲染配置，当前都在 px 体系
  if (typeof config.originX === 'number') {
    renderObj.x = toFixed(converters.pxToMm(config.originX - origin.x), 2)
  }
  if (typeof config.originY === 'number') {
    renderObj.y = toFixed(converters.pxToMm(config.originY - origin.y), 2)
  }
  if (typeof config.width === 'number' && config.width > 0) {
    renderObj.width = toFixed(converters.pxToMm(config.width), 2)
  }
  if (typeof config.height === 'number' && config.height > 0) {
    renderObj.height = toFixed(converters.pxToMm(config.height), 2)
  }
  if (layoutUsesFontSize(renderObj) && typeof config.fontSize === 'number' && config.fontSize > 0) {
    renderObj.size = toFixed(converters.pxToPt(config.fontSize), 2)
  } else if (!layoutUsesFontSize(renderObj)) {
    delete renderObj.size
  }

  // 每次重置都恢复到“基础尺寸 + 1 倍缩放”
  renderObj.scale = 1
  renderObj.rotation = 0
}

/** 可旋转元素以自身中心为 pivot（Konva offset 为宽高一半） */
const applyCenterPivotToConfig = (
  config: CanvasItemConfig,
  finalWidthPx: number,
  finalHeightPx: number,
  updateSize: boolean,
) => {
  config.offsetX = finalWidthPx / 2
  config.offsetY = finalHeightPx / 2
  config.x = config.originX! + config.offsetX
  config.y = config.originY! + config.offsetY
  if (updateSize) {
    config.width = finalWidthPx
    config.height = finalHeightPx
  }
}

const resolveLegendImageNaturalSize = (config: CanvasItemConfig) => {
  const img = config.image
  if (!(img instanceof HTMLImageElement)) return null
  const naturalW = img.naturalWidth || img.width
  const naturalH = img.naturalHeight || img.height
  if (naturalW <= 0 || naturalH <= 0) return null
  return { naturalW, naturalH }
}

/** 可缩放图片（武将图 / 出框）按原图比例推导显示尺寸时使用的 natural 尺寸 */
const resolveOutOfFrameSourceNaturalSize = (config: CanvasItemConfig) => {
  const sourceW = config.sourceNaturalWidth
  const sourceH = config.sourceNaturalHeight
  if (typeof sourceW === 'number' && typeof sourceH === 'number' && sourceW > 0 && sourceH > 0) {
    return { naturalW: sourceW, naturalH: sourceH }
  }
  return null
}

const resolveScalableLayoutNaturalSize = (renderObj: LayoutItem, config: CanvasItemConfig) => {
  if (renderObj.code === 'legendImage') {
    return resolveLegendImageNaturalSize(config) ?? resolveOutOfFrameSourceNaturalSize(config)
  }
  if (renderObj.code !== 'legendOutOfFrame') return null

  const fromSource = resolveOutOfFrameSourceNaturalSize(config)
  if (fromSource) return fromSource

  const img = config.image
  if (img instanceof HTMLCanvasElement || img instanceof HTMLImageElement) {
    const naturalW = img.width
    const naturalH = img.height
    if (naturalW > 0 && naturalH > 0) {
      return { naturalW, naturalH }
    }
  }
  return null
}

/** 角标工厂占位宽高（mm）；真实角标约 4–5mm，100 表示尚未写入模板测量值 */
const PACKAGE_FACTORY_PLACEHOLDER_MM = 100

/** 武将图工厂占位宽高（mm）；cover 铺满前的 JSON 默认值 */
const LEGEND_IMAGE_FACTORY_PLACEHOLDER_MM = 100

/** 势力根节点工厂占位宽高（mm） */
const KINGDOM_ROOT_FACTORY_PLACEHOLDER_MM = 100

/** 双势力字子节点工厂占位宽高（mm，与 createGlyphLayoutItem 一致） */
const KINGDOM_GLYPH_FACTORY_PLACEHOLDER_MM = 10

/** 角标合理最大边长（mm）；超出视为脏数据 */
const PACKAGE_MAX_REASONABLE_SIZE_MM = 15

const isFactoryPackagePlaceholderDimensions = (renderObj: LayoutItem) =>
  renderObj.code === 'package' &&
  renderObj.width === PACKAGE_FACTORY_PLACEHOLDER_MM &&
  renderObj.height === PACKAGE_FACTORY_PLACEHOLDER_MM

const isReasonablePackageSizeMm = (mm: number) =>
  mm > 0 && mm <= PACKAGE_MAX_REASONABLE_SIZE_MM

/** 从角标组子节点反推模板测量尺寸（config.width 已被污染时兜底） */
const resolvePackageTemplateBaseSizePx = (config: CanvasItemConfig) => {
  const bg = config.children?.find((child) => child.code === 'package-text-bg')
  if (typeof bg?.width === 'number' && typeof bg?.height === 'number' && bg.width > 0 && bg.height > 0) {
    return { width: bg.width, height: bg.height }
  }

  const image = config.children?.find((child) => child.code === 'package-image')
  if (typeof image?.width === 'number' && typeof image?.height === 'number' && image.width > 0 && image.height > 0) {
    return {
      width: image.width * (image.scaleX ?? 1),
      height: image.height * (image.scaleY ?? 1),
    }
  }

  return null
}

/**
 * 角标 width/height 仍为工厂占位或明显不合理时，用画布模板尺寸写回 renderObj。
 * 避免仅移动过角标后拖拽触发 syncMaterialLayout，按 100mm 重排文字角标。
 */
export const normalizePackageLayoutDimensions = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  converters: DiyUnitConverters,
): boolean => {
  if (renderObj.code !== 'package') return false

  const needsFix =
    isFactoryPackagePlaceholderDimensions(renderObj) ||
    !isReasonablePackageSizeMm(renderObj.width) ||
    !isReasonablePackageSizeMm(renderObj.height)
  if (!needsFix) return false

  const scale = renderObj.scale || 1
  let baseWidthPx = 0
  let baseHeightPx = 0

  if (isPackageTextBadgeCanvasConfig(config)) {
    // 文字角标：Group.width/height 为基准尺寸，缩放由 scaleX/Y 承担
    baseWidthPx = typeof config.width === 'number' ? config.width : 0
    baseHeightPx = typeof config.height === 'number' ? config.height : 0
    if (
      baseWidthPx <= 0 ||
      baseHeightPx <= 0 ||
      !isReasonablePackageSizeMm(converters.pxToMm(baseWidthPx)) ||
      !isReasonablePackageSizeMm(converters.pxToMm(baseHeightPx))
    ) {
      const template = resolvePackageTemplateBaseSizePx(config)
      if (!template) return false
      baseWidthPx = template.width
      baseHeightPx = template.height
    }
  } else {
    const configWidthPx = typeof config.width === 'number' ? config.width / scale : 0
    const configHeightPx = typeof config.height === 'number' ? config.height / scale : 0
    if (
      configWidthPx > 0 &&
      configHeightPx > 0 &&
      isReasonablePackageSizeMm(converters.pxToMm(configWidthPx)) &&
      isReasonablePackageSizeMm(converters.pxToMm(configHeightPx))
    ) {
      baseWidthPx = configWidthPx
      baseHeightPx = configHeightPx
    } else {
      const template = resolvePackageTemplateBaseSizePx(config)
      if (!template) return false
      baseWidthPx = template.width
      baseHeightPx = template.height
    }
  }

  renderObj.width = toFixed(converters.pxToMm(baseWidthPx), 2)
  renderObj.height = toFixed(converters.pxToMm(baseHeightPx), 2)
  return true
}

const isFactoryLegendImagePlaceholderDimensions = (renderObj: LayoutItem) =>
  renderObj.code === 'legendImage' &&
  renderObj.width === LEGEND_IMAGE_FACTORY_PLACEHOLDER_MM &&
  renderObj.height === LEGEND_IMAGE_FACTORY_PLACEHOLDER_MM

/**
 * 武将图 width/height 仍为工厂占位 (100mm) 时，用当前画布 cover 尺寸写回 renderObj。
 * 避免仅移动位置后 syncMaterialLayout 按 100mm 重算导致突然放大。
 */
export const normalizeLegendImageLayoutDimensions = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  converters: DiyUnitConverters,
): boolean => {
  if (renderObj.code !== 'legendImage') return false
  if (!isFactoryLegendImagePlaceholderDimensions(renderObj)) return false

  const scale = renderObj.scale || 1
  const configWidthPx = typeof config.width === 'number' ? config.width / scale : 0
  const configHeightPx = typeof config.height === 'number' ? config.height / scale : 0
  if (configWidthPx <= 0 || configHeightPx <= 0) return false

  renderObj.width = toFixed(converters.pxToMm(configWidthPx), 2)
  renderObj.height = toFixed(converters.pxToMm(configHeightPx), 2)
  return true
}

/**
 * 出框层 load 时 legendImage 宽高比已与 cover 一致，但 mm 占位仍失真（如 100×100 或仅一边更新）。
 * 联动态用 legendImage 布局，须强制写回 cover 测量值，避免按占位 mm 拉伸出框图。
 */
const normalizeLegendImageLayoutFromOutOfFrameCover = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  converters: DiyUnitConverters,
): boolean => {
  if (renderObj.code !== 'legendImage' || config.code !== 'legendOutOfFrame') return false
  const sourceW = config.sourceNaturalWidth
  const sourceH = config.sourceNaturalHeight
  if (!sourceW || !sourceH || sourceW <= 0 || sourceH <= 0) return false

  const scale = renderObj.scale || 1
  const configWidthPx = typeof config.width === 'number' ? config.width / scale : 0
  const configHeightPx = typeof config.height === 'number' ? config.height / scale : 0
  if (configWidthPx <= 0 || configHeightPx <= 0) return false

  const naturalRatio = sourceH / sourceW
  const configRatio = configHeightPx / configWidthPx
  if (Math.abs(configRatio - naturalRatio) / naturalRatio > 0.02) return false

  const widthMm = toFixed(converters.pxToMm(configWidthPx), 2)
  const heightMm = toFixed(converters.pxToMm(configHeightPx), 2)
  if (renderObj.width === widthMm && renderObj.height === heightMm) return false

  renderObj.width = widthMm
  renderObj.height = heightMm
  return true
}

const isFactoryLegendOutOfFramePlaceholderDimensions = (renderObj: LayoutItem) =>
  renderObj.code === 'legendOutOfFrame' &&
  renderObj.width === LEGEND_IMAGE_FACTORY_PLACEHOLDER_MM &&
  renderObj.height === LEGEND_IMAGE_FACTORY_PLACEHOLDER_MM

/**
 * 出框图 width/height 仍为工厂占位 (100mm) 时，用当前画布 cover 尺寸写回 renderObj。
 * 切换「出框独立」后若仍沿用占位值，sync 会按 100mm 重算导致变窄与偏移。
 */
export const normalizeLegendOutOfFrameLayoutDimensions = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  converters: DiyUnitConverters,
): boolean => {
  if (renderObj.code !== 'legendOutOfFrame') return false
  if (!isFactoryLegendOutOfFramePlaceholderDimensions(renderObj)) return false

  const scale = renderObj.scale || 1
  const configWidthPx = typeof config.width === 'number' ? config.width / scale : 0
  const configHeightPx = typeof config.height === 'number' ? config.height / scale : 0
  if (configWidthPx <= 0 || configHeightPx <= 0) return false

  renderObj.width = toFixed(converters.pxToMm(configWidthPx), 2)
  renderObj.height = toFixed(converters.pxToMm(configHeightPx), 2)
  return true
}

/**
 * 出框独立模式：legendOutOfFrame mm 宽高比与当前原图不一致时，用 cover 测量值写回。
 * 典型场景：换武将图后仍保留旧图 mm，再抠图应用导致拉抻。
 */
const normalizeLegendOutOfFrameLayoutFromOutOfFrameCover = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  converters: DiyUnitConverters,
): boolean => {
  if (renderObj.code !== 'legendOutOfFrame' || config.code !== 'legendOutOfFrame') return false
  const sourceW = config.sourceNaturalWidth
  const sourceH = config.sourceNaturalHeight
  if (!sourceW || !sourceH || sourceW <= 0 || sourceH <= 0) return false

  const scale = renderObj.scale || 1
  const configWidthPx = typeof config.width === 'number' ? config.width / scale : 0
  const configHeightPx = typeof config.height === 'number' ? config.height / scale : 0
  if (configWidthPx <= 0 || configHeightPx <= 0) return false

  const naturalRatio = sourceH / sourceW
  const configRatio = configHeightPx / configWidthPx
  if (Math.abs(configRatio - naturalRatio) / naturalRatio > 0.02) return false

  if (renderObj.width > 0 && renderObj.height > 0) {
    const layoutRatio = renderObj.height / renderObj.width
    if (Math.abs(layoutRatio - naturalRatio) / naturalRatio <= 0.02) return false
  }

  renderObj.width = toFixed(converters.pxToMm(configWidthPx), 2)
  renderObj.height = toFixed(converters.pxToMm(configHeightPx), 2)
  return true
}

/** layout mm 宽高比是否与给定原图像素比例一致 */
export const isLayoutAspectMatchingNatural = (
  renderObj: LayoutItem,
  naturalWidth: number,
  naturalHeight: number,
) => {
  if (naturalWidth <= 0 || naturalHeight <= 0) return false
  if (renderObj.width <= 0 || renderObj.height <= 0) return false
  const layoutRatio = renderObj.height / renderObj.width
  const naturalRatio = naturalHeight / naturalWidth
  return Math.abs(layoutRatio - naturalRatio) / naturalRatio <= 0.02
}

/** 出框独立：layout mm 宽高比失真时，强制写回 cover 居中几何，避免旧图 mm 拉抻新图 */
export const resetLegendOutOfFrameLayoutToCoverPx = (
  renderObj: LayoutItem,
  coverWidthPx: number,
  coverHeightPx: number,
  originXPx: number,
  originYPx: number,
  origin: { x: number; y: number },
  mmToPxRatio: number,
) => {
  if (renderObj.code !== 'legendOutOfFrame') return false
  const converters = createDiyUnitConverters(mmToPxRatio)
  renderObj.x = toFixed(converters.pxToMm(originXPx - origin.x), 2)
  renderObj.y = toFixed(converters.pxToMm(originYPx - origin.y), 2)
  renderObj.width = toFixed(converters.pxToMm(coverWidthPx), 2)
  renderObj.height = toFixed(converters.pxToMm(coverHeightPx), 2)
  renderObj.scale = 1
  renderObj.rotation = 0
  return true
}

const isFactoryKingdomRootPlaceholderDimensions = (renderObj: LayoutItem) =>
  renderObj.code === 'kingdom' &&
  renderObj.width === KINGDOM_ROOT_FACTORY_PLACEHOLDER_MM &&
  renderObj.height === KINGDOM_ROOT_FACTORY_PLACEHOLDER_MM

const isFactoryKingdomGlyphPlaceholderDimensions = (renderObj: LayoutItem) =>
  isKingdomGlyphCode(renderObj.code) &&
  renderObj.width === KINGDOM_GLYPH_FACTORY_PLACEHOLDER_MM &&
  renderObj.height === KINGDOM_GLYPH_FACTORY_PLACEHOLDER_MM

/**
 * 势力字 width/height 仍为工厂占位时，用当前画布尺寸写回 renderObj。
 * 单势力根节点 100mm、双势力字 10mm 均大于实际渲染尺寸，仅移动后 sync 会突然放大。
 */
export const normalizeKingdomLayoutDimensions = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  converters: DiyUnitConverters,
): boolean => {
  const isPlaceholder =
    isFactoryKingdomRootPlaceholderDimensions(renderObj) ||
    isFactoryKingdomGlyphPlaceholderDimensions(renderObj)
  if (!isPlaceholder) return false

  const scale = renderObj.scale || 1
  const configWidthPx = typeof config.width === 'number' ? config.width / scale : 0
  const configHeightPx = typeof config.height === 'number' ? config.height / scale : 0
  if (configWidthPx <= 0 || configHeightPx <= 0) return false

  renderObj.width = toFixed(converters.pxToMm(configWidthPx), 2)
  renderObj.height = toFixed(converters.pxToMm(configHeightPx), 2)
  return true
}

/** 武将图 / 出框缩放时按原图比例推导高度，避免旧布局宽高比导致拉伸 */
const resolveScalableDisplaySizePx = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  baseWidthPx: number,
  baseHeightPx: number,
  measuredWidthPx: number,
  measuredHeightPx: number,
  shouldApplyScale: boolean,
) => {
  if (!shouldApplyScale) {
    return { width: measuredWidthPx, height: measuredHeightPx }
  }

  const natural = resolveScalableLayoutNaturalSize(renderObj, config)
  if (
    (renderObj.code === 'legendImage' || renderObj.code === 'legendOutOfFrame') &&
    natural
  ) {
    const width = baseWidthPx * renderObj.scale
    const naturalRatio = natural.naturalH / natural.naturalW
    if (baseWidthPx > 0 && baseHeightPx > 0) {
      const storedRatio = baseHeightPx / baseWidthPx
      if (Math.abs(storedRatio - naturalRatio) / naturalRatio > 0.015) {
        // mm 宽高比失真：只信宽度，高度按原图比例推导，严禁独立缩放两轴
        return { width, height: width * naturalRatio }
      }
    }
    return { width, height: width * naturalRatio }
  }

  return {
    width: baseWidthPx * renderObj.scale,
    height: baseHeightPx * renderObj.scale,
  }
}

/** 文字角标：子节点保持基准排版，缩放由 Group.scaleX/Y 整体变换（避免字/图分别重算抖动） */
const applyPackageTextBadgeGroupScale = (
  config: CanvasItemConfig,
  baseWidthPx: number,
  baseHeightPx: number,
  scale: number,
  usesCenterPivot: boolean,
) => {
  if (usesCenterPivot) {
    applyCenterPivotToConfig(config, baseWidthPx, baseHeightPx, true)
  } else {
    config.x = config.originX
    config.y = config.originY
    config.width = baseWidthPx
    config.height = baseHeightPx
  }
  config.scaleX = scale
  config.scaleY = scale
}

/**
 * 应用配置项
 * @param renderObj
 * @param config
 * @param origin
 * @param converters
 */
const applyRenderObj = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  origin: { x: number; y: number },
  converters: DiyUnitConverters,
) => {
  const hasFontSize = hasLayoutFontSize(renderObj)
  const shouldApplyScale = !!renderObj.editable?.scalable && !hasFontSize

  normalizePackageLayoutDimensions(renderObj, config, converters)
  normalizeLegendImageLayoutDimensions(renderObj, config, converters)
  normalizeLegendImageLayoutFromOutOfFrameCover(renderObj, config, converters)
  normalizeLegendOutOfFrameLayoutDimensions(renderObj, config, converters)
  normalizeLegendOutOfFrameLayoutFromOutOfFrameCover(renderObj, config, converters)
  normalizeKingdomLayoutDimensions(renderObj, config, converters)

  // 非 reset：用“JSON(mm/pt)”反推并覆盖“画布(px)”
  config.originX = origin.x + converters.mmToPx(renderObj.x)
  config.originY = origin.y + converters.mmToPx(renderObj.y)
  config.rotation = renderObj.rotation

  const baseWidthPx = converters.mmToPx(renderObj.width)
  const baseHeightPx = converters.mmToPx(renderObj.height)

  const leftTopAnchored = config.offsetX === 0 && config.offsetY === 0
  const usesCenterPivot = !leftTopAnchored || !!renderObj.editable?.rotatable

  if (shouldApplyScale && isPackageTextBadgeCanvasConfig(config)) {
    applyPackageTextBadgeGroupScale(
      config,
      baseWidthPx,
      baseHeightPx,
      renderObj.scale || 1,
      usesCenterPivot,
    )
    return
  }

  // 非缩放元素：优先使用模板测量出来的宽高，避免字号变化后宽高/中心点不一致
  const measuredWidthPx = typeof config.width === 'number' ? config.width : baseWidthPx
  const measuredHeightPx = typeof config.height === 'number' ? config.height : baseHeightPx

  const { width: finalWidthPx, height: finalHeightPx } = resolveScalableDisplaySizePx(
    renderObj,
    config,
    baseWidthPx,
    baseHeightPx,
    measuredWidthPx,
    measuredHeightPx,
    shouldApplyScale,
  )

  if (usesCenterPivot) {
    applyCenterPivotToConfig(
      config,
      finalWidthPx,
      finalHeightPx,
      shouldApplyScale || !!renderObj.editable?.rotatable || !leftTopAnchored,
    )
  } else {
    config.x = config.originX
    config.y = config.originY
    config.width = finalWidthPx
    config.height = finalHeightPx
  }

  // 图片角标：缩放写入 width/height，避免 Group.scale 与 renderObj.scale 叠乘
  if (renderObj.code === 'package' && shouldApplyScale) {
    config.scaleX = 1
    config.scaleY = 1
  }

  // 字号：渲染需要 px
  if (hasFontSize) {
    config.fontSize = converters.ptToPx(renderObj.size!)
  }

  // 保证 JSON 内的宽高/字号与“模板测量结果”一致
  if (!shouldApplyScale) {
    if (typeof config.width === 'number') {
      renderObj.width = toFixed(converters.pxToMm(config.width), 2)
    }
    if (typeof config.height === 'number') {
      renderObj.height = toFixed(converters.pxToMm(config.height), 2)
    }
    if (layoutUsesFontSize(renderObj) && typeof config.fontSize === 'number') {
      renderObj.size = toFixed(converters.pxToPt(config.fontSize), 2)
    }
  }
}

const isFactoryLegendOutOfFrameLayout = (renderObj: LayoutItem) =>
  renderObj.code === 'legendOutOfFrame' &&
  renderObj.x === 0 &&
  renderObj.y === 0 &&
  renderObj.width === 100 &&
  renderObj.height === 100 &&
  renderObj.scale === 1 &&
  renderObj.rotation === 0

export const hasLegendOutOfFramePersistedLayout = (renderObj: LayoutItem) =>
  renderObj.code === 'legendOutOfFrame' && !isFactoryLegendOutOfFrameLayout(renderObj)

const isFactoryLegendImageLayout = isLegendImageFactoryLayout

const isFactoryPackageLayout = (renderObj: LayoutItem) =>
  renderObj.code === 'package' &&
  renderObj.x === 0 &&
  renderObj.y === 0 &&
  renderObj.width === 100 &&
  renderObj.height === 100 &&
  renderObj.scale === 1 &&
  renderObj.rotation === 0

/** 角标是否已有可恢复的布局（含缩放/旋转/位移） */
const hasPackagePersistedLayout = (renderObj: LayoutItem) => {
  if (!hasValidPackageLayout(renderObj)) return false
  if (isFactoryPackageLayout(renderObj)) return false
  // 工厂占位坐标 (0,0)：即使宽高已是测量值，仍视为未放置，需写入默认位置
  if (renderObj.x === 0 && renderObj.y === 0) return false
  return true
}

/** 角标布局是否有效（历史脏数据 width/height 为 0 视为未布局） */
const hasValidPackageLayout = (renderObj: LayoutItem) =>
  renderObj.code === 'package' && renderObj.width > 0 && renderObj.height > 0

/** 是否已有可恢复的布局（工厂默认布局视为未布局，需走 cover 居中） */
const hasPersistedLayout = (renderObj: LayoutItem) => {
  if (renderObj.code === 'legendImage') {
    return !isFactoryLegendImageLayout(renderObj)
  }
  if (renderObj.code === 'legendOutOfFrame') {
    return !isFactoryLegendOutOfFrameLayout(renderObj)
  }
  if (renderObj.code === 'package') {
    return hasPackagePersistedLayout(renderObj)
  }
  if (isFactoryKingdomGlyphLayout(renderObj)) {
    return false
  }
  if (renderObj.code === 'kingdom' && isFactoryKingdomRootLayout(renderObj)) {
    return false
  }
  if (renderObj.name !== 'unknown') return true
  return false
}

/**
 * 合并配置项
 * @param renderObj 持久化配置对象
 * @param config 画布配置
 * @param origin 画布原点信息
 * @param mmToPxRatio 毫米到像素的换算比例
 * @param isRest 是否重置元素位置
 */
export const mergeConfig = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  origin: { x: number; y: number },
  mmToPxRatio: number,
  isRest: boolean = false,
) => {
  const converters = createDiyUnitConverters(mmToPxRatio)

  // reset: 把“当前画布(px)”转换并持久化成“JSON(mm/pt)”
  if (isRest || !hasPersistedLayout(renderObj)) {
    resetRenderObj(renderObj, config, origin, converters)
    if (renderObj.editable?.rotatable) {
      const widthPx =
        typeof config.width === 'number' ? config.width : converters.mmToPx(renderObj.width)
      const heightPx =
        typeof config.height === 'number' ? config.height : converters.mmToPx(renderObj.height)
      applyCenterPivotToConfig(config, widthPx, heightPx, true)
      if (isPackageTextBadgeCanvasConfig(config)) {
        config.scaleX = renderObj.scale || 1
        config.scaleY = renderObj.scale || 1
      }
    }
    return
  }

  // 非 reset: 用“JSON(mm/pt)”反推并覆盖“画布(px)”
  applyRenderObj(renderObj, config, origin, converters)
}

/**
 * 拖拽 / 方向键 / +/-：仅用 renderObj 写回画布（避免 sync 时误走 reset 覆盖用户调整）
 */
export const applyLayoutFromRenderObj = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  origin: { x: number; y: number },
  mmToPxRatio: number,
) => {
  applyRenderObj(renderObj, config, origin, createDiyUnitConverters(mmToPxRatio))
}

/**
 * 将画布上当前可见几何写回 layout（用于「出框独立」切换时保持与联动态一致）
 * 中心 pivot 时须用 x/offset 反推左上角，不能直接用 originX（联动态 x=0 时 originX 仅为内容区左缘）。
 */
export const resolveCanvasItemLayoutBox = (config: CanvasItemConfig) => {
  const scaleX = config.scaleX ?? 1
  const scaleY = config.scaleY ?? 1
  const width = typeof config.width === 'number' ? config.width * scaleX : 0
  const height = typeof config.height === 'number' ? config.height * scaleY : 0
  if (width <= 0 || height <= 0) return null

  if (typeof config.x === 'number' && typeof config.y === 'number') {
    const offsetX = config.offsetX ?? 0
    const offsetY = config.offsetY ?? 0
    return {
      originX: config.x - offsetX * scaleX,
      originY: config.y - offsetY * scaleY,
      width,
      height,
      rotation: typeof config.rotation === 'number' ? config.rotation : 0,
    }
  }

  if (typeof config.originX === 'number' && typeof config.originY === 'number') {
    return {
      originX: config.originX,
      originY: config.originY,
      width,
      height,
      rotation: typeof config.rotation === 'number' ? config.rotation : 0,
    }
  }

  return null
}

export const syncLayoutItemFromCanvasConfig = (
  renderObj: LayoutItem,
  config: CanvasItemConfig,
  origin: { x: number; y: number },
  mmToPxRatio: number,
) => {
  const box = resolveCanvasItemLayoutBox(config)
  if (!box) return false

  const converters = createDiyUnitConverters(mmToPxRatio)
  renderObj.x = toFixed(converters.pxToMm(box.originX - origin.x), 2)
  renderObj.y = toFixed(converters.pxToMm(box.originY - origin.y), 2)
  renderObj.rotation = box.rotation
  renderObj.scale = 1
  renderObj.width = toFixed(converters.pxToMm(box.width), 2)
  renderObj.height = toFixed(converters.pxToMm(box.height), 2)
  return true
}

/**
 * 获取元素位置信息
 *  x, y: 元素中心点坐标
 *  offsetX, offsetY: 元素偏移量
 */
export const getPosition = (x: number, y: number, width: number, height: number) => {
  const offsetX = width / 2
  const offsetY = height / 2
  return {
    x: x + offsetX,
    y: y + offsetY,
    offsetX: offsetX,
    offsetY: offsetY,
  }
}
