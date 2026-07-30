import type { ChTransOverrideMap } from './chTransEngine'
import { COMMON_CH_TRANS_OVERRIDES } from './commonChTransOverrides'
import { resolveDisplayText } from './chTransEngine'

/** 技能名简体 → 繁体例外表 */
export const SKILL_NAME_CH_TRANS_OVERRIDES: ChTransOverrideMap = {
  ...COMMON_CH_TRANS_OVERRIDES,
  断发: '斷髮',
  冲阵: '衝陣',
  冲坚: '衝堅',
}

/** 画布展示用技能名 */
export const resolveSkillDisplayName = (name: string, convertTChFlag: boolean) =>
  resolveDisplayText(name, convertTChFlag, SKILL_NAME_CH_TRANS_OVERRIDES)
