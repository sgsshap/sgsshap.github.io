import { usesShenCardLayout } from '@/features/diy-card/composables/doubleKingdom'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  PACKAGE_LAYOUT_NORMAL,
  PACKAGE_LAYOUT_SHEN,
  PACKAGE_TEXT_BG_LAYOUT,
  type PackageLayoutPreset,
  type PackageTextBgLayout,
} from '../constants/package'

/** 在 max 框内等比缩放（contain），不拉伸变形 */
export const resolvePackageBadgeSizePx = (
  naturalWidth: number,
  naturalHeight: number,
  maxWidthPx: number,
  maxHeightPx: number,
) => {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: maxWidthPx, height: maxHeightPx }
  }
  const scale = Math.min(maxWidthPx / naturalWidth, maxHeightPx / naturalHeight)
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  }
}

/** 自定义上传角标：组内等比 contain，居中，不压扁 */
export const applyPackageImageContainLayout = (
  child: CanvasItemConfig,
  boxWidth: number,
  boxHeight: number,
) => {
  const img = child.image
  if (!img || img.width <= 0 || img.height <= 0) {
    child.x = 0
    child.y = 0
    child.width = boxWidth
    child.height = boxHeight
    child.scaleX = 1
    child.scaleY = 1
    return
  }
  const fit = resolvePackageBadgeSizePx(img.width, img.height, boxWidth, boxHeight)
  const uniformScale = fit.width / img.width
  child.width = img.width
  child.height = img.height
  child.scaleX = uniformScale
  child.scaleY = uniformScale
  child.x = (boxWidth - fit.width) / 2
  child.y = (boxHeight - fit.height) / 2
}

export const resolvePackageLayoutPreset = (info: LegendInfo): PackageLayoutPreset =>
  usesShenCardLayout(info) ? PACKAGE_LAYOUT_SHEN : PACKAGE_LAYOUT_NORMAL

/** 角标默认位置所属卡面布局（神框 / 普通框） */
export type PackageCardLayoutKey = 'shen' | 'normal'

export const resolvePackageCardLayoutKey = (info: LegendInfo): PackageCardLayoutKey =>
  usesShenCardLayout(info) ? 'shen' : 'normal'

const matchesPackagePresetOriginMm = (
  persisted: { x: number; y: number },
  preset: PackageLayoutPreset,
) =>
  Math.abs(persisted.x - preset.xMm) < 0.02 && Math.abs(persisted.y - preset.yMm) < 0.02

/** 角标是否应恢复当前卡面 preset（布局切换或刷新后仍残留另一套默认坐标） */
export const shouldResetPackageCardLayout = (
  info: LegendInfo,
  packageItem: LegendInfo['renderConfig']['items']['package'],
): boolean => {
  const currentKey = resolvePackageCardLayoutKey(info)
  const tracked = packageItem.packageCardLayoutKey
  if (tracked === currentKey) return false
  if (tracked !== undefined) return true

  const currentPreset = resolvePackageLayoutPreset(info)
  if (matchesPackagePresetOriginMm(packageItem, currentPreset)) return false

  const otherPreset = currentKey === 'shen' ? PACKAGE_LAYOUT_NORMAL : PACKAGE_LAYOUT_SHEN
  return matchesPackagePresetOriginMm(packageItem, otherPreset)
}

/**
 * 是否应从历史快照还原角标 layout。
 * 快照 layoutKey 与当前卡面不一致时跳过，避免神/普通框切换后 reconcile 写回旧 max 框尺寸。
 */
export const shouldReconcilePackageLayoutFromSnapshot = (
  info: LegendInfo,
  snapshotPackage: LegendInfo['renderConfig']['items']['package'],
): boolean => {
  const currentKey = resolvePackageCardLayoutKey(info)
  const snapshotKey = snapshotPackage.packageCardLayoutKey
  if (snapshotKey !== undefined && snapshotKey !== currentKey) return false
  if (snapshotKey === currentKey) return true
  return !shouldResetPackageCardLayout(info, snapshotPackage)
}

/** 文字角标：底图在角标组内的像素位置与尺寸 */
export const resolvePackageTextBgLayoutPx = (
  badgeWidth: number,
  badgeHeight: number,
  bgLayout: PackageTextBgLayout = PACKAGE_TEXT_BG_LAYOUT,
) => ({
  x: badgeWidth * bgLayout.xRatio,
  y: badgeHeight * bgLayout.yRatio,
  width: badgeWidth * bgLayout.widthRatio,
  height: badgeHeight * bgLayout.heightRatio,
})

/**
 * 文字与底图共用的排版坐标系：按 layoutRef 等比缩放并居中到角标组。
 * 避免 badge 宽高因 mm 换算/缩放产生 1px 级差异时，字与底图漂移。
 */
export const resolvePackageTextLayoutMetrics = (
  badgeWidth: number,
  badgeHeight: number,
  layoutRefWidthPx: number,
  layoutRefHeightPx: number,
) => {
  if (layoutRefWidthPx <= 0 || layoutRefHeightPx <= 0 || badgeWidth <= 0 || badgeHeight <= 0) {
    return {
      layoutScale: 1,
      layoutWidth: badgeWidth,
      layoutHeight: badgeHeight,
      offsetX: 0,
      offsetY: 0,
    }
  }

  const layoutScale = Math.min(
    badgeWidth / layoutRefWidthPx,
    badgeHeight / layoutRefHeightPx,
  )
  const layoutWidth = layoutRefWidthPx * layoutScale
  const layoutHeight = layoutRefHeightPx * layoutScale

  return {
    layoutScale,
    layoutWidth,
    layoutHeight,
    offsetX: (badgeWidth - layoutWidth) / 2,
    offsetY: (badgeHeight - layoutHeight) / 2,
  }
}
