import { usesShenCardLayout } from '@/features/diy-card/composables/doubleKingdom'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  NAME_LAYOUTS,
  NAME_SHEN_LAYOUT_OFFSET_X_MM,
  NAME_SHEN_LAYOUT_OFFSET_Y_MM,
} from '../constants/name'
import {
  TITLE_LAYOUTS,
  TITLE_SHEN_LAYOUT_OFFSET_X_MM,
  TITLE_SHEN_LAYOUT_OFFSET_Y_MM,
} from '../constants/title'
import { FRAME_SHEN_GROUP_X_MM } from '../constants/frame'
import { isStaleShenTextPresetLayout } from './textLayout'

/** 神框 / 普通框下的预设文字与边框布局 */
export type CardTextLayoutKey = 'shen' | 'normal'

export const resolveCardTextLayoutKey = (info: LegendInfo): CardTextLayoutKey =>
  usesShenCardLayout(info) ? 'shen' : 'normal'

const clearTextLayoutPreset = (item: LayoutItem & { textCardLayoutKey?: CardTextLayoutKey }) => {
  delete item.size
  delete item.textCardLayoutKey
  const loose = item as unknown as Record<string, unknown>
  delete loose.x
  delete loose.y
}

/** 百科 / 势力切换导致神框布局变化时，清除仍残留的普通框坐标 */
export const resetPresetCardLayoutOnModeChange = (legend: LegendInfo) => {
  const items = legend.renderConfig.items

  clearTextLayoutPreset(items.name)
  if (items.name.splitChars) {
    for (const key of Object.keys(items.name.splitChars)) {
      const char = items.name.splitChars[key]
      if (!char) continue
      delete char.size
      const looseChar = char as unknown as Record<string, unknown>
      delete looseChar.x
      delete looseChar.y
    }
  }

  clearTextLayoutPreset(items.title)

  delete items.frame.frameCardLayoutKey
  items.frame.x = 0
  items.frame.y = 0
  items.frame.width = 100
  items.frame.height = 100
  items.frame.scale = 1
  items.frame.rotation = 0

  delete items.package.packageCardLayoutKey
}

export const shouldForceResetFrameLayout = (
  frameItem: LegendInfo['renderConfig']['items']['frame'],
  shenFrameLayout: boolean,
  isReset: boolean,
): boolean => {
  if (isReset) return true

  const expectedKey: CardTextLayoutKey = shenFrameLayout ? 'shen' : 'normal'
  if (frameItem.frameCardLayoutKey !== undefined) {
    return frameItem.frameCardLayoutKey !== expectedKey
  }

  if (!shenFrameLayout || typeof frameItem.x !== 'number') return false
  return frameItem.x < FRAME_SHEN_GROUP_X_MM - 0.5
}

const shouldResetNameTitleLayoutFromPersisted = (
  info: LegendInfo,
  item: { x: number; y: number; size?: number; textCardLayoutKey?: CardTextLayoutKey },
  kind: 'name' | 'title',
): boolean => {
  const currentKey = resolveCardTextLayoutKey(info)
  if (item.textCardLayoutKey !== undefined && item.textCardLayoutKey !== currentKey) {
    return true
  }
  if (typeof item.size !== 'number' || item.size <= 0) return false

  const charCount = kind === 'name' ? info.baseInfo.name.length : info.baseInfo.title.length
  const layouts = kind === 'name' ? NAME_LAYOUTS : TITLE_LAYOUTS
  const offsetX = kind === 'name' ? NAME_SHEN_LAYOUT_OFFSET_X_MM : TITLE_SHEN_LAYOUT_OFFSET_X_MM
  const offsetY = kind === 'name' ? NAME_SHEN_LAYOUT_OFFSET_Y_MM : TITLE_SHEN_LAYOUT_OFFSET_Y_MM

  return isStaleShenTextPresetLayout(
    item,
    layouts,
    charCount,
    offsetX,
    offsetY,
    currentKey === 'shen',
  )
}

export const shouldReconcileNameLayoutFromSnapshot = (
  info: LegendInfo,
  snapshotName: LegendInfo['renderConfig']['items']['name'],
): boolean => !shouldResetNameTitleLayoutFromPersisted(info, snapshotName, 'name')

export const shouldReconcileTitleLayoutFromSnapshot = (
  info: LegendInfo,
  snapshotTitle: LegendInfo['renderConfig']['items']['title'],
): boolean => !shouldResetNameTitleLayoutFromPersisted(info, snapshotTitle, 'title')

export const shouldReconcileFrameLayoutFromSnapshot = (
  info: LegendInfo,
  snapshotFrame: LegendInfo['renderConfig']['items']['frame'],
): boolean => {
  const shenFrameLayout = resolveCardTextLayoutKey(info) === 'shen'
  return !shouldForceResetFrameLayout(snapshotFrame, shenFrameLayout, false)
}
