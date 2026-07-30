import { useDiyStore } from '@/features/diy-card/stores'
import { isOutOfFrameEditorOpen } from '@/features/diy-card/utils/historyShortcuts'
import { isNarrowViewport, shouldUseReducedCanvasQuality } from '@/shared/utils/deviceCapability'
import { onMounted, onUnmounted } from 'vue'

/** 移动端后台超过该时长后回前台，强制重载 Konva（缓解 canvas 被系统回收后空白） */
const MOBILE_BACKGROUND_RELOAD_MS = 15_000

/** 回前台后等待布局稳定再轻量恢复（地址栏收起、WebView resume 等） */
const VISIBLE_LAYOUT_RECOVERY_DELAY_MS = 80

export type CanvasBackgroundRecoveryOptions = {
  /** 是否启用（如制图页、模板已挂载） */
  enabled?: () => boolean
  /** 页面进入后台时（可与历史持久化合并） */
  onHidden?: () => void
  /** 回前台轻量恢复：重算 CSS scale / Konva buffer（每次可见时） */
  onVisible?: () => void
  /** 画布全量重载完成后 */
  onRecovered?: () => void
}

/**
 * 移动端浏览器长时间挂后台后，Canvas/Konva 常被系统清空或 buffer 尺寸错乱（元素缩到左上角）。
 * 回前台：先轻量 refresh layout；挂后台较久 / bfcache / WebView resume 时再全量 reload。
 */
export function useCanvasBackgroundRecovery(options: CanvasBackgroundRecoveryOptions = {}) {
  const diyStore = useDiyStore()
  let hiddenAt = 0
  let recovering = false
  let visibleRecoverTimer: ReturnType<typeof setTimeout> | null = null

  const isEnabled = () => options.enabled?.() ?? true

  const canHeavyRecover = () => isEnabled() && isNarrowViewport()

  const markHidden = () => {
    hiddenAt = Date.now()
    options.onHidden?.()
  }

  const scheduleVisibleLayoutRecovery = () => {
    if (!isEnabled() || !options.onVisible) return
    if (visibleRecoverTimer) clearTimeout(visibleRecoverTimer)
    visibleRecoverTimer = setTimeout(() => {
      visibleRecoverTimer = null
      options.onVisible?.()
    }, VISIBLE_LAYOUT_RECOVERY_DELAY_MS)
  }

  const recoverCanvasIfNeeded = async (reason: 'background' | 'bfcache' | 'resume') => {
    if (!canHeavyRecover() || recovering || diyStore.isCanvasLoading || isOutOfFrameEditorOpen()) {
      return
    }

    if (reason === 'background') {
      if (!hiddenAt) return
      const elapsed = Date.now() - hiddenAt
      hiddenAt = 0
      if (elapsed < MOBILE_BACKGROUND_RELOAD_MS) return
    } else {
      hiddenAt = 0
    }

    recovering = true
    try {
      await diyStore.reload(false, {
        sequentialLoad: shouldUseReducedCanvasQuality(),
      })
      options.onRecovered?.()
    } finally {
      recovering = false
    }
  }

  const onForeground = (reason: 'background' | 'bfcache' | 'resume') => {
    scheduleVisibleLayoutRecovery()
    void recoverCanvasIfNeeded(reason)
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      markHidden()
      return
    }
    onForeground('background')
  }

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      onForeground('bfcache')
      return
    }
    scheduleVisibleLayoutRecovery()
  }

  const onPageHide = () => {
    if (!hiddenAt) {
      hiddenAt = Date.now()
    }
  }

  const onPageResume = () => {
    onForeground('resume')
  }

  const onWindowFocus = () => {
    if (document.visibilityState !== 'visible') return
    scheduleVisibleLayoutRecovery()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('resume', onPageResume)
    window.addEventListener('focus', onWindowFocus)
  })

  onUnmounted(() => {
    if (visibleRecoverTimer) clearTimeout(visibleRecoverTimer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('resume', onPageResume)
    window.removeEventListener('focus', onWindowFocus)
  })

  return { recoverCanvasIfNeeded }
}
