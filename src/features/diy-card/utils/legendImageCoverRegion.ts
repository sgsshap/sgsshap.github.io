import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { resolveLegendImageCoverInsetLeftMm } from '@/features/diy-card/utils/outOfFrame/coverCrop'

/** 原画 cover 重铺所依据的 Stage 显示区域（尺寸 + 左侧 inset） */
export type LegendImageCoverRegion = {
  stageWidth: number
  stageHeight: number
  insetLeftPx: number
}

export const resolveLegendImageCoverRegion = (
  info: LegendInfo,
  input: {
    stageWidth: number
    stageHeight: number
    innerStageBleedPx: number
    mmToPxRatio: number
    fullModeFlag?: boolean
  },
): LegendImageCoverRegion => {
  const fullMode = input.fullModeFlag ?? info.renderConfig.display.fullModeFlag
  const insetLeftPx = fullMode
    ? 0
    : input.innerStageBleedPx + input.mmToPxRatio * resolveLegendImageCoverInsetLeftMm(info)
  return {
    stageWidth: input.stageWidth,
    stageHeight: input.stageHeight,
    insetLeftPx,
  }
}

export const legendImageCoverRegionKey = (region: LegendImageCoverRegion) =>
  `${region.stageWidth}x${region.stageHeight}@${Math.round(region.insetLeftPx)}`
