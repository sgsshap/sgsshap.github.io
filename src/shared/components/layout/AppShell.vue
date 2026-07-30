<template>
  <n-el
    tag="div"
    class="app-shell"
    :class="{ 'app-shell--narrow': systemStore.isNarrowScreen }"
    :style="appShellStyle"
  >
    <n-layout
      :has-sider="!systemStore.isNarrowScreen"
      position="absolute"
      class="app-shell__frame"
      style="top: 0; left: 0; right: 0; bottom: 0"
    >
      <n-layout-sider
        v-if="!systemStore.isNarrowScreen"
        v-model:collapsed="isSiderCollapsed"
        collapse-mode="width"
        :collapsed-width="72"
        :width="248"
        show-trigger
        class="app-shell__sider"
      >
        <div class="app-shell__sider-inner">
          <router-link to="/home" class="app-shell__brand-link" :aria-label="SITE_NAME">
            <n-el
              tag="span"
              class="app-shell__brand"
              :class="{ 'app-shell__brand--collapsed': isSiderCollapsed }"
            >
              <img :src="SITE_LOGO_URL" :alt="SITE_NAME" class="app-shell__logo" />
              <span v-show="!isSiderCollapsed" class="app-shell__brand-name">{{ SITE_NAME }}</span>
            </n-el>
          </router-link>

          <p v-show="!isSiderCollapsed" class="app-shell__nav-label">导航</p>

          <n-menu
            :value="displayActiveKey"
            :collapsed="isSiderCollapsed"
            :collapsed-width="72"
            :collapsed-icon-size="22"
            :indent="18"
            :root-indent="14"
            :options="menuOptions"
            class="app-shell__menu"
            :class="{ 'app-shell__menu--collapsed': isSiderCollapsed }"
            @update:value="handleNavSelect"
          />

          <footer class="app-shell__sider-footer">
            <router-link
              v-for="item in APP_SECONDARY_NAV_ITEMS"
              :key="item.key"
              :to="item.path"
              class="app-shell__support-link"
              :class="{
                'app-shell__support-link--active': displayActiveKey === item.key,
                'app-shell__support-link--collapsed': isSiderCollapsed,
              }"
              :title="item.label"
              :aria-current="displayActiveKey === item.key ? 'page' : undefined"
            >
              <span class="app-shell__support-icon" aria-hidden="true">
                <n-icon :size="20" :component="item.icon" />
              </span>
              <span v-show="!isSiderCollapsed" class="app-shell__support-text">
                <span class="app-shell__support-label">{{ item.label }}</span>
                <span class="app-shell__support-desc">自愿捐助，助力运营</span>
              </span>
            </router-link>
          </footer>
        </div>
      </n-layout-sider>

      <n-layout class="app-shell__main">
        <SubPageHeader />
        <n-layout-content
          class="app-shell__content"
          :class="{ 'app-shell__content--sub-page': subPageChromeVisible }"
          :native-scrollbar="false"
        >
          <div class="app-shell__content-stage">
            <router-view v-slot="{ Component, route: childRoute }">
              <keep-alive :include="KEEP_ALIVE_VIEWS">
                <component
                  :is="Component"
                  v-if="Component"
                  :key="childRoute.meta.keepAlive ? childRoute.name : childRoute.path"
                />
              </keep-alive>
            </router-view>
            <Transition name="app-loading-fade">
              <GlobalLoading
                v-if="appLoadingStore.showContentLoading"
                inline
                shell
                :hint="appLoadingStore.hint"
              />
            </Transition>
          </div>
        </n-layout-content>

        <ScrollToTopFab />

        <nav
          v-if="systemStore.isNarrowScreen"
          class="app-shell__tabbar"
          aria-label="主导航"
        >
          <div class="app-shell__tabbar-rail" aria-hidden="true" />
          <div class="app-shell__tabbar-inner" :style="tabbarInnerStyle">
            <div
              class="app-shell__tab-indicator"
              :class="{ 'app-shell__tab-indicator--spring': indicatorSpring }"
              aria-hidden="true"
            >
              <span class="app-shell__tab-indicator-surface" />
            </div>
            <button
              v-for="item in APP_NAV_ITEMS"
              :key="item.key"
              type="button"
              class="app-shell__tab"
              :class="{
                'app-shell__tab--active': displayActiveKey === item.key,
                'app-shell__tab--spring': indicatorSpring && displayActiveKey === item.key,
              }"
              :aria-current="displayActiveKey === item.key ? 'page' : undefined"
              :title="item.label"
              @click="handleNavSelect(item.key)"
            >
              <span class="app-shell__tab-inner">
                <span class="app-shell__tab-icon">
                  <n-icon :size="22" :component="item.icon" />
                </span>
                <span class="app-shell__tab-label">{{ item.label }}</span>
              </span>
            </button>
          </div>
        </nav>
      </n-layout>
    </n-layout>
  </n-el>
</template>

<script setup lang="ts">
import ScrollToTopFab from '@/shared/components/layout/ScrollToTopFab.vue'
import SubPageHeader from '@/shared/components/layout/SubPageHeader.vue'
import GlobalLoading from '@/shared/components/GlobalLoading.vue'
import { useAppShellScrollRestore } from '@/shared/composables/useAppShellScrollRestore'
import { APP_NAV_ITEMS, APP_SECONDARY_NAV_ITEMS, findAppNavItem } from '@/shared/constants/appNav'
import { resolveSubPageChrome } from '@/shared/composables/useAppHistoryBack'
import { SITE_LOGO_URL, SITE_NAME } from '@/shared/constants/brand'
import { useAppLoadingStore } from '@/shared/stores/appLoading'
import { useSystemStore } from '@/shared/stores/system'
import { type MenuOption, NEl, NIcon, NLayout, NLayoutContent, NLayoutSider, NMenu } from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const TAB_INDICATOR_SPRING_MS = 720

/** 与路由 meta.keepAlive 对应，须与页面 defineOptions.name 一致 */
const KEEP_ALIVE_VIEWS = ['DiyCardView']

// ==================== 依赖注入 ====================
const systemStore = useSystemStore()
const appLoadingStore = useAppLoadingStore()
const router = useRouter()
const route = useRoute()

useAppShellScrollRestore(router)

// ==================== 状态定义 ====================
const isSiderCollapsed = ref(false)
const activeKey = computed(() => String(route.name ?? 'home'))
/** 点击 Tab 后立即高亮，不等待懒加载 chunk */
const pendingTabKey = ref<string | null>(null)
const displayActiveKey = computed(() => pendingTabKey.value ?? activeKey.value)
const activeTabIndex = computed(() =>
  Math.max(
    0,
    APP_NAV_ITEMS.findIndex((item) => item.key === displayActiveKey.value),
  ),
)
const indicatorSpring = ref(false)
let indicatorSpringTimer: ReturnType<typeof globalThis.setTimeout> | null = null

const tabbarInnerStyle = computed(() => ({
  '--tab-count': String(APP_NAV_ITEMS.length),
  '--tab-index': String(activeTabIndex.value),
}))

const subPageChromeVisible = computed(() => resolveSubPageChrome(route).visible)

const appShellStyle = computed(() => ({
  '--app-sider-offset': systemStore.isNarrowScreen
    ? '0px'
    : `${isSiderCollapsed.value ? 72 : 248}px`,
}))

watch(activeKey, () => {
  pendingTabKey.value = null
})

watch(
  () => appLoadingStore.showContentLoading,
  (loading) => {
    if (!loading && pendingTabKey.value && route.name !== pendingTabKey.value) {
      pendingTabKey.value = null
    }
  },
)

watch(displayActiveKey, () => {
  indicatorSpring.value = true
  if (indicatorSpringTimer) globalThis.clearTimeout(indicatorSpringTimer)
  indicatorSpringTimer = globalThis.setTimeout(() => {
    indicatorSpring.value = false
    indicatorSpringTimer = null
  }, TAB_INDICATOR_SPRING_MS)
})

const menuOptions = computed<MenuOption[]>(() =>
  APP_NAV_ITEMS.map((item) => ({
    label: item.label,
    key: item.key,
    icon: () => h(NIcon, null, { default: () => h(item.icon) }),
  })),
)

// ==================== 核心逻辑 ====================
/**
 * 切换主导航页面
 */
const handleNavSelect = (key: string) => {
  const target = findAppNavItem(key)
  if (target && route.name !== key) {
    pendingTabKey.value = key
    void router.push(target.path)
  }
}
</script>

<style scoped>
.app-shell {
  --sub-page-header-inner-height: 48px;
  --sub-page-header-block-height: calc(
    var(--safe-area-top, env(safe-area-inset-top, 0px)) + var(--sub-page-header-inner-height)
  );
  min-height: var(--app-viewport-height);
  background: var(--body-color);
}

.app-shell__frame :deep(.n-layout),
.app-shell__frame :deep(.n-layout-scroll-container) {
  background: transparent !important;
}

.app-shell__sider {
  background: var(--body-color);
  z-index: 25;
}

.app-shell__sider::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--border-color) 72%, var(--divider-color));
  pointer-events: none;
}

.app-shell__sider :deep(.n-layout-sider-scroll-container) {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: transparent;
  border: none;
}

.app-shell__sider :deep(.n-layout-toggle-button) {
  z-index: 35;
  right: -14px;
  width: 26px;
  height: 44px;
  border-radius: 0 10px 10px 0;
  border: 1px solid var(--border-color);
  border-left: none;
  background: var(--body-color);
  color: var(--text-color-base);
  box-shadow: none;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.app-shell__sider :deep(.n-layout-toggle-button:hover) {
  color: var(--primary-color);
  border-color: color-mix(in srgb, var(--primary-color) 55%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 10%, var(--body-color));
}

.app-shell__sider-inner {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;
  padding-bottom: 24px;
}

.app-shell__brand-link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.app-shell__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 20px 20px 14px;
  overflow: hidden;
}

.app-shell__brand--collapsed {
  justify-content: center;
  padding: 20px 12px 12px;
}

.app-shell__logo {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  object-fit: contain;
  border-radius: 8px;
}

.app-shell__brand--collapsed .app-shell__logo {
  width: 28px;
  height: 28px;
}

.app-shell__brand-name {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1.2;
  color: var(--text-color-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.app-shell__nav-label {
  margin: 0 22px 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--text-color-3);
  opacity: 0.85;
}

.app-shell__menu {
  flex: 1;
  min-height: 0;
  padding: 0 12px;
  background: transparent;
}

.app-shell__sider-footer {
  flex-shrink: 0;
  margin-top: auto;
  padding: 16px 12px 0;
}

.app-shell__support-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, var(--border-color));
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--primary-color) 7%, var(--card-color)) 0%,
    color-mix(in srgb, var(--body-color) 40%, var(--card-color)) 100%
  );
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.app-shell__support-link:hover {
  border-color: color-mix(in srgb, var(--primary-color) 38%, var(--border-color));
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--primary-color) 12%, var(--card-color)) 0%,
    color-mix(in srgb, var(--primary-color) 4%, var(--card-color)) 100%
  );
  box-shadow: 0 6px 18px color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.app-shell__support-link--active {
  border-color: color-mix(in srgb, var(--primary-color) 45%, var(--border-color));
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--primary-color) 14%, var(--card-color)) 0%,
    color-mix(in srgb, var(--primary-color) 6%, var(--card-color)) 100%
  );
}

.app-shell__support-link--collapsed {
  justify-content: center;
  width: 42px;
  margin: 0 auto;
  padding: 10px;
}

.app-shell__support-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.app-shell__support-link--collapsed .app-shell__support-icon {
  width: 32px;
  height: 32px;
}

.app-shell__support-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.app-shell__support-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-color-base);
}

.app-shell__support-desc {
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-color-3);
}

.app-shell__support-link--active .app-shell__support-label {
  color: var(--primary-color);
}

.app-shell__menu :deep(.n-menu-item) {
  margin-top: 2px;
}

.app-shell__menu :deep(.n-menu-item-content) {
  height: 46px;
  border-radius: 10px;
  font-size: 14px;
  letter-spacing: 0.02em;
  transition: color 0.2s ease;
}

.app-shell__menu :deep(.n-menu-item-content::before) {
  left: 0;
  right: 0;
  border-radius: 10px;
  transition: background 0.2s ease;
}

.app-shell__menu :deep(.n-menu-item-content:hover::before) {
  background: color-mix(in srgb, var(--text-color-3) 6%, transparent) !important;
}

.app-shell__menu :deep(.n-menu-item-content--selected) {
  color: var(--primary-color);
  font-weight: 600;
}

.app-shell__menu :deep(.n-menu-item-content--selected::before) {
  background: color-mix(in srgb, var(--primary-color) 10%, transparent) !important;
}

.app-shell__menu :deep(.n-menu-item-content__icon) {
  color: var(--text-color-3);
  transition: color 0.2s ease;
}

.app-shell__menu :deep(.n-menu-item-content--selected .n-menu-item-content__icon) {
  color: var(--primary-color);
}

.app-shell__menu--collapsed {
  padding: 0;
}

.app-shell__menu--collapsed :deep(.n-menu-item-content) {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.app-shell__menu--collapsed :deep(.n-menu-item-content-header),
.app-shell__menu--collapsed :deep(.n-menu-item-content__arrow) {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

.app-shell__menu--collapsed :deep(.n-menu-item-content__icon) {
  margin: 0 !important;
}

.app-shell__menu--collapsed :deep(.n-menu-item-content::before) {
  left: 50%;
  right: auto;
  transform: translateX(-50%);
  width: 42px;
}

.app-shell__main {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--body-color);
}

.app-shell__content {
  min-height: 100vh;
  min-height: 100dvh;
  background: transparent;
}

.app-shell__content--sub-page .app-shell__content-stage {
  padding-top: var(--sub-page-header-block-height);
}

.app-shell__content :deep(.n-layout-scroll-container) {
  display: flex;
  flex-direction: column;
}

.app-shell__content-stage {
  position: relative;
  min-height: 100%;
  height: 100%;
}

/* 路由懒加载遮罩须铺满主内容区，避免短页面时 loading 仅贴在内容底部 */
.app-shell:not(.app-shell--narrow) .app-shell__content-stage {
  min-height: var(--app-viewport-height);
}

.app-shell--narrow .app-shell__content-stage {
  flex: 1 1 auto;
  min-height: 0;
}

.app-shell--narrow .app-shell__frame {
  min-height: 0;
  height: 100%;
}

.app-shell--narrow .app-shell__main {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.app-shell--narrow .app-shell__content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 勿与 min-height:100vh 叠加，否则 Edge 等浏览器会在 tabbar 上方出现空白条 */
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.app-shell--narrow .app-shell__content :deep(.n-layout-scroll-container) {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 内容与底栏分界：渐变遮罩，滚动时更易感知层次 */
.app-shell--narrow .app-shell__content::after {
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  height: 20px;
  z-index: 90;
  pointer-events: none;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--card-color) 55%, var(--body-color)) 0%,
    transparent 100%
  );
}
</style>
