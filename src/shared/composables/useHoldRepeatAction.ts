import { onUnmounted } from 'vue'

export type HoldRepeatActionOptions = {
  /** 首次重复前的等待（ms） */
  delay?: number
  /** 重复间隔（ms） */
  interval?: number
  /** 按下时是否立即执行一次 */
  immediate?: boolean
}

export type HoldRepeatActionHandlers = {
  onPointerdown: (event: PointerEvent) => void
  onPointerup: (event: PointerEvent) => void
  onPointercancel: (event: PointerEvent) => void
  onLostpointercapture: (event: PointerEvent) => void
  onContextmenu: (event: Event) => void
}

const DEFAULT_DELAY = 450
const DEFAULT_INTERVAL = 60

/**
 * 指针按住连续触发：点按执行一次，长按延迟后按间隔重复，抬起停止。
 * 适用于移动端快速操作按钮等场景。
 */
export function bindHoldRepeatAction(
  action: () => void,
  options: HoldRepeatActionOptions = {},
): HoldRepeatActionHandlers {
  const delay = options.delay ?? DEFAULT_DELAY
  const interval = options.interval ?? DEFAULT_INTERVAL
  const immediate = options.immediate ?? true

  let delayTimer: ReturnType<typeof globalThis.setTimeout> | undefined
  let repeatTimer: ReturnType<typeof globalThis.setInterval> | undefined

  const clearTimers = () => {
    if (delayTimer !== undefined) {
      globalThis.clearTimeout(delayTimer)
      delayTimer = undefined
    }
    if (repeatTimer !== undefined) {
      globalThis.clearInterval(repeatTimer)
      repeatTimer = undefined
    }
  }

  const stopRepeat = () => {
    clearTimers()
  }

  const startRepeat = () => {
    stopRepeat()
    if (immediate) action()
    delayTimer = globalThis.setTimeout(() => {
      delayTimer = undefined
      repeatTimer = globalThis.setInterval(action, interval)
    }, delay)
  }

  const onPointerdown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const target = event.currentTarget
    if (target instanceof Element) {
      try {
        target.setPointerCapture(event.pointerId)
      } catch {
        // ignore unsupported capture
      }
    }
    event.preventDefault()
    startRepeat()
  }

  const onPointerup = (event: PointerEvent) => {
    if (event.currentTarget instanceof Element && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    stopRepeat()
  }

  const onPointercancel = onPointerup
  const onLostpointercapture = () => {
    stopRepeat()
  }
  const onContextmenu = (event: Event) => {
    event.preventDefault()
  }

  onUnmounted(stopRepeat)

  return {
    onPointerdown,
    onPointerup,
    onPointercancel,
    onLostpointercapture,
    onContextmenu,
  }
}
