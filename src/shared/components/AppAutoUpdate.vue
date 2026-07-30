<script setup lang="ts">
import { startAppAutoUpdate } from '@/shared/utils/appAutoUpdate'
import { useDialog } from 'naive-ui'
import { h, onBeforeUnmount, onMounted } from 'vue'

// ==================== 依赖注入 ====================
const dialog = useDialog()

// ==================== 核心逻辑 ====================
let stopAutoUpdate: (() => void) | null = null

onMounted(() => {
  stopAutoUpdate = startAppAutoUpdate({
    confirmUpdate: () =>
      new Promise((resolve) => {
        dialog.warning({
          title: '提示',
          content: () =>
            h('span', null, [
              '检测到有更新，是否立即',
              h('span', { style: 'color: var(--error-color); font-weight: 600' }, '刷新'),
              '？',
            ]),
          positiveText: '立即刷新',
          negativeText: '稍后',
          onPositiveClick: () => {
            resolve(true)
            return true
          },
          onNegativeClick: () => {
            resolve(false)
            return true
          },
          onClose: () => {
            resolve(false)
          },
        })
      }),
  })
})

onBeforeUnmount(() => {
  stopAutoUpdate?.()
  stopAutoUpdate = null
})
</script>

<template></template>
