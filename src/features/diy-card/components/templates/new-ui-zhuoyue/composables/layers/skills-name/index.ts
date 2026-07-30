import { loadKonvaImage, useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import {
  ensureCustomKingdomSetup,
  isShenSingleKingdomActive,
  resolveCustomKingdomColorHex,
  shouldCustomShenSkillUseKingdomColor,
} from '@/features/diy-card/composables/doubleKingdom'
import { useDiyStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  createDiyUnitConverters,
  psTrackingToLetterSpacingPx,
} from '@/features/diy-card/utils/canvas'
import Konva from 'konva'
import { markRaw } from 'vue'
import {
  SKILL_NAME_FONT_FAMILY,
  SKILL_NAME_FONT_SIZE_PT,
  SKILL_NAME_HIT_CODE,
  SKILL_NAME_TRACKING,
} from '../../constants/skills'
import { runSkillsAreaLayoutTask } from '../../layout/skills-area/areaLayoutGate'
import { loadSkillsAreaFonts, whenSkillNameFontReady } from '../../layout/skills-area/areaFonts'
import {
  computeFullFrameSkillsNameLayout,
  computeSkillsAreaLayout,
  resolveSkillDescFirstLineCenterPx,
  resolveSkillNameGroupY,
  resolveSkillNameOriginX,
  resolveSkillNameVisualCenterPx,
} from '../../layout/skills-area/layout'
import { resolveSkillDisplayName } from '@/features/diy-card/utils/ch-trans'
import {
  buildSkillFrameImageCacheKey,
  resolveSkillFrameSideKeys,
  skillFrameAssetSrc,
  skillFrameShadowSrc,
  skillFrameShenSrc,
  usesShenSkillNameFrame,
} from './frameAssets'
import { resolveSkillFrameSideTintFilters } from './skillFrameTint'
import { offsetLayer } from './skillNameStage'
import {
  resolveShenSkillNameFrameLayout,
  resolveSkillNameFrameLayout,
  resolveSkillNameTextLayoutX,
  resolveSkillNameTextLayoutY,
} from './skillNameFrame'

type FrameImages = {
  left: HTMLImageElement
  right: HTMLImageElement
  bg: HTMLImageElement
}

const skillFrameImagesCache = new Map<string, Promise<FrameImages>>()
let skillFrameShenImageCache: Promise<HTMLImageElement> | null = null
let skillFrameShadowImageCache: Promise<HTMLImageElement> | null = null

const SKILL_NAME_TEXT_COLORS = {
  shen: '#F6E945',
  default: '#000000',
  derived: '#ffffff',
} as const

const frameHeightFromWidth = (image: HTMLImageElement, widthPx: number) =>
  image.width > 0 ? widthPx * (image.height / image.width) : widthPx

/** 左上锚点定位，避免改 width 时中心锚点带动左缘偏移 */
const leftTopBox = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  offsetX: 0,
  offsetY: 0,
  width,
  height,
})

/**
 * 绘制技能名（含技能框）
 * @param canvas 画布状态
 */
export function drawSkillsName(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const getLegendInfo = () => infoStore.info as LegendInfo
  const { props, updateNode, getSelectHandlers, itemCacheMap } = canvas
  const { getFilters } = useKonvaBrightnessFilters()

  let loadGeneration = 0
  let cancelSkillNameFontWatch: (() => void) | undefined

  const load = async (_isReset: boolean = false) => {
    cancelSkillNameFontWatch?.()
    cancelSkillNameFontWatch = undefined

    const generation = ++loadGeneration
    return runSkillsAreaLayoutTask(async () => {
      if (generation !== loadGeneration) return

      const units = createDiyUnitConverters(diyStore.mmToPx)
      const info = getLegendInfo()
      ensureCustomKingdomSetup(info)
      const code = 'skillsName'
      const renderObj = info.renderConfig.items[code]
      const nameItem = info.renderConfig.items.skillsName
      const skillNameFontSizePt =
        typeof nameItem.size === 'number' && nameItem.size > 0
          ? nameItem.size
          : SKILL_NAME_FONT_SIZE_PT

      const { skillNameFontReady } = await loadSkillsAreaFonts(diyStore, info)

      if (!skillFrameShadowImageCache) {
        skillFrameShadowImageCache = diyStore.runWithLoading(code, '技能名', () =>
          loadKonvaImage(skillFrameShadowSrc()),
        )
      }
      const shadowImage = markRaw(await skillFrameShadowImageCache)
      if (generation !== loadGeneration) return

      const fullModeFlag = Boolean(info.renderConfig.display.fullModeFlag)
      const originX = resolveSkillNameOriginX(info, props, units.mmToPx)

      const fullFrameLayout = fullModeFlag
        ? await diyStore.runWithLoading(code, '技能名', () =>
            Promise.resolve(computeFullFrameSkillsNameLayout(info, props, units)),
          )
        : null
      const normalLayout = fullModeFlag
        ? null
        : await diyStore.runWithLoading(code, '技能名', () =>
            Promise.resolve(
              computeSkillsAreaLayout(info, props, units, false, diyStore.maxBleed, {
                skipAutoSizeResolve: true,
              }),
            ),
          )
      const layoutOriginY = fullFrameLayout?.originY ?? normalLayout!.originY
      const layoutHeight = fullFrameLayout?.height ?? normalLayout!.height
      const descFirstLineCenterPx = normalLayout
        ? resolveSkillDescFirstLineCenterPx(normalLayout.fontSizePx)
        : 0
      const useCustomShenSkillColor = shouldCustomShenSkillUseKingdomColor(info)
      const customShenSkillColorHex = useCustomShenSkillColor
        ? resolveCustomKingdomColorHex(info, 'single')
        : undefined
      const children: CanvasItemConfig[] = []

      const loadShenFrameImage = () => {
        if (!skillFrameShenImageCache) {
          skillFrameShenImageCache = diyStore.runWithLoading(code, '技能名', () =>
            loadKonvaImage(skillFrameShenSrc()),
          )
        }
        return skillFrameShenImageCache
      }

      const loadFrameImages = (skill: LegendInfo['baseInfo']['skills'][number]) => {
        const keys = resolveSkillFrameSideKeys(info, skill)
        const cacheKey = buildSkillFrameImageCacheKey(keys)
        if (!skillFrameImagesCache.has(cacheKey)) {
          skillFrameImagesCache.set(
            cacheKey,
            diyStore.runWithLoading(code, '技能名', async () => {
              const [left, right, bg] = await Promise.all([
                loadKonvaImage(skillFrameAssetSrc('left', keys)),
                loadKonvaImage(skillFrameAssetSrc('right', keys)),
                loadKonvaImage(skillFrameAssetSrc('bg', keys)),
              ])
              return {
                left: markRaw(left),
                right: markRaw(right),
                bg: markRaw(bg),
              }
            }),
          )
        }
        return skillFrameImagesCache.get(cacheKey)!
      }

      try {
        let frameWidthPx = 0

        for (let index = 0; index < info.baseInfo.skills.length; index++) {
          const skill = info.baseInfo.skills[index]!
          const fullFrameBlock = fullFrameLayout?.blocks[index]
          const normalBlock = normalLayout?.blocks[index]
          if (!fullFrameBlock && !normalBlock) continue

          const keys = resolveSkillFrameSideKeys(info, skill)
          const useShenFrame = usesShenSkillNameFrame(keys)
          const isShenSkill = isShenSingleKingdomActive(info) || keys.right === 'shen'
          const fontSizePt = skillNameFontSizePt
          const fontSizePx = units.ptToPx(fontSizePt)

          const textColor = skill.derivedFlag
            ? SKILL_NAME_TEXT_COLORS.derived
            : customShenSkillColorHex && isShenSkill
              ? customShenSkillColorHex
              : isShenSkill
                ? SKILL_NAME_TEXT_COLORS.shen
                : SKILL_NAME_TEXT_COLORS.default

          const tracking =
            typeof nameItem.characterSpacing === 'number'
              ? nameItem.characterSpacing
              : SKILL_NAME_TRACKING
          const letterSpacing = psTrackingToLetterSpacingPx(tracking, fontSizePx)

          const displayName = resolveSkillDisplayName(skill.name, nameItem.convertTChFlag)
          const textBase = {
            text: displayName,
            fontFamily: SKILL_NAME_FONT_FAMILY,
            fontSize: fontSizePx,
            fill: textColor,
            letterSpacing,
          }
          const measureSkillNameTextWidth = (text: string) =>
            new Konva.Text({ ...textBase, text }).width()
          const textWidth = measureSkillNameTextWidth(displayName)

          let frameChildren: CanvasItemConfig[]
          let frameLayoutWidthPx: number
          let frameHeight: number
          let nameVisualCenterPx: number

          if (useShenFrame) {
            const shenImage = markRaw(await loadShenFrameImage())
            if (generation !== loadGeneration) return

            const frame = resolveShenSkillNameFrameLayout(units.mmToPx)
            frameWidthPx = frame.groupWidthPx
            frameLayoutWidthPx = frame.groupWidthPx
            const shenFrameHeight = frameHeightFromWidth(shenImage, frame.frame.width)
            nameVisualCenterPx = resolveSkillNameVisualCenterPx([
              { y: frame.frame.y, height: shenFrameHeight },
              { y: frame.text.y, height: fontSizePx },
            ])
            frameHeight = Math.max(frame.frame.y + shenFrameHeight, frame.text.y + fontSizePx)
            const textX = resolveSkillNameTextLayoutX(
              frame.text.x,
              displayName,
              textWidth,
              measureSkillNameTextWidth,
            )
            frameChildren = [
              {
                code: `${code}_shen_${index}`,
                name: '神技能框',
                image: shenImage,
                scaleX: frame.frame.width / shenImage.width,
                scaleY: shenFrameHeight / shenImage.height,
                originX: frame.frame.x,
                originY: frame.frame.y,
                ...leftTopBox(frame.frame.x, frame.frame.y, frame.frame.width, shenFrameHeight),
                listening: false,
              },
              {
                code: `${code}_text_${index}`,
                name: `技能名_${index + 1}`,
                ...textBase,
                originX: textX,
                originY: frame.text.y,
                stroke: textColor,
                strokeWidth: 0.15,
                ...leftTopBox(textX, frame.text.y, textWidth, fontSizePx),
                loadFunc: itemCacheMap.value?.[code]?.loadFunc,
              },
            ] as CanvasItemConfig[]
          } else {
            const images = await loadFrameImages(skill)
            if (generation !== loadGeneration) return

            const { left: leftTint, right: rightTint } = resolveSkillFrameSideTintFilters(
              info,
              skill,
              getFilters,
            )
            const frame = resolveSkillNameFrameLayout(units.mmToPx)
            frameWidthPx = frame.groupWidthPx
            frameLayoutWidthPx = frame.groupWidthPx

            const leftHeight = frameHeightFromWidth(images.left, frame.left.width)
            const bgHeight = frameHeightFromWidth(images.bg, frame.bg.width)
            const rightHeight = frameHeightFromWidth(images.right, frame.right.width)
            const shadowHeight = frameHeightFromWidth(shadowImage, frame.shadow.width)
            nameVisualCenterPx = resolveSkillNameVisualCenterPx([
              { y: frame.left.y, height: leftHeight },
              { y: frame.bg.y, height: bgHeight },
              { y: frame.right.y, height: rightHeight },
              { y: frame.text.y, height: fontSizePx },
            ])
            frameHeight = Math.max(
              frame.shadow.y + shadowHeight,
              frame.left.y + leftHeight,
              frame.bg.y + bgHeight,
              frame.right.y + rightHeight,
              frame.text.y + fontSizePx,
            )
            const textX = resolveSkillNameTextLayoutX(
              frame.text.x,
              displayName,
              textWidth,
              measureSkillNameTextWidth,
            )
            const textY = resolveSkillNameTextLayoutY(
              frame.text.y,
              Boolean(skill.derivedFlag),
              units.mmToPx,
            )
            frameChildren = [
              {
                code: `${code}_shadow_${index}`,
                name: '技能框投影',
                image: shadowImage,
                scaleX: frame.shadow.width / shadowImage.width,
                scaleY: shadowHeight / shadowImage.height,
                originX: frame.shadow.x,
                originY: frame.shadow.y,
                ...leftTopBox(frame.shadow.x, frame.shadow.y, frame.shadow.width, shadowHeight),
                listening: false,
              },
              {
                code: `${code}_bg_${index}`,
                name: '技能框底',
                image: images.bg,
                scaleX: frame.bg.width / images.bg.width,
                scaleY: bgHeight / images.bg.height,
                originX: frame.bg.x,
                originY: frame.bg.y,
                ...leftTopBox(frame.bg.x, frame.bg.y, frame.bg.width, bgHeight),
                listening: false,
              },
              {
                code: `${code}_right_${index}`,
                name: `${code}_right_${index}`,
                image: images.right,
                scaleX: frame.right.width / images.right.width,
                scaleY: rightHeight / images.right.height,
                originX: frame.right.x,
                originY: frame.right.y,
                listening: false,
                ...leftTopBox(frame.right.x, frame.right.y, frame.right.width, rightHeight),
                ...rightTint,
              },
              {
                code: `${code}_left_${index}`,
                name: `${code}_left_${index}`,
                image: images.left,
                scaleX: frame.left.width / images.left.width,
                scaleY: leftHeight / images.left.height,
                originX: frame.left.x,
                originY: frame.left.y,
                listening: false,
                ...leftTopBox(frame.left.x, frame.left.y, frame.left.width, leftHeight),
                ...leftTint,
              },
              {
                code: `${code}_text_${index}`,
                name: `技能名_${index + 1}`,
                ...textBase,
                originX: textX,
                originY: textY,
                stroke: textColor,
                strokeWidth: 0.15,
                ...leftTopBox(textX, textY, textWidth, fontSizePx),
                loadFunc: itemCacheMap.value?.[code]?.loadFunc,
              },
            ] as CanvasItemConfig[]
          }

          const groupY = fullFrameBlock
            ? fullFrameBlock.nameY
            : resolveSkillNameGroupY(
                info,
                normalBlock!.descY,
                descFirstLineCenterPx,
                nameVisualCenterPx,
                units.mmToPx,
              )

          for (const layer of frameChildren) {
            children.push(offsetLayer(layer, 0, groupY))
          }
        }

        children.unshift({
          code: SKILL_NAME_HIT_CODE,
          name: '技能名热区',
          fill: 'rgba(0,0,0,0.001)',
          listening: true,
          ...leftTopBox(0, 0, frameWidthPx, layoutHeight),
        } as CanvasItemConfig)

        const groupConfig = {
          code,
          name: '技能名',
          originX,
          originY: layoutOriginY,
          rotation: 0,
          children,
          listening: true,
          ...leftTopBox(originX, layoutOriginY, frameWidthPx, layoutHeight),
          ...getSelectHandlers(),
          loadFunc: itemCacheMap.value?.[code]?.loadFunc,
        } as CanvasItemConfig

        if (generation !== loadGeneration) return
        updateNode(renderObj, groupConfig, true)

        if (!skillNameFontReady && generation === loadGeneration) {
          cancelSkillNameFontWatch = whenSkillNameFontReady(() => {
            itemCacheMap.value?.[code]?.loadFunc?.()
          })
        }
      } catch (error) {
        console.error('[skillsName] load failed', error)
      }
    }, { diyStore, label: '技能名' })
  }

  return load
}
