/** 防抖：连续触发时仅最后一次在 delayMs 后执行 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): T & { cancel: () => void } {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined

  const debounced = ((...args: Parameters<T>) => {
    if (timer) globalThis.clearTimeout(timer)
    timer = globalThis.setTimeout(() => {
      timer = undefined
      fn(...args)
    }, delayMs)
  }) as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timer) globalThis.clearTimeout(timer)
    timer = undefined
  }

  return debounced
}
