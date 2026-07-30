<script setup lang="ts">
import { useDiyStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import type { GameInfo } from '@/features/diy-card/types/diy/game'
import { Layer as VLayer, Rect as VRect, Text as VText } from 'vue-konva'
import { computed } from 'vue'

/* 依赖注入 */
const diyStore = useDiyStore()
const infoStore = useInfoStore()

/* 计算属性 */
const info = computed(() => infoStore.info as GameInfo)

const cardConfig = computed(() => ({
  x: 24,
  y: 24,
  width: 214,
  height: 302,
  fill: '#1a5276',
  stroke: '#f1c40f',
  strokeWidth: 3,
  cornerRadius: 10,
}))

const nameConfig = computed(() => ({
  x: 34,
  y: 140,
  width: 194,
  text: info.value.baseInfo.name,
  fontSize: 22,
  fill: '#ffffff',
  align: 'center',
}))

const typeLabelConfig = computed(() => ({
  x: 34,
  y: 48,
  width: 194,
  text: '游戏牌 · 测试模板',
  fontSize: 14,
  fill: '#f1c40f',
  align: 'center',
}))
</script>

<template>
  <v-layer>
    <v-rect :config="cardConfig" />
    <v-text :config="typeLabelConfig" />
    <v-text :config="nameConfig" />
  </v-layer>
</template>
