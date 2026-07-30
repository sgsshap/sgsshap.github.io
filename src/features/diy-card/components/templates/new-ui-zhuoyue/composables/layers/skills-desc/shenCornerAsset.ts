import { loadKonvaImage } from '@/features/diy-card/composables'
import type { useDiyStore } from '@/features/diy-card/stores'
import { markRaw } from 'vue'
import {
  SKILL_DESC_SHEN_CORNER_ASPECT,
  SKILL_DESC_SHEN_CORNER_BL_WIDTH_MM,
  SKILL_DESC_SHEN_CORNER_BL_X_MM,
  SKILL_DESC_SHEN_CORNER_BL_Y_MM,
  SKILL_DESC_SHEN_CORNER_BR_WIDTH_MM,
  SKILL_DESC_SHEN_CORNER_BR_X_MM,
  SKILL_DESC_SHEN_CORNER_BR_Y_MM,
} from '../../constants/skills'
import { TEMPLATE_ASSET_BASE } from '../../constants/common'

const SHEN_CORNER_BL_URL = `${TEMPLATE_ASSET_BASE}/assets/skill-desc/shen-corner-bl.svg`
const SHEN_CORNER_BR_URL = `${TEMPLATE_ASSET_BASE}/assets/skill-desc/shen-corner-br.svg`

type CornerSide = 'bl' | 'br'

const cornerPromises: Record<CornerSide, Promise<HTMLImageElement> | null> = {
  bl: null,
  br: null,
}

const CORNER_URLS: Record<CornerSide, string> = {
  bl: SHEN_CORNER_BL_URL,
  br: SHEN_CORNER_BR_URL,
}

export const resetShenSkillDescCornerImageCache = () => {
  cornerPromises.bl = null
  cornerPromises.br = null
}

const loadCornerSvgImage = (
  diyStore: ReturnType<typeof useDiyStore>,
  url: string,
  label: string,
) =>
  diyStore.runWithLoading('skillsDesc', label, () => loadKonvaImage(url)).catch((error) => {
    throw error
  })

const loadShenSkillDescCornerImage = (
  side: CornerSide,
  diyStore: ReturnType<typeof useDiyStore>,
  label = '技能描述',
) => {
  cornerPromises[side] ??= loadCornerSvgImage(diyStore, CORNER_URLS[side], label).catch((error) => {
    cornerPromises[side] = null
    throw error
  })
  return cornerPromises[side]!
}

export const loadShenSkillDescCornerBlImage = (
  diyStore: ReturnType<typeof useDiyStore>,
  label = '技能描述',
) => loadShenSkillDescCornerImage('bl', diyStore, label)

export const loadShenSkillDescCornerBrImage = (
  diyStore: ReturnType<typeof useDiyStore>,
  label = '技能描述',
) => loadShenSkillDescCornerImage('br', diyStore, label)

export const loadShenSkillDescCornerImages = (
  diyStore: ReturnType<typeof useDiyStore>,
  label = '技能描述',
) =>
  Promise.all([
    loadShenSkillDescCornerBlImage(diyStore, label),
    loadShenSkillDescCornerBrImage(diyStore, label),
  ]).then(([bl, br]) => ({ bl, br }))

export const markShenSkillDescCornerImagesRaw = async (
  diyStore: ReturnType<typeof useDiyStore>,
  label = '技能描述',
) => {
  const { bl, br } = await loadShenSkillDescCornerImages(diyStore, label)
  return { bl: markRaw(bl), br: markRaw(br) }
}

const resolveImageAspect = (image: HTMLImageElement | undefined, fallback = SKILL_DESC_SHEN_CORNER_ASPECT) => {
  const width = image?.naturalWidth || image?.width || 0
  const height = image?.naturalHeight || image?.height || 0
  if (width <= 0 || height <= 0) return fallback
  return height / width
}

type ShenCornerLayoutRect = {
  x: number
  y: number
  width: number
  height: number
  scaleX: number
  scaleY: number
}

type CornerRectConfig = {
  boxX: number
  boxY: number
  boxHeight: number
  mmToPx: (mm: number) => number
  xMm: number
  bottomMm: number
  widthMm: number
  aspect: number
  naturalWidth: number
  naturalHeight: number
}

const resolveCornerRect = (config: CornerRectConfig): ShenCornerLayoutRect => {
  const {
    boxX,
    boxY,
    boxHeight,
    mmToPx,
    xMm,
    bottomMm,
    widthMm,
    aspect,
    naturalWidth,
    naturalHeight,
  } = config
  const width = mmToPx(widthMm)
  const height = width * aspect
  const baseW = naturalWidth > 0 ? naturalWidth : width
  const baseH = naturalHeight > 0 ? naturalHeight : height
  const bottomPx = mmToPx(bottomMm)

  return {
    x: boxX + mmToPx(xMm),
    y: boxY + boxHeight - bottomPx - height,
    width,
    height,
    scaleX: width / baseW,
    scaleY: height / baseH,
  }
}

const buildCornerRectConfig = (
  boxX: number,
  boxY: number,
  boxHeight: number,
  mmToPx: (mm: number) => number,
  xMm: number,
  bottomMm: number,
  widthMm: number,
  aspect: number,
  image?: HTMLImageElement,
): CornerRectConfig => ({
  boxX,
  boxY,
  boxHeight,
  mmToPx,
  xMm,
  bottomMm,
  widthMm,
  aspect,
  naturalWidth: image?.naturalWidth ?? 0,
  naturalHeight: image?.naturalHeight ?? 0,
})

/** 角饰布局：x/width/bottom 取自 constants（mm），高度按 SVG 原图比例 */
export const resolveShenSkillDescCornerLayout = (
  boxX: number,
  boxY: number,
  boxHeight: number,
  mmToPx: (mm: number) => number,
  cornerBlImage?: HTMLImageElement,
  cornerBrImage?: HTMLImageElement,
) => ({
  bl: resolveCornerRect(
    buildCornerRectConfig(
      boxX,
      boxY,
      boxHeight,
      mmToPx,
      SKILL_DESC_SHEN_CORNER_BL_X_MM,
      SKILL_DESC_SHEN_CORNER_BL_Y_MM,
      SKILL_DESC_SHEN_CORNER_BL_WIDTH_MM,
      resolveImageAspect(cornerBlImage),
      cornerBlImage,
    ),
  ),
  br: resolveCornerRect(
    buildCornerRectConfig(
      boxX,
      boxY,
      boxHeight,
      mmToPx,
      SKILL_DESC_SHEN_CORNER_BR_X_MM,
      SKILL_DESC_SHEN_CORNER_BR_Y_MM,
      SKILL_DESC_SHEN_CORNER_BR_WIDTH_MM,
      resolveImageAspect(cornerBrImage),
      cornerBrImage,
    ),
  ),
})
