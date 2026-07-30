import type { ThemeKey } from '@/shared/themes/index'
import type { ThemeMode, ThemePalette } from '@/shared/themes/shared'
import { chibiTheme } from '@/shared/themes/themes/chibi'
import { cyberTheme } from '@/shared/themes/themes/cyber'
import { jinTheme } from '@/shared/themes/themes/jin'
import { minimalLineTheme } from '@/shared/themes/themes/minimal-line'
import { pixelTheme } from '@/shared/themes/themes/pixel'
import { qunTheme } from '@/shared/themes/themes/qun'
import { shanhaiTheme } from '@/shared/themes/themes/shanhai'
import { shuTheme } from '@/shared/themes/themes/shu'
import { shuimoTheme } from '@/shared/themes/themes/shuimo'
import { weiTheme } from '@/shared/themes/themes/wei'
import { wuTheme } from '@/shared/themes/themes/wu'

/** 与 Naive baseColor 一致：浅色用 inverse，深色用 brand */
function surfaceColor(palette: ThemePalette, mode: ThemeMode): string {
  const rgb = mode === 'dark' ? palette.brandRgb : palette.inverseRgb
  return `rgb(${rgb})`
}

function buildSurfaces(
  key: ThemeKey,
  series: { light: ThemePalette; dark: ThemePalette },
): [ThemeKey, Record<ThemeMode, string>] {
  return [
    key,
    {
      light: surfaceColor(series.light, 'light'),
      dark: surfaceColor(series.dark, 'dark'),
    },
  ]
}

export const themeSurfaceColors = Object.fromEntries([
  buildSurfaces('qun', qunTheme),
  buildSurfaces('wei', weiTheme),
  buildSurfaces('shu', shuTheme),
  buildSurfaces('wu', wuTheme),
  buildSurfaces('jin', jinTheme),
  buildSurfaces('chibi', chibiTheme),
  buildSurfaces('shuimo', shuimoTheme),
  buildSurfaces('shanhai', shanhaiTheme),
  buildSurfaces('cyber', cyberTheme),
  buildSurfaces('pixel', pixelTheme),
  buildSurfaces('minimalLine', minimalLineTheme),
]) as Record<ThemeKey, Record<ThemeMode, string>>
