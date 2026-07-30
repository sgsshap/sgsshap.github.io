/**
 * 全幅模式下隐藏的顶层 canvas 图层 code（整组 v-group 不渲染）。
 * 后续如有独立顶层图层需随全幅模式隐藏，在此追加即可。
 */
const FULL_FRAME_MODE_HIDDEN_LAYER_CODES = ['skillsDesc'] as const

export const isLayerHiddenInFullFrameMode = (
  layerCode: string,
  fullModeFlag: boolean,
): boolean =>
  fullModeFlag &&
  (FULL_FRAME_MODE_HIDDEN_LAYER_CODES as readonly string[]).includes(layerCode)

/**
 * 全幅模式下隐藏的 frame 组内子图层 code（保留 frame_kingdom_* 势力条）。
 */
const FULL_FRAME_MODE_HIDDEN_FRAME_CHILD_CODES = [
  'frame_base',
  'frame_base_full',
  'frame_base_half',
  'frame_master',
] as const

/** 边框两侧 kingdom_frame 条（`frame_kingdom_left` / `frame_kingdom_right`） */
export const FRAME_KINGDOM_STRIP_CODE = /^frame_kingdom_(?:left|right)$/

export const isFrameKingdomStripChild = (code: string): boolean =>
  FRAME_KINGDOM_STRIP_CODE.test(code)

export const splitFrameChildrenByKingdomStrip = <T extends { code: string }>(
  children: readonly T[],
): { base: T[]; kingdomStrips: T[] } => {
  const base: T[] = []
  const kingdomStrips: T[] = []
  for (const item of children) {
    if (isFrameKingdomStripChild(item.code)) {
      kingdomStrips.push(item)
    } else {
      base.push(item)
    }
  }
  return { base, kingdomStrips }
}

const isFrameChildHiddenInFullFrameMode = (
  childCode: string,
  fullModeFlag: boolean,
): boolean =>
  fullModeFlag &&
  (FULL_FRAME_MODE_HIDDEN_FRAME_CHILD_CODES as readonly string[]).includes(childCode)

export const filterFrameChildrenForFullFrameMode = <T extends { code: string }>(
  children: readonly T[],
  fullModeFlag: boolean,
): T[] =>
  fullModeFlag
    ? children.filter((item) => !isFrameChildHiddenInFullFrameMode(item.code, true))
    : [...children]
