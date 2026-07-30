import { createTrackedKonvaImageLoader, useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { CustomMaterial } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { applyLayoutFromRenderObj, createDiyUnitConverters } from '@/features/diy-card/utils/canvas'
import { sortCustomMaterialsByOrder } from '@/features/diy-card/utils/customMaterial'
import { resolvePersistedImageSrc } from '@/features/diy-card/stores/history/persistSnapshot'
import { markRaw } from 'vue'
import {
  applyCustomMaterialDisplayImage,
  pruneCustomMaterialDisplayCache,
} from './skillOverlapDisplay'

/**
 * 绘制用户上传的自定义素材（水印、出框图等）
 */
export function drawCustomMaterials(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const { info, props, getDragger, getSelectHandlers, itemCacheMap } = canvas
  const loadTrackedImage = createTrackedKonvaImageLoader(diyStore)
  const { getFilters } = useKonvaBrightnessFilters()

  const buildChildConfig = async (
    material: CustomMaterial,
    imageObj: HTMLImageElement,
  ): Promise<CanvasItemConfig> => {
    const converters = createDiyUnitConverters(diyStore.mmToPx)
    const baseWidthPx = converters.mmToPx(material.width)
    const baseHeightPx = converters.mmToPx(material.height)

    const config = {
      code: material.id,
      name: material.name,
      width: baseWidthPx,
      height: baseHeightPx,
      image: markRaw(document.createElement('canvas')),
      rotation: material.rotation,
      ...getFilters(),
      ...getDragger(material, material.id),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.customMaterials?.loadFunc,
    } as CanvasItemConfig

    applyLayoutFromRenderObj(
      material,
      config,
      { x: diyStore.innerStageBleed, y: diyStore.innerStageBleed },
      diyStore.mmToPx,
    )

    applyCustomMaterialDisplayImage(
      material.id,
      material.data,
      imageObj,
      info as LegendInfo,
      props,
      config,
      diyStore.mmToPx,
      diyStore.maxBleed,
    )

    return config
  }

  const load = async (_isReset: boolean = false) => {
    const code = 'customMaterials'
    const name = '自定义素材'
    const materials = sortCustomMaterialsByOrder(info.customMaterialList)
    pruneCustomMaterialDisplayCache(materials.map((item) => item.id))

    if (!materials.length) {
      canvas.canvasConfigs[code] = { code, name, children: [] }
      return
    }

    const children = await Promise.all(
      materials.map(async (material) => {
        const imageSrc = resolvePersistedImageSrc(material.data)
        const imageObj = await loadTrackedImage(material.id, material.name, imageSrc)
        return buildChildConfig(material, imageObj)
      }),
    )

    canvas.canvasConfigs[code] = { code, name, children }
  }

  return load
}
