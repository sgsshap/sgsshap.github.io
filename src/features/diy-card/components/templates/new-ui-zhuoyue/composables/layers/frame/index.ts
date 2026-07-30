import {
  createTrackedKonvaImageLoader,
  loadKonvaImage,
  useKonvaBrightnessFilters,
} from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  calculateFitSize,
  createDiyUnitConverters,
  getPosition,
} from '@/features/diy-card/utils/canvas'
import { markRaw } from 'vue'
import { TEMPLATE_ASSET_BASE } from '../../constants/common'
import {
  FRAME_MASTER_MM,
  FRAME_SHEN_DISPLAY_WIDTH_PX,
  FRAME_SHEN_GROUP_X_MM,
  resolveFrameKingdomFrameLayout,
} from '../../constants/frame'
import {
  isCustomKingdomActive,
  isDoubleKingdomSingleGlyphMode,
  isMasterFlagActive,
  isShenSingleKingdomActive,
  resolveDoubleKingdomPair,
  resolveDoubleKingdomSingleGlyphColorSlot,
  type DoubleKingdomPair,
} from '@/features/diy-card/composables/doubleKingdom'
import {
  resolveFrameBaseAssetKey,
  resolveKingdomFrameStripAssetKey,
  syncFrameSrcToKingdom,
  usesShenFrameLayout,
} from '@/features/diy-card/utils/syncFrameKingdom'
import {
  resolveCardTextLayoutKey,
  shouldForceResetFrameLayout,
} from '../../layout/cardTextLayout'
import { useKingdomTint } from '../../filters'

type FrameImage = { width: number; height: number }
type KingdomFrameImages = { left: FrameImage; right: FrameImage }
type FrameBaseImages = { full: FrameImage; half: FrameImage | null }

/**
 * 绘制边框
 * @param canvas 画布状态
 */
export function drawFrame(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const { info, props, updateNode, getDragger, getSelectHandlers, itemCacheMap } = canvas
  const units = createDiyUnitConverters(diyStore.mmToPx)
  const loadTrackedImage = createTrackedKonvaImageLoader(diyStore)
  const { getFilters } = useKonvaBrightnessFilters()
  const {
    getFrameBorderColorFilters,
    getTemplateAssetKingdom,
    useDualCustomKingdomColor,
    resolveKingdomFrameStripTintFilters,
    shouldTintShenFrameLayout,
  } = useKingdomTint(info, getFilters)

  let frameLoadGeneration = 0

  const frameAssetSrc = (tier: 'full' | 'half', assetKey: string) =>
    `${TEMPLATE_ASSET_BASE}/assets/frame/${tier}/${assetKey}.png`

  const loadFrameTierImage = (slot: 'full' | 'half', assetKey: string) =>
    loadKonvaImage(frameAssetSrc(slot, assetKey))

  const kingdomFrameAssetSrc = (side: 'left' | 'right', assetKey: string) =>
    `${TEMPLATE_ASSET_BASE}/assets/kingdom-frame/${side}/${assetKey}.png`

  /** 加载入口；isReset=false 为增量重绘，true 为全量 reload（须完全依据当前 info，禁止复用旧子树） */
  const load = async (isReset: boolean = false) => {
    const generation = ++frameLoadGeneration
    syncFrameSrcToKingdom(info)
    const code = 'frame'
    const name = '边框'
    const renderObj = info.renderConfig.items[code]
    const masterFlag = isMasterFlagActive(info)
    const isShenHero = isShenSingleKingdomActive(info)
    const doublePair = !isShenHero && !masterFlag ? resolveDoubleKingdomPair(info) : null
    const singleGlyphKingdom = isDoubleKingdomSingleGlyphMode(info)
    /** 双势力叠层与神框布局互斥：位置/尺寸/着色均按普通框（wei 基准） */
    const shenFrameLayout = doublePair ? false : usesShenFrameLayout(info, renderObj.src)

    try {
      const { frameBaseImages, kingdomFrameImages } = await loadImageObjs(
        code,
        name,
        renderObj.src,
        shenFrameLayout,
        masterFlag,
        doublePair,
        singleGlyphKingdom,
      )
      if (generation !== frameLoadGeneration) return

      const groupRect = calcGroupRect(frameBaseImages, shenFrameLayout)
      const dualTint = Boolean(doublePair && useDualCustomKingdomColor())
      const baseFilters = getFilters()
      const primaryTint = getFrameBorderColorFilters('primary')
      const secondaryTint = getFrameBorderColorFilters('secondary')
      const nonShenFrameTint = getFrameBorderColorFilters('single')
      const stripPrimaryTint = resolveKingdomFrameStripTintFilters('primary')
      const stripSecondaryTint = resolveKingdomFrameStripTintFilters('secondary')
      const stripSingleTint = resolveKingdomFrameStripTintFilters('single')
      const fullModeFlag = Boolean(info.renderConfig.display.fullModeFlag)
      /** 神框底图默认不着色；自定义势力（含神框+非神势力）仍走 frame 色域 */
      const shouldApplyKingdomColorToFrameBase =
        !shenFrameLayout || shouldTintShenFrameLayout() || isCustomKingdomActive(info)
      const frameBaseTint = !shouldApplyKingdomColorToFrameBase
        ? { full: baseFilters, half: baseFilters }
        : dualTint
          ? { full: secondaryTint, half: primaryTint }
          : { full: nonShenFrameTint, half: nonShenFrameTint }

      const children: CanvasItemConfig[] = []

      if (!fullModeFlag) {
        children.push(
          ...buildBaseFrameConfigs(
            code,
            name,
            groupRect.height,
            frameBaseImages,
            frameBaseTint,
          ),
        )
      }

      if (!fullModeFlag && !isShenHero && masterFlag) {
        const masterConfig = await buildMasterFrameConfig(
          code,
          name,
          kingdomFrameImages,
          shenFrameLayout,
        )
        if (generation !== frameLoadGeneration) return
        children.push(masterConfig)
      }

      const kingdomFrameStripFilters = singleGlyphKingdom
        ? (() => {
            const tint = resolveKingdomFrameStripTintFilters(
              resolveDoubleKingdomSingleGlyphColorSlot(info),
            )
            return { left: tint, right: tint }
          })()
        : dualTint
          ? { left: stripPrimaryTint, right: stripSecondaryTint }
          : { left: stripSingleTint, right: stripSingleTint }

      children.push(
        ...buildKingdomFrameConfig(
          code,
          name,
          kingdomFrameImages,
          shenFrameLayout,
          kingdomFrameStripFilters,
        ),
      )

      const groupConfig = buildGroupConfig(
        code,
        name,
        renderObj,
        groupRect.x,
        groupRect.y,
        groupRect.width,
        groupRect.height,
        children,
      )

      if (generation !== frameLoadGeneration) return
      const forceReset = shouldForceResetFrameLayout(renderObj, shenFrameLayout, isReset)
      updateNode(renderObj, groupConfig, forceReset)
      if (forceReset || renderObj.frameCardLayoutKey === undefined) {
        renderObj.frameCardLayoutKey = resolveCardTextLayoutKey(info)
      }
    } catch (error) {
      console.error(error)
    }
  }

  /** 加载底图与势力条（双势力：边框 full=势力2、half=势力1；势力条左=势力1、右=势力2） */
  const loadImageObjs = async (
    code: string,
    name: string,
    renderSrc: string,
    shenFrameLayout: boolean,
    masterFlag: boolean,
    doublePair: DoubleKingdomPair | null,
    singleGlyphKingdom: boolean,
  ) => {
    if (doublePair) {
      const primaryKey = getTemplateAssetKingdom(doublePair.primary)
      const secondaryKey = getTemplateAssetKingdom(doublePair.secondary)
      const stripKey = singleGlyphKingdom
        ? resolveKingdomFrameStripAssetKey(info, renderSrc)
        : null

      const [frameFull, frameHalf, kingdomFrameLeft, kingdomFrameRight] =
        await diyStore.runWithLoading(code, name, () =>
          Promise.all([
            loadFrameTierImage('full', secondaryKey),
            loadFrameTierImage('half', primaryKey),
            loadKonvaImage(
              kingdomFrameAssetSrc('left', stripKey ?? primaryKey),
            ),
            loadKonvaImage(
              kingdomFrameAssetSrc('right', stripKey ?? secondaryKey),
            ),
          ]),
        )

      return {
        frameBaseImages: { full: frameFull, half: frameHalf },
        kingdomFrameImages: { left: kingdomFrameLeft, right: kingdomFrameRight },
      }
    }

    const frameBaseKey = resolveFrameBaseAssetKey(info, renderSrc)
    const kingdomStripKey = resolveKingdomFrameStripAssetKey(info, renderSrc)

    const [frameImageObj, kingdomFrameLeft, kingdomFrameRight] = await diyStore.runWithLoading(
      code,
      name,
      () =>
        Promise.all([
          loadKonvaImage(frameAssetSrc('full', frameBaseKey)),
          loadKonvaImage(kingdomFrameAssetSrc('left', kingdomStripKey)),
          loadKonvaImage(kingdomFrameAssetSrc('right', kingdomStripKey)),
        ]),
    )

    return {
      frameBaseImages: { full: frameImageObj, half: null },
      kingdomFrameImages: { left: kingdomFrameLeft, right: kingdomFrameRight },
    }
  }

  /** kingdom_frame 显示尺寸（与原先单张 frame_kingdom 一致） */
  const calcKingdomFrameSize = (imageObj: FrameImage, isShen: boolean) => {
    const { widthPx } = resolveFrameKingdomFrameLayout(isShen)
    const stripHeight = (imageObj.height / imageObj.width) * widthPx
    return { stripWidth: widthPx, stripHeight }
  }

  /** group 布局 */
  const calcGroupRect = (frameBaseImages: FrameBaseImages, isShen: boolean) => {
    let x = 0 - diyStore.maxBleed
    const y = 0 - diyStore.maxBleed
    let targetHeight: number

    if (isShen) {
      x = units.mmToPx(FRAME_SHEN_GROUP_X_MM)
      targetHeight =
        (frameBaseImages.full.height / frameBaseImages.full.width) * FRAME_SHEN_DISPLAY_WIDTH_PX
    } else {
      const { finalHeight } = calculateFitSize(
        props.stageWidth + diyStore.outStageBleed * 2,
        props.stageHeight + diyStore.outStageBleed * 2,
        frameBaseImages.full.width,
        frameBaseImages.full.height,
        'height-fit',
      )
      targetHeight = finalHeight
    }

    const widthFromHeight = (imageObj: FrameImage) => (imageObj.width / imageObj.height) * targetHeight
    const widthCandidates = [widthFromHeight(frameBaseImages.full)]
    if (frameBaseImages.half) {
      widthCandidates.push(widthFromHeight(frameBaseImages.half))
    }
    const width = Math.max(...widthCandidates)
    const height = targetHeight

    return {
      x: x + props.stageOrigin.x,
      y: y + props.stageOrigin.y,
      width,
      height,
    }
  }

  /** 底图子节点（双势力：先 full 势力2，再 half 势力1 叠在上层） */
  const buildBaseFrameConfigs = (
    code: string,
    name: string,
    targetHeight: number,
    frameBaseImages: FrameBaseImages,
    tierFilters: { full: Record<string, unknown>; half: Record<string, unknown> },
  ): CanvasItemConfig[] => {
    const buildLayer = (
      tier: 'full' | 'half',
      imageObj: FrameImage,
      layerCode: string,
      layerName: string,
      filters: Record<string, unknown>,
    ): CanvasItemConfig =>
      ({
        code: layerCode,
        name: layerName,
        width: (imageObj.width / imageObj.height) * targetHeight,
        height: targetHeight,
        image: markRaw(imageObj),
        rotation: 0,
        originX: 0,
        originY: 0,
        ...getPosition(0, 0, (imageObj.width / imageObj.height) * targetHeight, targetHeight),
        ...filters,
      }) as CanvasItemConfig

    const configs = [
      buildLayer(
        'full',
        frameBaseImages.full,
        `${code}_base_full`,
        `${name}_底`,
        tierFilters.full,
      ),
    ]
    if (frameBaseImages.half) {
      configs.push(
        buildLayer(
          'half',
          frameBaseImages.half,
          `${code}_base_half`,
          `${name}_半`,
          tierFilters.half,
        ),
      )
    } else {
      configs[0]!.code = `${code}_base`
      configs[0]!.name = name
    }
    return configs
  }

  /** 主公框子节点 */
  const buildMasterFrameConfig = async (
    code: string,
    name: string,
    kingdomFrameImages: KingdomFrameImages,
    isShen: boolean,
  ): Promise<CanvasItemConfig> => {
    const masterFrameSrc = `${TEMPLATE_ASSET_BASE}/assets/frame/master.png`
    const masterFrameImageObj = await loadTrackedImage(`${code}_master`, name, masterFrameSrc)
    const masterFrameX = units.mmToPx(FRAME_MASTER_MM.x)
    const masterFrameY = units.mmToPx(FRAME_MASTER_MM.y)
    const masterFrameHeight = units.mmToPx(FRAME_MASTER_MM.height)
    const masterFrameWidth =
      (masterFrameImageObj.width / masterFrameImageObj.height) * masterFrameHeight

    const { stripWidth, stripHeight } = calcKingdomFrameSize(kingdomFrameImages.left, isShen)

    return {
      code: `${code}_master`,
      name: `${name}_主公`,
      width: masterFrameWidth,
      height: masterFrameHeight,
      image: markRaw(masterFrameImageObj),
      rotation: 0,
      originX: masterFrameX,
      originY: masterFrameY,
      ...getPosition(masterFrameX, masterFrameY, stripWidth, stripHeight),
      ...getFilters(),
    } as CanvasItemConfig
  }

  /** kingdom_frame 子节点（左、右叠在同一区域，left 盖在 right 上） */
  const buildKingdomFrameConfig = (
    code: string,
    name: string,
    kingdomFrameImages: KingdomFrameImages,
    isShen: boolean,
    sideFilters: { left: Record<string, unknown>; right: Record<string, unknown> },
  ): CanvasItemConfig[] => {
    const { stripWidth, stripHeight } = calcKingdomFrameSize(kingdomFrameImages.left, isShen)
    const { offsetMm } = resolveFrameKingdomFrameLayout(isShen)
    const x = units.mmToPx(offsetMm.x)
    const y = units.mmToPx(offsetMm.y)

    const buildLayer = (
      side: 'left' | 'right',
      imageObj: FrameImage,
      filters: Record<string, unknown>,
    ): CanvasItemConfig =>
      ({
        code: `${code}_kingdom_${side}`,
        name: `${name}_势力_${side === 'left' ? '左' : '右'}`,
        width: stripWidth,
        height: stripHeight,
        image: markRaw(imageObj),
        rotation: 0,
        originX: x,
        originY: y,
        listening: false,
        ...getPosition(x, y, stripWidth, stripHeight),
        ...filters,
      }) as CanvasItemConfig

    return [
      buildLayer('right', kingdomFrameImages.right, sideFilters.right),
      buildLayer('left', kingdomFrameImages.left, sideFilters.left),
    ]
  }

  /** group 根节点 */
  const buildGroupConfig = (
    code: string,
    name: string,
    renderObj: LegendInfo['renderConfig']['items']['frame'],
    x: number,
    y: number,
    width: number,
    height: number,
    children: CanvasItemConfig[],
  ): CanvasItemConfig =>
    ({
      code,
      name,
      width,
      height,
      originX: x,
      originY: y,
      rotation: 0,
      listening: false,
      children,
      ...getPosition(x, y, width, height),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    }) as CanvasItemConfig

  return load
}
