import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { isPackageIdentifyActive } from '@/features/diy-card/types/diy/packageIdentify'

const FULL_FRAME_HIDDEN_LAYER_CODES = new Set([
  'frame',
  'skillsDesc',
  'skillsName',
  'bottomInfo',
  'hp',
  'package',
])

const hasGroupChildren = (config?: CanvasItemConfig) => Boolean(config?.children?.length)

const isLegendImageReady = (config: CanvasItemConfig | undefined, info: LegendInfo) => {
  if (!info.baseInfo.pic) return true
  return Boolean(config?.image)
}

const shouldVerifyLayer = (code: string, info: LegendInfo): boolean => {
  switch (code) {
    case 'customMaterials':
      return info.customMaterialList.length > 0
    case 'package':
      return isPackageIdentifyActive(info.baseInfo.packageIdentify)
    case 'legendOutOfFrame': {
      const outOfFrame = info.renderConfig.outOfFrame
      return Boolean(outOfFrame?.enabled && outOfFrame.maskDataUrl)
    }
    default:
      return true
  }
}

const isLayerReady = (
  code: string,
  config: CanvasItemConfig | undefined,
  info: LegendInfo,
): boolean => {
  if (!shouldVerifyLayer(code, info)) return true

  const fullMode = Boolean(info.renderConfig.display.fullModeFlag)
  if (fullMode && FULL_FRAME_HIDDEN_LAYER_CODES.has(code)) return true

  switch (code) {
    case 'legendImage':
      return isLegendImageReady(config, info)
    case 'frame':
    case 'skillsDesc':
    case 'skillsName':
    case 'bottomInfo':
    case 'hp':
    case 'watermark':
    case 'customMaterials':
      return hasGroupChildren(config)
    case 'package':
      return hasGroupChildren(config)
    case 'kingdom':
      return Boolean(config?.image || hasGroupChildren(config))
    case 'name':
    case 'title':
      return hasGroupChildren(config) || Boolean(config?.text)
    case 'legendOutOfFrame': {
      const image = config?.image
      if (image instanceof HTMLCanvasElement) {
        return image.width > 0 && image.height > 0
      }
      return Boolean(image)
    }
    default:
      return true
  }
}

/** 首屏 / 全量 reload 后仍未就绪、需要补拉的图层 code */
export const resolveIncompleteBootstrapLayerCodes = (
  info: LegendInfo,
  canvasConfigs: Record<string, CanvasItemConfig>,
  layerCodes: readonly string[],
): string[] =>
  layerCodes.filter((code) => !isLayerReady(code, canvasConfigs[code], info))
