import { observeAddedNodes } from '@/shared/utils/dom/observeAddedNodes'
import { dispatchSyntheticMouseEvent } from '@/shared/utils/dom/syntheticMouseEvent'
import { isTouchDevice } from '@/shared/utils/naive/touchDevice'

const ENHANCED_ATTR = 'data-sgs-color-picker-touch-drag'

const COLOR_PICKER_DRAG_ROOT_SELECTORS = [
  '.n-color-picker-pallete',
  '.n-color-picker-slider',
].join(',')

/**
 * Naive UI 各拖拽区域的真实 mousedown 绑定节点：
 * - 色盘：`.n-color-picker-pallete` 自身
 * - 色相条：外层 `.n-color-picker-slider` 内第一个 `position:relative` 子节点
 * - 透明度条：`.n-color-picker-slider` 自身（railRef 在外层）
 */
const resolveColorPickerDragTarget = (root: HTMLElement): HTMLElement | null => {
  if (root.matches('.n-color-picker-pallete')) {
    return root
  }
  if (root.matches('.n-color-picker-slider')) {
    const firstChild = root.firstElementChild
    if (
      firstChild instanceof HTMLElement &&
      firstChild.style.position === 'relative'
    ) {
      return firstChild
    }
    return root
  }
  return null
}

const enhanceDragTarget = (el: HTMLElement) => {
  if (el.hasAttribute(ENHANCED_ATTR)) return
  el.setAttribute(ENHANCED_ATTR, '1')
  el.style.touchAction = 'none'

  el.addEventListener(
    'pointerdown',
    (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return

      event.preventDefault()

      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        /* 部分 WebView 不支持 */
      }

      dispatchSyntheticMouseEvent('mousedown', el, event.clientX, event.clientY)

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault()
        dispatchSyntheticMouseEvent('mousemove', document, moveEvent.clientX, moveEvent.clientY)
      }

      const onPointerEnd = (endEvent: PointerEvent) => {
        dispatchSyntheticMouseEvent('mouseup', document, endEvent.clientX, endEvent.clientY)
        try {
          if (el.hasPointerCapture(endEvent.pointerId)) {
            el.releasePointerCapture(endEvent.pointerId)
          }
        } catch {
          /* ignore */
        }
        el.removeEventListener('pointermove', onPointerMove)
        el.removeEventListener('pointerup', onPointerEnd)
        el.removeEventListener('pointercancel', onPointerEnd)
      }

      el.addEventListener('pointermove', onPointerMove)
      el.addEventListener('pointerup', onPointerEnd)
      el.addEventListener('pointercancel', onPointerEnd)
    },
    { passive: false },
  )
}

const scanColorPickerPanel = (panel: ParentNode) => {
  if (!(panel instanceof Element)) return
  panel.querySelectorAll(COLOR_PICKER_DRAG_ROOT_SELECTORS).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    const target = resolveColorPickerDragTarget(node)
    if (target) {
      enhanceDragTarget(target)
    }
  })
}

const scanColorPickerPanels = (root: ParentNode) => {
  if (!(root instanceof Document || root instanceof Element)) return
  if (root instanceof Element && root.matches('.n-color-picker-panel')) {
    scanColorPickerPanel(root)
  }
  root.querySelectorAll?.('.n-color-picker-panel').forEach((panel) => {
    scanColorPickerPanel(panel)
  })
}

export type NaiveColorPickerTouchDragGuard = {
  disconnect: () => void
}

/**
 * 移动端 n-color-picker：色盘与色相/透明度条支持触摸拖拽选色。
 * Naive UI 仅监听 mouse 事件，此处用 pointer 事件 + 合成 mouse 事件补齐。
 */
export function setupNaiveColorPickerTouchDrag(): NaiveColorPickerTouchDragGuard | null {
  if (!isTouchDevice()) return null

  scanColorPickerPanels(document.body)

  const domObserver = observeAddedNodes((node) => {
    scanColorPickerPanels(node)
  })

  return {
    disconnect: () => domObserver.disconnect(),
  }
}
