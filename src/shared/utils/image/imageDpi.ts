import { embedJpegPpi } from '@/shared/utils/image/jpegDpi'
import { dataUrlToUint8Array, embedPngPpi } from '@/shared/utils/image/pngDpi'

export { dataUrlToUint8Array } from '@/shared/utils/image/pngDpi'

/**
 * 按 MIME 为导出图嵌入物理分辨率元数据
 * - PNG：pHYs 块
 * - JPEG：JFIF APP0 密度
 */
export const embedImagePpi = (bytes: Uint8Array, mimeType: string, ppi: number): Uint8Array => {
  if (mimeType === 'image/png') {
    return embedPngPpi(bytes, ppi)
  }
  if (mimeType === 'image/jpeg') {
    return embedJpegPpi(bytes, ppi)
  }
  return bytes
}

/** Data URL → 写入 PPI 后的 object URL */
export const finalizeExportImageUrl = (dataUrl: string, mimeType: string, ppi: number): string => {
  if (!dataUrl.startsWith('data:')) {
    return dataUrl
  }
  const bytes = embedImagePpi(dataUrlToUint8Array(dataUrl), mimeType, ppi)
  return URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: mimeType }))
}
