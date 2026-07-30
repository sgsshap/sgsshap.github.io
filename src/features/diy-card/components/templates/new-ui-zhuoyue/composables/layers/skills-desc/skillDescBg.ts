import { loadKonvaImage } from '@/features/diy-card/composables'
import type { useDiyStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import { markRaw } from 'vue'
import {
  SKILL_DESC_BG_MARGIN_BOTTOM_SHEN_MM,
  SKILL_DESC_BG_MARGIN_LEFT_SHEN_MM,
  SKILL_DESC_BG_MARGIN_RIGHT_SHEN_MM,
  SKILL_DESC_BG_SAFE_TOP_SHEN_MM,
} from '../../constants/skills'
import type { SkillsAreaLayout } from '../../layout/skills-area/layout'
import { resolveShenSkillNameFrameLayout } from '../skills-name/skillNameFrame'
import { buildShenSkillDescBgSvg } from './shenSkillDescBgSvg'
import {
  resetShenSkillDescCornerImageCache,
  resolveShenSkillDescCornerLayout,
} from './shenCornerAsset'

const leftTopImageBox = (x: number, y: number, naturalWidth: number, naturalHeight: number) => ({
  x,
  y,
  offsetX: 0,
  offsetY: 0,
  width: naturalWidth,
  height: naturalHeight,
})

const snapLayoutPx = (value: number) => Math.round(value)

const skillDescShenBgImageCache = new Map<string, Promise<HTMLImageElement>>()

export const resetSkillDescShenBgImageCache = () => {
  skillDescShenBgImageCache.clear()
  resetShenSkillDescCornerImageCache()
}

/** 按背景区宽高动态生成 SVG 并加载为 Konva Image（单图，无裁剪） */
export const loadSkillDescShenBgImageForBox = (
  diyStore: ReturnType<typeof useDiyStore>,
  width: number,
  height: number,
  label = '技能描述',
) => {
  const key = `${snapLayoutPx(width)}x${snapLayoutPx(height)}`
  let pending = skillDescShenBgImageCache.get(key)
  if (!pending) {
    pending = diyStore
      .runWithLoading('skillsDesc', label, async () => {
        const svg = buildShenSkillDescBgSvg(width, height)
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
        const objectUrl = URL.createObjectURL(blob)
        try {
          return await loadKonvaImage(objectUrl)
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      })
      .catch((error) => {
        skillDescShenBgImageCache.delete(key)
        throw error
      })
    skillDescShenBgImageCache.set(key, pending)
  }
  return pending
}

export type ShenSkillDescBgBox = {
  x: number
  y: number
  width: number
  height: number
}

/** 按技能描述内容推算背景高，底边锚定技能区下缘留白 */
export const resolveShenSkillDescBgBox = (
  layout: SkillsAreaLayout,
  mmToPx: (mm: number) => number,
): ShenSkillDescBgBox => {
  const frame = resolveShenSkillNameFrameLayout(mmToPx)
  const userMarginTopPx = layout.userMarginTopPx

  let contentTop = (layout.blocks[0]?.descY ?? 0) - userMarginTopPx
  layout.blocks.forEach((block) => {
    const nameTop = block.nameY + frame.frame.y - userMarginTopPx
    contentTop = Math.min(contentTop, nameTop)
  })

  let contentBottom = layout.dividerLineY
  if (layout.quoteText && layout.quoteHeight > 0) {
    contentBottom = Math.max(contentBottom, layout.quoteY + layout.quoteHeight)
  }
  contentBottom = Math.max(contentBottom, layout.skillsEndY)

  const marginLeftPx = mmToPx(SKILL_DESC_BG_MARGIN_LEFT_SHEN_MM)
  const marginRightPx = mmToPx(SKILL_DESC_BG_MARGIN_RIGHT_SHEN_MM)
  const marginBottomPx = mmToPx(SKILL_DESC_BG_MARGIN_BOTTOM_SHEN_MM)
  const safeTopPx = mmToPx(SKILL_DESC_BG_SAFE_TOP_SHEN_MM)
  const minHeightPx = layout.minHeightPx

  const contentHeightPx = contentBottom - contentTop + safeTopPx
  const heightPx = snapLayoutPx(Math.max(minHeightPx, contentHeightPx))
  const bgBottomY = snapLayoutPx(layout.height - marginBottomPx)
  const y = bgBottomY - heightPx

  return {
    x: marginLeftPx,
    y,
    width: Math.max(0, layout.width - marginLeftPx - marginRightPx),
    height: heightPx,
  }
}

type BuildShenSkillDescBgParams = {
  image: HTMLImageElement
  cornerBlImage?: HTMLImageElement
  cornerBrImage?: HTMLImageElement
  box: ShenSkillDescBgBox
  codePrefix: string
  mmToPx: (mm: number) => number
  /** 与普通势力底框共用面板 bgOpaque（0–1） */
  bgOpaque?: number
  /** 整图 HSL 着色（自定义势力色） */
  imageTint?: Record<string, unknown>
}

const resolveImageNaturalSize = (image: HTMLImageElement) => ({
  width: image.naturalWidth || image.width,
  height: image.naturalHeight || image.height,
})

/** 神势力技能描述背景：主底图 + 左下/右下角饰 SVG */
export const buildSkillDescShenBgChildren = ({
  image,
  cornerBlImage,
  cornerBrImage,
  box,
  codePrefix,
  mmToPx,
  bgOpaque = 1,
  imageTint = {},
}: BuildShenSkillDescBgParams): CanvasItemConfig[] => {
  const { x, y, width, height } = box
  const { width: imgW, height: imgH } = resolveImageNaturalSize(image)
  if (width <= 0 || height <= 0 || imgW <= 0 || imgH <= 0) return []

  const boxX = snapLayoutPx(x)
  const boxY = snapLayoutPx(y)
  const boxW = snapLayoutPx(width)
  const boxH = snapLayoutPx(height)
  const scaleX = boxW / imgW
  const scaleY = boxH / imgH

  const children: CanvasItemConfig[] = [
    {
      code: `${codePrefix}_image`,
      name: '神技能描述背景',
      image,
      scaleX,
      scaleY,
      opacity: bgOpaque,
      listening: false,
      ...leftTopImageBox(boxX, boxY, imgW, imgH),
      ...imageTint,
    } as CanvasItemConfig,
  ]

  if (cornerBlImage && cornerBrImage) {
    const cornerLayout = resolveShenSkillDescCornerLayout(
      boxX,
      boxY,
      boxH,
      mmToPx,
      cornerBlImage,
      cornerBrImage,
    )

    const buildCornerNode = (
      suffix: 'corner_bl' | 'corner_br',
      name: string,
      cornerImage: HTMLImageElement,
      layout: ReturnType<typeof resolveShenSkillDescCornerLayout>['bl'],
    ): CanvasItemConfig => ({
      code: `${codePrefix}_${suffix}`,
      name,
      image: cornerImage,
      scaleX: layout.scaleX,
      scaleY: layout.scaleY,
      opacity: 1,
      listening: false,
      ...leftTopImageBox(
        snapLayoutPx(layout.x),
        snapLayoutPx(layout.y),
        cornerImage.naturalWidth || cornerImage.width,
        cornerImage.naturalHeight || cornerImage.height,
      ),
      ...imageTint,
    })

    children.push(
      buildCornerNode('corner_bl', '神技能描述背景左下角', cornerBlImage, cornerLayout.bl),
      buildCornerNode('corner_br', '神技能描述背景右下角', cornerBrImage, cornerLayout.br),
    )
  }

  return children
}

const tintSignature = (tint: Record<string, unknown>) =>
  `${tint.red ?? ''}:${tint.green ?? ''}:${tint.blue ?? ''}:${Array.isArray(tint.filters) ? tint.filters.length : 0}`

export const shenSkillDescBgSignature = (
  box: ShenSkillDescBgBox,
  imageTint: Record<string, unknown>,
  bgOpaque: number,
) => [box.x, box.y, box.width, box.height, bgOpaque, tintSignature(imageTint)].join('|')

export const isSkillDescShenBgImage = (config: CanvasItemConfig, codePrefix: string) =>
  Boolean(config.image) &&
  (config.code === `${codePrefix}_image` ||
    config.code === `${codePrefix}_corner_bl` ||
    config.code === `${codePrefix}_corner_br`)

const shenBgImageGeometrySignature = (config: CanvasItemConfig) => {
  if (!config.image) return ''
  return [
    config.scaleX ?? 1,
    config.scaleY ?? 1,
    config.width,
    config.height,
    config.red,
    config.green,
    config.blue,
    config.opacity ?? 1,
    Array.isArray(config.filters) ? config.filters.length : 0,
    config.image,
  ].join('|')
}

export const preserveShenBgTintedImage = (
  prev: CanvasItemConfig | undefined,
  next: CanvasItemConfig | undefined,
): { config: CanvasItemConfig | undefined; tintImageUnchanged: boolean } => {
  if (!next) return { config: undefined, tintImageUnchanged: false }
  if (!prev?.image) return { config: next, tintImageUnchanged: false }
  if (shenBgImageGeometrySignature(prev) !== shenBgImageGeometrySignature(next)) {
    return { config: next, tintImageUnchanged: false }
  }
  prev.x = next.x
  prev.y = next.y
  prev.scaleX = next.scaleX
  prev.scaleY = next.scaleY
  prev.opacity = next.opacity
  return { config: prev, tintImageUnchanged: true }
}

export const markSkillDescShenBgImageRaw = async (
  diyStore: ReturnType<typeof useDiyStore>,
  width: number,
  height: number,
  label = '技能描述',
) => markRaw(await loadSkillDescShenBgImageForBox(diyStore, width, height, label))
