<script setup lang="ts">
import type { GlobalLoadingEffectProps } from '@/shared/loading/types'
import { computed } from 'vue'

const props = withDefaults(defineProps<GlobalLoadingEffectProps>(), {
  size: 72,
  duration: 1.5,
})

const rootStyle = computed(() => ({
  '--cyber-size': `${props.size}px`,
  '--cyber-speed': `${props.duration}s`,
}))
</script>

<template>
  <div class="cyber-glitch-effect" :style="rootStyle" aria-hidden="true">
    <div class="cyber-glitch-effect__frame">
      <div class="cyber-glitch-effect__layer cyber-glitch-effect__layer--cyan" />
      <div class="cyber-glitch-effect__layer cyber-glitch-effect__layer--magenta" />
      <div class="cyber-glitch-effect__core">
        <span class="cyber-glitch-effect__bar" />
        <span class="cyber-glitch-effect__bar" />
        <span class="cyber-glitch-effect__bar" />
      </div>
      <div class="cyber-glitch-effect__scanline" />
    </div>
  </div>
</template>

<style>
.cyber-glitch-effect {
  --cyber-size: 72px;
  --cyber-speed: 1.5s;

  width: var(--cyber-size);
  height: var(--cyber-size);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cyber-glitch-effect__frame {
  position: relative;
  width: 78%;
  height: 78%;
  background: #130c2d;
  border: 2px solid rgba(75, 198, 255, 0.65);
  box-shadow:
    0 0 calc(var(--cyber-size) * 0.12) rgba(83, 32, 201, 0.8),
    inset 0 0 calc(var(--cyber-size) * 0.08) rgba(75, 198, 255, 0.15);
  overflow: hidden;
  animation: cyber-glitch-jitter calc(var(--cyber-speed) * 0.35) steps(2) infinite;
}

.cyber-glitch-effect__layer {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  mix-blend-mode: screen;
  pointer-events: none;
}

.cyber-glitch-effect__layer--cyan {
  background: linear-gradient(
    180deg,
    transparent 30%,
    rgba(75, 198, 255, 0.35) 50%,
    transparent 70%
  );
  animation: cyber-glitch-shift-cyan calc(var(--cyber-speed) * 0.5) steps(3) infinite;
}

.cyber-glitch-effect__layer--magenta {
  background: linear-gradient(
    180deg,
    transparent 20%,
    rgba(239, 68, 139, 0.3) 45%,
    transparent 65%
  );
  animation: cyber-glitch-shift-magenta calc(var(--cyber-speed) * 0.45) steps(3) infinite reverse;
}

.cyber-glitch-effect__core {
  position: absolute;
  inset: 22% 18%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18%;
}

.cyber-glitch-effect__bar {
  display: block;
  height: calc(var(--cyber-size) * 0.05);
  border-radius: 1px;
  background: linear-gradient(90deg, #5320c9, #4bc6ff, #ef448b);
  background-size: 200% 100%;
  animation: cyber-glitch-bar calc(var(--cyber-speed) * 1.2) ease-in-out infinite;
}

.cyber-glitch-effect__bar:nth-child(2) {
  width: 75%;
  animation-delay: calc(var(--cyber-speed) * 0.15);
}

.cyber-glitch-effect__bar:nth-child(3) {
  width: 55%;
  animation-delay: calc(var(--cyber-speed) * 0.3);
}

.cyber-glitch-effect__scanline {
  position: absolute;
  left: 0;
  width: 100%;
  height: 18%;
  background: linear-gradient(180deg, transparent, rgba(204, 250, 255, 0.35), transparent);
  animation: cyber-glitch-scan calc(var(--cyber-speed) * 1.1) linear infinite;
}

@keyframes cyber-glitch-jitter {
  0% {
    transform: translate(0, 0);
  }

  50% {
    transform: translate(-2px, 1px);
  }
}

@keyframes cyber-glitch-shift-cyan {
  0% {
    transform: translateX(-4px);
  }

  50% {
    transform: translateX(4px);
  }

  100% {
    transform: translateX(-2px);
  }
}

@keyframes cyber-glitch-shift-magenta {
  0% {
    transform: translateX(3px);
  }

  50% {
    transform: translateX(-5px);
  }

  100% {
    transform: translateX(2px);
  }
}

@keyframes cyber-glitch-bar {
  0%,
  100% {
    background-position: 0% 50%;
    opacity: 0.65;
  }

  50% {
    background-position: 100% 50%;
    opacity: 1;
  }
}

@keyframes cyber-glitch-scan {
  0% {
    top: -20%;
  }

  100% {
    top: 110%;
  }
}
</style>
