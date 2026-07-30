import {
  isEdgeChromium,
  isEdgeMobileLayout,
  shouldUseNativeMobileKeyboardOnEdge,
} from '@/shared/utils/browserEnv'
import { resolveScrollContainerFromElement } from '@/shared/composables/useScrollToTop'
import {
  applySafeViewportHeight,
  resolveViewportMetrics,
} from '@/shared/utils/safeViewport'
import { isBrowserPageZoom } from '@/shared/utils/viewportLayoutResize'

const MOBILE_LAYOUT_QUERY = '(max-width: 1023px)'

const isMobileLayout = () =>
  typeof window !== 'undefined' && window.matchMedia(MOBILE_LAYOUT_QUERY).matches

/** 移动端：fixed shell 场景下勿同步 window 滚动；Edge / EdgiOS 均走原生 document 滚动 */
export const shouldAvoidWindowScrollSync = () =>
  isMobileLayout() && !isEdgeChromium() && !shouldUseNativeMobileKeyboardOnEdge()

const isEditableField = (target: EventTarget | null): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled
  }
  if (target instanceof HTMLInputElement) {
    const type = target.type
    if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'file') {
      return false
    }
    return !target.readOnly && !target.disabled
  }
  if (target instanceof HTMLSelectElement) {
    return !target.disabled
  }
  return target.isContentEditable
}

const resolveScrollTarget = (field: HTMLElement) =>
  (field.closest('.desc-input') as HTMLElement | null) ?? field

const setKeyboardOpenClass = (open: boolean) => {
  document.documentElement.classList.toggle('keyboard-open', open)
}

export const lockMobileLayoutViewportScroll = () => {
  if (!isMobileLayout() || isEdgeChromium() || shouldUseNativeMobileKeyboardOnEdge()) return
  if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
    window.scrollTo(0, 0)
  }
}

let edgeSettleFrame = 0
const edgeSettleTimers: ReturnType<typeof globalThis.setTimeout>[] = []

const cancelEdgeViewportSettle = () => {
  if (edgeSettleFrame) {
    cancelAnimationFrame(edgeSettleFrame)
    edgeSettleFrame = 0
  }
  while (edgeSettleTimers.length) {
    globalThis.clearTimeout(edgeSettleTimers.pop())
  }
}

const scheduleEdgeTimer = (fn: () => void, delay: number) => {
  edgeSettleTimers.push(globalThis.setTimeout(fn, delay))
}

const scrollEdgeFieldIntoView = (field: HTMLElement) => {
  const scrollTarget = resolveScrollTarget(field)
  try {
    scrollTarget.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
  } catch {
    scrollTarget.scrollIntoView(false)
  }
}

const runEdgeChromiumViewportSettle = (field?: HTMLElement) => {
  if (!isEdgeMobileLayout() || shouldUseNativeMobileKeyboardOnEdge()) return

  cancelEdgeViewportSettle()
  setKeyboardOpenClass(true)

  const baselineHeight = window.innerHeight
  const startedAt = performance.now()
  const MAX_MS = 1000

  const tick = () => {
    applySafeViewportHeight()
    if (field) scrollEdgeFieldIntoView(field)

    const elapsed = performance.now() - startedAt
    if (elapsed >= MAX_MS) {
      edgeSettleFrame = 0
      return
    }

    const { height } = resolveViewportMetrics()
    if (height < baselineHeight - 32 && elapsed > 350) {
      edgeSettleFrame = 0
      return
    }

    edgeSettleFrame = requestAnimationFrame(tick)
  }

  tick()
  for (const delay of [0, 50, 120, 220, 360, 520, 720, 900]) {
    scheduleEdgeTimer(() => {
      applySafeViewportHeight()
      if (field) scrollEdgeFieldIntoView(field)
    }, delay)
  }
}

const scheduleViewportRecovery = () => {
  cancelEdgeViewportSettle()
  setKeyboardOpenClass(false)

  const run = () => {
    applySafeViewportHeight()
  }
  run()
  requestAnimationFrame(run)
  for (const delay of [120, 320, 520, 720]) {
    scheduleEdgeTimer(run, delay)
  }
}

const scrollFieldIntoVisibleViewport = (field: HTMLElement) => {
  const scrollTarget = resolveScrollTarget(field)
  const scrollEl = resolveScrollContainerFromElement(scrollTarget)
  if (!scrollEl) return

  lockMobileLayoutViewportScroll()
  applySafeViewportHeight()

  const viewportHeight = resolveViewportMetrics().height
  const insetTop = 8
  const insetBottom = 20
  const targetRect = scrollTarget.getBoundingClientRect()
  const visibleBottom = viewportHeight - insetBottom

  if (targetRect.bottom > visibleBottom) {
    scrollEl.scrollTop += targetRect.bottom - visibleBottom
  } else if (targetRect.top < insetTop) {
    scrollEl.scrollTop += targetRect.top - insetTop
  }
}

const scheduleScrollFieldIntoView = (field: HTMLElement) => {
  const run = () => scrollFieldIntoVisibleViewport(field)
  run()
  requestAnimationFrame(run)
  globalThis.setTimeout(run, 120)
  globalThis.setTimeout(run, 320)
}

/** 移动端键盘 viewport 校正（EdgiOS 完全跳过，交给 WebKit） */
export function installMobileKeyboardViewportGuard() {
  if (typeof window === 'undefined') return () => {}
  if (!isMobileLayout()) return () => {}

  // iOS Edge：任何 focus / touchstart / visualViewport 干预都会与壳层 bug 竞态
  if (shouldUseNativeMobileKeyboardOnEdge()) {
    return () => {}
  }

  const onViewportChange = () => {
    applySafeViewportHeight()
    if (!isBrowserPageZoom()) {
      lockMobileLayoutViewportScroll()
    }
  }

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (!isEditableField(target)) return

    if (isEdgeChromium()) {
      runEdgeChromiumViewportSettle(target)
      return
    }

    lockMobileLayoutViewportScroll()
    scheduleScrollFieldIntoView(target)
  }

  const onFocusOut = (event: FocusEvent) => {
    const target = event.target
    if (!isEditableField(target)) return
    if (isEdgeChromium()) {
      scheduleViewportRecovery()
    }
  }

  const onTouchStart = (event: TouchEvent) => {
    if (!isEdgeMobileLayout()) return
    const target = event.target
    if (!isEditableField(target)) return
    runEdgeChromiumViewportSettle(target)
  }

  window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true })
  window.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true })
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('focusout', onFocusOut, true)
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })

  return () => {
    cancelEdgeViewportSettle()
    setKeyboardOpenClass(false)
    window.visualViewport?.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('scroll', onViewportChange)
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
    document.removeEventListener('touchstart', onTouchStart, true)
  }
}
