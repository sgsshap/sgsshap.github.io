<script setup lang="ts">
import {
  buildResourceSearchDetailQuery,
  buildResourceSearchListQuery,
  clearAllDiyOverlayQuery,
  parseResourceSearchRouteMode,
  readResourceSearchDetailId,
  readResourceSearchDetailTitle,
} from '@/features/diy-card/constants/diyDrawerRoute'
import ImageWikiDetailPanel from '@/shared/components/wiki/ImageWikiDetailPanel.vue'
import LegendWikiDetailPanel from '@/shared/components/wiki/LegendWikiDetailPanel.vue'
import MaterialDetailPanel from '@/features/diy-card/components/search/MaterialDetailPanel.vue'
import MaterialSearchPanel, {
  type MaterialSearchPanelSnapshot,
} from '@/features/diy-card/components/search/MaterialSearchPanel.vue'
import SkillWikiDetailPanel from '@/shared/components/wiki/SkillWikiDetailPanel.vue'
import WikiSearchPanel, {
  type WikiSearchPanelSnapshot,
} from '@/shared/components/wiki/WikiSearchPanel.vue'
import type {
  DiySearchMode,
  DiySearchSelectPayload,
  MaterialSearchCardItem,
  WikiSearchCardItem,
} from '@/features/diy-card/types/search'
import { applySafeViewportHeight } from '@/shared/utils/safeViewport'
import { ArrowBackRound, CloseRound } from '@/shared/icons'
import { parseWikiLegendVersionId } from '@/shared/constants/wikiRoute'
import { useSystemStore } from '@/shared/stores/system'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'DiyResourceSearchDrawer' })

interface Props {
  show: boolean
  mode: DiySearchMode
  keyword?: string
  skillIndex?: number
  applyPending?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  keyword: '',
  skillIndex: 0,
  applyPending: false,
})

const emit = defineEmits<{
  apply: [payload: DiySearchSelectPayload]
}>()

const route = useRoute()
const router = useRouter()
const systemStore = useSystemStore()

const legendVersionIdFromRoute = computed(() => parseWikiLegendVersionId(route.query))

const detailState = ref<{
  kind: 'legend' | 'image' | 'skill' | 'material'
  id: number
  title: string
} | null>(null)

const listShellPreserved = ref(false)
const panelCached = ref<Record<DiySearchMode, boolean>>({
  legend: false,
  image: false,
  skill: false,
  package: false,
})

const listSnapshots = ref<{
  legend?: WikiSearchPanelSnapshot
  image?: WikiSearchPanelSnapshot
  skill?: WikiSearchPanelSnapshot
  package?: MaterialSearchPanelSnapshot
}>({})

const legendPanelRef = ref<InstanceType<typeof WikiSearchPanel> | null>(null)
const imagePanelRef = ref<InstanceType<typeof WikiSearchPanel> | null>(null)
const skillPanelRef = ref<InstanceType<typeof WikiSearchPanel> | null>(null)
const materialPanelRef = ref<InstanceType<typeof MaterialSearchPanel> | null>(null)

const viewportWidth = ref(typeof globalThis.window !== 'undefined' ? globalThis.window.innerWidth : 720)

/** 本次详情是否由 router.push 进入（可 history.back） */
let openedDetailViaPush = false

const saveActiveListSnapshot = () => {
  if (props.mode === 'package') {
    const snapshot = materialPanelRef.value?.takeSnapshot?.()
    if (snapshot) listSnapshots.value.package = snapshot
    return
  }

  if (props.mode === 'legend') {
    const snapshot = legendPanelRef.value?.takeSnapshot?.()
    if (snapshot) listSnapshots.value.legend = snapshot
    return
  }

  if (props.mode === 'image') {
    const snapshot = imagePanelRef.value?.takeSnapshot?.()
    if (snapshot) listSnapshots.value.image = snapshot
    return
  }

  const snapshot = skillPanelRef.value?.takeSnapshot?.()
  if (snapshot) listSnapshots.value.skill = snapshot
}

const restoreActiveListSnapshot = () => {
  void nextTick(() => {
    if (props.mode === 'package') {
      const snapshot = listSnapshots.value.package
      if (snapshot) materialPanelRef.value?.applySnapshot?.(snapshot)
      return
    }

    if (props.mode === 'legend') {
      const snapshot = listSnapshots.value.legend
      if (snapshot) legendPanelRef.value?.applySnapshot?.(snapshot)
      return
    }

    if (props.mode === 'image') {
      const snapshot = listSnapshots.value.image
      if (snapshot) imagePanelRef.value?.applySnapshot?.(snapshot)
      return
    }

    const snapshot = listSnapshots.value.skill
    if (snapshot) skillPanelRef.value?.applySnapshot?.(snapshot)
  })
}

const isDiyPcLayout = computed(() => systemStore.isDiyPcLayout)

const drawerPlacement = computed(() => (isDiyPcLayout.value ? 'right' : 'bottom'))

const drawerWidth = computed(() =>
  isDiyPcLayout.value ? '50%' : '100%',
)

const drawerHeight = computed(() =>
  isDiyPcLayout.value ? undefined : 'var(--app-overlay-max-height)',
)

const syncViewportWidth = () => {
  viewportWidth.value = globalThis.window.innerWidth
}

const markPanelCached = (mode: DiySearchMode) => {
  panelCached.value[mode] = true
  listShellPreserved.value = true
}

/** 抽屉完全关闭后丢弃列表会话：下次打开重新挂载并搜索 */
const resetListSession = () => {
  listSnapshots.value = {}
  panelCached.value = {
    legend: false,
    image: false,
    skill: false,
    package: false,
  }
  listShellPreserved.value = false
  detailState.value = null
  openedDetailViaPush = false
}

const routeModeToDetailKind = (
  mode: ReturnType<typeof parseResourceSearchRouteMode>,
): 'legend' | 'image' | 'skill' | 'material' => {
  if (mode === 'package') return 'material'
  if (mode === 'image' || mode === 'skill') return mode
  return 'legend'
}

const syncFromRoute = () => {
  const mode = parseResourceSearchRouteMode(route.query)
  if (!mode) {
    detailState.value = null
    openedDetailViaPush = false
    return
  }

  markPanelCached(mode)

  const id = readResourceSearchDetailId(route.query)
  if (id) {
    detailState.value = {
      kind: routeModeToDetailKind(mode),
      id,
      title: readResourceSearchDetailTitle(route.query),
    }
    return
  }

  detailState.value = null
  openedDetailViaPush = false
}

const resetDetail = () => {
  if (!detailState.value) return
  if (openedDetailViaPush && readResourceSearchDetailId(route.query)) {
    openedDetailViaPush = false
    void router.back()
    return
  }

  const mode = parseResourceSearchRouteMode(route.query)
  if (!mode) {
    detailState.value = null
    restoreActiveListSnapshot()
    return
  }

  void router.replace({
    query: buildResourceSearchListQuery(route.query, mode),
  })
}

const closeDrawer = () => {
  if (!props.show) return
  if (readResourceSearchDetailId(route.query)) {
    void router.replace({
      query: clearAllDiyOverlayQuery(route.query),
    })
    return
  }
  void router.back()
}

const handleDrawerShowUpdate = (visible: boolean) => {
  if (!visible) {
    closeDrawer()
  }
}

const openWikiDetail = (item: WikiSearchCardItem) => {
  saveActiveListSnapshot()
  openedDetailViaPush = true
  void router.push({
    query: buildResourceSearchDetailQuery(route.query, {
      mode: item.type,
      id: item.id,
      title: item.name,
    }),
  })
}

const openMaterialDetail = (item: MaterialSearchCardItem) => {
  saveActiveListSnapshot()
  openedDetailViaPush = true
  void router.push({
    query: buildResourceSearchDetailQuery(route.query, {
      mode: 'package',
      id: item.id,
      title: item.name,
    }),
  })
}

const handleApply = (payload: DiySearchSelectPayload) => {
  emit('apply', payload)
}

const drawerTitle = computed(() => {
  if (detailState.value) {
    return detailState.value.title
  }
  if (props.mode === 'legend') return '武将百科搜索'
  if (props.mode === 'image') return '原画百科搜索'
  if (props.mode === 'skill') return '技能百科搜索'
  return '角标素材搜索'
})

watch(
  () => route.query,
  () => {
    syncFromRoute()
  },
  { immediate: true },
)

watch(
  () => detailState.value,
  (detail, previous) => {
    if (!detail) {
      listShellPreserved.value = true
    }

    if (detail || !previous) return

    restoreActiveListSnapshot()
  },
)

watch(
  () => props.show,
  (visible, wasVisible) => {
    if (visible) {
      applySafeViewportHeight()
      markPanelCached(props.mode)
      return
    }
    if (wasVisible) {
      resetListSession()
    }
  },
)

watch(
  () => props.mode,
  (mode, previousMode) => {
    if (previousMode === undefined) return
    if (props.show) {
      markPanelCached(mode)
    }
    if (detailState.value && readResourceSearchDetailId(route.query)) {
      void router.replace({
        query: buildResourceSearchListQuery(route.query, mode === 'package' ? 'package' : mode),
      })
    }
  },
)

onMounted(() => {
  globalThis.window.addEventListener('resize', syncViewportWidth)
})

onUnmounted(() => {
  globalThis.window.removeEventListener('resize', syncViewportWidth)
})
</script>

<template>
  <n-drawer
    :show="show"
    :placement="drawerPlacement"
    :width="drawerWidth"
    :height="drawerHeight"
    :z-index="1400"
    display-directive="show"
    @update:show="handleDrawerShowUpdate"
  >
    <n-drawer-content
      :native-scrollbar="false"
      :class="[
        'diy-drawer-content',
        'diy-drawer-content--search-list',
        { 'diy-drawer-content--detail': !!detailState },
      ]"
    >
      <template #header>
        <div class="diy-drawer-bar">
          <div v-if="detailState" class="diy-drawer-bar__leading">
            <n-button quaternary circle @click="resetDetail">
              <template #icon>
                <n-icon><ArrowBackRound /></n-icon>
              </template>
            </n-button>
          </div>
          <h2 class="diy-drawer-title">{{ drawerTitle }}</h2>
          <div v-if="!detailState" class="diy-drawer-bar__trailing">
            <n-button quaternary circle @click="closeDrawer">
              <template #icon>
                <n-icon><CloseRound /></n-icon>
              </template>
            </n-button>
          </div>
        </div>
      </template>

      <div
        v-show="detailState"
        class="diy-drawer-panel diy-drawer-panel--flat diy-drawer-panel--detail-scroll"
      >
        <LegendWikiDetailPanel
          v-if="detailState?.kind === 'legend'"
          :key="detailState.id"
          :legend-id="detailState.id"
          :initial-version-id="legendVersionIdFromRoute"
          :apply-pending="applyPending"
          @apply="handleApply"
        />
        <ImageWikiDetailPanel
          v-else-if="detailState?.kind === 'image'"
          :image-id="detailState.id"
          @apply="handleApply"
        />
        <SkillWikiDetailPanel
          v-else-if="detailState?.kind === 'skill'"
          :skill-id="detailState.id"
          :skill-index="skillIndex"
          @apply="handleApply"
        />
        <MaterialDetailPanel
          v-else-if="detailState?.kind === 'material'"
          :material-id="detailState.id"
          @apply="handleApply"
        />
      </div>

      <div
        v-if="listShellPreserved"
        v-show="!detailState"
        class="diy-drawer-panel diy-drawer-panel--fill"
      >
        <WikiSearchPanel
          v-if="panelCached.legend"
          v-show="mode === 'legend'"
          ref="legendPanelRef"
          layout="drawer"
          type="legend"
          :keyword="keyword"
          :restored-snapshot="listSnapshots.legend ?? null"
          @select="openWikiDetail"
        />
        <WikiSearchPanel
          v-if="panelCached.image"
          v-show="mode === 'image'"
          ref="imagePanelRef"
          layout="drawer"
          type="image"
          :keyword="keyword"
          :restored-snapshot="listSnapshots.image ?? null"
          @select="openWikiDetail"
        />
        <WikiSearchPanel
          v-if="panelCached.skill"
          v-show="mode === 'skill'"
          ref="skillPanelRef"
          layout="drawer"
          type="skill"
          :keyword="keyword"
          :restored-snapshot="listSnapshots.skill ?? null"
          @select="openWikiDetail"
        />
        <MaterialSearchPanel
          v-if="panelCached.package"
          v-show="mode === 'package'"
          ref="materialPanelRef"
          type="package"
          :keyword="keyword"
          :restored-snapshot="listSnapshots.package ?? null"
          @select="openMaterialDetail"
        />
      </div>
    </n-drawer-content>
  </n-drawer>
</template>
