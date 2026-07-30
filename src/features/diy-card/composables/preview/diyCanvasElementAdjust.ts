import {
  SKILL_DESC_AUTO_SIZE_MAX_FONT_PT,
  SKILL_DESC_AUTO_SIZE_MIN_FONT_PT,
  SKILL_DESC_MAX_FONT_PT,
  SKILL_DESC_MIN_FONT_PT,
  resolveSkillsDescAutoSizeFlag,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import { applySkillsDescFontSizePt } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/skills-area/layout'
import { isKingdomGlyphCode } from '@/features/diy-card/composables/doubleKingdom'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { applyFieldChange } from '@/features/diy-card/utils/diyHistoryField'
import { record } from '@/features/diy-card/utils/diyHistoryRecord'
import { hasLayoutFontSize } from '@/features/diy-card/utils/layoutItem'
import { toFixed } from '@/shared/utils/object'

export const CANVAS_MOVE_STEP_MM = 0.1
export const CANVAS_SCALE_STEP = 0.01
export const CANVAS_SCALE_MIN = 0.01
export const CANVAS_FONT_SIZE_STEP = 0.5
export const CANVAS_FONT_SIZE_MAX = 100
export const CANVAS_ROTATE_STEP = 1

const customKingdomTextNeedsReload = (item: LayoutItem) =>
  (item.code === 'kingdom' || isKingdomGlyphCode(item.code)) && hasLayoutFontSize(item)

export const nudgeCanvasItemPosition = (
  item: LayoutItem,
  dx: number,
  dy: number,
  onSyncLayout: () => void,
) => {
  if (!item.editable?.movable) return

  const prevX = item.x
  const prevY = item.y
  const nextX = toFixed(prevX + dx, 2)
  const nextY = toFixed(prevY + dy, 2)
  if (nextX === prevX && nextY === prevY) return

  item.x = nextX
  item.y = nextY
  onSyncLayout()
  record({ operation: 'move', itemName: item.name })
}

export const adjustCanvasItemScaleOrFontSize = (
  item: LayoutItem,
  direction: 1 | -1,
  onSyncLayout: () => void,
  onReloadProperty: () => void,
  legend?: LegendInfo,
) => {
  if (!item.editable?.scalable) return

  if (hasLayoutFontSize(item)) {
    const prev = item.size!
    if (item.code === 'skillsDesc' && legend) {
      const autoOn = resolveSkillsDescAutoSizeFlag(
        legend.renderConfig.items.skillsDesc.autoOptimizeSizeFlag,
        legend.renderConfig.items.skillsDesc.autoOptimizeFlag,
      )
      const min = autoOn ? SKILL_DESC_AUTO_SIZE_MIN_FONT_PT : SKILL_DESC_MIN_FONT_PT
      const max = autoOn ? SKILL_DESC_AUTO_SIZE_MAX_FONT_PT : SKILL_DESC_MAX_FONT_PT
      const next = toFixed(
        Math.min(max, Math.max(min, prev + direction * CANVAS_FONT_SIZE_STEP)),
        2,
      )
      if (next === prev) return
      applyFieldChange(
        `${item.name}字号`,
        prev,
        next,
        (value) => {
          applySkillsDescFontSizePt(legend, value, { markManual: autoOn })
        },
        { category: 'renderConfig', after: onReloadProperty },
      )
      return
    }

    const next = toFixed(
      Math.min(CANVAS_FONT_SIZE_MAX, Math.max(0.5, prev + direction * CANVAS_FONT_SIZE_STEP)),
      2,
    )
    if (next === prev) return
    applyFieldChange(
      `${item.name}字号`,
      prev,
      next,
      (value) => {
        item.size = value
      },
      { category: 'renderConfig', after: onReloadProperty },
    )
    return
  }

  const prev = typeof item.scale === 'number' ? item.scale : 1
  const next = toFixed(Math.max(CANVAS_SCALE_MIN, prev + direction * CANVAS_SCALE_STEP), 2)
  if (next === prev) return
  const afterScale = customKingdomTextNeedsReload(item) ? onReloadProperty : onSyncLayout
  applyFieldChange(
    `${item.name}缩放`,
    prev,
    next,
    (value) => {
      item.scale = value
    },
    { category: 'renderConfig', after: afterScale },
  )
}

export const nudgeCanvasItemRotation = (
  item: LayoutItem,
  direction: 1 | -1,
  onSyncLayout: () => void,
) => {
  if (!item.editable?.rotatable) return

  const prev = typeof item.rotation === 'number' ? item.rotation : 0
  const next = toFixed(prev + direction * CANVAS_ROTATE_STEP, 2)
  if (next === prev) return

  item.rotation = next
  onSyncLayout()
  record({ operation: 'rotate', itemName: item.name })
}
