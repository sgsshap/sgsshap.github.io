<script setup lang="ts">
import {
  getImageWiki,
  getLegendVersion,
  getLegendVersionPage,
  getLegendWiki,
} from '@/shared/api/wiki'
import type { WikiLegendSelectPayload } from '@/shared/types/wiki'
import { getDict, isSuccess } from '@/shared/api'
import type { DictItem } from '@/shared/types/api'
import { getLabel, getWikiKingdomLabel } from '@/shared/utils/dict'
import { formatWikiSkillDescHtml } from '@/shared/utils/wikiSkillDesc'
import { CheckCircleRound, ArrowBackRound, ArrowForwardRound, ImageNotSupportedRound, SwapHorizRound, OpenInNewRound } from '@/shared/icons'
import {
  buildWikiToDiyPendingSession,
  resolveWikiLegendDiyTemplateNotices,
  stashWikiToDiyPendingSession,
} from '@/features/diy-card/utils/wikiToDiyNavigation'
import {
  buildResourceSearchDetailQuery,
  isResourceSearchDrawerOpen,
  parseResourceSearchRouteMode,
} from '@/features/diy-card/constants/diyDrawerRoute'
import {
  WIKI_PAGE_DETAIL_QUERY,
  buildWikiLegendDetailQuery,
  parseWikiLegendVersionId,
} from '@/shared/constants/wikiRoute'
import { useDialog, useMessage } from 'naive-ui'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'LegendWikiDetailPanel' })

interface Props {
  legendId: number
  initialVersionId?: number | null
  applyPending?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialVersionId: null,
  applyPending: false,
  readonly: false,
})

const emit = defineEmits<{
  apply: [payload: WikiLegendSelectPayload]
}>()

const message = useMessage()
const dialog = useDialog()
const route = useRoute()
const router = useRouter()

const goToDiyPending = ref(false)

const skillDescHtml = (desc: unknown) => formatWikiSkillDescHtml(String(desc ?? ''))

const pageLoading = ref(false)
const loadingVersions = ref(false)
const versionBodyLoading = ref(false)
const wikiData = ref<Record<string, unknown>>({})
const versions = ref<Record<string, unknown>[]>([])
const activeVersionId = ref<number | null>(null)
const showAllVersion = ref(false)
const showAllIntro = ref(false)
const showAllVersionQuote = ref(false)
const versionScrollRef = ref<HTMLElement | null>(null)
const versionTabsCanScrollLeft = ref(false)
const versionTabsCanScrollRight = ref(false)
const versionTabsScrollable = computed(
  () => versionTabsCanScrollLeft.value || versionTabsCanScrollRight.value,
)
const isDraggingVersions = ref(false)
const loadedPreviewKeys = ref(new Set<string>())

type VersionEnrichment = {
  skills?: unknown
  image?: Record<string, unknown>
}

const versionEnrichmentCache = new Map<number, VersionEnrichment>()
const enrichPromises = new Map<number, Promise<void>>()

const VERSION_DRAG_THRESHOLD = 10

let versionDragStartX = 0
let versionScrollStartLeft = 0
let versionDragMoved = false
let versionActivePointerId: number | null = null
let suppressNextVersionTabClick = false

const kingdomOptions = ref<DictItem[]>([])
const serverOptions = ref<DictItem[]>([])
const gameModeOptions = ref<DictItem[]>([])

const activeVersion = computed(() =>
  versions.value.find((item) => Number(item.id) === activeVersionId.value),
)

const activeVersionQuote = computed(() => {
  const quote = activeVersion.value?.quote
  return typeof quote === 'string' ? quote.trim() : ''
})

const hasWikiContent = computed(() => Boolean(wikiData.value.id ?? wikiData.value.name))

const showPageSkeleton = computed(() => pageLoading.value && !hasWikiContent.value)

const getVersionImage = (version: Record<string, unknown>) =>
  version.image as Record<string, unknown> | undefined

const hasVersionImageConfigured = (version: Record<string, unknown>) =>
  Boolean(version.imageId)

const getVersionPreviewUrl = (version: Record<string, unknown>) => {
  const image = getVersionImage(version)
  if (!image) return ''
  const preview = image.previewUrl ?? image.url
  return typeof preview === 'string' && preview.trim() ? preview.trim() : ''
}

const getVersionPreviewKey = (version: Record<string, unknown>) => {
  const previewUrl = getVersionPreviewUrl(version)
  return previewUrl ? `${String(version.id)}:${previewUrl}` : ''
}

const isVersionPreviewLoaded = (version: Record<string, unknown>) => {
  const key = getVersionPreviewKey(version)
  if (!key) return !hasVersionImageConfigured(version)
  return loadedPreviewKeys.value.has(key)
}

const isVersionImagePending = (version: Record<string, unknown>) =>
  hasVersionImageConfigured(version) && !getVersionPreviewUrl(version)

const showVersionPreviewSkeleton = (version: Record<string, unknown>) => {
  if (isVersionImagePending(version)) return true
  const previewUrl = getVersionPreviewUrl(version)
  return Boolean(previewUrl) && !isVersionPreviewLoaded(version)
}

const applyCachedEnrichment = (version: Record<string, unknown>) => {
  const versionId = Number(version.id)
  if (!Number.isFinite(versionId)) return
  const cached = versionEnrichmentCache.get(versionId)
  if (!cached) return
  if (cached.skills && !version.skills) version.skills = cached.skills
  if (cached.image && !version.image) version.image = cached.image
}

const markVersionPreviewLoaded = (version: Record<string, unknown>) => {
  const key = getVersionPreviewKey(version)
  if (!key) return
  loadedPreviewKeys.value.add(key)
}

const kingdomLabel = computed(() =>
  wikiData.value.kingdom
    ? getWikiKingdomLabel(String(wikiData.value.kingdom), kingdomOptions.value)
    : '',
)

const loadDicts = async () => {
  const [kingdomRes, serverRes, gameModeRes] = await Promise.all([
    getDict('kingdom'),
    getDict('server'),
    getDict('game_mode'),
  ])
  if (isSuccess(kingdomRes)) kingdomOptions.value = kingdomRes.data.itemList ?? []
  if (isSuccess(serverRes)) serverOptions.value = serverRes.data.itemList ?? []
  if (isSuccess(gameModeRes)) gameModeOptions.value = gameModeRes.data.itemList ?? []
}

const versionNeedsEnrich = (version: Record<string, unknown>) => {
  applyCachedEnrichment(version)
  return !version.skills || isVersionImagePending(version)
}

const enrichVersion = async (version: Record<string, unknown>) => {
  const versionId = Number(version.id)
  if (!Number.isFinite(versionId)) return

  applyCachedEnrichment(version)
  if (!versionNeedsEnrich(version)) return

  const pending = enrichPromises.get(versionId)
  if (pending) {
    await pending
    applyCachedEnrichment(version)
    return
  }

  const task = (async () => {
    const cached = versionEnrichmentCache.get(versionId) ?? {}
    let skills = (version.skills ?? cached.skills) as unknown
    let image = (getVersionImage(version) ?? cached.image) as Record<string, unknown> | undefined

    if (!skills) {
      const versionRes = await getLegendVersion(versionId)
      if (isSuccess(versionRes)) {
        skills = versionRes.data.skills
        const quote = versionRes.data.quote
        if (typeof quote === 'string' && quote.trim()) {
          version.quote = quote
        }
      }
    }
    if (version.imageId && !image) {
      const imageRes = await getImageWiki(Number(version.imageId))
      if (isSuccess(imageRes)) {
        image = imageRes.data as Record<string, unknown>
      }
    }

    const nextCache: VersionEnrichment = { ...cached }
    if (skills) nextCache.skills = skills
    if (image) nextCache.image = image
    if (nextCache.skills || nextCache.image) {
      versionEnrichmentCache.set(versionId, nextCache)
    }
  })()

  enrichPromises.set(versionId, task)
  try {
    await task
  } finally {
    enrichPromises.delete(versionId)
    applyCachedEnrichment(version)
  }
}

const ensureVersionReady = async (version: Record<string, unknown>) => {
  if (!versionNeedsEnrich(version)) return
  await enrichVersion(version)
}

const prefetchVersion = (versionId: number) => {
  const version = versions.value.find((item) => Number(item.id) === versionId)
  if (!version || !versionNeedsEnrich(version)) return
  void enrichVersion(version)
}

let suppressShowAllVersionReload = false

const applyInitialVersion = async (versionId: number) => {
  if (!versionId || versionId <= 0 || !versions.value.length) return
  if (activeVersionId.value === versionId) return

  const matchedVersion = versions.value.find((version) => Number(version.id) === versionId)
  if (!matchedVersion) {
    if (!showAllVersion.value) {
      suppressShowAllVersionReload = true
      showAllVersion.value = true
      suppressShowAllVersionReload = false
      await loadVersions()
    }
    return
  }

  await handleVersionChange(versionId)
}

const loadVersions = async () => {
  loadingVersions.value = true
  try {
    const targetVersionId =
      props.initialVersionId && props.initialVersionId > 0 ? props.initialVersionId : null

    let useFeaturedOnly = !showAllVersion.value
    let res = await getLegendVersionPage({
      current: 1,
      size: 100,
      legendId: props.legendId,
      showFlag: useFeaturedOnly,
    })
    if (!isSuccess(res)) {
      throw new Error(res.message || '版本加载失败')
    }

    let nextVersions = res.data.records ?? []

    if (targetVersionId && !nextVersions.some((version) => Number(version.id) === targetVersionId)) {
      if (useFeaturedOnly) {
        res = await getLegendVersionPage({
          current: 1,
          size: 100,
          legendId: props.legendId,
          showFlag: false,
        })
        if (!isSuccess(res)) {
          throw new Error(res.message || '版本加载失败')
        }
        nextVersions = res.data.records ?? []
        if (nextVersions.some((version) => Number(version.id) === targetVersionId)) {
          suppressShowAllVersionReload = true
          showAllVersion.value = true
          suppressShowAllVersionReload = false
        }
      }
    }

    nextVersions.forEach((version) => applyCachedEnrichment(version))

    const matchedVersion = targetVersionId
      ? nextVersions.find((version) => Number(version.id) === targetVersionId)
      : undefined
    const initialVersion = matchedVersion ?? nextVersions[0]
    if (initialVersion) {
      await enrichVersion(initialVersion)
    }
    versions.value = nextVersions
    activeVersionId.value = initialVersion ? Number(initialVersion.id) : null
    if (initialVersion) {
      await scrollActiveVersionIntoView()
    }

    if (targetVersionId && activeVersionId.value !== targetVersionId) {
      await applyInitialVersion(targetVersionId)
    } else if (activeVersionId.value) {
      syncLegendVersionToRoute(activeVersionId.value)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '版本加载失败')
  } finally {
    loadingVersions.value = false
  }
}

const loadLegend = async () => {
  pageLoading.value = true
  try {
    const res = await getLegendWiki(props.legendId)
    if (!isSuccess(res)) {
      throw new Error(res.message || '武将加载失败')
    }
    wikiData.value = res.data
    showAllIntro.value = false
    await loadVersions()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '武将加载失败')
  } finally {
    pageLoading.value = false
  }
}

const scrollActiveVersionIntoView = async () => {
  await nextTick()
  const root = versionScrollRef.value
  if (!root) return
  const activeTab = root.querySelector<HTMLElement>('.legend-detail-panel__tab--active')
  activeTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  updateVersionTabsScrollState()
}

const updateVersionTabsScrollState = () => {
  const root = versionScrollRef.value
  if (!root) {
    versionTabsCanScrollLeft.value = false
    versionTabsCanScrollRight.value = false
    return
  }
  const maxScroll = root.scrollWidth - root.clientWidth
  if (maxScroll <= 1) {
    versionTabsCanScrollLeft.value = false
    versionTabsCanScrollRight.value = false
    return
  }
  versionTabsCanScrollLeft.value = root.scrollLeft > 1
  versionTabsCanScrollRight.value = root.scrollLeft < maxScroll - 1
}

const scrollVersionTabs = (direction: -1 | 1) => {
  const root = versionScrollRef.value
  if (!root) return
  const step = Math.max(168, Math.round(root.clientWidth * 0.72))
  root.scrollBy({ left: direction * step, behavior: 'smooth' })
}

let versionTabsResizeObserver: ResizeObserver | undefined

const bindVersionTabsScrollObserver = () => {
  versionTabsResizeObserver?.disconnect()
  versionTabsResizeObserver = undefined
  const root = versionScrollRef.value
  if (!root) return
  updateVersionTabsScrollState()
  versionTabsResizeObserver = new ResizeObserver(() => {
    updateVersionTabsScrollState()
  })
  versionTabsResizeObserver.observe(root)
}

const resolveLegendDetailRouteTitle = () =>
  String(route.query[WIKI_PAGE_DETAIL_QUERY.title] ?? wikiData.value?.name ?? '百科详情')

const canSyncLegendVersionRoute = (): boolean => {
  if (route.query[WIKI_PAGE_DETAIL_QUERY.type] !== 'legend') return false
  const routeLegendId = Number(route.query[WIKI_PAGE_DETAIL_QUERY.id])
  if (!Number.isFinite(routeLegendId) || routeLegendId !== props.legendId) return false
  if (route.name === 'wiki') return true
  return route.name === 'diy' && isResourceSearchDrawerOpen(route.query)
}

const syncLegendVersionToRoute = (versionId: number) => {
  if (!canSyncLegendVersionRoute() || versionId <= 0) return
  if (parseWikiLegendVersionId(route.query) === versionId) return

  const title = resolveLegendDetailRouteTitle()

  if (route.name === 'diy' && isResourceSearchDrawerOpen(route.query)) {
    const mode = parseResourceSearchRouteMode(route.query)
    if (mode !== 'legend') return
    void router.replace({
      query: buildResourceSearchDetailQuery(route.query, {
        mode: 'legend',
        id: props.legendId,
        title,
        versionId,
      }),
    })
    return
  }

  void router.replace({
    query: buildWikiLegendDetailQuery(route.query, {
      legendId: props.legendId,
      title,
      versionId,
    }),
  })
}

const handleVersionChange = async (versionId: number) => {
  if (activeVersionId.value === versionId) return
  activeVersionId.value = versionId
  const version = versions.value.find((item) => Number(item.id) === versionId)
  if (!version) return

  if (versionNeedsEnrich(version) || isVersionImagePending(version)) {
    versionBodyLoading.value = true
    try {
      await enrichVersion(version)
    } finally {
      versionBodyLoading.value = false
    }
  }
  await scrollActiveVersionIntoView()
  syncLegendVersionToRoute(versionId)
}

const resetVersionDragState = () => {
  isDraggingVersions.value = false
  versionDragMoved = false
  versionActivePointerId = null
}

const onVersionTabsPointerDown = (event: PointerEvent) => {
  const root = versionScrollRef.value
  if (!root || event.button !== 0) return
  if (root.scrollWidth <= root.clientWidth) return

  versionDragMoved = false
  versionDragStartX = event.clientX
  versionScrollStartLeft = root.scrollLeft
  versionActivePointerId = event.pointerId
  isDraggingVersions.value = false
}

const onVersionTabsPointerMove = (event: PointerEvent) => {
  const root = versionScrollRef.value
  if (!root || versionActivePointerId !== event.pointerId) return
  if (root.scrollWidth <= root.clientWidth) return

  const deltaX = event.clientX - versionDragStartX
  if (!versionDragMoved && Math.abs(deltaX) < VERSION_DRAG_THRESHOLD) return

  if (!versionDragMoved) {
    versionDragMoved = true
    isDraggingVersions.value = true
    root.setPointerCapture(event.pointerId)
  }

  root.scrollLeft = versionScrollStartLeft - deltaX
}

const onVersionTabsPointerEnd = (event: PointerEvent) => {
  const root = versionScrollRef.value
  if (!root || versionActivePointerId !== event.pointerId) return

  if (root.hasPointerCapture(event.pointerId)) {
    root.releasePointerCapture(event.pointerId)
  }

  if (versionDragMoved) {
    suppressNextVersionTabClick = true
  }

  resetVersionDragState()
}

const onVersionTabClick = (versionId: number) => {
  if (suppressNextVersionTabClick) {
    suppressNextVersionTabClick = false
    return
  }
  void handleVersionChange(versionId)
}

const onVersionTabsWheel = (event: WheelEvent) => {
  const root = versionScrollRef.value
  if (!root || root.scrollWidth <= root.clientWidth) return

  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (delta === 0) return

  root.scrollLeft += delta
  event.preventDefault()
  updateVersionTabsScrollState()
}

const getVersionLabel = (version: Record<string, unknown>) => {
  const parts = [
    getLabel(String(version.server ?? ''), serverOptions.value),
    getLabel(String(version.gameMode ?? ''), gameModeOptions.value),
    String(version.intro ?? '').trim(),
  ].filter(Boolean)
  return parts.join(' · ') || '未命名版本'
}

const buildLegendApplyPayload = async (): Promise<WikiLegendSelectPayload | null> => {
  const version = activeVersion.value
  if (!version) {
    message.warning('请先选择武将版本')
    return null
  }

  try {
    await ensureVersionReady(version)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '版本数据加载失败')
    return null
  }

  return JSON.parse(
    JSON.stringify({
      type: 'legend',
      data: {
        legend: wikiData.value,
        version,
        versionLabel: getVersionLabel(version),
      },
    }),
  ) as WikiLegendSelectPayload
}

const handleApply = async () => {
  if (props.applyPending) return
  const payload = await buildLegendApplyPayload()
  if (!payload) return
  emit('apply', payload)
}

const navigateToDiyWithPayload = (payload: WikiLegendSelectPayload) => {
  goToDiyPending.value = true
  stashWikiToDiyPendingSession(buildWikiToDiyPendingSession(payload))
  void router.push({ name: 'diy' }).finally(() => {
    goToDiyPending.value = false
  })
}

const handleGoToDiy = async () => {
  if (goToDiyPending.value || props.applyPending) return

  const payload = await buildLegendApplyPayload()
  if (!payload) return

  const notices = resolveWikiLegendDiyTemplateNotices(
    wikiData.value,
    payload.data.version,
    kingdomOptions.value,
  )

  if (notices.length === 0) {
    navigateToDiyWithPayload(payload)
    return
  }

  dialog.warning({
    title: '模板提示',
    content: `${notices.join('；')}。是否仍使用「新UI」模板导入并前往制图？`,
    positiveText: '继续前往',
    negativeText: '取消',
    onPositiveClick: () => {
      navigateToDiyWithPayload(payload)
    },
  })
}

watch(
  () => activeVersionId.value,
  () => {
    showAllVersionQuote.value = false
  },
)

watch(
  () => props.legendId,
  (id, oldId) => {
    if (id <= 0) return
    if (oldId !== undefined && oldId !== id) {
      versionEnrichmentCache.clear()
      enrichPromises.clear()
      loadedPreviewKeys.value.clear()
      wikiData.value = {}
      versions.value = []
      activeVersionId.value = null
      showAllVersion.value = false
    }
    void loadLegend()
  },
  { immediate: true },
)

watch(
  () => [props.initialVersionId, versions.value.length] as const,
  ([versionId]) => {
    if (!versionId || versionId <= 0) return
    void applyInitialVersion(versionId)
  },
)

watch(showAllVersion, () => {
  if (suppressShowAllVersionReload) return
  void loadVersions()
})

watch(
  () => versions.value.length,
  async () => {
    await nextTick()
    bindVersionTabsScrollObserver()
  },
)

onUnmounted(() => {
  resetVersionDragState()
  versionTabsResizeObserver?.disconnect()
})

void loadDicts()
</script>

<template>
  <n-el tag="div" class="legend-detail-panel">
    <div
      v-if="showPageSkeleton"
      class="legend-detail-panel__skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <n-skeleton text style="width: 42%" />
      <n-skeleton text style="width: 68%; margin-top: 10px" />
      <n-skeleton text :repeat="2" style="margin-top: 14px" />
      <n-skeleton
        :sharp="false"
        style="margin-top: 18px; border-radius: 10px; height: var(--legend-preview-height)"
      />
      <n-skeleton height="220px" :sharp="false" style="margin-top: 14px; border-radius: 10px" />
    </div>

    <template v-else>
      <div class="legend-detail-panel__hero">
        <header class="legend-detail-panel__masthead">
          <p v-if="kingdomLabel || wikiData.number" class="legend-detail-panel__eyebrow wiki-detail-eyebrow">
            <span v-if="kingdomLabel">{{ kingdomLabel }}</span>
            <span v-if="kingdomLabel && wikiData.number" class="legend-detail-panel__eyebrow-sep">·</span>
            <span v-if="wikiData.number">编号 {{ wikiData.number }}</span>
          </p>
          <h1 class="diy-drawer-page-title">{{ wikiData.name }}</h1>
        </header>

        <aside v-if="wikiData.intro" class="legend-detail-panel__intro">
          <p
            class="legend-detail-panel__intro-text"
            :class="{ 'legend-detail-panel__intro-text--collapsed': !showAllIntro }"
          >
            {{ wikiData.intro }}
          </p>
          <button
            type="button"
            class="legend-detail-panel__intro-toggle"
            @click="showAllIntro = !showAllIntro"
          >
            {{ showAllIntro ? '收起' : '展开' }}
          </button>
        </aside>
      </div>

      <section
        v-if="versions.length"
        class="legend-detail-panel__versions"
        :class="{ 'legend-detail-panel__versions--loading': loadingVersions }"
      >
        <header class="legend-detail-panel__versions-head">
          <h2 class="diy-drawer-section-title">版本</h2>
        </header>

        <div class="legend-detail-panel__version-chrome">
          <div class="legend-detail-panel__version-toolbar">
            <div class="legend-detail-panel__filter-track" role="group" aria-label="版本范围">
              <button
                type="button"
                class="legend-detail-panel__filter-btn"
                :class="{ 'legend-detail-panel__filter-btn--active': !showAllVersion }"
                :disabled="loadingVersions"
                @click="showAllVersion = false"
              >
                仅精选
              </button>
              <button
                type="button"
                class="legend-detail-panel__filter-btn"
                :class="{ 'legend-detail-panel__filter-btn--active': showAllVersion }"
                :disabled="loadingVersions"
                @click="showAllVersion = true"
              >
                全部版本
              </button>
            </div>

            <p v-if="versionTabsScrollable" class="legend-detail-panel__tabs-hint">
              <n-icon :size="13"><SwapHorizRound /></n-icon>
              <span>左右滑动查看更多版本</span>
            </p>
          </div>

          <div class="legend-detail-panel__tabs-region">
            <div
              class="legend-detail-panel__tabs-shell"
              :class="{ 'legend-detail-panel__tabs-shell--scrollable': versionTabsScrollable }"
            >
            <button
              type="button"
              class="legend-detail-panel__tab legend-detail-panel__tab--nav"
              aria-label="向左滚动版本"
              :disabled="!versionTabsCanScrollLeft"
              @click="scrollVersionTabs(-1)"
            >
              <n-icon :size="16"><ArrowBackRound /></n-icon>
            </button>

            <div
              ref="versionScrollRef"
              class="legend-detail-panel__tabs"
              :class="{ 'legend-detail-panel__tabs--dragging': isDraggingVersions }"
              role="tablist"
              aria-label="版本列表"
              @scroll="updateVersionTabsScrollState"
              @pointerdown="onVersionTabsPointerDown"
              @pointermove="onVersionTabsPointerMove"
              @pointerup="onVersionTabsPointerEnd"
              @pointercancel="onVersionTabsPointerEnd"
              @wheel="onVersionTabsWheel"
            >
              <button
                v-for="version in versions"
                :key="String(version.id)"
                type="button"
                role="tab"
                class="legend-detail-panel__tab"
                :class="{ 'legend-detail-panel__tab--active': activeVersionId === Number(version.id) }"
                :title="getVersionLabel(version)"
                :aria-selected="activeVersionId === Number(version.id)"
                @click="onVersionTabClick(Number(version.id))"
                @pointerenter="prefetchVersion(Number(version.id))"
              >
                {{ getVersionLabel(version) }}
              </button>
            </div>

            <button
              type="button"
              class="legend-detail-panel__tab legend-detail-panel__tab--nav"
              aria-label="向右滚动版本"
              :disabled="!versionTabsCanScrollRight"
              @click="scrollVersionTabs(1)"
            >
              <n-icon :size="16"><ArrowForwardRound /></n-icon>
            </button>
            </div>
          </div>

          <n-spin
            v-if="activeVersion"
            :show="versionBodyLoading"
            class="legend-detail-panel__version-detail-spin"
          >
            <div class="legend-detail-panel__version-detail">
              <div class="legend-detail-panel__body">
          <figure class="legend-detail-panel__figure">
            <n-skeleton
              v-if="showVersionPreviewSkeleton(activeVersion)"
              :sharp="false"
              class="legend-detail-panel__figure-skeleton"
            />
            <img
              v-if="getVersionPreviewUrl(activeVersion)"
              :key="getVersionPreviewKey(activeVersion)"
              :src="getVersionPreviewUrl(activeVersion)"
              alt="武将预览"
              :class="{
                'legend-detail-panel__figure-img--loaded': isVersionPreviewLoaded(activeVersion),
              }"
              @load="markVersionPreviewLoaded(activeVersion)"
              @error="markVersionPreviewLoaded(activeVersion)"
            />
            <figcaption
              v-else-if="!hasVersionImageConfigured(activeVersion)"
              class="legend-detail-panel__figure-empty"
            >
              <n-icon :size="26"><ImageNotSupportedRound /></n-icon>
              <span>未配置默认原画</span>
            </figcaption>
          </figure>

          <dl class="legend-detail-panel__specs">
            <div class="legend-detail-panel__spec-row">
              <dt>称号</dt>
              <dd>{{ activeVersion.title || '—' }}</dd>
            </div>
            <div class="legend-detail-panel__spec-row">
              <dt>体力</dt>
              <dd>
                {{
                  activeVersion.gameMode === 'national'
                    ? activeVersion.nationalHp
                    : `${activeVersion.hp}${activeVersion.hp === activeVersion.maxHp ? '' : '/' + activeVersion.maxHp}`
                }}
              </dd>
            </div>
            <div v-if="activeVersion.shield" class="legend-detail-panel__spec-row">
              <dt>护甲</dt>
              <dd>{{ activeVersion.shield }}</dd>
            </div>
            <div
              v-if="(activeVersion.image as Record<string, unknown> | undefined)?.painter"
              class="legend-detail-panel__spec-row"
            >
              <dt>画师</dt>
              <dd>{{ (activeVersion.image as Record<string, unknown>).painter }}</dd>
            </div>
          </dl>

          <aside v-if="activeVersionQuote" class="legend-detail-panel__quote">
            <h3 class="legend-detail-panel__quote-title">引言</h3>
            <p
              class="legend-detail-panel__quote-text"
              :class="{ 'legend-detail-panel__quote-text--collapsed': !showAllVersionQuote }"
            >
              {{ activeVersionQuote }}
            </p>
            <button
              type="button"
              class="legend-detail-panel__quote-toggle"
              @click="showAllVersionQuote = !showAllVersionQuote"
            >
              {{ showAllVersionQuote ? '收起' : '展开' }}
            </button>
          </aside>

          <div
            v-if="Array.isArray(activeVersion.skills) && activeVersion.skills.length"
            class="legend-detail-panel__skills"
          >
            <h3 class="legend-detail-panel__skills-title">技能</h3>
            <div class="legend-detail-panel__skills-list">
              <article
                v-for="skill in activeVersion.skills as Record<string, unknown>[]"
                :key="String(skill.id ?? skill.skillName)"
                class="legend-detail-panel__skill"
              >
                <span class="legend-detail-panel__skill-name">
                  {{ skill.derivedFlag ? '☆' : '' }}{{ skill.skillName }}
                </span>
                <div
                  v-if="skillDescHtml(skill.description)"
                  class="legend-detail-panel__skill-desc wiki-skill-desc"
                  v-html="skillDescHtml(skill.description)"
                />
                <p v-else class="legend-detail-panel__skill-desc legend-detail-panel__skill-desc--empty">
                  暂无描述
                </p>
              </article>
            </div>
          </div>
              </div>
            </div>
          </n-spin>
        </div>
      </section>
      <section v-else-if="!pageLoading" class="legend-detail-panel__versions legend-detail-panel__versions--empty">
        <n-empty description="暂无可用版本" />
      </section>

      <footer v-if="!readonly" class="diy-detail-panel__footer-bar">
        <n-button
          type="primary"
          size="large"
          block
          :disabled="!activeVersion || applyPending"
          :loading="applyPending"
          @click="handleApply"
        >
          <template #icon>
            <n-icon><CheckCircleRound /></n-icon>
          </template>
          一键使用当前版本
        </n-button>
      </footer>

      <footer v-else-if="versions.length" class="diy-detail-panel__footer-bar">
        <n-button
          type="primary"
          size="large"
          block
          :disabled="!activeVersion || goToDiyPending"
          :loading="goToDiyPending"
          @click="handleGoToDiy"
        >
          <template #icon>
            <n-icon><OpenInNewRound /></n-icon>
          </template>
          去制图
        </n-button>
      </footer>
    </template>
  </n-el>
</template>

<style scoped>
.legend-detail-panel {
  --legend-preview-height: min(360px, 44dvh);
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  max-width: 100%;
  padding: 4px 0 0;
  box-sizing: border-box;
}

.legend-detail-panel__skeleton {
  display: flex;
  flex-direction: column;
}

.legend-detail-panel__body-spin,
.legend-detail-panel__version-detail-spin {
  display: block;
  width: 100%;
}

.legend-detail-panel__body-spin :deep(.n-spin-content),
.legend-detail-panel__version-detail-spin :deep(.n-spin-content) {
  width: 100%;
}

.legend-detail-panel__versions--loading {
  position: relative;
}

.legend-detail-panel__versions--loading::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  background: color-mix(in srgb, var(--body-color) 58%, transparent);
  pointer-events: none;
}

.legend-detail-panel__hero {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: var(--page-gap, 16px);
  margin-bottom: var(--page-gap, 16px);
  border-bottom: 1px solid var(--divider-color);
}

.legend-detail-panel__masthead {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-detail-panel__eyebrow-sep {
  margin: 0 6px;
  opacity: 0.45;
}

.legend-detail-panel__intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  border-radius: calc(var(--page-r, 12px) - 2px);
  background: color-mix(in srgb, var(--body-color) 48%, var(--card-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--border-color));
}

.legend-detail-panel__intro-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-color-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.legend-detail-panel__intro-text--collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

.legend-detail-panel__intro-toggle {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--primary-color);
  cursor: pointer;
}

.legend-detail-panel__intro-toggle:hover {
  opacity: 0.8;
}

.legend-detail-panel__versions {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 16px);
  min-width: 0;
  box-sizing: border-box;
  padding: 0;
  border: none;
  background: transparent;
}

.legend-detail-panel__versions--empty {
  align-items: center;
  padding: 28px 0;
}

.legend-detail-panel__versions-head {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider-color);
}

.legend-detail-panel__version-chrome {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 14px;
  overflow: hidden;
  border-radius: calc(var(--page-r, 12px) - 2px);
  background: color-mix(in srgb, var(--body-color) 48%, var(--card-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--border-color));
}

.legend-detail-panel__version-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.legend-detail-panel__filter-track {
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
  gap: 0;
  margin: 0;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--primary-color) 16%, var(--border-color));
  border-radius: calc(var(--page-r, 12px) - 4px);
  background: var(--card-color);
}

.legend-detail-panel__filter-btn {
  flex: 0 0 auto;
  padding: 5px 14px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--text-color-2);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.legend-detail-panel__filter-btn:first-child {
  border-radius: calc(var(--page-r, 12px) - 5px) 0 0 calc(var(--page-r, 12px) - 5px);
}

.legend-detail-panel__filter-btn:last-child {
  border-radius: 0 calc(var(--page-r, 12px) - 5px) calc(var(--page-r, 12px) - 5px) 0;
}

.legend-detail-panel__filter-btn + .legend-detail-panel__filter-btn {
  box-shadow: inset 1px 0 0 color-mix(in srgb, var(--primary-color) 14%, var(--border-color));
}

.legend-detail-panel__filter-btn:hover:not(:disabled):not(.legend-detail-panel__filter-btn--active) {
  color: var(--text-color-base);
  background: color-mix(in srgb, var(--primary-color) 4%, var(--card-color));
}

.legend-detail-panel__filter-btn--active {
  color: var(--text-color-base);
  font-weight: 600;
  border-color: color-mix(in srgb, var(--primary-color) 32%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 8%, var(--card-color));
}

.legend-detail-panel__filter-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.legend-detail-panel__tabs-region {
  margin: 14px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--divider-color);
}

.legend-detail-panel__tabs-hint {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 11px;
  line-height: 1.35;
  text-align: right;
  color: var(--text-color-3);
}

.legend-detail-panel__tabs-hint .n-icon {
  flex-shrink: 0;
  opacity: 0.88;
}

.legend-detail-panel__tabs-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding-top: 0;
  border-top: none;
}

.legend-detail-panel__tabs-shell:not(.legend-detail-panel__tabs-shell--scrollable) {
  gap: 0;
}

.legend-detail-panel__tabs-shell:not(.legend-detail-panel__tabs-shell--scrollable) .legend-detail-panel__tab--nav {
  display: none;
}

.legend-detail-panel__tabs {
  display: flex;
  flex: 1;
  flex-wrap: nowrap;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border-top: none;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  cursor: grab;
  touch-action: pan-x;
}

.legend-detail-panel__tabs::-webkit-scrollbar {
  display: none;
}

.legend-detail-panel__tabs--dragging {
  cursor: grabbing;
  user-select: none;
}

.legend-detail-panel__tabs--dragging .legend-detail-panel__tab {
  pointer-events: none;
}

.legend-detail-panel__tab {
  flex: 0 0 auto;
  max-width: min(280px, 72vw);
  padding: 7px 14px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 16%, var(--border-color));
  border-radius: 999px;
  background: var(--card-color);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-color-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.legend-detail-panel__tab:hover:not(.legend-detail-panel__tab--active) {
  color: var(--text-color-base);
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 4%, var(--card-color));
}

.legend-detail-panel__tab--active {
  color: var(--text-color-base);
  font-weight: 600;
  border-color: color-mix(in srgb, var(--primary-color) 40%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 10%, var(--card-color));
}

.legend-detail-panel__tab--nav {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: none;
  padding: 7px 11px;
  font-weight: 500;
}

.legend-detail-panel__tab--nav:disabled {
  opacity: 0.38;
  cursor: default;
  pointer-events: none;
}

.legend-detail-panel__version-detail {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--divider-color);
}

.legend-detail-panel__body {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.legend-detail-panel__figure {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  height: var(--legend-preview-height);
  min-height: var(--legend-preview-height);
  border-radius: calc(var(--page-r, 12px) - 4px);
  overflow: hidden;
  background: color-mix(in srgb, var(--body-color) 38%, var(--card-color));
}

.legend-detail-panel__figure-skeleton {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.legend-detail-panel__figure img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.legend-detail-panel__figure img.legend-detail-panel__figure-img--loaded {
  opacity: 1;
}

.legend-detail-panel__figure-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  font-size: 13px;
  color: var(--text-color-3);
}

.legend-detail-panel__specs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
  margin: 14px 0 0;
  padding: 14px 0 0;
  border-top: 1px solid color-mix(in srgb, var(--divider-color) 88%, transparent);
}

.legend-detail-panel__spec-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.legend-detail-panel__spec-row dt {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-color-3);
}

.legend-detail-panel__spec-row dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--text-color-1);
  word-break: break-word;
}

.legend-detail-panel__quote {
  margin: 14px 0 0;
  padding: 12px 14px 10px;
  border-radius: calc(var(--page-r, 12px) - 4px);
  background: color-mix(in srgb, var(--primary-color) 5%, var(--card-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--border-color));
}

.legend-detail-panel__quote-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-color-3);
}

.legend-detail-panel__quote-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-color-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.legend-detail-panel__quote-text--collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

.legend-detail-panel__quote-toggle {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
  color: var(--primary-color);
  cursor: pointer;
}

.legend-detail-panel__quote-toggle:hover {
  text-decoration: underline;
}

.legend-detail-panel__skills {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--divider-color) 88%, transparent);
}

.legend-detail-panel__skills-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.legend-detail-panel__skills-title::before {
  content: '';
  width: 4px;
  height: 0.95em;
  flex-shrink: 0;
  border-radius: 3px;
  background: linear-gradient(
    180deg,
    var(--primary-color) 0%,
    color-mix(in srgb, var(--primary-color) 55%, transparent) 100%
  );
  opacity: 0.72;
}

.legend-detail-panel__skills-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
  padding: 0;
}

.legend-detail-panel__skill {
  padding: 12px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--divider-color) 72%, transparent);
}

.legend-detail-panel__skill:first-child {
  padding-top: 0;
}

.legend-detail-panel__skill:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.legend-detail-panel__skill-name {
  display: inline-block;
  max-width: 100%;
  margin: 0 0 8px;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  color: color-mix(in srgb, var(--primary-color) 62%, var(--text-color-base));
  background: color-mix(in srgb, var(--primary-color) 9%, var(--card-color));
}

.legend-detail-panel__skill-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-color-2);
}

.legend-detail-panel__skill-desc--empty {
  color: var(--text-color-3);
}

@media (max-width: 640px) {
  .legend-detail-panel {
    --legend-preview-height: min(360px, 38dvh);
  }

  .legend-detail-panel__hero {
    padding-bottom: 14px;
    margin-bottom: 14px;
  }

  .legend-detail-panel__versions {
    gap: 14px;
  }

  .legend-detail-panel__intro-text {
    font-size: 13px;
  }

  .legend-detail-panel__version-chrome {
    padding: 12px;
  }

  .legend-detail-panel__filter-btn {
    padding: 5px 12px;
    font-size: 11px;
  }

  .legend-detail-panel__version-toolbar {
    gap: 8px;
  }

  .legend-detail-panel__tabs-region {
    margin-top: 12px;
    padding-top: 12px;
  }

  .legend-detail-panel__tabs-hint {
    font-size: 10px;
  }

  .legend-detail-panel__tabs-shell {
    gap: 6px;
  }

  .legend-detail-panel__tabs {
    gap: 8px;
  }

  .legend-detail-panel__tab--nav {
    padding: 7px 10px;
  }

  .legend-detail-panel__tab {
    font-size: 12px;
  }

  .legend-detail-panel__version-detail {
    margin-top: 12px;
    padding-top: 12px;
  }

  .legend-detail-panel__specs,
  .legend-detail-panel__skills {
    margin-top: 12px;
    padding-top: 12px;
  }

  .legend-detail-panel__skills-title {
    font-size: 14px;
  }

  .legend-detail-panel__specs {
    grid-template-columns: 1fr;
    gap: 8px;
  }

}
</style>
