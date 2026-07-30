/**
 * 格式化文件大小（字节 → B/KB/MB…）
 */
export const formatFileSize = (bytes: number, decimalPlaces = 2): string => {
  if (!bytes || bytes === 0) return '0 B'

  const k = 1024
  const dm = decimalPlaces < 0 ? 0 : decimalPlaces
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const absBytes = Math.abs(bytes)
  const unitIndex = Math.min(Math.floor(Math.log(absBytes) / Math.log(k)), sizes.length - 1)
  const value = parseFloat((absBytes / k ** unitIndex).toFixed(dm))
  const sign = bytes < 0 ? '-' : ''
  return `${sign}${value} ${sizes[unitIndex]}`
}

/**
 * 从远程 URL 下载文件；跨域 fetch 失败时返回 false
 */
export const downloadRemoteFile = async (url: string, filename?: string): Promise<boolean> => {
  if (!url) return false
  try {
    const response = await fetch(url)
    if (!response.ok) return false
    const blob = await response.blob()
    const name = filename || url.split('/').pop()?.split('?')[0] || 'download'
    downloadBlob(blob, name)
    return true
  } catch {
    return false
  }
}

/**
 * 读取图片原始像素尺寸
 */
export const loadImageNaturalSize = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      })
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })

/**
 * 下载图片
 * @param dataUrl 图片数据
 * @param filename 文件名
 */
export const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * 部分移动端浏览器（如 Edge）会根据 Blob MIME 自动追加扩展名；
 * 当目标文件名不是 .json 时，改用通用二进制类型以保留指定后缀。
 */
const resolveDownloadBlob = (blob: Blob, filename: string) => {
  const lowerName = filename.toLowerCase()
  const isJsonMime = blob.type.toLowerCase().includes('json')
  const wantsJsonExtension = lowerName.endsWith('.json')
  if (isJsonMime && !wantsJsonExtension) {
    return new Blob([blob], { type: 'application/octet-stream' })
  }
  return blob
}

/**
 * 下载 Blob 对象
 *
 * @param blob Blob 对象
 * @param filename 文件名
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const effectiveBlob = resolveDownloadBlob(blob, filename)
  const url = URL.createObjectURL(effectiveBlob)
  downloadImage(url, filename)
  URL.revokeObjectURL(url)
}

/**
 * 文件转 base64
 * @param file 文件对象
 */
export const fileToBase64 = (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve(e.target?.result)
    }
    reader.onerror = (e) => {
      reject(e)
    }
    reader.readAsDataURL(file)
  })
}
