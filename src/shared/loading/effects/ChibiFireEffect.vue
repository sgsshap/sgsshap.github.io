<script setup lang="ts">
import type { GlobalLoadingEffectProps } from '@/shared/loading/types'
import { computed } from 'vue'

const props = withDefaults(defineProps<GlobalLoadingEffectProps>(), {
  size: 72,
  duration: 1.5,
})

const rootStyle = computed(() => ({
  '--fire-size': `${props.size}px`,
  '--fire-speed': `${props.duration}s`,
}))
</script>

<template>
  <div class="chibi-fire-effect" :style="rootStyle" aria-hidden="true">
    <div class="chibi-fire-effect__fire">
      <div class="chibi-fire-effect__left">
        <div class="chibi-fire-effect__main" />
        <div class="chibi-fire-effect__particle" />
      </div>
      <div class="chibi-fire-effect__center">
        <div class="chibi-fire-effect__main chibi-fire-effect__main--core" />
        <div class="chibi-fire-effect__particle" />
      </div>
      <div class="chibi-fire-effect__right">
        <div class="chibi-fire-effect__main" />
        <div class="chibi-fire-effect__particle" />
      </div>
      <div class="chibi-fire-effect__bottom">
        <div class="chibi-fire-effect__main chibi-fire-effect__main--base" />
      </div>
    </div>
  </div>
</template>

<style>
.chibi-fire-effect {
  --fire-size: 72px;
  --fire-speed: 1.5s;

  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--fire-size);
  height: var(--fire-size);
}

.chibi-fire-effect__fire {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: transparent;
}

.chibi-fire-effect__left,
.chibi-fire-effect__center,
.chibi-fire-effect__right,
.chibi-fire-effect__bottom {
  position: absolute;
  width: 100%;
  height: 100%;
}

.chibi-fire-effect__center {
  animation: chibi-fire-scale calc(var(--fire-speed) * 2) ease-out infinite both;
}

.chibi-fire-effect__left {
  animation: chibi-fire-shake calc(var(--fire-speed) * 2) ease-out infinite both;
}

.chibi-fire-effect__right {
  animation: chibi-fire-shake calc(var(--fire-speed) * 1.33) ease-out infinite both;
}

.chibi-fire-effect__main {
  position: absolute;
  background-color: #ef5a00;
  transform: scaleX(0.8) rotate(45deg);
  border-radius: 0 40% 60% 40%;
  filter: drop-shadow(0 0 calc(var(--fire-size) * 0.1) #d43322);
}

.chibi-fire-effect__main--core {
  inset: 0;
  width: 100%;
  height: 100%;
  background-image: radial-gradient(farthest-corner at 10px 0, #d43300 0%, #ef5a00 95%);
  transform: scaleX(0.8) rotate(45deg);
}

.chibi-fire-effect__left .chibi-fire-effect__main {
  top: 15%;
  left: -20%;
  width: 80%;
  height: 80%;
}

.chibi-fire-effect__right .chibi-fire-effect__main {
  top: 15%;
  right: -25%;
  width: 80%;
  height: 80%;
}

.chibi-fire-effect__bottom .chibi-fire-effect__main--base {
  top: 30%;
  left: 20%;
  width: 75%;
  height: 75%;
  background-color: #ff7800;
  border-radius: 0 40% 100% 40%;
  filter: blur(calc(var(--fire-size) * 0.1));
  animation: chibi-fire-glow-color calc(var(--fire-speed) * 1.33) ease-out infinite both;
}

.chibi-fire-effect__particle {
  position: absolute;
  background-color: #ef5a00;
  border-radius: 50%;
  filter: drop-shadow(0 0 calc(var(--fire-size) * 0.1) #d43322);
  animation: chibi-fire-particle calc(var(--fire-speed) * 1.33) ease-out infinite both;
}

.chibi-fire-effect__center .chibi-fire-effect__particle {
  top: 60%;
  left: 45%;
  width: 10%;
  height: 10%;
}

.chibi-fire-effect__left .chibi-fire-effect__particle {
  top: 10%;
  left: 20%;
  width: 10%;
  height: 10%;
  animation-duration: calc(var(--fire-speed) * 2);
}

.chibi-fire-effect__right .chibi-fire-effect__particle {
  top: 45%;
  left: 50%;
  width: 15%;
  height: 15%;
  transform: scaleX(0.8) rotate(45deg);
  border-radius: 50%;
}

@keyframes chibi-fire-scale {
  0%,
  100% {
    transform: scaleY(1) scaleX(1);
  }

  50%,
  90% {
    transform: scaleY(1.1);
  }

  75% {
    transform: scaleY(0.95);
  }

  80% {
    transform: scaleX(0.95);
  }
}

@keyframes chibi-fire-shake {
  0%,
  100% {
    transform: skewX(0) scale(1);
  }

  50% {
    transform: skewX(5deg) scale(0.9);
  }
}

@keyframes chibi-fire-particle {
  0% {
    opacity: 0;
  }

  20% {
    opacity: 1;
  }

  80% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    top: -100%;
    transform: scale(0.5);
  }
}

@keyframes chibi-fire-glow-color {
  0%,
  100% {
    background-color: #ef5a00;
  }

  50% {
    background-color: #ff7800;
  }
}
</style>
