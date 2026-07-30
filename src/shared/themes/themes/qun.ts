import type { ThemeSeries } from '../shared'

export const qunTheme: ThemeSeries = {
  label: '群：汉失其鹿',
  description: '联九州黎庶，撼一家之王庭！',
  light: {
    /** 群雄：黑白分明，不偏蓝不偏暖 */
    brandRgb: '10, 10, 12',
    inverseRgb: '252, 252, 252',
    successRgb: '72, 104, 86',
    infoRgb: '74, 74, 78',
    warningRgb: '171, 114, 45',
    errorRgb: '150, 62, 57',
  },
  dark: {
    /** 页面底：中性墨灰 */
    brandRgb: '20, 20, 22',
    inverseRgb: '238, 238, 240',
    successRgb: '128, 172, 150',
    infoRgb: '156, 156, 162',
    warningRgb: '224, 174, 96',
    errorRgb: '240, 132, 126',
  },
}
