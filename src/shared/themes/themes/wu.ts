import type { ThemeSeries } from '../shared'

export const wuTheme: ThemeSeries = {
  label: '吴：坐断东南',
  description: '能用众力则无敌于天下，能用众智则无畏于圣人！',
  light: {
    /** 参考孙吴意象：深苔绿正文；卡片近白微绿，避免发灰褐 */
    brandRgb: '45, 65, 27',
    inverseRgb: '249, 250, 247',
    successRgb: '197, 217, 126',
    infoRgb: '123, 149, 91',
    warningRgb: '168, 148, 72',
    errorRgb: '158, 72, 62',
  },
  dark: {
    /** 页面底：中性墨绿灰；卡片另行提亮 */
    brandRgb: '26, 28, 26',
    inverseRgb: '214, 220, 206',
    successRgb: '197, 217, 126',
    infoRgb: '123, 149, 91',
    warningRgb: '212, 196, 118',
    errorRgb: '236, 145, 125',
  },
}
