import { useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import type { TemplateCanvasState } from '@/features/diy-card/composables/template'
import { useDiyStore, useInfoStore, useTemplateStore } from '@/features/diy-card/stores'
import { formatTemplateAuthorNames } from '@/features/diy-card/types/template'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { createDiyUnitConverters, getPosition } from '@/features/diy-card/utils/canvas'
import { loadWebFontFamilies } from '@/features/diy-card/utils/loadWebFontFamily'
import Konva from 'konva'
import {
  WATERMARK_BODY_OPACITY,
  WATERMARK_BRAND_FONT_FAMILY,
  WATERMARK_BRAND_LETTER_SPACING_PT,
  WATERMARK_BRAND_SIZE_RATIO,
  WATERMARK_BY_FONT_FAMILY,
  WATERMARK_BY_LETTER_SPACING_PT,
  WATERMARK_BY_OPACITY,
  WATERMARK_BY_SIZE_RATIO,
  WATERMARK_BY_TEXT,
  WATERMARK_DIVIDER_CODE,
  WATERMARK_DIVIDER_GAP_RATIO,
  WATERMARK_DIVIDER_GRADIENT_END,
  WATERMARK_DIVIDER_GRADIENT_MID,
  WATERMARK_DIVIDER_GRADIENT_START,
  WATERMARK_DIVIDER_HEIGHT_RATIO,
  WATERMARK_DOT_LETTER_SPACING_PT,
  WATERMARK_DOT_OPACITY,
  WATERMARK_DOT_SIZE_RATIO,
  WATERMARK_DOT_TEXT,
  WATERMARK_FONT_SIZE_PT,
  WATERMARK_GRADIENT_BOTTOM,
  WATERMARK_GRADIENT_MID,
  WATERMARK_GRADIENT_MID_STOP,
  WATERMARK_GRADIENT_TOP,
  WATERMARK_HALO_FILL,
  WATERMARK_HALO_OPACITY,
  WATERMARK_HALO_STROKE_WIDTH_PX,
  WATERMARK_HIT_CODE,
  WATERMARK_LABEL_FONT_FAMILY,
  WATERMARK_LABEL_LETTER_SPACING_PT,
  WATERMARK_LABEL_OPACITY,
  WATERMARK_LABEL_SIZE_RATIO,
  WATERMARK_LINE_HEIGHT,
  WATERMARK_META_DOT_SIZE_RATIO,
  WATERMARK_ORIGIN_X_MM,
  WATERMARK_ORIGIN_Y_MM,
  WATERMARK_ROTATION_DEG,
  WATERMARK_ROW_GAP_RATIO,
  WATERMARK_SCRIM_CODE,
  WATERMARK_SCRIM_FILL,
  WATERMARK_SCRIM_PAD_RATIO,
  WATERMARK_SCRIM_RADIUS_PX,
  WATERMARK_SEGMENT_GAP_RATIO,
  WATERMARK_SHADOW_BLUR_PX,
  WATERMARK_SHADOW_COLOR,
  WATERMARK_SHADOW_OFFSET_X_PX,
  WATERMARK_SHADOW_OFFSET_Y_PX,
  WATERMARK_SUBTITLE_FONT_FAMILY,
  WATERMARK_SUBTITLE_LETTER_SPACING_PT,
  WATERMARK_SUBTITLE_OPACITY,
  WATERMARK_SUBTITLE_SIZE_RATIO,
  WATERMARK_TEMPLATE_LABEL,
  WATERMARK_VALUE_FONT_FAMILY,
  WATERMARK_VALUE_LETTER_SPACING_PT,
  WATERMARK_VALUE_SIZE_RATIO,
  WATERMARK_WEB_FONT_FAMILIES,
} from '../../constants/watermark'

type TextMeasureOpts = {
  text: string
  fontSizePx: number
  fontFamily: string
  letterSpacingPx: number
}

const measureTextWidth = ({ text, fontSizePx, fontFamily, letterSpacingPx }: TextMeasureOpts) => {
  const node = new Konva.Text({
    text,
    fontSize: fontSizePx,
    fontFamily,
    letterSpacing: letterSpacingPx,
  })
  const width = node.width()
  node.destroy()
  return width
}

const measureLineHeight = (fontSizePx: number) => fontSizePx * WATERMARK_LINE_HEIGHT

const buildGradientFill = (fontSizePx: number) => ({
  fillPriority: 'linear-gradient' as const,
  fillLinearGradientStartPoint: { x: 0, y: 0 },
  fillLinearGradientEndPoint: { x: 0, y: fontSizePx * WATERMARK_LINE_HEIGHT },
  fillLinearGradientColorStops: [
    0,
    WATERMARK_GRADIENT_TOP,
    WATERMARK_GRADIENT_MID_STOP,
    WATERMARK_GRADIENT_MID,
    1,
    WATERMARK_GRADIENT_BOTTOM,
  ],
})

const buildBodyShadow = () => ({
  shadowColor: WATERMARK_SHADOW_COLOR,
  shadowBlur: WATERMARK_SHADOW_BLUR_PX,
  shadowOffsetX: WATERMARK_SHADOW_OFFSET_X_PX,
  shadowOffsetY: WATERMARK_SHADOW_OFFSET_Y_PX,
})

const CLEAR_SHADOW_PROPS = {
  shadowColor: undefined,
  shadowBlur: undefined,
  shadowOffsetX: undefined,
  shadowOffsetY: undefined,
} as const

const buildHaloLayer = (layer: CanvasItemConfig): CanvasItemConfig => ({
  ...layer,
  code: `${layer.code}_halo`,
  name: `${layer.name ?? layer.code}-光晕`,
  fill: WATERMARK_HALO_FILL,
  stroke: WATERMARK_HALO_FILL,
  strokeWidth: WATERMARK_HALO_STROKE_WIDTH_PX,
  lineJoin: 'round',
  lineCap: 'round',
  opacity: WATERMARK_HALO_OPACITY,
  fillPriority: undefined,
  fillLinearGradientStartPoint: undefined,
  fillLinearGradientEndPoint: undefined,
  fillLinearGradientColorStops: undefined,
  ...CLEAR_SHADOW_PROPS,
})

type TextLayerOpts = TextMeasureOpts & {
  x: number
  y: number
  width: number
  opacity: number
  accent?: boolean
  halo?: boolean
}

const createTextLayers = (
  code: string,
  name: string,
  opts: TextLayerOpts,
  extra: Partial<CanvasItemConfig> = {},
): CanvasItemConfig[] => {
  const useAccent = opts.accent !== false
  const main: CanvasItemConfig = {
    code,
    name,
    text: opts.text,
    x: opts.x,
    y: opts.y,
    width: opts.width,
    fontSize: opts.fontSizePx,
    fontFamily: opts.fontFamily,
    lineHeight: WATERMARK_LINE_HEIGHT,
    letterSpacing: opts.letterSpacingPx,
    opacity: opts.opacity,
    listening: false,
    perfectDrawEnabled: true,
    ...(useAccent
      ? { ...buildGradientFill(opts.fontSizePx), ...buildBodyShadow() }
      : { fill: WATERMARK_GRADIENT_TOP, ...buildBodyShadow() }),
    ...extra,
  }
  if (!opts.halo) return [main]
  return [buildHaloLayer(main), main]
}

/**
 * 绘制水印（编辑排版 + 渐变压印，叠在立绘上）
 * @param canvas 画布状态
 */
export function drawWatermark(canvas: TemplateCanvasState) {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const getLegendInfo = () => infoStore.info as LegendInfo
  const { props, updateNode, getDragger, getSelectHandlers, itemCacheMap } = canvas
  const units = createDiyUnitConverters(diyStore.mmToPx)
  const templateStore = useTemplateStore()
  const templateInfo = templateStore.currentTemplate
  const { getFilters } = useKonvaBrightnessFilters()

  const load = async (isReset: boolean = false) => {
    const info = getLegendInfo()
    const code = 'watermark'
    const name = '水印'
    const renderObj = info.renderConfig.items[code]

    if (!info.renderConfig.watermark.showFlag) {
      updateNode(renderObj, { code, name, children: [] }, isReset)
      return
    }

    const fontSizePx = resolveFontSizePx(isReset, renderObj)

    await loadWebFontFamilies(WATERMARK_WEB_FONT_FAMILIES, {
      diyStore,
      label: '水印字体',
    })

    await diyStore.runWithLoading(code, name, async () => {
      const config = buildWatermarkConfig(code, name, renderObj, fontSizePx)
      updateNode(renderObj, config, isReset)
      if (isReset) {
        renderObj.rotation = WATERMARK_ROTATION_DEG
      }
    })
  }

  const resolveFontSizePx = (
    isReset: boolean,
    renderObj: LegendInfo['renderConfig']['items']['watermark'],
  ) => {
    const currentFontSizePt =
      isReset || typeof renderObj.size !== 'number' || renderObj.size <= 0
        ? WATERMARK_FONT_SIZE_PT
        : renderObj.size
    renderObj.size = currentFontSizePt
    return units.ptToPx(currentFontSizePt)
  }

  const buildWatermarkConfig = (
    code: string,
    name: string,
    renderObj: LegendInfo['renderConfig']['items']['watermark'],
    baseFontPx: number,
  ): CanvasItemConfig => {
    const { username } = getLegendInfo().renderConfig.watermark
    const authors = formatTemplateAuthorNames(templateInfo?.authors ?? [])

    const byFontPx = baseFontPx * WATERMARK_BY_SIZE_RATIO
    const brandFontPx = baseFontPx * WATERMARK_BRAND_SIZE_RATIO
    const dotFontPx = baseFontPx * WATERMARK_DOT_SIZE_RATIO
    const subtitleFontPx = baseFontPx * WATERMARK_SUBTITLE_SIZE_RATIO
    const labelFontPx = baseFontPx * WATERMARK_LABEL_SIZE_RATIO
    const valueFontPx = baseFontPx * WATERMARK_VALUE_SIZE_RATIO

    const byLetterPx = units.ptToPx(WATERMARK_BY_LETTER_SPACING_PT)
    const brandLetterPx = units.ptToPx(WATERMARK_BRAND_LETTER_SPACING_PT)
    const dotLetterPx = units.ptToPx(WATERMARK_DOT_LETTER_SPACING_PT)
    const subtitleLetterPx = units.ptToPx(WATERMARK_SUBTITLE_LETTER_SPACING_PT)
    const labelLetterPx = units.ptToPx(WATERMARK_LABEL_LETTER_SPACING_PT)
    const valueLetterPx = units.ptToPx(WATERMARK_VALUE_LETTER_SPACING_PT)

    const brandText = 'JxShap'
    const subtitleText = '网页版'
    const metaRows = [
      { label: WATERMARK_TEMPLATE_LABEL, value: authors },
      ...(username ? [{ label: '作者', value: username }] : []),
    ]

    const segmentGapPx = baseFontPx * WATERMARK_SEGMENT_GAP_RATIO

    const measureSegment = (
      text: string,
      fontSizePx: number,
      fontFamily: string,
      letterSpacingPx: number,
    ) =>
      measureTextWidth({ text, fontSizePx, fontFamily, letterSpacingPx })

    const byWidth = measureSegment(WATERMARK_BY_TEXT, byFontPx, WATERMARK_BY_FONT_FAMILY, byLetterPx)
    const dotWidth = measureSegment(WATERMARK_DOT_TEXT, dotFontPx, WATERMARK_BRAND_FONT_FAMILY, dotLetterPx)
    const brandWidth = measureSegment(brandText, brandFontPx, WATERMARK_BRAND_FONT_FAMILY, brandLetterPx)
    const subtitleWidth = measureSegment(
      subtitleText,
      subtitleFontPx,
      WATERMARK_SUBTITLE_FONT_FAMILY,
      subtitleLetterPx,
    )

    const brandRowWidth =
      byWidth + segmentGapPx + dotWidth + segmentGapPx + brandWidth + segmentGapPx + dotWidth + segmentGapPx + subtitleWidth

    const metaDotFontPx = baseFontPx * WATERMARK_META_DOT_SIZE_RATIO
    const metaDotWidth = measureSegment(
      WATERMARK_DOT_TEXT,
      metaDotFontPx,
      WATERMARK_LABEL_FONT_FAMILY,
      dotLetterPx,
    )
    const metaRowWidths = metaRows.map((row) => {
      const labelWidth = measureSegment(row.label, labelFontPx, WATERMARK_LABEL_FONT_FAMILY, labelLetterPx)
      const valueWidth = measureSegment(row.value, valueFontPx, WATERMARK_VALUE_FONT_FAMILY, valueLetterPx)
      return labelWidth + segmentGapPx + metaDotWidth + segmentGapPx + valueWidth
    })
    const metaContentWidth = metaRowWidths.reduce((max, width) => Math.max(max, width), 0)

    const contentWidth = Math.ceil(Math.max(brandRowWidth, metaContentWidth))
    const brandRowHeight = Math.max(
      measureLineHeight(byFontPx),
      measureLineHeight(dotFontPx),
      measureLineHeight(brandFontPx),
      measureLineHeight(subtitleFontPx),
    )
    const metaRowHeight = Math.max(measureLineHeight(labelFontPx), measureLineHeight(valueFontPx))
    const rowGapPx = baseFontPx * WATERMARK_ROW_GAP_RATIO
    const dividerGapPx = baseFontPx * WATERMARK_DIVIDER_GAP_RATIO
    const dividerHeightPx = Math.max(0.45, baseFontPx * WATERMARK_DIVIDER_HEIGHT_RATIO)

    const contentHeight =
      brandRowHeight +
      dividerGapPx +
      dividerHeightPx +
      dividerGapPx +
      metaRows.length * metaRowHeight +
      Math.max(0, metaRows.length - 1) * rowGapPx

    const scrimPadPx = baseFontPx * WATERMARK_SCRIM_PAD_RATIO
    const children: CanvasItemConfig[] = [
      {
        code: WATERMARK_SCRIM_CODE,
        name: '水印底衬',
        x: -scrimPadPx,
        y: -scrimPadPx,
        width: contentWidth + scrimPadPx * 2,
        height: Math.ceil(contentHeight) + scrimPadPx * 2,
        fill: WATERMARK_SCRIM_FILL,
        cornerRadius: WATERMARK_SCRIM_RADIUS_PX,
        listening: false,
      },
    ]

    const centerY = (fontSizePx: number) => (brandRowHeight - measureLineHeight(fontSizePx)) / 2
    let cursorX = 0

    const pushBrandSegment = (
      segmentCode: string,
      segmentName: string,
      text: string,
      fontSizePx: number,
      fontFamily: string,
      letterSpacingPx: number,
      width: number,
      opacity: number,
      extra?: Partial<CanvasItemConfig>,
      halo = false,
    ) => {
      children.push(
        ...createTextLayers(
          segmentCode,
          segmentName,
          {
            text,
            fontSizePx,
            fontFamily,
            letterSpacingPx,
            x: cursorX,
            y: centerY(fontSizePx),
            width,
            opacity,
            halo,
          },
          extra,
        ),
      )
      cursorX += width + segmentGapPx
    }

    pushBrandSegment(
      `${code}_by`,
      '水印来源',
      WATERMARK_BY_TEXT,
      byFontPx,
      WATERMARK_BY_FONT_FAMILY,
      byLetterPx,
      byWidth,
      WATERMARK_BY_OPACITY,
      getFilters() as Partial<CanvasItemConfig>,
      true,
    )
    pushBrandSegment(
      `${code}_dot1`,
      '水印分隔点',
      WATERMARK_DOT_TEXT,
      dotFontPx,
      WATERMARK_BRAND_FONT_FAMILY,
      dotLetterPx,
      dotWidth,
      WATERMARK_DOT_OPACITY,
    )
    pushBrandSegment(
      `${code}_brand`,
      '水印品牌',
      brandText,
      brandFontPx,
      WATERMARK_BRAND_FONT_FAMILY,
      brandLetterPx,
      brandWidth,
      WATERMARK_BODY_OPACITY,
    )
    pushBrandSegment(
      `${code}_dot2`,
      '水印分隔点',
      WATERMARK_DOT_TEXT,
      dotFontPx,
      WATERMARK_BRAND_FONT_FAMILY,
      dotLetterPx,
      dotWidth,
      WATERMARK_DOT_OPACITY,
    )
    children.push(
      ...createTextLayers(`${code}_subtitle`, '水印副标', {
        text: subtitleText,
        fontSizePx: subtitleFontPx,
        fontFamily: WATERMARK_SUBTITLE_FONT_FAMILY,
        letterSpacingPx: subtitleLetterPx,
        x: cursorX,
        y: centerY(subtitleFontPx),
        width: subtitleWidth,
        opacity: WATERMARK_SUBTITLE_OPACITY,
      }),
    )

    let cursorY = brandRowHeight + dividerGapPx
    children.push({
      code: WATERMARK_DIVIDER_CODE,
      name: '水印分隔线',
      x: 0,
      y: cursorY,
      width: contentWidth,
      height: dividerHeightPx,
      fillPriority: 'linear-gradient',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: contentWidth, y: 0 },
      fillLinearGradientColorStops: [
        0,
        WATERMARK_DIVIDER_GRADIENT_START,
        0.55,
        WATERMARK_DIVIDER_GRADIENT_MID,
        1,
        WATERMARK_DIVIDER_GRADIENT_END,
      ],
      cornerRadius: dividerHeightPx / 2,
      listening: false,
    })
    cursorY += dividerHeightPx + dividerGapPx

    metaRows.forEach((row, index) => {
      const rowY = cursorY + index * (metaRowHeight + rowGapPx)
      let metaX = 0
      const labelWidth = measureSegment(row.label, labelFontPx, WATERMARK_LABEL_FONT_FAMILY, labelLetterPx)
      const valueWidth = measureSegment(row.value, valueFontPx, WATERMARK_VALUE_FONT_FAMILY, valueLetterPx)
      const labelY = rowY + (metaRowHeight - measureLineHeight(labelFontPx)) / 2
      const dotY = rowY + (metaRowHeight - measureLineHeight(metaDotFontPx)) / 2
      const valueY = rowY + (metaRowHeight - measureLineHeight(valueFontPx)) / 2

      children.push(
        ...createTextLayers(`${code}_label${index}`, '水印标签', {
          text: row.label,
          fontSizePx: labelFontPx,
          fontFamily: WATERMARK_LABEL_FONT_FAMILY,
          letterSpacingPx: labelLetterPx,
          x: metaX,
          y: labelY,
          width: labelWidth,
          opacity: WATERMARK_LABEL_OPACITY,
          halo: true,
        }),
      )
      metaX += labelWidth + segmentGapPx

      children.push(
        ...createTextLayers(`${code}_metaDot${index}`, '水印分隔点', {
          text: WATERMARK_DOT_TEXT,
          fontSizePx: metaDotFontPx,
          fontFamily: WATERMARK_LABEL_FONT_FAMILY,
          letterSpacingPx: dotLetterPx,
          x: metaX,
          y: dotY,
          width: metaDotWidth,
          opacity: WATERMARK_DOT_OPACITY,
          accent: false,
        }),
      )
      metaX += metaDotWidth + segmentGapPx

      children.push(
        ...createTextLayers(`${code}_value${index}`, '水印内容', {
          text: row.value,
          fontSizePx: valueFontPx,
          fontFamily: WATERMARK_VALUE_FONT_FAMILY,
          letterSpacingPx: valueLetterPx,
          x: metaX,
          y: valueY,
          width: valueWidth,
          opacity: WATERMARK_BODY_OPACITY,
        }),
      )
    })

    children.push({
      code: WATERMARK_HIT_CODE,
      name: '水印热区',
      x: 0,
      y: 0,
      width: contentWidth,
      height: Math.ceil(contentHeight),
      fill: 'rgba(0,0,0,0.001)',
      listening: true,
    })

    const x = props.stageOrigin.x + units.mmToPx(WATERMARK_ORIGIN_X_MM)
    const y = props.stageOrigin.y + units.mmToPx(WATERMARK_ORIGIN_Y_MM)

    return {
      code,
      name,
      width: contentWidth,
      height: Math.ceil(contentHeight),
      fontSize: baseFontPx,
      rotation: renderObj.rotation,
      originX: x,
      originY: y,
      children,
      listening: true,
      ...getPosition(x, y, contentWidth, Math.ceil(contentHeight)),
      ...getDragger(renderObj, code),
      ...getSelectHandlers(),
      loadFunc: itemCacheMap.value?.[code]!.loadFunc,
    } as CanvasItemConfig
  }

  return load
}
