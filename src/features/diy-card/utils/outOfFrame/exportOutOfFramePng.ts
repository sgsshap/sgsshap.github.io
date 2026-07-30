import {
  canvasToDataUrl,
  compositeFullWithMask,
} from '@/features/diy-card/utils/outOfFrame/composite'
import { loadOutOfFrameImage } from '@/features/diy-card/utils/outOfFrame/imageLoader'

/** 原图 × 蒙版合成出框 PNG（按原图像素导出） */
export const composeOutOfFramePngDataUrl = async (
  sourcePic: string,
  maskDataUrl: string,
): Promise<string> => {
  const source = await loadOutOfFrameImage(sourcePic)
  const width = Math.max(1, source.naturalWidth || source.width)
  const height = Math.max(1, source.naturalHeight || source.height)
  const canvas = await compositeFullWithMask(sourcePic, maskDataUrl, width, height)
  return canvasToDataUrl(canvas)
}
