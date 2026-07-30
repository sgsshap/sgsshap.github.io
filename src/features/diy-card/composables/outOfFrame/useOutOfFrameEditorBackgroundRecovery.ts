import { onMounted, onUnmounted } from 'vue'

export type OutOfFrameEditorBackgroundRecoveryOptions = {
  enabled: () => boolean
  recover: () => void | Promise<void>
}

/**
 * 移动端浏览器切后台后，DOM Canvas 常被系统清空为空白。
 * 回前台 / bfcache / WebView resume 时触发一次重绘恢复。
 */
export function useOutOfFrameEditorBackgroundRecovery(
  options: OutOfFrameEditorBackgroundRecoveryOptions,
) {
  let recovering = false
  let recoverTimer: ReturnType<typeof setTimeout> | null = null

  const runRecover = async () => {
    if (!options.enabled() || recovering) return
    recovering = true
    try {
      await options.recover()
    } finally {
      recovering = false
    }
  }

  const scheduleRecover = () => {
    if (recoverTimer) clearTimeout(recoverTimer)
    recoverTimer = setTimeout(() => {
      recoverTimer = null
      void runRecover()
    }, 80)
  }

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return
    scheduleRecover()
  }

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      scheduleRecover()
    }
  }

  const onPageResume = () => {
    scheduleRecover()
  }

  const onWindowFocus = () => {
    if (document.visibilityState === 'visible') {
      scheduleRecover()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('resume', onPageResume)
    window.addEventListener('focus', onWindowFocus)
  })

  onUnmounted(() => {
    if (recoverTimer) clearTimeout(recoverTimer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pageshow', onPageShow)
    document.removeEventListener('resume', onPageResume)
    window.removeEventListener('focus', onWindowFocus)
  })
}
