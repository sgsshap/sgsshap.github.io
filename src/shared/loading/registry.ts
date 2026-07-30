import ChibiFireEffect from '@/shared/loading/effects/ChibiFireEffect.vue'
import CyberGlitchEffect from '@/shared/loading/effects/CyberGlitchEffect.vue'
import MinimalLineEffect from '@/shared/loading/effects/MinimalLineEffect.vue'
import PixelWorldEffect from '@/shared/loading/effects/PixelWorldEffect.vue'
import ShanhaiMythEffect from '@/shared/loading/effects/ShanhaiMythEffect.vue'
import ShuimoInkEffect from '@/shared/loading/effects/ShuimoInkEffect.vue'
import YinYangEffect from '@/shared/loading/effects/YinYangEffect.vue'
import type { GlobalLoadingEffectId } from '@/shared/loading/types'
import type { Component } from 'vue'

const effects: Record<GlobalLoadingEffectId, Component> = {
  yinYang: YinYangEffect,
  chibiFire: ChibiFireEffect,
  shuimoInk: ShuimoInkEffect,
  shanhaiMyth: ShanhaiMythEffect,
  cyberGlitch: CyberGlitchEffect,
  pixelWorld: PixelWorldEffect,
  minimalLine: MinimalLineEffect,
}

/** 按主题配置的 effect id 解析动画组件 */
export function resolveGlobalLoadingEffect(id: GlobalLoadingEffectId): Component {
  return effects[id] ?? effects.yinYang
}

/** 注册新动画（主题专用效果在应用初始化时调用） */
export function registerGlobalLoadingEffect(id: GlobalLoadingEffectId, component: Component) {
  effects[id] = component
}

export const DEFAULT_GLOBAL_LOADING_EFFECT: GlobalLoadingEffectId = 'yinYang'

/** 画布 loading 使用浅色底牌（动画自带宣纸/浅色画面） */
export const CANVAS_LIGHT_PANEL_EFFECTS: readonly GlobalLoadingEffectId[] = [
  'shuimoInk',
  'shanhaiMyth',
]

export function usesCanvasLightPanel(effectId: GlobalLoadingEffectId): boolean {
  return CANVAS_LIGHT_PANEL_EFFECTS.includes(effectId)
}
