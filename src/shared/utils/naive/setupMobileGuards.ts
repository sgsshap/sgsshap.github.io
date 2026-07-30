import { setupNaiveColorPickerTouchDrag } from '@/shared/utils/naive/colorPickerTouchDrag'
import { setupNaiveInputNumberKeyboardGuard } from '@/shared/utils/naive/inputNumberKeyboard'

export type NaiveMobileGuard = {
  disconnect: () => void
}

/**
 * 一次性挂载 Naive UI 移动端交互补丁（数字输入键盘、取色器触摸拖拽等）。
 */
export function setupNaiveMobileGuards(): NaiveMobileGuard | null {
  const guards = [
    setupNaiveInputNumberKeyboardGuard(),
    setupNaiveColorPickerTouchDrag(),
  ].filter((guard): guard is NaiveMobileGuard => guard !== null)

  if (!guards.length) return null

  return {
    disconnect: () => {
      for (const guard of guards) {
        guard.disconnect()
      }
    },
  }
}
