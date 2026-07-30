import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { resolveSkillOverlapHoleLeftMm } from '@/features/diy-card/types/diy/outOfFrame'
import { calculateFitSize } from '@/features/diy-card/utils/canvas'

/** 原画 cover 铺满时左侧扣掉的边框保留带（mm，相对成品区 trim 左缘；神框为 0） */
export const resolveLegendImageCoverInsetLeftMm = (info: LegendInfo) =>
  resolveSkillOverlapHoleLeftMm(info)

/** Stage 坐标：全幅模式整画布 cover；普通模式为成品区原点 + 左侧边框保留带 */
export const resolveLegendImageCoverInsetLeftPx = (
  info: LegendInfo,
  innerStageBleedPx: number,
  mmToPxRatio: number,
) => {
  if (info.renderConfig.display.fullModeFlag) return 0
  return innerStageBleedPx + mmToPxRatio * resolveLegendImageCoverInsetLeftMm(info)
}

/** 与武将图（legendImage）cover 铺满一致的画布布局（保持原图横纵比） */
export const computeCoverFitLayout = (
  stageWidth: number,
  stageHeight: number,
  imageWidth: number,
  imageHeight: number,
  insetLeftPx = 0,
) => {
  const coverWidth = Math.max(1, stageWidth - insetLeftPx)
  const { finalWidth, finalHeight } = calculateFitSize(
    coverWidth,
    stageHeight,
    imageWidth,
    imageHeight,
    'cover',
  )
  return {
    displayWidth: finalWidth,
    displayHeight: finalHeight,
    x: insetLeftPx + (coverWidth - finalWidth) / 2,
    y: (stageHeight - finalHeight) / 2,
  }
}
