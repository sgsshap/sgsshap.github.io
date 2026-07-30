import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  ensureLegendOutOfFrameLayoutItem,
  LEGEND_OUT_OF_FRAME_INDEPENDENT_EDITABLE,
  resolveOutOfFrameIndependentLayout,
} from '@/features/diy-card/types/diy/outOfFrame'

const isFactoryLegendImageLayout = (renderObj: LayoutItem) =>
  renderObj.code === 'legendImage' &&
  renderObj.x === 0 &&
  renderObj.y === 0 &&
  renderObj.width === 100 &&
  renderObj.height === 100 &&
  renderObj.scale === 1 &&
  renderObj.rotation === 0

/** 武将图仍为工厂默认布局，需按 cover 铺满画布 */
export const isLegendImageFactoryLayout = isFactoryLegendImageLayout

const resetLayoutItemToFactory = (item: LayoutItem) => {
  item.x = 0
  item.y = 0
  item.width = 100
  item.height = 100
  item.scale = 1
  item.rotation = 0
}

/** 更换武将图时重置原画布局，避免旧图宽高比套在新图上导致拉伸 */
export const resetLegendImageLayoutOnPicChange = (info: LegendInfo): boolean => {
  const legendImage = info.renderConfig.items.legendImage
  const hadPersistedLayout = !isFactoryLegendImageLayout(legendImage)
  const independent = resolveOutOfFrameIndependentLayout(legendImage)

  resetLayoutItemToFactory(legendImage)
  // 独立模式换图也须重置出框 mm，否则会沿用旧图宽高比导致新图拉抻
  resetLayoutItemToFactory(ensureLegendOutOfFrameLayoutItem(info))
  if (independent) {
    ensureLegendOutOfFrameLayoutItem(info).editable = {
      ...LEGEND_OUT_OF_FRAME_INDEPENDENT_EDITABLE,
    }
  }

  return hadPersistedLayout
}

const sanitizeDownloadPart = (value: string, fallback: string) =>
  value.trim().replace(/[\\/:*?"<>|]/g, '_') || fallback

/** 武将相关下载文件基名：称号.名称 */
export const resolveLegendDownloadBaseName = (title: string, name: string) => {
  const safeTitle = sanitizeDownloadPart(title, '无称号')
  const safeName = sanitizeDownloadPart(name, '武将')
  return `${safeTitle}.${safeName}`
}

/** 武将原画下载文件名 */
export const resolveLegendImageDownloadFileName = (title: string, name: string) =>
  `${resolveLegendDownloadBaseName(title, name)}-原画.png`

/** 武将出框图下载文件名 */
export const resolveOutOfFrameDownloadFileName = (title: string, name: string) =>
  `${resolveLegendDownloadBaseName(title, name)}-出框.png`
