import { useDiyHistoryStore } from '@/features/diy-card/stores'

/** 页面隐藏 / 刷新前尽量把待写入的历史栈 flush 到本地存储 */
export const installDiyHistoryPersistLifecycle = (): (() => void) => {
  if (typeof window === 'undefined') return () => {}

  let flushing: Promise<void> | null = null

  const flush = () => {
    if (flushing) return flushing
    flushing = useDiyHistoryStore()
      .flushPersist()
      .catch((error) => {
        console.warn('[diy-history] lifecycle flush failed', error)
      })
      .finally(() => {
        flushing = null
      })
    return flushing
  }

  const onPageHide = (event: PageTransitionEvent) => {
    if (event.persisted) return
    flush()
  }

  const onBeforeUnload = () => {
    void flush()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      void flush()
    }
  }

  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('beforeunload', onBeforeUnload)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
