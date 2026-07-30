<script setup lang="ts">
import type { GlobalLoadingEffectProps } from '@/shared/loading/types'
import { computed } from 'vue'

const props = withDefaults(defineProps<GlobalLoadingEffectProps>(), {
  size: 72,
  duration: 1.5,
})

const rootStyle = computed(() => ({
  '--line-size': `${props.size}px`,
  '--line-speed': `${props.duration}s`,
  '--line-stroke': `${Math.max(3, props.size * 0.05)}px`,
}))
</script>

<template>
  <div class="minimal-line-effect" :style="rootStyle" aria-hidden="true">
    <svg class="minimal-line-effect__svg" viewBox="0 0 64 64" fill="none">
      <circle
        class="minimal-line-effect__ring minimal-line-effect__ring--outer"
        cx="32"
        cy="32"
        r="26"
      />
      <circle
        class="minimal-line-effect__ring minimal-line-effect__ring--mid"
        cx="32"
        cy="32"
        r="18"
      />
      <rect class="minimal-line-effect__square" x="22" y="22" width="20" height="20" rx="1" />
    </svg>
  </div>
</template>

<style>
.minimal-line-effect {
  --line-size: 72px;
  --line-speed: 1.5s;
  --line-stroke: 3.5px;
  --line-color: #18181c;
  --line-accent: #0891b2;

  width: var(--line-size);
  height: var(--line-size);
  display: flex;
  align-items: center;
  justify-content: center;
}

.minimal-line-effect__svg {
  width: 88%;
  height: 88%;
}

.minimal-line-effect__ring,
.minimal-line-effect__square {
  stroke: var(--line-color);
  stroke-width: var(--line-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
}

.minimal-line-effect__ring--outer {
  stroke-width: calc(var(--line-stroke) + 0.75px);
  stroke: var(--line-accent);
  animation: minimal-line-draw calc(var(--line-speed) * 2.4) ease-in-out infinite;
}

.minimal-line-effect__ring--mid {
  animation: minimal-line-draw calc(var(--line-speed) * 2) ease-in-out infinite reverse;
  animation-delay: calc(var(--line-speed) * 0.2);
}

.minimal-line-effect__square {
  animation: minimal-line-draw calc(var(--line-speed) * 1.6) ease-in-out infinite;
  animation-delay: calc(var(--line-speed) * 0.35);
}

@keyframes minimal-line-draw {
  0% {
    stroke-dashoffset: 200;
    opacity: 0.55;
  }

  45% {
    stroke-dashoffset: 0;
    opacity: 1;
  }

  100% {
    stroke-dashoffset: -40;
    opacity: 0.55;
  }
}
</style>
