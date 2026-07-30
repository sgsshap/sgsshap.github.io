import { readLayoutViewportSize } from '@/shared/utils/viewportLayoutResize'

/** 与 AppShell `.app-shell--narrow .app-shell__content` 的 padding-bottom 一致 */
export const APP_TABBAR_LAYOUT_RESERVE_PX = 64

/** 预览栏未挂载时的底部占位估算（提示 + 历史 + 详细设置工具栏） */
const FALLBACK_FOOTER_CHROME_PX = 132

/** 底部 Tab 布局时为内容区预留的底边距（px） */
export function getAppBottomLayoutReservePx(hasBottomTab: boolean): number {
  return hasBottomTab ? APP_TABBAR_LAYOUT_RESERVE_PX : 16
}

/**
 * 元素在滚动容器内容流中的顶部偏移（与 scrollTop 无关）。
 * 勿用 getBoundingClientRect().top 直接参与缩放预算，否则滚动会误放大画布。
 */
export function measureLayoutOffsetTopInScrollContainer(
  element: HTMLElement,
  scrollRoot: HTMLElement | null | undefined,
): number {
  if (!scrollRoot) {
    return element.getBoundingClientRect().top
  }
  const elementRect = element.getBoundingClientRect()
  const rootRect = scrollRoot.getBoundingClientRect()
  return elementRect.top - rootRect.top + scrollRoot.scrollTop
}

/** 一屏布局计算用的可见视口高度（优先滚动容器 clientHeight） */
export function resolvePreviewStackViewportHeight(scrollRoot: HTMLElement | null | undefined): number {
  if (scrollRoot && scrollRoot.clientHeight > 0) {
    return scrollRoot.clientHeight
  }
  return readLayoutViewportSize().height
}

/**
 * 画布下方固定 UI 占用高度（提示、历史栏、「详细设置」工具栏）。
 * 不依赖当前画布高度，避免「量得越大缩得越小」的反馈循环。
 */
export function measurePreviewFixedFooterChrome(root: HTMLElement | null): number {
  if (!root) return FALLBACK_FOOTER_CHROME_PX

  const hint = root.querySelector('.diy-preview__select-hint') as HTMLElement | null
  const toolbar = root.querySelector('.diy-preview-bar__toolbar') as HTMLElement | null

  if (hint && toolbar) {
    const top = hint.getBoundingClientRect().top
    const bottom = toolbar.getBoundingClientRect().bottom
    return Math.max(120, bottom - top + 4)
  }

  let total = 6

  if (hint) total += hint.offsetHeight + 4

  const history = root.querySelector('.diy-history-bar') as HTMLElement | null
  if (history) total += history.offsetHeight + 6

  if (toolbar) {
    total += toolbar.offsetHeight + 4
  } else {
    total += 48
  }

  return total
}

/** 一屏内留给画布 CSS 缩放后的最大可视高度 */
export function resolvePreviewStackMaxCanvasHeight(options: {
  viewportHeight: number
  canvasBlockTop: number
  belowCanvasChrome: number
  bottomReserve: number
  extraGap?: number
  /** >1 时略放宽画布高度预算（Pad 双栏） */
  heightBudgetFactor?: number
}): number {
  const {
    viewportHeight,
    canvasBlockTop,
    belowCanvasChrome,
    bottomReserve,
    extraGap = 6,
    heightBudgetFactor = 1,
  } = options
  const raw =
    viewportHeight - bottomReserve - canvasBlockTop - belowCanvasChrome - extraGap
  return Math.max(160, raw * heightBudgetFactor)
}
