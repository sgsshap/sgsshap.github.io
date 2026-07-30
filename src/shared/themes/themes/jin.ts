import type { ThemeSeries } from '../shared'

export const jinTheme: ThemeSeries = {
  label: '晋：一统山河',
  description: '韬光养晦，三马同槽，终归天下于一统！',
  light: {
    brandRgb: '88, 78, 126',
    /** 卡片近白，避免紫灰发闷 */
    inverseRgb: '251, 250, 254',
    successRgb: '83, 141, 112',
    infoRgb: '99, 125, 190',
    warningRgb: '191, 142, 71',
    errorRgb: '170, 74, 90',
  },
  dark: {
    /** 页面底：墨紫灰；卡片另行提亮 */
    brandRgb: '24, 22, 30',
    inverseRgb: '218, 214, 232',
    successRgb: '130, 192, 162',
    infoRgb: '148, 173, 241',
    warningRgb: '232, 192, 122',
    errorRgb: '236, 140, 160',
  },
}
