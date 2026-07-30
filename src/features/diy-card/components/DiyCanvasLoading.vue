<script setup lang="ts">
import GlobalLoading from '@/shared/components/GlobalLoading.vue'

defineProps<{
  hint: string
  subHint?: string
  size?: number
  duration?: number
}>()
</script>

<template>
  <GlobalLoading :hint="hint" :sub-hint="subHint" :size="size" :duration="duration" inline />
</template>
