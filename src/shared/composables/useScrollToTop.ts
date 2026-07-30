import { useRoute } from 'vue-router'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const SCROLL_SHOW_THRESHOLD = 120
const SCROLL_TO_TOP_MS_MIN = 420
const SCROLL_TO_TOP_MS_MAX = 980
const SCROLL_TO_TOP_MS_PER_PX = 0.55

import { shouldAvoidWindowScrollSync } from '@/shared/utils/mobileKeyboardViewport'

const APP_SHELL_MAIN_SELECTOR = '.app-shell__main'
const APP_SHELL_SCROLL_SELECTOR = `${APP_SHELL_MAIN_SELECTOR} .n-layout-scroll-container`

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/** 读取 AppShell 当前滚动位置（容器 + window 取较大值） */
export function readAppShellScrollTop() {
  const scrollEl = findAppShellScrollContainer()
  const containerTop = scrollEl?.scrollTop ?? 0
  if (shouldAvoidWindowScrollSync()) {
    return containerTop
  }
  const windowTop = document.scrollingElement?.scrollTop ?? window.scrollY ?? 0
  return Math.max(containerTop, windowTop)
}

/** 写入 AppShell 滚动位置（同时同步容器与 window） */
export function setAppShellScrollTop(top: number) {
  const scrollEl = findAppShellScrollContainer()
  const nextTop = Math.max(0, top)
  if (scrollEl) {
    scrollEl.scrollTop = nextTop
  }
  if (!shouldAvoidWindowScrollSync()) {
    window.scrollTo(0, nextTop)
  }
}

/** 在 root 内查找 Naive 主滚动容器 */
export function resolveLayoutScrollContainer(root: HTMLElement | null | undefined) {
  if (!root) return null
  if (root.classList.contains('n-layout-scroll-container')) return root
  const inner = root.querySelector<HTMLElement>('.n-layout-scroll-container')
  if (inner) return inner
  return null
}

/** AppShell 主内容列（侧栏右侧），用于 fixed 顶栏范围 */
export function findAppShellMainArea() {
  return document.querySelector<HTMLElement>(APP_SHELL_MAIN_SELECTOR)
}

export function findAppShellScrollContainer() {
  const scoped = document.querySelector<HTMLElement>(APP_SHELL_SCROLL_SELECTOR)
  if (scoped) return scoped

  const main = findAppShellMainArea()
  return resolveLayoutScrollContainer(main)
}

/** 从页面节点向上查找实际发生滚动的容器（兼容移动端布局差异） */
export function resolveScrollContainerFromElement(start: HTMLElement | null | undefined) {
  let node = start?.parentElement ?? null
  while (node) {
    if (node.classList.contains('n-layout-scroll-container')) {
      return node
    }
    const { overflowY } = getComputedStyle(node)
    const canScroll = node.scrollHeight > node.clientHeight + 1
    if (canScroll && (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')) {
      return node
    }
    node = node.parentElement
  }
  return findAppShellScrollContainer()
}

const resolveScrollDuration = (distance: number) =>
  Math.min(SCROLL_TO_TOP_MS_MAX, Math.max(SCROLL_TO_TOP_MS_MIN, distance * SCROLL_TO_TOP_MS_PER_PX))

/**
 * 监听 AppShell 主滚动区，控制「回到顶部」按钮显隐
 */
export function useAppShellScrollToTop() {
  const visible = ref(false)
  let scrollEl: HTMLElement | null = null
  let scrollToTopFrame: number | null = null

  const onScroll = () => {
    visible.value = readAppShellScrollTop() > SCROLL_SHOW_THRESHOLD
  }

  const cancelScrollToTop = () => {
    if (scrollToTopFrame !== null) {
      cancelAnimationFrame(scrollToTopFrame)
      scrollToTopFrame = null
    }
  }

  const unbind = () => {
    cancelScrollToTop()
    scrollEl?.removeEventListener('scroll', onScroll)
    window.removeEventListener('scroll', onScroll)
    scrollEl = null
  }

  const bind = () => {
    unbind()
    scrollEl = findAppShellScrollContainer()
    if (!scrollEl) {
      visible.value = false
      return
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  }

  const scrollToTop = () => {
    if (!scrollEl) return
    cancelScrollToTop()

    const startTop = readAppShellScrollTop()
    if (startTop < 2) return

    const duration = resolveScrollDuration(startTop)
    const start = performance.now()

    const step = (now: number) => {
      if (!scrollEl) return
      const progress = Math.min((now - start) / duration, 1)
      const nextTop = startTop * (1 - easeOutCubic(progress))
      setAppShellScrollTop(nextTop)
      if (progress < 1) {
        scrollToTopFrame = requestAnimationFrame(step)
      } else {
        setAppShellScrollTop(0)
        scrollToTopFrame = null
        onScroll()
      }
    }
    scrollToTopFrame = requestAnimationFrame(step)
  }

  const route = useRoute()

  onMounted(() => {
    nextTick(bind)
  })

  watch(
    () => route.path,
    () => {
      nextTick(bind)
    },
  )

  onUnmounted(unbind)

  return { visible, scrollToTop }
}
