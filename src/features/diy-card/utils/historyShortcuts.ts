const EDITABLE_FOCUS_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

let outOfFrameEditorOpen = false
const outOfFrameEditorCloseListeners = new Set<() => void>()

/** 人物出框编辑器打开时屏蔽画布历史记录等全局快捷键 */
export const setOutOfFrameEditorOpen = (open: boolean) => {
  const wasOpen = outOfFrameEditorOpen
  outOfFrameEditorOpen = open
  if (wasOpen && !open) {
    for (const listener of outOfFrameEditorCloseListeners) {
      listener()
    }
  }
}

export const isOutOfFrameEditorOpen = () => outOfFrameEditorOpen

/** 编辑器关闭后回调（用于延后主画布出框层重载，避免与编辑器争抢 GPU/内存） */
export const onOutOfFrameEditorClosed = (listener: () => void) => {
  outOfFrameEditorCloseListeners.add(listener)
  return () => {
    outOfFrameEditorCloseListeners.delete(listener)
  }
}

/**
 * 焦点在输入类控件内，或人物出框编辑器打开时不拦截画布快捷键（历史撤销、方向键、缩放等）
 */
export const isDiyCanvasShortcutBlocked = () => {
  if (outOfFrameEditorOpen) return true

  const el = document.activeElement
  if (!el || el === document.body || el === document.documentElement) {
    return false
  }
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el.matches(EDITABLE_FOCUS_SELECTOR)) return true
  return Boolean(el.closest(EDITABLE_FOCUS_SELECTOR))
}
