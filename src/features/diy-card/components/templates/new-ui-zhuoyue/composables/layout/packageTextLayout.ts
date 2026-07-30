import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import {
  isPackageIdentifyActive,
  isPackageRemoteImageKind,
} from '@/features/diy-card/types/diy/packageIdentify'
import { EMPTY_CH_TRANS_OVERRIDES, resolveDisplayText } from '@/features/diy-card/utils/ch-trans/chTransEngine'
import {
  adjustPackageColorHexForStroke,
  resolvePackageCustomColorEndHex,
  resolvePackageCustomColorHex,
  resolvePackageCustomColorRgb,
} from '@/features/diy-card/utils/packageCustomColor'
import {
  buildPackageTextStrokeLinearGradientStyleInLayoutSpace,
  buildPackageTextCharFillStyle,
  type PackageTextStrokeLinearGradientStyle,
} from '@/features/diy-card/utils/packageTextGradient'
import {
  buildPackageTextBgGradientCacheSignature,
  getPackageTextBgGradientTintFilter,
} from '../filters/packageTextBgGradientTint'
import { getKingdomFrameTintFilter } from '../filters/kingdomFrameTint'
import { markRaw } from 'vue'
import {
  PACKAGE_TEXT_BADGE_PRESETS,
  resolvePackageTextDualStroke,
  resolvePackageTextBadgeBgAsset,
  type PackageTextBadgeKind,
  type PackageTextBadgePreset,
  type PackageTextCharSlot,
  type PackageTextBadgeGradient,
  type PackageTextStrokeStyle,
} from '../constants/package'
import {
  applyPackageImageContainLayout,
  resolvePackageTextBgLayoutPx,
  resolvePackageTextLayoutMetrics,
} from './packageLayout'
import { renderPackageTextCharCanvas } from './packageTextCharRaster'

const EMPTY_CH_TRANS = EMPTY_CH_TRANS_OVERRIDES

const resolvePackageBgTintFilters = (
  renderObj: LegendInfo['renderConfig']['items']['package'],
  kind: PackageTextBadgeKind,
  preset: PackageTextBadgePreset,
  bgLayout: { width: number; height: number },
  bgImage: HTMLImageElement,
) => {
  const startHex = resolvePackageCustomColorHex(renderObj, kind)
  const gradient = preset.gradient

  if (gradient) {
    const endHex = resolvePackageCustomColorEndHex(renderObj, kind)
    const layout = {
      layoutWidth: bgLayout.width,
      layoutHeight: bgLayout.height,
      imageWidth: bgImage.width,
      imageHeight: bgImage.height,
    }
    return {
      globalCompositeOperation: 'source-over' as const,
      filterCacheSignature: buildPackageTextBgGradientCacheSignature(
        startHex,
        endHex,
        gradient,
        layout,
        preset.bgGradientTint,
      ),
      filters: markRaw([
        getPackageTextBgGradientTintFilter(
          startHex,
          endHex,
          gradient,
          layout,
          preset.bgGradientTint,
        ),
      ]),
    }
  }

  const rgb = resolvePackageCustomColorRgb(renderObj, kind)
  if (!rgb) return {}
  return {
    red: rgb.red,
    green: rgb.green,
    blue: rgb.blue,
    globalCompositeOperation: 'source-over' as const,
    filters: markRaw([getKingdomFrameTintFilter('package')]),
  }
}

const resolvePackageTextStrokeBadgeHex = (
  stroke: PackageTextStrokeStyle,
  startHex: string,
  endHex: string,
) => (stroke.strokeFromBadgeColorEnd ? endHex : startHex)

const resolvePackageTextStrokeColor = (
  stroke: PackageTextStrokeStyle,
  startHex: string,
  endHex: string,
) => {
  if (stroke.strokeFromBadgeColor || stroke.strokeFromBadgeColorEnd) {
    const baseHex = resolvePackageTextStrokeBadgeHex(stroke, startHex, endHex)
    if (stroke.strokeGradientDirect) return baseHex
    return adjustPackageColorHexForStroke(baseHex, {
      lightnessDelta: stroke.strokeLightnessDelta,
      saturationDelta: stroke.strokeSaturationDelta,
    })
  }
  return stroke.stroke
}

const shouldUsePackageTextStrokeGradient = (
  stroke: PackageTextStrokeStyle,
  gradient: PackageTextBadgeGradient | undefined,
) =>
  Boolean(
    gradient &&
      stroke.strokeFromBadgeColor &&
      !stroke.strokeFromBadgeColorEnd &&
      stroke.strokeFollowsGradient,
  )

const resolvePackageTextStrokeGradientStyle = (
  stroke: PackageTextStrokeStyle,
  startHex: string,
  endHex: string,
  metrics: ReturnType<typeof resolvePackageTextLayoutMetrics>,
  charOrigin: { x: number; y: number },
  gradient: PackageTextBadgeGradient,
): PackageTextStrokeLinearGradientStyle | undefined => {
  if (!stroke.strokeFromBadgeColor) return undefined
  const strokeStart = stroke.strokeGradientDirect
    ? startHex
    : adjustPackageColorHexForStroke(startHex, {
        lightnessDelta: stroke.strokeLightnessDelta,
        saturationDelta: stroke.strokeSaturationDelta,
      })
  const strokeEnd = stroke.strokeGradientDirect
    ? endHex
    : adjustPackageColorHexForStroke(endHex, {
        lightnessDelta: stroke.strokeLightnessDelta,
        saturationDelta: stroke.strokeSaturationDelta,
      })
  return buildPackageTextStrokeLinearGradientStyleInLayoutSpace(
    strokeStart,
    strokeEnd,
    metrics,
    charOrigin,
    gradient,
  )
}

const applyPackageTextShadow = (
  config: CanvasItemConfig,
  stroke: PackageTextStrokeStyle,
  badgeWidth: number,
) => {
  if (!stroke.shadowColor) return
  config.shadowColor = stroke.shadowColor
  if (stroke.shadowBlurRatio != null) {
    config.shadowBlur = badgeWidth * stroke.shadowBlurRatio
  }
  config.shadowOffsetX = badgeWidth * (stroke.shadowOffsetXRatio ?? 0)
  config.shadowOffsetY = badgeWidth * (stroke.shadowOffsetYRatio ?? 0)
}

/** Safari / WebKit 下 Web 字体度量常宽于 em 方框，给字框留余量避免首字被裁切 */
const PACKAGE_TEXT_CHAR_BOX_PAD = 1.18

/**
 * 按 layoutRef 与比例估算字框，避免 canvas 量字在不同 PPI / 导出倍率下亚像素漂移。
 * 中文单字近似 em 方框，与旧站 CSS text-align + font-size 行为一致。
 */
const resolvePackageCharLayoutPx = (
  slot: PackageTextCharSlot,
  metrics: ReturnType<typeof resolvePackageTextLayoutMetrics>,
  layoutRefWidthPx: number,
) => {
  const { layoutScale, layoutWidth, layoutHeight, offsetX, offsetY } = metrics
  const scaleX = slot.scaleX ?? 1
  const scaleY = slot.scaleY ?? 1
  const fontSizePx = layoutRefWidthPx * slot.fontSizeRatio * layoutScale
  const coreWidth = fontSizePx * scaleX
  const coreHeight = fontSizePx * scaleY
  const padX = (coreWidth * (PACKAGE_TEXT_CHAR_BOX_PAD - 1)) / 2
  const padY = (coreHeight * (PACKAGE_TEXT_CHAR_BOX_PAD - 1)) / 2
  const visualWidth = coreWidth + padX * 2
  const visualHeight = coreHeight + padY * 2
  const anchorX = offsetX + layoutWidth * slot.xRatio
  const anchorY = offsetY + layoutHeight * slot.yRatio

  let x = anchorX
  if (slot.align === 'center') x -= coreWidth / 2 + padX
  else if (slot.align === 'right') x -= coreWidth + padX * 2
  else x -= padX

  return { x, y: anchorY - padY, width: visualWidth, height: visualHeight, fontSizePx, scaleX, scaleY }
}

const buildTextCharConfigs = (
  char: string,
  slot: PackageTextCharSlot,
  metrics: ReturnType<typeof resolvePackageTextLayoutMetrics>,
  layoutRefWidthPx: number,
  preset: PackageTextBadgePreset,
  stroke?: PackageTextStrokeStyle,
  badgeColorHex?: string,
  badgeColorEndHex?: string,
): CanvasItemConfig[] => {
  const { x, y, width, height, fontSizePx, scaleX, scaleY } = resolvePackageCharLayoutPx(
    slot,
    metrics,
    layoutRefWidthPx,
  )
  const { layoutWidth } = metrics
  const gradient = preset.gradient
  const startHex = badgeColorHex ?? preset.defaultCustomColor
  const endHex = badgeColorEndHex ?? preset.defaultCustomColorEnd ?? startHex

  const shared = {
    text: char,
    x,
    y,
    width,
    height,
    fontSize: fontSizePx,
    fontFamily: preset.fontFamily,
    scaleX,
    scaleY,
    wrap: 'none' as const,
    align: (slot.align ?? 'left') as 'left' | 'center' | 'right',
    verticalAlign: 'top' as const,
    listening: false,
    perfectDrawEnabled: true,
  } satisfies Omit<CanvasItemConfig, 'code' | 'name'>

  const charFillStyle = buildPackageTextCharFillStyle(preset.charFill, width, height, fontSizePx)

  if (preset.charFill.type === 'gradient') {
    const { canvas, paddingPx } = renderPackageTextCharCanvas({
      char,
      fontFamily: preset.fontFamily,
      fontSizePx,
      boxWidth: width,
      boxHeight: height,
      scaleX,
      scaleY,
      align: slot.align ?? 'left',
      charFill: preset.charFill,
      syntheticBold: slot.syntheticBold,
      syntheticBoldWidthRatio: slot.syntheticBoldWidthRatio,
      rasterShadow: preset.charRasterShadow,
    })
    return [
      {
        code: `package-text-${char}`,
        name: char,
        image: markRaw(canvas),
        x: x - paddingPx,
        y: y - paddingPx,
        width: width + paddingPx * 2,
        height: height + paddingPx * 2,
        listening: false,
        perfectDrawEnabled: false,
      },
    ]
  }

  if (!stroke?.enabled) {
    return [
      {
        ...shared,
        code: `package-text-${char}`,
        name: char,
        ...charFillStyle,
      },
    ]
  }

  const strokeWidth =
    stroke.strokeWidthRatio != null ? layoutWidth * stroke.strokeWidthRatio : undefined
  const useStrokeGradient = shouldUsePackageTextStrokeGradient(stroke, gradient)
  const strokeGradientStyle = useStrokeGradient
    ? resolvePackageTextStrokeGradientStyle(
        stroke,
        startHex,
        endHex,
        metrics,
        { x, y },
        gradient!,
      )
    : undefined
  const strokeColor = !strokeGradientStyle
    ? resolvePackageTextStrokeColor(stroke, startHex, endHex)
    : undefined

  if (stroke.outerStroke && strokeWidth && (strokeColor || strokeGradientStyle)) {
    const outline: CanvasItemConfig = {
      ...shared,
      code: `package-text-outline-${char}`,
      name: `${char}外描边`,
      fill: 'transparent',
      strokeWidth,
      ...(strokeGradientStyle ?? { stroke: strokeColor }),
    }
    applyPackageTextShadow(outline, stroke, layoutWidth)
    const fill: CanvasItemConfig = {
      ...shared,
      code: `package-text-${char}`,
      name: char,
      ...charFillStyle,
    }
    return [outline, fill]
  }

  const config: CanvasItemConfig = {
    ...shared,
    code: `package-text-${char}`,
    name: char,
    ...charFillStyle,
  }
  if (strokeWidth && (strokeColor || strokeGradientStyle)) {
    config.strokeWidth = strokeWidth
    if (strokeGradientStyle) {
      Object.assign(config, strokeGradientStyle)
    } else if (strokeColor) {
      config.stroke = strokeColor
    }
  }
  applyPackageTextShadow(config, stroke, layoutWidth)
  return [config]
}

/** 构建文字角标组内子节点（底图 + 文字层） */
export const buildPackageTextBadgeChildren = (
  preset: PackageTextBadgePreset,
  displayText: string,
  badgeWidth: number,
  badgeHeight: number,
  bgImage: HTMLImageElement,
  packageStyle: LegendInfo['renderConfig']['items']['package'],
  kind: PackageTextBadgeKind,
): CanvasItemConfig[] => {
  const activeBg = resolvePackageTextBadgeBgAsset(preset, displayText)
  const layoutMetrics = resolvePackageTextLayoutMetrics(
    badgeWidth,
    badgeHeight,
    activeBg.layoutRefWidthPx,
    activeBg.layoutRefHeightPx,
  )
  const bgLayout = resolvePackageTextBgLayoutPx(
    layoutMetrics.layoutWidth,
    layoutMetrics.layoutHeight,
    preset.bgLayout,
  )
  const bgConfig = {
    code: 'package-text-bg',
    name: '角标底图',
    image: markRaw(bgImage),
    listening: true,
    perfectDrawEnabled: true,
    ...resolvePackageBgTintFilters(packageStyle, kind, preset, bgLayout, bgImage),
  } as CanvasItemConfig
  applyPackageImageContainLayout(bgConfig, bgLayout.width, bgLayout.height)
  bgConfig.x = layoutMetrics.offsetX + bgLayout.x + (bgConfig.x ?? 0)
  bgConfig.y = layoutMetrics.offsetY + bgLayout.y + (bgConfig.y ?? 0)

  const chars = [...displayText]
  const children: CanvasItemConfig[] = [bgConfig]
  const badgeColorHex = resolvePackageCustomColorHex(packageStyle, kind)
  const badgeColorEndHex = resolvePackageCustomColorEndHex(packageStyle, kind)
  const useDualLayout = chars.length >= 2 && preset.supportsDualChar

  if (!useDualLayout) {
    const char = chars[0] ?? ''
    if (char) {
      const { char: slot, stroke } = preset.single
      children.push(
        ...buildTextCharConfigs(
          char,
          slot,
          layoutMetrics,
          activeBg.layoutRefWidthPx,
          preset,
          stroke,
          badgeColorHex,
          badgeColorEndHex,
        ),
      )
    }
    return children
  }

  const { first, second } = preset.dual
  children.push(
    ...buildTextCharConfigs(
      chars[0]!,
      first,
      layoutMetrics,
      activeBg.layoutRefWidthPx,
      preset,
      resolvePackageTextDualStroke(preset.dual, 'first'),
      badgeColorHex,
      badgeColorEndHex,
    ),
    ...buildTextCharConfigs(
      chars[1]!,
      second,
      layoutMetrics,
      activeBg.layoutRefWidthPx,
      preset,
      resolvePackageTextDualStroke(preset.dual, 'second'),
      badgeColorHex,
      badgeColorEndHex,
    ),
  )
  return children
}

/** 角标组尺寸变化时，按当前 info 重新排版文字（避免线性缩放 x/fontSize 导致对不齐） */
export const resolvePackageTextRelayoutFromInfo = (info: LegendInfo) => {
  const identify = info.baseInfo.packageIdentify
  if (!isPackageIdentifyActive(identify) || isPackageRemoteImageKind(identify.name)) return null

  const kind = identify.name as PackageTextBadgeKind
  const preset = PACKAGE_TEXT_BADGE_PRESETS[kind]
  if (!preset) return null

  return {
    preset,
    kind,
    displayText: resolveDisplayText(
      identify.text ?? '',
      info.renderConfig.items.package.convertTChFlag,
      EMPTY_CH_TRANS,
    ),
    packageStyle: info.renderConfig.items.package,
  }
}
