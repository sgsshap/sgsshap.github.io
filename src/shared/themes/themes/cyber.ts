import type { ThemeSeries } from '../shared'

export const cyberTheme: ThemeSeries = {
  label: '赛博霓城',
  description: '频道干扰，故障开场。',
  loadingEffect: 'cyberGlitch',
  light: {
    brandRgb: '83, 32, 201',
    inverseRgb: '245, 250, 255',
    successRgb: '0, 180, 156',
    infoRgb: '0, 158, 232',
    warningRgb: '255, 154, 60',
    errorRgb: '239, 68, 139',
  },
  dark: {
    brandRgb: '19, 12, 45',
    inverseRgb: '204, 250, 255',
    successRgb: '45, 230, 199',
    infoRgb: '75, 198, 255',
    warningRgb: '255, 194, 99',
    errorRgb: '255, 126, 182',
  },
}
