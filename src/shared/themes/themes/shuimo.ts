import type { ThemeSeries } from '../shared'

export const shuimoTheme: ThemeSeries = {
  label: '水墨丹青',
  description: '墨染千秋，笔落惊鸿。',
  loadingEffect: 'shuimoInk',
  light: {
    /** 宣纸底、焦墨字；竹青·远山灰蓝·赭石·朱砂印 */
    brandRgb: '34, 32, 32',
    inverseRgb: '250, 247, 242',
    successRgb: '66, 98, 78',
    infoRgb: '86, 104, 122',
    warningRgb: '154, 118, 74',
    errorRgb: '162, 56, 50',
  },
  dark: {
    /** 墨池略提亮以利层级；月色文案稍暖；语义色不变 */
    brandRgb: '22, 21, 26',
    inverseRgb: '238, 234, 226',
    successRgb: '106, 148, 124',
    infoRgb: '122, 142, 162',
    warningRgb: '194, 162, 102',
    errorRgb: '218, 108, 96',
  },
}
