<template>
  <div class="home-view">
    <!-- Hero -->
    <header class="home-view__panel home-view__hero">
      <div class="home-view__hero-copy">
        <div class="home-view__hero-deco" aria-hidden="true">
          <svg class="home-view__hero-card home-view__hero-card--back" viewBox="0 0 100 140" fill="none">
            <rect x="1" y="1" width="98" height="138" rx="6" stroke="currentColor" stroke-width="1.2" />
            <rect x="10" y="12" width="80" height="58" rx="3" stroke="currentColor" stroke-width="0.8" opacity="0.45" />
          </svg>
          <svg class="home-view__hero-card home-view__hero-card--front" viewBox="0 0 100 140" fill="none">
            <rect x="1" y="1" width="98" height="138" rx="6" stroke="currentColor" stroke-width="1.2" />
            <rect x="10" y="12" width="80" height="58" rx="3" stroke="currentColor" stroke-width="0.8" opacity="0.45" />
            <line x1="10" y1="82" x2="90" y2="82" stroke="currentColor" stroke-width="0.7" opacity="0.28" />
            <line x1="10" y1="96" x2="62" y2="96" stroke="currentColor" stroke-width="0.7" opacity="0.2" />
          </svg>
        </div>
        <p class="home-view__eyebrow">{{ HOME_TAGLINE }}</p>
        <div class="home-view__brand">
          <img :src="SITE_LOGO_URL" :alt="SITE_NAME" class="home-view__logo" />
          <h1 class="home-view__title">{{ SITE_NAME }}</h1>
        </div>
        <p class="home-view__subtitle">{{ HOME_SUBTITLE }}</p>
        <p class="home-view__lead">
          开源三国杀卡牌 DIY 制图平台。配置武将、技能与插画，实时预览并导出高清卡牌图。
        </p>
        <ul class="home-view__tags" aria-label="平台特点">
          <li>多主题</li>
          <li>实时预览</li>
          <li>印刷出血</li>
          <li>高自由度</li>
        </ul>
      </div>

      <div class="home-view__hero-actions">
        <p class="home-view__actions-label">快捷入口</p>
        <n-button type="primary" size="large" block @click="handleGoDiy">
          <template #icon>
            <n-icon :component="PaletteRound" />
          </template>
          开始制图
        </n-button>
        <div class="home-view__action-links">
          <button type="button" class="home-view__action-link" @click="handleOpenTutorialVideo">
            <n-icon :size="17" :component="OndemandVideoRound" />
            教学视频
          </button>
          <button type="button" class="home-view__action-link" @click="handleOpenRepo">
            <n-icon :size="17" :component="OpenInNewRound" />
            开源仓库
          </button>
          <button type="button" class="home-view__action-link" @click="handleGoSettings">
            系统设置
          </button>
        </div>
      </div>
    </header>

    <!-- 开发者说 | 特性 -->
    <div class="home-view__cols">
      <section class="home-view__panel home-view__section">
        <header class="home-view__section-head">
          <h2 class="home-view__section-title">开发者说</h2>
        </header>
        <p class="home-view__callout">
          <span class="home-view__callout-bar" aria-hidden="true" />
          <span>不再在旧代码上「打补丁」，而是直接推倒重来。</span>
        </p>
        <div class="home-view__prose">
          <p v-for="(paragraph, index) in HOME_DEVELOPER_NOTE" :key="index">{{ paragraph }}</p>
        </div>
      </section>

      <section class="home-view__panel home-view__section">
        <header class="home-view__section-head">
          <h2 class="home-view__section-title">核心重构目标</h2>
          <p class="home-view__section-desc">现代化、高性能制图平台的主要特性规划</p>
        </header>
        <ul class="home-view__item-list">
          <li v-for="item in HOME_FEATURES" :key="item.dimension" class="home-view__item-row">
            <span class="home-view__icon">
              <n-icon :size="18" :component="item.icon" />
            </span>
            <div>
              <h3 class="home-view__item-name">{{ item.dimension }}</h3>
              <p class="home-view__item-desc">{{ item.detail }}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- 贡献者 | 社区 -->
    <div class="home-view__cols">
      <section class="home-view__panel home-view__section">
        <header class="home-view__section-head">
          <h2 class="home-view__section-title">招募开源贡献者</h2>
        </header>
        <p class="home-view__callout home-view__callout--soft">
          <span class="home-view__callout-bar" aria-hidden="true" />
          <span>{{ HOME_CONTRIBUTOR_QUOTE }}</span>
        </p>
        <ul class="home-view__role-grid">
          <li v-for="role in HOME_CONTRIBUTOR_ROLES" :key="role.title">
            <article class="home-view__inset home-view__role">
              <span class="home-view__icon home-view__icon--sm">
                <n-icon :size="17" :component="role.icon" />
              </span>
              <div class="home-view__role-body">
                <h3 class="home-view__role-name">{{ role.title }}</h3>
                <p class="home-view__role-detail">{{ role.detail }}</p>
              </div>
            </article>
          </li>
        </ul>
      </section>

      <section class="home-view__panel home-view__section">
        <header class="home-view__section-head">
          <h2 class="home-view__section-title">社区与支持</h2>
          <p class="home-view__section-desc">交流讨论、问题反馈与自愿捐助</p>
        </header>
        <div class="home-view__community-stack">
          <div class="home-view__community-block">
            <p class="home-view__block-label">用户群</p>
            <p class="home-view__qq-number">{{ HOME_QQ_GROUP_NUMBER }}</p>
            <p class="home-view__block-meta">{{ HOME_QQ_GROUP_NAME }} · 制图交流与问题反馈</p>
            <n-button type="primary" secondary block @click="handleCopyQqGroup">
              <template #icon>
                <n-icon :component="ContentCopyRound" />
              </template>
              复制群号
            </n-button>
          </div>

          <div class="home-view__community-split" aria-hidden="true" />

          <router-link to="/donation" class="home-view__community-block home-view__donate">
            <p class="home-view__block-label">捐助</p>
            <div class="home-view__donate-row">
              <span class="home-view__icon home-view__icon--sm">
                <n-icon :size="18" :component="VolunteerActivismRound" />
              </span>
              <span class="home-view__donate-copy">
                <span class="home-view__donate-label">查看捐助方式</span>
                <span class="home-view__donate-hint">微信 / 支付宝扫码捐助</span>
              </span>
              <n-icon :size="16" :component="ArrowForwardRound" class="home-view__donate-arrow" />
            </div>
          </router-link>
        </div>
      </section>
    </div>

    <!-- 外链 -->
    <section class="home-view__panel home-view__section">
      <header class="home-view__section-head">
        <h2 class="home-view__section-title">访问地址</h2>
      </header>
      <ul class="home-view__link-list">
        <li v-for="link in HOME_EXTERNAL_LINKS" :key="link.href">
          <a
            class="home-view__link-row"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="home-view__link-copy">
              <span class="home-view__link-name">{{ link.label }}</span>
              <span v-if="link.description" class="home-view__link-desc">{{ link.description }}</span>
            </span>
            <n-icon :size="16" :component="OpenInNewRound" class="home-view__link-icon" />
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  HOME_CONTRIBUTOR_QUOTE,
  HOME_CONTRIBUTOR_ROLES,
  HOME_DEVELOPER_NOTE,
  HOME_EXTERNAL_LINKS,
  HOME_FEATURES,
  HOME_QQ_GROUP_NAME,
  HOME_QQ_GROUP_NUMBER,
  HOME_SUBTITLE,
  HOME_TAGLINE,
} from '@/features/home/constants'
import { ArrowForwardRound, OndemandVideoRound, PaletteRound, VolunteerActivismRound } from '@/shared/icons'
import { SITE_LOGO_URL, SITE_NAME } from '@/shared/constants/brand'
import { openDiyTutorialVideo } from '@/shared/constants/site'
import { ContentCopyRound, OpenInNewRound } from '@vicons/material'
import { useMessage } from 'naive-ui'
import useClipboard from 'vue-clipboard3'
import { useRouter } from 'vue-router'

// ==================== 依赖注入 ====================
const router = useRouter()
const message = useMessage()
const { toClipboard } = useClipboard()

// ==================== 核心逻辑 ====================
const handleGoDiy = () => {
  router.push('/diy')
}

const handleGoSettings = () => {
  router.push('/settings')
}

const handleOpenTutorialVideo = () => {
  openDiyTutorialVideo()
}

const handleOpenRepo = () => {
  const repo = HOME_EXTERNAL_LINKS.find((link) => link.label === '开源仓库')
  if (repo) {
    window.open(repo.href, '_blank', 'noopener,noreferrer')
  }
}

const handleCopyQqGroup = async () => {
  try {
    await toClipboard(HOME_QQ_GROUP_NUMBER)
    message.success('用户群号已复制')
  } catch {
    message.warning(`复制失败，请手动添加群号：${HOME_QQ_GROUP_NUMBER}`)
  }
}
</script>

<style scoped>
.home-view {
  --home-p: 28px;
  --home-inset: 20px;
  --home-gap: 16px;
  --home-r: 12px;

  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: var(--home-gap);
}

.home-view > * {
  animation: home-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.home-view > *:nth-child(1) { animation-delay: 0ms; }
.home-view > *:nth-child(2) { animation-delay: 60ms; }
.home-view > *:nth-child(3) { animation-delay: 120ms; }
.home-view > *:nth-child(4) { animation-delay: 180ms; }

@keyframes home-in {
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
  .home-view > * {
    animation: none;
  }
}

.home-view__panel {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: var(--home-r);
  background: var(--card-color);
}

/* 内层：仅底色，不再套边框 */
.home-view__inset {
  padding: var(--home-inset);
  border-radius: calc(var(--home-r) - 2px);
  background: color-mix(in srgb, var(--body-color) 48%, var(--card-color));
  transition: background 0.2s ease;
}

.home-view__role:hover.home-view__inset {
  background: color-mix(in srgb, var(--primary-color) 6%, color-mix(in srgb, var(--body-color) 48%, var(--card-color)));
}

.home-view__icon {
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

.home-view__icon--sm {
  width: 36px;
  height: 36px;
}

.home-view__cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--home-gap);
  align-items: stretch;
}

/* ---------- Hero ---------- */
.home-view__hero {
  display: grid;
  grid-template-columns: 1.12fr minmax(248px, 300px);
  gap: 0;
  padding: 0;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--border-color));
}

.home-view__hero::before {
  display: none;
}

.home-view__hero-copy {
  position: relative;
  padding: calc(var(--home-p) + 4px) var(--home-p);
  min-width: 0;
  background:
    radial-gradient(
      ellipse 75% 60% at 92% 18%,
      color-mix(in srgb, var(--primary-color) 22%, transparent) 0%,
      transparent 55%
    ),
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--primary-color) 16%, var(--card-color)) 0%,
      var(--card-color) 58%
    );
}

.home-view__hero-deco {
  position: absolute;
  top: 50%;
  right: 20px;
  width: 140px;
  height: 120px;
  transform: translateY(-50%);
  pointer-events: none;
  color: color-mix(in srgb, var(--primary-color) 55%, var(--text-color-3));
  opacity: 0.78;
}

.home-view__hero-card {
  position: absolute;
  width: 100px;
}

.home-view__hero-card--back {
  top: 8px;
  right: 36px;
  transform: rotate(-14deg);
  opacity: 0.42;
}

.home-view__hero-card--front {
  top: 0;
  right: 0;
  transform: rotate(9deg);
}

.home-view__hero-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  padding: var(--home-p);
  border-left: 1px solid color-mix(in srgb, var(--primary-color) 28%, var(--divider-color));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--primary-color) 18%, var(--card-color)) 0%,
    color-mix(in srgb, var(--primary-color) 6%, color-mix(in srgb, var(--body-color) 38%, var(--card-color))) 100%
  );
}

.home-view__actions-label {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--primary-color);
}

.home-view__eyebrow {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--primary-color);
}

.home-view__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}

.home-view__logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  object-fit: contain;
  border: 1px solid color-mix(in srgb, var(--primary-color) 24%, var(--border-color));
  background: color-mix(in srgb, var(--body-color) 40%, var(--card-color));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.home-view__title {
  margin: 0;
  font-size: clamp(2.35rem, 4.8vw, 3.15rem);
  line-height: 1.06;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(
    118deg,
    var(--text-color-base) 8%,
    color-mix(in srgb, var(--primary-color) 78%, var(--text-color-base)) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.home-view__subtitle {
  margin: 0 0 14px;
  font-size: 18px;
  line-height: 1.45;
  font-weight: 600;
  color: var(--text-color-1);
}

.home-view__lead {
  margin: 0 0 18px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-color-2);
  max-width: 36em;
}

.home-view__tags {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.home-view__tags li {
  padding: 6px 14px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--primary-color);
  border: 1px solid color-mix(in srgb, var(--primary-color) 38%, var(--border-color));
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary-color) 14%, var(--card-color));
}

.home-view__action-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.home-view__action-link {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-color-2);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: color 0.2s ease, background 0.2s ease;
}

.home-view__action-link:hover {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.home-view__action-link:active {
  opacity: 0.9;
}

/* ---------- Section ---------- */
.home-view__section {
  padding: var(--home-p);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.home-view__section-head {
  margin-bottom: var(--home-gap);
  padding-bottom: var(--home-gap);
  border-bottom: 1px solid var(--divider-color);
}

.home-view__section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.35;
  color: var(--text-color-base);
}

.home-view__section-title::before {
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

.home-view__section-desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-color-3);
}

.home-view__callout {
  display: flex;
  align-items: stretch;
  gap: 14px;
  margin: 0 0 var(--home-gap);
  padding: 14px var(--home-inset);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.65;
  color: var(--text-color-base);
  border-radius: calc(var(--home-r) - 4px);
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, var(--border-color));
  background: color-mix(
    in srgb,
    var(--primary-color) 10%,
    color-mix(in srgb, var(--body-color) 48%, var(--card-color))
  );
}

.home-view__callout-bar {
  width: 4px;
  flex-shrink: 0;
  border-radius: 2px;
  background: linear-gradient(
    180deg,
    var(--primary-color) 0%,
    color-mix(in srgb, var(--primary-color) 45%, transparent) 100%
  );
}

.home-view__callout--soft {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.75;
  color: var(--text-color-2);
}

.home-view__muted-quote {
  margin: 0 0 var(--home-gap);
  font-size: 14px;
  line-height: 1.7;
  font-style: italic;
  color: var(--text-color-2);
}

.home-view__prose p {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.85;
  color: var(--text-color-2);
}

.home-view__prose p:last-child {
  margin-bottom: 0;
}

/* ---------- List rows (features) ---------- */
.home-view__item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.home-view__item-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px var(--home-inset);
  border: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--border-color));
  border-radius: calc(var(--home-r) - 4px);
  background: color-mix(in srgb, var(--body-color) 52%, var(--card-color));
  transition: border-color 0.2s ease, background 0.2s ease;
}

.home-view__item-row:hover {
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 6%, color-mix(in srgb, var(--body-color) 52%, var(--card-color)));
}

.home-view__item-row:first-child {
  padding-top: 14px;
}

.home-view__item-row:last-child {
  padding-bottom: 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--border-color));
}

.home-view__item-name {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.home-view__item-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-color-3);
}

/* ---------- Roles ---------- */
.home-view__role-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--home-gap);
  flex: 1;
}

.home-view__role {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  height: 100%;
}

.home-view__role-body {
  min-width: 0;
}

.home-view__role-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.home-view__role-detail {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-color-3);
}

/* ---------- Community ---------- */
.home-view__community-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  border-radius: calc(var(--home-r) - 2px);
  border: 1px solid color-mix(in srgb, var(--primary-color) 26%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 6%, color-mix(in srgb, var(--body-color) 48%, var(--card-color)));
  overflow: hidden;
}

.home-view__community-block:first-child {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color) 16%, transparent) 0%,
    transparent 62%
  );
}

.home-view__community-block {
  padding: var(--home-inset);
}

.home-view__community-split {
  height: 1px;
  background: var(--divider-color);
}

.home-view__block-label {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-color-3);
}

.home-view__block-meta {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-color-3);
}

.home-view__qq-number {
  margin: 0 0 8px;
  font-size: 36px;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.12;
  font-variant-numeric: tabular-nums;
  color: var(--primary-color);
}

.home-view__donate {
  display: block;
  color: inherit;
  text-decoration: none;
  transition: background 0.2s ease;
}

.home-view__donate:hover {
  background: color-mix(in srgb, var(--primary-color) 8%, color-mix(in srgb, var(--body-color) 48%, var(--card-color)));
}

.home-view__donate-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.home-view__donate-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.home-view__donate-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.home-view__donate-hint {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-color-3);
}

.home-view__donate-arrow {
  flex-shrink: 0;
  color: var(--text-color-3);
  transition: color 0.2s ease;
}

.home-view__donate:hover .home-view__donate-arrow {
  color: var(--primary-color);
}

/* ---------- Links ---------- */
.home-view__link-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--home-gap);
}

.home-view__link-list li {
  min-width: 0;
}

.home-view__link-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  height: 100%;
  min-height: 88px;
  padding: var(--home-inset);
  color: inherit;
  text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--primary-color) 24%, var(--border-color));
  border-radius: calc(var(--home-r) - 2px);
  background: color-mix(in srgb, var(--primary-color) 5%, color-mix(in srgb, var(--body-color) 48%, var(--card-color)));
  overflow: hidden;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.home-view__link-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(
    90deg,
    var(--primary-color) 0%,
    color-mix(in srgb, var(--primary-color) 50%, transparent) 100%
  );
  opacity: 0.72;
  transition: opacity 0.2s ease;
}

.home-view__link-row:hover::before {
  opacity: 1;
}

.home-view__link-row:hover {
  border-color: color-mix(in srgb, var(--primary-color) 40%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 10%, color-mix(in srgb, var(--body-color) 48%, var(--card-color)));
}

.home-view__link-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.home-view__link-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.home-view__link-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-color-3);
}

.home-view__link-icon {
  flex-shrink: 0;
  color: var(--text-color-3);
  transition: color 0.2s ease;
}

.home-view__link-row:hover .home-view__link-icon {
  color: var(--primary-color);
}

/* ---------- Responsive ---------- */
@media (max-width: 860px) {
  .home-view__hero {
    grid-template-columns: 1fr;
  }

  .home-view__hero-deco {
    opacity: 0.5;
    right: 8px;
    width: 100px;
    height: 90px;
  }

  .home-view__hero-card {
    width: 72px;
  }

  .home-view__hero-card--back {
    right: 24px;
  }

  .home-view__hero-actions {
    border-left: none;
    border-top: 1px solid color-mix(in srgb, var(--primary-color) 18%, var(--divider-color));
  }

  .home-view__cols {
    grid-template-columns: 1fr;
  }

  .home-view__link-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .home-view {
    --home-p: 20px;
    --home-inset: 16px;
    padding: 16px 12px 36px;
  }

  .home-view__hero-deco {
    display: none;
  }

  .home-view__role-grid,
  .home-view__community-grid {
    grid-template-columns: 1fr;
  }
}
</style>
