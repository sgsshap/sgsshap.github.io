import { scheduleCanvasVisualSettled } from '@/features/diy-card/composables/preview/canvasVisualSettled'
import { isKingdomToggleCanvasBatchActive } from '@/features/diy-card/composables/kingdomToggleCanvasGate'
import { useDiyHistoryStore } from '@/features/diy-card/stores'
import { useDiyStore } from '@/features/diy-card/stores'
import { resolveIncompleteBootstrapLayerCodes } from '@/features/diy-card/utils/canvasBootstrapLayers'
import { scheduleAfterUiPaint, scheduleIdleTask } from '@/shared/utils/scheduling'
import {
  getHistoryFilterCacheDeferMs,
  shouldUseReducedCanvasQuality,
} from '@/shared/utils/deviceCapability'
import { nextTick, onMounted, ref, watch } from 'vue'
import type {
  KonvaNodeRef,
  LayerCode,
  LayerLoaderMap,
  SetupTemplateWatches,
  TemplateEmit,
  TemplateProps,
  TemplateSetup,
} from './types'
import {
  isKingdomGlyphCode,
} from '@/features/diy-card/composables/doubleKingdom'
import { isCustomMaterialCode } from '@/features/diy-card/utils/customMaterial'
import { isNameSplitCharCode } from '@/features/diy-card/utils/nameSplit'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { useTemplateCanvas } from './useTemplateCanvas'
import { runLayerReload } from './watchUtils'

/**
 * 根据 setup.layers 调用各 draw 函数，得到 code → load 映射
 */
function buildLayerLoaders<S extends TemplateSetup>(
  canvas: ReturnType<typeof useTemplateCanvas>,
  setup: S,
): LayerLoaderMap<LayerCode<S>> {
  const loaders = {} as LayerLoaderMap<LayerCode<S>>
  for (const layer of setup.layers) {
    loaders[layer.code as LayerCode<S>] = layer.draw(canvas)
  }
  return loaders
}

const MAX_INCOMPLETE_LAYER_RETRIES = 2

/** loadAll 后须从快照还原并刷回 Konva 的图层 */
const PRESERVED_LAYOUT_LAYER_CODES = [
  'name',
  'title',
  'watermark',
  'kingdom',
  'legendImage',
  'legendOutOfFrame',
  'package',
] as const

/** 从 setup.layers 推导 refKey 联合类型，用于 useDiyTemplate 返回值类型 */
type LayerRefKey<S extends TemplateSetup> = S['layers'][number]['refKey']

/**
 * useDiyTemplate 返回类型：公共字段 + 各图层 ref（与 index.vue 解构一致）
 */
export type DiyTemplateReturn<S extends TemplateSetup> = {
  info: ReturnType<typeof useTemplateCanvas>['info']
  canvasConfigs: ReturnType<typeof useTemplateCanvas>['canvasConfigs']
  canvasRenderVersion: ReturnType<typeof useTemplateCanvas>['canvasRenderVersion']
  legendOutOfFrameRenderVersion: ReturnType<
    typeof useTemplateCanvas
  >['legendOutOfFrameRenderVersion']
  syncMaterialLayout: ReturnType<typeof useTemplateCanvas>['syncMaterialLayout']
  schedulePreviewFilterCacheRefresh: ReturnType<
    typeof useTemplateCanvas
  >['schedulePreviewFilterCacheRefresh']
  /** 调用 canvasConfigs[code].loadFunc，单图层热重载 */
  reloadMaterial: (materialCode: string) => void
  /** loadAll 后把 name/title/kingdom/watermark/legendImage 等坐标刷回 Konva */
  syncPreservedLayoutToCanvas: () => Promise<void>
  registerSplitNameGroupRef: (code: string, inst: unknown) => void
  registerKingdomGlyphRef: (code: string, inst: unknown) => void
} & { [K in LayerRefKey<S>]: KonvaNodeRef }

/**
 * Konva 模板通用入口
 *
 * 流程：创建画布 → 组装 loaders → 注册 watch → onMounted 首次 loadAll。
 *
 * 全量 reload 契约（「从零开始」/重置画布 / diyStore.reload）：
 * 1. recreateFreshInfoForKind 替换 info 数据
 * 2. canvasRenderVersion++ 迫使 Vue-Konva 整组 remount
 * 3. loadAll(isReset) 各层仅依据当前 info 重绘，isReset 时禁止复用旧 canvasConfigs 子树
 * 4. forceRefreshAllPreviewFilterCaches 强制重建滤镜离屏 cache，不走过期复用判定
 *
 * 增量编辑（改描述/改色等）才允许图层内 preserve 与 konvaFilterPreviewCacheUpToDate 优化。
 * 各业务模板在 `useTemplate.ts` 中一行调用即可，无需复制本文件。
 *
 * @param props 画布 props
 * @param emit 图层点击事件
 * @param setup 模板 setup.ts 中 `defineTemplateSetup(...)` 的结果
 * @param setupWatches 模板 `watches.ts` 中的 watch 注册函数（可选）
 */
export function useDiyTemplate<S extends TemplateSetup>(
  props: TemplateProps,
  emit: TemplateEmit,
  setup: S,
  setupWatches?: SetupTemplateWatches<S>,
): DiyTemplateReturn<S> {
  const layersSorted = [...setup.layers].sort((a, b) => a.order - b.order)
  const canvas = useTemplateCanvas(props, emit, setup.layers)
  const loaders = buildLayerLoaders(canvas, setup)
  const diyStore = useDiyStore()
  const historyStore = useDiyHistoryStore()

  /** 全量 reload 后：强制各图层按最新 canvasConfigs 重建滤镜离屏 cache（禁止复用优化） */
  const forceRefreshAllPreviewFilterCaches = async () => {
    await nextTick()
    for (const layer of setup.layers) {
      canvas.schedulePreviewFilterCacheRefresh(layer.code, { force: true })
    }
  }

  const resolveLayerReset = (layer: S['layers'][number], globalReset: boolean) => {
    if (globalReset) return true
    // 首屏从 IndexedDB 恢复：以历史快照 layout 为准，禁止 resetOnLoadAll 覆盖
    if (
      historyStore.bootstrappedKinds[historyStore.activeInfoKind] &&
      diyStore.canvasBootstrapPending
    ) {
      return false
    }
    return Boolean(layer.resetOnLoadAll)
  }

  const layerCodes = setup.layers.map((layer) => layer.code)

  const layerNameByCode = new Map(setup.layers.map((layer) => [layer.code, layer.name]))

  const reloadIncompleteLayers = async (isReset: boolean, sequential: boolean) => {
    for (let attempt = 0; attempt < MAX_INCOMPLETE_LAYER_RETRIES; attempt += 1) {
      const missing = resolveIncompleteBootstrapLayerCodes(
        canvas.info,
        canvas.canvasConfigs,
        layerCodes,
      )
      if (!missing.length) return

      const reloadOne = async (code: string) => {
        const layer = layersSorted.find((item) => item.code === code)
        if (!layer) return
        const load = loaders[layer.code as LayerCode<S>]
        const label = layerNameByCode.get(code) ?? code
        await diyStore.runWithLoading(code, label, () =>
          Promise.resolve(load(resolveLayerReset(layer, isReset))),
        )
      }

      if (sequential) {
        for (const code of missing) {
          await reloadOne(code)
        }
      } else {
        await Promise.all(missing.map((code) => reloadOne(code)))
      }
    }

    const stillMissing = resolveIncompleteBootstrapLayerCodes(
      canvas.info,
      canvas.canvasConfigs,
      layerCodes,
    )
    if (stillMissing.length) {
      console.warn('[useDiyTemplate] incomplete canvas layers after retry', stillMissing)
    }
  }

  /**
   * 按登记顺序加载全部图层。
   * isReset=true（「从零开始」/重置画布）：各层须按当前 info 全量重绘，不得复用旧 canvasConfigs 子树。
   * resetOnLoadAll：边框/底栏等模板定位层每次 load 写回布局，避免刷新后 merge 旧 mm 坐标导致偏移。
   */
  const loadAll = async (isReset: boolean = false, sequential = false) => {
    const runLayerLoad = async (layer: (typeof layersSorted)[number]) => {
      const load = loaders[layer.code as LayerCode<S>]
      await Promise.resolve(load(resolveLayerReset(layer, isReset)))
    }

    if (sequential) {
      for (const layer of layersSorted) {
        await runLayerLoad(layer)
      }
      return
    }
    await Promise.all(layersSorted.map((layer) => runLayerLoad(layer)))
  }

  const syncPreservedLayoutToCanvas = async () => {
    await nextTick()
    const legendInfo = canvas.info as LegendInfo
    const codes: string[] = [...PRESERVED_LAYOUT_LAYER_CODES]
    const { kingdom, name } = legendInfo.renderConfig.items
    if (kingdom.doubleGlyphs) {
      codes.push(...Object.keys(kingdom.doubleGlyphs))
    }
    if (name.splitChars) {
      codes.push(...Object.keys(name.splitChars))
    }
    for (const code of codes) {
      canvas.syncMaterialLayout(code)
    }
  }

  /** loadAll 可能覆盖 loader 写回的坐标，完成后从历史指针快照还原 layout */
  const runLoadAllThenReconcileLayout = async (isReset: boolean, sequential: boolean) => {
    await loadAll(isReset, sequential)
    if (
      !isReset &&
      !isKingdomToggleCanvasBatchActive() &&
      historyStore.bootstrappedKinds[historyStore.activeInfoKind]
    ) {
      historyStore.reconcileLiveLayoutFromActiveEntryNow()
      await syncPreservedLayoutToCanvas()
    }
  }

  /** 补拉未完成图层后：再次从快照 reconcile 并刷回 Konva（不 reset） */
  const reconcilePreservedLayoutAfterIncompleteLayers = async (isReset: boolean) => {
    if (
      !isReset &&
      !isKingdomToggleCanvasBatchActive() &&
      historyStore.bootstrappedKinds[historyStore.activeInfoKind]
    ) {
      historyStore.reconcileLiveLayoutFromActiveEntryNow()
    }
    await syncPreservedLayoutToCanvas()
  }

  const scheduleForceFilterCacheRefresh = async (deferMs: number) => {
    if (deferMs > 0) {
      globalThis.setTimeout(() => {
        scheduleIdleTask(() => {
          void forceRefreshAllPreviewFilterCaches()
        })
      }, deferMs)
      return
    }
    await forceRefreshAllPreviewFilterCaches()
  }

  const initItemCacheMap = () => {
    const map: Record<string, { ref: KonvaNodeRef; loadFunc: () => void }> = {}
    for (const layer of setup.layers) {
      const load = loaders[layer.code as LayerCode<S>]
      const ref = canvas.refs[layer.refKey]!
      map[layer.code] = {
        ref,
        loadFunc: () => void (layer.code === 'kingdom' ? load(true) : load()),
      }
    }
    canvas.itemCacheMap.value = map
  }

  const reloadMaterial = (materialCode: string) => {
    const reloadCode = isNameSplitCharCode(materialCode)
      ? 'name'
      : isKingdomGlyphCode(materialCode)
        ? 'kingdom'
        : isCustomMaterialCode(canvas.info, materialCode)
          ? 'customMaterials'
          : materialCode
    canvas.canvasConfigs[reloadCode]?.loadFunc?.()
    canvas.itemCacheMap.value?.[reloadCode]?.loadFunc?.()
    if (isKingdomGlyphCode(materialCode)) {
      canvas.itemCacheMap.value?.[materialCode]?.loadFunc?.()
    }
    scheduleCanvasVisualSettled({ isCanvasLoading: () => diyStore.isCanvasLoading })
  }

  const { info, canvasRenderVersion } = canvas
  const initialLoadComplete = ref(false)

  const runReloadFromStore = () => {
    scheduleAfterUiPaint(() => {
      void (async () => {
        const reloadOptions = diyStore.consumeReloadOptions()
        const sequentialLoad = Boolean(
          reloadOptions.sequentialLoad ??
            (reloadOptions.skipRemount && shouldUseReducedCanvasQuality()),
        )
        if (!reloadOptions.skipRemount) {
          canvasRenderVersion.value++
        }
        try {
          await runLoadAllThenReconcileLayout(diyStore.reloadResetFlag, sequentialLoad)
          await reloadIncompleteLayers(diyStore.reloadResetFlag, sequentialLoad)
          await reconcilePreservedLayoutAfterIncompleteLayers(diyStore.reloadResetFlag)
          const deferMs = reloadOptions.deferFilterCacheRefresh
            ? getHistoryFilterCacheDeferMs()
            : 0
          await scheduleForceFilterCacheRefresh(deferMs)
        } finally {
          diyStore.settleReload()
        }
      })()
    })
  }

  /** 全量 reload：默认 bump 版本强制 Vue remount；历史恢复可走 skipRemount 轻量路径 */
  watch(() => [diyStore.reloadFlag], runReloadFromStore)

  const cancelPendingDebouncedReloads = setupWatches?.({
    info,
    loaders,
    canvas,
    loadAll,
    reloadMaterial,
    syncMaterialLayout: (code) => canvas.syncMaterialLayout(code),
    runLayerReload: (targets) => runLayerReload(loaders, targets),
    canvasRenderVersion,
    isInitialLoadComplete: () => initialLoadComplete.value,
  })

  onMounted(() => {
    initItemCacheMap()
    diyStore.markReloadConsumerReady()
    if (diyStore.hasPendingReloadSettlement()) {
      runReloadFromStore()
    }
    void (async () => {
      diyStore.beginCanvasBootstrap()
      try {
        const kind = historyStore.activeInfoKind
        if (!historyStore.bootstrappedKinds[kind]) {
          await diyStore.runWithLoading('bootstrap:history', '历史记录', () =>
            historyStore.ensureSessionRestored(kind),
          )
        }

        await runLoadAllThenReconcileLayout(false, false)
        await diyStore.runWithLoading('bootstrap:repair', '画布资源', async () => {
          await reloadIncompleteLayers(false, true)
          await reconcilePreservedLayoutAfterIncompleteLayers(false)
        })
        await nextTick()
      } catch (error) {
        console.error('[useDiyTemplate] loadAll failed', error)
      } finally {
        cancelPendingDebouncedReloads?.()
        initialLoadComplete.value = true
        diyStore.endCanvasBootstrap()
        scheduleCanvasVisualSettled({ isCanvasLoading: () => diyStore.isCanvasLoading })
      }
    })()
  })

  const refs = {} as { [K in LayerRefKey<S>]: KonvaNodeRef }
  for (const layer of setup.layers) {
    refs[layer.refKey as LayerRefKey<S>] = canvas.refs[layer.refKey]!
  }

  return {
    info: canvas.info,
    canvasConfigs: canvas.canvasConfigs,
    canvasRenderVersion: canvas.canvasRenderVersion,
    legendOutOfFrameRenderVersion: canvas.legendOutOfFrameRenderVersion,
    ...refs,
    syncMaterialLayout: canvas.syncMaterialLayout,
    schedulePreviewFilterCacheRefresh: canvas.schedulePreviewFilterCacheRefresh,
    reloadMaterial,
    syncPreservedLayoutToCanvas,
    registerSplitNameGroupRef: canvas.registerSplitNameGroupRef,
    registerKingdomGlyphRef: canvas.registerKingdomGlyphRef,
  }
}
