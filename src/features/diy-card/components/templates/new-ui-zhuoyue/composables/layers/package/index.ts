import {
  createTrackedKonvaImageLoader,
  loadKonvaImage,
  useKonvaBrightnessFilters,
} from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore, useDiyHistoryStore, useInfoStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  isPackageIdentifyActive,
  isPackageRemoteImageKind,
  type PackageIdentify,
} from '@/features/diy-card/types/diy/packageIdentify'
import {
  createDiyUnitConverters,
  getPosition,
  mergeConfig,
} from '@/features/diy-card/utils/canvas'
import { syncPackageGroupChildrenLayout } from '@/features/diy-card/utils/packageGroupLayout'
import { EMPTY_CH_TRANS_OVERRIDES, resolveDisplayText } from '@/features/diy-card/utils/ch-trans/chTransEngine'
import {
  buildFontProbe,
  loadWebFontFamily,
  waitForWebFontFamily,
  whenWebFontFamilyReady,
} from '@/features/diy-card/utils/loadWebFontFamily'
import { toFixed } from '@/shared/utils/object'
import { markRaw } from 'vue'
import {
  PACKAGE_TEXT_BADGE_PRESETS,
  resolvePackageTextBgSrc,
  isPackageTextBadgeKind,
  resolvePackageTextBadgeBgAsset,
  type PackageTextBadgeKind,
  type PackageTextBadgePreset,
  type PackageTextBgAsset,
} from '../../constants/package'
import {
  applyPackageImageContainLayout,
  resolvePackageBadgeSizePx,
  resolvePackageCardLayoutKey,
  resolvePackageLayoutPreset,
  resolvePackageTextLayoutMetrics,
} from '../../layout/packageLayout'
import { buildPackageTextBadgeChildren } from '../../layout/packageTextLayout'

const EMPTY_CH_TRANS = EMPTY_CH_TRANS_OVERRIDES

let lastPackageCardLayoutKey: ReturnType<typeof resolvePackageCardLayoutKey> | null = null
/** 角标素材身份（类型 / 图片 / 文字底图）；变化时需重算宽高，避免沿用上一枚尺寸 */
let lastPackageSizeIdentity: string | null = null
let cancelPackageFontReadyWatch: (() => void) | undefined

/** document.fonts 探针字号须与 Konva 实际字号一致（Safari 按字号缓存字形） */
const resolvePackageBadgeFontProbe = (
  preset: PackageTextBadgePreset,
  activeBg: PackageTextBgAsset,
  badgeWidth: number,
  badgeHeight: number,
) => {
  const metrics = resolvePackageTextLayoutMetrics(
    badgeWidth,
    badgeHeight,
    activeBg.layoutRefWidthPx,
    activeBg.layoutRefHeightPx,
  )
  const maxRatio = Math.max(
    preset.single.char.fontSizeRatio,
    preset.dual.first.fontSizeRatio,
    preset.dual.second.fontSizeRatio,
  )
  const fontSizePx = Math.max(
    8,
    Math.ceil(activeBg.layoutRefWidthPx * maxRatio * metrics.layoutScale),
  )
  return buildFontProbe(preset.fontFamily, 'normal', `${fontSizePx}px`)
}

/** 决定角标基准宽高的素材指纹（不含位移/缩放/颜色） */
const resolvePackageSizeIdentity = (
  identify: PackageIdentify,
  convertTChFlag: boolean,
): string => {
  if (isPackageRemoteImageKind(identify.name)) {
    return `img:${identify.name}:${identify.pic?.trim() ?? ''}`
  }
  if (isPackageTextBadgeKind(identify.name)) {
    const preset = PACKAGE_TEXT_BADGE_PRESETS[identify.name]
    const displayText = resolveDisplayText(identify.text ?? '', convertTChFlag, EMPTY_CH_TRANS)
    const bg = resolvePackageTextBadgeBgAsset(preset, displayText)
    return `text:${identify.name}:${bg.assetFile}`
  }
  return `other:${identify.name}`
}

/** 画布/模板重置后清角标布局追踪，避免误判「布局已切换」 */
export const resetPackageCardLayoutTracking = () => {
  lastPackageCardLayoutKey = null
  lastPackageSizeIdentity = null
}

/**
 * 绘制角标（自定义图片 / 自定义文字角标）
 */
export function drawPackage(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const historyStore = useDiyHistoryStore()
  const getLegendInfo = () => infoStore.info as LegendInfo
  const { props, updateNode, getDragger, getSelectHandlers, itemCacheMap } = canvas
  const loadTrackedImage = createTrackedKonvaImageLoader(diyStore)
  const { getFilters } = useKonvaBrightnessFilters()

  const schedulePackageFontRepaintIfNeeded = async (
    fontFamily: string | undefined,
    fontProbe: string | undefined,
  ) => {
    if (!fontFamily || !fontProbe) return
    const fontReady = await waitForWebFontFamily(fontFamily, { probe: fontProbe })
    if (!fontReady) {
      cancelPackageFontReadyWatch = whenWebFontFamilyReady(
        fontFamily,
        () => {
          void load(false)
        },
        { probe: fontProbe },
      )
    }
  }

  const load = async (isReset: boolean = false) => {
    cancelPackageFontReadyWatch?.()
    cancelPackageFontReadyWatch = undefined

    const info = getLegendInfo()
    const code = 'package'
    const name = '角标'
    const renderObj = info.renderConfig.items[code]
    const identify = info.baseInfo.packageIdentify

    if (!isPackageIdentifyActive(identify)) {
      updateNode(renderObj, { code, name, children: [] }, isReset, { skipLayoutMerge: true })
      return
    }

    const layoutPreset = resolvePackageLayoutPreset(info)
    const units = createDiyUnitConverters(diyStore.mmToPx)
    const maxWidthPx = units.mmToPx(layoutPreset.maxWidthMm)
    const maxHeightPx = units.mmToPx(layoutPreset.maxHeightMm)

    let packageFontFamily: string | undefined
    let packageFontProbe: string | undefined

    if (isPackageTextBadgeKind(identify.name)) {
      const preset = PACKAGE_TEXT_BADGE_PRESETS[identify.name]
      const displayText = resolveDisplayText(
        identify.text ?? '',
        renderObj.convertTChFlag,
        EMPTY_CH_TRANS,
      )
      const activeBg = resolvePackageTextBadgeBgAsset(preset, displayText)
      const estimatedSize = resolvePackageBadgeSizePx(
        activeBg.layoutRefWidthPx,
        activeBg.layoutRefHeightPx,
        maxWidthPx,
        maxHeightPx,
      )
      const scaledWidth = estimatedSize.width * layoutPreset.defaultScale
      const scaledHeight = estimatedSize.height * layoutPreset.defaultScale
      packageFontFamily = preset.fontFamily
      packageFontProbe = resolvePackageBadgeFontProbe(
        preset,
        activeBg,
        scaledWidth,
        scaledHeight,
      )
      await diyStore.runWithLoading(code, '角标字体', async () => {
        await loadWebFontFamily(packageFontFamily!, {
          diyStore,
          label: '角标字体',
          probe: packageFontProbe,
        })
      })
    }

    const config = await buildPackageConfig(
      code,
      name,
      renderObj,
      identify,
      layoutPreset,
      maxWidthPx,
      maxHeightPx,
      units,
    )
    const baseWidth = config.width ?? 0
    const baseHeight = config.height ?? 0
    const hasMeasurableLayout = baseWidth > 0 && baseHeight > 0
    if (hasMeasurableLayout) {
      const cardLayoutKey = resolvePackageCardLayoutKey(info)
      const layoutKeyChanged =
        lastPackageCardLayoutKey !== null && lastPackageCardLayoutKey !== cardLayoutKey
      lastPackageCardLayoutKey = cardLayoutKey

      const sizeIdentity = resolvePackageSizeIdentity(identify, renderObj.convertTChFlag)
      const sizeIdentityChanged =
        lastPackageSizeIdentity !== null && lastPackageSizeIdentity !== sizeIdentity
      lastPackageSizeIdentity = sizeIdentity

      // 更换角标素材后按新图重算宽高并复位缩放；
      // 未放置 (0,0) 写入默认位置，用户挪过则继续复用
      if (sizeIdentityChanged && !historyStore.isRestoring) {
        renderObj.width = toFixed(units.pxToMm(baseWidth), 2)
        renderObj.height = toFixed(units.pxToMm(baseHeight), 2)
        renderObj.scale = 1
        if (renderObj.x === 0 && renderObj.y === 0) {
          renderObj.x = layoutPreset.xMm
          renderObj.y = layoutPreset.yMm
        }
      }

      const effectiveReset = isReset || (layoutKeyChanged && !historyStore.isRestoring)
      // 先合并 renderObj 布局；文字角标缩放走 Group.scale，子节点只在 load 时排版一次
      mergeConfig(renderObj, config, props.stageOrigin, diyStore.mmToPx, effectiveReset)
      renderObj.packageCardLayoutKey = cardLayoutKey
      const isTextBadge = isPackageTextBadgeKind(identify.name)
      if (!isTextBadge) {
        syncPackageGroupChildrenLayout(
          config,
          units.mmToPx(renderObj.width),
          units.mmToPx(renderObj.height),
          { textRelayout: { info } },
        )
      }
      updateNode(renderObj, config, isReset, { skipLayoutMerge: true })
      await schedulePackageFontRepaintIfNeeded(packageFontFamily, packageFontProbe)
      return
    }
    lastPackageSizeIdentity = resolvePackageSizeIdentity(identify, renderObj.convertTChFlag)
    updateNode(renderObj, config, isReset, { skipLayoutMerge: true })
    await schedulePackageFontRepaintIfNeeded(packageFontFamily, packageFontProbe)
  }

  const buildPackageConfig = async (
    code: string,
    name: string,
    renderObj: LegendInfo['renderConfig']['items']['package'],
    identify: PackageIdentify,
    layoutPreset: ReturnType<typeof resolvePackageLayoutPreset>,
    maxWidthPx: number,
    maxHeightPx: number,
    units: ReturnType<typeof createDiyUnitConverters>,
  ): Promise<CanvasItemConfig> => {
    const originX = props.stageOrigin.x + units.mmToPx(layoutPreset.xMm)
    const originY = props.stageOrigin.y + units.mmToPx(layoutPreset.yMm)
    const baseScale = layoutPreset.defaultScale

    if (isPackageRemoteImageKind(identify.name)) {
      const pic = identify.pic?.trim()
      if (!pic) {
        return { code, name, children: [] }
      }
      const imageObj = await loadTrackedImage('package', name, pic)
      const { width, height } = resolvePackageBadgeSizePx(
        imageObj.width,
        imageObj.height,
        maxWidthPx,
        maxHeightPx,
      )
      const scaledWidth = width * baseScale
      const scaledHeight = height * baseScale
      const imageChild = {
        code: 'package-image',
        name: '角标图片',
        image: markRaw(imageObj),
        listening: true,
        perfectDrawEnabled: true,
        ...getFilters(),
      } as CanvasItemConfig
      applyPackageImageContainLayout(imageChild, scaledWidth, scaledHeight)
      return {
        code,
        name,
        width: scaledWidth,
        height: scaledHeight,
        originX,
        originY,
        rotation: renderObj.rotation,
        ...getPosition(originX, originY, scaledWidth, scaledHeight),
        listening: true,
        children: [imageChild],
        ...getDragger(renderObj, code),
        ...getSelectHandlers(),
        loadFunc: itemCacheMap.value?.[code]!.loadFunc,
      }
    }

    const textKind = identify.name as PackageTextBadgeKind
    const preset = PACKAGE_TEXT_BADGE_PRESETS[textKind]
    if (!preset) {
      return { code, name, children: [] }
    }

    const displayText = resolveDisplayText(
      identify.text ?? '',
      renderObj.convertTChFlag,
      EMPTY_CH_TRANS,
    )
    const activeBg = resolvePackageTextBadgeBgAsset(preset, displayText)

    // 字体已在 load 入口按实际字号预加载；此处按单/双字拉对应底图
    const bgImage = await loadKonvaImage(resolvePackageTextBgSrc(activeBg))
    const { width, height } = resolvePackageBadgeSizePx(
      bgImage.width,
      bgImage.height,
      maxWidthPx,
      maxHeightPx,
    )
    const scaledWidth = width * baseScale
    const scaledHeight = height * baseScale

    return {
      code,
      name,
      width: scaledWidth,
      height: scaledHeight,
      originX,
      originY,
      rotation: renderObj.rotation,
      ...getPosition(originX, originY, scaledWidth, scaledHeight),
      listening: true,
      children: buildPackageTextBadgeChildren(
        preset,
        displayText,
        scaledWidth,
        scaledHeight,
        bgImage,
        renderObj,
        textKind,
      ),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    }
  }

  return load
}
