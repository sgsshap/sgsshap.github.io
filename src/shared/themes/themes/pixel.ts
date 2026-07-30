import type { ThemeSeries } from '../shared'

export const pixelTheme: ThemeSeries = {
  label: '像素世界',
  description: '一寸像素，一方世界。',
  loadingEffect: 'pixelWorld',
  light: {
    brandRgb: '72, 66, 124',
    inverseRgb: '251, 246, 232',
    successRgb: '86, 153, 108',
    infoRgb: '77, 136, 184',
    warningRgb: '204, 156, 73',
    errorRgb: '191, 93, 84',
  },
  dark: {
    /** 中性炭灰底：明度压低、RGB 贴近以弱化紫相（不作薰衣草 surface） */
    brandRgb: '40, 39, 42',
    inverseRgb: '232, 220, 176',
    successRgb: '126, 201, 134',
    infoRgb: '128, 196, 241',
    warningRgb: '237, 197, 113',
    errorRgb: '238, 132, 116',
  },
}
