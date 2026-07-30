import {
  loadKonvaImage,
  useKonvaBrightnessFilters,
} from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import { useTemplateStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { createDiyUnitConverters, getPosition } from '@/features/diy-card/utils/canvas'
import Konva from 'konva'
import { markRaw } from 'vue'
import { TEMPLATE_ASSET_BASE } from '../../constants/common'
import {
  HP_EMPTY_ICON_SCALE,
  HP_EMPTY_ICON_Y_MM,
  HP_ICON_UNIT_WIDTH,
  HP_NORMAL_ICON_SCALE,
  HP_SHIELD_ICON_SCALE,
  HP_TEXT_Y_MM,
  HP_LIMITED_TEXT_FONT_SIZE,
  isStaleHpPresetLayout,
  resolveHpLimitedTextKonvaStyle,
  resolveHpOriginMm,
} from '../../constants/hp'
import {
  isCustomKingdomActive,
  isMasterFlagActive,
  isShenSingleKingdomActive,
  usesShenCardLayout,
  resolveDoubleKingdomPair,
} from '@/features/diy-card/composables/doubleKingdom'
import { resolveHpAssetKingdomKey } from '@/features/diy-card/utils/syncFrameKingdom'
import { useKingdomTint } from '../../filters'

type HpAssetKind = 'normal' | 'empty' | 'shield'

type HpIconLayerImages = {
  full: HTMLImageElement
  half: HTMLImageElement | null
}

type HpIconImages = {
  normal: HpIconLayerImages
  empty: HpIconLayerImages
  shield: HpIconLayerImages
}

type HpIconLayout = {
  /** 缩放后的占位宽高 */
  width: number
  height: number
  /** Konva 节点上的原始图尺寸 */
  imageWidth: number
  imageHeight: number
  scale: number
}

type HpTierFilters = { full: Record<string, unknown>; half: Record<string, unknown> }

/** 按各自缩放比例计算显示尺寸，保持素材宽高比 */
const hpIconLayoutFromImage = (image: HTMLImageElement, scale: number): HpIconLayout => {
  const imageWidth = image.naturalWidth || image.width
  const imageHeight = image.naturalHeight || image.height
  return {
    imageWidth,
    imageHeight,
    scale,
    width: imageWidth * scale,
    height: imageHeight * scale,
  }
}

/**
 * 绘制体力
 * @param canvas 画布状态
 */
export function drawHp(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const getLegendInfo = () => infoStore.info as LegendInfo
  const units = createDiyUnitConverters(diyStore.mmToPx)
  const templateStore = useTemplateStore()
  const templateInfo = templateStore.currentTemplate
  const { getFilters } = useKonvaBrightnessFilters()
  const { props, updateNode, getDragger, getSelectHandlers, itemCacheMap } = canvas

  let hpLoadGeneration = 0

  /** 加载入口 */
  const load = async (isReset: boolean = false) => {
    const generation = ++hpLoadGeneration
    const info = getLegendInfo()
    const code = 'hp'
    const renderObj = info.renderConfig.items[code]
    const maxLimit = templateInfo.config?.maxHpDisplayNum?.numValue || 10
    const maxHp = info.baseInfo.maxHp
    const shield = info.baseInfo.shield
    const shenCardLayout = usesShenCardLayout(info)
    const hpOriginMm = resolveHpOriginMm(shenCardLayout)
    const shouldResetLayout =
      isReset || isStaleHpPresetLayout(renderObj, shenCardLayout)
    const startX = props.stageOrigin.x + units.mmToPx(hpOriginMm.x)
    const startY = props.stageOrigin.y + units.mmToPx(hpOriginMm.y)
    const useIconMode = maxHp + shield <= maxLimit

    let totalWidth: number
    let groupHeight: number
    let children: CanvasItemConfig[]

    try {
      const { tierFilters } = resolveHpTintContext()

      if (useIconMode) {
        const images = await loadHpIconImages()
        if (generation !== hpLoadGeneration) return
        const layouts = createHpIconLayouts(images)
        const iconStep = HP_ICON_UNIT_WIDTH

        totalWidth = calcIconModeWidth(startX, maxHp, shield, iconStep)
        groupHeight = Math.max(layouts.normal.height, layouts.empty.height, layouts.shield.height)
        children = buildIconModeChildren(images, layouts, iconStep, tierFilters)
      } else {
        totalWidth = props.stageWidth
        const result = await buildTextModeChildren(tierFilters)
        if (generation !== hpLoadGeneration) return
        children = result.children
        groupHeight = result.groupHeight
      }

      const groupConfig = buildGroupConfig(
        code,
        renderObj,
        startX,
        startY,
        totalWidth,
        groupHeight,
        children,
      )

      updateNode(renderObj, groupConfig, shouldResetLayout)
    } catch (error) {
      console.error('[hp] load failed', error)
    }
  }

  /** 解析体力叠层滤镜与素材 key（对齐 frame：双势力 tier 与边框相反，hp full=势力1、half=势力2） */
  const resolveHpTintContext = () => {
    const info = getLegendInfo()
    const kingdomTint = useKingdomTint(info, getFilters)
    const {
      getHpTintFromKingdomColorFilters,
      getTemplateAssetKingdom,
      useDualCustomKingdomColor,
      getCustomHpTintTierFilters,
    } = kingdomTint

    const masterFlag = isMasterFlagActive(info)
    const isPresetShenHp = isShenSingleKingdomActive(info) && !isCustomKingdomActive(info)
    const doublePair =
      !isShenSingleKingdomActive(info) && !masterFlag ? resolveDoubleKingdomPair(info) : null
    const dualTint = Boolean(doublePair && useDualCustomKingdomColor())
    const baseFilters = getFilters()

    const customHpTierFilters = getCustomHpTintTierFilters()
    const tierFilters: HpTierFilters =
      customHpTierFilters ??
      (isPresetShenHp
        ? { full: baseFilters, half: baseFilters }
        : dualTint
          ? {
              full: getHpTintFromKingdomColorFilters('primary'),
              half: getHpTintFromKingdomColorFilters('secondary'),
            }
          : {
              full: getHpTintFromKingdomColorFilters('single'),
              half: getHpTintFromKingdomColorFilters('single'),
            })

    return {
      info,
      doublePair,
      getTemplateAssetKingdom,
      tierFilters,
      isPresetShenHp,
      masterFlag,
    }
  }

  const resolveHpAssetKey = (
    info: LegendInfo,
    getTemplateAssetKingdom: (actualKingdom: string) => string,
    actualKingdom?: string,
  ) => resolveHpAssetKingdomKey(info, getTemplateAssetKingdom, actualKingdom)

  const hpAssetSrc = (kind: HpAssetKind, tier: 'full' | 'half', assetKey: string) =>
    `${TEMPLATE_ASSET_BASE}/assets/hp/${kind}/${tier}/${assetKey}.png`

  const loadHpIconLayer = async (
    kind: HpAssetKind,
    fullKey: string,
    halfKey: string | null,
  ): Promise<HpIconLayerImages> => {
    const full = await loadKonvaImage(hpAssetSrc(kind, 'full', fullKey))
    if (!halfKey) {
      return { full: markRaw(full), half: null }
    }
    const half = await loadKonvaImage(hpAssetSrc(kind, 'half', halfKey))
    return { full: markRaw(full), half: markRaw(half) }
  }

  /** 加载 normal / empty / shield（双势力：hp full=势力1、hp half=势力2，与 frame 的 half/full 对调） */
  const loadHpIconImages = (): Promise<HpIconImages> =>
    diyStore.runWithLoading('hp', '体力', async () => {
      const { info, doublePair, getTemplateAssetKingdom } = resolveHpTintContext()

      if (doublePair) {
        const primaryKey = resolveHpAssetKey(info, getTemplateAssetKingdom, doublePair.primary)
        const secondaryKey = resolveHpAssetKey(info, getTemplateAssetKingdom, doublePair.secondary)
        const [normal, empty, shield] = await Promise.all([
          loadHpIconLayer('normal', primaryKey, secondaryKey),
          loadHpIconLayer('empty', primaryKey, secondaryKey),
          loadHpIconLayer('shield', primaryKey, secondaryKey),
        ])
        return { normal, empty, shield }
      }

      const assetKey = resolveHpAssetKey(info, getTemplateAssetKingdom)
      const [normal, empty, shield] = await Promise.all([
        loadHpIconLayer('normal', assetKey, null),
        loadHpIconLayer('empty', assetKey, null),
        loadHpIconLayer('shield', assetKey, null),
      ])
      return { normal, empty, shield }
    })

  const createHpIconLayouts = (images: HpIconImages) => ({
    normal: hpIconLayoutFromImage(images.normal.full, HP_NORMAL_ICON_SCALE),
    empty: hpIconLayoutFromImage(images.empty.full, HP_EMPTY_ICON_SCALE),
    shield: hpIconLayoutFromImage(images.shield.full, HP_SHIELD_ICON_SCALE),
  })

  /** 图标模式宽度 */
  const calcIconModeWidth = (
    startX: number,
    maxHp: number,
    shield: number,
    iconStep: number,
  ) => {
    const totalItems = maxHp + shield
    return Math.abs(startX + (totalItems - 1) * iconStep + HP_ICON_UNIT_WIDTH)
  }

  /** 单枚体力/护甲图标子节点 */
  const buildHpIconNodeConfig = (
    index: number,
    x: number,
    imageObj: HTMLImageElement,
    iconLayout: HpIconLayout,
    nameSuffix: string,
    tierFilters: HpTierFilters,
    yMm: number = 0,
    layerCodeSuffix = '',
    tier: 'full' | 'half' = 'full',
  ): CanvasItemConfig => {
    const code = 'hp'
    const { width, height, imageWidth, imageHeight, scale } = iconLayout
    const y = units.mmToPx(yMm)

    return {
      code: `${code}_${index}${layerCodeSuffix}`,
      name: `体力_${nameSuffix}`,
      width: imageWidth,
      height: imageHeight,
      image: imageObj,
      rotation: 0,
      originX: x,
      originY: y,
      scaleX: scale,
      scaleY: scale,
      ...getPosition(x, y, width, height),
      ...tierFilters[tier],
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as CanvasItemConfig
  }

  const pushHpIconStack = (
    target: CanvasItemConfig[],
    index: number,
    x: number,
    layer: HpIconLayerImages,
    iconLayout: HpIconLayout,
    nameSuffix: string,
    tierFilters: HpTierFilters,
    yMm: number = 0,
  ) => {
    target.push(
      buildHpIconNodeConfig(
        index,
        x,
        layer.full,
        iconLayout,
        `${nameSuffix}_底`,
        tierFilters,
        yMm,
        '_full',
        'full',
      ),
    )
    if (layer.half) {
      target.push(
        buildHpIconNodeConfig(
          index,
          x,
          layer.half,
          iconLayout,
          `${nameSuffix}_半`,
          tierFilters,
          yMm,
          '_half',
          'half',
        ),
      )
    }
  }

  /** 纯图片模式子节点 */
  const buildIconModeChildren = (
    images: HpIconImages,
    layouts: ReturnType<typeof createHpIconLayouts>,
    iconStep: number,
    tierFilters: HpTierFilters,
  ) => {
    const info = getLegendInfo()
    const children: CanvasItemConfig[] = []
    const hp = info.baseInfo.hp
    const maxHp = info.baseInfo.maxHp
    const shield = info.baseInfo.shield

    for (let i = 0; i < hp; i++) {
      pushHpIconStack(children, i, i * iconStep, images.normal, layouts.normal, `${i}_满`, tierFilters)
    }

    if (!info.renderConfig.items.hp.equalFlag) {
      for (let i = hp; i < maxHp; i++) {
        pushHpIconStack(
          children,
          i,
          i * iconStep,
          images.empty,
          layouts.empty,
          `${i}_空`,
          tierFilters,
          HP_EMPTY_ICON_Y_MM,
        )
      }
    }

    for (let i = 0; i < shield; i++) {
      const index = i + maxHp
      pushHpIconStack(
        children,
        index,
        index * iconStep,
        images.shield,
        layouts.shield,
        `${index}_护甲`,
        tierFilters,
      )
    }

    return children
  }

  /** 文字模式：单枚示意体力图（与图标模式首枚同 origin / 占位） */
  const buildHpSummaryIconConfig = (
    imageObj: HTMLImageElement,
    iconLayout: HpIconLayout,
    tierFilters: HpTierFilters,
    codeSuffix = '',
    tier: 'full' | 'half' = 'full',
  ): CanvasItemConfig => {
    const code = 'hp'
    const { width, height, imageWidth, imageHeight, scale } = iconLayout

    return {
      code: `${code}_icon${codeSuffix}`,
      name: '体力图',
      width: imageWidth,
      height: imageHeight,
      image: imageObj,
      rotation: 0,
      originX: 0,
      originY: 0,
      scaleX: scale,
      scaleY: scale,
      ...getPosition(0, 0, width, height),
      ...tierFilters[tier],
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as CanvasItemConfig
  }

  /** 体力值子节点 */
  const buildHpValueTextConfig = (
    hp: number,
    maxHp: number,
    equalFlag: boolean,
    iconLayout: HpIconLayout,
  ): CanvasItemConfig => {
    const code = 'hp'
    const textY = units.mmToPx(HP_TEXT_Y_MM)
    const textX = iconLayout.width + 10

    const tempConfig = {
      code: `${code}_text`,
      name: '体力值',
      fontFamily: 'BrushStroke-Simple',
      text: `× ${equalFlag ? hp : hp + '/' + maxHp}`,
      fontSize: HP_LIMITED_TEXT_FONT_SIZE,
      fill: '#ffffff',
      ...resolveHpLimitedTextKonvaStyle(HP_LIMITED_TEXT_FONT_SIZE),
      originX: textX,
      originY: textY,
      height: iconLayout.height,
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as unknown as CanvasItemConfig
    const textWidth = new Konva.Text(tempConfig).width()

    return {
      ...tempConfig,
      width: textWidth,
      ...getPosition(textX, textY, textWidth, iconLayout.height),
    } as CanvasItemConfig
  }

  /** 护甲图子节点 */
  const buildShieldSummaryIconConfig = (
    imageObj: HTMLImageElement,
    iconLayout: HpIconLayout,
    shieldIconX: number,
    tierFilters: HpTierFilters,
    codeSuffix = '',
    tier: 'full' | 'half' = 'full',
  ): CanvasItemConfig => {
    const code = 'hp'
    const { width, height, imageWidth, imageHeight, scale } = iconLayout

    return {
      code: `shield_icon${codeSuffix}`,
      name: '护甲图',
      width: imageWidth,
      height: imageHeight,
      image: imageObj,
      rotation: 0,
      originX: shieldIconX,
      originY: 0,
      scaleX: scale,
      scaleY: scale,
      ...getPosition(shieldIconX, 0, width, height),
      ...tierFilters[tier],
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as CanvasItemConfig
  }

  /** 护甲值文本子节点 */
  const buildShieldTextConfig = (
    shield: number,
    shieldTextX: number,
    iconLayout: HpIconLayout,
  ): CanvasItemConfig => {
    const code = 'hp'
    const textY = units.mmToPx(HP_TEXT_Y_MM)

    return {
      code: 'shield_text',
      name: '护甲值',
      fontFamily: 'BrushStroke-Simple',
      text: `× ${shield}`,
      fontSize: HP_LIMITED_TEXT_FONT_SIZE,
      fill: '#ffffff',
      ...resolveHpLimitedTextKonvaStyle(HP_LIMITED_TEXT_FONT_SIZE),
      originX: shieldTextX,
      originY: textY,
      width: 70,
      height: iconLayout.height,
      ...getPosition(shieldTextX, textY, 60, iconLayout.height),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as unknown as CanvasItemConfig
  }

  /** 文字模式子节点 */
  const buildTextModeChildren = async (
    tierFilters: HpTierFilters,
  ): Promise<{
    children: CanvasItemConfig[]
    groupHeight: number
  }> => {
    const info = getLegendInfo()
    const children: CanvasItemConfig[] = []
    const hp = info.baseInfo.hp
    const maxHp = info.baseInfo.maxHp
    const shield = info.baseInfo.shield
    const equalFlag = info.renderConfig.items.hp.equalFlag

    try {
      const images = await loadHpIconImages()
      const layouts = createHpIconLayouts(images)

      children.push(
        buildHpSummaryIconConfig(images.normal.full, layouts.normal, tierFilters, '', 'full'),
      )
      if (images.normal.half) {
        children.push(
          buildHpSummaryIconConfig(images.normal.half, layouts.normal, tierFilters, '_half', 'half'),
        )
      }

      const hpTextConfig = buildHpValueTextConfig(hp, maxHp, equalFlag, layouts.normal)
      children.push(hpTextConfig)

      if (shield > 0) {
        const hpTextWidth = new Konva.Text(hpTextConfig).width()
        const shieldIconX = layouts.normal.width + hpTextWidth + 20

        children.push(
          buildShieldSummaryIconConfig(
            images.shield.full,
            layouts.shield,
            shieldIconX,
            tierFilters,
            '',
            'full',
          ),
        )
        if (images.shield.half) {
          children.push(
            buildShieldSummaryIconConfig(
              images.shield.half,
              layouts.shield,
              shieldIconX,
              tierFilters,
              '_half',
              'half',
            ),
          )
        }

        const shieldTextX = shieldIconX + layouts.shield.width + 10
        children.push(buildShieldTextConfig(shield, shieldTextX, layouts.shield))
      }

      const groupHeight = Math.max(
        layouts.normal.height,
        layouts.shield.height,
      )

      return { children, groupHeight }
    } catch (error) {
      console.error(error)
      return { children, groupHeight: 0 }
    }
  }

  /** group 根节点 */
  const buildGroupConfig = (
    code: string,
    renderObj: LegendInfo['renderConfig']['items']['hp'],
    startX: number,
    startY: number,
    totalWidth: number,
    totalHeight: number,
    children: CanvasItemConfig[],
  ): CanvasItemConfig =>
    ({
      code,
      name: '体力',
      width: totalWidth,
      height: totalHeight,
      originX: startX,
      originY: startY,
      rotation: 0,
      children,
      ...getPosition(startX, startY, totalWidth, totalHeight),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    }) as CanvasItemConfig

  return load
}
