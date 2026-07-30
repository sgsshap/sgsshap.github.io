import type { ChTransOverrideMap } from './chTransEngine'
import { COMMON_CH_TRANS_OVERRIDES } from './commonChTransOverrides'
import { resolveDisplayText } from './chTransEngine'

/** 武将称号简体 → 繁体例外表 */
export const LEGEND_TITLE_CH_TRANS_OVERRIDES: ChTransOverrideMap = {
  ...COMMON_CH_TRANS_OVERRIDES,
  王后: '王后',
  皇后: '皇后',
  太后: '太后',
}

/** 画布展示用武将称号 */
export const resolveLegendTitleDisplayName = (title: string, convertTChFlag: boolean) =>
  resolveDisplayText(title, convertTChFlag, LEGEND_TITLE_CH_TRANS_OVERRIDES)
