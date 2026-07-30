<script setup lang="ts">
import {
  DEFAULT_GLOBAL_LOADING_EFFECT,
  resolveGlobalLoadingEffect,
  usesCanvasLightPanel,
} from '@/shared/loading/registry'
import type { GlobalLoadingEffectId, GlobalLoadingEffectProps } from '@/shared/loading/types'
import { useSystemStore } from '@/shared/stores/system'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<
    GlobalLoadingEffectProps & {
      hint?: string
      /** 主文案下方的补充说明（如加载过久时的网络提示） */
      subHint?: string
      /** 指定动画；未传则读当前主题的 loadingEffect */
      effect?: GlobalLoadingEffectId
      /** 嵌入局部区域（如画布遮罩），非全屏 fixed */
      inline?: boolean
      /** 首屏启动：只显示动画，不铺全屏遮罩（保留主题背景纹样） */
      boot?: boolean
      /** 主内容区切换（AppShell），较 canvas inline 更易感知 */
      shell?: boolean
    }
  >(),
  {
    hint: '页面加载中…',
    size: 72,
    duration: 1.5,
    inline: false,
    boot: false,
    shell: false,
  },
)

const systemStore = useSystemStore()

const activeEffectId = computed(
  () => props.effect ?? systemStore.activeTheme.loadingEffect ?? DEFAULT_GLOBAL_LOADING_EFFECT,
)

const EffectComponent = computed(() => resolveGlobalLoadingEffect(activeEffectId.value))

const effectProps = computed(() => ({
  size: props.size,
  duration: props.duration,
}))

const canvasLightPanel = computed(() => props.inline && usesCanvasLightPanel(activeEffectId.value))
</script>

<template>
  <div
    class="global-loading"
    :class="{
      'global-loading--inline': inline,
      'global-loading--canvas-light': canvasLightPanel,
      'global-loading--boot': boot,
      'global-loading--shell': shell,
    }"
    role="status"
    aria-live="polite"
  >
    <div class="global-loading__panel">
      <component :is="EffectComponent" v-bind="effectProps" />
      <div v-if="hint || subHint" class="global-loading__text">
        <p v-if="hint" class="global-loading__hint">{{ hint }}</p>
        <p v-if="subHint" class="global-loading__subhint">{{ subHint }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.global-loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--body-color) 92%, transparent);
  backdrop-filter: blur(4px);
  pointer-events: all;
}

.global-loading--boot {
  background: transparent !important;
  backdrop-filter: none !important;
  pointer-events: none;
}

.global-loading--inline {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  background: color-mix(in srgb, var(--body-color) 16%, transparent);
  backdrop-filter: blur(1.5px);
}

.global-loading--shell {
  z-index: 50;
  pointer-events: all;
  background: color-mix(in srgb, var(--body-color) 88%, transparent);
  backdrop-filter: blur(4px);
}

.global-loading--shell .global-loading__panel {
  padding: 16px 24px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--card-color) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-color) 65%, transparent);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.14),
    0 0 0 1px color-mix(in srgb, var(--border-color) 25%, transparent);
}

.global-loading__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.global-loading__text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: min(240px, 82vw);
  text-align: center;
}

.global-loading__hint {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--text-color-1);
}

.global-loading__subhint {
  font-size: 14px;
  font-weight: 500;
  margin-top: 10px;
  letter-spacing: 0.02em;
  color: var(--text-color-2);
}

/* 全站遮罩：动画 + 文案底牌，跟随主题深浅色 */
.global-loading:not(.global-loading--inline):not(.global-loading--boot) .global-loading__panel {
  padding: 16px 24px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--card-color) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-color) 65%, transparent);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.14),
    0 0 0 1px color-mix(in srgb, var(--border-color) 25%, transparent);
}

/* 画布：深色底牌 + 白字（火焰、赛博等） */
.global-loading--inline:not(.global-loading--canvas-light) .global-loading__panel {
  gap: 24px;
  padding: 24px 36px 32px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.55);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.28);
}

.global-loading--inline:not(.global-loading--canvas-light) .global-loading__hint {
  color: #fff;
  font-size: 15px;
  letter-spacing: 0.06em;
}

.global-loading--inline:not(.global-loading--canvas-light) .global-loading__subhint {
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  font-weight: 500;
}

/* 画布：浅色底牌 + 墨字（水墨、山海等自带浅色画面） */
.global-loading--canvas-light .global-loading__panel {
  gap: 22px;
  padding: 24px 30px 22px;
  border-radius: 12px;
  background: rgba(250, 247, 242, 0.94);
  box-shadow: 0 4px 18px rgba(34, 32, 32, 0.14);
}

.global-loading--canvas-light .global-loading__hint {
  color: #1f1d1b;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.global-loading--canvas-light .global-loading__subhint {
  color: rgba(31, 29, 27, 0.82);
  font-size: 13px;
  font-weight: 500;
}
</style>
