<script setup lang="ts">
import DiyCanvasLoading from '@/features/diy-card/components/DiyCanvasLoading.vue'
import DiyCustomMaterialBar from '@/features/diy-card/components/DiyCustomMaterialBar.vue'
import DiyExportBar from '@/features/diy-card/components/DiyExportBar.vue'
import DiyHistoryBar from '@/features/diy-card/components/DiyHistoryBar.vue'
import DiyPreviewBar from '@/features/diy-card/components/DiyPreviewBar.vue'
import {
  canvasVisualSettledRevision,
  record,
  useDiyCanvasFloatPreview,
  useDiyCanvasKeyboardShortcuts,
  useDiyCanvasPin,
  useCanvasBackgroundRecovery,
} from '@/features/diy-card/composables'
import {
  getAppBottomLayoutReservePx,
  measureLayoutOffsetTopInScrollContainer,
  measurePreviewFixedFooterChrome,
  resolvePreviewStackMaxCanvasHeight,
  resolvePreviewStackViewportHeight,
} from '@/features/diy-card/composables/preview/previewViewportMetrics'
import { scheduleFloatPreviewLiveRefresh } from '@/features/diy-card/composables/preview/floatPreviewLiveRefresh'
import { resolveScrollContainerFromElement } from '@/shared/composables/useScrollToTop'
import { useCanvasBrightnessPreview } from '@/features/diy-card/composables/preview/useCanvasBrightnessPreview'
import {
  buildWhiteBorderCardBoxShadow,
  WHITE_BORDER_CORNER_MM,
} from '@/features/diy-card/constants/canvasPreview'
import {
  useDiyHistoryStore,
  useDiyStore,
  useExportStore,
  useInfoStore,
  useTemplateStore,
} from '@/features/diy-card/stores'
import { PaletteRound, PushPinRound } from '@/shared/icons'
import { useSystemStore } from '@/shared/stores/system'
import { getHistoryBootstrapSettleMs, isIOSWebKit, resolvePreviewStagePixelRatio } from '@/shared/utils/deviceCapability'
import { isTouchDevice } from '@/shared/utils/naive/touchDevice'
import { installLayoutViewportResizeListener, isBrowserPageZoom } from '@/shared/utils/viewportLayoutResize'
import { debounce } from '@/shared/utils/scheduling'
import Konva from 'konva'
import { NButton, NIcon, NModal, NSpin } from 'naive-ui'
import {
  computed,
  type CSSProperties,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { isSettingsOverlayOpen } from '@/features/diy-card/constants/diyDrawerRoute'
import { installDiyHistoryPersistLifecycle } from '@/features/diy-card/utils/diyHistoryPersistLifecycle'
import { Stage as VStage } from 'vue-konva'
import { useRoute } from 'vue-router'

/* 依赖注入 */
const diyStore = useDiyStore()
const infoStore = useInfoStore()
const exportStore = useExportStore()
const historyStore = useDiyHistoryStore()
const templateStore = useTemplateStore()
const systemStore = useSystemStore()
const route = useRoute()

/** 画布 loading 结束后再等待，避免模板 loadAll 写回前捕获快照（首屏数据已由 prepareFromPersisted 提前写入） */
const scheduleHistoryBootstrapSettle = () => getHistoryBootstrapSettleMs()
/** IndexedDB 已恢复到 info，可挂载模板并拉图 */
const persistPrepared = ref(false)
let historyBootstrapTimer: ReturnType<typeof globalThis.setTimeout> | undefined
let uninstallHistoryPersistLifecycle: (() => void) | undefined
/** 切换模板后待记入历史的展示名（同类型模板共用一条历史栈，不重置） */
let pendingTemplateHistoryLabel: string | null = null

const scheduleCanvasHistoryReady = () => {
  if (historyBootstrapTimer) {
    globalThis.clearTimeout(historyBootstrapTimer)
  }
  historyBootstrapTimer = globalThis.setTimeout(() => {
    void (async () => {
      historyBootstrapTimer = undefined

      await ensurePersistPrepared()

      if (diyStore.isCanvasLoading) {
        scheduleCanvasHistoryReady()
        return
      }
      if (historyStore.isRestoring) return

      const kind = historyStore.activeInfoKind
      const templateLabel = pendingTemplateHistoryLabel
      pendingTemplateHistoryLabel = null

      if (historyStore.bootstrappedKinds[kind]) {
        historyStore.syncActiveEntrySnapshotAfterCanvasSettle(kind)
      }

      if (templateLabel && historyStore.bootstrappedKinds[kind]) {
        record({ operation: 'switchTemplate', itemName: templateLabel })
      } else if (!historyStore.bootstrappedKinds[kind]) {
        historyStore.finishBootstrap()
        void historyStore.persistNow()
      }
    })()
  }, scheduleHistoryBootstrapSettle())
}

/* 状态定义 */
const stageRef = ref<any>(null)
const templateViewRef = ref<any>(null)
/** CSS scale 后的布局占位比例（transform 不改变文档流尺寸） */
const canvasDisplayScale = ref(1)
const canvasWrapperRef = ref<HTMLElement | null>(null)
const previewRootRef = ref<HTMLElement | null>(null)
const stageDomRef = ref<HTMLElement | null>(null)
const pinBarRef = ref<HTMLElement | null>(null)
const canvasAnchorRef = ref<HTMLElement | null>(null)
const canvasBoxRef = ref<HTMLElement | null>(null)
const canvasWrapRef = ref<HTMLElement | null>(null)

const isDiyPcLayout = computed(() => systemStore.isDiyPcLayout)
const isPcLayout = computed(() => isDiyPcLayout.value)
const isCompactPhone = computed(() => systemStore.isCompactPhone)
const isTouchCanvas = computed(() => isTouchDevice())
const isIOSCanvas = computed(() => isIOSWebKit())

/** 缩放后占位尺寸（与 transform 视觉盒对齐，避免 ceil 撑出白条） */
const fitDisplayPx = (value: number) => Math.round(value * 100) / 100

/** 当前路由是否为制图页（避免 keep-alive 内 v-if 切换 Mobile 时在新实例上误开悬挂预览） */
const isDiyRoute = computed(() => route.name === 'diy')

const otherConfigDrawerOpen = computed(() => isSettingsOverlayOpen(route.query))

/** 仅手机全屏详细设置会遮住画布，才强制显示悬挂预览；Pad 半屏抽屉不触发 */
const floatPreviewForceBySettings = computed(
  () => otherConfigDrawerOpen.value && !isDiyPcLayout.value,
)

const pinLayoutHooks: {
  onPinLayout?: () => void
  getPinnedCanvasVisualSize?: () => { width: number; height: number }
  getBottomViewportReserve?: () => number
} = {
  getBottomViewportReserve: () => getAppBottomLayoutReservePx(systemStore.isNarrowScreen),
}

const {
  isPinned,
  shouldFitPinnedViewport,
  getPinnedViewportFitSize,
  pinPlaceholderHeight,
  pinBarPlaceholderHeight,
  pinnedBoxStyle,
  pinBarPinnedStyle,
  pinnedShellStyle,
  pinLabel,
  togglePin,
  releasePin,
  suspendPin,
  restorePin,
  relayoutPin,
} = useDiyCanvasPin(canvasBoxRef, pinBarRef, stageDomRef, previewRootRef, pinLayoutHooks)

/**
 * 悬挂预览：窄屏滚出视口 / 手机详细设置抽屉；PC 宽屏画布展示不全时同样启用。
 * 画布固定时不启用，避免与 Teleport 固定画布重复显示。
 */
const floatPreviewPcPartialMode = computed(
  () => isDiyPcLayout.value && !systemStore.isNarrowScreen,
)

const floatPreviewEnabled = computed(() => {
  if (!isDiyRoute.value) return false
  if (shouldFitPinnedViewport()) return false
  return true
})

const {
  showFloat,
  floatExpanded,
  floatModalPaintKey,
  floatCanvasRef,
  floatExpandedCanvasRef,
  floatCanvasReady,
  floatExpandedCanvasReady,
  floatModalClosing,
  floatPopEdge,
  floatWrapStyle,
  floatExpandedPanelStyle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  closeFloatExpanded,
  onFloatModalShowUpdate,
  onFloatModalAfterEnter,
  onFloatModalAfterLeave,
  scheduleFloatPreviewRefresh,
  updateFloatDimensions,
  hideFloatPreview,
  setupObserver,
} = useDiyCanvasFloatPreview(
  canvasAnchorRef,
  () => stageRef.value?.getNode(),
  () => ({
    width: diyStore.finalStageConfig.width,
    height: diyStore.finalStageConfig.height,
  }),
  floatPreviewEnabled,
  floatPreviewForceBySettings,
  floatPreviewPcPartialMode,
)

useCanvasBackgroundRecovery({
  enabled: () => isDiyRoute.value && Boolean(templateViewRef.value),
  onHidden: () => {
    void historyStore.flushPersist()
  },
  onVisible: () => {
    void nextTick(() => {
      updateScale()
      requestAnimationFrame(() => {
        updateScale()
      })
    })
  },
  onRecovered: () => {
    void nextTick(() => {
      updateScale()
      requestAnimationFrame(() => {
        updateScale()
        if (showFloat.value) {
          scheduleFloatPreviewRefresh(0)
        }
      })
    })
  },
})

/** 详细设置抽屉打开时，悬挂预览须高于 drawer（Naive 默认 z-index 会自增） */
const floatPreviewWrapStyle = computed(() => ({
  ...floatWrapStyle.value,
  ...(floatPreviewForceBySettings.value ? { zIndex: 5000 } : null),
}))

// 画布原点
const canvasOrigin = computed(() => {
  const { innerStageBleed } = diyStore
  return {
    x: innerStageBleed,
    y: innerStageBleed,
  }
})

const whiteBorderPreview = computed(() => exportStore.whiteBorder)

const floatPreviewShellRef = ref<HTMLElement | null>(null)
const floatExpandedCanvasShellRef = ref<HTMLElement | null>(null)

useCanvasBrightnessPreview(() => exportStore.brightness, [
  canvasWrapperRef,
  floatPreviewShellRef,
  floatExpandedCanvasShellRef,
])

const whiteBorderCornerRadiusPx = computed(() => WHITE_BORDER_CORNER_MM * diyStore.mmToPx)

/** 预览缩放/占位用的逻辑尺寸，与 Konva Stage（finalStageConfig）一致，避免非出血时 maxBleed 空圈 */
const getCanvasLogicalDisplaySize = () => {
  const { width, height } = diyStore.finalStageConfig
  return { width, height }
}

pinLayoutHooks.getPinnedCanvasVisualSize = () => {
  const scale = canvasDisplayScale.value
  const { width, height } = getCanvasLogicalDisplaySize()
  return {
    width: width * scale,
    height: height * scale,
  }
}

/** 外层占位：缩放后的可视尺寸（layout 盒） */
const canvasViewportStyle = computed((): CSSProperties => {
  const scale = canvasDisplayScale.value
  const { width: logicalW, height: logicalH } = getCanvasLogicalDisplaySize()
  return {
    width: `${fitDisplayPx(logicalW * scale)}px`,
    height: `${fitDisplayPx(logicalH * scale)}px`,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  }
})

/** 内层缩放：viewport 内水平垂直居中，从中心缩放（固定/非固定统一） */
const canvasScalerStyle = computed((): CSSProperties => {
  const scale = canvasDisplayScale.value
  const { width: logicalW, height: logicalH } = getCanvasLogicalDisplaySize()

  return {
    width: `${logicalW}px`,
    height: `${logicalH}px`,
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) scale(${scale})`,
  }
})

const measureCanvasBlockTop = () => {
  const anchor = canvasAnchorRef.value
  if (!anchor) return 12
  const scrollRoot = resolveScrollContainerFromElement(anchor)
  let top = measureLayoutOffsetTopInScrollContainer(anchor, scrollRoot)
  if (isPinned.value && pinBarPlaceholderHeight.value > 0) {
    top += pinBarPlaceholderHeight.value
  }
  return top
}

/** 圆角白边预览：画布圆角 + 出血区白底遮挡（与导出合成圆角白边是两套逻辑） */
const canvasWhiteBorderCardStyle = computed(() => {
  if (!whiteBorderPreview.value) return undefined
  return {
    borderRadius: `${whiteBorderCornerRadiusPx.value}px`,
    boxShadow: buildWhiteBorderCardBoxShadow(diyStore.mmToPx),
  } as CSSProperties
})

const bleedShadeStyle = computed((): CSSProperties => {
  const bleed = diyStore.bleed
  const { width, height } = diyStore.finalStageConfig

  return {
    width: `${width}px`,
    height: `${height}px`,
    boxShadow: `inset 0 0 0 ${bleed}px rgba(0, 0, 0, 0.15)`,
  }
})

/** 含出血画布逻辑尺寸（Konva Stage，由 wrap flex 居中于 maxBleed 占位区） */
const canvasInnerStyle = computed((): CSSProperties => {
  const { width, height } = diyStore.finalStageConfig
  return {
    width: `${width}px`,
    height: `${height}px`,
  }
})

/** 成品区（非出血）红色虚线框，仅预览用，不参与导出 */
const bleedTrimGuideStyle = computed((): CSSProperties => {
  const bleed = diyStore.bleed
  const { width, height } = diyStore.stageConfig

  return {
    top: `${bleed}px`,
    left: `${bleed}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})

const templateModules = import.meta.glob('@/features/diy-card/components/templates/*/index.vue')
const templateView = shallowRef<any>(null)

/* 工具函数 */
const computeCanvasDisplayScale = () => {
  if (isBrowserPageZoom()) {
    return canvasDisplayScale.value > 0 ? canvasDisplayScale.value : 1
  }

  const anchorWidth = canvasAnchorRef.value?.clientWidth
  const horizontalPad = !isDiyPcLayout.value
    ? 8
    : systemStore.isNarrowScreen
      ? 16
      : 80
  const availableWidth =
    anchorWidth && anchorWidth > 0
      ? anchorWidth - (isDiyPcLayout.value ? 4 : 8)
      : window.innerWidth - horizontalPad
  const { width: displayW, height: displayH } = getCanvasLogicalDisplaySize()
  let scaleX = availableWidth / displayW
  let scaleY = Number.POSITIVE_INFINITY

  if (shouldFitPinnedViewport()) {
    const { width: fitW, height: fitH } = getPinnedViewportFitSize()
    scaleX = fitW / displayW
    scaleY = fitH / displayH
  } else if (systemStore.isNarrowScreen) {
    const anchor = canvasAnchorRef.value
    const scrollRoot = anchor ? resolveScrollContainerFromElement(anchor) : null
    const padDualColumn = isDiyPcLayout.value
    const maxHeight = resolvePreviewStackMaxCanvasHeight({
      viewportHeight: resolvePreviewStackViewportHeight(scrollRoot),
      canvasBlockTop: measureCanvasBlockTop(),
      belowCanvasChrome: measurePreviewFixedFooterChrome(previewRootRef.value),
      bottomReserve: getAppBottomLayoutReservePx(true),
      extraGap: padDualColumn ? 2 : 6,
      heightBudgetFactor: padDualColumn ? 1.08 : 1,
    })
    scaleY = maxHeight / displayH
  }

  return Math.min(scaleX, scaleY, 1)
}

/**
 * 仅更新 CSS 占位缩放（不依赖 Konva Stage 已挂载）。
 * 首屏须先于 Stage 就绪执行，避免 scale=1 时画布过大并被 flex-end 挤到预览区底部。
 */
const refreshCanvasDisplayScale = () => {
  if (isBrowserPageZoom()) return
  canvasDisplayScale.value = computeCanvasDisplayScale()
}

/**
 * 计算缩放比例并更新样式
 */
const updateScale = () => {
  if (isBrowserPageZoom()) return
  refreshCanvasDisplayScale()

  const stageNode = stageRef.value?.getNode()
  if (!stageNode) return

  const scale = canvasDisplayScale.value
  const dpr = resolvePreviewStagePixelRatio(scale)
  Konva.pixelRatio = dpr
  ;(Konva as any)._fixTextRendering = true

  const logicalWidth = stageNode.width()
  const logicalHeight = stageNode.height()
  const sceneCanvasWrapper = stageNode.content

  if (sceneCanvasWrapper) {
    sceneCanvasWrapper.style.width = `${logicalWidth}px`
    sceneCanvasWrapper.style.height = `${logicalHeight}px`

    const nativeCanvas = sceneCanvasWrapper._canvas

    if (nativeCanvas) {
      nativeCanvas.width = logicalWidth * dpr
      nativeCanvas.height = logicalHeight * dpr
      nativeCanvas.style.width = `${logicalWidth}px`
      nativeCanvas.style.height = `${logicalHeight}px`
      const context = nativeCanvas.getContext('2d')
      if (context) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }
  }

  stageNode.batchDraw()
  if (showFloat.value) {
    updateFloatDimensions()
    scheduleFloatPreviewRefresh(0)
  }
  if (isPinned.value || shouldFitPinnedViewport()) {
    void nextTick(relayoutPin)
  }
}

pinLayoutHooks.onPinLayout = updateScale
/**
 * 加载模板组件
 * @param name 模板名称
 */
const loadTemplate = (name: string) => {
  if (!name) {
    templateView.value = null
    diyStore.clearLoading()
    return
  }
  const dir = name.replace(/_/g, '-')
  const match = Object.entries(templateModules).find(([p]) =>
    p.replace(/\\/g, '/').includes(`/templates/${dir}/index.vue`),
  )
  if (!match) {
    console.warn(`Template not found for name: ${name} (folder: ${dir})`)
    templateView.value = null
    return
  }
  const [, loader] = match
  const templateLabel = templateStore.currentTemplate.label || '模板'
  const taskId = `template:${name}`
  diyStore.clearLoading()
  diyStore.startLoading(taskId, templateLabel)
  loader()
    .then((mod: any) => {
      templateView.value = mod.default
    })
    .catch((err: unknown) => console.error(`Failed to load template: ${name}`, err))
    .finally(() => diyStore.finishLoading(taskId))
}

/**
 * 更新选中项属性
 */
const syncSelectedItemLayout = () => {
  if (diyStore.selectedItem) {
    templateViewRef.value?.syncMaterialLayout?.(diyStore.selectedItem.code)
  }
  scheduleFloatPreviewLiveRefresh()
}

const updateSelectedItemProperty = () => {
  if (diyStore.selectedItem) {
    templateViewRef.value?.reloadMaterial?.(diyStore.selectedItem.code)
  }
  scheduleFloatPreviewLiveRefresh()
}

useDiyCanvasKeyboardShortcuts({
  enabled: () => isDiyRoute.value,
  onSyncLayout: syncSelectedItemLayout,
  onReloadProperty: updateSelectedItemProperty,
})

/** 首屏先读 IndexedDB 写入 info，再挂载模板组件（避免先用默认势力拉图） */
const ensurePersistPrepared = async () => {
  if (persistPrepared.value) return
  await historyStore.ensureSessionRestored()
  persistPrepared.value = true
}

/* 监听器 */
watch(
  () => templateStore.currentTemplate.name,
  (name) => {
    if (!persistPrepared.value) return
    loadTemplate(name)
  },
)

watch(
  () => diyStore.isCanvasLoading,
  (loading) => {
    if (!loading) {
      scheduleCanvasHistoryReady()
    }
  },
  { immediate: true },
)

/** 画布布局写回后同步当前历史指针的几何字段（不新增步骤）；不在此 reconcile 到 canvas，避免切势力中途用旧 layout 盖回 */
watch(canvasVisualSettledRevision, () => {
  if (diyStore.isCanvasLoading) return
  if (historyStore.isRestoring) return
  const kind = historyStore.activeInfoKind
  if (!historyStore.bootstrappedKinds[kind]) return
  historyStore.syncActiveEntrySnapshotAfterCanvasSettle(kind)
})

watch(
  () => templateStore.currentTemplateName,
  (name, prevName) => {
    if (!name) return
    if (historyStore.isRestoring) return
    if (infoStore.template.name !== name) {
      infoStore.template = { name }
    }
    if (!prevName || name === prevName) return
    pendingTemplateHistoryLabel = templateStore.currentTemplate.label
  },
  { immediate: true },
)

watch(isDiyPcLayout, (pc) => {
  if (!pc) {
    releasePin()
  }
  void nextTick(updateScale)
})

watch(whiteBorderPreview, () => {
  void nextTick(updateScale)
})

watch(
  () => diyStore.bleedFlag,
  () => {
    void nextTick(updateScale)
  },
)

watch(
  () =>
    [
      diyStore.finalStageConfig.width,
      diyStore.finalStageConfig.height,
      diyStore.isCanvasLoading,
    ] as const,
  ([, , loading]) => {
    refreshCanvasDisplayScale()
    if (loading) return
    void nextTick(updateScale)
  },
)

watch(isDiyRoute, (onDiy) => {
  if (!onDiy) {
    hideFloatPreview()
    suspendPin()
  } else {
    void nextTick(() => {
      setupObserver()
      restorePin()
    })
  }
})

onDeactivated(() => {
  hideFloatPreview()
  suspendPin()
})

onActivated(() => {
  if (!isDiyRoute.value) return
  void nextTick(() => {
    updateScale()
    setupObserver()
    restorePin()
  })
})

watch(
  () => [diyStore.finalStageConfig.width, diyStore.finalStageConfig.height] as const,
  () => {
    if (!isCompactPhone.value) return
    updateFloatDimensions()
    if (showFloat.value) {
      scheduleFloatPreviewRefresh(0)
    }
  },
)

const debouncedUpdateScale = debounce(updateScale, 150)

let previewChromeObserver: ResizeObserver | null = null
let uninstallLayoutViewportResize: (() => void) | null = null
let onPreviewVisualViewportChange: (() => void) | null = null

onMounted(() => {
  refreshCanvasDisplayScale()
  updateScale()
  void nextTick(() => {
    refreshCanvasDisplayScale()
    updateScale()
  })
  uninstallLayoutViewportResize = installLayoutViewportResizeListener(debouncedUpdateScale)
  onPreviewVisualViewportChange = () => {
    if (!isBrowserPageZoom()) {
      debouncedUpdateScale()
    }
  }
  window.visualViewport?.addEventListener('resize', onPreviewVisualViewportChange)
  if (typeof ResizeObserver !== 'undefined' && previewRootRef.value) {
    previewChromeObserver = new ResizeObserver(() => {
      if (isBrowserPageZoom()) return
      debouncedUpdateScale()
    })
    previewChromeObserver.observe(previewRootRef.value)
  }
  uninstallHistoryPersistLifecycle = installDiyHistoryPersistLifecycle()
  void ensurePersistPrepared().then(() => {
    loadTemplate(templateStore.currentTemplate.name)
  })
})

onUnmounted(() => {
  if (onPreviewVisualViewportChange) {
    window.visualViewport?.removeEventListener('resize', onPreviewVisualViewportChange)
    onPreviewVisualViewportChange = null
  }
  uninstallLayoutViewportResize?.()
  uninstallLayoutViewportResize = null
  debouncedUpdateScale.cancel()
  previewChromeObserver?.disconnect()
  previewChromeObserver = null
  uninstallHistoryPersistLifecycle?.()
  uninstallHistoryPersistLifecycle = undefined
  void historyStore.flushPersist()
  if (historyBootstrapTimer) {
    globalThis.clearTimeout(historyBootstrapTimer)
    historyBootstrapTimer = undefined
  }
})
</script>

<template>
  <div
    ref="previewRootRef"
    class="diy-preview"
    :class="{
      'diy-preview--touch': isTouchCanvas,
      'diy-preview--ios': isIOSCanvas,
      'diy-preview--narrow-stack': systemStore.isNarrowScreen,
    }"
  >
    <Teleport to="body">
      <div
        v-if="shouldFitPinnedViewport()"
        class="diy-preview__pin-shell"
        :style="pinnedShellStyle"
        aria-hidden="true"
      />
    </Teleport>

    <div ref="stageDomRef" class="diy-preview__stage">
      <template v-if="isPcLayout">
        <div
          v-if="shouldFitPinnedViewport() && pinBarPlaceholderHeight > 0"
          class="diy-preview__pin-bar-placeholder"
          :style="{ height: `${pinBarPlaceholderHeight}px` }"
        />

        <Teleport to="body" :disabled="!shouldFitPinnedViewport()">
          <div
            ref="pinBarRef"
            class="diy-preview__pin-bar"
            :class="{ 'diy-preview__pin-bar--active': shouldFitPinnedViewport() }"
            :style="shouldFitPinnedViewport() ? pinBarPinnedStyle : undefined"
          >
            <n-button
              class="diy-preview__pin-btn"
              size="medium"
              :type="isPinned ? 'warning' : 'primary'"
              :strong="!isPinned"
              round
              @click="togglePin"
            >
              <template #icon>
                <n-icon :size="18"><PushPinRound /></n-icon>
              </template>
              {{ pinLabel }}
            </n-button>
          </div>
        </Teleport>
      </template>

      <div
        ref="canvasAnchorRef"
        class="diy-preview__canvas-anchor"
        :class="{
          'diy-preview__canvas-anchor--white-border': whiteBorderPreview,
        }"
      >
        <div
          v-if="shouldFitPinnedViewport() && pinPlaceholderHeight > 0"
          class="diy-preview__pin-placeholder"
          :style="{ height: `${pinPlaceholderHeight}px` }"
        />

        <Teleport to="body" :disabled="!shouldFitPinnedViewport()">
          <div
            ref="canvasBoxRef"
            class="diy-preview__canvas-box"
            :class="{
              'diy-preview__canvas-box--white-border': whiteBorderPreview,
              'diy-preview__canvas-box--pinned': shouldFitPinnedViewport(),
            }"
            :style="shouldFitPinnedViewport() ? pinnedBoxStyle : undefined"
          >
            <div class="diy-preview__canvas-viewport" :style="canvasViewportStyle">
              <div
                ref="canvasWrapRef"
                class="diy-preview__canvas-wrap"
                :class="{
                  'diy-preview__canvas-wrap--pinned': shouldFitPinnedViewport(),
                  'diy-preview__canvas-wrap--white-border': whiteBorderPreview,
                }"
                :style="canvasScalerStyle"
              >
              <div
                class="diy-preview__canvas-white-border-card"
                :style="whiteBorderPreview ? canvasWhiteBorderCardStyle : undefined"
              >
                <div
                  class="diy-preview__canvas-inner"
                  ref="canvasWrapperRef"
                  :style="canvasInnerStyle"
                >
                  <div class="diy-preview__canvas-checkerboard" aria-hidden="true" />
                  <transition name="diy-preview-fade">
                    <div v-if="diyStore.isCanvasLoading" class="diy-preview__loading">
                      <DiyCanvasLoading
                        :hint="diyStore.loadingHint"
                        :sub-hint="diyStore.loadingSubHint"
                        :size="60"
                      />
                    </div>
                  </transition>
                  <v-stage ref="stageRef" :config="diyStore.finalStageConfig">
                    <component
                      v-if="templateView"
                      ref="templateViewRef"
                      :is="templateView"
                      :stage-width="diyStore.finalStageConfig.width"
                      :stage-height="diyStore.finalStageConfig.height"
                      :stage-origin="canvasOrigin"
                      @click="(val: string) => diyStore.setSelectedItemValue(val)"
                    />
                  </v-stage>
                  <div v-if="diyStore.bleedFlag" class="diy-preview__bleed-overlay">
                    <div class="diy-preview__bleed-shade" :style="bleedShadeStyle" />
                    <div class="diy-preview__bleed-trim" :style="bleedTrimGuideStyle" />
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </Teleport>
      </div>

      <Teleport to="body" :disabled="!isDiyRoute">
        <Transition name="diy-float-pop">
          <div
            v-if="floatPreviewEnabled && showFloat"
            ref="floatPreviewShellRef"
            class="diy-preview__float"
            :class="`diy-preview__float--pop-${floatPopEdge}`"
            :style="floatPreviewWrapStyle"
            title="拖动移动；点击查看大图"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <canvas ref="floatCanvasRef" class="diy-preview__float-canvas" aria-hidden="true" />
            <div v-show="!floatCanvasReady" class="diy-preview__float-fallback">
              <n-icon :size="24"><PaletteRound /></n-icon>
            </div>
          </div>
        </Transition>
      </Teleport>

      <Teleport to="body" :disabled="!isDiyRoute">
        <n-modal
          :show="floatExpanded"
          display-directive="show"
          preset="card"
          title="画布预览"
          :mask-closable="true"
          :auto-focus="false"
          :trap-focus="false"
          class="diy-preview__float-modal"
          style="width: min(94vw, 420px)"
          @update:show="onFloatModalShowUpdate"
          @close="closeFloatExpanded"
          @mask-click="closeFloatExpanded"
          @after-enter="onFloatModalAfterEnter"
          @after-leave="onFloatModalAfterLeave"
        >
          <div class="diy-preview__float-modal-body">
            <div
              ref="floatExpandedCanvasShellRef"
              class="diy-preview__float-modal-canvas"
              :style="floatExpandedPanelStyle"
            >
              <canvas
                :key="floatModalPaintKey"
                ref="floatExpandedCanvasRef"
                class="diy-preview__float-modal-canvas-el"
              />
              <div
                v-show="floatExpanded && !floatModalClosing && !floatExpandedCanvasReady"
                class="diy-preview__float-modal-loading"
              >
                <n-spin size="medium" />
                <span>正在生成预览…</span>
              </div>
            </div>
          </div>
          <template #footer>
            <n-button block quaternary @click="closeFloatExpanded">关闭</n-button>
          </template>
        </n-modal>
      </Teleport>

      <p class="diy-preview__select-hint">可拖拽移动画布上的元素（手机端需长按）</p>

      <DiyHistoryBar />

      <DiyPreviewBar
        v-if="diyStore.selectableOptions.length"
        @sync:selected-item-layout="syncSelectedItemLayout"
        @update:selected-item-property="updateSelectedItemProperty"
      />

      <DiyCustomMaterialBar v-if="isDiyPcLayout" />

      <DiyExportBar v-if="stageRef?.getNode()" :stage="stageRef.getNode()" />
    </div>
  </div>
</template>

<style scoped>
/* 保持原有样式不变 */
.diy-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding-top: clamp(6px, calc(100vh * 12 / 900), 12px);
  box-sizing: border-box;
}

.diy-preview__select-hint {
  max-width: var(--diy-card-max-width);
  margin: 0;
  padding: var(--diy-hint-pad-y, 8px) 20px;
  font-size: 0.92em;
  line-height: 1.5;
  text-align: center;
  color: var(--text-color-2);
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary-color) 8%, var(--card-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, var(--border-color));
}

.diy-preview__stage {
  width: 100%;
  max-width: var(--diy-card-max-width);
  display: flex;
  flex-direction: column;
  gap: var(--diy-form-feedback-height, 22px);
  justify-content: flex-start;
  align-items: center;
  border-radius: 8px;
}

.diy-preview--narrow-stack .diy-preview__stage {
  flex-shrink: 0;
}

.diy-preview__pin-bar {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 16px;
  margin-bottom: 6px;
  border-radius: calc(var(--page-r, 12px) - 2px);
  background: var(--card-color);
  border: 1px solid color-mix(in srgb, var(--primary-color) 24%, var(--border-color));
}

.diy-preview__pin-bar--active {
  background: transparent;
  border-color: color-mix(in srgb, var(--warning-color) 38%, transparent);
  box-shadow: none;
}

.diy-preview__pin-shell {
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(
      88% 72% at 50% 6%,
      color-mix(in srgb, var(--primary-color) 9%, transparent),
      transparent 68%
    ),
    linear-gradient(
      168deg,
      color-mix(in srgb, var(--card-color) 76%, transparent) 0%,
      color-mix(in srgb, var(--card-color) 54%, transparent) 48%,
      color-mix(in srgb, var(--body-color) 46%, transparent) 100%
    );
  backdrop-filter: blur(32px) saturate(1.12) brightness(1.03);
  -webkit-backdrop-filter: blur(32px) saturate(1.12) brightness(1.03);
  border: 1px solid color-mix(in srgb, var(--border-color) 42%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 20%, transparent),
    inset 0 -1px 0 color-mix(in srgb, var(--text-color-base) 5%, transparent),
    0 1px 2px color-mix(in srgb, var(--text-color-base) 7%, transparent),
    0 22px 52px -18px color-mix(in srgb, var(--text-color-base) 24%, transparent),
    0 10px 28px -14px color-mix(in srgb, var(--text-color-base) 14%, transparent);
  pointer-events: none;
  animation: diy-pin-shell-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes diy-pin-shell-in {
  0% {
    opacity: 0;
    transform: scale(0.992) translateY(3px);
  }

  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.diy-preview__pin-btn {
  min-width: 168px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.diy-preview__canvas-anchor {
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 10px;
  transition: box-shadow 0.35s ease;
  overflow-x: clip;
  flex-shrink: 0;
}

.diy-preview__canvas-anchor--white-border {
  overflow: visible;
}

.diy-preview__pin-placeholder,
.diy-preview__pin-bar-placeholder {
  width: 100%;
  flex-shrink: 0;
  transition: height 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .diy-preview__pin-placeholder,
  .diy-preview__pin-bar-placeholder {
    transition: none;
  }
}

.diy-preview__canvas-wrap--pinned {
  flex-shrink: 0;
  animation: none;
}

.diy-preview__canvas-wrap--pinned .diy-preview__canvas-inner {
  animation: none;
}

.diy-preview__float {
  position: fixed;
  z-index: 95;
  border-radius: 8px;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 0 0 2px var(--primary-color);
  background: var(--card-color);
}

.diy-preview__float:active {
  cursor: grabbing;
}

.diy-preview__float-canvas {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  background: #fff;
  image-rendering: auto;
}

.diy-preview__float-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--body-color) 90%, transparent);
  pointer-events: none;
}

.diy-preview__float-modal-body {
  display: flex;
  justify-content: center;
  padding: 4px 0 8px;
}

.diy-preview__float-modal-canvas {
  position: relative;
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px var(--border-color);
}

.diy-preview__float-modal-canvas-el {
  display: block;
  width: 100%;
  height: 100%;
  background: #fff;
  image-rendering: auto;
}

.diy-preview__float-modal-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-color-3);
  background: color-mix(in srgb, var(--body-color) 88%, transparent);
}

.diy-preview__canvas-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.diy-preview--narrow-stack .diy-preview__canvas-anchor {
  justify-content: flex-end;
}

.diy-preview__canvas-box--white-border {
  justify-content: center;
  background: #fff;
  border-radius: 6px;
}

.diy-preview__canvas-box--pinned {
  justify-content: center;
  align-items: center;
  overflow: hidden;
  isolation: isolate;
  background: transparent;
  box-shadow:
    0 14px 42px rgba(0, 0, 0, 0.28),
    0 6px 16px rgba(0, 0, 0, 0.14);
}

.diy-preview__canvas-box--pinned.diy-preview__canvas-box--white-border {
  justify-content: center;
  box-shadow: none;
}

.diy-preview__canvas-viewport {
  position: relative;
  flex-shrink: 0;
  line-height: 0;
  font-size: 0;
  overflow: hidden;
}

.diy-preview__canvas-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  line-height: 0;
  flex-shrink: 0;
}

.diy-preview__canvas-wrap--white-border {
  overflow: visible;
  box-shadow: none;
}

.diy-preview__canvas-white-border-card {
  overflow: hidden;
  flex: 0 0 auto;
  line-height: 0;
}

.diy-preview__canvas-wrap--white-border .diy-preview__canvas-white-border-card {
  background: #fff;
}

.diy-preview__canvas-inner {
  position: relative;
  display: block;
  flex-shrink: 0;
  overflow: hidden;
  isolation: isolate;
}

.diy-preview--touch .diy-preview__canvas-wrap {
  touch-action: none;
}

.diy-preview--touch .diy-preview__canvas-inner {
  touch-action: none;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}

.diy-preview__canvas-checkerboard {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
    linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
  background-size: 24px 24px;
  background-position:
    0 0,
    0 12px,
    12px -12px,
    -12px 0;
}

.diy-preview__canvas-wrap--white-border .diy-preview__canvas-checkerboard {
  display: none;
}

.diy-preview--ios .diy-preview__canvas-inner {
  background: #fff;
}

.diy-preview--ios .diy-preview__canvas-checkerboard {
  /* iOS Safari transform 缩放后右侧易留 1px 缝，缩进棋盘格由白底填充 */
  inset: 0 1px 0 0;
}

.diy-preview__canvas-inner :deep(.konvajs-content) {
  position: relative;
  z-index: 1;
  line-height: 0;
  font-size: 0;
}

.diy-preview__canvas-inner :deep(.konvajs-content canvas) {
  display: block;
  vertical-align: top;
}

.diy-preview__bleed-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.diy-preview__bleed-shade {
  position: absolute;
  top: 0;
  left: 0;
}

.diy-preview__bleed-trim {
  position: absolute;
  box-sizing: border-box;
  border: 2px dashed rgba(255, 56, 56, 0.92);
}

.diy-preview__loading {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.diy-preview-fade-enter-active,
.diy-preview-fade-leave-active {
  transition: opacity 0.28s ease;
}

.diy-preview-fade-enter-from,
.diy-preview-fade-leave-to {
  opacity: 0;
}

@keyframes diy-pin-shadow-in {
  0% {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  100% {
    box-shadow:
      0 14px 42px rgba(0, 0, 0, 0.28),
      0 6px 16px rgba(0, 0, 0, 0.14);
  }
}

@keyframes diy-pin-pop-in {
  0% {
    opacity: 0.72;
    transform: scale(0.88);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

<!-- Teleport 到 body，悬挂预览弹出/回退动画 -->
<style>
.diy-float-pop-enter-active.diy-preview__float--pop-left {
  animation: diy-float-pop-in-from-left 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
}

.diy-float-pop-enter-active.diy-preview__float--pop-right {
  animation: diy-float-pop-in-from-right 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
}

.diy-float-pop-enter-active.diy-preview__float--pop-top {
  animation: diy-float-pop-in-from-top 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
}

.diy-float-pop-enter-active.diy-preview__float--pop-bottom {
  animation: diy-float-pop-in-from-bottom 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
}

.diy-float-pop-leave-active.diy-preview__float--pop-left {
  animation: diy-float-pop-out-to-left 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.diy-float-pop-leave-active.diy-preview__float--pop-right {
  animation: diy-float-pop-out-to-right 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.diy-float-pop-leave-active.diy-preview__float--pop-top {
  animation: diy-float-pop-out-to-top 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.diy-float-pop-leave-active.diy-preview__float--pop-bottom {
  animation: diy-float-pop-out-to-bottom 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes diy-float-pop-in-from-left {
  0% {
    opacity: 0;
    transform: translateX(calc(-100% - 20px)) scale(0.94);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
}

@keyframes diy-float-pop-in-from-right {
  0% {
    opacity: 0;
    transform: translateX(calc(100% + 20px)) scale(0.94);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
}

@keyframes diy-float-pop-in-from-top {
  0% {
    opacity: 0;
    transform: translateY(calc(-100% - 20px)) scale(0.94);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
}

@keyframes diy-float-pop-in-from-bottom {
  0% {
    opacity: 0;
    transform: translateY(calc(100% + 20px)) scale(0.94);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
}

@keyframes diy-float-pop-out-to-left {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(calc(-100% - 20px)) scale(0.94);
  }
}

@keyframes diy-float-pop-out-to-right {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(calc(100% + 20px)) scale(0.94);
  }
}

@keyframes diy-float-pop-out-to-top {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(calc(-100% - 20px)) scale(0.94);
  }
}

@keyframes diy-float-pop-out-to-bottom {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(calc(100% + 20px)) scale(0.94);
  }
}
</style>
