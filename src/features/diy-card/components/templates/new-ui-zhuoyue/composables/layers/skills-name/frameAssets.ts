import {
  isCustomKingdomActive,
  isCustomShenKingdomActive,
  isDoubleKingdomRenderActive,
  isSkillBothKingdom,
  isShenSingleKingdomActive,
  resolveDoubleKingdomPair,
  resolveSkillKingdomForRender,
  SKILL_KINGDOM_PRIMARY_VALUE,
  SKILL_KINGDOM_SECONDARY_VALUE,
  type KingdomColorSlot,
} from '@/features/diy-card/composables/doubleKingdom'
import type { LegendInfo, LegendSkill } from '@/features/diy-card/types/diy/legend'
import { TEMPLATE_ASSET_BASE } from '../../constants/common'

export type SkillFrameSideKeys = {
  left: string
  right: string
  bg: 'normal' | 'derived'
  /** 自定义双势力：left 着色槽位 */
  leftColorSlot?: KingdomColorSlot
  /** 自定义双势力：right 着色槽位 */
  rightColorSlot?: KingdomColorSlot
}

export const buildSkillFrameImageCacheKey = (keys: SkillFrameSideKeys) =>
  `${keys.left}|${keys.right}|${keys.bg}`

const normalizeKingdomKey = (value: string | null | undefined, fallback: string) => {
  const key = (value ?? fallback).trim().toLowerCase()
  if (key === 'shen') return 'shen'
  if (['wei', 'shu', 'wu', 'qun', 'jin'].includes(key)) return key
  return fallback
}

type FrameSidePair = Pick<SkillFrameSideKeys, 'left' | 'right' | 'leftColorSlot' | 'rightColorSlot'>

const customDualWeiSides = (
  leftColorSlot: KingdomColorSlot,
  rightColorSlot: KingdomColorSlot,
): FrameSidePair => ({
  left: 'wei',
  right: 'wei',
  leftColorSlot,
  rightColorSlot,
})

const resolveCustomDualFrameSides = (skill: LegendSkill): FrameSidePair => {
  if (isSkillBothKingdom(skill.kingdom)) {
    return customDualWeiSides('secondary', 'primary')
  }
  if (skill.kingdom === SKILL_KINGDOM_PRIMARY_VALUE) {
    return customDualWeiSides('primary', 'primary')
  }
  if (skill.kingdom === SKILL_KINGDOM_SECONDARY_VALUE) {
    return customDualWeiSides('secondary', 'secondary')
  }
  // 自定义双势力：未识别的 skill.kingdom（旧档 wei 等）按双势力技着色
  return customDualWeiSides('secondary', 'primary')
}

const resolveCustomSingleFrameSides = (info: LegendInfo): FrameSidePair =>
  isCustomShenKingdomActive(info)
    ? { left: 'wei', right: 'shen', leftColorSlot: 'single' }
    : {
        left: 'wei',
        right: 'wei',
        leftColorSlot: 'single',
        rightColorSlot: 'single',
      }

const resolvePresetDualFrameSides = (
  skill: LegendSkill,
  pair: NonNullable<ReturnType<typeof resolveDoubleKingdomPair>>,
): FrameSidePair =>
  isSkillBothKingdom(skill.kingdom)
    ? {
        // 双势力技：左=势力2、右=势力1（如 群+魏 → left=qun、right=wei）
        left: normalizeKingdomKey(pair.secondary, 'qun'),
        right: normalizeKingdomKey(pair.primary, 'wei'),
      }
    : {
        left: normalizeKingdomKey(resolveSkillKingdomForRender(skill.kingdom, pair), pair.primary),
        right: normalizeKingdomKey(resolveSkillKingdomForRender(skill.kingdom, pair), pair.primary),
      }

const resolveDefaultFrameSides = (
  info: LegendInfo,
  frameSrc: string,
  skillKingdom: ReturnType<typeof resolveSkillKingdomForRender>,
): FrameSidePair => {
  if (skillKingdom) {
    const key = normalizeKingdomKey(skillKingdom, frameSrc)
    return { left: key, right: key }
  }
  if (isShenSingleKingdomActive(info) || frameSrc === 'shen') {
    return {
      left: normalizeKingdomKey(frameSrc === 'shen' ? 'wei' : frameSrc, 'wei'),
      right: 'shen',
    }
  }
  const key = normalizeKingdomKey(frameSrc, 'wei')
  return { left: key, right: key }
}

/** 解析单个技能框左右饰边素材 key */
export const resolveSkillFrameSideKeys = (
  info: LegendInfo,
  skill: LegendSkill,
): SkillFrameSideKeys => {
  const frameSrc = info.renderConfig.items.frame.src?.trim().toLowerCase() || info.baseInfo.kingdom
  const pair = isDoubleKingdomRenderActive(info) ? resolveDoubleKingdomPair(info) : null
  const customDual = Boolean(pair && isCustomKingdomActive(info))
  const customSingle = isCustomKingdomActive(info) && !isDoubleKingdomRenderActive(info)

  const sides = customDual
    ? resolveCustomDualFrameSides(skill)
    : customSingle
      ? resolveCustomSingleFrameSides(info)
      : pair
        ? resolvePresetDualFrameSides(skill, pair)
        : resolveDefaultFrameSides(
            info,
            frameSrc,
            resolveSkillKingdomForRender(skill.kingdom, pair),
          )

  return {
    ...sides,
    bg: skill.derivedFlag ? 'derived' : 'normal',
  }
}

export const skillFrameAssetSrc = (
  part: 'left' | 'right' | 'bg',
  keys: SkillFrameSideKeys,
) => {
  if (part === 'bg') {
    return `${TEMPLATE_ASSET_BASE}/assets/skill-frame/bg/${keys.bg}.png`
  }
  const sideKey = part === 'left' ? keys.left : keys.right
  return `${TEMPLATE_ASSET_BASE}/assets/skill-frame/${part}/${sideKey}.png`
}

/** 神势力技能名：整框单图，不再拼接左/底/右 */
export const usesShenSkillNameFrame = (keys: SkillFrameSideKeys) => keys.right === 'shen'

export const skillFrameShenSrc = () =>
  `${TEMPLATE_ASSET_BASE}/assets/skill-frame/shen.png`

export const skillFrameShadowSrc = () =>
  `${TEMPLATE_ASSET_BASE}/assets/skill-frame/shadow.png`
