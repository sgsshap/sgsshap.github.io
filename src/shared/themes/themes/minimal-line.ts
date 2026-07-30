import type { ThemeSeries } from '../shared'

export const minimalLineTheme: ThemeSeries = {
  label: '极简线条',
  description: '少即是多，一寸留白一寸呼吸。',
  loadingEffect: 'minimalLine',
  light: {
    /** 白纸墨线；主色靛紫 / info 亮青（色相分离） */
    brandRgb: '24, 24, 28',
    inverseRgb: '252, 252, 252',
    successRgb: '22, 120, 102',
    infoRgb: '8, 145, 178',
    warningRgb: '180, 120, 20',
    errorRgb: '200, 48, 52',
  },
  dark: {
    /** 炭底灰字；主色浅靛紫 / info 电青 */
    brandRgb: '14, 14, 18',
    inverseRgb: '236, 236, 240',
    successRgb: '52, 188, 164',
    infoRgb: '34, 211, 238',
    warningRgb: '232, 176, 72',
    errorRgb: '248, 113, 113',
  },
}
