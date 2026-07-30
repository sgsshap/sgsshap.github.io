import { useDiyHistoryStore } from '@/features/diy-card/stores'
import { useDiyStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  adjustCanvasItemScaleOrFontSize,
  CANVAS_MOVE_STEP_MM,
  nudgeCanvasItemPosition,
} from '@/features/diy-card/composables/preview/diyCanvasElementAdjust'
import { isDiyCanvasShortcutBlocked } from '@/features/diy-card/utils/historyShortcuts'
import { onMounted, onUnmounted } from 'vue'

const isArrowKey = (key: string) =>
  key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight'

const isZoomInKey = (key: string) =>
  key === '+' || key === '=' || key === 'Add' || key === 'NumpadAdd'

const isZoomOutKey = (key: string) =>
  key === '-' || key === '_' || key === 'Subtract' || key === 'NumpadSubtract'

export type DiyCanvasKeyboardShortcutsOptions = {
  /** 是否启用（制图页；宽屏/窄屏均支持外接或蓝牙键盘） */
  enabled: () => boolean
  onSyncLayout: () => void
  onReloadProperty: () => void
}

/**
 * 画布快捷键：方向键微调位置，+/- 调整缩放或字号（受 editable 约束；窄屏可用蓝牙/外接键盘）
 */
export const useDiyCanvasKeyboardShortcuts = (
  options: DiyCanvasKeyboardShortcutsOptions,
) => {
  const diyStore = useDiyStore()
  const historyStore = useDiyHistoryStore()
  const infoStore = useInfoStore()

  const onKeyDown = (event: KeyboardEvent) => {
    if (!options.enabled()) return
    if (isDiyCanvasShortcutBlocked()) return
    if (historyStore.isRestoring || diyStore.isCanvasLoading) return
    if (event.ctrlKey || event.metaKey || event.altKey) return

    const item = diyStore.selectedItem
    if (!item) return

    if (isArrowKey(event.key)) {
      if (!item.editable?.movable) return
      event.preventDefault()
      if (event.key === 'ArrowUp') {
        nudgeCanvasItemPosition(item, 0, -CANVAS_MOVE_STEP_MM, options.onSyncLayout)
      } else if (event.key === 'ArrowDown') {
        nudgeCanvasItemPosition(item, 0, CANVAS_MOVE_STEP_MM, options.onSyncLayout)
      } else if (event.key === 'ArrowLeft') {
        nudgeCanvasItemPosition(item, -CANVAS_MOVE_STEP_MM, 0, options.onSyncLayout)
      } else {
        nudgeCanvasItemPosition(item, CANVAS_MOVE_STEP_MM, 0, options.onSyncLayout)
      }
      return
    }

    if (isZoomInKey(event.key)) {
      if (!item.editable?.scalable) return
      event.preventDefault()
      adjustCanvasItemScaleOrFontSize(
        item,
        1,
        options.onSyncLayout,
        options.onReloadProperty,
        infoStore.info as LegendInfo,
      )
      return
    }

    if (isZoomOutKey(event.key)) {
      if (!item.editable?.scalable) return
      event.preventDefault()
      adjustCanvasItemScaleOrFontSize(
        item,
        -1,
        options.onSyncLayout,
        options.onReloadProperty,
        infoStore.info as LegendInfo,
      )
    }
  }

  onMounted(() => globalThis.addEventListener('keydown', onKeyDown))
  onUnmounted(() => globalThis.removeEventListener('keydown', onKeyDown))
}
