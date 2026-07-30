import type { ChTransOverrideMap } from './chTransEngine'
import { COMMON_CH_TRANS_OVERRIDES } from './commonChTransOverrides'
import { resolveDisplayText } from './chTransEngine'

/** 武将名简体 → 繁体例外表 */
export const LEGEND_NAME_CH_TRANS_OVERRIDES: ChTransOverrideMap = {
  ...COMMON_CH_TRANS_OVERRIDES,
  王后: '王后',
  皇后: '皇后',
  太后: '太后',
  钟: '鍾',
  干: '幹',
  于: '于',
}

/** 画布展示用武将名 */
export const resolveLegendNameDisplayName = (name: string, convertTChFlag: boolean) =>
  resolveDisplayText(name, convertTChFlag, LEGEND_NAME_CH_TRANS_OVERRIDES)
