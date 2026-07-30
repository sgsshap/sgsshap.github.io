/** 神框整组相对画布内容区原点的默认 X（mm；增大右移） */
export const FRAME_SHEN_GROUP_X_MM = 3.4

/**
 * 神框底图高度推算用的目标显示宽度（px）。
 * `targetHeight = (素材高 / 素材宽) × 该值`
 */
export const FRAME_SHEN_DISPLAY_WIDTH_PX = 59

/** 边框两侧 kingdom_frame（`frame_kingdom_left` / `frame_kingdom_right`）布局 */
export type FrameKingdomFrameLayout = {
  /** 显示宽度（px） */
  widthPx: number
  /** 在 frame 组内的偏移（mm，相对组左上角） */
  offsetMm: { x: number; y: number }
}

export const FRAME_KINGDOM_FRAME_LAYOUT = {
  normal: {
    widthPx: 68,
    offsetMm: { x: 5, y: 5 },
  },
  shen: {
    widthPx: 82,
    offsetMm: { x: -1.4, y: 5.8 },
  },
} as const satisfies Record<'normal' | 'shen', FrameKingdomFrameLayout>

/** 按是否神框布局取 kingdom_frame 定位与尺寸 */
export const resolveFrameKingdomFrameLayout = (isShen: boolean): FrameKingdomFrameLayout =>
  isShen ? FRAME_KINGDOM_FRAME_LAYOUT.shen : FRAME_KINGDOM_FRAME_LAYOUT.normal

/**
 * 出框/素材与技能区重叠挖洞：左侧保留边框宽（相对成品区 trim 左缘，mm）。
 * 出血时成品区原点右移 innerStageBleed，挖洞换算为 Stage 坐标时须加上 originX。
 */
export const SKILL_OVERLAP_FRAME_PRESERVE_WIDTH_MM = 9.2

/** 神势力：挖洞左侧保留边框宽（mm） */
export const SKILL_OVERLAP_FRAME_PRESERVE_WIDTH_SHEN_MM = 0

/** 主公框在 frame 组内的布局（mm） */
export const FRAME_MASTER_MM = {
  x: 0,
  y: 0,
  height: 93,
} as const
