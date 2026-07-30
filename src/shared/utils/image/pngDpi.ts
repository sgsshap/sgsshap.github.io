/** PNG 物理分辨率（pHYs）写入，供 Photoshop 等读取 PPI */

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

let crcTable: Uint32Array | null = null

const getCrcTable = () => {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crcTable[i] = c >>> 0
  }
  return crcTable
}

const crc32 = (type: string, data: Uint8Array) => {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (let i = 0; i < type.length; i++) {
    crc = table[(crc ^ type.charCodeAt(i)) & 0xff]! ^ (crc >>> 8)
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const createPhysChunk = (ppmX: number, ppmY: number) => {
  const data = new Uint8Array(9)
  const view = new DataView(data.buffer)
  view.setUint32(0, ppmX, false)
  view.setUint32(4, ppmY, false)
  data[8] = 1

  const chunk = new Uint8Array(4 + 4 + 9 + 4)
  const chunkView = new DataView(chunk.buffer)
  chunkView.setUint32(0, 9, false)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4)
  chunk.set(data, 8)
  chunkView.setUint32(17, crc32('pHYs', data), false)
  return chunk
}

const findChunkOffset = (png: Uint8Array, type: string, from = 8) => {
  let offset = from
  while (offset + 12 <= png.length) {
    const len = new DataView(png.buffer, png.byteOffset + offset).getUint32(0)
    const chunkType = String.fromCharCode(
      png[offset + 4]!,
      png[offset + 5]!,
      png[offset + 6]!,
      png[offset + 7]!,
    )
    if (chunkType === type) return offset
    offset += 12 + len
    if (chunkType === 'IEND') break
  }
  return -1
}

/**
 * 为 PNG 写入/替换 pHYs 块（单位：米），使 PS 显示正确 PPI
 */
export const embedPngPpi = (png: Uint8Array, ppi: number): Uint8Array => {
  if (png.length < 8 || !PNG_SIGNATURE.every((b, i) => png[i] === b)) {
    return png
  }

  const ppm = Math.round(ppi / 0.0254)
  const physChunk = createPhysChunk(ppm, ppm)

  const existingPhys = findChunkOffset(png, 'pHYs')
  if (existingPhys >= 0) {
    const len = new DataView(png.buffer, png.byteOffset + existingPhys).getUint32(0)
    const chunkSize = 12 + len
    const out = new Uint8Array(png.length - chunkSize + physChunk.length)
    out.set(png.subarray(0, existingPhys))
    out.set(physChunk, existingPhys)
    out.set(png.subarray(existingPhys + chunkSize), existingPhys + physChunk.length)
    return out
  }

  const idatOffset = findChunkOffset(png, 'IDAT')
  const insertAt = idatOffset >= 0 ? idatOffset : 8 + 12 + 13 // 紧随 IHDR 后

  const out = new Uint8Array(png.length + physChunk.length)
  out.set(png.subarray(0, insertAt))
  out.set(physChunk, insertAt)
  out.set(png.subarray(insertAt), insertAt + physChunk.length)
  return out
}

export const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export const uint8ArrayToDataUrl = (bytes: Uint8Array, mimeType = 'image/png') => {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

/** Data URL PNG 嵌入 PPI 后返回新 Data URL */
export const embedPngPpiInDataUrl = (dataUrl: string, ppi: number) => {
  if (!dataUrl.startsWith('data:image/png')) return dataUrl
  const bytes = embedPngPpi(dataUrlToUint8Array(dataUrl), ppi)
  return uint8ArrayToDataUrl(bytes)
}
