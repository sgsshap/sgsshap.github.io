import { createTrackedKonvaImageLoader, useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import { resolveStageContentOriginFromDiy } from '@/features/diy-card/composables/konva/konvaStageEdgeSnap'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import { useDiyHistoryStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { createDiyUnitConverters, getPosition, mergeConfig } from '@/features/diy-card/utils/canvas'
import { shouldTrustHistorySnapshotLayout } from '@/features/diy-card/utils/historyLayoutBootstrap'
import { loadWebFontFamily } from '@/features/diy-card/utils/loadWebFontFamily'
import { buildCustomKingdomTextLayerConfigs, buildPresetKingdomImageLayerConfigs } from '@/features/diy-card/utils/customKingdomTextStyle'
import Konva from 'konva'
import {
  purgeKingdomGlyphPreviewState,
  resetKingdomCanvasPreviewShell,
} from './purgeKingdomGlyphPreview'
import { markRaw } from 'vue'
import { TEMPLATE_ASSET_BASE } from '../../constants/common'
import {
  CUSTOM_KINGDOM_LAYOUT_KEY,
  KINGDOM_DUAL_CHAR_HIT_CODE,
  type DoubleKingdomGlyphSlot,
} from '../../constants/kingdom'
import {
  resolveCustomKingdomDualCharSlotMm,
  resolveCustomKingdomDualGroupAnchorMm,
  resolveCustomKingdomSingleTextMm,
  resolveDoubleKingdomGlyphLayoutEntry,
  resolveDoubleKingdomGlyphSizePx,
  resolveExtensionPresetKingdomGlyphLayout,
  resolvePresetKingdomGlyphLayoutMm,
} from '../../layout/kingdomLayout'
import {
  clearDoubleKingdomGlyphItems,
  formatCustomKingdomGlyphName,
  formatKingdomGlyphName,
  getKingdomGlyphCode,
  hasKingdomGlyphPersistedLayout,
  hasCustomKingdomGlyphText,
  isCustomKingdomActive,
  resolveCustomKingdomDoubleTextForRender,
  resolveSingleCustomDisplayChars,
  shouldRenderSingleCustomKingdomGlyph,
  isCustomShenKingdomActive,
  isDoubleKingdomRenderActive,
  isDoubleKingdomSingleGlyphMode,
  isKingdomGlyphCode,
  isMasterFlagActive,
  usesShenCardLayout,
  resolveDoubleKingdomPair,
  resolveDoubleKingdomSingleGlyphRole,
  resolveKingdomCustomFontFamily,
  type DoubleKingdomPair,
  ensureCustomKingdomSetup,
  resolveKingdomCustomDualCharSpacingMm,
  resolveKingdomForSingleRender,
  buildSinglePresetGlyphLayoutKey,
  shouldResetKingdomGlyphLayout,
  shouldResetSinglePresetKingdomLayout,
  syncDoubleKingdomGlyphItems,
  type KingdomColorSlot,
  type KingdomGlyphRole,
} from '@/features/diy-card/composables/doubleKingdom'
import { useKingdomTint } from '../../filters'
import {
  ensureKingdomGlyphFontSizeItem,
  resolveKingdomGlyphFontSizePt,
  resolveKingdomGlyphFontSizePx,
  resolveKingdomTextBoxFromFontSizePx,
} from '@/features/diy-card/utils/customKingdomFontSize'
import {
  isKingdomGlyphOfficialGradientActive,
  resolveKingdomGlyphGradientEndColorHex,
  resolveKingdomGlyphTextColorHex,
  resolveKingdomGlyphTextGamutKey,
} from '@/features/diy-card/utils/customKingdomGlyphColor'
import {
  buildPresetKingdomLayoutKey,
  isPresetKingdomActive,
  resolveActiveKingdomPreset,
  shouldUseMasterKingdomGlyphAsset,
  shouldUseMasterKingdomGlyphStyle,
} from '@/features/diy-card/composables/kingdomPreset'
import { resolveKingdomPresetAssetSrc } from '@/features/diy-card/constants/kingdomPresets'

type KingdomImage = HTMLImageElement

type KingdomGlyphLayoutPx = {
  originX: number
  originY: number
  width: number
  height: number
}

type KingdomLoadSnapshot = {
  isCustomShen: boolean
  doubleRenderActive: boolean
  doubleSingleGlyph: boolean
  doubleSingleRole: KingdomGlyphRole
  shenCardLayout: boolean
  masterFlag: boolean
  doublePair: DoubleKingdomPair | null
}

const readKingdomLoadSnapshot = (info: LegendInfo): KingdomLoadSnapshot => {
  const shenCardLayout = usesShenCardLayout(info)
  const masterFlag = isMasterFlagActive(info)
  return {
    isCustomShen: isCustomShenKingdomActive(info),
    doubleRenderActive: isDoubleKingdomRenderActive(info),
    doubleSingleGlyph: isDoubleKingdomSingleGlyphMode(info),
    doubleSingleRole: resolveDoubleKingdomSingleGlyphRole(info),
    shenCardLayout,
    masterFlag,
    doublePair: !shenCardLayout && !masterFlag ? resolveDoubleKingdomPair(info) : null,
  }
}

const hasKingdomModeChanged = <K extends keyof KingdomLoadSnapshot>(
  previous: Partial<KingdomLoadSnapshot>,
  key: K,
  current: KingdomLoadSnapshot,
) => previous[key] !== undefined && previous[key] !== current[key]

const roleToSlot = (role: KingdomGlyphRole): DoubleKingdomGlyphSlot =>
  role === 'primary' ? 'top' : 'bottom'

const layoutTrackKey = (customText: string, assetKey: string) =>
  customText ? `t:${customText}` : assetKey

/** 预设双势力混合渲染：仅用户填写值，不含 placeholder */
const resolveDoubleCustomTextRaw = (info: LegendInfo, role: KingdomGlyphRole) =>
  info.renderConfig.items.kingdom.customText[role].trim()

const usesCustomKingdomTextRendering = (info: LegendInfo) => hasCustomKingdomGlyphText(info)

type KingdomLayoutPxContext = {
  contentOrigin: { x: number; y: number }
  mmToPx: (mm: number) => number
}

const resolvePersistedGlyphLayoutPx = (
  ctx: KingdomLayoutPxContext,
  renderObj: LayoutItem,
  useDefaultLayout: boolean,
  box: { width: number; height: number },
): KingdomGlyphLayoutPx | null => {
  if (useDefaultLayout || !hasKingdomGlyphPersistedLayout(renderObj)) return null
  return {
    originX: ctx.contentOrigin.x + ctx.mmToPx(renderObj.x),
    originY: ctx.contentOrigin.y + ctx.mmToPx(renderObj.y),
    width: box.width,
    height: box.height,
  }
}

/** 计算双势力预设字像素包围盒（图片素材） */
const resolveKingdomGlyphLayoutPxFromImage = (
  assetKey: string,
  role: KingdomGlyphRole,
  image: KingdomImage,
  ctx: KingdomLayoutPxContext,
  glyphRenderObj: LayoutItem,
  useDefaultLayout: boolean,
): KingdomGlyphLayoutPx => {
  const persisted = resolvePersistedGlyphLayoutPx(ctx, glyphRenderObj, useDefaultLayout, {
    width: ctx.mmToPx(glyphRenderObj.width),
    height: ctx.mmToPx(glyphRenderObj.height),
  })
  if (persisted) return persisted

  const slot = roleToSlot(role)
  const glyphLayout = resolveDoubleKingdomGlyphLayoutEntry(assetKey, slot)
  const { width, height } = resolveDoubleKingdomGlyphSizePx(image, glyphLayout.scale)

  return {
    originX: ctx.contentOrigin.x + ctx.mmToPx(glyphLayout.x),
    originY: ctx.contentOrigin.y + ctx.mmToPx(glyphLayout.y),
    width,
    height,
  }
}

/** 单字自定义势力（kingdom 根节点）像素包围盒 */
const resolveCustomSingleKingdomTextLayoutPx = (
  ctx: KingdomLayoutPxContext,
  renderObj: LayoutItem,
  useDefaultLayout: boolean,
  mmToPixel: number,
  isShen: boolean,
): KingdomGlyphLayoutPx => {
  ensureKingdomGlyphFontSizeItem(renderObj, isShen, 'single')
  const fontSizePx = resolveKingdomGlyphFontSizePx(renderObj, mmToPixel, isShen, 'single')
  const defaultSize = resolveKingdomTextBoxFromFontSizePx(fontSizePx)

  const persisted = resolvePersistedGlyphLayoutPx(ctx, renderObj, useDefaultLayout, defaultSize)
  if (persisted) return persisted

  const { x, y } = resolveCustomKingdomSingleTextMm(isShen)
  const { width, height } = defaultSize

  return {
    originX: ctx.contentOrigin.x + ctx.mmToPx(x),
    originY: ctx.contentOrigin.y + ctx.mmToPx(y),
    width,
    height,
  }
}

/** 双势力字槽自定义文本像素包围盒 */
const resolveCustomTextGlyphLayoutPx = (
  role: KingdomGlyphRole,
  ctx: KingdomLayoutPxContext,
  glyphRenderObj: LayoutItem,
  useDefaultLayout: boolean,
  mmToPixel: number,
  spacingMm: number,
  isShen = false,
): KingdomGlyphLayoutPx => {
  ensureKingdomGlyphFontSizeItem(glyphRenderObj, isShen, 'dual')
  const fontSizePx = resolveKingdomGlyphFontSizePx(glyphRenderObj, mmToPixel, isShen, 'dual')
  const slot = roleToSlot(role)
  const glyphLayout = resolveCustomKingdomDualCharSlotMm(slot, spacingMm, isShen)
  const defaultSize = resolveKingdomTextBoxFromFontSizePx(fontSizePx)

  const persisted = resolvePersistedGlyphLayoutPx(ctx, glyphRenderObj, useDefaultLayout, defaultSize)
  if (persisted) return persisted

  const { width, height } = defaultSize

  return {
    originX: ctx.contentOrigin.x + ctx.mmToPx(glyphLayout.x),
    originY: ctx.contentOrigin.y + ctx.mmToPx(glyphLayout.y),
    width,
    height,
  }
}

/**
 * 绘制势力字（单势力整图；双势力两字独立可拖拽）
 * @param canvas 画布状态
 */
export function drawKingdom(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const historyStore = useDiyHistoryStore()
  const infoStore = useInfoStore()
  const trustHistorySnapshot = () =>
    shouldTrustHistorySnapshotLayout({
      bootstrappedKinds: historyStore.bootstrappedKinds,
      activeInfoKind: historyStore.activeInfoKind,
      canvasBootstrapPending: diyStore.canvasBootstrapPending,
    })
  const getLegendInfo = () => infoStore.info as LegendInfo
  const units = createDiyUnitConverters(diyStore.mmToPx)
  const loadTrackedImage = createTrackedKonvaImageLoader(diyStore)
  const { getFilters } = useKonvaBrightnessFilters()
  const resolveKingdomTintContext = () => useKingdomTint(getLegendInfo(), getFilters)
  const { props, updateNode, getDragger, getSelectHandlers, itemCacheMap, canvasConfigs } = canvas
  const contentOrigin = () => resolveStageContentOriginFromDiy(diyStore)
  const fontFamily = () => resolveKingdomCustomFontFamily(getLegendInfo())
  const kingdomLayoutCtx = (): KingdomLayoutPxContext => ({
    contentOrigin: contentOrigin(),
    mmToPx: units.mmToPx,
  })

  let loadGeneration = 0
  let lastLoadSnapshot: Partial<KingdomLoadSnapshot> = {}

  const applyKingdomGlyphEmptyState = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    isReset: boolean,
  ) => {
    purgeKingdomGlyphPreviewState(canvas)
    clearDoubleKingdomGlyphItems(renderObj)
    updateNode(
      renderObj,
      {
        code: 'kingdom',
        name: '势力',
        width: 0,
        height: 0,
        originX: 0,
        originY: 0,
        rotation: 0,
        listening: false,
        children: [],
        loadFunc: itemCacheMap.value?.kingdom?.loadFunc,
      },
      isReset,
    )
  }

  const syncLoadSnapshotFromInfo = (info: LegendInfo) => {
    lastLoadSnapshot = readKingdomLoadSnapshot(info)
  }

  const handleKingdomModeTransitions = (current: KingdomLoadSnapshot) => {
    const doubleModeChanged = hasKingdomModeChanged(lastLoadSnapshot, 'doubleRenderActive', current)
    const doubleSingleChanged = hasKingdomModeChanged(lastLoadSnapshot, 'doubleSingleGlyph', current)
    const shenModeChanged = hasKingdomModeChanged(lastLoadSnapshot, 'isCustomShen', current)
    const shenCardLayoutChanged = hasKingdomModeChanged(lastLoadSnapshot, 'shenCardLayout', current)

    if (doubleModeChanged && !current.doubleRenderActive) {
      purgeKingdomGlyphCanvasState()
    }
    if (doubleSingleChanged) {
      resetKingdomCanvasPreviewShell(canvas)
    } else if (doubleModeChanged && current.doubleRenderActive) {
      purgeKingdomGlyphCanvasState()
    }
    if (shenModeChanged || shenCardLayoutChanged) {
      purgeKingdomGlyphCanvasState()
    }

    return { shenCardLayoutChanged }
  }

  const renderSingleKingdomBranch = async (
    info: LegendInfo,
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    effectiveReset: boolean,
    generation: number,
  ) => {
    const activePreset = resolveActiveKingdomPreset(info)
    if (activePreset) {
      clearDoubleKingdomGlyphItems(renderObj)
      const presetImage = await loadTrackedImage(
        'kingdom',
        '势力',
        resolveKingdomPresetAssetSrc(activePreset.asset),
      )
      if (generation !== loadGeneration) return
      const config = buildPresetKingdomConfig(
        'kingdom',
        '势力',
        renderObj,
        activePreset.key,
        presetImage,
        effectiveReset,
      )
      updateNode(renderObj, config, effectiveReset)
      return
    }

    if (shouldRenderSingleCustomKingdomGlyph(info)) {
      if (generation !== loadGeneration) return
      renderCustomSingleKingdom(renderObj, effectiveReset)
      return
    }

    clearDoubleKingdomGlyphItems(renderObj)
    const kingdomKey = resolveKingdomForSingleRender(info)
    const isPresetShenRender = usesShenCardLayout(info) && !isCustomKingdomActive(info)
    const config = buildKingdomConfig(
      'kingdom',
      '势力',
      renderObj,
      kingdomKey,
      await loadImageObj(kingdomKey, isPresetShenRender),
      effectiveReset,
    )
    if (generation !== loadGeneration) return
    updateNode(renderObj, config, effectiveReset)
  }

  const renderFullCustomDoubleKingdom = (
    info: LegendInfo,
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    pair: DoubleKingdomPair,
    effectiveReset: boolean,
    generation: number,
  ) => {
    const primaryCustom = resolveCustomKingdomDoubleTextForRender(info, 'primary')
    const secondaryCustom = resolveCustomKingdomDoubleTextForRender(info, 'secondary')

    if (generation !== loadGeneration) return
    syncDoubleKingdomGlyphItems(renderObj, pair, 'custom', 'custom', usesShenCardLayout(info))
    const children: CanvasItemConfig[] = [
      buildCustomTextGlyph(renderObj, 'primary', primaryCustom, 'primary', effectiveReset),
      buildCustomTextGlyph(renderObj, 'secondary', secondaryCustom, 'secondary', effectiveReset),
    ]
    renderObj.doubleGlyphKingdoms = {
      primary: layoutTrackKey(primaryCustom, CUSTOM_KINGDOM_LAYOUT_KEY),
      secondary: layoutTrackKey(secondaryCustom, CUSTOM_KINGDOM_LAYOUT_KEY),
    }
    if (generation !== loadGeneration) return
    buildGlyphGroup(renderObj, children)
  }

  const buildMixedDoubleKingdomChildren = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    pair: DoubleKingdomPair,
    primaryKey: string,
    secondaryKey: string,
    primaryCustomRaw: string,
    secondaryCustomRaw: string,
    primaryImg: KingdomImage | null,
    secondaryImg: KingdomImage | null,
    effectiveReset: boolean,
  ) => {
    const children: CanvasItemConfig[] = []
    if (primaryCustomRaw) {
      children.push(
        buildCustomTextGlyph(renderObj, 'primary', primaryCustomRaw, 'primary', effectiveReset),
      )
    } else if (primaryImg) {
      children.push(
        buildPresetDoubleGlyph(
          renderObj,
          'primary',
          pair.primary,
          primaryKey,
          primaryImg,
          effectiveReset,
        ),
      )
    }
    if (secondaryCustomRaw) {
      children.push(
        buildCustomTextGlyph(
          renderObj,
          'secondary',
          secondaryCustomRaw,
          'secondary',
          effectiveReset,
        ),
      )
    } else if (secondaryImg) {
      children.push(
        buildPresetDoubleGlyph(
          renderObj,
          'secondary',
          pair.secondary,
          secondaryKey,
          secondaryImg,
          effectiveReset,
        ),
      )
    }
    return children
  }

  const renderMixedDoubleKingdom = (
    info: LegendInfo,
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    pair: DoubleKingdomPair,
    primaryKey: string,
    secondaryKey: string,
    primaryCustomRaw: string,
    secondaryCustomRaw: string,
    primaryImg: KingdomImage | null,
    secondaryImg: KingdomImage | null,
    effectiveReset: boolean,
    generation: number,
  ) => {
    syncDoubleKingdomGlyphItems(
      renderObj,
      pair,
      primaryCustomRaw ? 'custom' : primaryKey,
      secondaryCustomRaw ? 'custom' : secondaryKey,
      usesShenCardLayout(info),
    )
    const children = buildMixedDoubleKingdomChildren(
      renderObj,
      pair,
      primaryKey,
      secondaryKey,
      primaryCustomRaw,
      secondaryCustomRaw,
      primaryImg,
      secondaryImg,
      effectiveReset,
    )
    renderObj.doubleGlyphKingdoms = {
      primary: layoutTrackKey(
        primaryCustomRaw,
        primaryCustomRaw ? CUSTOM_KINGDOM_LAYOUT_KEY : primaryKey,
      ),
      secondary: layoutTrackKey(
        secondaryCustomRaw,
        secondaryCustomRaw ? CUSTOM_KINGDOM_LAYOUT_KEY : secondaryKey,
      ),
    }
    if (generation !== loadGeneration) return
    buildGlyphGroup(renderObj, children)
  }

  const renderPresetDoubleKingdom = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    pair: DoubleKingdomPair,
    primaryKey: string,
    secondaryKey: string,
    primaryImg: KingdomImage,
    secondaryImg: KingdomImage,
    effectiveReset: boolean,
    generation: number,
  ) => {
    syncDoubleKingdomGlyphItems(renderObj, pair, primaryKey, secondaryKey)
    const children = [
      buildPresetDoubleGlyph(
        renderObj,
        'primary',
        pair.primary,
        primaryKey,
        primaryImg,
        effectiveReset,
      ),
      buildPresetDoubleGlyph(
        renderObj,
        'secondary',
        pair.secondary,
        secondaryKey,
        secondaryImg,
        effectiveReset,
      ),
    ]
    renderObj.doubleGlyphKingdoms = {
      primary: layoutTrackKey('', primaryKey),
      secondary: layoutTrackKey('', secondaryKey),
    }
    if (generation !== loadGeneration) return
    buildGlyphGroup(renderObj, children)
  }

  const renderDoubleKingdomBranch = async (
    info: LegendInfo,
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    pair: DoubleKingdomPair,
    effectiveReset: boolean,
    generation: number,
  ) => {
    const primaryKey = pair.primary
    const secondaryKey = pair.secondary
    const primaryCustomRaw = resolveDoubleCustomTextRaw(info, 'primary')
    const secondaryCustomRaw = resolveDoubleCustomTextRaw(info, 'secondary')

    if (isCustomKingdomActive(info) && hasCustomKingdomGlyphText(info)) {
      renderFullCustomDoubleKingdom(info, renderObj, pair, effectiveReset, generation)
      return
    }

    const [primaryImg, secondaryImg] = await Promise.all([
      primaryCustomRaw
        ? Promise.resolve(null)
        : loadTrackedImage(
            'kingdom',
            '势力',
            `${TEMPLATE_ASSET_BASE}/assets/kingdom/${primaryKey}.png`,
          ),
      secondaryCustomRaw
        ? Promise.resolve(null)
        : loadTrackedImage(
            'kingdom',
            '势力',
            `${TEMPLATE_ASSET_BASE}/assets/kingdom/${secondaryKey}.png`,
          ),
    ])
    if (generation !== loadGeneration) return

    if (primaryCustomRaw || secondaryCustomRaw) {
      renderMixedDoubleKingdom(
        info,
        renderObj,
        pair,
        primaryKey,
        secondaryKey,
        primaryCustomRaw,
        secondaryCustomRaw,
        primaryImg,
        secondaryImg,
        effectiveReset,
        generation,
      )
      return
    }

    renderPresetDoubleKingdom(
      renderObj,
      pair,
      primaryKey,
      secondaryKey,
      primaryImg!,
      secondaryImg!,
      effectiveReset,
      generation,
    )
  }

  /** 加载入口 */
  const load = async (isReset: boolean = false) => {
    if (isReset) {
      lastLoadSnapshot = {}
    }
    ensureCustomKingdomSetup(getLegendInfo())
    const generation = ++loadGeneration
    const currentInfo = getLegendInfo()
    if (currentInfo.renderConfig.items.kingdom.glyphEmptyFlag) {
      if (generation !== loadGeneration) return
      applyKingdomGlyphEmptyState(currentInfo.renderConfig.items.kingdom, isReset)
      return
    }

    const currentSnapshot = readKingdomLoadSnapshot(currentInfo)
    const { shenCardLayoutChanged } = handleKingdomModeTransitions(currentSnapshot)

    await ensureCustomKingdomFontLoaded(currentInfo, currentSnapshot.doublePair)
    if (generation !== loadGeneration) return

    const freshInfo = getLegendInfo()
    const freshSnapshot = readKingdomLoadSnapshot(freshInfo)
    const freshRenderObj = freshInfo.renderConfig.items.kingdom
    const masterFlagChanged = hasKingdomModeChanged(
      lastLoadSnapshot,
      'masterFlag',
      freshSnapshot,
    )
    if (masterFlagChanged) {
      purgeKingdomGlyphCanvasState()
    }

    const freshDoubleSingleRoleChanged =
      hasKingdomModeChanged(lastLoadSnapshot, 'doubleSingleRole', freshSnapshot) &&
      freshSnapshot.doubleSingleGlyph
    const freshEffectiveReset =
      isReset ||
      masterFlagChanged ||
      hasKingdomModeChanged(lastLoadSnapshot, 'isCustomShen', freshSnapshot) ||
      hasKingdomModeChanged(lastLoadSnapshot, 'doubleRenderActive', freshSnapshot) ||
      hasKingdomModeChanged(lastLoadSnapshot, 'doubleSingleGlyph', freshSnapshot) ||
      freshDoubleSingleRoleChanged ||
      shenCardLayoutChanged

    try {
      if (freshSnapshot.doublePair && freshSnapshot.doubleSingleGlyph) {
        if (generation !== loadGeneration) return
        await renderDoubleKingdomSingleGlyph(
          freshInfo,
          freshRenderObj,
          freshSnapshot.doublePair,
          freshEffectiveReset,
        )
        return
      }

      if (!freshSnapshot.doublePair) {
        await renderSingleKingdomBranch(
          freshInfo,
          freshRenderObj,
          freshEffectiveReset,
          generation,
        )
        return
      }

      await renderDoubleKingdomBranch(
        freshInfo,
        freshRenderObj,
        freshSnapshot.doublePair,
        freshEffectiveReset,
        generation,
      )
    } catch (error) {
      console.error(error)
    } finally {
      if (generation === loadGeneration) {
        syncLoadSnapshotFromInfo(getLegendInfo())
      }
    }
  }

  /** 离开双势力独立字渲染时，清掉画布与 ref 缓存，避免仍显示 kingdom-primary/secondary */
  const purgeKingdomGlyphCanvasState = () => {
    purgeKingdomGlyphPreviewState(canvas)
  }

  const ensureCustomKingdomFontLoaded = async (
    currentInfo: LegendInfo,
    doublePair: ReturnType<typeof resolveDoubleKingdomPair>,
  ) => {
    if (!usesCustomKingdomTextRendering(currentInfo)) return

    if (!doublePair) {
      if (resolveSingleCustomDisplayChars(currentInfo).length === 0) return
    } else if (!isCustomKingdomActive(currentInfo)) {
      const primaryCustom = resolveDoubleCustomTextRaw(currentInfo, 'primary')
      const secondaryCustom = resolveDoubleCustomTextRaw(currentInfo, 'secondary')
      if (!primaryCustom && !secondaryCustom) return
    }

    await loadWebFontFamily(resolveKingdomCustomFontFamily(currentInfo), {
      diyStore,
      label: '势力字体',
    })
  }

  const resolveGlyphColorFilters = (
    colorSlot: KingdomColorSlot,
    assetKeyOverride?: string,
  ) => {
    const { resolveKingdomGlyphTintFilters } = resolveKingdomTintContext()
    return resolveKingdomGlyphTintFilters(colorSlot, assetKeyOverride)
  }

  const attachLocalTextLayerPositions = (
    layers: CanvasItemConfig[],
    width: number,
    height: number,
  ): CanvasItemConfig[] =>
    layers.map((layer) => ({
      ...layer,
      ...getPosition(layer.originX ?? 0, layer.originY ?? 0, width, height),
    }))

  const buildCustomKingdomTextGroup = (
    code: string,
    label: string,
    text: string,
    layout: KingdomGlyphLayoutPx,
    measuredWidth: number,
    colorSlot: KingdomColorSlot,
    listening: boolean,
    fontSizePt: number,
  ): CanvasItemConfig => {
    const info = getLegendInfo()
    const officialGradientActive = isKingdomGlyphOfficialGradientActive(info)
    const officialGradientEnd = officialGradientActive
      ? resolveKingdomGlyphGradientEndColorHex(info, colorSlot)
      : undefined
    const layers = buildCustomKingdomTextLayerConfigs(
      {
        code,
        name: label,
        text,
        fontSize: layout.height,
        fontSizePt,
        fontFamily: fontFamily(),
        width: measuredWidth,
        height: layout.height,
        listening,
      },
      resolveKingdomGlyphTextColorHex(info, colorSlot),
      {
        shen: usesShenCardLayout(info),
        textGamutKey: resolveKingdomGlyphTextGamutKey(info, colorSlot),
        master: shouldUseMasterKingdomGlyphStyle(info),
        officialGradient: officialGradientEnd ? { endHex: officialGradientEnd } : undefined,
      },
    )

    return {
      code,
      name: label,
      width: measuredWidth,
      height: layout.height,
      fontSize: layout.height,
      rotation: 0,
      originX: layout.originX,
      originY: layout.originY,
      listening,
      children: attachLocalTextLayerPositions(layers, measuredWidth, layout.height),
      ...getPosition(layout.originX, layout.originY, measuredWidth, layout.height),
    }
  }

  const buildTextLayer = (
    text: string,
    layout: KingdomGlyphLayoutPx,
    code: string,
    label: string,
    renderObj: LayoutItem,
    resetLayout: boolean,
    colorSlot: KingdomColorSlot,
  ): CanvasItemConfig => {
    const info = getLegendInfo()
    const fontSize = layout.height
    const measuredWidth = Math.max(
      layout.width,
      new Konva.Text({
        text,
        fontFamily: fontFamily(),
        fontSize,
      }).width(),
    )

    const layoutAsShen = usesShenCardLayout(info)
    const textMode: 'single' | 'dual' = code === 'kingdom' ? 'single' : 'dual'
    const fontSizePt = resolveKingdomGlyphFontSizePt(renderObj, layoutAsShen, textMode)

    const config = usesCustomKingdomTextRendering(info)
      ? buildCustomKingdomTextGroup(
          code,
          label,
          text,
          layout,
          measuredWidth,
          colorSlot,
          true,
          fontSizePt,
        )
      : ({
          code,
          name: label,
          text,
          fontSize,
          fontFamily: fontFamily(),
          width: measuredWidth,
          height: layout.height,
          rotation: 0,
          originX: layout.originX,
          originY: layout.originY,
          listening: true,
          align: 'center',
          verticalAlign: 'middle',
          perfectDrawEnabled: true,
          fill: '#ffffff' as const,
          ...getPosition(layout.originX, layout.originY, measuredWidth, layout.height),
          ...resolveGlyphColorFilters(colorSlot),
        } as CanvasItemConfig)

    const merged = {
      ...config,
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]?.loadFunc ?? itemCacheMap.value?.kingdom?.loadFunc,
    } as CanvasItemConfig
    mergeConfig(renderObj, merged, contentOrigin(), diyStore.mmToPx, resetLayout)
    return merged
  }

  const buildGlyphLayer = (
    imageObj: KingdomImage,
    layout: KingdomGlyphLayoutPx,
    code: string,
    label: string,
    glyphRenderObj: LayoutItem,
    resetLayout: boolean,
    role: KingdomGlyphRole,
    assetKeyOverride?: string,
  ): CanvasItemConfig => {
    const { originX, originY, width, height } = layout
    const colorSlot: KingdomColorSlot = role === 'primary' ? 'primary' : 'secondary'
    const config = {
      code,
      name: label,
      width,
      height,
      image: markRaw(imageObj),
      rotation: 0,
      originX,
      originY,
      listening: true,
      ...getPosition(originX, originY, width, height),
      ...resolveGlyphColorFilters(colorSlot, assetKeyOverride),
      ...getDragger(glyphRenderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]?.loadFunc ?? itemCacheMap.value?.kingdom?.loadFunc,
    } as CanvasItemConfig
    mergeConfig(glyphRenderObj, config, contentOrigin(), diyStore.mmToPx, resetLayout)
    return config
  }

  const loadImageObj = (kingdomKey: string, isShen: boolean) => {
    const info = getLegendInfo()
    const { getKingdomGlyphAssetKingdom } = resolveKingdomTintContext()
    const assetKingdom = getKingdomGlyphAssetKingdom(kingdomKey)
    const useMasterAsset = shouldUseMasterKingdomGlyphAsset(info)
    const src = `${TEMPLATE_ASSET_BASE}/assets/kingdom/${assetKingdom}${!isShen && useMasterAsset ? '_master' : ''}.png`
    const taskId = useMasterAsset ? 'kingdom-master' : 'kingdom'
    return loadTrackedImage(taskId, '势力', src)
  }

  const buildPresetKingdomConfig = (
    code: string,
    name: string,
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    presetKey: string,
    imageObj: KingdomImage,
    resetLayout: boolean,
  ): CanvasItemConfig => {
    const info = getLegendInfo()
    const { resolveKingdomGlyphTintFilters } = resolveKingdomTintContext()
    const layoutKey = buildPresetKingdomLayoutKey(
      presetKey,
      usesShenCardLayout(info),
      isMasterFlagActive(info),
    )
    const effectiveResetLayout = trustHistorySnapshot()
      ? resetLayout
      : resetLayout ||
        renderObj.singlePresetGlyphKey !== layoutKey ||
        !hasKingdomGlyphPersistedLayout(renderObj)
    const layoutAsShen = usesShenCardLayout(info)
    ensureKingdomGlyphFontSizeItem(renderObj, layoutAsShen, 'single')
    const { originXMm, originYMm, widthPx } = resolveExtensionPresetKingdomGlyphLayout(
      presetKey,
      layoutAsShen,
      diyStore.mmToPx,
      renderObj,
    )
    const finalX = props.stageOrigin.x + units.mmToPx(originXMm)
    const finalY = props.stageOrigin.y + units.mmToPx(originYMm)
    const width = widthPx
    const height = (imageObj.height / imageObj.width) * width
    const fontSizePt = resolveKingdomGlyphFontSizePt(renderObj, layoutAsShen, 'single')
    const fillCode = `${code}-fill`

    const layers = buildPresetKingdomImageLayerConfigs(
      {
        code,
        name,
        image: markRaw(imageObj),
        width,
        height,
        fontSizePt,
        listening: true,
      },
      resolveKingdomGlyphTextColorHex(info, 'single'),
      {
        shen: layoutAsShen,
        master: shouldUseMasterKingdomGlyphStyle(info),
      },
    )

    const children = layers.map((layer) => ({
      ...layer,
      originX: 0,
      originY: 0,
      ...(layer.code === fillCode
        ? {
            ...resolveKingdomGlyphTintFilters('single'),
            listening: true,
          }
        : {}),
      ...getPosition(0, 0, width, height),
    }))

    const config = {
      code,
      name,
      width,
      height,
      rotation: 0,
      originX: finalX,
      originY: finalY,
      listening: true,
      children,
      ...getPosition(finalX, finalY, width, height),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as CanvasItemConfig
    mergeConfig(renderObj, config, contentOrigin(), diyStore.mmToPx, effectiveResetLayout)
    renderObj.singlePresetGlyphKey = layoutKey
    return config
  }

  const renderDoubleKingdomSingleGlyph = async (
    info: LegendInfo,
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    pair: DoubleKingdomPair,
    effectiveReset: boolean,
  ) => {
    const role = resolveDoubleKingdomSingleGlyphRole(info)
    const kingdomKey = role === 'secondary' ? pair.secondary : pair.primary
    const colorSlot: KingdomColorSlot = role
    const { getKingdomGlyphAssetKingdom } = resolveKingdomTintContext()
    const assetKey = getKingdomGlyphAssetKingdom(kingdomKey)
    const customRaw = resolveDoubleCustomTextRaw(info, role)
    const customText =
      customRaw ||
      (isCustomKingdomActive(info) ? resolveCustomKingdomDoubleTextForRender(info, role) : '')

    clearDoubleKingdomGlyphItems(renderObj)

    if (customText) {
      ensureKingdomGlyphFontSizeItem(renderObj, false, 'single')
      const useDefaultLayout = effectiveReset || !hasKingdomGlyphPersistedLayout(renderObj)
      const config = buildTextLayer(
        customText,
        resolveCustomSingleKingdomTextLayoutPx(
          kingdomLayoutCtx(),
          renderObj,
          useDefaultLayout,
          diyStore.mmToPx,
          false,
        ),
        'kingdom',
        '势力',
        renderObj,
        useDefaultLayout,
        colorSlot,
      )
      updateNode(renderObj, config, effectiveReset)
      return
    }

    const image = await loadTrackedImage(
      'kingdom',
      '势力',
      `${TEMPLATE_ASSET_BASE}/assets/kingdom/${assetKey}.png`,
    )
    const config = buildKingdomConfig(
      'kingdom',
      '势力',
      renderObj,
      kingdomKey,
      image,
      effectiveReset,
      colorSlot,
    )
    updateNode(renderObj, config, effectiveReset)
  }

  const buildKingdomConfig = (
    code: string,
    name: string,
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    kingdomKey: string,
    imageObj: KingdomImage,
    resetLayout: boolean,
    colorSlot: KingdomColorSlot = 'single',
  ): CanvasItemConfig => {
    const info = getLegendInfo()
    const layoutKey = buildSinglePresetGlyphLayoutKey(info, kingdomKey)
    const useShenFramePresetLayout = layoutKey.endsWith(':shen-frame')
    const layoutKingdomKey = layoutKey.split(':')[0]!
    const effectiveResetLayout =
      resetLayout ||
      (!trustHistorySnapshot() &&
        shouldResetSinglePresetKingdomLayout(info, renderObj, layoutKey))
    const { x, y, width } = resolvePresetKingdomGlyphLayoutMm(
      layoutKingdomKey,
      useShenFramePresetLayout,
    )
    const finalX = props.stageOrigin.x + units.mmToPx(x)
    const finalY = props.stageOrigin.y + units.mmToPx(y)
    const height = (imageObj.height / imageObj.width) * width

    const config = {
      code,
      name,
      width,
      height,
      image: markRaw(imageObj),
      children: [],
      rotation: 0,
      originX: finalX,
      originY: finalY,
      listening: true,
      ...getPosition(finalX, finalY, width, height),
      ...resolveGlyphColorFilters(colorSlot, kingdomKey),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as CanvasItemConfig
    mergeConfig(renderObj, config, contentOrigin(), diyStore.mmToPx, effectiveResetLayout)
    renderObj.singlePresetGlyphKey = layoutKey
    return config
  }

  const buildGlyphGroup = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    children: CanvasItemConfig[],
  ) => {
    const groupConfig: CanvasItemConfig = {
      code: 'kingdom',
      name: '势力',
      listening: false,
      children,
      loadFunc: itemCacheMap.value?.kingdom?.loadFunc,
    }
    updateNode(renderObj, groupConfig, false)
    // 双势力字叠层独立挂载时，须同步 kingdom-primary/secondary 到 canvasConfigs 才能刷滤镜 cache
    for (const child of children) {
      if (!isKingdomGlyphCode(child.code)) continue
      const glyphRenderObj = renderObj.doubleGlyphs?.[child.code]
      if (!glyphRenderObj) continue
      updateNode(glyphRenderObj, child, false, { skipLayoutMerge: true })
    }
  }

  const hideKingdomLayer = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    isReset: boolean,
  ) => {
    clearDoubleKingdomGlyphItems(renderObj)
    const config: CanvasItemConfig = {
      code: 'kingdom',
      name: '势力',
      width: 0,
      height: 0,
      originX: 0,
      originY: 0,
      rotation: 0,
      listening: false,
      children: [],
      loadFunc: itemCacheMap.value?.kingdom?.loadFunc,
    }
    updateNode(renderObj, config, isReset)
  }

  const buildCustomTextGlyph = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    role: KingdomGlyphRole,
    text: string,
    colorSlot: KingdomColorSlot,
    isReset: boolean,
  ) => {
    const info = getLegendInfo()
    const glyphCode = getKingdomGlyphCode(role)
    const glyphRenderObj = renderObj.doubleGlyphs![glyphCode]!
    glyphRenderObj.name = formatCustomKingdomGlyphName(text)
    const trackKey = layoutTrackKey(text, CUSTOM_KINGDOM_LAYOUT_KEY)
    const useDefaultLayout = trustHistorySnapshot()
      ? isReset
      : isReset ||
        shouldResetKingdomGlyphLayout(renderObj, role, trackKey) ||
        !hasKingdomGlyphPersistedLayout(glyphRenderObj)
    const layoutPx = resolveCustomTextGlyphLayoutPx(
      role,
      kingdomLayoutCtx(),
      glyphRenderObj,
      useDefaultLayout,
      diyStore.mmToPx,
      resolveKingdomCustomDualCharSpacingMm(info),
      usesShenCardLayout(info),
    )
    return buildTextLayer(
      text,
      layoutPx,
      glyphCode,
      glyphRenderObj.name,
      glyphRenderObj,
      useDefaultLayout,
      colorSlot,
    )
  }

  const buildPresetDoubleGlyph = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    role: KingdomGlyphRole,
    kingdomLabelKey: string,
    assetKey: string,
    image: KingdomImage,
    effectiveReset: boolean,
  ) => {
    const glyphCode = getKingdomGlyphCode(role)
    const glyphRenderObj = renderObj.doubleGlyphs![glyphCode]!
    glyphRenderObj.name = formatKingdomGlyphName(kingdomLabelKey)
    const trackKey = layoutTrackKey('', assetKey)
    const useDefaultLayout = trustHistorySnapshot()
      ? effectiveReset
      : effectiveReset ||
        shouldResetKingdomGlyphLayout(renderObj, role, trackKey) ||
        !hasKingdomGlyphPersistedLayout(glyphRenderObj)
    const layoutPx = resolveKingdomGlyphLayoutPxFromImage(
      assetKey,
      role,
      image,
      kingdomLayoutCtx(),
      glyphRenderObj,
      useDefaultLayout,
    )
    return buildGlyphLayer(
      image,
      layoutPx,
      glyphCode,
      glyphRenderObj.name,
      glyphRenderObj,
      useDefaultLayout,
      role,
      assetKey,
    )
  }

  /** 单势力自定义双字：固定左上/右下，仅 kingdom 组可拖拽 */
  const buildSingleCustomDualCharGroup = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    first: string,
    second: string,
    isReset: boolean,
    isShen: boolean,
  ) => {
    const info = getLegendInfo()
    clearDoubleKingdomGlyphItems(renderObj)

    const groupAnchorMm = resolveCustomKingdomDualGroupAnchorMm(
      resolveKingdomCustomDualCharSpacingMm(info),
      isShen,
    )

    ensureKingdomGlyphFontSizeItem(renderObj, isShen, 'dual')
    const fontSizePx = resolveKingdomGlyphFontSizePx(renderObj, diyStore.mmToPx, isShen, 'dual')
    const spacingMm = resolveKingdomCustomDualCharSpacingMm(info)

    const resolveDualCharLayoutInGroupPx = (slot: DoubleKingdomGlyphSlot) => {
      const entry = resolveCustomKingdomDualCharSlotMm(slot, spacingMm, isShen)
      const { width, height } = resolveKingdomTextBoxFromFontSizePx(fontSizePx)
      return {
        originX: units.mmToPx(entry.x - groupAnchorMm.x),
        originY: units.mmToPx(entry.y - groupAnchorMm.y),
        width,
        height,
      }
    }

    const buildFixedChild = (text: string, slot: DoubleKingdomGlyphSlot, childCode: string) => {
      const layout = resolveDualCharLayoutInGroupPx(slot)
      const fontSize = layout.height
      const measuredWidth = Math.max(
        layout.width,
        new Konva.Text({ text, fontFamily: fontFamily(), fontSize }).width(),
      )
      return buildCustomKingdomTextGroup(
        childCode,
        `势力_${text}`,
        text,
        layout,
        measuredWidth,
        'single',
        false,
        resolveKingdomGlyphFontSizePt(renderObj, isShen, 'dual'),
      )
    }

    const topLeftChild = buildFixedChild(first, 'top', 'kingdom-dual-tl')
    const bottomRightChild = buildFixedChild(second, 'bottom', 'kingdom-dual-br')
    const boxLeft = Math.min(topLeftChild.originX!, bottomRightChild.originX!)
    const boxTop = Math.min(topLeftChild.originY!, bottomRightChild.originY!)
    const boxRight = Math.max(
      topLeftChild.originX! + (topLeftChild.width ?? 0),
      bottomRightChild.originX! + (bottomRightChild.width ?? 0),
    )
    const boxBottom = Math.max(
      topLeftChild.originY! + (topLeftChild.height ?? 0),
      bottomRightChild.originY! + (bottomRightChild.height ?? 0),
    )
    const groupWidth = boxRight - boxLeft
    const groupHeight = boxBottom - boxTop
    const useDefaultGroupLayout =
      isReset || !hasKingdomGlyphPersistedLayout(renderObj)
    const defaultGroupOriginX =
      contentOrigin().x + units.mmToPx(groupAnchorMm.x) + boxLeft
    const defaultGroupOriginY =
      contentOrigin().y + units.mmToPx(groupAnchorMm.y) + boxTop
    const groupOriginX = useDefaultGroupLayout
      ? defaultGroupOriginX
      : contentOrigin().x + units.mmToPx(renderObj.x)
    const groupOriginY = useDefaultGroupLayout
      ? defaultGroupOriginY
      : contentOrigin().y + units.mmToPx(renderObj.y)

    const normalizeChildInGroup = (child: CanvasItemConfig): CanvasItemConfig => {
      const w = child.width ?? 0
      const h = child.height ?? 0
      const originX = (child.originX ?? 0) - boxLeft
      const originY = (child.originY ?? 0) - boxTop
      return {
        ...child,
        originX,
        originY,
        ...getPosition(originX, originY, w, h),
      }
    }

    const textChildren = [topLeftChild, bottomRightChild].map(normalizeChildInGroup)
    const hitLayer: CanvasItemConfig = {
      code: KINGDOM_DUAL_CHAR_HIT_CODE,
      name: '势力',
      width: groupWidth,
      height: groupHeight,
      fill: 'rgba(0,0,0,0.001)',
      listening: true,
      ...getPosition(0, 0, groupWidth, groupHeight),
    }
    const children = [hitLayer, ...textChildren]

    const groupConfig: CanvasItemConfig = {
      code: 'kingdom',
      name: '势力',
      width: groupWidth,
      height: groupHeight,
      fontSize: fontSizePx,
      rotation: 0,
      originX: groupOriginX,
      originY: groupOriginY,
      listening: true,
      children,
      ...getPosition(groupOriginX, groupOriginY, groupWidth, groupHeight),
      ...getDragger(renderObj, 'kingdom'),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.kingdom?.loadFunc,
    }
    updateNode(renderObj, groupConfig, isReset)
  }

  /** 单势力自定义字（普通 / 神势力同一管线，仅布局预设与样式不同） */
  const renderCustomSingleKingdom = (
    renderObj: LegendInfo['renderConfig']['items']['kingdom'],
    effectiveReset: boolean,
  ) => {
    const currentInfo = getLegendInfo()
    const layoutAsShen = usesShenCardLayout(currentInfo)
    const layoutModeChanged = hasKingdomModeChanged(
      lastLoadSnapshot,
      'shenCardLayout',
      readKingdomLoadSnapshot(currentInfo),
    )
    const layoutEffectiveReset = effectiveReset || layoutModeChanged
    const singleChars = resolveSingleCustomDisplayChars(currentInfo)

    if (singleChars.length >= 2) {
      buildSingleCustomDualCharGroup(
        renderObj,
        singleChars[0]!,
        singleChars[1]!,
        layoutEffectiveReset,
        layoutAsShen,
      )
      return
    }

    clearDoubleKingdomGlyphItems(renderObj)

    if (singleChars.length === 1) {
      const useDefaultLayout =
        layoutEffectiveReset || !hasKingdomGlyphPersistedLayout(renderObj)
      const config = buildTextLayer(
        singleChars[0]!,
        resolveCustomSingleKingdomTextLayoutPx(
          kingdomLayoutCtx(),
          renderObj,
          useDefaultLayout,
          diyStore.mmToPx,
          layoutAsShen,
        ),
        'kingdom',
        '势力',
        renderObj,
        useDefaultLayout,
        'single',
      )
      updateNode(renderObj, config, layoutEffectiveReset)
      return
    }

    hideKingdomLayer(renderObj, layoutEffectiveReset)
  }

  return load
}
