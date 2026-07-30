<script setup lang="ts">
import type { GlobalLoadingEffectProps } from '@/shared/loading/types'
import { computed } from 'vue'

const props = withDefaults(defineProps<GlobalLoadingEffectProps>(), {
  size: 72,
  duration: 1.5,
})

const rootStyle = computed(() => ({
  '--ink-size': `${props.size}px`,
  '--ink-speed': `${props.duration}s`,
}))
</script>

<template>
  <div class="shuimo-ink-effect" :style="rootStyle" aria-hidden="true">
    <div class="shuimo-ink-effect__paper">
      <div class="shuimo-ink-effect__wash" />
      <div class="shuimo-ink-effect__stroke" />
      <div class="shuimo-ink-effect__seal" aria-hidden="true" />
    </div>
  </div>
</template>

<style>
.shuimo-ink-effect {
  --ink-size: 72px;
  --ink-speed: 1.5s;

  width: var(--ink-size);
  height: var(--ink-size);
  display: flex;
  align-items: center;
  justify-content: center;
}

.shuimo-ink-effect__paper {
  position: relative;
  width: 88%;
  height: 88%;
  border-radius: 2px;
  background: linear-gradient(145deg, #faf7f2 0%, #f0ebe3 100%);
  box-shadow: inset 0 0 0 1px rgba(34, 32, 32, 0.08);
  overflow: hidden;
}

.shuimo-ink-effect__wash {
  z-index: 1;
  position: absolute;
  left: 18%;
  bottom: 24%;
  width: 42%;
  height: 42%;
  transform: translateX(0);
  border-radius: 50% 50% 42% 58%;
  background: radial-gradient(
    ellipse at 40% 60%,
    rgba(22, 20, 20, 0.72) 0%,
    rgba(22, 20, 20, 0.18) 55%,
    transparent 72%
  );
  filter: blur(calc(var(--ink-size) * 0.035));
  animation: shuimo-ink-spread calc(var(--ink-speed) * 2.2) ease-in-out infinite;
}

.shuimo-ink-effect__stroke {
  z-index: 2;
  position: absolute;
  top: 30%;
  left: -18%;
  width: 130%;
  height: calc(var(--ink-size) * 0.065);
  background: linear-gradient(90deg, transparent 0%, #1a1818 18%, #1a1818 82%, transparent 100%);
  border-radius: 50%;
  transform: rotate(-12deg);
  opacity: 0.9;
  animation: shuimo-ink-brush calc(var(--ink-speed) * 1.8) ease-in-out infinite;
}

.shuimo-ink-effect__seal {
  z-index: 3;
  position: absolute;
  right: 12%;
  bottom: 14%;
  width: calc(var(--ink-size) * 0.17);
  height: calc(var(--ink-size) * 0.17);
  border: 2px solid #a23832;
  border-radius: 2px;
  opacity: 0;
  animation: shuimo-ink-seal calc(var(--ink-speed) * 2) ease-out infinite;
}

.shuimo-ink-effect__seal::after {
  content: '印';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--ink-size) * 0.09);
  font-family: var(--site-font-family);
  color: #a23832;
  font-weight: 700;
}

@keyframes shuimo-ink-spread {
  0%,
  100% {
    transform: scale(0.88);
    opacity: 0.6;
  }

  50% {
    transform: scale(1.05);
    opacity: 1;
  }
}

@keyframes shuimo-ink-brush {
  0%,
  100% {
    transform: rotate(-12deg) translateX(-8%);
    opacity: 0.35;
  }

  45%,
  55% {
    transform: rotate(-8deg) translateX(6%);
    opacity: 0.95;
  }
}

@keyframes shuimo-ink-seal {
  0%,
  40% {
    opacity: 0;
    transform: scale(0.6);
  }

  55%,
  85% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0;
    transform: scale(0.9);
  }
}
</style>
