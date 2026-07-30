import { loadKonvaImage, useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import { resolveStageContentOriginFromDiy } from '@/features/diy-card/composables/konva/konvaStageEdgeSnap'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import type { TemplateProps } from '@/features/diy-card/composables/template/types'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { resolveHideOutOfFrameSkillOverlap, resolveOutOfFrameConfig, resolveOutOfFrameIndependentLayout, resolveOutOfFrameLayoutItem } from '@/features/diy-card/types/diy/outOfFrame'
import { applyLayoutFromRenderObj, getPosition, hasLegendOutOfFramePersistedLayout, isLayoutAspectMatchingNatural, resetLegendOutOfFrameLayoutToCoverPx } from '@/features/diy-card/utils/canvas'
import {
  computeCoverFitLayout,
  resolveLegendImageCoverInsetLeftPx,
} from '@/features/diy-card/utils/outOfFrame/coverCrop'
import {
  applyLinkedOutOfFrameLayoutFromLegendImage,
  resolveLinkedOutOfFrameDisplaySizePx,
} from '@/features/diy-card/utils/outOfFrame/linkedLegendOutOfFrameLayout'
import {
  compositeFullWithMask,
  resolveOutOfFrameOutputSize,
} from '@/features/diy-card/utils/outOfFrame/composite'
import {
  applyOutOfFrameSkillOverlapHoles,
  isPointInSkillDescPassThroughZone,
} from '@/features/diy-card/utils/outOfFrame/skillFrameMask'
import { loadSkillsAreaFonts } from '../../layout/skills-area/areaFonts'
import { useDiyStore } from '@/features/diy-card/stores'
import { markRaw } from 'vue'
import type Konva from 'konva'

type CleanCompositeEntry = {
  key: string
  pic: string
  mask: string
  stageWidth: number
  stageHeight: number
  insetLeftPx: number
  naturalWidth: number
  naturalHeight: number
  finalWidth: number
  finalHeight: number
  canvas: HTMLCanvasElement
}

let cleanOutOfFrameComposite: CleanCompositeEntry | null = null
let legendOutOfFrameLoadTask: Promise<void> | null = null
let legendOutOfFrameLoadGeneration = 0

export const invalidateLegendOutOfFrameComposite = () => {
  cleanOutOfFrameComposite = null
}

export const isLegendOutOfFrameLoadInFlight = () => legendOutOfFrameLoadTask !== null

const buildCompositeCacheKey = (
  pic: string,
  mask: string,
  outputW: number,
  outputH: number,
) => `${pic}\0${mask}\0${outputW}x${outputH}`

const cloneCanvas = (source: HTMLCanvasElement) => {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法复制出框合成图')
  ctx.drawImage(source, 0, 0)
  return canvas
}

const bakeOutOfFrameDisplayImage = (
  compositedClean: HTMLCanvasElement,
  info: LegendInfo,
  props: TemplateProps,
  config: CanvasItemConfig,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const display = cloneCanvas(compositedClean)
  if (resolveHideOutOfFrameSkillOverlap(info.renderConfig.items.legendImage)) {
    applyOutOfFrameSkillOverlapHoles(display, info, props, config, mmToPx, maxBleedPx)
  }
  return display
}

const applyOutOfFrameDisplayImage = (
  info: LegendInfo,
  props: TemplateProps,
  config: CanvasItemConfig,
  mmToPx: number,
  maxBleedPx: number,
) => {
  if (!cleanOutOfFrameComposite) return
  if (!config.sourceNaturalWidth || !config.sourceNaturalHeight) {
    config.sourceNaturalWidth = cleanOutOfFrameComposite.naturalWidth
    config.sourceNaturalHeight = cleanOutOfFrameComposite.naturalHeight
  }
  config.image = markRaw(
    bakeOutOfFrameDisplayImage(
      cleanOutOfFrameComposite.canvas,
      info,
      props,
      config,
      mmToPx,
      maxBleedPx,
    ),
  )
  delete config.clipFunc
}

const wrapLegendOutOfFrameSelectHandlers = (
  handlers: ReturnType<TemplateCanvasState['getSelectHandlers']>,
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
) => {
  if (!resolveHideOutOfFrameSkillOverlap(info.renderConfig.items.legendImage)) {
    return handlers
  }
  const diyStore = useDiyStore()
  const onClick = handlers.onClick as (e: Konva.KonvaEventObject<Event>) => void
  const onTap = handlers.onTap as (e: Konva.KonvaEventObject<Event>) => void
  const redirectIfPassThrough = (
    e: Konva.KonvaEventObject<Event>,
    forward: (event: Konva.KonvaEventObject<Event>) => void,
  ) => {
    const pos = e.target.getStage()?.getPointerPosition()
    if (
      pos &&
      isPointInSkillDescPassThroughZone(pos.x, pos.y, info, props, mmToPx, maxBleedPx)
    ) {
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        active.blur()
      }
      diyStore.setSelectedItemValue('skillsDesc')
      return
    }
    forward(e)
  }
  return {
    onClick: (e: Konva.KonvaEventObject<Event>) => redirectIfPassThrough(e, onClick),
    onTap: (e: Konva.KonvaEventObject<Event>) => redirectIfPassThrough(e, onTap),
  }
}

/** 布局变更后按当前位置重算技能区挖洞并写回节点 image */
export const refreshLegendOutOfFrameDisplayImage = (
  config: CanvasItemConfig,
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
) => {
  if (!cleanOutOfFrameComposite) return false
  applyOutOfFrameDisplayImage(info, props, config, mmToPx, maxBleedPx)
  return true
}

/** 原画拖拽/缩放后同步出框位置与技能区挖洞，避免重跑抠图合成 */
export const syncLegendOutOfFrameWithLegendImage = (
  canvasConfigs: Record<string, CanvasItemConfig>,
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const outOfFrame = resolveOutOfFrameConfig(info.renderConfig.outOfFrame)
  if (!outOfFrame.enabled || !outOfFrame.maskDataUrl) return false
  if (resolveOutOfFrameIndependentLayout(info.renderConfig.items.legendImage)) return false

  const code = 'legendOutOfFrame'
  const existing = canvasConfigs[code]
  if (!existing) return false

  const layoutRender = resolveOutOfFrameLayoutItem(info)
  const config = { ...existing } as CanvasItemConfig
  const legendImageConfig = canvasConfigs.legendImage
  if (
    !applyLinkedOutOfFrameLayoutFromLegendImage(config, legendImageConfig)
  ) {
    applyLayoutFromRenderObj(
      layoutRender,
      config,
      resolveStageContentOriginFromDiy(useDiyStore()),
      mmToPx,
    )
  }
  if (cleanOutOfFrameComposite) {
    applyOutOfFrameDisplayImage(info, props, config, mmToPx, maxBleedPx)
  }
  canvasConfigs[code] = config
  return true
}

export const hasLegendOutOfFrameComposite = () => cleanOutOfFrameComposite !== null

/**
 * 技能区布局/字体就绪后重算出框重叠挖洞。
 * 首屏 loadAll 并行时 legendOutOfFrame 可能早于 skillsDesc 完成测高，需在 bootstrap 后再刷一次。
 */
export const refreshLegendOutOfFrameSkillOverlapHoles = async (
  canvasConfigs: Record<string, CanvasItemConfig>,
  info: LegendInfo,
  props: TemplateProps,
  mmToPx: number,
  maxBleedPx: number,
) => {
  const outOfFrame = resolveOutOfFrameConfig(info.renderConfig.outOfFrame)
  if (!outOfFrame.enabled || !outOfFrame.maskDataUrl || !cleanOutOfFrameComposite) return false

  await loadSkillsAreaFonts(useDiyStore(), info, { includeSkillName: false })

  if (!resolveOutOfFrameIndependentLayout(info.renderConfig.items.legendImage)) {
    return syncLegendOutOfFrameWithLegendImage(
      canvasConfigs,
      info,
      props,
      mmToPx,
      maxBleedPx,
    )
  }

  const code = 'legendOutOfFrame'
  const existing = canvasConfigs[code]
  if (!existing) return false

  const layoutRender = resolveOutOfFrameLayoutItem(info)
  const config = { ...existing } as CanvasItemConfig
  applyLayoutFromRenderObj(
    layoutRender,
    config,
    resolveStageContentOriginFromDiy(useDiyStore()),
    mmToPx,
  )
  applyOutOfFrameDisplayImage(info, props, config, mmToPx, maxBleedPx)
  canvasConfigs[code] = config
  return true
}

/**
 * 人物出框图层：原画 × 蒙版；默认布局与 legendImage 同步，独立模式可单独拖拽
 */
export function drawLegendOutOfFrame(canvas: TemplateCanvasState) {
  const { info, props, updateNode, getDragger, getSelectHandlers, itemCacheMap } = canvas
  const diyStore = useDiyStore()
  const { getFilters } = useKonvaBrightnessFilters()
  const contentOrigin = resolveStageContentOriginFromDiy(diyStore)
  const independent = () =>
    resolveOutOfFrameIndependentLayout(info.renderConfig.items.legendImage)

  const load = async (isReset: boolean = false) => {
    const code = 'legendOutOfFrame'
    const outOfFrame = resolveOutOfFrameConfig(info.renderConfig.outOfFrame)
    if (!outOfFrame.enabled || !outOfFrame.maskDataUrl) {
      legendOutOfFrameLoadGeneration += 1
      cleanOutOfFrameComposite = null
      canvas.canvasConfigs[code] = { code, name: '人物出框' }
      return
    }

    const needsInteraction = independent()
    const layoutRender = resolveOutOfFrameLayoutItem(info)
    const pic = info.baseInfo.pic
    if (!pic) return

    const loadGeneration = ++legendOutOfFrameLoadGeneration
    const mask = outOfFrame.maskDataUrl
    const insetLeftPx = resolveLegendImageCoverInsetLeftPx(
      info,
      props.stageOrigin.x,
      diyStore.mmToPx,
    )
    const canReuseComposite =
      cleanOutOfFrameComposite !== null &&
      cleanOutOfFrameComposite.pic === pic &&
      cleanOutOfFrameComposite.mask === mask &&
      cleanOutOfFrameComposite.stageWidth === props.stageWidth &&
      cleanOutOfFrameComposite.stageHeight === props.stageHeight &&
      cleanOutOfFrameComposite.insetLeftPx === insetLeftPx

    const runLoad = async () => {
      let natW: number
      let natH: number

      if (canReuseComposite && cleanOutOfFrameComposite) {
        natW = cleanOutOfFrameComposite.naturalWidth
        natH = cleanOutOfFrameComposite.naturalHeight
      } else {
        const sourceImage = await loadKonvaImage(pic, { priority: 'high' })
        natW = sourceImage.naturalWidth
        natH = sourceImage.naturalHeight
      }

      const legendImageConfig = canvas.canvasConfigs.legendImage
      const coverForComposite = computeCoverFitLayout(
        props.stageWidth,
        props.stageHeight,
        natW,
        natH,
        insetLeftPx,
      )
      const displaySizeFromLegend =
        !needsInteraction && legendImageConfig
          ? resolveLinkedOutOfFrameDisplaySizePx(legendImageConfig)
          : { width: 0, height: 0 }
      const compositeWidth =
        displaySizeFromLegend.width > 0
          ? displaySizeFromLegend.width
          : coverForComposite.displayWidth
      const compositeHeight =
        displaySizeFromLegend.height > 0
          ? displaySizeFromLegend.height
          : coverForComposite.displayHeight

      if (!canReuseComposite) {
        const { width: outputW, height: outputH } = resolveOutOfFrameOutputSize(
          natW,
          natH,
          compositeWidth,
          compositeHeight,
        )
        const cacheKey = buildCompositeCacheKey(pic, mask, outputW, outputH)
        if (!cleanOutOfFrameComposite || cleanOutOfFrameComposite.key !== cacheKey) {
          const composited = await compositeFullWithMask(pic, mask, outputW, outputH)
          cleanOutOfFrameComposite = {
            key: cacheKey,
            pic,
            mask,
            stageWidth: props.stageWidth,
            stageHeight: props.stageHeight,
            insetLeftPx,
            naturalWidth: natW,
            naturalHeight: natH,
            finalWidth: compositeWidth,
            finalHeight: compositeHeight,
            canvas: cloneCanvas(composited),
          }
        }
      }

      if (!needsInteraction && legendImageConfig) {
        const config: CanvasItemConfig = {
          code,
          name: '人物出框',
          sourceNaturalWidth: natW,
          sourceNaturalHeight: natH,
          image: markRaw(document.createElement('canvas')),
          ...getFilters(),
          listening: false,
          loadFunc: itemCacheMap.value?.[code]?.loadFunc,
        }
        if (applyLinkedOutOfFrameLayoutFromLegendImage(config, legendImageConfig)) {
          applyOutOfFrameDisplayImage(
            info,
            props,
            config,
            diyStore.mmToPx,
            diyStore.maxBleed,
          )
          if (loadGeneration !== legendOutOfFrameLoadGeneration) return
          updateNode(info.renderConfig.items.legendImage, config, false, { skipLayoutMerge: true })
          return
        }
      }

      const {
        displayWidth: finalWidth,
        displayHeight: finalHeight,
        x,
        y,
      } = coverForComposite

      const existingConfig = canvas.canvasConfigs[code]
      const sourcePicMatches =
        !outOfFrame.sourcePic || outOfFrame.sourcePic === pic
      const layoutMatchesNewPic =
        layoutRender.code === 'legendOutOfFrame' &&
        isLayoutAspectMatchingNatural(layoutRender, natW, natH)
      const forceCoverLayout =
        isReset ||
        !sourcePicMatches ||
        !layoutMatchesNewPic ||
        !hasLegendOutOfFramePersistedLayout(layoutRender)
      const preserveIndependentLayout =
        needsInteraction &&
        !forceCoverLayout &&
        existingConfig &&
        typeof existingConfig.width === 'number' &&
        existingConfig.width > 0 &&
        hasLegendOutOfFramePersistedLayout(layoutRender) &&
        layoutMatchesNewPic &&
        sourcePicMatches

      if (
        layoutRender.code === 'legendOutOfFrame' &&
        forceCoverLayout &&
        !preserveIndependentLayout
      ) {
        resetLegendOutOfFrameLayoutToCoverPx(
          layoutRender,
          finalWidth,
          finalHeight,
          x,
          y,
          contentOrigin,
          diyStore.mmToPx,
        )
      }

      const config: CanvasItemConfig = preserveIndependentLayout
        ? {
            ...existingConfig,
            code,
            name: '人物出框',
            sourceNaturalWidth: natW,
            sourceNaturalHeight: natH,
            listening: needsInteraction,
            loadFunc: itemCacheMap.value?.[code]?.loadFunc,
          }
        : {
            code,
            name: '人物出框',
            width: finalWidth,
            height: finalHeight,
            sourceNaturalWidth: natW,
            sourceNaturalHeight: natH,
            image: markRaw(document.createElement('canvas')),
            rotation: 0,
            originX: x,
            originY: y,
            ...getPosition(x, y, finalWidth, finalHeight),
            ...getFilters(),
            listening: needsInteraction,
            loadFunc: itemCacheMap.value?.[code]?.loadFunc,
          }

      if (needsInteraction) {
        Object.assign(
          config,
          getDragger(layoutRender, code),
          wrapLegendOutOfFrameSelectHandlers(
            getSelectHandlers(),
            info,
            props,
            diyStore.mmToPx,
            diyStore.maxBleed,
          ),
        )
      }

      applyLayoutFromRenderObj(layoutRender, config, contentOrigin, diyStore.mmToPx)
      applyOutOfFrameDisplayImage(
        info,
        props,
        config,
        diyStore.mmToPx,
        diyStore.maxBleed,
      )

      if (loadGeneration !== legendOutOfFrameLoadGeneration) return

      if (needsInteraction) {
        updateNode(layoutRender, config, forceCoverLayout)
        return
      }
      updateNode(info.renderConfig.items.legendImage, config, false, { skipLayoutMerge: true })
    }

    const previousLoadTask = legendOutOfFrameLoadTask
    const loadTask = (async () => {
      try {
        if (previousLoadTask) {
          await previousLoadTask.catch(() => undefined)
          if (loadGeneration !== legendOutOfFrameLoadGeneration) return
        }
        if (canReuseComposite) {
          await runLoad()
          return
        }
        await diyStore.runWithLoading(code, '人物出框', runLoad)
      } catch (error) {
        console.error('[legendOutOfFrame] load failed', error)
      }
    })()

    legendOutOfFrameLoadTask = loadTask
    try {
      await loadTask
    } finally {
      if (legendOutOfFrameLoadTask === loadTask) {
        legendOutOfFrameLoadTask = null
      }
    }
  }

  return load
}
