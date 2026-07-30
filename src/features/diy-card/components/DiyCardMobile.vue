<script setup lang="ts">
import Config from '@/features/diy-card/components/config/DiyConfig.vue'
import DiyCustomMaterialBar from '@/features/diy-card/components/DiyCustomMaterialBar.vue'
import Preview from '@/features/diy-card/components/DiyPreview.vue'
</script>

<template>
  <div class="diy-card-mobile">
    <div class="diy-card-mobile__preview diy-card-mobile__section">
      <Preview />
    </div>
    <div class="diy-card-mobile__config diy-card-mobile__section">
      <Config />
    </div>
    <div class="diy-card-mobile__material diy-card-mobile__section">
      <DiyCustomMaterialBar />
    </div>
  </div>
</template>

<style scoped>
.diy-card-mobile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--page-gap, 16px);
  width: 100%;
  max-width: 100%;
  padding: var(--page-p, 16px) var(--page-p, 16px) 0;
  overflow-x: hidden;
  box-sizing: border-box;
}

.diy-card-mobile__section {
  width: 100%;
  max-width: var(--diy-card-max-width);
  padding: 0;
  min-width: 0;
  box-sizing: border-box;
}

.diy-card-mobile__preview {
  max-width: 100%;
  overflow-x: visible;
}

.diy-card-mobile__config {
  overflow-x: clip;
}

.diy-card-mobile__config :deep(.diy-config) {
  width: 100%;
}

.diy-card-mobile__material {
  overflow-x: clip;
  margin-bottom: var(--diy-mobile-section-trail, 40px);
}

.diy-card-mobile__material :deep(.diy-panel-card) {
  width: 100%;
  margin-inline: auto;
}
</style>
