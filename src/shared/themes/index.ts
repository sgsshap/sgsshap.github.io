import {
  buildKingdomThemeEntry,
  buildMinimalLineThemeEntry,
  buildShanhaiThemeEntry,
  buildShuimoThemeEntry,
  buildThemeEntry,
  type ThemeMode,
} from './shared'
import './decorative-shell.css'
import './decorative-sider.css'
import './decorative-wiki.css'
import './decorative-home.css'
import './tabbar.css'
import './themes/cyber.css'
import './themes/pixel.css'
import './themes/minimal-line.css'
import './themes/shanhai.css'
import './themes/shuimo.css'
import './themes/chibi.css'
import './themes/shu.css'
import './themes/wu.css'
import './themes/wei.css'
import './themes/qun.css'
import './themes/jin.css'
import './decorative-overlays.css'
import { chibiTheme } from './themes/chibi'
import { cyberTheme } from './themes/cyber'
import { jinTheme } from './themes/jin'
import { minimalLineTheme } from './themes/minimal-line'
import { pixelTheme } from './themes/pixel'
import { qunTheme } from './themes/qun'
import { shanhaiTheme } from './themes/shanhai'
import { shuTheme } from './themes/shu'
import { shuimoTheme } from './themes/shuimo'
import { weiTheme } from './themes/wei'
import { wuTheme } from './themes/wu'

export { type ThemeMode }

export type ThemeEntry = ReturnType<typeof buildThemeEntry>

export const themes = {
  qun: buildKingdomThemeEntry(qunTheme, {
    light: { cardRgb: '252, 252, 252' },
    dark: { cardRgb: '34, 34, 36', fieldRgb: '28, 28, 30' },
  }),
  wei: buildKingdomThemeEntry(weiTheme, {
    light: { cardRgb: '251, 252, 254' },
    dark: { cardRgb: '36, 38, 42', fieldRgb: '30, 32, 36' },
  }),
  shu: buildKingdomThemeEntry(shuTheme, {
    light: { cardRgb: '252, 251, 250' },
    dark: { cardRgb: '38, 36, 38', fieldRgb: '32, 30, 32' },
  }),
  wu: buildKingdomThemeEntry(wuTheme, {
    light: { cardRgb: '249, 250, 247' },
    dark: { cardRgb: '36, 38, 36', fieldRgb: '30, 32, 30' },
  }),
  jin: buildKingdomThemeEntry(jinTheme, {
    light: { cardRgb: '251, 250, 254' },
    dark: { cardRgb: '38, 36, 44', fieldRgb: '32, 30, 38' },
  }),
  chibi: buildKingdomThemeEntry(chibiTheme, {
    light: { cardRgb: '251, 252, 254' },
    dark: { cardRgb: '22, 26, 36', fieldRgb: '18, 22, 30' },
  }),
  shuimo: buildShuimoThemeEntry(shuimoTheme),
  shanhai: buildShanhaiThemeEntry(shanhaiTheme),
  cyber: buildThemeEntry(cyberTheme),
  pixel: buildThemeEntry(pixelTheme),
  minimalLine: buildMinimalLineThemeEntry(minimalLineTheme),
} satisfies Record<string, ThemeEntry>

export type ThemeKey = keyof typeof themes
