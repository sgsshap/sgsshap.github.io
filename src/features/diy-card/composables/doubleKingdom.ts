import {
  DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY,
  DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY,
  DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR,
} from '@/features/diy-card/constants/customKingdomDefaults'
import {
  CUSTOM_KINGDOM_LAYOUT_KEY,
  KINGDOM_CUSTOM_FONT_BY_ID,
  KINGDOM_DISPLAY_ORDER,
  type CustomKingdomTextMode,
  type KingdomCustomFontId,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import {
  resolveCustomKingdomDefaultDualCharSpacingMm,
  resolveCustomKingdomDefaultFontSizePt,
  resolvePresetKingdomGlyphLayoutMm,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/kingdomLayout'
import { usesShenFrameBorderOnly } from '@/features/diy-card/utils/syncFrameKingdom'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { useInfoStore } from '@/features/diy-card/stores'
import {
  ensureKingdomGlyphFontSizeItem,
} from '@/features/diy-card/utils/customKingdomFontSize'
import { hex2rgb } from '@/shared/utils/color'
import {
  isPresetKingdomActive,
} from '@/features/diy-card/composables/kingdomPreset'
import { getKingdomLabel, sortKingdomsByDisplayOrder } from '@/shared/utils/kingdom'

/**
 * 双势力列表顺序 = 势力 1、势力 2（与 OrderedKingdomPicker 槽位一致）。
 * 新选满两个势力时按 displayOrder 默认排序；用户可点「交换」对调，换选其他组合后恢复默认顺序。
 * 边框：half=势力1，full=势力2；体力素材 tier 与边框相反（hp full=势力1、hp half=势力2）；势力条：左=势力1，右=势力2。
 */
export interface DoubleKingdomPair {
  primary: string
  secondary: string
}

export type KingdomGlyphRole = 'primary' | 'secondary'

export type KingdomColorSlot = KingdomGlyphRole | 'single'

/** 是否开启自定义势力（详细设置总开关，仅边框/势力色等） */
export const isCustomKingdomActive = (info: LegendInfo) =>
  Boolean(info.renderConfig.items.kingdom.customKingdomFlag)

/** 详细设置「势力字置空」：预览与导出均不绘制势力字 */
export const isKingdomGlyphEmpty = (info: LegendInfo) =>
  Boolean(info.renderConfig.items.kingdom.glyphEmptyFlag)

/** 是否填写了自定义势力字（与 customKingdomFlag 无关，预设势力也可覆盖字图） */
export const hasCustomKingdomGlyphText = (info: LegendInfo) => {
  const text = info.renderConfig.items.kingdom.customText
  if (isDoubleKingdomRenderActive(info)) {
    return Boolean(text.primary?.trim() || text.secondary?.trim())
  }
  return Boolean(text.single?.trim())
}

/** 单势力自定义字：仅读取存档，不再回落 placeholder */
export const resolveCustomKingdomSingleTextForRender = (info: LegendInfo): string =>
  info.renderConfig.items.kingdom.customText.single?.trim() ?? ''

/** 双势力自定义字槽：仅读取存档 */
export const resolveCustomKingdomDoubleTextForRender = (
  info: LegendInfo,
  role: KingdomGlyphRole,
): string => info.renderConfig.items.kingdom.customText[role]?.trim() ?? ''

/** 单势力自定义字拆字（最多 2 字） */
export const resolveSingleCustomDisplayChars = (info: LegendInfo) => {
  const raw = resolveCustomKingdomSingleTextForRender(info).trim()
  return [...raw].slice(0, 2)
}

/** 单势力：用自定义字渲染（填写了 customText；扩展预设 PNG 除外） */
export const shouldRenderSingleCustomKingdomGlyph = (info: LegendInfo) => {
  if (isDoubleKingdomRenderActive(info)) return false
  if (isPresetKingdomActive(info)) return false
  return hasCustomKingdomGlyphText(info)
}

const readCustomKingdomColorHex = (value: unknown, fallback: string) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || fallback
}

/** 读取某槽位自定义势力色 hex（双势力用 primary/secondary，单势力用 customColor） */
export const resolveCustomKingdomColorHex = (
  info: LegendInfo,
  slot: KingdomColorSlot,
): string | undefined => {
  if (!isCustomKingdomActive(info)) return undefined
  const kingdom = info.renderConfig.items.kingdom
  if (isDoubleKingdomRenderActive(info)) {
    return slot === 'secondary'
      ? readCustomKingdomColorHex(
          kingdom.customColorSecondary,
          DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY,
        )
      : readCustomKingdomColorHex(
          kingdom.customColorPrimary,
          DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY,
        )
  }
  return readCustomKingdomColorHex(kingdom.customColor, DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR)
}

/** 解析为 Konva RGB 滤镜用的 0–255 分量 */
export const resolveCustomKingdomColorRgb = (
  info: LegendInfo,
  slot: KingdomColorSlot,
) => {
  const hex = resolveCustomKingdomColorHex(info, slot)
  return hex ? hex2rgb(hex) : undefined
}

/** 当前模式是否已配置可用于着色的自定义势力色 */
export const hasCustomKingdomColor = (info: LegendInfo) => {
  if (!isCustomKingdomActive(info)) return false
  if (isDoubleKingdomRenderActive(info)) {
    return Boolean(
      resolveCustomKingdomColorHex(info, 'primary') &&
        resolveCustomKingdomColorHex(info, 'secondary'),
    )
  }
  return Boolean(resolveCustomKingdomColorHex(info, 'single'))
}

/** 双势力字图层 code */
export const getKingdomGlyphCode = (role: KingdomGlyphRole) =>
  role === 'primary' ? 'kingdom-primary' : 'kingdom-secondary'

export const isKingdomGlyphCode = (code: string) =>
  code === 'kingdom-primary' || code === 'kingdom-secondary'

/** 势力根节点（单字 / 单势力双字组）工厂默认布局 */
export const isFactoryKingdomRootLayout = (renderObj: LayoutItem) =>
  renderObj.code === 'kingdom' &&
  renderObj.x === 0 &&
  renderObj.y === 0 &&
  renderObj.width === 100 &&
  renderObj.height === 100 &&
  renderObj.scale === 1 &&
  renderObj.rotation === 0

const isFactoryKingdomGlyphLayoutItem = (renderObj: LayoutItem) =>
  isKingdomGlyphCode(renderObj.code) &&
  renderObj.x === 0 &&
  renderObj.y === 0 &&
  renderObj.width === 10 &&
  renderObj.height === 10 &&
  renderObj.scale === 1 &&
  renderObj.rotation === 0

/** 是否已保存过有效坐标（势力根节点或双势力字子节点） */
export const hasKingdomGlyphPersistedLayout = (renderObj: LayoutItem) => {
  if (renderObj.code === 'kingdom') {
    return !isFactoryKingdomRootLayout(renderObj)
  }
  if (!isKingdomGlyphCode(renderObj.code)) return false
  return !isFactoryKingdomGlyphLayoutItem(renderObj)
}

/** 工厂默认布局（与 createGlyphLayoutItem 一致），用于 cover 居中判定 */
export const isFactoryKingdomGlyphLayout = (renderObj: LayoutItem) =>
  isKingdomGlyphCode(renderObj.code) && !hasKingdomGlyphPersistedLayout(renderObj)

/** 双势力模式下已选势力列表（非神） */
export const getDoubleKingdomList = (info: LegendInfo) =>
  info.baseInfo.doubleKingdom?.filter((k) => k && k !== 'shen') ?? []

/** 预设双势力默认：势力1=魏、势力2=群 */
export const DEFAULT_PRESET_DOUBLE_KINGDOM = ['wei', 'qun'] as const

/** 双势力「组合」指纹（与槽位顺序无关，用于判断是否换选了势力） */
export const doubleKingdomSelectionKey = (list: readonly string[]) =>
  list
    .filter((k) => k && k !== 'shen')
    .slice(0, 2)
    .sort()
    .join('\0')

/**
 * 处理双势力列表变更：过滤神势力；组合变化且已满 2 个时按 displayOrder 排序，否则保留槽位顺序（含用户交换）。
 */
export const resolveDoubleKingdomListOnChange = (
  prev: readonly string[],
  next: readonly string[],
  displayOrder?: readonly string[],
): string[] => {
  const filtered = next.filter((k) => k && k !== 'shen').slice(0, 2)
  const selectionChanged = doubleKingdomSelectionKey(prev) !== doubleKingdomSelectionKey(filtered)
  if (filtered.length >= 2 && selectionChanged && displayOrder?.length) {
    return sortKingdomsByDisplayOrder(filtered, displayOrder)
  }
  return filtered
}

/** 交换当前双势力槽位 1 / 2（需已选满 2 个非神势力） */
export const swapDoubleKingdomList = (info: LegendInfo) => {
  const list = getDoubleKingdomList(info)
  if (list.length < 2) return
  info.baseInfo.doubleKingdom = [list[1]!, list[0]!]
}

/**
 * 双势力列表为空时写入默认魏、群；已有 1 个时保留（便于用户替换）；已满 2 个则取前两项并按展示序排序。
 * 传入 displayOrder 时按模板展示优先级排序（如 KINGDOM_DISPLAY_ORDER）。
 */
export const ensurePresetDoubleKingdomList = (
  info: LegendInfo,
  displayOrder?: readonly string[],
) => {
  const picked = getDoubleKingdomList(info)
  if (picked.length === 0) {
    let list: string[] = [...DEFAULT_PRESET_DOUBLE_KINGDOM]
    if (displayOrder?.length) {
      list = sortKingdomsByDisplayOrder(list, displayOrder)
    }
    assignDoubleKingdomListIfChanged(info, list)
    return
  }
  if (picked.length === 1) {
    assignDoubleKingdomListIfChanged(info, picked)
    return
  }
  let list = picked.slice(0, 2)
  if (displayOrder?.length) {
    list = sortKingdomsByDisplayOrder(list, displayOrder)
  }
  assignDoubleKingdomListIfChanged(info, list)
}

/**
 * 开启自定义势力时：单势力切到魏；双势力开关已开时列表重置为魏+群。
 */
export const applyCustomKingdomPresetKingdom = (displayOrder?: readonly string[]) => {
  const infoStore = useInfoStore()
  const legend = infoStore.info as LegendInfo
  legend.baseInfo.kingdom = 'wei'
  legend.renderConfig.items.frame.src = 'wei'
  if (!isDoubleKingdomSwitchOn(legend)) return
  let list: string[] = [...DEFAULT_PRESET_DOUBLE_KINGDOM]
  if (displayOrder?.length) {
    list = sortKingdomsByDisplayOrder(list, displayOrder)
  }
  assignDoubleKingdomListIfChanged(legend, list)
}

/** 自定义势力下切换为神势力（与双势力、主公互斥） */
export const applyCustomKingdomShenKingdom = () => {
  const legend = useInfoStore().info as LegendInfo
  legend.renderConfig.items.kingdom.doubleKingdom = false
  legend.baseInfo.kingdom = 'shen'
  legend.renderConfig.items.frame.src = 'shen'
  legend.baseInfo.masterFlag = false
}

/** 自定义势力下的双势力布局占位 key（不读取基础信息里的预设双势力组合） */
const CUSTOM_DOUBLE_KINGDOM_ASSET_KEY = 'wei'

/**
 * 是否应按双势力叠层渲染。
 * 自定义势力：仅看 renderConfig 双势力开关；否则需开关开启且基础信息已选满 2 个势力。
 */
export const isDoubleKingdomRenderActive = (info: LegendInfo) => {
  if (!info.renderConfig.items.kingdom.doubleKingdom) return false
  if (isCustomKingdomActive(info)) return true
  return getDoubleKingdomList(info).length >= 2
}

/** 双势力开关是否开启（与是否已选满 2 个势力无关） */
export const isDoubleKingdomSwitchOn = (info: LegendInfo) =>
  Boolean(info.renderConfig.items.kingdom.doubleKingdom)

/** 双势力下仅显示一字（位置走单势力布局表） */
export const isDoubleKingdomSingleGlyphMode = (info: LegendInfo) =>
  isDoubleKingdomRenderActive(info) &&
  Boolean(info.renderConfig.items.kingdom.doubleSingleGlyphFlag)

/** 双势力上下叠层两字（与单字模式互斥） */
export const isDoubleKingdomDoubleGlyphLayerActive = (info: LegendInfo) =>
  isDoubleKingdomRenderActive(info) && !isDoubleKingdomSingleGlyphMode(info)

/** 双势力单字模式当前显示的槽位 */
export const resolveDoubleKingdomSingleGlyphRole = (info: LegendInfo): KingdomGlyphRole =>
  info.renderConfig.items.kingdom.doubleSingleGlyphRole === 'secondary'
    ? 'secondary'
    : 'primary'

/** 双势力单字模式当前势力 key */
export const resolveDoubleKingdomSingleGlyphKingdomKey = (info: LegendInfo): string | null => {
  const pair = resolveDoubleKingdomPair(info)
  if (!pair) return null
  const role = resolveDoubleKingdomSingleGlyphRole(info)
  return role === 'secondary' ? pair.secondary : pair.primary
}

/** 双势力单字模式着色槽位 */
export const resolveDoubleKingdomSingleGlyphColorSlot = (
  info: LegendInfo,
): KingdomColorSlot => resolveDoubleKingdomSingleGlyphRole(info)

/** 双势力槽位展示名（优先自定义字，其次魏蜀吴群晋选择） */
export const resolveDoubleKingdomSlotDisplayLabel = (
  info: LegendInfo,
  role: KingdomGlyphRole,
): string => {
  const customRaw = info.renderConfig.items.kingdom.customText[role]?.trim()
  if (customRaw) return customRaw
  const list = getDoubleKingdomList(info)
  const key = list[role === 'primary' ? 0 : 1]
  if (key) return getKingdomLabel(key) ?? key
  return role === 'primary' ? '势力1' : '势力2'
}

/**
 * 是否按单势力神将专用布局渲染（name / title / hp 等）。
 * 与双势力叠层互斥（以 isDoubleKingdomRenderActive 为准，避免开关状态残留）。
 */
export const isShenSingleKingdomActive = (info: LegendInfo) =>
  info.baseInfo.kingdom === 'shen' && !isDoubleKingdomRenderActive(info)

/**
 * 是否按神将卡面默认布局（神框或神势力武将）。
 * 边框选神框时，势力字默认位置/字号、体力组起点等与神势力一致。
 * 双势力叠层时与神框布局互斥，各元素走普通卡面基准。
 */
export const usesShenCardLayout = (info: LegendInfo): boolean => {
  if (isDoubleKingdomRenderActive(info)) return false
  const frameSrc = info.renderConfig.items.frame.src?.trim()
  return frameSrc === 'shen' || isShenSingleKingdomActive(info)
}

/** 主公开关是否生效（神框 / 神势力下不可用，与神将卡面一致） */
export const isMasterFlagActive = (info: LegendInfo): boolean =>
  Boolean(info.baseInfo.masterFlag) && !usesShenCardLayout(info)

/** 自定义势力 + 单势力神将 */
export const isCustomShenKingdomActive = (info: LegendInfo) =>
  isCustomKingdomActive(info) && isShenSingleKingdomActive(info)

/** 自定义势力 + 神势力：称号是否改用自定义势力色（否则为默认黄色） */
export const shouldCustomShenTitleUseKingdomColor = (info: LegendInfo) =>
  isCustomShenKingdomActive(info) &&
  Boolean(info.renderConfig.items.kingdom.customShenTitleColorFlag)

/** 神将卡面 + 已配置自定义势力色：技能名与神技能区底图改用势力色（与 frame 着色范围一致） */
export const shouldCustomShenSkillUseKingdomColor = (info: LegendInfo) =>
  usesShenCardLayout(info) &&
  !isDoubleKingdomRenderActive(info) &&
  hasCustomKingdomColor(info)

/** 重置自定义势力字拖拽布局，切换神/非神或单双字模式时使用 */
export const resetCustomKingdomGlyphLayout = (isShen: boolean) => {
  const legend = useInfoStore().info as LegendInfo
  const kingdom = legend.renderConfig.items.kingdom
  kingdom.x = 0
  kingdom.y = 0
  kingdom.width = 100
  kingdom.height = 100
  kingdom.scale = 1
  kingdom.rotation = 0
  delete kingdom.size
  kingdom.customDualCharSpacingMm = resolveCustomKingdomDefaultDualCharSpacingMm(isShen)
  clearDoubleKingdomGlyphItems(kingdom)
  const info = legend
  if (hasCustomKingdomGlyphText(info)) {
    const textMode = isShen
      ? resolveCustomKingdomRootTextMode(info)
      : isDoubleKingdomSingleGlyphMode(info)
        ? 'single'
        : isDoubleKingdomRenderActive(info)
          ? 'dual'
          : resolveCustomKingdomRootTextMode(info)
    kingdom.size = resolveCustomKingdomDefaultFontSizePt(isShen, textMode)
    kingdom.scale = 1
  }
}

/** 预设势力字：恢复工厂占位并清跟踪键（百科版本覆盖、势力切换等） */
export const resetPresetKingdomGlyphLayout = (
  kingdomItem: LegendInfo['renderConfig']['items']['kingdom'],
) => {
  kingdomItem.x = 0
  kingdomItem.y = 0
  kingdomItem.width = 100
  kingdomItem.height = 100
  kingdomItem.scale = 1
  kingdomItem.rotation = 0
  delete kingdomItem.singlePresetGlyphKey
  clearDoubleKingdomGlyphItems(kingdomItem)
}

/** 单势力 customText.single 字数对应的布局模式（0 字为 null） */
export const resolveCustomKingdomSingleTextMode = (
  text: string,
): CustomKingdomTextMode | null => {
  const len = text.trim().length
  if (len === 0) return null
  return len === 1 ? 'single' : 'dual'
}

/** 单势力自定义字在单字 / 双字模式间切换时，重置默认布局、间距与字号 */
export const resetCustomKingdomSingleTextDefaults = (info: LegendInfo) => {
  if (isDoubleKingdomRenderActive(info)) return
  if (!isCustomKingdomActive(info) && !hasCustomKingdomGlyphText(info)) return
  resetCustomKingdomGlyphLayout(
    isCustomShenKingdomActive(info) || usesShenCardLayout(info),
  )
}

/** 双势力与主公互斥：开启双势力时强制关闭主公 */
export const clearMasterFlagForDoubleKingdom = (info: LegendInfo) => {
  if (isDoubleKingdomSwitchOn(info) && info.baseInfo.masterFlag) {
    info.baseInfo.masterFlag = false
  }
}

/**
 * 开启双势力时的联动：
 * - 当前为神框时，势力与边框统一切到魏
 * - 自定义势力 + 神势力时与双势力互斥，同样切到魏
 */
export const onDoubleKingdomEnabled = (
  info: LegendInfo,
  displayOrder?: readonly string[],
) => {
  const frameSrc = info.renderConfig.items.frame.src?.trim()
  const shouldSwitchToWei =
    frameSrc === 'shen' ||
    (isCustomKingdomActive(info) && info.baseInfo.kingdom === 'shen')

  if (shouldSwitchToWei) {
    info.baseInfo.kingdom = 'wei'
    info.renderConfig.items.frame.src = 'wei'
    info.renderConfig.items.kingdom.glyphColorFlag = false
    info.renderConfig.items.kingdom.glyphGradientFlag = false
  }

  ensurePresetDoubleKingdomList(info, displayOrder)
  clearMasterFlagForDoubleKingdom(info)
}

const isSameStringList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])

const assignDoubleKingdomListIfChanged = (info: LegendInfo, list: string[]) => {
  const current = info.baseInfo.doubleKingdom ?? []
  if (isSameStringList(current, list)) return
  info.baseInfo.doubleKingdom = list
}

type KingdomRenderItem = LegendInfo['renderConfig']['items']['kingdom']

/** 写入自定义双势力默认双色 */
const applyCustomDoubleKingdomDefaultColors = (kingdom: KingdomRenderItem) => {
  kingdom.customColorPrimary = DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY
  kingdom.customColorSecondary = DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY
}

/** 写入单势力自定义默认色（仅填空） */
const applyCustomSingleKingdomDefaultColor = (kingdom: KingdomRenderItem) => {
  if (!kingdom.customColor?.trim()) {
    kingdom.customColor = DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR
  }
}

/** 两色缺失或未区分时，应用当前默认双色 */
const ensureCustomDoubleKingdomDefaultColors = (kingdom: KingdomRenderItem) => {
  const primary = kingdom.customColorPrimary?.trim()
  const secondary = kingdom.customColorSecondary?.trim()

  if (!primary || !secondary || primary === secondary) {
    applyCustomDoubleKingdomDefaultColors(kingdom)
  }
}

const ensureCustomSingleKingdomSetup = (info: LegendInfo) => {
  if (!isCustomKingdomActive(info) || isDoubleKingdomSwitchOn(info)) return
  const kingdom = info.renderConfig.items.kingdom
  applyCustomSingleKingdomDefaultColor(kingdom)
}

const ensureCustomDoubleKingdomSetup = (info: LegendInfo) => {
  if (!isCustomKingdomActive(info) || !isDoubleKingdomSwitchOn(info)) return
  if (getDoubleKingdomList(info).length === 0) {
    ensurePresetDoubleKingdomList(info, KINGDOM_DISPLAY_ORDER)
  }
  const kingdom = info.renderConfig.items.kingdom
  ensureCustomDoubleKingdomDefaultColors(kingdom)
  clearMasterFlagForDoubleKingdom(info)
}

/** 自定义势力双字：scalable + size(pt)；官方预设 PNG 字：scalable + scale(倍率) */
const applyKingdomGlyphEditableMode = (
  kingdom: LegendInfo['renderConfig']['items']['kingdom'],
  fontSizeMode: boolean,
  isShen: boolean,
) => {
  const glyphs = kingdom.doubleGlyphs
  if (!glyphs) return

  for (const role of ['primary', 'secondary'] as const) {
    const item = glyphs[getKingdomGlyphCode(role)]
    if (!item?.editable) continue
    if (item.editable.scalable !== true) {
      item.editable.scalable = true
    }
    if (fontSizeMode) {
      ensureKingdomGlyphFontSizeItem(item, isShen, 'dual')
    } else if (typeof item.size === 'number') {
      delete item.size
    }
  }
}

/** 自定义势力 kingdom 根节点：按当前文本判断单字 / 双字默认字号 */
export const resolveCustomKingdomRootTextMode = (info: LegendInfo): CustomKingdomTextMode => {
  if (isDoubleKingdomSingleGlyphMode(info)) return 'single'
  if (isDoubleKingdomRenderActive(info)) return 'dual'
  const len = resolveCustomKingdomSingleTextForRender(info).trim().length
  return len === 1 ? 'single' : 'dual'
}

/** 读取自定义双字水平间距（mm） */
export const resolveKingdomCustomDualCharSpacingMm = (info: LegendInfo) => {
  const spacing = info.renderConfig.items.kingdom.customDualCharSpacingMm
  const fallback = resolveCustomKingdomDefaultDualCharSpacingMm(
    isCustomShenKingdomActive(info) || usesShenCardLayout(info),
  )
  return typeof spacing === 'number' && spacing >= 0 ? spacing : fallback
}

/** 按当前模式应用自定义势力默认字/色 */
export const ensureCustomKingdomSetup = (info: LegendInfo) => {
  const kingdom = info.renderConfig.items.kingdom
  if (!kingdom.editable) return

  const custom = isCustomKingdomActive(info)
  const presetActive = isPresetKingdomActive(info)

  if (presetActive) {
    if (typeof kingdom.size === 'number') {
      delete kingdom.size
    }
    if (!kingdom.editable.scalable) {
      kingdom.editable.scalable = true
    }
    applyKingdomGlyphEditableMode(kingdom, false, false)
    return
  }

  if (!custom) {
    if (!kingdom.editable.scalable) {
      kingdom.editable.scalable = true
    }
    if (typeof kingdom.size === 'number' && !hasCustomKingdomGlyphText(info)) {
      delete kingdom.size
    }
    if (hasCustomKingdomGlyphText(info)) {
      const layoutAsShen = usesShenCardLayout(info)
      const textMode = resolveCustomKingdomRootTextMode(info)
      ensureKingdomGlyphFontSizeItem(kingdom, layoutAsShen, textMode)
      applyKingdomGlyphEditableMode(kingdom, true, layoutAsShen)
    } else {
      applyKingdomGlyphEditableMode(kingdom, false, false)
    }
    return
  }

  if (!kingdom.editable.scalable) {
    kingdom.editable.scalable = true
  }
  if (hasCustomKingdomGlyphText(info)) {
    const isShen = isCustomShenKingdomActive(info)
    const textMode = resolveCustomKingdomRootTextMode(info)
    ensureKingdomGlyphFontSizeItem(kingdom, isShen, textMode)
    applyKingdomGlyphEditableMode(kingdom, true, isShen)
  } else {
    if (typeof kingdom.size === 'number') {
      delete kingdom.size
    }
    applyKingdomGlyphEditableMode(kingdom, false, false)
  }

  if (isDoubleKingdomRenderActive(info)) {
    ensureCustomDoubleKingdomSetup(info)
  } else {
    ensureCustomSingleKingdomSetup(info)
  }
}

/** 单势力自定义双字：两字固定左上/右下，整体随 kingdom 组拖拽 */
export const isSingleCustomDualCharActive = (info: LegendInfo) => {
  if (isDoubleKingdomRenderActive(info)) return false
  return resolveCustomKingdomSingleTextForRender(info).trim().length >= 2
}

export const resolveKingdomCustomFontFamily = (info: LegendInfo) => {
  const id = info.renderConfig.items.kingdom.customFont as KingdomCustomFontId
  return KINGDOM_CUSTOM_FONT_BY_ID[id] ?? KINGDOM_CUSTOM_FONT_BY_ID[1]
}

/**
 * 单势力渲染用的势力 key。
 * 双势力开关残留时仍以 baseInfo.kingdom 为准；仅双势力叠层未激活时不用 doubleKingdom 列表，
 * 避免神势力 + 神框刷新后误用列表首项（如 wei）的布局坐标。
 */
export const resolveKingdomForSingleRender = (info: LegendInfo) => {
  if (isCustomKingdomActive(info)) {
    return info.baseInfo.kingdom || CUSTOM_DOUBLE_KINGDOM_ASSET_KEY
  }
  if (info.baseInfo.kingdom === 'shen') {
    return 'shen'
  }
  if (info.renderConfig.items.kingdom.doubleKingdom && !isDoubleKingdomRenderActive(info)) {
    const fromList = getDoubleKingdomList(info)[0]
    if (fromList) return fromList
  }
  return info.baseInfo.kingdom
}

/**
 * 解析当前双势力选择（需开启双势力且已选满 2 个非神势力）
 */
export const resolveDoubleKingdomPair = (info: LegendInfo): DoubleKingdomPair | null => {
  if (!isDoubleKingdomRenderActive(info)) return null
  const list = getDoubleKingdomList(info)
  if (isCustomKingdomActive(info) && hasCustomKingdomGlyphText(info)) {
    return {
      primary: CUSTOM_DOUBLE_KINGDOM_ASSET_KEY,
      secondary: CUSTOM_DOUBLE_KINGDOM_ASSET_KEY,
    }
  }
  if (list.length >= 2) {
    return { primary: list[0]!, secondary: list[1]! }
  }
  return {
    primary: list[0] || CUSTOM_DOUBLE_KINGDOM_ASSET_KEY,
    secondary: list[1] || CUSTOM_DOUBLE_KINGDOM_ASSET_KEY,
  }
}

/**
 * 解析势力整体或双势力单字 renderConfig
 */
export const resolveKingdomLayoutItem = (
  info: LegendInfo,
  code: string,
): LayoutItem | undefined => {
  if (code === 'kingdom') return info.renderConfig.items.kingdom
  if (!isKingdomGlyphCode(code)) return undefined
  return info.renderConfig.items.kingdom.doubleGlyphs?.[code]
}

/** 操作元素列表展示名，如「势力_魏」 */
export const formatKingdomGlyphName = (kingdomKey: string) =>
  `势力_${getKingdomLabel(kingdomKey) ?? kingdomKey}`

/** 自定义势力字操作名 */
export const formatCustomKingdomGlyphName = (text: string) => `势力字_${text}`

const createGlyphLayoutItem = (
  code: string,
  name: string,
  order: number,
  scalable: boolean,
): LayoutItem => ({
  code,
  name,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  scale: 1,
  rotation: 0,
  order,
  editable: {
    selectable: true,
    movable: true,
    rotatable: false,
    scalable,
  },
})

/**
 * 同步双势力字条目（切换势力组合时保留仍可复用的拖拽数据）
 */
export const syncDoubleKingdomGlyphItems = (
  kingdomItem: LegendInfo['renderConfig']['items']['kingdom'],
  pair: DoubleKingdomPair,
  primaryAsset: string,
  secondaryAsset: string,
  isShen = false,
) => {
  const prev = kingdomItem.doubleGlyphs ?? {}
  const primaryCode = getKingdomGlyphCode('primary')
  const secondaryCode = getKingdomGlyphCode('secondary')
  const customFontSize = primaryAsset === 'custom' || secondaryAsset === 'custom'

  const primaryItem =
    prev[primaryCode] ??
    createGlyphLayoutItem(
      primaryCode,
      formatKingdomGlyphName(pair.primary),
      kingdomItem.order + 0.1,
      true,
    )
  primaryItem.name = formatKingdomGlyphName(pair.primary)
  if (primaryItem.editable) {
    primaryItem.editable.scalable = true
  }
  if (customFontSize) {
    ensureKingdomGlyphFontSizeItem(primaryItem, isShen, 'dual')
  } else {
    delete primaryItem.size
  }

  const secondaryItem =
    prev[secondaryCode] ??
    createGlyphLayoutItem(
      secondaryCode,
      formatKingdomGlyphName(pair.secondary),
      kingdomItem.order + 0.2,
      true,
    )
  secondaryItem.name = formatKingdomGlyphName(pair.secondary)
  if (secondaryItem.editable) {
    secondaryItem.editable.scalable = true
  }
  if (customFontSize) {
    ensureKingdomGlyphFontSizeItem(secondaryItem, isShen, 'dual')
  } else {
    delete secondaryItem.size
  }

  // 原地更新，避免每次 kingdom 重绘替换 doubleGlyphs 引用触发 deep watch 死循环
  if (!kingdomItem.doubleGlyphs) {
    kingdomItem.doubleGlyphs = {}
  }
  kingdomItem.doubleGlyphs[primaryCode] = primaryItem
  kingdomItem.doubleGlyphs[secondaryCode] = secondaryItem
  // doubleGlyphKingdoms 由 kingdom 图层在绘制结束后写入，避免提前覆盖导致
  // shouldResetKingdomGlyphLayout 无法识别「自定义字 ↔ 预设素材」切换。
}

export const clearDoubleKingdomGlyphItems = (
  kingdomItem: LegendInfo['renderConfig']['items']['kingdom'],
) => {
  delete kingdomItem.doubleGlyphs
  delete kingdomItem.doubleGlyphKingdoms
}

const PRESET_KINGDOM_LAYOUT_KEYS = ['wei', 'shu', 'wu', 'qun', 'jin', 'shen'] as const

const matchesPresetKingdomLayoutMm = (
  persisted: { x: number; y: number; width: number },
  expected: { x: number; y: number; width: number },
) =>
  Math.abs(persisted.x - expected.x) < 0.02 &&
  Math.abs(persisted.y - expected.y) < 0.02 &&
  Math.abs(persisted.width - expected.width) < 0.02

/** 单势力预设 PNG 当前应使用的布局指纹 */
export const buildSinglePresetGlyphLayoutKey = (
  info: LegendInfo,
  assetKingdom: string,
) => {
  const useShenFramePresetLayout =
    usesShenFrameBorderOnly(info) && !isCustomKingdomActive(info)
  const layoutKingdomKey = isShenSingleKingdomActive(info) ? 'shen' : assetKingdom
  const masterSuffix =
    isMasterFlagActive(info) &&
    !info.renderConfig.items.kingdom.presetKingdomKey?.trim() &&
    !hasCustomKingdomGlyphText(info)
      ? ':master'
      : ''
  return `${layoutKingdomKey}:${useShenFramePresetLayout ? 'shen-frame' : 'normal'}${masterSuffix}`
}

/** 持久化坐标是否仍为其他势力/布局表的工厂默认值（刷新后需重算） */
const isStaleFactorySinglePresetKingdomLayout = (
  kingdomItem: LayoutItem,
  currentLayoutKey: string,
) => {
  const persisted = { x: kingdomItem.x, y: kingdomItem.y, width: kingdomItem.width }
  const [currentKingdom = 'shen', currentMode = 'normal'] = currentLayoutKey.split(':')
  const currentExpected = resolvePresetKingdomGlyphLayoutMm(
    currentKingdom,
    currentMode === 'shen-frame',
  )
  if (matchesPresetKingdomLayoutMm(persisted, currentExpected)) return false

  for (const key of PRESET_KINGDOM_LAYOUT_KEYS) {
    for (const shenFrame of [true, false] as const) {
      const otherKey = `${key}:${shenFrame ? 'shen-frame' : 'normal'}`
      if (otherKey === currentLayoutKey) continue
      const otherExpected = resolvePresetKingdomGlyphLayoutMm(key, shenFrame)
      if (matchesPresetKingdomLayoutMm(persisted, otherExpected)) return true
    }
  }
  return false
}

/** 单势力预设字是否应恢复默认坐标（势力/神框布局切换或刷新后坐标错位） */
export const shouldResetSinglePresetKingdomLayout = (
  info: LegendInfo,
  kingdomItem: LegendInfo['renderConfig']['items']['kingdom'],
  layoutKey: string,
) => {
  if (isCustomKingdomActive(info)) return false
  if (isDoubleKingdomRenderActive(info) && !isDoubleKingdomSingleGlyphMode(info)) return false
  const tracked = kingdomItem.singlePresetGlyphKey
  if (tracked === layoutKey) return false
  if (tracked !== undefined) return true
  if (!hasKingdomGlyphPersistedLayout(kingdomItem)) return true
  return isStaleFactorySinglePresetKingdomLayout(kingdomItem, layoutKey)
}

/** 当前单势力预设字应使用的布局指纹（供 reconcile / bootstrap 判定） */
export const resolveSinglePresetKingdomLayoutKey = (info: LegendInfo) =>
  buildSinglePresetGlyphLayoutKey(info, resolveKingdomForSingleRender(info))

/**
 * 是否应从历史快照还原势力字 layout。
 * 快照 layoutKey 与当前神/普通框不一致时跳过，避免 refresh 后 reconcile 写回普通框坐标。
 */
export const shouldReconcileKingdomLayoutFromSnapshot = (
  info: LegendInfo,
  snapshotKingdom: LegendInfo['renderConfig']['items']['kingdom'],
): boolean => {
  if (isCustomKingdomActive(info)) return true
  if (isDoubleKingdomRenderActive(info)) return true

  const expectedKey = resolveSinglePresetKingdomLayoutKey(info)
  const snapshotKey = snapshotKingdom.singlePresetGlyphKey
  if (snapshotKey !== undefined && snapshotKey !== expectedKey) return false
  if (snapshotKey === expectedKey) return true
  return !shouldResetSinglePresetKingdomLayout(info, snapshotKingdom, expectedKey)
}

/** 双势力字 track key 是否表示自定义文字（t:字 或 custom） */
const isDoubleKingdomCustomGlyphTrackKey = (key: string | undefined) =>
  Boolean(key && (key.startsWith('t:') || key === CUSTOM_KINGDOM_LAYOUT_KEY))

/** 该角色势力 key 是否相对上次绘制发生变化（需重置默认坐标） */
export const shouldResetKingdomGlyphLayout = (
  kingdomItem: LegendInfo['renderConfig']['items']['kingdom'],
  role: KingdomGlyphRole,
  assetKey: string,
) => {
  const tracked = kingdomItem.doubleGlyphKingdoms?.[role]
  const trackedIsCustom = isDoubleKingdomCustomGlyphTrackKey(tracked)
  const nextIsCustom = isDoubleKingdomCustomGlyphTrackKey(assetKey)
  if (tracked !== undefined && trackedIsCustom !== nextIsCustom) {
    return true
  }

  const glyph = kingdomItem.doubleGlyphs?.[getKingdomGlyphCode(role)]
  if (glyph && hasKingdomGlyphPersistedLayout(glyph)) {
    return tracked !== undefined && tracked !== assetKey
  }
  return tracked !== assetKey
}

export const listKingdomGlyphCanvasConfigs = (
  configs: Record<string, CanvasItemConfig>,
): CanvasItemConfig[] =>
  configs.kingdom?.children?.filter((child) => isKingdomGlyphCode(child.code)) ?? []

/** 技能势力技：双势力技存盘值（空字符串，与具体势力 key 区分） */
export const SKILL_KINGDOM_BOTH_VALUE = ''

/** 自定义双势力：势力 1 势力技 */
export const SKILL_KINGDOM_PRIMARY_VALUE = 'primary'

/** 自定义双势力：势力 2 势力技 */
export const SKILL_KINGDOM_SECONDARY_VALUE = 'secondary'

/** 是否为双势力技（势力技为空） */
export const isSkillBothKingdom = (value: string | undefined) => !value

/** 自定义势力字 + 双势力：显示自定义标签的技能势力技选择 */
export const isCustomDoubleKingdomSkillPickerActive = (info: LegendInfo) =>
  isCustomKingdomActive(info) &&
  isDoubleKingdomRenderActive(info) &&
  hasCustomKingdomGlyphText(info)

/** 双势力模式下势力技下拉选项（默认第一项为双势力技） */
export const buildSkillKingdomSkillOptions = (kingdoms: string[]) => {
  const picked = kingdoms.filter((k) => k && k !== 'shen')
  return [
    { value: SKILL_KINGDOM_BOTH_VALUE, label: '双势力技' },
    ...picked.map((k) => ({
      value: k,
      label: `${getKingdomLabel(k) ?? k}势力技`,
    })),
  ]
}

/** 自定义双势力：势力技下拉（标签取自自定义势力字） */
export const buildCustomSkillKingdomSkillOptions = (info: LegendInfo) => {
  const primaryLabel = resolveDoubleKingdomSlotDisplayLabel(info, 'primary')
  const secondaryLabel = resolveDoubleKingdomSlotDisplayLabel(info, 'secondary')
  return [
    { value: SKILL_KINGDOM_BOTH_VALUE, label: '双势力技' },
    { value: SKILL_KINGDOM_PRIMARY_VALUE, label: `${primaryLabel}势力技` },
    { value: SKILL_KINGDOM_SECONDARY_VALUE, label: `${secondaryLabel}势力技` },
  ]
}

const customSkillKingdomAllowedValues = new Set([
  SKILL_KINGDOM_BOTH_VALUE,
  SKILL_KINGDOM_PRIMARY_VALUE,
  SKILL_KINGDOM_SECONDARY_VALUE,
])

/** 校正自定义双势力技能势力技 */
export const normalizeCustomSkillKingdom = (value: string | undefined) => {
  if (value !== undefined && customSkillKingdomAllowedValues.has(value)) return value
  return SKILL_KINGDOM_BOTH_VALUE
}

const skillKingdomAllowedValues = (kingdoms: string[]) => {
  const picked = kingdoms.filter((k) => k && k !== 'shen')
  return new Set([SKILL_KINGDOM_BOTH_VALUE, ...picked])
}

/** 校正技能势力技；非法或缺失时回退为空（双势力技） */
export const normalizeSkillKingdom = (value: string | undefined, kingdoms: string[]) => {
  const allowed = skillKingdomAllowedValues(kingdoms)
  if (value !== undefined && allowed.has(value)) return value
  return SKILL_KINGDOM_BOTH_VALUE
}

/**
 * 技能框渲染用势力（势力技为空/双势力技时由模板决定叠层，此处返回 null）
 */
export const resolveSkillKingdomForRender = (
  skillKingdom: string | undefined,
  pair: DoubleKingdomPair | null,
): string | null => {
  if (!pair) return skillKingdom || null
  if (isSkillBothKingdom(skillKingdom)) return null
  if (
    skillKingdom === SKILL_KINGDOM_PRIMARY_VALUE ||
    skillKingdom === SKILL_KINGDOM_SECONDARY_VALUE
  ) {
    return skillKingdom
  }
  if (skillKingdom && skillKingdom !== 'shen') return skillKingdom
  return null
}
