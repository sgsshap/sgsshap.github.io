import { useMessage } from 'naive-ui'

export type ShareCurrentPageOptions = {
  title?: string
  url?: string
}

/**
 * 分享当前页面：优先 Web Share API，否则复制链接到剪贴板。
 * @returns `'shared'` 系统分享成功；`'copied'` 已复制链接。
 */
export async function shareCurrentPage(
  options: ShareCurrentPageOptions = {},
): Promise<'shared' | 'copied'> {
  if (typeof window === 'undefined') {
    throw new Error('share-unavailable')
  }

  const url = options.url ?? window.location.href
  const title = options.title?.trim() || document.title

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
    }
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error('clipboard-unavailable')
  }

  await navigator.clipboard.writeText(url)
  return 'copied'
}

export function useShareCurrentPage() {
  const message = useMessage()

  const sharePage = async (options: ShareCurrentPageOptions = {}) => {
    try {
      const result = await shareCurrentPage(options)
      if (result === 'copied') {
        message.success('链接已复制')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      message.error('分享失败，请手动复制地址栏链接')
    }
  }

  return { sharePage }
}
