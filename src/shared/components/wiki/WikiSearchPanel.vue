<script setup lang="ts">
import { getImageWikiPage, getLegendWikiPage, getSkillWikiPage } from '@/shared/api/wiki'
import type { WikiSearchCardItem, WikiSearchTag, WikiSearchType } from '@/shared/types/wiki'
import { getDict, isSuccess } from '@/shared/api'
import type { DictItem } from '@/shared/types/api'
import { getLabel, getNameLabel, getWikiKingdomLabel } from '@/shared/utils/dict'
import { formatWikiSkillDescPreviewHtml } from '@/shared/utils/wikiSkillDesc'
import { FilterListRound, ImageNotSupportedRound, SearchRound } from '@/shared/icons'
import { useMessage } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

defineOptions({ name: 'WikiSearchPanel' })

export type WikiSearchPanelSnapshot = {
  params: {
    keyword: string
    type: WikiSearchType
    searchType: number
    kingdom: string | null
    size: number
    current: number
  }
  resultList: WikiSearchCardItem[]
  isSearched: boolean
  isShowMore: boolean
  showAdvanced: boolean
  scrollTop: number
}

interface Props {
  type: WikiSearchType
  keyword?: string
  /** drawer：制图抽屉（内部滚动）；page：百科页（跟随 AppShell 外层滚动） */
  layout?: 'drawer' | 'page'
  /** 制图抽屉：从详情返回时注入，避免 remount 后重新搜索 */
  restoredSnapshot?: WikiSearchPanelSnapshot | null
}

const props = withDefaults(defineProps<Props>(), {
  keyword: '',
  layout: 'drawer',
  restoredSnapshot: null,
})

const emit = defineEmits<{
  select: [item: WikiSearchCardItem]
  'toolbar-layout-change': []
}>()

const message = useMessage()

const params = ref({
  keyword: props.keyword,
  type: props.type,
  searchType: 0,
  kingdom: null as string | null,
  size: 12,
  current: 1,
})

const resultList = ref<WikiSearchCardItem[]>([])
const isSearched = ref(false)
const isShowMore = ref(false)

const kingdomOptions = ref<DictItem[]>([])
const qualityOptions = ref<DictItem[]>([])
const serverOptions = ref<DictItem[]>([])
const gameModeOptions = ref<DictItem[]>([])
const packageOptions = ref<DictItem[]>([])
const showAdvanced = ref(false)

let isApplyingSnapshot = false

const takeSnapshot = (): WikiSearchPanelSnapshot => ({
  params: { ...params.value },
  resultList: [...resultList.value],
  isSearched: isSearched.value,
  isShowMore: isShowMore.value,
  showAdvanced: showAdvanced.value,
  scrollTop: scrollBody.value?.scrollTop ?? 0,
})

const applySnapshot = (snapshot: WikiSearchPanelSnapshot) => {
  isApplyingSnapshot = true
  params.value = { ...snapshot.params }
  resultList.value = [...snapshot.resultList]
  isSearched.value = snapshot.isSearched
  isShowMore.value = snapshot.isShowMore
  showAdvanced.value = snapshot.showAdvanced
  void nextTick(() => {
    if (scrollBody.value) {
      scrollBody.value.scrollTop = snapshot.scrollTop
    }
    if (isShowMore.value) {
      void bindInfiniteScroll()
    }
    isApplyingSnapshot = false
  })
}

const tryRestoreFromSnapshotProp = () => {
  if (props.layout !== 'drawer' || !props.restoredSnapshot) {
    return false
  }
  applySnapshot(props.restoredSnapshot)
  return true
}

const isPageLayout = computed(() => props.layout === 'page')
const isInitialSearching = ref(false)
const isLoadingMore = ref(false)

const buildImageCardDesc = (item: Record<string, unknown>) => {
  const legends = String(item.legends ?? '').trim()
  return legends ? `武将：${legends}` : ''
}

const buildImageCardRemark = (item: Record<string, unknown>) =>
  String(item.remark ?? '').trim()

const wikiTypeLabel = (type: WikiSearchType) => {
  if (type === 'legend') return '武将'
  if (type === 'image') return '原画'
  return '技能'
}

const scrollBody = ref<HTMLElement | null>(null)
const toolbarRef = ref<HTMLElement | null>(null)
const loadSentinel = ref<HTMLElement | null>(null)
const toolbarHeight = ref(0)
let infiniteScrollObserver: IntersectionObserver | null = null
let toolbarResizeObserver: ResizeObserver | null = null

const measureToolbarHeight = (): number => {
  const height = toolbarRef.value?.getBoundingClientRect().height ?? 0
  toolbarHeight.value = height
  return height
}

/** 展开态工具栏内容高度（不受外层 fixed height 压缩影响） */
const measureToolbarExpandedHeight = (): number => {
  const inner = toolbarRef.value?.querySelector<HTMLElement>('.wiki-search-panel__toolbar-inner')
  const height = Math.ceil(inner?.getBoundingClientRect().height ?? 0)
  if (height > 0) {
    toolbarHeight.value = height
    return height
  }
  return measureToolbarHeight()
}

const readToolbarHeight = (): number =>
  toolbarRef.value?.getBoundingClientRect().height ?? 0

const useMeasuredToolbarSpacer = computed(
  () => isPageLayout.value && props.type === 'image' && showAdvanced.value,
)

const searchPlaceholder = computed(() => {
  if (props.type === 'legend') {
    return '武将名、武将编号'
  }
  if (props.type === 'skill') {
    return '技能名、描述'
  }
  return '原画名、画师名、武将名'
})

const imageFilterOptions = [
  { label: '全部', value: 0 },
  { label: '仅经典', value: 1 },
  { label: '仅官方', value: 2 },
]

const kingdomSelectOptions = computed(() =>
  kingdomOptions.value.map((item) => ({
    label: item.label,
    value: item.value,
  })),
)

const hasActiveFilters = computed(
  () => props.type === 'image' && (params.value.searchType !== 0 || Boolean(params.value.kingdom)),
)

const toggleAdvanced = () => {
  showAdvanced.value = !showAdvanced.value
}

const buildSkillTags = (item: Record<string, unknown>): WikiSearchTag[] => {
  const tags: WikiSearchTag[] = []
  if (item.gameMode) {
    tags.push({ value: getLabel(String(item.gameMode), gameModeOptions.value) })
  }
  if (item.server) {
    tags.push({ value: getLabel(String(item.server), serverOptions.value), type: 'success' })
  }
  if (item.skillPackage) {
    tags.push({ value: getLabel(String(item.skillPackage), packageOptions.value), type: 'warning' })
  }
  if (Array.isArray(item.tags)) {
    for (const tag of item.tags) {
      const row = tag as Record<string, unknown>
      if (row.name) {
        tags.push({ value: String(row.name), type: 'info' })
      }
    }
  }
  return tags
}

const loadDicts = async () => {
  const [kingdomRes, qualityRes, serverRes, gameModeRes, packageRes] = await Promise.all([
    getDict('kingdom'),
    getDict('image_quality'),
    getDict('server'),
    getDict('game_mode'),
    getDict('skill_package'),
  ])
  if (isSuccess(kingdomRes)) {
    kingdomOptions.value = kingdomRes.data.itemList ?? []
  }
  if (isSuccess(qualityRes)) {
    qualityOptions.value = qualityRes.data.itemList ?? []
  }
  if (isSuccess(serverRes)) {
    serverOptions.value = serverRes.data.itemList ?? []
  }
  if (isSuccess(gameModeRes)) {
    gameModeOptions.value = gameModeRes.data.itemList ?? []
  }
  if (isSuccess(packageRes)) {
    packageOptions.value = packageRes.data.itemList ?? []
  }
}

const createSkeletonRows = (count: number): WikiSearchCardItem[] =>
  Array.from({ length: count }, () => ({
    id: -1,
    name: '',
    type: props.type,
    img: '',
    desc: '',
    loading: true,
  }))

const searchWiki = async (isInit = true) => {
  if (isInit) {
    if (isInitialSearching.value) return
    isInitialSearching.value = true
  } else {
    if (isLoadingMore.value || isInitialSearching.value) return
    isLoadingMore.value = true
  }

  if (isInit) {
    params.value.current = 1
    resultList.value = []
    isSearched.value = true
    if (!isPageLayout.value) {
      await nextTick()
      scrollBody.value?.scrollTo({ top: 0 })
    }
  } else {
    params.value.current += 1
  }

  const placeholders = createSkeletonRows(params.value.size)
  const startIndex = resultList.value.length
  resultList.value.push(...placeholders)

  try {
    const res =
      props.type === 'legend'
        ? await getLegendWikiPage(params.value)
        : props.type === 'skill'
          ? await getSkillWikiPage(params.value)
          : await getImageWikiPage(params.value)

    if (!isSuccess(res)) {
      throw new Error(res.message || '搜索失败')
    }

    const records = res.data.records ?? []
    isShowMore.value = res.data.total > params.value.current * params.value.size

    for (let i = 0; i < placeholders.length; i++) {
      const targetIndex = startIndex + i
      if (i >= records.length) {
        resultList.value.splice(targetIndex)
        break
      }
      const item = records[i] as Record<string, unknown>
      let mapped: WikiSearchCardItem
      if (props.type === 'legend') {
        mapped = {
          id: Number(item.id),
          type: 'legend',
          name: `【${getWikiKingdomLabel(String(item.kingdom ?? ''), kingdomOptions.value)}】${getNameLabel(String(item.name ?? ''), item.name2 ? String(item.name2) : undefined, item.name3 ? String(item.name3) : undefined)}`,
          img: '',
          number: String(item.number ?? '—'),
          desc: item.intro ? String(item.intro) : '暂无简介',
          loading: false,
        }
      } else if (props.type === 'skill') {
        const description = item.description ? String(item.description) : ''
        mapped = {
          id: Number(item.id),
          type: 'skill',
          name: String(item.name ?? '无'),
          img: '',
          desc: formatWikiSkillDescPreviewHtml(description) || '暂无描述',
          tags: buildSkillTags(item),
          loading: false,
        }
      } else {
        mapped = {
          id: Number(item.id),
          type: 'image',
          name: String(item.title ?? '无'),
          legends: String(item.legends ?? '').trim() || undefined,
          painter: String(item.painter ?? ''),
          quality: getLabel(String(item.quality ?? ''), qualityOptions.value),
          img: String(item.url ?? ''),
          desc: buildImageCardDesc(item),
          remark: buildImageCardRemark(item),
          loading: false,
        }
      }
      resultList.value[targetIndex] = mapped
    }
  } catch (error) {
    if (!isInit) {
      params.value.current = Math.max(1, params.value.current - 1)
    }
    resultList.value.splice(startIndex, placeholders.length)
    message.error(error instanceof Error ? error.message : '搜索失败，请稍后重试')
  } finally {
    if (isInit) {
      isInitialSearching.value = false
    } else {
      isLoadingMore.value = false
    }
  }
}

watch(
  () => [props.keyword, props.type] as const,
  ([keyword, type]) => {
    if (isApplyingSnapshot) return
    if (tryRestoreFromSnapshotProp()) return

    params.value.keyword = keyword
    params.value.type = type
    if (type !== 'image') {
      params.value.kingdom = null
      params.value.searchType = 0
      showAdvanced.value = false
    }
    if (props.layout === 'page') {
      if (keyword || type) {
        void searchWiki(true)
      }
      return
    }

    if (!props.restoredSnapshot) {
      void searchWiki(true)
    }
  },
  { immediate: true },
)

watch(
  () => props.restoredSnapshot,
  (snapshot) => {
    if (isApplyingSnapshot || props.layout !== 'drawer' || !snapshot) return
    applySnapshot(snapshot)
  },
)

watch(
  () => [params.value.searchType, params.value.kingdom] as const,
  () => {
    if (isApplyingSnapshot) return
    if (props.type === 'image') {
      void searchWiki(true)
    }
  },
)

const disconnectInfiniteScroll = () => {
  infiniteScrollObserver?.disconnect()
  infiniteScrollObserver = null
}

const getScrollRoot = () => (isPageLayout.value ? null : scrollBody.value)

const isBusy = computed(() => isInitialSearching.value || isLoadingMore.value)

const bindInfiniteScroll = async () => {
  await nextTick()
  disconnectInfiniteScroll()

  const sentinel = loadSentinel.value
  if (!sentinel || !isShowMore.value) {
    return
  }

  const scrollRoot = getScrollRoot()
  if (!isPageLayout.value && !scrollRoot) {
    return
  }

  infiniteScrollObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && isShowMore.value && !isBusy.value) {
        void searchWiki(false)
      }
    },
    { root: scrollRoot, rootMargin: '160px', threshold: 0 },
  )
  infiniteScrollObserver.observe(sentinel)
}

const LOAD_MORE_THRESHOLD_PX = 120

const handleScroll = () => {
  if (isPageLayout.value) return
  const el = scrollBody.value
  if (!el || !isShowMore.value || isBusy.value) return
  const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distanceToBottom <= LOAD_MORE_THRESHOLD_PX) {
    void searchWiki(false)
  }
}

const handleLoadMoreClick = () => {
  if (isShowMore.value && !isBusy.value) {
    void searchWiki(false)
  }
}

watch(isShowMore, (show) => {
  if (show) {
    void bindInfiniteScroll()
  } else {
    disconnectInfiniteScroll()
  }
})

watch(
  () => resultList.value.length,
  () => {
    if (isShowMore.value) {
      void bindInfiniteScroll()
    }
  },
)

watch(
  () => isBusy.value,
  (busy, wasBusy) => {
    if (wasBusy && !busy && isShowMore.value) {
      void bindInfiniteScroll()
    }
  },
)

watch(
  () => [showAdvanced.value, props.type] as const,
  () => {
    if (!isPageLayout.value) return
    void nextTick(() => {
      measureToolbarHeight()
      emit('toolbar-layout-change')
    })
  },
)

const bindToolbarResizeObserver = () => {
  toolbarResizeObserver?.disconnect()
  toolbarResizeObserver = null
  if (!useMeasuredToolbarSpacer.value || !toolbarRef.value) return
  toolbarResizeObserver = new ResizeObserver(() => {
    measureToolbarHeight()
    emit('toolbar-layout-change')
  })
  toolbarResizeObserver.observe(toolbarRef.value)
}

watch(useMeasuredToolbarSpacer, () => {
  void nextTick(bindToolbarResizeObserver)
})

onMounted(() => {
  void loadDicts()
  void bindInfiniteScroll()
  void nextTick(bindToolbarResizeObserver)
})

onUnmounted(() => {
  disconnectInfiniteScroll()
  toolbarResizeObserver?.disconnect()
  toolbarResizeObserver = null
})

defineExpose({
  searchWiki,
  measureToolbarHeight,
  measureToolbarExpandedHeight,
  readToolbarHeight,
  toolbarHeight,
  takeSnapshot,
  applySnapshot,
  getListScrollTop: () => scrollBody.value?.scrollTop ?? 0,
  setListScrollTop: (top: number) => {
    if (scrollBody.value) {
      scrollBody.value.scrollTop = top
    }
  },
  resumeListView: (top: number) => {
    if (scrollBody.value) {
      scrollBody.value.scrollTop = top
    }
    if (isShowMore.value) {
      void bindInfiniteScroll()
    }
  },
})
</script>

<template>
  <div
    class="wiki-search-panel"
    :class="{ 'wiki-search-panel--page': layout === 'page' }"
  >
    <div
      ref="toolbarRef"
      class="wiki-search-panel__toolbar"
      :class="{
        'wiki-search-panel__toolbar--fixed': layout === 'page',
        'wiki-search-panel__toolbar--advanced-open':
          layout === 'page' && type === 'image' && showAdvanced,
      }"
    >
      <div class="wiki-search-panel__toolbar-inner">
        <form class="wiki-search-panel__search-form" @submit.prevent="searchWiki(true)">
          <div class="wiki-search-panel__main-row">
            <n-input
              v-model:value="params.keyword"
              class="wiki-search-panel__input"
              size="medium"
              clearable
              :placeholder="searchPlaceholder"
              @keyup.enter="searchWiki(true)"
            />
            <n-button
              v-if="type === 'image'"
              quaternary
              size="medium"
              class="wiki-search-panel__advanced-toggle"
              :class="{ 'wiki-search-panel__advanced-toggle--active': hasActiveFilters }"
              @click.prevent="toggleAdvanced"
            >
              <template #icon>
                <n-icon><FilterListRound /></n-icon>
              </template>
              <span class="wiki-search-panel__advanced-text">筛选</span>
            </n-button>
            <slot name="toolbar-extra" />
            <n-button
              type="primary"
              size="medium"
              class="wiki-search-panel__search-btn"
              :loading="isInitialSearching"
              attr-type="submit"
            >
              <template #icon>
                <n-icon><SearchRound /></n-icon>
              </template>
              <span class="wiki-search-panel__search-text">搜索</span>
            </n-button>
          </div>

          <div
            v-if="type === 'image' && showAdvanced"
            class="wiki-search-panel__advanced"
          >
            <div class="wiki-search-panel__advanced-grid">
              <label class="wiki-search-panel__field">
                <span class="wiki-search-panel__field-label">原画范围</span>
                <n-select
                  v-model:value="params.searchType"
                  :options="imageFilterOptions"
                  size="small"
                />
              </label>
              <label class="wiki-search-panel__field">
                <span class="wiki-search-panel__field-label">武将势力</span>
                <n-select
                  v-model:value="params.kingdom"
                  :options="kingdomSelectOptions"
                  size="small"
                  clearable
                  placeholder="全部势力"
                />
              </label>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="layout === 'page'"
      class="wiki-search-panel__toolbar-spacer"
      :class="{ 'wiki-search-panel__toolbar-spacer--measured': useMeasuredToolbarSpacer }"
      :style="useMeasuredToolbarSpacer ? { height: `${toolbarHeight}px` } : undefined"
      aria-hidden="true"
    />

    <div
      ref="scrollBody"
      class="wiki-search-panel__scroll"
      :class="{ 'wiki-search-panel__scroll--page': layout === 'page' }"
      @scroll.passive="handleScroll"
    >
      <n-empty
        v-if="isSearched && resultList.length === 0 && !isBusy"
        class="wiki-search-panel__empty"
        description="暂无搜索结果"
      />

      <n-el tag="div" v-else class="wiki-search-panel__grid">
        <button
          v-for="item in resultList"
          :key="`${item.type}-${item.id}-${item.loading}`"
          type="button"
          class="wiki-search-panel__card"
          :class="{ 'wiki-search-panel__card--image': item.type === 'image' }"
          :disabled="item.loading || item.id < 0"
          @click="emit('select', item)"
        >
          <n-skeleton v-if="item.loading" height="100%" width="100%" :sharp="false" />
          <template v-else>
            <div v-if="item.type === 'image'" class="wiki-search-panel__thumb">
              <img v-if="item.img" :src="item.img" :alt="item.name" loading="lazy" />
              <n-icon v-else :size="28"><ImageNotSupportedRound /></n-icon>
            </div>
            <div class="wiki-search-panel__body">
              <div class="diy-drawer-list-title">{{ item.name }}</div>
              <div
                v-if="item.type === 'legend' && item.number"
                class="wiki-search-panel__number"
              >
                <span class="wiki-search-panel__number-label">编号</span>
                <span class="wiki-search-panel__number-value">{{ item.number }}</span>
              </div>
              <div v-if="item.painter" class="wiki-search-panel__meta">{{ item.painter }}</div>
              <div
                v-if="item.type === 'image' && item.desc"
                class="wiki-search-panel__desc"
              >
                {{ item.desc }}
              </div>
              <div
                v-if="item.type === 'image' && item.remark"
                class="wiki-search-panel__remark"
              >
                {{ item.remark }}
              </div>
              <div
                v-else-if="item.type === 'skill'"
                class="wiki-search-panel__desc wiki-skill-desc"
                v-html="item.desc"
              />
              <div v-else-if="item.type !== 'image'" class="wiki-search-panel__desc">
                {{ item.desc }}
              </div>
              <div class="wiki-search-panel__tags">
                <n-tag
                  v-for="tag in item.tags"
                  :key="tag.value"
                  size="small"
                  :type="tag.type"
                  :bordered="false"
                >
                  {{ tag.value }}
                </n-tag>
                <n-tag v-if="item.quality" size="small" :bordered="false">{{ item.quality }}</n-tag>
                <n-tag size="small" type="info" :bordered="false">
                  {{ wikiTypeLabel(item.type) }}
                </n-tag>
              </div>
            </div>
          </template>
        </button>
      </n-el>

      <div
        v-if="isShowMore || isLoadingMore"
        ref="loadSentinel"
        class="wiki-search-panel__sentinel"
        :class="{ 'wiki-search-panel__sentinel--interactive': isShowMore && !isBusy }"
        role="status"
        :aria-label="isLoadingMore ? '正在加载更多' : '继续下滑加载更多'"
        @click="handleLoadMoreClick"
      >
        <n-spin v-if="isLoadingMore" size="small" />
        <span v-else-if="isShowMore" class="wiki-search-panel__sentinel-text">继续下滑加载更多</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wiki-search-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
}

.wiki-search-panel__toolbar {
  flex-shrink: 0;
  z-index: 1;
  padding: var(--diy-drawer-toolbar-padding-top) 0 0;
}

.wiki-search-panel__search-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: var(--diy-drawer-toolbar-padding-bottom);
  border-bottom: 1px solid var(--border-color);
}

.wiki-search-panel__main-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.wiki-search-panel__input {
  flex: 1;
  min-width: 0;
}

.wiki-search-panel__advanced-toggle {
  flex-shrink: 0;
  position: relative;
}

.wiki-search-panel__advanced-toggle--active::after {
  content: '';
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary-color);
}

.wiki-search-panel__search-btn {
  flex-shrink: 0;
}

.wiki-search-panel__advanced {
  padding-top: 2px;
}

.wiki-search-panel__advanced-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 6px 10px;
}

.wiki-search-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.wiki-search-panel__field-label {
  font-size: 12px;
  line-height: 1.2;
  color: var(--text-color-3);
}

.wiki-search-panel__scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: var(--diy-drawer-scroll-padding-y) 0 var(--diy-drawer-scroll-padding-bottom);
  background: var(--body-color);
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.wiki-search-panel__empty {
  padding: 32px 0;
}

.wiki-search-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 12px;
}

.wiki-search-panel__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--border-color));
  border-radius: 10px;
  background: color-mix(in srgb, var(--body-color) 52%, var(--card-color));
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.wiki-search-panel__card:hover {
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--border-color));
  background: color-mix(
    in srgb,
    var(--primary-color) 5%,
    color-mix(in srgb, var(--body-color) 52%, var(--card-color))
  );
}

.wiki-search-panel__card--image {
  min-height: 280px;
}

.wiki-search-panel__thumb {
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  overflow: hidden;
  background: var(--body-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wiki-search-panel__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wiki-search-panel__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.wiki-search-panel__number {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 32%, var(--border-color));
}

.wiki-search-panel__number-label {
  font-size: 11px;
  color: var(--text-color-3);
}

.wiki-search-panel__number-value {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--site-font-family);
  color: var(--primary-color);
  letter-spacing: 0.03em;
}

.wiki-search-panel__meta {
  font-size: 12px;
  color: var(--text-color-3);
}

.wiki-search-panel__desc {
  font-size: 12px;
  color: var(--text-color-2);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.wiki-search-panel__remark {
  font-size: 12px;
  color: var(--text-color-3);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.wiki-search-panel__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.wiki-search-panel--page {
  flex: none;
  min-height: auto;
}

.wiki-search-panel--page .wiki-search-panel__toolbar {
  padding: 0;
}

.wiki-search-panel--page .wiki-search-panel__toolbar--fixed {
  position: fixed;
  top: var(--wiki-sticky-toolbar-top, 0px);
  left: var(--wiki-chrome-left, -9999px);
  width: var(--wiki-chrome-width, 0px);
  z-index: 21;
  height: var(--wiki-toolbar-stack-height, 48px);
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: var(--card-color);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--border-color) calc(100% - 40% * var(--wiki-collapse-progress, 0)), transparent);
  transform: translateY(calc(-2px * var(--wiki-collapse-progress, 0)));
  visibility: hidden;
  pointer-events: none;
}

.wiki-search-panel--page .wiki-search-panel__toolbar--fixed.wiki-search-panel__toolbar--advanced-open {
  height: auto;
  min-height: var(--wiki-toolbar-expanded-height, 48px);
  overflow: visible;
  transform: none;
}

.wiki-search-panel--page .wiki-search-panel__toolbar-inner {
  --wiki-search-control-height: calc(36px - 4px * var(--wiki-collapse-progress, 0));
  max-width: 1080px;
  margin: 0 auto;
  padding:
    var(--wiki-tab-toolbar-gap, 0px)
    16px
    calc(6px - 2px * var(--wiki-collapse-progress, 0));
  box-sizing: border-box;
  display: flex;
  align-items: center;
}

.wiki-search-panel--page .wiki-search-panel__toolbar--advanced-open .wiki-search-panel__toolbar-inner {
  --wiki-search-control-height: 36px;
  align-items: stretch;
  padding:
    4px
    16px
    6px;
}

.wiki-search-panel--page .wiki-search-panel__search-form {
  width: 100%;
  gap: 8px;
}

.wiki-search-panel--page .wiki-search-panel__main-row {
  gap: 8px;
  align-items: center;
  min-height: var(--wiki-search-control-height);
}

.wiki-search-panel--page .wiki-search-panel__input :deep(.n-input) {
  --n-height: var(--wiki-search-control-height);
}

.wiki-search-panel--page .wiki-search-panel__input :deep(.n-input-wrapper) {
  box-sizing: border-box;
  height: var(--wiki-search-control-height);
  min-height: var(--wiki-search-control-height);
}

.wiki-search-panel--page .wiki-search-panel__advanced-toggle {
  min-width: var(--wiki-search-control-height);
  justify-content: center;
}

.wiki-search-panel--page .wiki-search-panel__search-btn,
.wiki-search-panel--page .wiki-search-panel__advanced-toggle {
  --n-height: var(--wiki-search-control-height);
  height: var(--wiki-search-control-height) !important;
  min-height: var(--wiki-search-control-height) !important;
  max-height: var(--wiki-search-control-height);
}

.wiki-search-panel--page .wiki-search-panel__toolbar-inner :deep(.wiki-view__download-btn) {
  --n-height: var(--wiki-search-control-height);
  height: var(--wiki-search-control-height) !important;
  min-height: var(--wiki-search-control-height) !important;
  max-height: var(--wiki-search-control-height);
}

.wiki-search-panel--page .wiki-search-panel__toolbar--fixed .wiki-search-panel__search-form {
  border-bottom: none;
  padding-bottom: 0;
}

.wiki-search-panel--page .wiki-search-panel__toolbar-spacer {
  flex-shrink: 0;
}

.wiki-search-panel--page .wiki-search-panel__toolbar-spacer:not(.wiki-search-panel__toolbar-spacer--measured) {
  height: var(--wiki-toolbar-stack-height, 48px);
}

.wiki-search-panel--page .wiki-search-panel__scroll--page {
  flex: none;
  min-height: auto;
  overflow: visible;
  padding: var(--page-inset, 20px) 16px var(--page-inset, 20px);
}

.wiki-search-panel__sentinel-text {
  font-size: 12px;
  color: var(--text-color-3);
}

.wiki-search-panel__sentinel--interactive {
  cursor: pointer;
}

.wiki-search-panel__sentinel--interactive:hover .wiki-search-panel__sentinel-text {
  color: var(--primary-color);
}

.wiki-search-panel__sentinel {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 40px;
  padding: 8px 0 4px;
}

@media (max-width: 640px) {
  .wiki-search-panel__main-row {
    gap: 4px;
  }

  .wiki-search-panel__search-text,
  .wiki-search-panel__advanced-text {
    display: none;
  }

  .wiki-search-panel__grid {
    grid-template-columns: 1fr;
  }

  .wiki-search-panel__card--image {
    min-height: 0;
  }
}
</style>
