import { useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { usesShenCardLayout } from '@/features/diy-card/composables/doubleKingdom'
import { useDiyStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { createDiyUnitConverters, getPosition } from '@/features/diy-card/utils/canvas'
import {
  buildFontProbe,
  isWebFontFamilyReady,
  loadWebFontFamilies,
  waitForWebFontFamily,
} from '@/features/diy-card/utils/loadWebFontFamily'
import {
  BOTTOM_INFO_FONT_FAMILY,
  BOTTOM_INFO_LEGEND_ID_LETTER_SPACING_PT,
  BOTTOM_INFO_LEGEND_ID_SIZE_PT,
  BOTTOM_INFO_LEGEND_ID_Y_MM,
  BOTTOM_INFO_LEGEND_ID_Y_OFFSET_MM,
  BOTTOM_INFO_LEGEND_ID_Y_OFFSET_SHEN_MM,
} from '../../constants/bottomInfo'
import { runSkillsAreaLayoutTask } from '../../layout/skills-area/areaLayoutGate'
import { computeSkillsAreaLayout } from '../../layout/skills-area/layout'
import { layoutInlineRichText } from '../skills-desc/richText'
import { layoutCopyrightSegments, resolveBottomInfoCopyrightBaselineY, resolveBottomInfoFontFamilies } from './copyrightLayout'
import {
  measureBottomInfoLegendIdContentWidthPx,
  resolveBottomInfoHorizontalLayout,
  resolveBottomInfoLegendIdStrokeOutsetPx,
} from './layout'
import {
  measureCanvasTextBaseline,
  resolveKonvaAlphabeticBaselineOffsetPx,
} from '../skills-desc/canvasTextMeasure'

/** 非神框 / 非神将 / 非全幅模式时关闭底部描边 */
export const disableBottomInfoStrokeIfNotShenLayout = (info: LegendInfo) => {
  if (!usesShenCardLayout(info) && !info.renderConfig.display.fullModeFlag) {
    info.renderConfig.items.bottomInfo.strokeFlag = false
  }
}

/** 切换神布局/全幅或重置时，将底部描边恢复为默认开启 */
export const syncBottomInfoStrokeForShenLayout = (info: LegendInfo) => {
  if (usesShenCardLayout(info) || info.renderConfig.display.fullModeFlag) {
    info.renderConfig.items.bottomInfo.strokeFlag = true
  }
}

/**
 * 绘制底部信息（版权 + 编号）
 * @param canvas 画布状态
 */
export function drawBottomInfo(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const getLegendInfo = () => infoStore.info as LegendInfo
  const { props, updateNode, itemCacheMap } = canvas
  const { getFilters } = useKonvaBrightnessFilters()

  const load = async (isReset: boolean = false) => {
    const units = createDiyUnitConverters(diyStore.mmToPx)
    const info = getLegendInfo()
    const code = 'bottomInfo'
    const renderObj = info.renderConfig.items[code]
    const showFlag = renderObj.showFlag
    const fullModeFlag = Boolean(info.renderConfig.display.fullModeFlag)
    const shenLayout = usesShenCardLayout(info)
    const useShenBottomStyle = shenLayout || fullModeFlag
    const blackStrokeFlag =
      fullModeFlag && !shenLayout ? true : Boolean(renderObj.strokeFlag)
    /** 普通势力默认同色细描边（旧站 textBoldFlag 默认开启）；神 UI 另叠加 blackStrokeFlag */
    const foregroundStrokeFlag = true
    const textColor = useShenBottomStyle ? '#FBF8F4' : '#0A0909'
    const legendIdFontPx = units.ptToPx(BOTTOM_INFO_LEGEND_ID_SIZE_PT)
    const legendIdLetterSpacingPx = units.ptToPx(BOTTOM_INFO_LEGEND_ID_LETTER_SPACING_PT)
    const legendIdFontProbe = buildFontProbe(
      BOTTOM_INFO_FONT_FAMILY,
      'normal',
      `${legendIdFontPx}px`,
    )

    const fontFamilies = resolveBottomInfoFontFamilies(info, showFlag)
    const fontProbes: Record<string, string | undefined> = {}
    if (showFlag && info.baseInfo.legendId) {
      fontProbes[BOTTOM_INFO_FONT_FAMILY] = legendIdFontProbe
    }

    await loadWebFontFamilies(fontFamilies, {
      diyStore,
      label: '底部信息字体',
      probes: fontProbes,
    })

    if (showFlag && info.baseInfo.legendId && !isWebFontFamilyReady(legendIdFontProbe)) {
      await waitForWebFontFamily(BOTTOM_INFO_FONT_FAMILY, {
        probe: legendIdFontProbe,
        timeoutMs: 8000,
      })
    }

    await diyStore.runWithLoading(code, '底部信息', async () => {
      const skillsLayout = await runSkillsAreaLayoutTask(
        () =>
          computeSkillsAreaLayout(info, props, units, false, diyStore.maxBleed, {
            skipAutoSizeResolve: true,
          }),
        { diyStore, label: '底部信息' },
      )
      const width = skillsLayout.width
      const height = skillsLayout.bottomInfoHeightPx
      const originX = skillsLayout.originX
      const bottomY = skillsLayout.bottomInfoOriginY
      const horizontal = resolveBottomInfoHorizontalLayout(renderObj, units.mmToPx, isReset, shenLayout)

      const children: CanvasItemConfig[] = []

      if (showFlag && info.baseInfo.copyright) {
        children.push(
          ...layoutCopyrightSegments({
            copyright: info.baseInfo.copyright,
            codePrefix: code,
            originX: horizontal.copyrightX,
            fill: textColor,
            blackStrokeFlag,
            foregroundStrokeFlag,
            shenForeground: useShenBottomStyle,
            ptToPx: (pt) => units.ptToPx(pt),
            mmToPx: units.mmToPx,
          }),
        )
      }

      if (showFlag && info.baseInfo.legendId) {
        const rich = layoutInlineRichText({
          raw: info.baseInfo.legendId,
          fontSizePx: legendIdFontPx,
          fontFamily: BOTTOM_INFO_FONT_FAMILY,
          letterSpacingPx: legendIdLetterSpacingPx,
          defaultFill: textColor,
          blackStrokeFlag,
          foregroundStrokeFlag,
          shenForeground: useShenBottomStyle,
          align: 'left',
          codePrefix: `${code}_legendId`,
        })
        const strokeOutsetPx = resolveBottomInfoLegendIdStrokeOutsetPx(
          blackStrokeFlag,
          foregroundStrokeFlag,
          useShenBottomStyle,
        )
        const contentWidthPx = Math.max(
          measureBottomInfoLegendIdContentWidthPx(
            info.baseInfo.legendId,
            legendIdFontPx,
            legendIdLetterSpacingPx,
          ),
          rich.width,
          legendIdFontPx,
        )
        const legendWidth = contentWidthPx + strokeOutsetPx * 2
        const legendHeight = Math.max(rich.height, legendIdFontPx)
        const legendIdRightPx = width - horizontal.marginRightPx
        const legendIdX = legendIdRightPx - legendWidth
        const legendMetrics = measureCanvasTextBaseline({
          text: info.baseInfo.legendId.trim(),
          fontSizePx: legendIdFontPx,
          fontFamily: BOTTOM_INFO_FONT_FAMILY,
          letterSpacingPx: legendIdLetterSpacingPx,
        })
        const legendBaselineOffsetPx = resolveKonvaAlphabeticBaselineOffsetPx(
          legendMetrics,
          legendIdFontPx,
        )
        const legendIdFineTunePx = units.mmToPx(
          BOTTOM_INFO_LEGEND_ID_Y_OFFSET_MM +
            (shenLayout ? BOTTOM_INFO_LEGEND_ID_Y_OFFSET_SHEN_MM : 0),
        )
        const copyrightBaselineY =
          showFlag && info.baseInfo.copyright
            ? resolveBottomInfoCopyrightBaselineY(
                info.baseInfo.copyright,
                (pt) => units.ptToPx(pt),
                units.mmToPx,
                blackStrokeFlag,
                useShenBottomStyle,
              )
            : null
        const legendIdY =
          copyrightBaselineY !== null
            ? copyrightBaselineY - legendBaselineOffsetPx + legendIdFineTunePx
            : units.mmToPx(BOTTOM_INFO_LEGEND_ID_Y_MM) + legendIdFineTunePx
        children.push({
          code: `${code}_legendId`,
          name: '武将编号',
          children: rich.items,
          originX: legendIdX,
          originY: legendIdY,
          width: legendWidth,
          height: legendHeight,
          ...getPosition(legendIdX, legendIdY, legendWidth, legendHeight),
          loadFunc: itemCacheMap.value?.[code]?.loadFunc,
        } as CanvasItemConfig)
      }

      const groupConfig = {
        code,
        name: '底部信息',
        width,
        height,
        originX,
        originY: bottomY,
        rotation: 0,
        children,
        listening: false,
        ...getPosition(originX, bottomY, width, height),
        ...getFilters(),
        loadFunc: itemCacheMap.value?.[code]?.loadFunc,
      } as CanvasItemConfig

      if (isReset) {
        delete renderObj.size
        syncBottomInfoStrokeForShenLayout(info)
        disableBottomInfoStrokeIfNotShenLayout(info)
      }

      updateNode(renderObj, groupConfig, true)
    })
  }

  return load
}
