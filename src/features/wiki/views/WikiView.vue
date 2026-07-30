<template>
  <div
    ref="wikiViewRef"
    class="wiki-view"
    :class="{
      'wiki-view--detail': detailState,
      'wiki-view--chrome-ready': chromeBoundsReady && chromeLayoutMeasured,
    }"
    :style="wikiViewStyle"
  >
    <div v-if="detailState" class="wiki-view__detail-panel">
      <div class="wiki-view__detail-body">
        <LegendWikiDetailPanel
          v-if="detailState.kind === 'legend'"
          :key="detailState.id"
          :legend-id="detailState.id"
          :initial-version-id="legendVersionIdFromRoute"
          readonly
        />
        <ImageWikiDetailPanel
          v-else-if="detailState.kind === 'image'"
          :image-id="detailState.id"
          readonly
        />
        <SkillWikiDetailPanel
          v-else-if="detailState.kind === 'skill'"
          :skill-id="detailState.id"
          readonly
        />
      </div>
    </div>

    <div
      v-if="listShellPreserved"
      v-show="!detailState"
      class="wiki-view__list-shell"
    >
      <div
        ref="chromeRef"
        class="wiki-view__chrome"
        :class="{ 'wiki-view__chrome--ready': chromeBoundsReady && chromeLayoutMeasured }"
        :style="chromeStyle"
      >
        <div class="wiki-view__chrome-inner">
          <header class="wiki-view__header">
            <div class="wiki-view__header-main">
              <div class="wiki-view__header-meta">
                <p class="wiki-view__eyebrow">资料检索</p>
              </div>
              <h1 class="wiki-view__title">三杀百科</h1>
              <div class="wiki-view__header-desc">
                <p class="wiki-view__subtitle">{{ activeTabHint }}</p>
              </div>
            </div>
            <button
              type="button"
              class="wiki-view__help-btn"
              aria-label="使用说明"
              @click="showIntroModal = true"
            >
              <n-icon :size="18"><HelpRound /></n-icon>
            </button>
          </header>

          <n-tabs
            :value="activeType"
            type="segment"
            class="wiki-view__tabs"
            @update:value="handleTypeChange"
          >
            <n-tab-pane
              v-for="tab in WIKI_TYPE_TABS"
              :key="tab.key"
              :name="tab.key"
              :tab="tab.label"
            />
          </n-tabs>
        </div>
      </div>

      <div class="wiki-view__chrome-spacer" aria-hidden="true" />

      <div class="wiki-view__panel">
        <WikiSearchPanel
          ref="searchPanelRef"
          :key="activeType"
          layout="page"
          :type="activeType"
          :keyword="keywordFromRoute"
          @select="openDetail"
          @toolbar-layout-change="measureToolbarLayoutExtents"
        >
          <template v-if="activeType === 'legend'" #toolbar-extra>
            <n-button
              quaternary
              size="medium"
              class="wiki-view__download-btn"
              :loading="downloadingExcel"
              @click.prevent="handleDownloadExcel"
            >
              <template #icon>
                <n-icon><DownloadRound /></n-icon>
              </template>
              <span class="wiki-view__download-text">编号表</span>
            </n-button>
          </template>
        </WikiSearchPanel>
      </div>
    </div>

    <n-modal
      v-model:show="showIntroModal"
      preset="card"
      title="使用必读"
      class="wiki-view__intro-modal"
      :style="{ width: 'min(520px, calc(100vw - 32px))' }"
    >
      <div class="wiki-view__intro">
        <p class="wiki-view__intro-lead">
          百科搜索功能还在<span class="wiki-view__intro-key">测试</span>阶段，数据及功能不完善，仅供参考。
        </p>
        <section v-for="block in WIKI_INTRO_PARAGRAPHS" :key="block.title" class="wiki-view__intro-block">
          <h3 class="wiki-view__intro-heading">{{ block.title }}</h3>
          <ul class="wiki-view__intro-list">
            <li v-for="line in block.lines" :key="line">{{ line }}</li>
          </ul>
        </section>
        <p class="wiki-view__intro-footer">
          欢迎加入 QQ 群：<span class="wiki-view__intro-key">{{ WIKI_QQ_GROUP }}</span>
        </p>
      </div>
      <template #footer>
        <n-button type="primary" block @click="dismissIntro">知道了</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { useWikiScrollChromeCollapse } from '@/features/wiki/composables/useWikiScrollChromeCollapse'
import { formatWikiSubPageTitleFromCard } from '@/shared/utils/wikiSubPageTitle'
import { clearWikiLegendVersionQuery, parseWikiLegendVersionId } from '@/shared/constants/wikiRoute'
import {
  WIKI_INTRO_PARAGRAPHS,
  WIKI_INTRO_STORAGE_KEY,
  WIKI_QQ_GROUP,
  WIKI_TYPE_TABS,
} from '@/features/wiki/constants'
import ImageWikiDetailPanel from '@/shared/components/wiki/ImageWikiDetailPanel.vue'
import LegendWikiDetailPanel from '@/shared/components/wiki/LegendWikiDetailPanel.vue'
import SkillWikiDetailPanel from '@/shared/components/wiki/SkillWikiDetailPanel.vue'
import WikiSearchPanel from '@/shared/components/wiki/WikiSearchPanel.vue'
import { downloadLegendNumberExcel } from '@/shared/api/wiki'
import { findAppShellMainArea, findAppShellScrollContainer, resolveScrollContainerFromElement } from '@/shared/composables/useScrollToTop'
import { DownloadRound, HelpRound } from '@/shared/icons'
import { useSystemStore } from '@/shared/stores/system'
import type { WikiSearchCardItem, WikiSearchType } from '@/shared/types/wiki'
import { useMessage } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'WikiView' })

const message = useMessage()
const route = useRoute()
const router = useRouter()
const systemStore = useSystemStore()

const legendVersionIdFromRoute = computed(() => parseWikiLegendVersionId(route.query))

const activeType = ref<WikiSearchType>('legend')
const showIntroModal = ref(false)
const downloadingExcel = ref(false)
const chromeRef = ref<HTMLElement | null>(null)
const wikiViewRef = ref<HTMLElement | null>(null)
const searchPanelRef = ref<InstanceType<typeof WikiSearchPanel> | null>(null)
const chromeBounds = ref({ left: 0, width: 0 })
const chromeLayoutMeasured = ref(false)
const chromeLayoutVars = ref({
  chromeExpandedHeight: '168px',
  toolbarExpandedHeight: '48px',
  toolbarCollapseDelta: '8px',
})

let chromeLayoutRaf = 0
let isMeasuringChromeLayout = false
let layoutResizeObserver: ResizeObserver | null = null
let boundScrollEl: HTMLElement | null = null
let listScrollTop = 0
let listCollapseProgress = 0
/** 从列表 push 进入详情时为 true，用于返回时走 history.back */
let openedDetailViaPush = false

/** 列表曾展示过则保留 DOM（v-show），返回时恢复滚动与已加载数据 */
const listShellPreserved = ref(false)

const usesWindowScrollFallback = () => systemStore.isNarrowScreen

const resolveWikiScrollContainer = () =>
  resolveScrollContainerFromElement(wikiViewRef.value) ?? findAppShellScrollContainer()

const getWikiScrollTop = () => {
  const containerTop = boundScrollEl?.scrollTop ?? resolveWikiScrollContainer()?.scrollTop ?? 0
  if (!usesWindowScrollFallback()) return containerTop
  const windowTop = document.scrollingElement?.scrollTop ?? window.scrollY ?? 0
  return Math.max(containerTop, windowTop)
}

const setWikiScrollTop = (top: number) => {
  const scrollEl = boundScrollEl ?? resolveWikiScrollContainer()
  if (scrollEl) {
    scrollEl.scrollTop = top
  }
  if (usesWindowScrollFallback()) {
    window.scrollTo(0, top)
  }
}

const bindScrollContainer = () => {
  const nextScrollEl = resolveWikiScrollContainer()
  if (nextScrollEl !== boundScrollEl) {
    boundScrollEl = nextScrollEl
    if (!detailState.value) {
      scrollChromeCollapse.bind(nextScrollEl, usesWindowScrollFallback())
    }
  }
}

const scheduleScrollContainerRetry = () => {
  requestAnimationFrame(bindScrollContainer)
  globalThis.setTimeout(bindScrollContainer, 120)
}

const detailState = ref<{
  kind: WikiSearchType
  id: number
  title: string
} | null>(null)

const scrollChromeCollapse = useWikiScrollChromeCollapse({
  getScrollTop: () => getWikiScrollTop(),
  getRootEl: () => wikiViewRef.value,
  isEnabled: () => !detailState.value,
})

const keywordFromRoute = computed(() => String(route.query.keyword ?? ''))

const activeTabHint = computed(
  () => WIKI_TYPE_TABS.find((tab) => tab.key === activeType.value)?.hint ?? '',
)

const wikiViewStyle = computed(() => ({
  '--wiki-chrome-left': `${chromeBounds.value.left}px`,
  '--wiki-chrome-width': `${chromeBounds.value.width}px`,
  '--wiki-chrome-expanded-height': chromeLayoutVars.value.chromeExpandedHeight,
  '--wiki-sticky-toolbar-expanded-top': chromeLayoutVars.value.chromeExpandedHeight,
  '--wiki-toolbar-expanded-height': chromeLayoutVars.value.toolbarExpandedHeight,
  '--wiki-toolbar-collapse-delta': chromeLayoutVars.value.toolbarCollapseDelta,
}))

const chromeStyle = computed(() => ({
  left: `${chromeBounds.value.left}px`,
  width: `${chromeBounds.value.width}px`,
}))

const chromeBoundsReady = computed(() => chromeBounds.value.width > 0)

const CHROME_EXPANDED_HEIGHT_MIN = 100
const CHROME_LAYOUT_MEASURE_SCROLL_TOP_MAX = 16
/** 搜索栏外层高度随 progress 收缩量（内层控件另有 CSS 缩放） */
const TOOLBAR_COLLAPSE_DELTA_PX = 8

const readExpandedChromeContentHeight = () => {
  if (!chromeRef.value) return 0
  const chromeInner = chromeRef.value.querySelector<HTMLElement>('.wiki-view__chrome-inner')
  return Math.ceil(chromeInner?.getBoundingClientRect().height ?? 0)
}

const measureChromeLayoutExtents = (options?: { force?: boolean }) => {
  if (isMeasuringChromeLayout || detailState.value) return
  if (!chromeRef.value) {
    if (listShellPreserved.value) {
      scheduleChromeLayoutExtents(options)
    }
    return
  }

  const scrollTop = getWikiScrollTop()
  if (!options?.force && scrollTop > CHROME_LAYOUT_MEASURE_SCROLL_TOP_MAX) {
    measureToolbarLayoutExtents()
    return
  }

  isMeasuringChromeLayout = true

  scrollChromeCollapse.runLayoutMeasure(() => {
    const root = wikiViewRef.value

    root?.style.setProperty('--wiki-collapse-progress', '0')
    void root?.offsetHeight

    const measuredExpanded = readExpandedChromeContentHeight()
    if (measuredExpanded < CHROME_EXPANDED_HEIGHT_MIN) {
      scheduleChromeLayoutExtents(options)
      return
    }
    const expandedHeight = measuredExpanded

    root?.style.setProperty('--wiki-collapse-progress', '1')
    void root?.offsetHeight
    const collapsedHeight = readExpandedChromeContentHeight()
    const chromeDelta = Math.max(expandedHeight - collapsedHeight, 0)

    let toolbarExpanded = 48
    if (searchPanelRef.value) {
      root?.style.setProperty('--wiki-collapse-progress', '0')
      void root?.offsetHeight
      toolbarExpanded = searchPanelRef.value.measureToolbarExpandedHeight()
    }

    chromeLayoutVars.value = {
      chromeExpandedHeight: `${expandedHeight}px`,
      toolbarExpandedHeight: `${toolbarExpanded}px`,
      toolbarCollapseDelta: `${TOOLBAR_COLLAPSE_DELTA_PX}px`,
    }
    scrollChromeCollapse.setCollapseDelta(chromeDelta)
    chromeLayoutMeasured.value = true
  })

  isMeasuringChromeLayout = false
  if (!detailState.value) {
    scrollChromeCollapse.syncProgressToScroll(false)
  }
}

const measureToolbarLayoutExtents = () => {
  if (isMeasuringChromeLayout || detailState.value) return
  if (!searchPanelRef.value) {
    requestAnimationFrame(measureToolbarLayoutExtents)
    return
  }

  isMeasuringChromeLayout = true

  scrollChromeCollapse.runLayoutMeasure(() => {
    const root = wikiViewRef.value
    root?.style.setProperty('--wiki-collapse-progress', '0')
    void root?.offsetHeight
    const toolbarExpanded = searchPanelRef.value!.measureToolbarExpandedHeight()

    chromeLayoutVars.value = {
      ...chromeLayoutVars.value,
      toolbarExpandedHeight: `${toolbarExpanded}px`,
      toolbarCollapseDelta: `${TOOLBAR_COLLAPSE_DELTA_PX}px`,
    }
  })

  isMeasuringChromeLayout = false
  if (!detailState.value) {
    scrollChromeCollapse.syncProgressToScroll(false)
  }
}

const scheduleChromeLayoutExtents = (options?: { force?: boolean }) => {
  if (chromeLayoutRaf) return
  chromeLayoutRaf = requestAnimationFrame(() => {
    chromeLayoutRaf = 0
    measureChromeLayoutExtents(options)
  })
}

const refreshSearchChromeLayout = () => {
  if (detailState.value) return
  bindScrollContainer()
  scheduleScrollContainerRetry()
  void nextTick(() => {
    bindScrollContainer()
    updateChromeBounds()
    measureChromeLayoutExtents({ force: getWikiScrollTop() <= CHROME_LAYOUT_MEASURE_SCROLL_TOP_MAX })
    requestAnimationFrame(updateChromeBounds)
  })
}

const rememberListScroll = () => {
  listScrollTop = getWikiScrollTop()
  listCollapseProgress = scrollChromeCollapse.getProgress()
}

const restoreListViewState = () => {
  bindScrollContainer()
  scrollChromeCollapse.bind(boundScrollEl ?? resolveWikiScrollContainer(), usesWindowScrollFallback())
  scrollChromeCollapse.setProgress(listCollapseProgress, false)

  void nextTick(() => {
    void wikiViewRef.value?.offsetHeight
    setWikiScrollTop(listScrollTop)

    requestAnimationFrame(() => {
      setWikiScrollTop(listScrollTop)
      scrollChromeCollapse.syncProgressToScroll(false)
      updateChromeBounds()
    })
  })
}

const updateChromeBounds = () => {
  const mainEl = findAppShellMainArea()
  if (!mainEl) return
  const rect = mainEl.getBoundingClientRect()
  chromeBounds.value = { left: rect.left, width: rect.width }
}

const onWindowResize = () => {
  updateChromeBounds()
  scheduleChromeLayoutExtents({ force: true })
}

const bindScrollChrome = () => {
  bindScrollContainer()
  scheduleScrollContainerRetry()
  scrollChromeCollapse.bind(boundScrollEl ?? resolveWikiScrollContainer(), usesWindowScrollFallback())
  window.addEventListener('resize', onWindowResize, { passive: true })
  updateChromeBounds()

  layoutResizeObserver = new ResizeObserver(() => {
    bindScrollContainer()
    updateChromeBounds()
  })
  const mainEl = findAppShellMainArea()
  if (mainEl) {
    layoutResizeObserver.observe(mainEl)
  }
  const siderEl = document.querySelector('.app-shell__sider')
  if (siderEl instanceof HTMLElement) {
    layoutResizeObserver.observe(siderEl)
  }

  void nextTick(() => {
    measureChromeLayoutExtents({ force: true })
  })
}

const unbindScrollChrome = () => {
  scrollChromeCollapse.unbind()
  boundScrollEl = null
  window.removeEventListener('resize', onWindowResize)
  if (chromeLayoutRaf) {
    cancelAnimationFrame(chromeLayoutRaf)
    chromeLayoutRaf = 0
  }
  layoutResizeObserver?.disconnect()
  layoutResizeObserver = null
}

const parseRouteType = (value: unknown): WikiSearchType | null => {
  if (value === 'legend' || value === 'skill' || value === 'image') {
    return value
  }
  return null
}

const syncFromRoute = () => {
  const typeFromRoute = parseRouteType(route.query.type)
  if (typeFromRoute) {
    activeType.value = typeFromRoute
  }

  const id = Number(route.query.id)
  const type = parseRouteType(route.query.type)
  if (type && Number.isFinite(id) && id > 0) {
    detailState.value = {
      kind: type,
      id,
      title: String(route.query.title ?? '百科详情'),
    }
    return
  }

  detailState.value = null
  openedDetailViaPush = false
}

const openDetail = (item: WikiSearchCardItem) => {
  rememberListScroll()
  const pageTitle = formatWikiSubPageTitleFromCard(item)
  detailState.value = {
    kind: item.type,
    id: item.id,
    title: pageTitle,
  }
  openedDetailViaPush = true
  void router.push({
    query: clearWikiLegendVersionQuery({
      ...route.query,
      type: item.type,
      id: String(item.id),
      title: pageTitle,
    }),
  })
  void nextTick(() => setWikiScrollTop(0))
}

const resetWikiSearchScroll = () => {
  listScrollTop = 0
  listCollapseProgress = 0
  setWikiScrollTop(0)
  scrollChromeCollapse.syncProgressToScroll(false)
}

const refreshChromeLayoutAfterTypeSwitch = () => {
  if (detailState.value) return
  if (!searchPanelRef.value) {
    scheduleChromeLayoutExtents({ force: true })
    return
  }
  measureChromeLayoutExtents({ force: true })
}

const handleTypeChange = (value: string) => {
  const nextType = parseRouteType(value)
  if (!nextType || nextType === activeType.value) return
  activeType.value = nextType
  detailState.value = null
  resetWikiSearchScroll()
  void router.replace({
    query: {
      keyword: route.query.keyword,
      type: nextType,
    },
  })
}

const handleDownloadExcel = async () => {
  if (downloadingExcel.value) return
  downloadingExcel.value = true
  try {
    await downloadLegendNumberExcel()
    message.success('编号表已开始下载')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '下载失败，请稍后重试')
  } finally {
    downloadingExcel.value = false
  }
}

const dismissIntro = () => {
  showIntroModal.value = false
  localStorage.setItem(WIKI_INTRO_STORAGE_KEY, '1')
}

watch(
  () => route.query,
  () => {
    syncFromRoute()
  },
  { immediate: true },
)

onMounted(() => {
  if (!localStorage.getItem(WIKI_INTRO_STORAGE_KEY)) {
    showIntroModal.value = true
  }

  void nextTick(() => {
    bindScrollChrome()
    measureChromeLayoutExtents({ force: true })
  })
})

onUnmounted(unbindScrollChrome)

watch(
  () => detailState.value,
  (detail, previous) => {
    if (!detail) {
      listShellPreserved.value = true
    }

    if (detail) {
      scrollChromeCollapse.reset()
      return
    }

    void nextTick(() => {
      refreshSearchChromeLayout()
      if (previous) {
        void nextTick(restoreListViewState)
      }
    })
  },
  { immediate: true },
)

watch(activeType, (_type, previousType) => {
  if (previousType === undefined) return
  void nextTick(() => {
    void nextTick(refreshChromeLayoutAfterTypeSwitch)
  })
})

watch(
  () => systemStore.isNarrowScreen,
  () => {
    void nextTick(() => {
      bindScrollContainer()
      scheduleChromeLayoutExtents({ force: true })
      if (!detailState.value) {
        scrollChromeCollapse.bind(boundScrollEl ?? resolveWikiScrollContainer(), usesWindowScrollFallback())
      }
    })
  },
)
</script>

<style scoped>
@property --wiki-collapse-progress {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

.wiki-view {
  --page-p: 28px;
  --page-inset: 20px;
  --page-gap: 16px;
  --page-r: 12px;
  --wiki-chrome-expanded-height: 168px;
  --wiki-sticky-toolbar-expanded-top: var(--wiki-chrome-expanded-height);
  --wiki-toolbar-expanded-height: 48px;
  --wiki-toolbar-collapse-delta: 8px;
  --wiki-chrome-collapse-delta: 72px;
  --wiki-collapse-progress: 0;
  --wiki-tab-toolbar-gap: calc(4px * (1 - var(--wiki-collapse-progress)));
  --wiki-chrome-height: calc(
    var(--wiki-chrome-expanded-height) - var(--wiki-collapse-progress) * var(--wiki-chrome-collapse-delta)
  );
  --wiki-sticky-toolbar-top: calc(
    var(--wiki-sticky-toolbar-expanded-top) -
      var(--wiki-collapse-progress) * var(--wiki-chrome-collapse-delta) +
      var(--safe-area-top, env(safe-area-inset-top, 0px))
  );
  --wiki-toolbar-stack-height: calc(
    var(--wiki-toolbar-expanded-height) - var(--wiki-collapse-progress) * var(--wiki-toolbar-collapse-delta)
  );
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 16px 48px;
  box-sizing: border-box;
}

.wiki-view--detail {
  padding-top: var(--page-gap);
}

.wiki-view--chrome-animated {
  transition: --wiki-collapse-progress 420ms cubic-bezier(0.33, 1, 0.68, 1) 72ms;
}

.wiki-view__chrome {
  position: fixed;
  top: 0;
  z-index: 20;
  box-sizing: border-box;
  padding-top: var(--safe-area-top, env(safe-area-inset-top, 0px));
  height: calc(var(--wiki-chrome-height) + var(--safe-area-top, env(safe-area-inset-top, 0px)));
  overflow: hidden;
  background: var(--card-color);
  border-bottom: calc(1px * (1 - var(--wiki-collapse-progress))) solid var(--border-color);
  visibility: hidden;
  pointer-events: none;
}

.wiki-view__chrome--ready {
  visibility: visible;
  pointer-events: auto;
}

.wiki-view__chrome-inner {
  max-width: 1080px;
  margin: 0 auto;
  padding:
    calc(14px - 6px * var(--wiki-collapse-progress))
    16px
    0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: calc(10px - 5px * var(--wiki-collapse-progress));
}

.wiki-view__chrome-spacer {
  flex-shrink: 0;
  height: calc(var(--wiki-chrome-height) + var(--safe-area-top, env(safe-area-inset-top, 0px)));
}

.wiki-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.wiki-view__header-main {
  min-width: 0;
}

.wiki-view__header-meta {
  overflow: hidden;
  max-height: calc(20px * (1 - var(--wiki-collapse-progress)));
  opacity: calc(1 - var(--wiki-collapse-progress) * 1.15);
}

.wiki-view__header-desc {
  overflow: hidden;
  max-height: calc(28px * (1 - var(--wiki-collapse-progress)));
  opacity: calc(1 - var(--wiki-collapse-progress) * 1.1);
}

.wiki-view__eyebrow {
  margin: 0 0 calc(4px * (1 - var(--wiki-collapse-progress)));
  font-size: calc(12px - 1px * var(--wiki-collapse-progress));
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--primary-color);
}

.wiki-view__title {
  margin: 0;
  font-size: calc(28px - 10px * var(--wiki-collapse-progress));
  line-height: 1.28;
  font-weight: 700;
  color: var(--text-color-base);
}

.wiki-view__help-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, var(--border-color));
  border-radius: 10px;
  color: var(--text-color-2);
  background: color-mix(in srgb, var(--primary-color) 6%, var(--card-color));
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.wiki-view__help-btn:hover {
  color: var(--primary-color);
  border-color: color-mix(in srgb, var(--primary-color) 36%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-color));
}

.wiki-view__subtitle {
  margin: calc(6px * (1 - var(--wiki-collapse-progress))) 0 0;
  font-size: calc(13px - 1px * var(--wiki-collapse-progress));
  line-height: 1.5;
  color: var(--text-color-3);
}

.wiki-view__tabs {
  flex-shrink: 0;
  margin-bottom: 0;
}

.wiki-view__tabs :deep(.n-tabs) {
  margin-top: 0;
}

.wiki-view__tabs :deep(.n-tabs-rail) {
  padding: calc(5px - 2px * var(--wiki-collapse-progress));
  gap: calc(4px - 1px * var(--wiki-collapse-progress));
  border-radius: calc(12px - 3px * var(--wiki-collapse-progress));
  min-height: calc(42px - 12px * var(--wiki-collapse-progress));
  background: color-mix(in srgb, var(--body-color) 48%, var(--card-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 16%, var(--border-color));
}

.wiki-view__tabs :deep(.n-tabs-capsule) {
  background: var(--primary-color) !important;
  border-radius: calc(8px - 2px * var(--wiki-collapse-progress)) !important;
}

.wiki-view__tabs :deep(.n-tabs-tab) {
  font-size: calc(15px - 2px * var(--wiki-collapse-progress));
  font-weight: 600;
  color: var(--text-color-2);
  transition: color 0.2s ease;
  padding-block: calc(6px - 2px * var(--wiki-collapse-progress));
}

.wiki-view__tabs :deep(.n-tabs-tab.n-tabs-tab--active) {
  /* 与主色按钮一致：浅色主题 primary 深底用 base 浅字，深色主题 primary 浅底用 base 深字 */
  color: var(--base-color) !important;
  font-weight: 700;
}

.wiki-view__tabs :deep(.n-tabs-tab:not(.n-tabs-tab--active):hover) {
  color: var(--primary-color);
}

.wiki-view--chrome-ready :deep(.wiki-search-panel__toolbar--fixed) {
  visibility: visible;
  pointer-events: auto;
}

.wiki-view__panel {
  display: flex;
  flex-direction: column;
  border: 1px solid color-mix(in srgb, var(--primary-color) 14%, var(--border-color));
  border-radius: var(--page-r);
  background: var(--card-color);
  overflow: visible;
}

.wiki-view__download-btn {
  flex-shrink: 0;
}

.wiki-view__detail-panel {
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, var(--border-color));
  border-radius: var(--page-r);
  background: var(--card-color);
  overflow: hidden;
}

.wiki-view__intro-lead {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-color-2);
}

.wiki-view__intro-block + .wiki-view__intro-block {
  margin-top: 14px;
}

.wiki-view__intro-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-color-base);
}

.wiki-view__intro-heading::before {
  content: '';
  width: 4px;
  height: 1em;
  flex-shrink: 0;
  border-radius: 2px;
  background: linear-gradient(
    180deg,
    var(--primary-color) 0%,
    color-mix(in srgb, var(--primary-color) 45%, transparent) 100%
  );
}

.wiki-view__intro-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-color-2);
}

.wiki-view__intro-footer {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--text-color-2);
}

.wiki-view__intro-key {
  color: var(--warning-color);
  font-weight: 600;
}

@media (max-width: 640px) {
  .wiki-view {
    padding: 0 12px 36px;
  }

  .wiki-view--detail {
    padding-top: 12px;
  }

  .wiki-view__title {
    font-size: calc(24px - 8px * var(--wiki-collapse-progress));
  }

  .wiki-view__tabs :deep(.n-tabs-rail) {
    padding: calc(4px - 1px * var(--wiki-collapse-progress));
    min-height: calc(40px - 10px * var(--wiki-collapse-progress));
  }

  .wiki-view__tabs :deep(.n-tabs-tab) {
    font-size: calc(14px - 2px * var(--wiki-collapse-progress));
  }

  .wiki-view__download-text {
    display: none;
  }
}
</style>
