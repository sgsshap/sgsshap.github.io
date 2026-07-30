/**
 * JPEG 物理分辨率（JFIF APP0 密度字段）写入
 *
 * canvas / Konva 导出的 JPEG 通常带 JFIF；Photoshop 等据此显示 PPI。
 * 单位字节 = 1 表示「点/英寸」，X/Y density 即为 PPI。
 */

const SOI = 0xd8
const APP0 = 0xe0
const JFIF = [0x4a, 0x46, 0x49, 0x46, 0x00] // "JFIF\0"

const isJfifApp0 = (jpeg: Uint8Array, offset: number) => {
  if (offset + 15 >= jpeg.length) return false
  if (jpeg[offset] !== 0xff || jpeg[offset + 1] !== APP0) return false
  return JFIF.every((byte, i) => jpeg[offset + 4 + i] === byte)
}

/** 定位 APP0 JFIF 段起始（指向 0xFF） */
const findJfifApp0Offset = (jpeg: Uint8Array): number => {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== SOI) return -1

  let offset = 2
  while (offset + 4 < jpeg.length) {
    if (jpeg[offset] !== 0xff) break

    const marker = jpeg[offset + 1]!
    if (marker === APP0 && isJfifApp0(jpeg, offset)) {
      return offset
    }

    const segmentLength = (jpeg[offset + 2]! << 8) | jpeg[offset + 3]!
    if (segmentLength < 2) break
    offset += 2 + segmentLength

    if (marker === 0xda) break
  }

  return -1
}

const writeDensity = (jpeg: Uint8Array, jfifBase: number, ppi: number) => {
  const density = Math.min(0xffff, Math.max(1, Math.round(ppi)))
  jpeg[jfifBase + 7] = 1
  jpeg[jfifBase + 8] = (density >> 8) & 0xff
  jpeg[jfifBase + 9] = density & 0xff
  jpeg[jfifBase + 10] = (density >> 8) & 0xff
  jpeg[jfifBase + 11] = density & 0xff
}

/**
 * 为 JPEG 写入/更新 JFIF 密度（PPI）
 */
export const embedJpegPpi = (jpeg: Uint8Array, ppi: number): Uint8Array => {
  const app0Offset = findJfifApp0Offset(jpeg)
  if (app0Offset < 0) {
    return jpeg
  }

  const out = Uint8Array.from(jpeg)
  writeDensity(out, app0Offset + 4, ppi)
  return out
}
