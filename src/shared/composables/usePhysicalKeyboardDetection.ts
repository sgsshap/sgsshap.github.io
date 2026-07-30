import { onMounted, onUnmounted, ref } from 'vue'

const isLikelyPhysicalKey = (event: KeyboardEvent) => {
  if (!event.isTrusted) return false
  if (event.key === 'Unidentified') return false
  return event.key.length === 1 || event.key.startsWith('Arrow') || event.key.startsWith('Numpad')
}

/**
 * 是否曾检测到物理键盘输入（外接 / 蓝牙键盘）。
 * 触控端默认 false，首次 keydown 后置 true。
 */
export function usePhysicalKeyboardDetection() {
  const physicalKeyboardDetected = ref(false)

  const onKeyDown = (event: KeyboardEvent) => {
    if (physicalKeyboardDetected.value) return
    if (isLikelyPhysicalKey(event)) {
      physicalKeyboardDetected.value = true
    }
  }

  onMounted(() => {
    globalThis.addEventListener('keydown', onKeyDown, true)
  })

  onUnmounted(() => {
    globalThis.removeEventListener('keydown', onKeyDown, true)
  })

  return { physicalKeyboardDetected }
}
