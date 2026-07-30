import { useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore, useDiyHistoryStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { resolveStageContentOriginFromDiy } from '@/features/diy-card/composables/konva/konvaStageEdgeSnap'
import {
  applyNameSplitFlagChange,
  ensureNameSplitChars,
  applySplitCharBoxFromAnchor,
  getNameSplitCharCode,
  initSplitCharLayoutFromSlot,
  measureVerticalNameCharLayouts,
  resolveSplitCharClip,
  resolveSplitCharRenderLayout,
  NAME_FONT_FAMILY,
  type NameSplitCharLayout,
} from '@/features/diy-card/utils/nameSplit'
import {
  createDiyUnitConverters,
  getPosition,
  mergeConfig,
  ptCharacterSpacingToLineHeight,
} from '@/features/diy-card/utils/canvas'
import { loadWebFontFamily } from '@/features/diy-card/utils/loadWebFontFamily'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import Konva from 'konva'
import { computed } from 'vue'
import { usesShenCardLayout } from '@/features/diy-card/composables/doubleKingdom'
import { resolveLegendNameDisplayName } from '@/features/diy-card/utils/ch-trans'
import {
  NAME_LAYOUTS,
  NAME_SHEN_LAYOUT_OFFSET_X_MM,
  NAME_SHEN_LAYOUT_OFFSET_Y_MM,
} from '../../constants/name'
import { findLayoutByCharCount, isStaleShenTextPresetLayout } from '../../layout/textLayout'
import { resolveCardTextLayoutKey } from '../../layout/cardTextLayout'
import { shouldTrustHistorySnapshotLayout } from '@/features/diy-card/utils/historyLayoutBootstrap'

type NameLayout = {
  width: number
  height: number
  fontSizePx: number
  fontSizePt: number
  originX: number
  originY: number
  tempTextConfig: Record<string, unknown>
  borderTextConfig: Record<string, unknown>
  charLayouts: NameSplitCharLayout[]
}

/**
 * 绘制名称
 * @param canvas 画布状态
 */
export function drawName(canvas: TemplateCanvasState) {
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

  const displayName = computed(() =>
    resolveLegendNameDisplayName(
      info.baseInfo.name,
      info.renderConfig.items.name.convertTChFlag,
    ),
  )
  const finalName = computed(() => displayName.value.split('').join('\n'))
  const nameChars = computed(() => displayName.value.split(''))

  /** 加载入口 */
  const load = async (isReset: boolean = false) => {
    await loadWebFontFamily(NAME_FONT_FAMILY, {
      diyStore,
      label: '武将名字体',
    })

    const code = 'name'
    await diyStore.runWithLoading(code, '武将名', async () => {
      const renderObj = info.renderConfig.items[code]
      const splitFlag = renderObj.splitFlag
      const nameLayoutTable = findLayoutByCharCount(NAME_LAYOUTS, displayName.value.length)!

      if (!splitFlag && renderObj.splitChars) {
        applyNameSplitFlagChange(info, false, {
          chars: nameChars.value,
          charLayouts: [],
          groupOriginXPx: 0,
          groupOriginYPx: 0,
          fontSizePt: nameLayoutTable.fontSize,
          converters: units,
        })
      }

      const layout = resolveNameLayout(isReset)

      if (splitFlag) {
        if (isReset || !renderObj.splitChars) {
          delete renderObj.splitChars
          applyNameSplitFlagChange(info, true, {
            chars: nameChars.value,
            charLayouts: layout.charLayouts,
            groupOriginXPx: layout.originX,
            groupOriginYPx: layout.originY,
            fontSizePt: layout.fontSizePt,
            converters: units,
          })
        } else {
          ensureNameSplitChars(info, {
            chars: nameChars.value,
            charLayouts: layout.charLayouts,
            groupOriginXPx: layout.originX,
            groupOriginYPx: layout.originY,
            fontSizePt: layout.fontSizePt,
            converters: units,
          })
        }

        const charChildren = buildSplitCharGroupChildren(layout, isReset)
        const groupConfig = buildSplitParentGroupConfig(code, layout, charChildren)
        updateNode(renderObj, groupConfig, isReset)
        return
      }

      const children = [
        buildShadowConfig(layout),
        buildStrokeWhiteConfig(layout),
        buildStrokeBlackConfig(layout),
        buildTextConfig(layout),
      ]
      const groupConfig = buildGroupConfig(code, '武将名', renderObj, layout, children)
      updateNode(renderObj, groupConfig, isReset)
    })
  }

  /** 布局度量 */
  const resolveNameLayout = (isReset: boolean): NameLayout => {
    const renderObj = info.renderConfig.items.name
    const layoutAsShen = usesShenCardLayout(info)
    const cardLayoutKey = resolveCardTextLayoutKey(info)
    const layoutKeyStale =
      renderObj.textCardLayoutKey !== undefined &&
      renderObj.textCardLayoutKey !== cardLayoutKey
    const layoutTable = findLayoutByCharCount(NAME_LAYOUTS, displayName.value.length)!

    let currentFontSizePt: number
    let currentX: number
    let currentY: number
    const hasPersistedSize = !isReset && typeof renderObj.size === 'number' && renderObj.size > 0
    const hasStalePresetLayout =
      !isReset &&
      isStaleShenTextPresetLayout(
        renderObj,
        NAME_LAYOUTS,
        displayName.value.length,
        NAME_SHEN_LAYOUT_OFFSET_X_MM,
        NAME_SHEN_LAYOUT_OFFSET_Y_MM,
        layoutAsShen,
      )
    const hasCustomLayout =
      !layoutKeyStale &&
      !hasStalePresetLayout &&
      (trustHistorySnapshot() ? !isReset && hasPersistedSize : hasPersistedSize)

    if (hasCustomLayout) {
      currentFontSizePt = renderObj.size!
      currentX = renderObj.x
      currentY = renderObj.y
    } else {
      currentFontSizePt = layoutTable.fontSize
      currentX = layoutAsShen
        ? layoutTable.x + NAME_SHEN_LAYOUT_OFFSET_X_MM
        : layoutTable.x
      currentY = layoutAsShen
        ? layoutTable.y + NAME_SHEN_LAYOUT_OFFSET_Y_MM
        : layoutTable.y
      info.renderConfig.items.name.characterSpacing = layoutTable.characterSpacingPt
      // 拆分单字按 nameItem.x/y 计算绝对坐标，需与模板默认布局（含神势力偏移）保持一致
      renderObj.x = currentX
      renderObj.y = currentY
      renderObj.textCardLayoutKey = cardLayoutKey
    }

    const characterSpacingPt = info.renderConfig.items.name.characterSpacing

    const fontSizePx = units.ptToPx(currentFontSizePt)
    const lineHeight = ptCharacterSpacingToLineHeight(
      characterSpacingPt,
      fontSizePx,
      diyStore.mmToPx,
    )
    const tempTextConfig = {
      text: finalName.value,
      fontSize: fontSizePx,
      fontFamily: NAME_FONT_FAMILY,
      lineHeight,
      align: 'center' as const,
    }
    const borderTextConfig = { ...tempTextConfig, fontStyle: 'bold' as const }
    const measured = new Konva.Text(borderTextConfig)
    const { chars: charLayouts } = measureVerticalNameCharLayouts(
      nameChars.value,
      { fontSize: fontSizePx, lineHeight, align: 'center' },
    )

    return {
      width: measured.width(),
      height: measured.height() + 20,
      fontSizePx,
      fontSizePt: currentFontSizePt,
      originX: props.stageOrigin.x + units.mmToPx(currentX),
      originY: props.stageOrigin.y + units.mmToPx(currentY),
      tempTextConfig,
      borderTextConfig,
      charLayouts,
    }
  }

  const resolveCharFontSizePx = (charRenderObj: LayoutItem, defaultPx: number) =>
    typeof charRenderObj.size === 'number' && charRenderObj.size > 0
      ? units.ptToPx(charRenderObj.size)
      : defaultPx

  /** 单字 group 的描边/阴影/正文子层 */
  const buildCharLayerChildren = (
    char: string,
    charLayout: NameSplitCharLayout,
    charFontSizePx: number,
    lineHeight: number,
  ): CanvasItemConfig[] => {
    const shadowX = units.mmToPx(0.34)
    const shadowY = units.mmToPx(0.4)
    const w = charLayout.width
    const h = charLayout.height
    const textBase = {
      fontSize: charFontSizePx,
      fontFamily: NAME_FONT_FAMILY,
      lineHeight,
      align: 'center' as const,
      text: char,
    }
    const singleText = { ...textBase }
    const singleBorder = { ...textBase, fontStyle: 'bold' as const }

    const visualLayers: CanvasItemConfig[] = [
      {
        code: 'shadow',
        name: '阴影',
        height: h,
        width: w,
        ...singleText,
        originX: shadowX,
        originY: shadowY,
        fill: 'rgba(0,0,0,0.8)',
        perfectDrawEnabled: true,
        listening: false,
        ...getPosition(shadowX, shadowY, w, h),
        ...getFilters(),
      } as CanvasItemConfig,
      {
        code: 'stroke-white',
        name: '描边-白',
        height: h,
        width: w,
        ...singleBorder,
        fill: 'rgba(220, 220, 220, 0.7)',
        stroke: 'rgba(220, 220, 220, 0.7)',
        strokeWidth: 1.4 + 1.6 + 0.2,
        lineJoin: 'round',
        lineCap: 'round',
        perfectDrawEnabled: true,
        listening: false,
        ...getPosition(0, 0, w, h),
        ...getFilters(),
      } as CanvasItemConfig,
      {
        code: 'stroke-black',
        name: '描边-黑',
        height: h,
        width: w,
        ...singleBorder,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 1.6 + 0.2,
        lineJoin: 'round',
        lineCap: 'round',
        perfectDrawEnabled: true,
        listening: false,
        ...getPosition(0, 0, w, h),
        ...getFilters(),
      } as CanvasItemConfig,
      {
        code: 'text',
        name: '文本',
        height: h,
        width: w,
        ...singleText,
        fill: '#FFFFFF',
        stroke: '#FFFFFF',
        strokeWidth: 0.2,
        originX: 0,
        originY: 0,
        perfectDrawEnabled: true,
        listening: false,
        ...getPosition(0, 0, w, h),
        ...getFilters(),
      } as CanvasItemConfig,
    ]

    return [
      ...visualLayers,
      {
        code: 'hit',
        name: '命中区',
        width: w,
        height: h,
        fill: 'rgba(0,0,0,0.001)',
        listening: true,
        ...getPosition(0, 0, w, h),
      } as CanvasItemConfig,
    ]
  }

  /** 拆分模式：各单字可操作 group */
  const buildSplitCharGroupChildren = (
    layout: NameLayout,
    isReset: boolean,
  ): CanvasItemConfig[] => {
    const chars = nameChars.value
    const nameItem = info.renderConfig.items.name
    const splitChars = nameItem.splitChars ?? {}
    const contentOrigin = resolveStageContentOriginFromDiy(diyStore)
    const lineHeight = layout.tempTextConfig.lineHeight as number

    return chars.flatMap((char, index) => {
      const code = getNameSplitCharCode(index)
      const charRenderObj = splitChars[code]
      if (!charRenderObj) return []
      const verticalSlot = layout.charLayouts[index]!
      const charFontSizePx = resolveCharFontSizePx(charRenderObj, layout.fontSizePx)
      const charLayout = resolveSplitCharRenderLayout(
        verticalSlot,
        char,
        charFontSizePx,
        lineHeight,
      )
      if (isReset || typeof charRenderObj.anchorCenterY !== 'number') {
        initSplitCharLayoutFromSlot(
          charRenderObj,
          nameItem,
          verticalSlot,
          charLayout,
          units,
        )
      } else {
        applySplitCharBoxFromAnchor(charRenderObj, charLayout, units)
      }
      const layerChildren = buildCharLayerChildren(char, charLayout, charFontSizePx, lineHeight)

      const clip = resolveSplitCharClip()

      const charGroup: CanvasItemConfig = {
        code,
        name: charRenderObj.name,
        width: charLayout.width,
        height: charLayout.height,
        fontSize: charFontSizePx,
        rotation: 0,
        ...(clip ? { clip } : {}),
        children: layerChildren,
        listening: true,
        ...getPosition(charLayout.relX, charLayout.relY, charLayout.width, charLayout.height),
        ...getDragger(charRenderObj, code),
        ...getSelectHandlers(),
        loadFunc: itemCacheMap.value?.[nameItem.code]?.loadFunc,
      }

      // 单字 group 在画布顶层渲染，坐标系为绝对 mm；init 后由 renderObj 反推 px，不能用 isReset 按槽位相对坐标持久化
      mergeConfig(charRenderObj, charGroup, contentOrigin, diyStore.mmToPx, false)
      return [charGroup]
    })
  }

  /** 拆分模式：外层容器（不可直接操作） */
  const buildSplitParentGroupConfig = (
    code: string,
    layout: NameLayout,
    children: CanvasItemConfig[],
  ): CanvasItemConfig => {
    return {
      code,
      name: '武将名',
      width: layout.width,
      height: layout.height,
      originX: layout.originX,
      originY: layout.originY,
      rotation: 0,
      children,
      ...getPosition(layout.originX, layout.originY, layout.width, layout.height),
      loadFunc: itemCacheMap.value?.[code]?.loadFunc,
    } as CanvasItemConfig
  }

  /** 阴影子节点 */
  const buildShadowConfig = (layout: NameLayout): CanvasItemConfig => {
    const shadowX = units.mmToPx(0.34)
    const shadowY = units.mmToPx(0.4)
    return {
      code: 'name-shadow',
      name: '武将名-阴影',
      height: layout.height,
      width: layout.width,
      ...layout.tempTextConfig,
      originX: shadowX,
      originY: shadowY,
      fill: 'rgba(0,0,0,0.8)',
      perfectDrawEnabled: true,
      ...getPosition(shadowX, shadowY, layout.width, layout.height),
      ...getFilters(),
    } as CanvasItemConfig
  }

  /** 白色描边子节点 */
  const buildStrokeWhiteConfig = (layout: NameLayout): CanvasItemConfig =>
    ({
      code: 'name-stroke-white',
      name: '武将名-描边-白',
      height: layout.height,
      width: layout.width,
      ...layout.borderTextConfig,
      fill: 'rgba(220, 220, 220, 0.7)',
      stroke: 'rgba(220, 220, 220, 0.7)',
      strokeWidth: 1.4 + 1.6 + 0.2,
      lineJoin: 'round',
      lineCap: 'round',
      perfectDrawEnabled: true,
      ...getPosition(0, 0, layout.width, layout.height),
      ...getFilters(),
    }) as CanvasItemConfig

  /** 黑色描边子节点 */
  const buildStrokeBlackConfig = (layout: NameLayout): CanvasItemConfig =>
    ({
      code: 'name-stroke-black',
      name: '武将名-描边-黑',
      height: layout.height,
      width: layout.width,
      ...layout.borderTextConfig,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 1.6 + 0.2,
      lineJoin: 'round',
      lineCap: 'round',
      perfectDrawEnabled: true,
      ...getPosition(0, 0, layout.width, layout.height),
      ...getFilters(),
    }) as CanvasItemConfig

  /** 正文子节点 */
  const buildTextConfig = (layout: NameLayout): CanvasItemConfig =>
    ({
      code: 'name-text',
      name: '武将名-文本',
      height: layout.height,
      width: layout.width,
      ...layout.tempTextConfig,
      fill: '#FFFFFF',
      stroke: '#FFFFFF',
      strokeWidth: 0.2,
      originX: 0,
      originY: 0,
      perfectDrawEnabled: true,
      ...getPosition(0, 0, layout.width, layout.height),
      ...getFilters(),
    }) as CanvasItemConfig

  /** group 根节点 */
  const buildGroupConfig = (
    code: string,
    name: string,
    renderObj: LegendInfo['renderConfig']['items']['name'],
    layout: NameLayout,
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
      strokeWidth: 2,
      stroke: '#FF0000',
      ...getPosition(layout.originX, layout.originY, layout.width, layout.height),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]?.loadFunc,
    }) as CanvasItemConfig

  return load
}
