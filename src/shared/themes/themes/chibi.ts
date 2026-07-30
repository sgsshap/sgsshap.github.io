import type { ThemeSeries } from '../shared'

export const chibiTheme: ThemeSeries = {
  label: '赤壁战火',
  description: '一炬烈火，三分天下。',
  loadingEffect: 'chibiFire',
  light: {
    /** 主字赭红砖（缓和）；error 偏橙高饱和，与正文拉开 */
    brandRgb: '124, 58, 64',
    inverseRgb: '251, 252, 254',
    successRgb: '48, 118, 96',
    infoRgb: '58, 124, 154',
    warningRgb: '196, 106, 38',
    errorRgb: '204, 58, 46',
  },
  dark: {
    /** 正文豆沙月色略柔；error 珊瑚警报红更亮更橘 */
    brandRgb: '12, 16, 26',
    inverseRgb: '218, 168, 162',
    successRgb: '76, 168, 138',
    infoRgb: '86, 156, 188',
    warningRgb: '224, 154, 62',
    errorRgb: '242, 92, 72',
  },
}
