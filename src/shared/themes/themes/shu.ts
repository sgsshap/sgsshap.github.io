import type { ThemeSeries } from '../shared'

export const shuTheme: ThemeSeries = {
  label: '蜀：汉祚永昌',
  description: '南征北伐，誓还旧都，二十四代王业不偏安一隅！',
  light: {
    brandRgb: '122, 37, 40',
    /** 卡片/输入：近白暖底，避免发褐 */
    inverseRgb: '252, 251, 250',
    successRgb: '67, 120, 84',
    infoRgb: '78, 95, 149',
    warningRgb: '193, 118, 40',
    errorRgb: '176, 52, 48',
  },
  dark: {
    /** 页面底：中性墨灰，蜀红仅作点缀 */
    brandRgb: '24, 22, 24',
    inverseRgb: '232, 218, 212',
    successRgb: '124, 186, 144',
    infoRgb: '142, 160, 228',
    warningRgb: '236, 168, 88',
    errorRgb: '243, 123, 118',
  },
}
