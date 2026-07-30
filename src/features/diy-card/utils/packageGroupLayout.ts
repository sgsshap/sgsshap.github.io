import {
  buildPackageTextBadgeChildren,
  resolvePackageTextRelayoutFromInfo,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/packageTextLayout'
import { applyPackageImageContainLayout } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/packageLayout'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'

export const PACKAGE_TEXT_BG_CODE = 'package-text-bg'

/** 自定义文字角标（组内包含 package-text-bg） */
export const isPackageTextBadgeCanvasConfig = (config: CanvasItemConfig) =>
  config.code === 'package' &&
  Boolean(config.children?.some((child) => child.code === PACKAGE_TEXT_BG_CODE))

export type PackageGroupLayoutOptions = {
  /** 文字角标：组尺寸变化时按比例重算文字，而非线性缩放旧坐标 */
  textRelayout?: {
    info: LegendInfo
  }
}

/** 按组级宽高同步角标子节点（底图铺满、文字按倍率重排） */
export const syncPackageGroupChildrenLayout = (
  config: CanvasItemConfig,
  baseWidth: number,
  baseHeight: number,
  options?: PackageGroupLayoutOptions,
) => {
  if (!config.children?.length || baseWidth <= 0 || baseHeight <= 0) return

  const finalWidth = config.width ?? baseWidth
  const finalHeight = config.height ?? baseHeight

  const relayout = options?.textRelayout
    ? resolvePackageTextRelayoutFromInfo(options.textRelayout.info)
    : null
  const bgImage = config.children.find((child) => child.code === PACKAGE_TEXT_BG_CODE)?.image

  if (relayout && bgImage instanceof HTMLImageElement) {
    config.children = buildPackageTextBadgeChildren(
      relayout.preset,
      relayout.displayText,
      finalWidth,
      finalHeight,
      bgImage,
      relayout.packageStyle,
      relayout.kind,
    )
    return
  }

  const scaleX = finalWidth / baseWidth
  const scaleY = finalHeight / baseHeight

  for (const child of config.children) {
    const code = child.code ?? ''
    if (code === 'package-image') {
      applyPackageImageContainLayout(child, finalWidth, finalHeight)
      continue
    }
    if (code === PACKAGE_TEXT_BG_CODE) {
      child.width = finalWidth
      child.height = finalHeight
      child.x = 0
      child.y = 0
      continue
    }
    if (!code.startsWith('package-text-')) continue
    if (child.image instanceof HTMLCanvasElement) {
      if (typeof child.x === 'number') child.x *= scaleX
      if (typeof child.y === 'number') child.y *= scaleY
      if (typeof child.width === 'number') child.width *= scaleX
      if (typeof child.height === 'number') child.height *= scaleY
      continue
    }
    if (typeof child.x === 'number') child.x *= scaleX
    if (typeof child.y === 'number') child.y *= scaleY
    if (typeof child.fontSize === 'number') child.fontSize *= scaleX
    if (typeof child.width === 'number') child.width *= scaleX
    if (typeof child.height === 'number') child.height *= scaleY
    if (typeof child.scaleX === 'number') child.scaleX *= scaleX
    if (typeof child.scaleY === 'number') child.scaleY *= scaleY
    if (typeof child.strokeWidth === 'number') child.strokeWidth *= scaleX
  }
}
