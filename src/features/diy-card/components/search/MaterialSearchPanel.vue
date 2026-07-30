<script setup lang="ts">
import { getMaterialPage } from '@/features/diy-card/api'
import type { MaterialSearchCardItem } from '@/features/diy-card/types/search'
import { getDict, isSuccess } from '@/shared/api'
import type { DictItem } from '@/shared/types/api'
import { getLabel } from '@/shared/utils/dict'
import { ImageNotSupportedRound, SearchRound } from '@/shared/icons'
import { useMessage } from 'naive-ui'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

defineOptions({ name: 'MaterialSearchPanel' })

export type MaterialSearchPanelSnapshot = {
  params: {
    keyword: string
    type: string
    size: number
    current: number
  }
  resultList: MaterialSearchCardItem[]
  isSearched: boolean
  isShowMore: boolean
  scrollTop: number
}

interface Props {
  type?: string
  keyword?: string
  /** 制图抽屉：从详情返回时注入，避免 remount 后重新搜索 */
  restoredSnapshot?: MaterialSearchPanelSnapshot | null
}

const props = withDefaults(defineProps<Props>(), {
  type: 'package',
  keyword: '',
  restoredSnapshot: null,
})

const emit = defineEmits<{
  select: [item: MaterialSearchCardItem]
}>()

const message = useMessage()

const params = ref({
  keyword: props.keyword,
  type: props.type,
  size: 12,
  current: 1,
})

const resultList = ref<MaterialSearchCardItem[]>([])
const isSearched = ref(false)
const isShowMore = ref(false)
const loading = ref(false)
const typeOptions = ref<DictItem[]>([])

const scrollBody = ref<HTMLElement | null>(null)
const loadSentinel = ref<HTMLElement | null>(null)
let infiniteScrollObserver: IntersectionObserver | null = null
let isApplyingSnapshot = false

const takeSnapshot = (): MaterialSearchPanelSnapshot => ({
  params: { ...params.value },
  resultList: [...resultList.value],
  isSearched: isSearched.value,
  isShowMore: isShowMore.value,
  scrollTop: scrollBody.value?.scrollTop ?? 0,
})

const applySnapshot = (snapshot: MaterialSearchPanelSnapshot) => {
  isApplyingSnapshot = true
  params.value = { ...snapshot.params }
  resultList.value = [...snapshot.resultList]
  isSearched.value = snapshot.isSearched
  isShowMore.value = snapshot.isShowMore
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
  if (!props.restoredSnapshot) {
    return false
  }
  applySnapshot(props.restoredSnapshot)
  return true
}

const loadTypeDict = async () => {
  const res = await getDict('material_type')
  if (isSuccess(res)) {
    typeOptions.value = res.data.itemList ?? []
  }
}

const createSkeletonRows = (count: number): MaterialSearchCardItem[] =>
  Array.from({ length: count }, () => ({
    id: -1,
    name: '',
    type: params.value.type,
    img: '',
    desc: '',
    loading: true,
  }))

const searchMaterial = async (isInit = true) => {
  if (loading.value) return
  loading.value = true

  if (isInit) {
    params.value.current = 1
    resultList.value = []
    isSearched.value = true
  } else {
    params.value.current += 1
  }

  const placeholders = createSkeletonRows(params.value.size)
  const startIndex = resultList.value.length
  resultList.value.push(...placeholders)

  try {
    const res = await getMaterialPage(params.value)
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
      resultList.value[targetIndex] = {
        id: Number(item.id),
        name: String(item.name ?? '无'),
        type: String(item.type ?? ''),
        img: String(item.url ?? ''),
        desc: String(item.remark ?? '无备注'),
        loading: false,
      }
    }
  } catch (error) {
    resultList.value.splice(startIndex, placeholders.length)
    message.error(error instanceof Error ? error.message : '搜索失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.keyword, props.type] as const,
  ([keyword, type]) => {
    if (isApplyingSnapshot) return
    if (tryRestoreFromSnapshotProp()) return

    params.value.keyword = keyword
    params.value.type = type
    if (!props.restoredSnapshot) {
      void searchMaterial(true)
    }
  },
  { immediate: true },
)

watch(
  () => props.restoredSnapshot,
  (snapshot) => {
    if (isApplyingSnapshot || !snapshot) return
    applySnapshot(snapshot)
  },
)

const disconnectInfiniteScroll = () => {
  infiniteScrollObserver?.disconnect()
  infiniteScrollObserver = null
}

const bindInfiniteScroll = async () => {
  await nextTick()
  disconnectInfiniteScroll()

  const sentinel = loadSentinel.value
  const scrollRoot = scrollBody.value
  if (!sentinel || !scrollRoot || !isShowMore.value) {
    return
  }

  infiniteScrollObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && isShowMore.value && !loading.value) {
        void searchMaterial(false)
      }
    },
    { root: scrollRoot, rootMargin: '72px', threshold: 0 },
  )
  infiniteScrollObserver.observe(sentinel)
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

onMounted(() => {
  void loadTypeDict()
  void bindInfiniteScroll()
})

onUnmounted(() => {
  disconnectInfiniteScroll()
})

const typeLabel = (value: string) => getLabel(value, typeOptions.value) || value

defineExpose({
  searchMaterial,
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
  <div class="material-search-panel">
    <div class="material-search-panel__toolbar">
      <form class="material-search-panel__search-form" @submit.prevent="searchMaterial(true)">
        <div class="material-search-panel__main-row">
          <n-input
            v-model:value="params.keyword"
            class="material-search-panel__input"
            size="medium"
            clearable
            placeholder="角标名称、备注"
            @keyup.enter="searchMaterial(true)"
          />
          <n-button
            type="primary"
            size="medium"
            class="material-search-panel__search-btn"
            :loading="loading"
            attr-type="submit"
          >
            <template #icon>
              <n-icon><SearchRound /></n-icon>
            </template>
            <span class="material-search-panel__search-text">搜索</span>
          </n-button>
        </div>
      </form>
    </div>

    <div ref="scrollBody" class="material-search-panel__scroll">
      <n-empty
        v-if="isSearched && resultList.length === 0 && !loading"
        class="material-search-panel__empty"
        description="暂无角标素材"
      />

      <div v-else class="material-search-panel__grid">
        <button
          v-for="item in resultList"
          :key="`${item.id}-${item.loading}`"
          type="button"
          class="material-search-panel__card"
          :disabled="item.loading || item.id < 0"
          @click="emit('select', item)"
        >
          <n-skeleton v-if="item.loading" height="100%" width="100%" :sharp="false" />
          <template v-else>
            <div class="material-search-panel__thumb">
              <img v-if="item.img" :src="item.img" :alt="item.name" loading="lazy" />
              <n-icon v-else :size="28"><ImageNotSupportedRound /></n-icon>
            </div>
            <div class="material-search-panel__body">
              <div class="diy-drawer-list-title">{{ item.name }}</div>
              <div class="material-search-panel__desc">{{ item.desc }}</div>
              <div class="material-search-panel__tags">
                <n-tag size="small" :bordered="false">{{ typeLabel(item.type) }}</n-tag>
                <n-tag size="small" type="info" :bordered="false">角标</n-tag>
              </div>
            </div>
          </template>
        </button>
      </div>

      <div
        v-if="isShowMore"
        ref="loadSentinel"
        class="material-search-panel__sentinel"
        aria-hidden="true"
      >
        <n-spin v-if="loading" size="small" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.material-search-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
}

.material-search-panel__toolbar {
  flex-shrink: 0;
  z-index: 1;
  padding: var(--diy-drawer-toolbar-padding-top) 0 0;
  background: var(--card-color);
}

.material-search-panel__search-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: var(--diy-drawer-toolbar-padding-bottom);
  border-bottom: 1px solid var(--border-color);
}

.material-search-panel__main-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.material-search-panel__input {
  flex: 1;
  min-width: 0;
}

.material-search-panel__search-btn {
  flex-shrink: 0;
}

.material-search-panel__scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: var(--diy-drawer-scroll-padding-y) 0 var(--diy-drawer-scroll-padding-bottom);
  background: var(--body-color);
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.material-search-panel__empty {
  padding: 32px 0;
}

.material-search-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 12px;
}

.material-search-panel__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--border-color));
  border-radius: var(--page-r, 12px);
  background: color-mix(in srgb, var(--body-color) 52%, var(--card-color));
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.material-search-panel__thumb {
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--body-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.material-search-panel__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.material-search-panel__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.material-search-panel__desc {
  font-size: 12px;
  color: var(--text-color-2);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.material-search-panel__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.material-search-panel__sentinel {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 40px;
  padding: 8px 0 4px;
}

@media (max-width: 640px) {
  .material-search-panel__main-row {
    gap: 4px;
  }

  .material-search-panel__search-text {
    display: none;
  }

  .material-search-panel__grid {
    grid-template-columns: 1fr;
  }
}
</style>
