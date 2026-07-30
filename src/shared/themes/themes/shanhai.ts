import type { ThemeSeries } from '../shared'

export const shanhaiTheme: ThemeSeries = {
  label: '山海异闻',
  description: '荒经有兽，万象归奇。',
  loadingEffect: 'shanhaiMyth',
  light: {
    /** 纸白为底；靛青为墨；朱砂点醒 */
    brandRgb: '36, 56, 96',
    inverseRgb: '248, 246, 242',
    successRgb: '42, 92, 82',
    infoRgb: '52, 92, 148',
    warningRgb: '168, 92, 58',
    errorRgb: '182, 52, 48',
  },
  dark: {
    /** 玄黑为宇；月白靛为字；朱砂为戒 */
    brandRgb: '12, 11, 16',
    inverseRgb: '210, 218, 236',
    successRgb: '78, 162, 138',
    infoRgb: '118, 162, 218',
    warningRgb: '212, 138, 92',
    errorRgb: '220, 82, 76',
  },
}
