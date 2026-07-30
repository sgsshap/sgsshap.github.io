const mediaMatches = (query: string): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

/**
 * 是否以触摸为主输入（移动端 Naive 补丁、Konva 长按拖拽等）。
 *
 * Win11 / Edge 等环境常暴露 Touch API 或 maxTouchPoints>0（触控板、混合屏），
 * 但若当前主指针为 fine 且支持 hover，仍视为键鼠桌面操作。
 */
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false

  const hasTouchApi =
    'ontouchstart' in globalThis || (navigator.maxTouchPoints ?? 0) > 0

  if (mediaMatches('(pointer: fine)') && mediaMatches('(hover: hover)')) {
    return false
  }

  if (mediaMatches('(pointer: coarse)')) return true

  return hasTouchApi
}
