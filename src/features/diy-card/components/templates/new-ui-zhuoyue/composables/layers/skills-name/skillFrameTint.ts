import type { KingdomColorSlot } from '@/features/diy-card/composables/doubleKingdom'
import type { LegendInfo, LegendSkill } from '@/features/diy-card/types/diy/legend'
import { useKingdomTint } from '../../filters/useKingdomTint'
import { resolveSkillFrameSideKeys } from './frameAssets'

export type SkillFrameSideTintFilters = {
  left: Record<string, unknown>
  right: Record<string, unknown>
}

/** 技能框 left/right 着色（frame 色域；主公时仍保留自定义势力色，与边框 kingdom_frame 条区分） */
export const resolveSkillFrameSideTintForSlot = (
  info: LegendInfo,
  slot: KingdomColorSlot | undefined,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
): Record<string, unknown> => {
  if (!slot) return {}
  const { resolveSkillFrameSideTintFilters } = useKingdomTint(info, getFilters)
  return resolveSkillFrameSideTintFilters(slot)
}

/**
 * 技能框 left/right 着色（frame 色域，对齐 frame/index kingdom_frame 与 HEAD resolveFrameSideTint）
 * - 自定义势力 + 双势力：双势力技 left=势力2、right=势力1；单势力技两侧同色
 * - 自定义势力单势力：left/right 均为 single 档
 */
export const resolveSkillFrameSideTintFilters = (
  info: LegendInfo,
  skill: LegendSkill,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
): SkillFrameSideTintFilters => {
  const keys = resolveSkillFrameSideKeys(info, skill)
  return {
    left: resolveSkillFrameSideTintForSlot(info, keys.leftColorSlot, getFilters),
    right: resolveSkillFrameSideTintForSlot(info, keys.rightColorSlot, getFilters),
  }
}
