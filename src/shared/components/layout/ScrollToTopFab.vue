<script setup lang="ts">
import { useAppShellScrollToTop } from '@/shared/composables/useScrollToTop'
import { KeyboardDoubleArrowUpRound } from '@/shared/icons'
import { useSystemStore } from '@/shared/stores/system'
import { NIcon } from 'naive-ui'

const systemStore = useSystemStore()
const { visible, scrollToTop } = useAppShellScrollToTop()
</script>

<template>
  <Transition name="scroll-to-top-fab">
    <button
      v-show="visible"
      type="button"
      class="scroll-to-top-fab"
      :class="{ 'scroll-to-top-fab--narrow': systemStore.isNarrowScreen }"
      aria-label="回到页面顶部"
      title="回到顶部"
      @click="scrollToTop"
    >
      <n-icon :size="24" :component="KeyboardDoubleArrowUpRound" class="scroll-to-top-fab__icon" />
    </button>
  </Transition>
</template>

<style scoped>
.scroll-to-top-fab {
  --scroll-to-top-right: clamp(16px, 2vw, 28px);
  --scroll-to-top-bottom: clamp(24px, 2.8vw, 36px);
  position: fixed;
  right: var(--scroll-to-top-right);
  bottom: var(--scroll-to-top-bottom);
  z-index: 96;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 2px solid color-mix(in srgb, var(--primary-color) 72%, var(--border-color));
  border-radius: 50%;
  background: var(--card-color);
  color: var(--primary-color);
  box-shadow:
    0 6px 18px color-mix(in srgb, var(--text-color-base) 18%, transparent),
    0 0 0 1px color-mix(in srgb, var(--border-color) 65%, transparent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    right 0.25s ease,
    bottom 0.25s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.scroll-to-top-fab__icon {
  flex-shrink: 0;
  color: var(--primary-color);
}

.scroll-to-top-fab__icon :deep(svg) {
  display: block;
  fill: currentColor;
}

.scroll-to-top-fab--narrow {
  --scroll-to-top-right: clamp(12px, 3.5vw, 20px);
  --scroll-to-top-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 1024px) {
  .scroll-to-top-fab:not(.scroll-to-top-fab--narrow) {
    --scroll-to-top-right: clamp(28px, 2.8vw, 44px);
    --scroll-to-top-bottom: clamp(36px, 3.6vw, 56px);
  }
}

@media (min-width: 1440px) {
  .scroll-to-top-fab:not(.scroll-to-top-fab--narrow) {
    --scroll-to-top-right: clamp(40px, 3.2vw, 64px);
    --scroll-to-top-bottom: clamp(48px, 4.2vw, 72px);
  }
}

@media (min-width: 1920px) {
  .scroll-to-top-fab:not(.scroll-to-top-fab--narrow) {
    --scroll-to-top-right: clamp(48px, 3.5vw, 80px);
    --scroll-to-top-bottom: clamp(56px, 4.8vw, 88px);
  }
}

@media (hover: hover) {
  .scroll-to-top-fab:hover {
    background: color-mix(in srgb, var(--primary-color) 12%, var(--card-color));
    border-color: var(--primary-color);
    box-shadow:
      0 8px 22px color-mix(in srgb, var(--primary-color) 28%, transparent),
      0 0 0 1px color-mix(in srgb, var(--primary-color) 35%, var(--border-color));
    transform: translateY(-2px);
  }
}

.scroll-to-top-fab:active {
  transform: translateY(0) scale(0.96);
}

.scroll-to-top-fab-enter-active,
.scroll-to-top-fab-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.scroll-to-top-fab-enter-from,
.scroll-to-top-fab-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
}
</style>
