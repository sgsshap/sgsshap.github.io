import {
  isCustomKingdomActive,
  isDoubleKingdomRenderActive,
  isShenSingleKingdomActive,
  resolveCustomKingdomColorHex,
  shouldCustomShenTitleUseKingdomColor,
  usesShenCardLayout,
} from '@/features/diy-card/composables/doubleKingdom'
import {
  isCustomTitleColorActive,
  resolveCustomTitleColorHex,
  resolveTunedTitleFillColorHex,
} from '@/features/diy-card/utils/customTitleColor'
import { useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore, useDiyHistoryStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  createDiyUnitConverters,
  getPosition,
  ptCharacterSpacingToLineHeight,
} from '@/features/diy-card/utils/canvas'
import { loadWebFontFamily, waitForWebFontFamily, whenWebFontFamilyReady, buildFontProbe } from '@/features/diy-card/utils/loadWebFontFamily'
import Konva from 'konva'
import { computed } from 'vue'
import { resolveLegendTitleDisplayName } from '@/features/diy-card/utils/ch-trans'
import {
  TITLE_COLORS,
  TITLE_FONT_FAMILY,
  TITLE_LAYOUTS,
  TITLE_SHEN_LAYOUT_OFFSET_X_MM,
  TITLE_SHEN_LAYOUT_OFFSET_Y_MM,
  resolveTitleDefaultCharacterSpacingPt,
} from '../../constants/title'
import { findLayoutByCharCount, isStaleShenTextPresetLayout } from '../../layout/textLayout'
import { resolveCardTextLayoutKey } from '../../layout/cardTextLayout'
import { shouldTrustHistorySnapshotLayout } from '@/features/diy-card/utils/historyLayoutBootstrap'

/**
 * 绘制称号
 * @param canvas 画布状态
 */
export function drawTitle(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const historyStore = useDiyHistoryStore()
  const trustHistorySnapshot = () =>
    shouldTrustHistorySnapshotLayout({
      bootstrappedKinds: historyStore.bootstrappedKinds,
      activeInfoKind: historyStore.activeInfoKind,
      canvasBootstrapPending: diyStore.canvasBootstrapPending,
    })
  const { info, props, updateNode, getDragger, getSelectHandlers, itemCacheMap } = canvas
  const units = createDiyUnitConverters(diyStore.mmToPx)
  const { getFilters } = useKonvaBrightnessFilters()

  const displayTitle = computed(() =>
    resolveLegendTitleDisplayName(
      info.baseInfo.title,
      info.renderConfig.items.title.convertTChFlag,
    ),
  )
  const finalTitle = computed(() => displayTitle.value.split('').join('\n'))

  let lastResolvedTitleCharCount: number | undefined
  let cancelTitleFontReadyWatch: (() => void) | undefined

  const TITLE_FONT_PROBE = buildFontProbe(TITLE_FONT_FAMILY, 'bold')

  /** 构建并写入称号 Konva 配置 */
  const renderTitle = (isReset: boolean) => {
    const code = 'title'
    const name = '称号'
    const renderObj = info.renderConfig.items[code]
    const isShenTitle = isShenSingleKingdomActive(info)
    const useShenTitleGlow =
      isShenTitle &&
      !shouldCustomShenTitleUseKingdomColor(info) &&
      !isCustomTitleColorActive(info)

    const layout = resolveTitleLayout(isReset)
    const fillColor = getTitleFillColor()
    const children: CanvasItemConfig[] = [
      ...(useShenTitleGlow ? buildShenTitleGlowConfigs(layout) : [buildShadowConfig(layout)]),
      buildStrokeWhiteConfig(layout),
      buildStrokeBlackConfig(layout),
      buildTextConfig(layout, fillColor),
    ]
    const groupConfig = buildGroupConfig(code, name, renderObj, layout, children)
    updateNode(renderObj, groupConfig, isReset)
  }

  /** 加载入口 */
  const load = async (isReset: boolean = false) => {
    cancelTitleFontReadyWatch?.()
    cancelTitleFontReadyWatch = undefined

    await loadWebFontFamily(TITLE_FONT_FAMILY, {
      diyStore,
      label: '称号字体',
      probe: TITLE_FONT_PROBE,
    })
    const fontReady = await waitForWebFontFamily(TITLE_FONT_FAMILY, { probe: TITLE_FONT_PROBE })

    const code = 'title'
    const name = '称号'
    await diyStore.runWithLoading(code, name, async () => {
      renderTitle(isReset)
    })

    if (!fontReady) {
      cancelTitleFontReadyWatch = whenWebFontFamilyReady(
        TITLE_FONT_FAMILY,
        () => {
          renderTitle(false)
        },
        { probe: TITLE_FONT_PROBE },
      )
    }
  }

  /** 填充色 */
  const getTitleFillColor = () => {
    if (isCustomTitleColorActive(info)) {
      return resolveTunedTitleFillColorHex(
        resolveCustomTitleColorHex(
          info,
          isDoubleKingdomRenderActive(info) ? 'primary' : 'single',
        ),
      )
    }

    const kingdom = info.baseInfo.kingdom
    const isShen = isShenSingleKingdomActive(info)

    const resolveCustomTitleColor = () =>
      resolveTunedTitleFillColorHex(
        resolveCustomKingdomColorHex(
          info,
          isDoubleKingdomRenderActive(info) ? 'primary' : 'single',
        ),
      )

    if (shouldCustomShenTitleUseKingdomColor(info)) {
      return resolveCustomTitleColor()
    }
    if (isShen || !info.baseInfo.masterFlag) {
      return TITLE_COLORS[0]
    }
    if (isCustomKingdomActive(info)) {
      return resolveCustomTitleColor()
    }
    if (kingdom === 'wei') return TITLE_COLORS[1]
    if (kingdom === 'shu') return TITLE_COLORS[2]
    if (kingdom === 'wu') return TITLE_COLORS[3]
    if (kingdom === 'qun') return TITLE_COLORS[4]
    if (kingdom === 'jin') return TITLE_COLORS[5]
    return undefined
  }

  /** 布局度量 */
  const resolveTitleLayout = (isReset: boolean) => {
    const renderObj = info.renderConfig.items.title
    const charCount = displayTitle.value.length
    const charCountChanged =
      lastResolvedTitleCharCount !== undefined && lastResolvedTitleCharCount !== charCount
    lastResolvedTitleCharCount = charCount
    const layoutTable = findLayoutByCharCount(TITLE_LAYOUTS, charCount)!
    const shenLayoutOffset = usesShenCardLayout(info)
    const cardLayoutKey = resolveCardTextLayoutKey(info)
    const layoutKeyStale =
      renderObj.textCardLayoutKey !== undefined &&
      renderObj.textCardLayoutKey !== cardLayoutKey
    const hasPersistedSize = !isReset && typeof renderObj.size === 'number' && renderObj.size > 0
    const hasStalePresetLayout =
      !isReset &&
      isStaleShenTextPresetLayout(
        renderObj,
        TITLE_LAYOUTS,
        charCount,
        TITLE_SHEN_LAYOUT_OFFSET_X_MM,
        TITLE_SHEN_LAYOUT_OFFSET_Y_MM,
        shenLayoutOffset,
      )
    const hasCustomLayout =
      !layoutKeyStale &&
      !hasStalePresetLayout &&
      (trustHistorySnapshot()
        ? !isReset && hasPersistedSize
        : !isReset && !charCountChanged && hasPersistedSize)

    let currentFontSizePt: number
    let currentX: number
    let currentY: number

    if (hasCustomLayout) {
      currentFontSizePt = renderObj.size!
      currentX = renderObj.x
      currentY = renderObj.y
    } else {
      currentFontSizePt = layoutTable.fontSize
      currentX = shenLayoutOffset
        ? layoutTable.x + TITLE_SHEN_LAYOUT_OFFSET_X_MM
        : layoutTable.x
      currentY = shenLayoutOffset
        ? layoutTable.y + TITLE_SHEN_LAYOUT_OFFSET_Y_MM
        : layoutTable.y
      info.renderConfig.items.title.characterSpacing = resolveTitleDefaultCharacterSpacingPt(
        charCount,
        shenLayoutOffset,
      )
      renderObj.x = currentX
      renderObj.y = currentY
      renderObj.textCardLayoutKey = cardLayoutKey
    }

    const characterSpacingPt = info.renderConfig.items.title.characterSpacing

    const fontSizePx = units.ptToPx(currentFontSizePt)
    const lineHeight = ptCharacterSpacingToLineHeight(
      characterSpacingPt,
      fontSizePx,
      diyStore.mmToPx,
    )
    const tempTextConfig = {
      text: finalTitle.value,
      originX: 0,
      originY: 0,
      fontSize: fontSizePx,
      fontFamily: TITLE_FONT_FAMILY,
      lineHeight,
      align: 'center' as const,
    }
    const measured = new Konva.Text({ ...tempTextConfig, fontStyle: 'bold' })

    return {
      width: measured.width(),
      height: measured.height() + 20,
      fontSizePx,
      originX: props.stageOrigin.x + units.mmToPx(currentX),
      originY: props.stageOrigin.y + units.mmToPx(currentY),
      tempTextConfig,
    }
  }

  /** 神势力称号外发光（多层 shadowBlur 模拟柔和光晕） */
  const buildShenTitleGlowConfigs = (layout: {
    width: number
    height: number
    fontSizePx: number
    tempTextConfig: Record<string, unknown>
  }): CanvasItemConfig[] => {
    const glowTextBase = {
      ...layout.tempTextConfig,
      fontStyle: 'bold' as const,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      listening: false,
      perfectDrawEnabled: true,
      ...getPosition(0, 0, layout.width, layout.height),
      ...getFilters(),
    }

    const glowLayers = [
      {
        code: 'title-glow-1',
        name: '称号-外发光-1',
        fill: 'rgba(255, 250, 215, 0.28)',
        shadowColor: 'rgba(255, 252, 230, 0.72)',
        shadowBlur: 3,
      },
      {
        code: 'title-glow-2',
        name: '称号-外发光-2',
        fill: 'rgba(255, 248, 175, 0.42)',
        shadowColor: 'rgba(255, 250, 195, 0.82)',
        shadowBlur: 3,
      },
      {
        code: 'title-glow-3',
        name: '称号-外发光-3',
        fill: 'rgba(255, 248, 175, 0.42)',
        shadowColor: 'rgba(255, 250, 195, 0.82)',
        shadowBlur: 3,
      },
      {
        code: 'title-glow-4',
        name: '称号-外发光-4',
        fill: 'rgba(255, 255, 190, 0.55)',
        shadowColor: 'rgba(255, 255, 210, 0.9)',
        shadowBlur: 3,
      },
    ]

    return glowLayers.map(
      (layer) =>
        ({
          ...glowTextBase,
          ...layer,
          height: layout.height,
          width: layout.width,
        }) as CanvasItemConfig,
    )
  }

  /** 阴影子节点 */
  const buildShadowConfig = (layout: {
    width: number
    height: number
    tempTextConfig: Record<string, unknown>
  }): CanvasItemConfig => {
    const shadowX = units.mmToPx(0.25)
    const shadowY = units.mmToPx(0.23)
    return {
      code: 'title-shadow',
      name: '称号-阴影',
      height: layout.height,
      ...layout.tempTextConfig,
      originX: shadowX,
      originY: shadowY,
      fill: 'rgba(0,0,0,0.9)',
      perfectDrawEnabled: true,
      ...getPosition(shadowX, shadowY, layout.width, layout.height),
      ...getFilters(),
    } as CanvasItemConfig
  }

  /** 白色描边子节点 */
  const buildStrokeWhiteConfig = (layout: {
    width: number
    height: number
    tempTextConfig: Record<string, unknown>
  }): CanvasItemConfig =>
    ({
      code: 'title-stroke-white',
      name: '称号-描边-白',
      height: layout.height,
      ...layout.tempTextConfig,
      fill: 'rgba(220, 220, 220, 0.8)',
      stroke: 'rgba(220, 220, 220, 0.8)',
      strokeWidth: 0.1 + 2.2,
      lineJoin: 'round',
      lineCap: 'round',
      perfectDrawEnabled: true,
      ...getPosition(0, 0, layout.width, layout.height),
      ...getFilters(),
    }) as CanvasItemConfig

  /** 黑色描边子节点 */
  const buildStrokeBlackConfig = (layout: {
    width: number
    height: number
    tempTextConfig: Record<string, unknown>
  }): CanvasItemConfig =>
    ({
      code: 'title-stroke-black',
      name: '称号-描边-黑',
      height: layout.height,
      ...layout.tempTextConfig,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 2.3,
      lineJoin: 'round',
      lineCap: 'round',
      perfectDrawEnabled: true,
      ...getPosition(0, 0, layout.width, layout.height),
      ...getFilters(),
    }) as CanvasItemConfig

  /** 正文子节点 */
  const buildTextConfig = (
    layout: { width: number; height: number; tempTextConfig: Record<string, unknown> },
    fillColor: string | undefined,
  ): CanvasItemConfig =>
    ({
      code: 'title-text',
      name: '称号-文本',
      height: layout.height,
      ...layout.tempTextConfig,
      fill: fillColor,
      perfectDrawEnabled: true,
      ...getPosition(0, 0, layout.width, layout.height),
      ...getFilters(),
    }) as CanvasItemConfig

  /** group 根节点 */
  const buildGroupConfig = (
    code: string,
    name: string,
    renderObj: LegendInfo['renderConfig']['items']['title'],
    layout: { width: number; height: number; fontSizePx: number; originX: number; originY: number },
    children: CanvasItemConfig[],
  ): CanvasItemConfig =>
    ({
      code,
      name,
      width: layout.width,
      height: layout.height,
      originX: layout.originX,
      originY: layout.originY,
      fontSize: layout.fontSizePx,
      rotation: 0,
      children,
      ...getPosition(layout.originX, layout.originY, layout.width, layout.height),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    }) as CanvasItemConfig

  return load
}
