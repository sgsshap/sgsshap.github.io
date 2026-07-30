<script setup lang="ts">
import type { GlobalLoadingEffectProps } from '@/shared/loading/types'
import { computed } from 'vue'

const props = withDefaults(defineProps<GlobalLoadingEffectProps>(), {
  size: 72,
  duration: 1.5,
})

const rootStyle = computed(() => ({
  '--pixel-size': `${props.size}px`,
  '--pixel-speed': `${props.duration}s`,
}))

const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8]
</script>

<template>
  <div class="pixel-world-effect" :style="rootStyle" aria-hidden="true">
    <div class="pixel-world-effect__grid">
      <span
        v-for="i in cells"
        :key="i"
        class="pixel-world-effect__cell"
        :class="`pixel-world-effect__cell--${i}`"
      />
    </div>
  </div>
</template>

<style>
.pixel-world-effect {
  --pixel-size: 72px;
  --pixel-speed: 1.5s;
  --pixel-a: #48427c;
  --pixel-b: #7e99b8;
  --pixel-c: #ecc858;
  --pixel-d: #56996c;

  width: var(--pixel-size);
  height: var(--pixel-size);
  display: flex;
  align-items: center;
  justify-content: center;
  image-rendering: pixelated;
}

.pixel-world-effect__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: calc(var(--pixel-size) * 0.06);
  width: 72%;
  height: 72%;
}

.pixel-world-effect__cell {
  background: var(--pixel-a);
  border-radius: 1px;
  animation: pixel-world-blink calc(var(--pixel-speed) * 0.9) steps(1) infinite;
}

.pixel-world-effect__cell--0 {
  animation-delay: 0s;
}

.pixel-world-effect__cell--1 {
  animation-delay: calc(var(--pixel-speed) * 0.1);
}

.pixel-world-effect__cell--2 {
  animation-delay: calc(var(--pixel-speed) * 0.2);
}

.pixel-world-effect__cell--3 {
  animation-delay: calc(var(--pixel-speed) * 0.15);
}

.pixel-world-effect__cell--4 {
  background: var(--pixel-c);
  animation-delay: calc(var(--pixel-speed) * 0.05);
}

.pixel-world-effect__cell--5 {
  animation-delay: calc(var(--pixel-speed) * 0.25);
}

.pixel-world-effect__cell--6 {
  animation-delay: calc(var(--pixel-speed) * 0.2);
}

.pixel-world-effect__cell--7 {
  background: var(--pixel-b);
  animation-delay: calc(var(--pixel-speed) * 0.12);
}

.pixel-world-effect__cell--8 {
  background: var(--pixel-d);
  animation-delay: calc(var(--pixel-speed) * 0.18);
}

@keyframes pixel-world-blink {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.85);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
