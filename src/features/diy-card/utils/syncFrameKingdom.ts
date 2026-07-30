import {
  isCustomKingdomActive,
  isDoubleKingdomRenderActive,
  isDoubleKingdomSingleGlyphMode,
  isMasterFlagActive,
  isShenSingleKingdomActive,
  resolveDoubleKingdomPair,
  resolveDoubleKingdomSingleGlyphKingdomKey,
  type KingdomColorSlot,
  usesShenCardLayout,
} from '@/features/diy-card/composables/doubleKingdom'
import { SHEN_KINGDOM_GLYPH_OFFICIAL_COLOR } from '@/features/diy-card/constants/customKingdomGlyphDefaults'
import {
  isCustomHpColorActive,
  shouldPreserveOriginalHpAsset,
} from '@/features/diy-card/utils/customHpColor'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'

/** 与边框素材路径一致的势力 key */
export const FRAME_KINGDOM_SRC_KEYS = [
  'wei',
  'shu',
  'wu',
  'qun',
  'jin',
  'shen',
] as const

export type FrameKingdomSrcKey = (typeof FRAME_KINGDOM_SRC_KEYS)[number]

const isFrameKingdomSrcKey = (value: string): value is FrameKingdomSrcKey =>
  (FRAME_KINGDOM_SRC_KEYS as readonly string[]).includes(value)

/** 当前势力选择对应的边框素材 key（双势力未满 2 个时与单势力相同，取当前唯一项） */
export const resolveKingdomForFrame = (info: LegendInfo): string | undefined => {
  if (isCustomKingdomActive(info)) {
    return info.baseInfo.kingdom || undefined
  }
  if (info.renderConfig.items.kingdom.doubleKingdom) {
    const first = info.baseInfo.doubleKingdom?.find((k) => k && k !== 'shen')
    if (first) return first
  }
  return info.baseInfo.kingdom
}

/** 是否使用神将边框底图布局（位置/尺寸/势力条）；双势力叠层时始终走普通框逻辑 */
export const usesShenFrameLayout = (info: LegendInfo, frameSrc?: string): boolean => {
  if (isDoubleKingdomRenderActive(info)) return false
  if (frameSrc === undefined) {
    return usesShenCardLayout(info)
  }
  const src = frameSrc.trim()
  return src === 'shen' || isShenSingleKingdomActive(info)
}

/** 非神将但选了神框（仅影响单势力卡面布局，双势力 / 体力素材不受影响） */
export const usesShenFrameBorderOnly = (info: LegendInfo): boolean =>
  !isDoubleKingdomRenderActive(info) &&
  info.renderConfig.items.frame.src === 'shen' &&
  !isShenSingleKingdomActive(info)

/**
 * 边框是否与当前势力联动：
 * - 边框素材与当前势力一致；或
 * - 边框仍停留在「变更前」的势力（用户改势力、边框尚未被手动改掉）
 * 否则视为已手动分叉（如神框 + 魏势力），切势力不再改边框。
 */
export const isFrameLinkedToKingdom = (
  info: LegendInfo,
  options?: { previousKingdom?: string },
): boolean => {
  const kingdom = resolveKingdomForFrame(info)
  const frameSrc = info.renderConfig.items.frame.src?.trim()
  if (!kingdom || !frameSrc) return false
  if (!isFrameKingdomSrcKey(kingdom) || !isFrameKingdomSrcKey(frameSrc)) return false
  const prev = options?.previousKingdom
  /**
   * 神框 + 非神势力：
   * - 从神势力切走且边框原与神联动（prev=shen, frame=shen）→ 继续联动，边框随新势力变
   * - 否则为手动分叉（如蜀势力 + 神框），切势力不改边框
   */
  if (
    frameSrc === 'shen' &&
    kingdom !== 'shen' &&
    !isShenSingleKingdomActive(info) &&
    prev !== 'shen'
  ) {
    return false
  }
  if (frameSrc === kingdom) return true
  return prev !== undefined && frameSrc === prev
}

/**
 * 边框两侧势力条素材 key（kingdom_frame；素材表无 shen 条，神框/神将均用 master）
 * - 其他势力 + 神框：用神条 master，不用魏蜀吴条
 */
export const resolveKingdomFrameStripAssetKey = (
  info: LegendInfo,
  renderSrc?: string,
): string => {
  if (isDoubleKingdomSingleGlyphMode(info)) {
    if (isMasterFlagActive(info)) {
      return 'master'
    }
    const selected = resolveDoubleKingdomSingleGlyphKingdomKey(info)
    if (!selected || selected === 'shen') return 'master'
    if (isCustomKingdomActive(info)) return 'wei'
    return selected
  }

  const src = (renderSrc ?? info.renderConfig.items.frame.src)?.trim()
  if (isMasterFlagActive(info)) {
    return 'master'
  }
  if (isShenSingleKingdomActive(info) || src === 'shen') {
    return 'master'
  }
  if (isCustomKingdomActive(info)) {
    return 'wei'
  }
  if (src && isFrameKingdomSrcKey(src) && src !== 'shen') {
    return src
  }
  return src || 'wei'
}

/** 体力图标/文字模式素材 key：跟武将势力，不因神框变为 shen；自定义体力色时非神势力统一用魏底图再着色 */
export const resolveHpAssetKingdomKey = (
  info: LegendInfo,
  getTemplateAssetKingdom: (actualKingdom: string) => string,
  actualKingdom?: string,
): string => {
  if (isShenSingleKingdomActive(info)) {
    return 'shen'
  }
  if (isCustomHpColorActive(info)) {
    const kingdom = actualKingdom ?? info.baseInfo.kingdom
    let slot: KingdomColorSlot = 'single'
    if (isDoubleKingdomRenderActive(info) && actualKingdom) {
      const pair = resolveDoubleKingdomPair(info)
      if (pair) {
        slot = actualKingdom === pair.secondary ? 'secondary' : 'primary'
      }
    }
    if (shouldPreserveOriginalHpAsset(info, slot, actualKingdom)) {
      return getTemplateAssetKingdom(kingdom)
    }
    return 'wei'
  }
  if (isMasterFlagActive(info)) {
    return 'shen'
  }
  const kingdom = actualKingdom ?? info.baseInfo.kingdom
  if (isCustomKingdomActive(info)) {
    return getTemplateAssetKingdom(kingdom)
  }
  return getTemplateAssetKingdom(kingdom)
}

/** 边框底图 frame/full 素材 key */
export const resolveFrameBaseAssetKey = (
  info: LegendInfo,
  renderSrc?: string,
): string => {
  const src = (renderSrc ?? info.renderConfig.items.frame.src)?.trim()
  if (usesShenFrameLayout(info, src)) {
    return 'shen'
  }
  if (isCustomKingdomActive(info)) {
    return isShenSingleKingdomActive(info) ? 'shen' : 'wei'
  }
  if (src && isFrameKingdomSrcKey(src) && src !== 'shen') {
    return src
  }
  return 'wei'
}

/** 将边框素材设为当前势力（仅在与势力联动时生效；势力为神时强制同步为神框） */
export const syncFrameSrcToKingdom = (
  info: LegendInfo,
  options?: { previousKingdom?: string },
) => {
  const kingdom = resolveKingdomForFrame(info)

  if (
    !isDoubleKingdomRenderActive(info) &&
    (info.baseInfo.kingdom === 'shen' || kingdom === 'shen')
  ) {
    info.renderConfig.items.frame.src = 'shen'
    return
  }

  if (!isFrameLinkedToKingdom(info, options)) return
  if (!kingdom || !isFrameKingdomSrcKey(kingdom)) return
  info.renderConfig.items.frame.src = kingdom
}

/**
 * 势力相对上一状态发生变化时，同步边框素材（仅当边框与势力仍联动）
 * @param info 武将信息
 * @param previousKingdom 变更前的势力（单势力模式用 baseInfo.kingdom；双势力取列表首项）
 */
export function syncFrameSrcWhenKingdomChanges(
  info: LegendInfo,
  previousKingdom: string | undefined,
) {
  syncFrameSrcToKingdom(info, { previousKingdom })
}

/** 是否应自动开启势力字自定义色（仅神框 + 非神势力字；神势力+神框不自动开） */
export const shouldAutoEnableShenFrameGlyphColor = (info: LegendInfo) =>
  usesShenFrameBorderOnly(info)

/** 按当前神框 + 势力状态同步势力字自定义色（边框已是神框、仅势力变化时也需调用） */
export const syncShenFrameGlyphColorFlag = (info: LegendInfo) => {
  if (info.renderConfig.items.frame.src?.trim() !== 'shen') return
  applyShenKingdomGlyphColorEnabled(info, shouldAutoEnableShenFrameGlyphColor(info))
}

/**
 * 开启 / 关闭势力字自定义色，并写入神官方色
 */
export const applyShenKingdomGlyphColorEnabled = (info: LegendInfo, enabled: boolean) => {
  const kingdom = info.renderConfig.items.kingdom
  if (enabled) {
    kingdom.glyphColorFlag = true
    kingdom.glyphColor = SHEN_KINGDOM_GLYPH_OFFICIAL_COLOR
    return
  }
  kingdom.glyphColorFlag = false
}

/**
 * 边框在神框与其它框之间切换时，联动势力字自定义色：
 * 仅「神框 + 非神势力字」自动开启；神势力+神框不自动开。
 */
export const applyShenFrameKingdomGlyphColor = (
  info: LegendInfo,
  previousFrameSrc?: string,
) => {
  if (previousFrameSrc === undefined) return

  const frameSrc = info.renderConfig.items.frame.src?.trim()
  const prev = previousFrameSrc.trim()
  if (frameSrc === prev) return

  if (frameSrc === 'shen') {
    syncShenFrameGlyphColorFlag(info)
    return
  }

  if (prev === 'shen') {
    applyShenKingdomGlyphColorEnabled(info, false)
  }
}
