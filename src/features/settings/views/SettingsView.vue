<template>
  <div class="settings-view">
    <header class="settings-view__panel settings-view__page-head">
      <p class="settings-view__eyebrow">偏好与帮助</p>
      <h1 class="settings-view__title">系统设置</h1>
      <p class="settings-view__lead">
        调整界面字体与主题风格，查看捐助方式，或获取教学视频与反馈渠道。
      </p>
    </header>

    <div class="settings-view__cols">
      <section class="settings-view__panel settings-view__section">
        <header class="settings-view__section-head">
          <h2 class="settings-view__section-title">外观与主题</h2>
          <p class="settings-view__section-desc">界面字体、主题系列与深浅色模式</p>
        </header>

        <div class="settings-view__inset settings-view__field-stack">
          <div class="settings-view__field-row">
            <div class="settings-view__field-meta">
              <span class="settings-view__field-label">界面字体</span>
              <span class="settings-view__field-hint">不影响制图页画布字体</span>
            </div>
            <n-select
              :value="systemStore.siteFontKey"
              :options="systemStore.siteFontOptions"
              class="settings-view__select"
              @update:value="systemStore.setSiteFont"
            />
          </div>

          <div class="settings-view__field-split" aria-hidden="true" />

          <div class="settings-view__field-row">
            <div class="settings-view__field-meta">
              <span class="settings-view__field-label">主题风格</span>
              <span class="settings-view__field-hint">势力配色与 loading 动效</span>
            </div>
            <n-select
              :value="systemStore.themeKey"
              :options="systemStore.themeOptions"
              class="settings-view__select"
              @update:value="systemStore.setTheme"
            />
          </div>

          <div class="settings-view__field-split" aria-hidden="true" />

          <div class="settings-view__mode-row">
            <div class="settings-view__field-meta">
              <span class="settings-view__field-label">深浅色</span>
              <span class="settings-view__field-hint">可跟随系统或手动切换</span>
            </div>
            <div class="settings-view__mode-controls">
              <n-switch
                :value="systemStore.followSystemTheme"
                @update:value="systemStore.setFollowSystemTheme"
              >
                <template #checked>跟随系统</template>
                <template #unchecked>手动模式</template>
              </n-switch>
              <n-switch
                :value="systemStore.isDark"
                :disabled="systemStore.followSystemTheme"
                @update:value="(value) => systemStore.setThemeMode(value ? 'dark' : 'light')"
              >
                <template #checked>深色</template>
                <template #unchecked>浅色</template>
              </n-switch>
              <span
                class="settings-view__mode-tag"
                :class="{ 'settings-view__mode-tag--dark': systemStore.isDark }"
              >
                {{ systemStore.isDark ? '夜色' : '晴光' }}
              </span>
            </div>
          </div>
        </div>

        <n-el :key="systemStore.themeKey" tag="div" class="settings-view__quote">
          <p class="settings-view__quote-theme">{{ systemStore.activeTheme.label }}</p>
          <p class="settings-view__quote-text">
            {{ systemStore.activeThemeDescription }}
          </p>
        </n-el>
      </section>

      <div class="settings-view__side">
        <section class="settings-view__panel settings-view__section">
          <header class="settings-view__section-head">
            <h2 class="settings-view__section-title">支持项目</h2>
          </header>
          <p class="settings-view__prose">
            JxShap 持续运营与开发需要成本。若你觉得网站对你有帮助，欢迎自愿捐助，帮助我们走得更远。
          </p>
          <router-link to="/donation" class="settings-view__action-card">
            <span class="settings-view__icon">
              <n-icon :size="18" :component="VolunteerActivismRound" />
            </span>
            <span class="settings-view__action-copy">
              <span class="settings-view__action-name">查看捐助方式</span>
              <span class="settings-view__action-desc">微信 / 支付宝扫码捐助</span>
            </span>
            <n-icon :size="16" :component="ArrowForwardRound" class="settings-view__action-arrow" />
          </router-link>
        </section>

        <section class="settings-view__panel settings-view__section">
          <header class="settings-view__section-head">
            <h2 class="settings-view__section-title">帮助与反馈</h2>
            <p class="settings-view__section-desc">教学视频、BUG 登记与建议收集</p>
          </header>
          <ul class="settings-view__link-list">
            <li>
              <button type="button" class="settings-view__link-row" @click="handleOpenTutorialVideo">
                <span class="settings-view__link-copy">
                  <span class="settings-view__link-name">观看教学视频</span>
                  <span class="settings-view__link-desc">了解制图流程与常用功能</span>
                </span>
                <n-icon :size="16" :component="OndemandVideoRound" class="settings-view__link-icon" />
              </button>
            </li>
            <li>
              <button type="button" class="settings-view__link-row" @click="handleOpenBugFeedback">
                <span class="settings-view__link-copy">
                  <span class="settings-view__link-name">BUG 反馈表</span>
                  <span class="settings-view__link-desc">登记问题与复现步骤</span>
                </span>
                <n-icon :size="16" :component="BugReportRound" class="settings-view__link-icon" />
              </button>
            </li>
            <li>
              <button
                type="button"
                class="settings-view__link-row"
                @click="handleOpenSuggestionFeedback"
              >
                <span class="settings-view__link-copy">
                  <span class="settings-view__link-name">建议收集表</span>
                  <span class="settings-view__link-desc">功能改进与体验优化想法</span>
                </span>
                <n-icon :size="16" :component="LightbulbRound" class="settings-view__link-icon" />
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BUG_FEEDBACK_SHEET_URL, openDiyTutorialVideo, SUGGESTION_FEEDBACK_SHEET_URL } from '@/shared/constants/site'
import { ArrowForwardRound, OndemandVideoRound, VolunteerActivismRound } from '@/shared/icons'
import { useSystemStore } from '@/shared/stores/system'
import { BugReportRound, LightbulbRound } from '@vicons/material'
import { NEl, NIcon } from 'naive-ui'

// ==================== 依赖注入 ====================
const systemStore = useSystemStore()

// ==================== 核心逻辑 ====================
const handleOpenTutorialVideo = () => {
  openDiyTutorialVideo()
}

const handleOpenBugFeedback = () => {
  window.open(BUG_FEEDBACK_SHEET_URL, '_blank', 'noopener,noreferrer')
}

const handleOpenSuggestionFeedback = () => {
  window.open(SUGGESTION_FEEDBACK_SHEET_URL, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.settings-view {
  --page-p: 28px;
  --page-inset: 20px;
  --page-gap: 16px;
  --page-r: 12px;

  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: var(--page-gap);
}

.settings-view > * {
  animation: settings-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.settings-view > *:nth-child(1) { animation-delay: 0ms; }
.settings-view > *:nth-child(2) { animation-delay: 60ms; }

@keyframes settings-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-view > * {
    animation: none;
  }
}

.settings-view__panel {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: var(--page-r);
  background: var(--card-color);
}

.settings-view__inset {
  padding: var(--page-inset);
  border-radius: calc(var(--page-r) - 2px);
  background: color-mix(in srgb, var(--body-color) 48%, var(--card-color));
}

/* ---------- Page head（panel + wash，与下方 plain section 区分） ---------- */
.settings-view__page-head {
  padding: calc(var(--page-p) + 2px) var(--page-p) var(--page-p);
  border-color: color-mix(in srgb, var(--primary-color) 22%, var(--border-color));
  background:
    radial-gradient(
      ellipse 75% 50% at 100% 0%,
      color-mix(in srgb, var(--primary-color) 16%, transparent) 0%,
      transparent 55%
    ),
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--primary-color) 10%, var(--card-color)) 0%,
      var(--card-color) 55%,
      color-mix(in srgb, var(--primary-color-suppl) 14%, var(--card-color)) 100%
    );
}

.settings-view__eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--primary-color);
}

.settings-view__title {
  margin: 0 0 10px;
  font-size: 24px;
  line-height: 1.32;
  font-weight: 700;
  color: var(--text-color-base);
}

.settings-view__lead {
  margin: 0;
  max-width: 40em;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-color-2);
}

/* ---------- Layout ---------- */
.settings-view__cols {
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  gap: var(--page-gap);
  align-items: start;
}

.settings-view__side {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap);
}

.settings-view__section {
  padding: var(--page-p);
  display: flex;
  flex-direction: column;
}

.settings-view__section-head {
  margin-bottom: var(--page-gap);
  padding-bottom: var(--page-gap);
  border-bottom: 1px solid var(--divider-color);
}

.settings-view__section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.35;
  color: var(--text-color-base);
}

.settings-view__section-title::before {
  content: '';
  width: 5px;
  height: 1.1em;
  flex-shrink: 0;
  border-radius: 3px;
  background: linear-gradient(
    180deg,
    var(--primary-color) 0%,
    color-mix(in srgb, var(--primary-color) 55%, transparent) 100%
  );
}

.settings-view__section-desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-color-3);
}

.settings-view__prose {
  margin: 0 0 var(--page-gap);
  font-size: 14px;
  line-height: 1.85;
  color: var(--text-color-2);
}

/* ---------- Form fields ---------- */
.settings-view__field-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: var(--page-gap);
  padding: 6px 16px;
}

.settings-view__field-split {
  height: 1px;
  background: var(--divider-color);
}

.settings-view__field-row,
.settings-view__mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  flex-wrap: wrap;
}

.settings-view__field-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.settings-view__field-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.settings-view__field-hint {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-color-3);
}

.settings-view__select {
  width: min(220px, 100%);
  flex-shrink: 0;
}

.settings-view__mode-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.settings-view__mode-tag {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--primary-color);
  border: 1px solid color-mix(in srgb, var(--primary-color) 32%, var(--border-color));
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary-color) 10%, var(--card-color));
}

.settings-view__mode-tag--dark {
  color: color-mix(in srgb, var(--warning-color, #f0a020) 88%, var(--text-color-base));
  border-color: color-mix(in srgb, var(--warning-color, #f0a020) 35%, var(--border-color));
  background: color-mix(in srgb, var(--warning-color, #f0a020) 12%, var(--card-color));
}

/* ---------- Theme quote ---------- */
.settings-view__quote {
  position: relative;
  margin: 0;
  padding: 28px 44px 32px;
  text-align: center;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(
    155deg,
    color-mix(in srgb, var(--primary-color) 10%, var(--card-color)) 0%,
    var(--card-color) 42%,
    color-mix(in srgb, var(--primary-color-suppl) 55%, var(--card-color)) 100%
  );
  border: 1px solid color-mix(in srgb, var(--primary-color) 24%, var(--border-color));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--primary-color) 14%, transparent),
    0 14px 36px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.settings-view__quote::before,
.settings-view__quote::after {
  position: absolute;
  font-family: var(--site-font-family);
  font-weight: 700;
  line-height: 1;
  color: var(--primary-color);
  pointer-events: none;
  user-select: none;
}

.settings-view__quote::before {
  content: '「';
  top: 12px;
  left: 16px;
  font-size: clamp(2.25rem, 6vw, 3.25rem);
  opacity: 0.18;
}

.settings-view__quote::after {
  content: '」';
  right: 18px;
  bottom: 10px;
  font-size: clamp(2.25rem, 6vw, 3.25rem);
  opacity: 0.12;
}

.settings-view__quote-theme {
  position: relative;
  z-index: 1;
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--primary-color) 68%, var(--text-color-2));
}

.settings-view__quote-text {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  max-width: 100%;
  padding: 0 0.25em;
  font-family: var(--site-font-family);
  font-size: clamp(1rem, 2.4vw, 1.3125rem);
  font-weight: 500;
  line-height: 1.85;
  letter-spacing: 0.04em;
  color: var(--text-color-1);
  text-wrap: balance;
  word-break: keep-all;
}

/* ---------- Action card ---------- */
.settings-view__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
}

.settings-view__action-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: var(--page-inset);
  color: inherit;
  text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--primary-color) 24%, var(--border-color));
  border-radius: calc(var(--page-r) - 2px);
  background: color-mix(in srgb, var(--primary-color) 5%, color-mix(in srgb, var(--body-color) 48%, var(--card-color)));
  transition: border-color 0.2s ease, background 0.2s ease;
}

.settings-view__action-card:hover {
  border-color: color-mix(in srgb, var(--primary-color) 40%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 10%, color-mix(in srgb, var(--body-color) 48%, var(--card-color)));
}

.settings-view__action-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.settings-view__action-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.settings-view__action-desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-color-3);
}

.settings-view__action-arrow {
  flex-shrink: 0;
  color: var(--text-color-3);
  transition: color 0.2s ease;
}

.settings-view__action-card:hover .settings-view__action-arrow {
  color: var(--primary-color);
}

/* ---------- Link list ---------- */
.settings-view__link-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-view__link-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  min-height: 72px;
  padding: var(--page-inset);
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, var(--border-color));
  border-radius: calc(var(--page-r) - 2px);
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: color-mix(in srgb, var(--body-color) 52%, var(--card-color));
  overflow: hidden;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.settings-view__link-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--primary-color) 0%,
    color-mix(in srgb, var(--primary-color) 50%, transparent) 100%
  );
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.settings-view__link-row:hover::before {
  opacity: 1;
}

.settings-view__link-row:hover {
  border-color: color-mix(in srgb, var(--primary-color) 36%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 6%, color-mix(in srgb, var(--body-color) 52%, var(--card-color)));
}

.settings-view__link-row:active {
  opacity: 0.92;
}

.settings-view__link-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.settings-view__link-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.settings-view__link-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-color-3);
}

.settings-view__link-icon {
  flex-shrink: 0;
  color: var(--text-color-3);
  transition: color 0.2s ease;
}

.settings-view__link-row:hover .settings-view__link-icon {
  color: var(--primary-color);
}

/* ---------- Responsive ---------- */
@media (max-width: 860px) {
  .settings-view__cols {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .settings-view {
    --page-p: 20px;
    --page-inset: 16px;
    padding: 16px 12px 36px;
  }

  .settings-view__field-stack {
    padding: 4px 14px;
  }

  .settings-view__field-row,
  .settings-view__mode-row {
    flex-direction: column;
    align-items: stretch;
    padding: 10px 0;
  }

  .settings-view__select {
    width: 100%;
  }

  .settings-view__mode-controls {
    justify-content: flex-start;
  }

  .settings-view__quote {
    padding: 24px 28px 28px;
  }

  .settings-view__quote-text {
    font-size: 1rem;
    letter-spacing: 0.03em;
  }
}
</style>
