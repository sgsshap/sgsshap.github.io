import type { LegendRenderConfig } from '@/features/diy-card/types/diy/legend'
import type { CustomMaterial, DiyCardInfoBase } from '@/features/diy-card/types/diy/base'
import { resolveOutOfFrameConfig } from '@/features/diy-card/types/diy/outOfFrame'
import { useTemplateStore } from '@/features/diy-card/stores'
import { toFixed } from '@/shared/utils/object'

/** 素材导入默认尺寸选项（百分比，相对画布宽高） */
export const CUSTOM_IMAGE_DEFAULT_SIZE_OPTIONS = [
  { value: 100, label: '铺满画布' },
  { value: 72, label: '1/2画布大小' },
  { value: 50, label: '1/4画布大小' },
  { value: 33.3, label: '1/9画布大小' },
  { value: 25, label: '1/16画布大小' },
  { value: 20, label: '1/25画布大小' },
] as const

export const CUSTOM_MATERIAL_MAX_COUNT = 5

/** 自定义素材在画布上的叠放档位 */
export type CustomMaterialLayerPosition = 'partial' | 'top'

export const CUSTOM_MATERIAL_LAYER_POSITION_OPTIONS: {
  value: CustomMaterialLayerPosition
  label: string
  description: string
}[] = [
  {
    value: 'partial',
    label: '覆盖边框',
    description: '盖住边框底图（可用于制作出框）',
  },
  {
    value: 'top',
    label: '覆盖全部元素',
    description: '置于最上层，盖住卡面所有元素',
  },
]

const CUSTOM_MATERIAL_ORDER_BASE = 900

/** 按 order 升序排列（同 order 时保持原数组相对顺序） */
export const sortCustomMaterialsByOrder = <T extends { order: number }>(materials: T[]): T[] =>
  materials
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.order - b.item.order || a.index - b.index)
    .map(({ item }) => item)

/** 重排后按当前数组顺序写回连续 order（不再按旧 order 排序，避免覆盖拖拽结果） */
export const normalizeCustomMaterialOrders = (materials: CustomMaterial[]): CustomMaterial[] =>
  materials.map((item, index) => ({
    ...item,
    // 列表越靠上 order 越大，画布叠放时越在上层
    order: CUSTOM_MATERIAL_ORDER_BASE + (materials.length - 1 - index),
  }))

/** 列表展示：上层在前 */
export const sortCustomMaterialsForDisplay = (materials: CustomMaterial[]): CustomMaterial[] =>
  sortCustomMaterialsByOrder(materials).reverse()

/** 限制数量并规范化 order */
export const clampCustomMaterialList = (materials: CustomMaterial[]): CustomMaterial[] =>
  normalizeCustomMaterialOrders(materials.slice(0, CUSTOM_MATERIAL_MAX_COUNT))

export const findCustomMaterial = (
  info: DiyCardInfoBase,
  code: string,
): CustomMaterial | undefined =>
  info.customMaterialList.find((item) => item.id === code || item.code === code)

export const isCustomMaterialCode = (info: DiyCardInfoBase, code: string): boolean =>
  Boolean(findCustomMaterial(info, code))

/** 读取自定义素材叠放档位 */
export const resolveCustomMaterialLayerPosition = (info: {
  renderConfig: Pick<LegendRenderConfig, 'customImage'>
}): CustomMaterialLayerPosition => info.renderConfig.customImage.layerPosition

export const applyCustomMaterialLayerPosition = (
  customImage: LegendRenderConfig['customImage'],
  position: CustomMaterialLayerPosition,
) => {
  customImage.layerPosition = position
}

/** 覆盖边框模式：素材与技能区重叠时是否自动挖洞隐藏（默认开启） */
export const resolveHideCustomMaterialPartialSkillOverlap = (customImage: {
  hidePartialSkillOverlap?: boolean
}) => customImage.hidePartialSkillOverlap !== false

/** 当前是否应对自定义素材应用技能区挖洞 */
export const shouldApplyCustomMaterialSkillOverlapHoles = (info: {
  customMaterialList: { length: number }
  renderConfig: Pick<LegendRenderConfig, 'customImage'>
}) =>
  resolveCustomMaterialLayerPosition(info) === 'partial' &&
  resolveHideCustomMaterialPartialSkillOverlap(info.renderConfig.customImage) &&
  info.customMaterialList.length > 0

/**
 * 「覆盖边框」叠放栈：描述背景在边框下，素材/出框在中层，描述文字在上层。
 * 人物出框始终走此档位；自定义素材仅在 layerPosition=partial 时参与。
 */
export const shouldUsePartialOverlayStack = (info: {
  customMaterialList: { length: number }
  renderConfig: Pick<LegendRenderConfig, 'customImage' | 'outOfFrame'>
}): boolean => {
  const outOfFrame = resolveOutOfFrameConfig(info.renderConfig.outOfFrame)
  if (outOfFrame.enabled && Boolean(outOfFrame.maskDataUrl)) return true
  if (resolveCustomMaterialLayerPosition(info) !== 'partial') return false
  return info.customMaterialList.length > 0
}

const resolveUniqueUploadName = (fileName: string, existingNames: string[]) => {
  const sameCount = existingNames.filter((name) => name === fileName).length
  if (sameCount === 0) return fileName
  return `${fileName}-${sameCount}`
}

/** 下载文件名：无扩展名时按 data URL 的 MIME 补全 */
export const resolveCustomMaterialDownloadFileName = (name: string, dataUrl: string) => {
  if (/\.[a-z0-9]+$/i.test(name)) return name
  const mime = dataUrl.match(/^data:([^;]+);/i)?.[1] ?? 'image/png'
  const subtype = mime.split('/')[1]?.toLowerCase() ?? 'png'
  const ext = subtype === 'jpeg' ? 'jpg' : subtype === 'svg+xml' ? 'svg' : subtype
  return `${name}.${ext}`
}

/**
 * 在画布限定框内等比缩放（contain），返回 mm 布局。
 * @param scalePercent 相对画布的可放置区域比例（铺满画布 = 100）
 */
export const resolveCustomMaterialLayoutMm = (
  imageWidth: number,
  imageHeight: number,
  options: {
    templateWidth: number
    templateHeight: number
    scalePercent: number
  },
) => {
  const { templateWidth, templateHeight, scalePercent } = options
  const maxWidth = (templateWidth * scalePercent) / 100
  const maxHeight = (templateHeight * scalePercent) / 100

  if (imageWidth <= 0 || imageHeight <= 0) {
    return {
      width: toFixed(maxWidth, 2),
      height: toFixed(maxHeight, 2),
      x: toFixed((templateWidth - maxWidth) / 2, 2),
      y: toFixed((templateHeight - maxHeight) / 2, 2),
    }
  }

  const aspect = imageWidth / imageHeight
  let width = maxWidth
  let height = width / aspect
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspect
  }

  width = toFixed(width, 2)
  height = toFixed(height, 2)

  return {
    width,
    height,
    x: toFixed((templateWidth - width) / 2, 2),
    y: toFixed((templateHeight - height) / 2, 2),
  }
}

/**
 * 根据上传结果创建自定义素材布局项
 */
export const createCustomMaterialFromUpload = (
  id: string,
  fileName: string,
  dataUrl: string,
  options: {
    defaultScalePercent: number
    orderIndex: number
    existingNames?: string[]
    imageWidth: number
    imageHeight: number
  },
): CustomMaterial => {
  const template = useTemplateStore().currentTemplate
  // 宽高始终按「铺满画布」计算，作为操作元素里 100% 的基准；导入默认尺寸写入 scale
  const { width, height, x, y } = resolveCustomMaterialLayoutMm(
    options.imageWidth,
    options.imageHeight,
    {
      templateWidth: template.width,
      templateHeight: template.height,
      scalePercent: 100,
    },
  )
  const name = resolveUniqueUploadName(fileName, options.existingNames ?? [])

  return {
    id,
    code: id,
    name,
    data: dataUrl,
    x,
    y,
    width,
    height,
    scale: toFixed(options.defaultScalePercent / 100, 2),
    rotation: 0,
    order: CUSTOM_MATERIAL_ORDER_BASE + options.orderIndex,
    editable: {
      selectable: true,
      movable: true,
      scalable: true,
      rotatable: true,
      snapToStageEdge: true,
    },
  }
}
