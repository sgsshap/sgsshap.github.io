<script setup lang="ts">
import { useAppHistoryBack } from '@/shared/composables/useAppHistoryBack'
import { useShareCurrentPage } from '@/shared/composables/useShareCurrentPage'
import { ArrowBackRound, IosShareRound } from '@/shared/icons'
import { NIcon } from 'naive-ui'

const { visible, title, shareVisible, goBack } = useAppHistoryBack()
const { sharePage } = useShareCurrentPage()

const handleShare = () => {
  void sharePage({ title: title.value })
}
</script>

<template>
  <Transition name="sub-page-header">
    <header v-if="visible" class="sub-page-header">
      <div class="sub-page-header__inner">
        <div class="sub-page-header__side sub-page-header__side--start">
          <button
            type="button"
            class="sub-page-header__action"
            aria-label="返回上一页"
            @click="goBack"
          >
            <n-icon :size="20" :component="ArrowBackRound" />
            <span class="sub-page-header__action-text">返回</span>
          </button>
        </div>

        <h1 class="sub-page-header__title">{{ title }}</h1>

        <div class="sub-page-header__side sub-page-header__side--end">
          <button
            v-if="shareVisible"
            type="button"
            class="sub-page-header__action"
            aria-label="分享当前页面"
            @click="handleShare"
          >
            <n-icon :size="20" :component="IosShareRound" />
            <span class="sub-page-header__action-text">分享</span>
          </button>
          <span
            v-else
            class="sub-page-header__action sub-page-header__action--balance"
            aria-hidden="true"
          >
            <n-icon :size="20" :component="IosShareRound" />
            <span class="sub-page-header__action-text">分享</span>
          </span>
        </div>
      </div>
    </header>
  </Transition>
</template>

<style scoped>
.sub-page-header {
  position: fixed;
  top: 0;
  left: var(--app-sider-offset, 0px);
  right: 0;
  z-index: 25;
  padding-top: var(--safe-area-top, env(safe-area-inset-top, 0px));
  background: var(--card-color);
  border-bottom: 1px solid var(--divider-color);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--text-color-base) 6%, transparent);
}

.sub-page-header__inner {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--sub-page-header-inner-height, 48px);
  margin: 0 auto;
  padding: 0 1vw;
  box-sizing: border-box;
}

.sub-page-header__side {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.sub-page-header__side--start {
  justify-content: flex-start;
}

.sub-page-header__side--end {
  justify-content: flex-end;
}

.sub-page-header__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 36px;
  height: 36px;
  margin: 0;
  padding: 0 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-color-2);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

@media (hover: hover) {
  .sub-page-header__action:hover {
    color: var(--text-color-base);
    background: color-mix(in srgb, var(--text-color-3) 10%, transparent);
  }
}

.sub-page-header__action:active {
  background: color-mix(in srgb, var(--text-color-3) 16%, transparent);
}

.sub-page-header__action-text {
  line-height: 1;
}

.sub-page-header__action--balance {
  visibility: hidden;
  pointer-events: none;
}

.sub-page-header__title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  color: var(--text-color-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub-page-header-enter-active {
  transition: opacity 0.22s ease;
}

.sub-page-header-leave-active {
  transition: opacity 0.12s ease;
}

.sub-page-header-enter-from,
.sub-page-header-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .sub-page-header__inner {
    gap: 8px;
    padding-inline: 12px;
  }

  .sub-page-header__action {
    min-width: 36px;
    padding: 0;
  }

  .sub-page-header__action-text {
    display: none;
  }

  .sub-page-header__title {
    font-size: 16px;
  }
}
</style>
