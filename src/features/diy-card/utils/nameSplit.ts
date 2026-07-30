import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { DiyUnitConverters } from '@/features/diy-card/utils/canvas'
import { getPosition } from '@/features/diy-card/utils/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { toFixed } from '@/shared/utils/object'
import Konva from 'konva'

export const NAME_FONT_FAMILY = '金梅毛草行'

export type NameSplitCharLayout = {
  relX: number
  relY: number
  width: number
  height: number
}

export type NameTextMeasureConfig = {
  fontSize: number
  lineHeight: number
  align: 'center'
}

/** 单字图层 code，如 name-0 */
export const getNameSplitCharCode = (index: number) => `name-${index}`

export const isNameSplitCharCode = (code: string) => /^name-\d+$/.test(code)

/**
 * 解析武将名整体或拆分单字的 renderConfig
 */
export const resolveNameLayoutItem = (
  info: LegendInfo,
  code: string,
): LayoutItem | undefined => {
  if (code === 'name') return info.renderConfig.items.name
  if (!isNameSplitCharCode(code)) return undefined
  return info.renderConfig.items.name.splitChars?.[code]
}

/**
 * 在 canvasConfigs 树中查找节点配置（含 name 子 group）
 */
export const findCanvasConfigByCode = (
  configs: Record<string, CanvasItemConfig>,
  code: string,
): { rootKey: string; root: CanvasItemConfig; target: CanvasItemConfig } | null => {
  for (const [rootKey, root] of Object.entries(configs)) {
    if (root.code === code) {
      return { rootKey, root, target: root }
    }
    const nested = findInChildren(root.children, code)
    if (nested) {
      return { rootKey, root, target: nested }
    }
  }
  return null
}

const findInChildren = (
  children: CanvasItemConfig[] | undefined,
  code: string,
): CanvasItemConfig | null => {
  if (!children?.length) return null
  for (const child of children) {
    if (child.code === code) return child
    const nested = findInChildren(child.children, code)
    if (nested) return nested
  }
  return null
}

const measureTextHeight = (config: Record<string, unknown>, text: string) => {
  const node = new Konva.Text({ ...config, text })
  return node.height()
}

const measureTextWidth = (config: Record<string, unknown>, text: string) => {
  const node = new Konva.Text({ ...config, text })
  return node.width()
}

/**
 * 按与整段竖排武将名相同的字号、字距，度量每个字在组内的相对位置
 */
export const measureVerticalNameCharLayouts = (
  chars: string[],
  textConfig: NameTextMeasureConfig,
): { groupWidth: number; groupHeight: number; chars: NameSplitCharLayout[] } => {
  const baseConfig = {
    fontSize: textConfig.fontSize,
    fontFamily: NAME_FONT_FAMILY,
    lineHeight: textConfig.lineHeight,
    align: textConfig.align,
    fontStyle: 'bold' as const,
  }

  const fullText = chars.join('\n')
  const groupWidth = measureTextWidth(baseConfig, fullText)
  const groupHeight = measureTextHeight(baseConfig, fullText) + 20

  const charLayouts: NameSplitCharLayout[] = chars.map((ch, index) => {
    const prefix = index === 0 ? '' : chars.slice(0, index).join('\n')
    const through = chars.slice(0, index + 1).join('\n')
    const prefixH = index === 0 ? 0 : measureTextHeight(baseConfig, prefix)
    const throughH = measureTextHeight(baseConfig, through)
    const charW = measureTextWidth(baseConfig, ch)
    return {
      relX: (groupWidth - charW) / 2,
      relY: prefixH,
      width: groupWidth,
      height: throughH - prefixH,
    }
  })

  return { groupWidth, groupHeight, chars: charLayouts }
}

/** 单字相对父 group 的 mm → 相对画布原点的绝对 mm */
export const toNameSplitCharAbsMm = (
  nameItem: LegendInfo['renderConfig']['items']['name'],
  relLayout: NameSplitCharLayout,
  converters: DiyUnitConverters,
) => ({
  x: toFixed(nameItem.x + converters.pxToMm(relLayout.relX), 2),
  y: toFixed(nameItem.y + converters.pxToMm(relLayout.relY), 2),
})

/** 竖排列中心 X（mm），水平居中；垂直方向用槽位顶边对齐，避免拆分时整体上移 */
export const getSplitCharColumnAnchorXMm = (
  nameItem: LegendInfo['renderConfig']['items']['name'],
  verticalSlot: NameSplitCharLayout,
  converters: DiyUnitConverters,
) =>
  toFixed(nameItem.x + converters.pxToMm(verticalSlot.relX + verticalSlot.width / 2), 2)

/** mergeConfig 后的绝对 px 坐标转为父 group 内相对坐标（Konva 嵌套） */
export const nestNameSplitCharConfigUnderParent = (
  charConfig: CanvasItemConfig,
  parentOriginXPx: number,
  parentOriginYPx: number,
) => {
  const absOriginX = charConfig.originX ?? 0
  const absOriginY = charConfig.originY ?? 0
  const w = charConfig.width ?? 0
  const h = charConfig.height ?? 0
  const relX = absOriginX - parentOriginXPx
  const relY = absOriginY - parentOriginYPx
  Object.assign(charConfig, getPosition(relX, relY, w, h))
  charConfig.originX = relX
  charConfig.originY = relY
}

/** 描边/阴影留白，避免 Konva Text 固定宽高裁切 */
const charBoxPaddingPx = (fontSizePx: number) => {
  const strokeBleed = 6
  return Math.max(8, fontSizePx * 0.25) + strokeBleed
}

export const measureSingleNameCharBox = (char: string, textConfig: NameTextMeasureConfig) => {
  const baseConfig = {
    fontSize: textConfig.fontSize,
    fontFamily: NAME_FONT_FAMILY,
    lineHeight: textConfig.lineHeight,
    align: textConfig.align,
    fontStyle: 'bold' as const,
  }
  const padding = charBoxPaddingPx(textConfig.fontSize)
  return {
    width: measureTextWidth(baseConfig, char) + padding,
    height: measureTextHeight(baseConfig, char) + padding,
  }
}

/**
 * 拆分单字始终按当前字号测量包围盒，避免与默认字号相差 0.5pt 时在「槽位 / 测量」两套布局间切换导致跳动
 */
export const resolveSplitCharRenderLayout = (
  verticalSlot: NameSplitCharLayout,
  char: string,
  charFontSizePx: number,
  lineHeight: number,
): NameSplitCharLayout => {
  const box = measureSingleNameCharBox(char, {
    fontSize: charFontSizePx,
    lineHeight,
    align: 'center',
  })
  return {
    relX: verticalSlot.relX,
    relY: verticalSlot.relY,
    width: box.width,
    height: box.height,
  }
}

export const syncSplitCharAnchorFromBox = (charRenderObj: LayoutItem) => {
  charRenderObj.anchorCenterX = toFixed(charRenderObj.x + charRenderObj.width / 2, 2)
  charRenderObj.anchorCenterY = toFixed(charRenderObj.y + charRenderObj.height / 2, 2)
}

/**
 * 首次拆分 / 重置：槽位顶边 + 列中心 X，与未拆分时的竖排位置一致
 */
export const initSplitCharLayoutFromSlot = (
  charRenderObj: LayoutItem,
  nameItem: LegendInfo['renderConfig']['items']['name'],
  verticalSlot: NameSplitCharLayout,
  charLayout: NameSplitCharLayout,
  converters: DiyUnitConverters,
) => {
  const { y } = toNameSplitCharAbsMm(nameItem, verticalSlot, converters)
  const columnAnchorX = getSplitCharColumnAnchorXMm(nameItem, verticalSlot, converters)
  const widthMm = toFixed(converters.pxToMm(charLayout.width), 2)
  const heightMm = toFixed(converters.pxToMm(charLayout.height), 2)
  charRenderObj.x = toFixed(columnAnchorX - widthMm / 2, 2)
  charRenderObj.y = y
  charRenderObj.width = widthMm
  charRenderObj.height = heightMm
  charRenderObj.anchorCenterX = columnAnchorX
  charRenderObj.anchorCenterY = toFixed(y + heightMm / 2, 2)
}

/**
 * 字号变化：仅当包围盒变宽/变窄时按差值平移 x，保持字形中心不动；y 保持槽位顶边
 */
export const applySplitCharBoxFromAnchor = (
  charRenderObj: LayoutItem,
  charLayout: NameSplitCharLayout,
  converters: DiyUnitConverters,
) => {
  const widthMm = toFixed(converters.pxToMm(charLayout.width), 2)
  const heightMm = toFixed(converters.pxToMm(charLayout.height), 2)
  const deltaW = charRenderObj.width - widthMm
  if (Math.abs(deltaW) > 0.01) {
    charRenderObj.x = toFixed(charRenderObj.x + deltaW / 2, 2)
  }
  charRenderObj.width = widthMm
  charRenderObj.height = heightMm
  charRenderObj.anchorCenterX = toFixed(charRenderObj.x + widthMm / 2, 2)
  charRenderObj.anchorCenterY = toFixed(charRenderObj.y + heightMm / 2, 2)
}

/** 重置：回到槽位顶边对齐 */
export const syncSplitCharAbsLayoutFromSlot = (
  charRenderObj: LayoutItem,
  nameItem: LegendInfo['renderConfig']['items']['name'],
  verticalSlot: NameSplitCharLayout,
  charLayout: NameSplitCharLayout,
  converters: DiyUnitConverters,
) => {
  initSplitCharLayoutFromSlot(
    charRenderObj,
    nameItem,
    verticalSlot,
    charLayout,
    converters,
  )
}

/** 拆分单字使用测量包围盒，不再套竖排槽位 clip（避免与槽位宽切换叠加跳动） */
export const resolveSplitCharClip = () => undefined

const SPLIT_CHAR_EDITABLE = {
  selectable: true,
  movable: true,
  rotatable: true,
  scalable: true,
} as const

const ensureSplitCharEditable = (item: LayoutItem) => {
  item.editable = { ...SPLIT_CHAR_EDITABLE, ...item.editable }
}

const createSplitCharRenderItem = (
  code: string,
  char: string,
  index: number,
  nameItem: LegendInfo['renderConfig']['items']['name'],
  absXmm: number,
  absYmm: number,
  widthMm: number,
  heightMm: number,
  fontSizePt: number,
  anchorCenterX: number,
): LayoutItem => ({
  code,
  name: `武将名-${char}`,
  x: absXmm,
  y: absYmm,
  width: widthMm,
  height: heightMm,
  anchorCenterX,
  scale: 1,
  rotation: 0,
  size: fontSizePt,
  order: nameItem.order + (index + 1) / 100,
  editable: { ...SPLIT_CHAR_EDITABLE },
})

/**
 * 打开拆分：按当前整体武将名布局生成单字 renderConfig，并关闭整体可选
 */
export const ensureNameSplitChars = (
  info: LegendInfo,
  params: {
    chars: string[]
    charLayouts: NameSplitCharLayout[]
    groupOriginXPx: number
    groupOriginYPx: number
    fontSizePt: number
    converters: DiyUnitConverters
  },
) => {
  const nameItem = info.renderConfig.items.name
  const { chars, charLayouts, fontSizePt, converters } = params
  const prevSplit = nameItem.splitChars ?? {}
  const splitChars: Record<string, LayoutItem> = {}
  const countChanged = Object.keys(prevSplit).length !== chars.length

  chars.forEach((ch, index) => {
    const code = getNameSplitCharCode(index)
    const layout = charLayouts[index]!
    const existing = !countChanged ? prevSplit[code] : undefined
    const { x: absXmm, y: absYmm } = toNameSplitCharAbsMm(nameItem, layout, converters)
    const widthMm = toFixed(converters.pxToMm(layout.width), 2)
    const heightMm = toFixed(converters.pxToMm(layout.height), 2)
    const columnAnchorX = getSplitCharColumnAnchorXMm(nameItem, layout, converters)

    const entry =
      existing ??
      createSplitCharRenderItem(
        code,
        ch,
        index,
        nameItem,
        absXmm,
        absYmm,
        widthMm,
        heightMm,
        fontSizePt,
        columnAnchorX,
      )
    if (typeof entry.anchorCenterX !== 'number') {
      entry.anchorCenterX = columnAnchorX
    }
    ensureSplitCharEditable(entry)
    splitChars[code] = entry
  })

  nameItem.splitChars = splitChars
  if (nameItem.editable) {
    nameItem.editable.selectable = false
    nameItem.editable.movable = false
    nameItem.editable.scalable = false
  }
}

/**
 * 关闭拆分：恢复整体武将名可选中；字号回到模板默认（不再沿用单字 size）
 */
export const mergeNameSplitCharsToWhole = (
  info: LegendInfo,
  defaultFontSizePt: number,
) => {
  const nameItem = info.renderConfig.items.name
  nameItem.size = defaultFontSizePt

  delete nameItem.splitChars
  if (nameItem.editable) {
    nameItem.editable.selectable = true
    nameItem.editable.movable = true
    nameItem.editable.scalable = true
    nameItem.editable.rotatable = false
  }
}

/** 拆分开关切换时同步 renderConfig */
export const applyNameSplitFlagChange = (
  info: LegendInfo,
  splitFlag: boolean,
  params: {
    chars: string[]
    charLayouts: NameSplitCharLayout[]
    groupOriginXPx: number
    groupOriginYPx: number
    fontSizePt: number
    converters: DiyUnitConverters
  },
) => {
  if (splitFlag) {
    ensureNameSplitChars(info, params)
    return
  }
  mergeNameSplitCharsToWhole(info, params.fontSizePt)
}
