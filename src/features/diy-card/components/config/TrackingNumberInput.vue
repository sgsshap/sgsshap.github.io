<script setup lang="ts">
/** PS 字距（Tracking，±1000 量纲整数） */
withDefaults(
  defineProps<{
    value: number | null
    disabled?: boolean
    step?: number
    min?: number
    max?: number
  }>(),
  {
    step: 1,
    min: -1000,
    max: 1000,
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
    :precision="0"
    :step="step"
    :min="min"
    :max="max"
    :disabled="disabled"
    @update:value="$emit('update:value', $event)"
  >
    <template #suffix> Tracking </template>
  </n-input-number>
</template>
