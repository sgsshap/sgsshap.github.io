<script setup lang="ts">
import type { GlobalLoadingEffectProps } from '@/shared/loading/types'
import { computed } from 'vue'

const props = withDefaults(defineProps<GlobalLoadingEffectProps>(), {
  size: 72,
  duration: 1.5,
})

const rootStyle = computed(() => ({
  '--shanhai-size': `${props.size}px`,
  '--shanhai-speed': `${props.duration}s`,
}))
</script>

<template>
  <div class="shanhai-myth-effect" :style="rootStyle" aria-hidden="true">
    <div class="shanhai-myth-effect__scene">
      <div class="shanhai-myth-effect__mist shanhai-myth-effect__mist--back" />
      <div class="shanhai-myth-effect__peak shanhai-myth-effect__peak--far" />
      <div class="shanhai-myth-effect__peak shanhai-myth-effect__peak--near" />
      <div class="shanhai-myth-effect__orb" />
      <div class="shanhai-myth-effect__mist shanhai-myth-effect__mist--front" />
      <div class="shanhai-myth-effect__ring" />
    </div>
  </div>
</template>

<style>
.shanhai-myth-effect {
  --shanhai-size: 72px;
  --shanhai-speed: 1.5s;
  --shanhai-indigo: #243860;
  --shanhai-vermillion: #b63430;
  --shanhai-mist: rgba(52, 92, 148, 0.35);

  width: var(--shanhai-size);
  height: var(--shanhai-size);
  display: flex;
  align-items: center;
  justify-content: center;
}

.shanhai-myth-effect__scene {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 120%, #e8e4dc 0%, #d8dce8 45%, #c8d4e8 100%);
}

.shanhai-myth-effect__peak {
  position: absolute;
  bottom: 0;
  width: 0;
  height: 0;
  border-style: solid;
}

.shanhai-myth-effect__peak--far {
  left: 8%;
  border-width: 0 calc(var(--shanhai-size) * 0.22) calc(var(--shanhai-size) * 0.34)
    calc(var(--shanhai-size) * 0.22);
  border-color: transparent transparent rgba(36, 56, 96, 0.35) transparent;
}

.shanhai-myth-effect__peak--near {
  right: 6%;
  border-width: 0 calc(var(--shanhai-size) * 0.28) calc(var(--shanhai-size) * 0.48)
    calc(var(--shanhai-size) * 0.28);
  border-color: transparent transparent var(--shanhai-indigo) transparent;
}

.shanhai-myth-effect__orb {
  position: absolute;
  top: 22%;
  left: 50%;
  width: calc(var(--shanhai-size) * 0.22);
  height: calc(var(--shanhai-size) * 0.22);
  margin-left: calc(var(--shanhai-size) * -0.11);
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 35%,
    #e85a48 0%,
    var(--shanhai-vermillion) 55%,
    #8a2824 100%
  );
  box-shadow: 0 0 calc(var(--shanhai-size) * 0.12) rgba(182, 52, 48, 0.55);
  animation: shanhai-myth-orb calc(var(--shanhai-speed) * 2.5) ease-in-out infinite;
}

.shanhai-myth-effect__mist {
  position: absolute;
  left: -10%;
  width: 120%;
  height: 35%;
  background: linear-gradient(90deg, transparent, var(--shanhai-mist), transparent);
  filter: blur(calc(var(--shanhai-size) * 0.05));
}

.shanhai-myth-effect__mist--back {
  bottom: 28%;
  animation: shanhai-myth-mist calc(var(--shanhai-speed) * 2.8) ease-in-out infinite;
}

.shanhai-myth-effect__mist--front {
  bottom: 12%;
  opacity: 0.7;
  animation: shanhai-myth-mist calc(var(--shanhai-speed) * 2) ease-in-out infinite reverse;
}

.shanhai-myth-effect__ring {
  position: absolute;
  inset: 12%;
  border: 1px solid rgba(36, 56, 96, 0.25);
  border-radius: 50%;
  animation: shanhai-myth-ring calc(var(--shanhai-speed) * 2) linear infinite;
}

.shanhai-myth-effect__ring::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 1px dashed rgba(182, 52, 48, 0.45);
  animation: shanhai-myth-ring-reverse calc(var(--shanhai-speed) * 3) linear infinite;
}

@keyframes shanhai-myth-orb {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  50% {
    transform: translateY(calc(var(--shanhai-size) * 0.04)) scale(1.08);
  }
}

@keyframes shanhai-myth-mist {
  0%,
  100% {
    transform: translateX(-6%);
    opacity: 0.4;
  }

  50% {
    transform: translateX(6%);
    opacity: 0.85;
  }
}

@keyframes shanhai-myth-ring {
  to {
    transform: rotate(360deg);
  }
}

@keyframes shanhai-myth-ring-reverse {
  to {
    transform: rotate(-360deg);
  }
}
</style>
