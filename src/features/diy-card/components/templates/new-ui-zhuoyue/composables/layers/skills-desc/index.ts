import { useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import {
  ensureCustomKingdomSetup,
  shouldCustomShenSkillUseKingdomColor,
  usesShenCardLayout
} from '@/features/diy-card/composables/doubleKingdom'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore, useInfoStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { createDiyUnitConverters, getPosition } from '@/features/diy-card/utils/canvas'
import { markRaw } from 'vue'
import { SKILL_DESC_HIT_CODE } from '../../constants/skills'
import { useKingdomTint } from '../../filters/useKingdomTint'
import { loadSkillsAreaFonts } from '../../layout/skills-area/areaFonts'
import { runSkillsAreaLayoutTask } from '../../layout/skills-area/areaLayoutGate'
import {
  computeSkillsAreaLayout,
  publishSkillsAreaLayout,
  resolveSkillDescBackgroundColor,
  resolveSkillDescBackgroundOpaque,
  setSkillDescDividerLineNaturalSize
} from '../../layout/skills-area/layout'
import { resolveSkillDescFontFamily, resolveSkillDescRawFromItem } from './formatDesc'
import { loadSkillDescLineImage } from './lineAsset'
import { buildQuoteTextChildren } from './quoteLines'
import { layoutSkillDescRichText } from './richText'
import { markShenSkillDescCornerImagesRaw } from './shenCornerAsset'
import {
  buildSkillDescShenBgChildren,
  isSkillDescShenBgImage,
  loadSkillDescShenBgImageForBox,
  preserveShenBgTintedImage,
  resolveShenSkillDescBgBox,
  shenSkillDescBgSignature,
} from './skillDescBg'

/**
 * 绘制技能描述与引言
 * @param canvas 画布状态
 */
export function drawSkillsDesc(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const getLegendInfo = () => infoStore.info as LegendInfo
  const { props, updateNode, getDragger, getSelectHandlers, itemCacheMap, canvasConfigs } = canvas
  const { getFilters } = useKonvaBrightnessFilters()

  let loadGeneration = 0
  let lastShenBgSignature: string | null = null
  let lastSkillCount: number | null = null

  const load = async (isReset: boolean = false) => {
    const generation = ++loadGeneration
    if (isReset) {
      lastShenBgSignature = null
      lastSkillCount = null
    }
    return runSkillsAreaLayoutTask(async () => {
      if (generation !== loadGeneration) return

      try {
      const units = createDiyUnitConverters(diyStore.mmToPx)
      const info = getLegendInfo()
      ensureCustomKingdomSetup(info)
      const code = 'skillsDesc'
      const renderObj = info.renderConfig.items[code]

      if (info.renderConfig.display.fullModeFlag) {
        updateNode(
          renderObj,
          {
            code,
            name: '技能描述',
            children: [],
            listening: false,
          } as CanvasItemConfig,
          true,
        )
        return
      }

      const shenLayout = usesShenCardLayout(info)
      await loadSkillsAreaFonts(diyStore, info, { includeSkillName: false })
      let lineImage: HTMLImageElement | null = null
      if (!shenLayout) {
        lineImage = await loadSkillDescLineImage(diyStore, '技能描述')
        if (generation !== loadGeneration) return
        setSkillDescDividerLineNaturalSize(lineImage.width, lineImage.height)
      }

      /** 仅「从零开始」reload(true) 时恢复排版默认；resetOnLoadAll 的 isReset 只刷新节点 */
      const resetTypographyDefaults = isReset && diyStore.reloadResetFlag
      const layout = await diyStore.runWithLoading(code, '技能描述', () =>
        Promise.resolve(
          computeSkillsAreaLayout(info, props, units, resetTypographyDefaults, diyStore.maxBleed),
        ),
      )
      if (generation !== loadGeneration) return
      publishSkillsAreaLayout(layout)
      const children: CanvasItemConfig[] = []
      let refreshFilterCache = true
      let useCustomShenSkillColor = false
      const skillCount = info.baseInfo.skills.length
      const skillCountChanged = lastSkillCount !== null && lastSkillCount !== skillCount
      lastSkillCount = skillCount

      if (shenLayout) {
        useCustomShenSkillColor = shouldCustomShenSkillUseKingdomColor(info)
        const { getFrameBorderColorFilters } = useKingdomTint(info, getFilters)
        const shenBgTint = useCustomShenSkillColor ? getFrameBorderColorFilters('single') : {}
        const shenBgOpaque = resolveSkillDescBackgroundOpaque(info)
        const bgBox = resolveShenSkillDescBgBox(layout, units.mmToPx)
        const shenBgImage = markRaw(
          await loadSkillDescShenBgImageForBox(diyStore, bgBox.width, bgBox.height, '技能描述'),
        )
        const { bl: cornerBlImage, br: cornerBrImage } = await markShenSkillDescCornerImagesRaw(
          diyStore,
          '技能描述',
        )
        if (generation !== loadGeneration) return

        const bgCodePrefix = `${code}_shen_bg`
        const bgSignature = shenSkillDescBgSignature(bgBox, shenBgTint, shenBgOpaque)

        const buildShenBgChildren = () =>
          buildSkillDescShenBgChildren({
            image: shenBgImage,
            cornerBlImage,
            cornerBrImage,
            box: bgBox,
            codePrefix: bgCodePrefix,
            mmToPx: units.mmToPx,
            bgOpaque: shenBgOpaque,
            imageTint: shenBgTint,
          })

        const collectPrevShenBgChildren = (prevChildren: CanvasItemConfig[]) =>
          prevChildren.filter((child) => isSkillDescShenBgImage(child, bgCodePrefix))

        if (isReset) {
          children.push(...buildShenBgChildren())
          lastShenBgSignature = bgSignature
          refreshFilterCache = true
        } else {
          const prevChildren = canvasConfigs[code]?.children ?? []
          const prevShenBgChildren = collectPrevShenBgChildren(prevChildren)

          if (bgSignature === lastShenBgSignature && prevShenBgChildren.length > 0 && !skillCountChanged) {
            children.push(...prevShenBgChildren)
            refreshFilterCache = false
          } else {
            const builtChildren = buildShenBgChildren()
            for (const builtChild of builtChildren) {
              const prevChild = prevShenBgChildren.find((child) => child.code === builtChild.code)
              if (prevChild) {
                const preserved = preserveShenBgTintedImage(prevChild, builtChild)
                if (preserved.config) children.push(preserved.config)
                if (!preserved.tintImageUnchanged) refreshFilterCache = true
              } else {
                children.push(builtChild)
                refreshFilterCache = true
              }
            }
            lastShenBgSignature = bgSignature
          }
        }
      } else if (!shenLayout) {
        const bgTopInsetPx = layout.userMarginTopPx
        children.push({
          code: `${code}_bg`,
          name: '技能描述底',
          fill: resolveSkillDescBackgroundColor(info),
          width: layout.bgWidth,
          height: layout.bgHeight + bgTopInsetPx,
          ...getPosition(layout.bgOffsetX, -bgTopInsetPx, layout.bgWidth, layout.bgHeight + bgTopInsetPx),
          listening: false,
        } as CanvasItemConfig)
      }

      info.baseInfo.skills.forEach((skill, index) => {
        const block = layout.blocks[index]
        if (!block) return
        const fontFamily = resolveSkillDescFontFamily(skill, info)
        const rich = layoutSkillDescRichText({
          raw: resolveSkillDescRawFromItem(skill.desc ?? '', renderObj),
          fontSizePx: layout.fontSizePx,
          fontFamily,
          widthPx: layout.textWidthPx,
          lineHeight: layout.lineHeight,
          letterSpacingPx: layout.letterSpacingPx,
          codePrefix: `${code}_text_${index}`,
          derivedSkillFlag: Boolean(skill.derivedFlag),
          newFontFlag: Boolean(renderObj.newFontFlag),
          textBoldFlag: Boolean(renderObj.textBoldFlag),
        })
        for (const segment of rich.items) {
          children.push({
            ...segment,
            x: (segment.x ?? 0) + layout.textInsetPx,
            y: (segment.y ?? 0) + block.descY,
          } as CanvasItemConfig)
        }
      })

      children.push(
        ...buildQuoteTextChildren({
          codePrefix: code,
          quoteText: layout.quoteText,
          quoteX: layout.quoteX,
          quoteY: layout.quoteY,
          quoteWidthPx: layout.quoteWidthPx,
          quoteFontSizePx: layout.quoteFontSizePx,
          quoteLetterSpacingPx: layout.quoteLetterSpacingPx,
        }),
      )

      if (!shenLayout && lineImage) {
        const lineScale = layout.dividerLineWidthPx / lineImage.width
        children.push({
          code: `${code}_line`,
          name: '技能区分隔线',
          image: markRaw(lineImage),
          scaleX: lineScale,
          scaleY: lineScale,
          ...getPosition(
            layout.dividerLineX,
            layout.dividerLineY,
            layout.dividerLineWidthPx,
            layout.dividerLineHeightPx,
          ),
          listening: false,
        } as CanvasItemConfig)
      }

      children.push({
        code: SKILL_DESC_HIT_CODE,
        name: '技能描述热区',
        width: layout.width,
        height: layout.skillsDescHitHeight,
        fill: 'rgba(0,0,0,0.001)',
        listening: true,
        ...getPosition(0, 0, layout.width, layout.skillsDescHitHeight),
      } as CanvasItemConfig)

      const groupConfig = {
        code,
        name: '技能描述',
        width: layout.width,
        height: layout.height,
        originX: layout.originX,
        originY: layout.originY,
        rotation: 0,
        listening: true,
        children,
        ...getPosition(layout.originX, layout.originY, layout.width, layout.height),
        ...getDragger(renderObj, code),
        ...getSelectHandlers(),
        loadFunc: itemCacheMap.value?.[code]?.loadFunc,
      } as CanvasItemConfig

      // 技能区底锚定布局，每次重绘都写回位置（避免 mergeConfig 沿用旧 y/缩放）
      updateNode(renderObj, groupConfig, true, { refreshFilterCache })
      } catch (error) {
        console.error('[skillsDesc] load failed', error)
      }
    }, { diyStore, label: '技能描述' })
  }

  return load
}
