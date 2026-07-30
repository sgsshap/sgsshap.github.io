/** 百科页顶栏 + 搜索栏滚动收紧：慢滚跟手、快滚延迟过渡，均通过 CSS 变量驱动，避免 Vue 重渲染 */

const COLLAPSE_SCROLL_RANGE = 96
/** px/ms，连续滚轮/触控滑动超过此值视为快速滚动 */
const FAST_SCROLL_VELOCITY = 0.65
/** 单帧 progress 跳变超过此值也走过渡（需配合较短间隔，见下） */
const FAST_PROGRESS_JUMP = 0.14
/** 单次 scroll 位移超过此值视为离散跳转（点滚动条轨道/拖滑块大跳） */
const SCROLL_DISCRETE_JUMP_PX = 24

export interface WikiScrollChromeCollapseOptions {
  getScrollTop: () => number
  getRootEl: () => HTMLElement | null
  isEnabled: () => boolean
  onCollapseDeltaChange?: (deltaPx: number) => void
}

export function useWikiScrollChromeCollapse(options: WikiScrollChromeCollapseOptions) {
  let boundScrollEl: HTMLElement | null = null
  let listenWindowScroll = false
  let lastScrollTop = 0
  let lastScrollTime = 0
  let currentProgress = 0
  let collapseDeltaPx = 72
  let isAnimatedMode = false
  let layoutMeasureLock = 0

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

  const resolveTargetProgress = (scrollTop: number) =>
    clamp(scrollTop / COLLAPSE_SCROLL_RANGE, 0, 1)

  const runLayoutMeasure = <T,>(measure: () => T): T => {
    layoutMeasureLock += 1
    const root = options.getRootEl()
    if (layoutMeasureLock === 1) {
      isAnimatedMode = false
      root?.classList.remove('wiki-view--chrome-animated')
    }
    try {
      return measure()
    } finally {
      layoutMeasureLock -= 1
    }
  }

  const applyProgress = (progress: number, animated: boolean) => {
    const root = options.getRootEl()
    if (!root) return

    currentProgress = progress
    if (animated) {
      if (!isAnimatedMode) {
        isAnimatedMode = true
        root.classList.add('wiki-view--chrome-animated')
      }
    } else {
      if (isAnimatedMode) {
        isAnimatedMode = false
        root.classList.remove('wiki-view--chrome-animated')
        // 取消进行中的 transition，切回跟手模式
        void root.offsetHeight
      }
    }
    root.style.setProperty('--wiki-collapse-progress', String(progress))
  }

  const syncProgressToScroll = (animated: boolean) => {
    if (!options.isEnabled()) {
      applyProgress(0, false)
      return
    }
    applyProgress(resolveTargetProgress(options.getScrollTop()), animated)
  }

  const onScroll = () => {
    if (!options.isEnabled() || layoutMeasureLock > 0) return

    const scrollTop = options.getScrollTop()
    const now = performance.now()
    const deltaY = scrollTop - lastScrollTop
    const deltaTime = now - lastScrollTime
    const velocity = deltaTime > 0 ? Math.abs(deltaY / deltaTime) : 0
    const targetProgress = resolveTargetProgress(scrollTop)
    const progressJump = Math.abs(targetProgress - currentProgress)
    const absDeltaY = Math.abs(deltaY)

    // 点滚动条/轨道跳转：通常只触发 1 次 scroll，且距上次事件间隔很长，velocity 会被稀释
    const isDiscreteJump =
      absDeltaY >= SCROLL_DISCRETE_JUMP_PX && progressJump >= FAST_PROGRESS_JUMP

    const isFast =
      velocity >= FAST_SCROLL_VELOCITY ||
      (progressJump >= FAST_PROGRESS_JUMP && deltaTime < 48) ||
      isDiscreteJump

    applyProgress(targetProgress, isFast)

    lastScrollTop = scrollTop
    lastScrollTime = now
  }

  const bind = (scrollEl: HTMLElement | null, withWindowScroll = false) => {
    unbind()
    listenWindowScroll = withWindowScroll
    if (scrollEl) {
      boundScrollEl = scrollEl
      scrollEl.addEventListener('scroll', onScroll, { passive: true })
    }
    if (withWindowScroll) {
      window.addEventListener('scroll', onScroll, { passive: true })
    }
    lastScrollTop = options.getScrollTop()
    lastScrollTime = performance.now()
    if (options.isEnabled()) {
      syncProgressToScroll(false)
    }
  }

  const unbind = () => {
    boundScrollEl?.removeEventListener('scroll', onScroll)
    boundScrollEl = null
    if (listenWindowScroll) {
      window.removeEventListener('scroll', onScroll)
      listenWindowScroll = false
    }
  }

  const reset = () => {
    lastScrollTop = options.getScrollTop()
    lastScrollTime = performance.now()
    applyProgress(0, false)
  }

  const setCollapseDelta = (deltaPx: number) => {
    const nextDelta = clamp(Math.round(deltaPx), 0, 160)
    collapseDeltaPx = nextDelta
    options.onCollapseDeltaChange?.(nextDelta)
    const root = options.getRootEl()
    root?.style.setProperty('--wiki-chrome-collapse-delta', `${nextDelta}px`)
  }

  /** @deprecated 使用 {@link setCollapseDelta}，传入 expanded − collapsed 的实际差值 */
  const updateCollapseDelta = (expandedChromeHeightPx: number) => {
    setCollapseDelta(
      clamp(Math.round(expandedChromeHeightPx * 0.46), 52, 88),
    )
  }

  return {
    bind,
    unbind,
    reset,
    runLayoutMeasure,
    syncProgressToScroll,
    setCollapseDelta,
    updateCollapseDelta,
    getProgress: () => currentProgress,
    setProgress: applyProgress,
  }
}
