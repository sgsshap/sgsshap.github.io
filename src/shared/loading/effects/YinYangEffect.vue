<script setup lang="ts">
import type { GlobalLoadingEffectProps } from '@/shared/loading/types'
import { computed } from 'vue'

const props = withDefaults(defineProps<GlobalLoadingEffectProps>(), {
  size: 72,
  duration: 1.5,
})

const yinYangStyle = computed(() => ({
  '--yin-size': `${props.size}px`,
  '--yin-duration': `${props.duration}s`,
}))
</script>

<template>
  <div class="yin-yang-effect" :style="yinYangStyle" aria-hidden="true">
    <div class="yin-yang-effect__symbol">
      <div class="yin-yang-effect__dot yin-yang-effect__dot--white" />
      <div class="yin-yang-effect__dot yin-yang-effect__dot--black" />
    </div>
  </div>
</template>

<style>
.yin-yang-effect {
  display: flex;
  justify-content: center;
  align-items: center;
}

.yin-yang-effect__symbol {
  --yin-size: 72px;
  --yin-duration: 1.5s;

  width: var(--yin-size);
  height: var(--yin-size);
  border-radius: 50%;
  background: linear-gradient(90deg, white 50%, black 50%);
  animation: yin-yang-effect-rotate var(--yin-duration) linear infinite;
  position: relative;
  box-shadow: 0 0 calc(var(--yin-size) * 0.167) rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.3s ease;
}

.yin-yang-effect__symbol::before,
.yin-yang-effect__symbol::after {
  content: '';
  position: absolute;
  width: calc(var(--yin-size) / 2);
  height: calc(var(--yin-size) / 2);
  border-radius: 50%;
  left: 50%;
  transform: translateX(-50%);
}

.yin-yang-effect__symbol::before {
  top: 0;
  background: black;
}

.yin-yang-effect__symbol::after {
  bottom: 0;
  background: white;
}

.yin-yang-effect__dot {
  position: absolute;
  width: calc(var(--yin-size) * 0.15);
  height: calc(var(--yin-size) * 0.15);
  border-radius: 50%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  animation: yin-yang-effect-pulse var(--yin-duration) ease-in-out infinite;
}

.yin-yang-effect__dot--white {
  background: white;
  top: calc(var(--yin-size) * 0.25);
}

.yin-yang-effect__dot--black {
  background: black;
  bottom: calc(var(--yin-size) * 0.25);
}

.yin-yang-effect__symbol:hover {
  box-shadow: 0 0 calc(var(--yin-size) * 0.25) rgba(0, 0, 0, 0.2);
}

@keyframes yin-yang-effect-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes yin-yang-effect-pulse {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
  }

  50% {
    transform: translateX(-50%) scale(1.1);
  }
}
</style>
