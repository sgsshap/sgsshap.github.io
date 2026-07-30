import type { ThemeSeries } from '../shared'

export const weiTheme: ThemeSeries = {
  label: '魏：威定中原',
  description: '奸略逐鹿原，雄才扫狼烟！',
  light: {
    /** 魏武：灰蓝主色；卡片近白冷底 */
    brandRgb: '79, 102, 127',
    inverseRgb: '251, 252, 254',
    successRgb: '52, 99, 75',
    infoRgb: '88, 146, 189',
    warningRgb: '169, 109, 39',
    errorRgb: '145, 53, 45',
  },
  dark: {
    /** 页面底：中性墨蓝灰；卡片另行提亮 */
    brandRgb: '26, 28, 32',
    inverseRgb: '208, 216, 226',
    successRgb: '111, 171, 141',
    infoRgb: '118, 168, 212',
    warningRgb: '222, 168, 82',
    errorRgb: '238, 124, 113',
  },
}
