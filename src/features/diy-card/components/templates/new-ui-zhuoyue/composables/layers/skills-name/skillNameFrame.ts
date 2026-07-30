import {
  SKILL_NAME_FRAME_BG_MM,
  SKILL_NAME_FRAME_LEFT_MM,
  SKILL_NAME_FRAME_RIGHT_MM,
  SKILL_NAME_FRAME_SHADOW_MM,
  SKILL_NAME_GROUP_WIDTH_MM,
  SKILL_NAME_SHEN_FRAME_MM,
  SKILL_NAME_SHEN_TEXT_MM,
  SKILL_NAME_DERIVED_TEXT_OFFSET_Y_MM,
  SKILL_NAME_TEXT_MM,
  type SkillNameFrameElementMm,
} from '../../constants/skills'

/** 技能框 PNG 素材固有像素尺寸（仅作框高估算） */
const FRAME_SIDE_ASPECT = 84 / 199

export type SkillNameFramePart = {
  x: number
  y: number
  width: number
}

export type SkillNameFrameLayout = {
  /** 单技能框组整体占位宽（px） */
  groupWidthPx: number
  left: SkillNameFramePart
  shadow: SkillNameFramePart
  bg: SkillNameFramePart
  right: SkillNameFramePart
  text: SkillNameFramePart
  /** 侧饰边参考高度（px，用于技能区间距） */
  sideHeightPx: number
}

const mapFrameElementMm = (
  element: SkillNameFrameElementMm,
  mmToPx: (mm: number) => number,
): SkillNameFramePart => ({
  x: mmToPx(element.x),
  y: mmToPx(element.y),
  width: mmToPx(element.width),
})

/** 普通势力拼接框布局（左/底/右）；神势力走 resolveShenSkillNameFrameLayout + shen.png */
export const resolveSkillNameFrameLayout = (mmToPx: (mm: number) => number): SkillNameFrameLayout => {
  const left = mapFrameElementMm(SKILL_NAME_FRAME_LEFT_MM, mmToPx)
  return {
    groupWidthPx: mmToPx(SKILL_NAME_GROUP_WIDTH_MM),
    left,
    shadow: mapFrameElementMm(SKILL_NAME_FRAME_SHADOW_MM, mmToPx),
    bg: mapFrameElementMm(SKILL_NAME_FRAME_BG_MM, mmToPx),
    right: mapFrameElementMm(SKILL_NAME_FRAME_RIGHT_MM, mmToPx),
    text: mapFrameElementMm(SKILL_NAME_TEXT_MM, mmToPx),
    sideHeightPx: left.width * FRAME_SIDE_ASPECT,
  }
}

/** 神势力整框布局（单张 shen.png） */
export const resolveShenSkillNameFrameLayout = (
  mmToPx: (mm: number) => number,
): Pick<SkillNameFrameLayout, 'groupWidthPx' | 'text'> & { frame: SkillNameFramePart } => ({
  groupWidthPx: mmToPx(SKILL_NAME_GROUP_WIDTH_MM),
  frame: mapFrameElementMm(SKILL_NAME_SHEN_FRAME_MM, mmToPx),
  text: mapFrameElementMm(SKILL_NAME_SHEN_TEXT_MM, mmToPx),
})

/** 神势力整框高（px，与 shen.png 宽高比一致） */
const SKILL_NAME_SHEN_FRAME_ASPECT = 84 / 215

/** 技能区间距用的框参考高度（px） */
export const resolveSkillNameBadgeHeightPx = (mmToPx: (mm: number) => number) =>
  resolveSkillNameFrameLayout(mmToPx).sideHeightPx

/** 神势力技能区间距用的框参考高度（px） */
export const resolveShenSkillNameBadgeHeightPx = (mmToPx: (mm: number) => number) => {
  const frame = resolveShenSkillNameFrameLayout(mmToPx)
  return frame.frame.width * SKILL_NAME_SHEN_FRAME_ASPECT
}

/**
 * 单字技能名在双字占位区内水平居中（layout 默认 x 按双字左对齐；单字须补半宽差）
 */
export const resolveSkillNameTextLayoutX = (
  frameTextX: number,
  displayName: string,
  textWidth: number,
  measureTextWidth: (text: string) => number,
) => {
  const chars = [...displayName.trim()]
  if (chars.length !== 1) return frameTextX
  const twoCharSlotWidth = measureTextWidth(`${chars[0]}${chars[0]}`)
  return frameTextX + (twoCharSlotWidth - textWidth) / 2
}

/** 衍生技底图视觉偏高，文字锚点须上移与非衍生技一致（神框不走 derived 底图，不偏移） */
export const resolveSkillNameTextLayoutY = (
  frameTextY: number,
  derivedSkillFlag: boolean,
  mmToPx: (mm: number) => number,
) =>
  derivedSkillFlag
    ? frameTextY + mmToPx(SKILL_NAME_DERIVED_TEXT_OFFSET_Y_MM)
    : frameTextY

/** 神势力技能名纵向中心估算（px，与 skillsName 渲染侧 shen 框测高一致） */
export const resolveShenSkillNameVisualCenterEstimatePx = (
  mmToPx: (mm: number) => number,
  fontSizePx: number,
) => {
  const frame = resolveShenSkillNameFrameLayout(mmToPx)
  const frameHeightPx = frame.frame.width * SKILL_NAME_SHEN_FRAME_ASPECT
  const top = Math.min(frame.frame.y, frame.text.y)
  const bottom = Math.max(frame.frame.y + frameHeightPx, frame.text.y + fontSizePx)
  return (top + bottom) / 2
}
