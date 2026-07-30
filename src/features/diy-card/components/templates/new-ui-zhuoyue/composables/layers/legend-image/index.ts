import { createTrackedKonvaImageLoader, useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import { scheduleProgressiveKonvaRepaint } from '@/features/diy-card/composables/konva/progressiveKonvaImagePaint'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { getPosition } from '@/features/diy-card/utils/canvas'
import { isLegendImageFactoryLayout } from '@/features/diy-card/utils/legendImageLayout'
import {
  computeCoverFitLayout,
  resolveLegendImageCoverInsetLeftPx,
} from '@/features/diy-card/utils/outOfFrame/coverCrop'
import { markRaw } from 'vue'

/**
 * 绘制武将图
 * @param canvas 画布状态
 */
export function drawLegendImage(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const { info, props, updateNode, getDragger, getSelectHandlers, itemCacheMap } = canvas
  const loadTrackedImage = createTrackedKonvaImageLoader(diyStore)
  const { getFilters } = useKonvaBrightnessFilters()

  /** 加载入口 */
  const load = async (isReset: boolean = false) => {
    const code = 'legendImage'
    const name = '武将图'
    const renderObj = info.renderConfig.items[code]
    const pic = info.baseInfo.pic
    if (!pic) return

    /** 加载开始时是否为工厂布局；渐进解码期间须持续走 cover 重算，避免首帧写入错误 mm */
    const useCoverLayout = isReset || isLegendImageFactoryLayout(renderObj)

    let placed = false
    let stopRepaint: (() => void) | undefined

    const onProgress = (imageObj: HTMLImageElement) => {
      const naturalWidth = imageObj.naturalWidth || imageObj.width
      const naturalHeight = imageObj.naturalHeight || imageObj.height
      if (naturalWidth <= 0 || naturalHeight <= 0) {
        if (!imageObj.complete) return
      }

      const config = buildLegendImageConfig(code, name, renderObj, imageObj)
      updateNode(renderObj, config, useCoverLayout, {
        refreshFilterCache: imageObj.complete,
        skipLinkedOutOfFrameSync: !imageObj.complete,
      })
      placed = true
    }

    try {
      stopRepaint = scheduleProgressiveKonvaRepaint(() => itemCacheMap.value?.[code]?.ref?.value)
      const imageObj = await loadTrackedImage('legendImage', '武将图', pic, {
        priority: 'high',
        progressive: true,
        onProgress,
      })
      // data:image 不走 progressive 路径，onProgress 不会触发，须用返回值落盘到 Konva
      if (!placed && imageObj) {
        onProgress(imageObj)
      }
    } catch (error) {
      console.error('[legendImage] load failed', error)
    } finally {
      stopRepaint?.()
    }
  }

  /** 节点配置（默认 cover 铺满；非 reset 时由 mergeConfig 按 renderObj 覆盖位置） */
  const buildLegendImageConfig = (
    code: string,
    name: string,
    renderObj: LegendInfo['renderConfig']['items']['legendImage'],
    imageObj: HTMLImageElement,
  ): CanvasItemConfig => {
    const imageWidth = imageObj.naturalWidth || imageObj.width
    const imageHeight = imageObj.naturalHeight || imageObj.height
    if (imageWidth <= 0 || imageHeight <= 0) {
      return {
        code,
        name,
        width: 0,
        height: 0,
        image: markRaw(imageObj),
        rotation: 0,
        originX: 0,
        originY: 0,
        listening: false,
        loadFunc: itemCacheMap.value?.[code]!.loadFunc,
      } as CanvasItemConfig
    }

    const insetLeftPx = resolveLegendImageCoverInsetLeftPx(
      info,
      props.stageOrigin.x,
      diyStore.mmToPx,
    )
    const {
      displayWidth: finalWidth,
      displayHeight: finalHeight,
      x,
      y,
    } = computeCoverFitLayout(
      props.stageWidth,
      props.stageHeight,
      imageWidth,
      imageHeight,
      insetLeftPx,
    )

    return {
      code,
      name,
      width: finalWidth,
      height: finalHeight,
      image: markRaw(imageObj),
      rotation: 0,
      originX: x,
      originY: y,
      ...getPosition(x, y, finalWidth, finalHeight),
      ...getFilters(),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as CanvasItemConfig
  }

  return load
}
