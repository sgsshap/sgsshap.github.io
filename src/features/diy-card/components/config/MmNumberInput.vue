<script setup lang="ts">
/** 与操作元素卡片横纵轴一致的 mm 数值输入 */
withDefaults(
  defineProps<{
    value: number | null
    disabled?: boolean
    step?: number
    min?: number
    max?: number
  }>(),
  {
    step: 0.1,
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
    <template #suffix> mm </template>
  </n-input-number>
</template>
