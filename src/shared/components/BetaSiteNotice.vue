<script setup lang="ts">
import { BETA_NOTICE_STAYED_SESSION_KEY, LEGACY_SGS_SHAP_URL } from '@/shared/constants/site'
import { useDialog } from 'naive-ui'
import { onMounted } from 'vue'

// ==================== 依赖注入 ====================
const dialog = useDialog()

// ==================== 核心逻辑 ====================
const openBetaNotice = () => {
  dialog.warning({
    title: '测试版',
    content: '本站为测试版，功能不全，如需制图请前往访问正式版。',
    positiveText: '前往正式版',
    negativeText: '继续浏览',
    closable: false,
    maskClosable: false,
    onPositiveClick: () => {
      globalThis.location.href = LEGACY_SGS_SHAP_URL
    },
    onNegativeClick: () => {
      sessionStorage.setItem(BETA_NOTICE_STAYED_SESSION_KEY, '1')
    },
  })
}

onMounted(() => {
  if (sessionStorage.getItem(BETA_NOTICE_STAYED_SESSION_KEY)) return
  openBetaNotice()
})
</script>

<template></template>
