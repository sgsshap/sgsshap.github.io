<script setup lang="ts">
/** 与 PS 一致的 pt 数值输入（字号 / 行距 / 竖排字间距等） */
withDefaults(
  defineProps<{
    value: number | null
    disabled?: boolean
    step?: number
    min?: number
    max?: number
  }>(),
  {
    step: 0.5,
  },
)

defineEmits<{
  'update:value': [number | null]
}>()
</script>

<template>
  <n-input-number
    :value="value"
    size="medium"
    button-placement="both"
    :precision="2"
    :step="step"
    :min="min"
    :max="max"
    :disabled="disabled"
    @update:value="$emit('update:value', $event)"
  >
    <template #suffix> pt </template>
  </n-input-number>
</template>
