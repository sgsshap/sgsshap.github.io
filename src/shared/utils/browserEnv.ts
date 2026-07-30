const MOBILE_LAYOUT_QUERY = '(max-width: 1023px)'

/** iOS / iPadOS 上的 Microsoft Edge（WebKit 壳，与 Safari 同源但 viewport 行为更不稳定） */
export const isEdgeIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /EdgiOS/i.test(navigator.userAgent)
}

/** Android / 桌面 Chromium Edge（Edg/） */
export const isEdgeChromium = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Edg\//.test(ua) || /Edge\//i.test(ua)
}

/** 任一 Edge 品牌浏览器 */
export const isEdgeBrowser = (): boolean => isEdgeIOS() || isEdgeChromium()

export const isMobileLayoutViewport = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches
}

export const isEdgeMobileLayout = (): boolean =>
  isEdgeBrowser() && isMobileLayoutViewport()

/** EdgiOS 键盘 viewport 由 WebKit 自行处理，JS 干预会放大空白条概率 */
export const shouldUseNativeMobileKeyboardOnEdge = (): boolean => isEdgeIOS()

export const applyBrowserDocumentClasses = () => {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.toggle('browser-edge-ios', isEdgeIOS())
  root.classList.toggle('browser-edge', isEdgeChromium())
  root.classList.toggle('mobile-layout', isMobileLayoutViewport())
}

export const installBrowserDocumentClasses = () => {
  if (typeof window === 'undefined') return () => {}

  applyBrowserDocumentClasses()

  const media = window.matchMedia(MOBILE_LAYOUT_QUERY)
  const onMediaChange = () => applyBrowserDocumentClasses()
  media.addEventListener('change', onMediaChange)

  return () => {
    media.removeEventListener('change', onMediaChange)
  }
}

/** 仅 Chromium Edge：overlay 键盘 + JS 限高；EdgiOS 保持 meta 默认 resizes-content */
export const tuneEdgeViewportMeta = () => {
  if (typeof document === 'undefined' || !isEdgeChromium()) return

  const meta = document.querySelector('meta[name="viewport"]')
  if (!meta) return

  const content = meta.getAttribute('content') ?? ''
  if (content.includes('interactive-widget=resizes-visual')) return

  const next = content
    .replace(/interactive-widget=resizes-content/g, 'interactive-widget=resizes-visual')
    .trim()

  meta.setAttribute(
    'content',
    next.includes('interactive-widget=')
      ? next
      : `${next}, interactive-widget=resizes-visual`,
  )
}
