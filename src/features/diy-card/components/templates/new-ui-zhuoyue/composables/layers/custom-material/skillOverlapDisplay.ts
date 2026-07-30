import type { TemplateProps } from '@/features/diy-card/composables/template/types'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { resolveCustomMaterialLayerPosition, shouldApplyCustomMaterialSkillOverlapHoles } from '@/features/diy-card/utils/customMaterial'
import { applyOutOfFrameSkillOverlapHoles } from '@/features/diy-card/utils/outOfFrame/skillFrameMask'
import { loadSkillsAreaFonts } from '../../layout/skills-area/areaFonts'
import { useDiyStore } from '@/features/diy-card/stores'

type CleanCanvasEntry = {
  data: string
  canvas: HTMLCanvasElement
}

const cleanCustomMaterialCanvasCache = new Map<string, CleanCanvasEntry>()

const cloneCanvas = (source: HTMLCanvasElement) => {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法复制自定义素材图')
  ctx.drawImage(source, 0, 0)
  return canvas
}

const imageToCanvas = (image: HTMLImageElement) => {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法初始化自定义素材画布')
  ctx.drawImage(image, 0, 0)
  return canvas
}

const resolveCleanCanvas = (materialId: string, data: string, image: HTMLImageElement) => {
  const cached = cleanCustomMaterialCanvasCache.get(materialId)
  if (cached && cached.data === data) {
    return cached.canvas
  }
  const canvas = imageToCanvas(image)
  cleanCustomMaterialCanvasCache.set(materialId, { data, canvas })
  return canvas
}

export const pruneCustomMaterialDisplayCache = (activeMaterialIds: readonly string[]) => {
  const active = new Set(activeMaterialIds)
  for (const id of cleanCustomMaterialCanvasCache.keys()) {
    if (!active.has(id)) {
      cleanCustomMaterialCanvasCache.delete(id)
    }
  }
}

const bakeCustomMaterialDisplayImage = (
  cleanCanvas: HTMLCanvasElement,
  info: LegendInfo,
  props: TemplateProps,
  config: CanvasItemConfig,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const display = cloneCanvas(cleanCanvas)
  if (shouldApplyCustomMaterialSkillOverlapHoles(info)) {
    applyOutOfFrameSkillOverlapHoles(display, info, props, config, mmToPx, maxBleedPx)
  }
  return display
}

/** 按当前布局重算技能区挖洞并写回节点 image */
export const refreshCustomMaterialDisplayImage = (
  materialId: string,
  config: CanvasItemConfig,
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const cached = cleanCustomMaterialCanvasCache.get(materialId)
  if (!cached) return false

  config.image = bakeCustomMaterialDisplayImage(
    cached.canvas,
    info,
    props,
    config,
    mmToPx,
    maxBleedPx,
  )
  delete config.clipFunc
  return true
}

export const applyCustomMaterialDisplayImage = (
  materialId: string,
  materialData: string,
  image: HTMLImageElement,
  info: LegendInfo,
  props: TemplateProps,
  config: CanvasItemConfig,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const cleanCanvas = resolveCleanCanvas(materialId, materialData, image)
  config.image = bakeCustomMaterialDisplayImage(
    cleanCanvas,
    info,
    props,
    config,
    mmToPx,
    maxBleedPx,
  )
  delete config.clipFunc
}

/**
 * 技能区布局/字体就绪后重算覆盖边框素材挖洞。
 * 首屏 loadAll 并行时可能早于 skillsDesc 测高，bootstrap 后再刷一次。
 */
export const refreshCustomMaterialSkillOverlapHoles = async (
  canvasConfigs: Record<string, CanvasItemConfig>,
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
) => {
  if (resolveCustomMaterialLayerPosition(info) !== 'partial') return false
  if (!info.customMaterialList.length) return false

  const root = canvasConfigs.customMaterials
  if (!root?.children?.length) return false

  await loadSkillsAreaFonts(useDiyStore(), info, { includeSkillName: false })

  let refreshed = false
  for (const child of root.children) {
    const materialId = child.code
    if (!materialId) continue
    const config = { ...child } as CanvasItemConfig
    if (
      refreshCustomMaterialDisplayImage(
        materialId,
        config,
        info,
        props,
        mmToPx,
        maxBleedPx,
      )
    ) {
      const index = root.children.indexOf(child)
      if (index >= 0) {
        root.children[index] = config
        refreshed = true
      }
    }
  }

  return refreshed
}
