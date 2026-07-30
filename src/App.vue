<script setup lang="ts">
import AppAutoUpdate from '@/shared/components/AppAutoUpdate.vue'
import BetaSiteNotice from '@/shared/components/BetaSiteNotice.vue'
import GlobalLoading from '@/shared/components/GlobalLoading.vue'
import { useAppLoadingStore } from '@/shared/stores/appLoading'
import { useSystemStore } from '@/shared/stores/system'
import { applyDocumentTheme } from '@/shared/utils/themeBoot'
import { setupNaiveMobileGuards, type NaiveMobileGuard } from '@/shared/utils/naive'
import { dateZhCN, NConfigProvider, NMessageProvider, zhCN } from 'naive-ui'
import { onBeforeUnmount, onMounted, watchEffect } from 'vue'

const systemStore = useSystemStore()
const appLoadingStore = useAppLoadingStore()

let naiveMobileGuard: NaiveMobileGuard | null = null

onMounted(() => {
  naiveMobileGuard = setupNaiveMobileGuards()
})

watchEffect(() => {
  void systemStore.isDark
  applyDocumentTheme({
    themeKey: systemStore.themeKey,
    followSystemTheme: systemStore.followSystemTheme,
    themeMode: systemStore.themeMode,
    siteFontKey: systemStore.siteFontKey,
  })
})

onBeforeUnmount(() => {
  naiveMobileGuard?.disconnect()
  naiveMobileGuard = null
})
</script>

<template>
  <n-config-provider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme="systemStore.currentTheme"
    :class="[systemStore.isDark ? 'dark' : 'light', `theme-${systemStore.themeKey}`]"
    :theme-overrides="systemStore.currentThemeOverrides"
  >
    <n-dialog-provider>
      <BetaSiteNotice />
      <AppAutoUpdate />
      <n-modal-provider>
        <n-message-provider>
          <router-view />
          <Transition name="app-loading-fade">
            <GlobalLoading
              v-if="appLoadingStore.showGlobalLoading"
              :hint="appLoadingStore.hint"
              :boot="appLoadingStore.isBootstrapOnly"
            />
          </Transition>
        </n-message-provider>
      </n-modal-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>

<style>
@import '@/shared/styles/index.css';
</style>
