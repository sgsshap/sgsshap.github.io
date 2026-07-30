<script setup lang="ts">
import DiyConfig from '@/features/diy-card/components/config/DiyConfig.vue'
import DiyPreview from '@/features/diy-card/components/DiyPreview.vue'
</script>

<template>
  <div class="diy-card-pc">
    <div class="diy-card-pc__preview diy-card-pc__section">
      <DiyPreview />
    </div>
    <div class="diy-card-pc__config diy-card-pc__section">
      <DiyConfig />
    </div>
  </div>
</template>

<style scoped>
.diy-card-pc {
  display: flex;
  gap: var(--page-gap, 16px);
  align-items: flex-start;
  box-sizing: border-box;
  padding: var(--page-p, 20px);
}

.diy-card-pc__section {
  padding: 0;
  min-width: 0;
}

.diy-card-pc__preview {
  flex: 1 1 50%;
  width: 50vw;
  min-height: 400px;
  min-width: 400px;
}

.diy-card-pc__config {
  flex: 1 1 50%;
  width: 50vw;
}

/* Pad + 底部 Tab（视口 < 1280）：收紧间距，避免 min-width 撑出横向滚动 */
@media (max-width: 1279px) {
  .diy-card-pc {
    gap: var(--page-gap, 12px);
    padding: var(--page-p, 12px) var(--page-p, 12px) 4px;
    max-width: 100%;
  }

  .diy-card-pc__preview {
    flex: 1 1 52%;
    width: auto;
    min-width: 0;
  }

  .diy-card-pc__config {
    flex: 1 1 48%;
    width: auto;
    min-width: 0;
  }
}
</style>
