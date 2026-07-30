import {
  SKILL_OVERLAP_FRAME_PRESERVE_WIDTH_MM,
  SKILL_OVERLAP_FRAME_PRESERVE_WIDTH_SHEN_MM,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/frame'
import { usesShenCardLayout } from '@/features/diy-card/composables/doubleKingdom'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { syncLayoutItemFromCanvasConfig } from '@/features/diy-card/utils/canvas'

/** 人物出框（蒙版抠图）配置 */
export interface LegendOutOfFrameConfig {
  /** 是否在卡面显示出框层 */
  enabled: boolean
  /** 蒙版 PNG（alpha 通道表示可见区域） */
  maskDataUrl: string
  /** 生成蒙版时绑定的原画地址，换图后可提示重抠 */
  sourcePic: string
}

/** 武将图：出框与技能框重叠时是否自动隐藏重叠区域（默认开启） */
export const resolveHideOutOfFrameSkillOverlap = (legendImage: {
  hideOutOfFrameSkillOverlap?: boolean
}) => legendImage.hideOutOfFrameSkillOverlap !== false

/** 技能重叠挖洞左侧保留边框宽（mm，相对成品区左缘，非出血态） */
export const resolveSkillOverlapHoleLeftMm = (info: LegendInfo) =>
  usesShenCardLayout(info)
    ? SKILL_OVERLAP_FRAME_PRESERVE_WIDTH_SHEN_MM
    : SKILL_OVERLAP_FRAME_PRESERVE_WIDTH_MM

/** 武将图：出框图是否独立于武将图布局（默认关闭，与武将图同步） */
export const resolveOutOfFrameIndependentLayout = (legendImage: {
  outOfFrameIndependentLayout?: boolean
}) => legendImage.outOfFrameIndependentLayout === true

/** 人物出框已启用且布局跟随武将图（非独立模式） */
export const shouldKeepLegendOutOfFrameLinkedToLegendImage = (info: LegendInfo) => {
  const cfg = resolveOutOfFrameConfig(info.renderConfig.outOfFrame)
  return (
    cfg.enabled &&
    Boolean(cfg.maskDataUrl) &&
    !resolveOutOfFrameIndependentLayout(info.renderConfig.items.legendImage)
  )
}

export const LEGEND_OUT_OF_FRAME_INDEPENDENT_EDITABLE: NonNullable<LayoutItem['editable']> = {
  selectable: true,
  movable: true,
  rotatable: true,
  scalable: true,
  snapToStageEdge: true,
}

const LEGEND_OUT_OF_FRAME_LINKED_EDITABLE: NonNullable<LayoutItem['editable']> = {
  selectable: false,
  movable: false,
  rotatable: false,
  scalable: false,
}

const copyLayoutItemGeometry = (from: LayoutItem, to: LayoutItem) => {
  to.x = from.x
  to.y = from.y
  to.width = from.width
  to.height = from.height
  to.scale = from.scale
  to.rotation = from.rotation
}

const createDefaultLegendOutOfFrameLayoutItem = (): LayoutItem => ({
  code: 'legendOutOfFrame',
  name: '人物出框',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  scale: 1,
  order: 1,
  rotation: 0,
  editable: { ...LEGEND_OUT_OF_FRAME_LINKED_EDITABLE },
})

/** 历史数据可能缺少 legendOutOfFrame 布局项，按需补齐 */
export const ensureLegendOutOfFrameLayoutItem = (info: LegendInfo) => {
  const items = info.renderConfig.items as LegendInfo['renderConfig']['items'] & {
    legendOutOfFrame?: LayoutItem
  }
  if (items.legendOutOfFrame?.code === 'legendOutOfFrame') return items.legendOutOfFrame
  const fallback = createDefaultLegendOutOfFrameLayoutItem()
  if (resolveOutOfFrameIndependentLayout(items.legendImage)) {
    copyLayoutItemGeometry(items.legendImage, fallback)
    fallback.editable = { ...LEGEND_OUT_OF_FRAME_INDEPENDENT_EDITABLE }
  }
  items.legendOutOfFrame = fallback
  return fallback
}

/** 出框图层实际使用的布局项：独立模式用 legendOutOfFrame，否则跟随 legendImage */
export const resolveOutOfFrameLayoutItem = (info: LegendInfo): LayoutItem => {
  const legendImage = info.renderConfig.items.legendImage
  if (!resolveOutOfFrameIndependentLayout(legendImage)) {
    return legendImage
  }
  return ensureLegendOutOfFrameLayoutItem(info)
}

/** 切换出框独立布局，并在开启时从武将图复制当前几何 */
export const applyOutOfFrameIndependentLayout = (info: LegendInfo, enabled: boolean) => {
  const legendImage = info.renderConfig.items.legendImage
  const legendOutOfFrame = ensureLegendOutOfFrameLayoutItem(info)
  legendImage.outOfFrameIndependentLayout = enabled
  if (enabled) {
    copyLayoutItemGeometry(legendImage, legendOutOfFrame)
    legendOutOfFrame.editable = { ...LEGEND_OUT_OF_FRAME_INDEPENDENT_EDITABLE }
    return
  }
  legendOutOfFrame.editable = { ...LEGEND_OUT_OF_FRAME_LINKED_EDITABLE }
}

/**
 * 开启「出框独立」前，用主画布当前出框图层可见位置/尺寸初始化 legendOutOfFrame，
 * 避免从 legendImage 占位 mm 重算导致偏移。
 */
export const syncLegendOutOfFrameLayoutFromCanvas = (
  info: LegendInfo,
  canvasConfig: CanvasItemConfig | undefined,
  origin: { x: number; y: number },
  mmToPx: number,
) => {
  if (!canvasConfig) return false
  const legendOutOfFrame = ensureLegendOutOfFrameLayoutItem(info)
  const synced = syncLayoutItemFromCanvasConfig(legendOutOfFrame, canvasConfig, origin, mmToPx)
  if (!synced) return false
  legendOutOfFrame.editable = { ...LEGEND_OUT_OF_FRAME_INDEPENDENT_EDITABLE }
  return true
}

export const createDefaultOutOfFrameConfig = (): LegendOutOfFrameConfig => ({
  enabled: false,
  maskDataUrl: '',
  sourcePic: '',
})

export const resolveOutOfFrameConfig = (
  config?: LegendOutOfFrameConfig | null,
): LegendOutOfFrameConfig => config ?? createDefaultOutOfFrameConfig()

/** 更换武将图时关闭出框并清空蒙版等数据 */
export const resetOutOfFrameOnPicChange = (
  renderConfig: { outOfFrame?: LegendOutOfFrameConfig | null },
): boolean => {
  const cfg = resolveOutOfFrameConfig(renderConfig.outOfFrame)
  if (!cfg.enabled && !cfg.maskDataUrl) return false
  renderConfig.outOfFrame = createDefaultOutOfFrameConfig()
  return true
}
