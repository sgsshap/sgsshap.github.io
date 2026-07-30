/** 出框编辑/合成用图片加载（data URL 不设 crossOrigin，避免加载失败） */
import {
  isPersistedImageRef,
  resolvePersistedImageSrc,
} from '@/features/diy-card/stores/history/persistSnapshot'

export const isOutOfFrameImageLoaded = (img: HTMLImageElement | null | undefined) =>
  Boolean(img?.complete && img.naturalWidth > 0 && img.naturalHeight > 0)

export const loadOutOfFrameImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const resolved = isPersistedImageRef(src) ? resolvePersistedImageSrc(src) : src.trim()
    if (!resolved) {
      reject(new Error('empty image src'))
      return
    }
    const img = new Image()
    if (/^https?:/i.test(resolved)) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('image has zero dimensions'))
        return
      }
      resolve(img)
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = resolved
  })
