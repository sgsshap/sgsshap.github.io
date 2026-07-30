import {
  clearPresetKingdomWhenCustomTextFilled,
  isPresetKingdomActive,
} from '@/features/diy-card/composables/kingdomPreset'
import {
  ensureCustomKingdomSetup,
  hasCustomKingdomGlyphText,
  isCustomKingdomActive,
  isCustomShenKingdomActive,
  isMasterFlagActive,
  shouldCustomShenSkillUseKingdomColor,
  usesShenCardLayout,
  isDoubleKingdomRenderActive,
  resetCustomKingdomGlyphLayout,
  resetCustomKingdomSingleTextDefaults,
  resolveCustomKingdomSingleTextMode,
} from '@/features/diy-card/composables/doubleKingdom'
import { shouldTitleUseCustomKingdomColor } from '@/features/diy-card/utils/customTitleColor'
import {
  beginKingdomToggleCanvasBatch,
  endKingdomToggleCanvasBatch,
  isKingdomToggleCanvasBatchActive,
  registerKingdomToggleCanvasBatchHooks,
  resetKingdomToggleCanvasBatchHooks,
} from '@/features/diy-card/composables/kingdomToggleCanvasGate'
import { useDiyHistoryStore } from '@/features/diy-card/stores'
import { useDiyStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import {
  syncFrameSrcToKingdom,
  applyShenFrameKingdomGlyphColor,
  applyShenKingdomGlyphColorEnabled,
  syncShenFrameGlyphColorFlag,
} from '@/features/diy-card/utils/syncFrameKingdom'
import {
  resolveKingdomSelectionSignature,
} from '@/features/diy-card/utils/customKingdomGlyphColor'
import { scheduleCanvasVisualSettled } from '@/features/diy-card/composables/preview/canvasVisualSettled'
import { createBatchedLayerReload, runLayerReload } from '@/features/diy-card/composables/template/watchUtils'
import { resolveStageContentOriginFromDiy } from '@/features/diy-card/composables/konva/konvaStageEdgeSnap'
import { createDiyUnitConverters } from '@/features/diy-card/utils/canvas'
import { resetLegendImageLayoutOnPicChange } from '@/features/diy-card/utils/legendImageLayout'
import {
  resetOutOfFrameOnPicChange,
  shouldKeepLegendOutOfFrameLinkedToLegendImage,
  syncLegendOutOfFrameLayoutFromCanvas,
} from '@/features/diy-card/types/diy/outOfFrame'
import {
  isOutOfFrameEditorOpen,
  onOutOfFrameEditorClosed,
} from '@/features/diy-card/utils/historyShortcuts'
import {
  disableBottomInfoStrokeIfNotShenLayout,
  syncBottomInfoStrokeForShenLayout,
} from './layers/bottom-info'
import {
  isSkillsDescAutoSizeSyncing,
  resetSkillsDescMinHeightOnShenLayoutChange,
  syncQuoteFontSizeFromSkillsDesc,
} from './layout/skills-area/layout'
import { getSkillsAreaBlockLayoutSignature } from './layout/skills-area/layout'
import { resolveSkillsDescRowSpacingPt } from './layout/skills-area/scale'
import { resolveSkillsDescAutoOptimizeFlag, resolveSkillsDescAutoSizeFlag } from './constants/skills'
import {
  normalizeLegendSkillsDescContent,
  resolveSkillDescLayoutSignature,
} from './layers/skills-desc/formatDesc'
import { scheduleSkillDescShenBgImageFilterCacheRefresh } from './layers/skills-desc/skillDescShenBgCache'
import { refreshLegendOutOfFrameSkillOverlapHoles, invalidateLegendOutOfFrameComposite } from './layers/legend-out-of-frame'
import { refreshCustomMaterialSkillOverlapHoles } from './layers/custom-material/skillOverlapDisplay'
import { useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import { createSkillsAreaReloadCoordinator } from './layout/skills-area/skillsAreaReload'
import {
  scheduleSkillsNameSideImageFilterCacheRefresh,
  syncSkillsNameFrameTintToCanvasConfig,
} from './layers/skills-name/skillNameStage'
import {
  purgeKingdomGlyphPreviewState,
  resetKingdomCanvasPreviewShell,
} from './layers/kingdom/purgeKingdomGlyphPreview'
import { cancelSkillsAreaLayoutTasks } from './layout/skills-area/areaLayoutGate'
import {
  resolveCustomMaterialLayerPosition,
} from '@/features/diy-card/utils/customMaterial'
import { debounce, scheduleAfterSwitchTransition, scheduleAfterUiPaint } from '@/shared/utils/scheduling'
import {
  getSkillsConfigReloadDebounceMs,
  getSkillsDescContentReloadDebounceMs,
  shouldUseReducedCanvasQuality,
} from '@/shared/utils/deviceCapability'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { nextTick, onScopeDispose, watch } from 'vue'
import type { LayerReloadTarget } from '@/features/diy-card/composables/template/types'
import type { ZhuoyueLayerCode, ZhuoyueWatchContext } from './setup'

const mergeLayerReloadTargets = (
  targets: readonly LayerReloadTarget<ZhuoyueLayerCode>[],
): LayerReloadTarget<ZhuoyueLayerCode>[] => {
  const map = new Map<ZhuoyueLayerCode, LayerReloadTarget<ZhuoyueLayerCode>>()
  for (const target of targets) {
    const prev = map.get(target.code)
    map.set(target.code, {
      code: target.code,
      reset: Boolean(prev?.reset || target.reset),
    })
  }
  return [...map.values()]
}

/** 出血变化时仅同步像素坐标、不重建模板默认布局的图层 */
const BLEED_SYNC_LAYOUT_CODES = [
  'kingdom',
  'name',
  'title',
  'hp',
  'watermark',
  'package',
] as const satisfies readonly ZhuoyueLayerCode[]

/** 出血变化时按成品区（trim）重新布局的图层（宽高压 stageOrigin 计算） */
const BLEED_RELOAD_LAYOUT_CODES = [
  'skillsDesc',
  'skillsName',
  'bottomInfo',
] as const satisfies readonly ZhuoyueLayerCode[]

const TEXT_LAYER_RELOAD_DEBOUNCE_MS = shouldUseReducedCanvasQuality() ? 320 : 180
/** 技能区配置项变更（间距/字号/衍生标识等） */
const SKILLS_CONFIG_RELOAD_DEBOUNCE_MS = getSkillsConfigReloadDebounceMs()
/** 技能描述正文变更（需联动技能名位置） */
const SKILLS_DESC_CONTENT_DEBOUNCE_MS = getSkillsDescContentReloadDebounceMs()

/**
 * 卓越模板：所有数据联动 watch
 *
 * 直接写 Vue watch，可按需拆分、加条件、组合多个 loader，不再受 watch-rules 表结构限制。
 */
export function setupTemplateWatches(ctx: ZhuoyueWatchContext) {
  const {
    info,
    loaders,
    syncMaterialLayout,
    canvas,
    isInitialLoadComplete,
  } = ctx
  const { schedule: scheduleLayerReload, cancel: cancelLayerReload } =
    createBatchedLayerReload(loaders)
  const { schedule: scheduleToggleLayerReload, cancel: cancelToggleLayerReload } =
    createBatchedLayerReload(loaders, { defer: 'switchTransition' })
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const historyStore = useDiyHistoryStore()
  /** 卓越模板仅武将牌：收窄 infoStore 联合类型，同时保持对 Pinia ref 的响应式读取 */
  const legendBaseInfo = () => infoStore.baseInfo as LegendInfo['baseInfo']
  const legendRenderItems = () => infoStore.renderConfig.items as LegendInfo['renderConfig']['items']

  /** 首屏 loadAll 完成前、历史恢复、画布 batch 期间跳过 watch 增量重载，避免与全量加载竞态 */
  const canReloadLayersCore = () =>
    !historyStore.isRestoring &&
    !diyStore.isHistoryRestoreLoading &&
    isInitialLoadComplete()

  /** 含 batch 门闩：百科/势力协调重载期间抑制联动 watch */
  const canReloadLayers = () =>
    canReloadLayersCore() && !isKingdomToggleCanvasBatchActive()

  const guardedScheduleLayerReload: typeof scheduleLayerReload = (targets) => {
    if (!canReloadLayers()) return
    scheduleLayerReload(targets)
  }

  /** 详细设置开关：等 n-switch 动画结束后再重载画布 */
  const guardedScheduleToggleLayerReload: typeof scheduleLayerReload = (targets) => {
    if (!canReloadLayers()) return
    scheduleToggleLayerReload(targets)
  }

  /** 出框编辑器打开期间延后主画布 legendOutOfFrame 重载，关闭后再 flush，避免 iOS 双 canvas 内存峰值 */
  let pendingLegendOutOfFrameReload = false
  let pendingLegendOutOfFrameFullRecover = false
  let pendingLegendOutOfFrameCommitLayout = false
  let pendingLegendOutOfFrameReset = false
  let bleedLayoutSyncToken = 0
  let fullModeLayoutSyncToken = 0

  const runLegendOutOfFrameReloadNow = async (options?: {
    commitLayoutToHistory?: boolean
    reset?: boolean
  }) => {
    if (!canReloadLayers()) return
    await runLayerReload(loaders, [
      { code: 'legendOutOfFrame', reset: Boolean(options?.reset ?? options?.commitLayoutToHistory) },
    ])
    await nextTick()
    if (historyStore.bootstrappedKinds[historyStore.activeInfoKind]) {
      if (options?.commitLayoutToHistory) {
        historyStore.syncLayoutSnapshotNow()
      } else {
        historyStore.reconcileLiveLayoutFromActiveEntryNow()
      }
    }
    refreshSkillOverlapHoles()
    canvas.legendOutOfFrameRenderVersion.value++
    notifyCanvasVisualSettled()
  }

  const flushPendingLegendOutOfFrameReload = () => {
    if (!pendingLegendOutOfFrameReload) return
    const fullRecover = pendingLegendOutOfFrameFullRecover
    const commitLayout = pendingLegendOutOfFrameCommitLayout
    const resetLayout = pendingLegendOutOfFrameReset
    pendingLegendOutOfFrameReload = false
    pendingLegendOutOfFrameFullRecover = false
    pendingLegendOutOfFrameCommitLayout = false
    pendingLegendOutOfFrameReset = false
    scheduleAfterUiPaint(() => {
      requestAnimationFrame(() => {
        if (fullRecover) {
          void runLegendOutOfFrameReloadNow({
            commitLayoutToHistory: commitLayout,
            reset: resetLayout,
          })
          return
        }
        void runLayerReload(loaders, [
          { code: 'legendOutOfFrame', reset: resetLayout },
        ]).finally(() => {
          refreshSkillOverlapHoles()
          notifyCanvasVisualSettled()
        })
      })
    })
  }

  const scheduleLegendOutOfFrameReload = (options?: {
    fullRecover?: boolean
    commitLayoutToHistory?: boolean
    reset?: boolean
  }) => {
    if (!canReloadLayers()) return
    if (isOutOfFrameEditorOpen()) {
      pendingLegendOutOfFrameReload = true
      pendingLegendOutOfFrameFullRecover =
        pendingLegendOutOfFrameFullRecover || Boolean(options?.fullRecover)
      pendingLegendOutOfFrameCommitLayout =
        pendingLegendOutOfFrameCommitLayout || Boolean(options?.commitLayoutToHistory)
      pendingLegendOutOfFrameReset =
        pendingLegendOutOfFrameReset || Boolean(options?.reset ?? options?.commitLayoutToHistory)
      return
    }
    if (options?.fullRecover) {
      void runLegendOutOfFrameReloadNow({
        commitLayoutToHistory: options.commitLayoutToHistory,
        reset: options.reset,
      })
      return
    }
    guardedScheduleLayerReload([
      { code: 'legendOutOfFrame', reset: Boolean(options?.reset) },
    ])
  }

  const disposeOutOfFrameEditorCloseListener = onOutOfFrameEditorClosed(
    flushPendingLegendOutOfFrameReload,
  )

  let cancelKingdomCoordinatedDefer: (() => void) | undefined
  let lastFrameSrcForLayout = info.renderConfig.items.frame.src

  const resolveCardLayoutKey = (legendInfo: LegendInfo) =>
    [
      usesShenCardLayout(legendInfo) ? 'shen' : 'normal',
      isDoubleKingdomRenderActive(legendInfo) ? 'double' : 'single',
      isCustomKingdomActive(legendInfo) ? 'custom' : 'preset',
    ].join(':')

  let lastCardLayoutKey = resolveCardLayoutKey(info)
  let lastUsesShenCardLayout = usesShenCardLayout(info)

  const syncLayoutTrackingSnapshot = () => {
    lastFrameSrcForLayout = legendRenderItems().frame.src
    lastCardLayoutKey = resolveCardLayoutKey(info)
    lastUsesShenCardLayout = usesShenCardLayout(info)
  }

  const CUSTOM_KINGDOM_TOGGLE_RELOAD_TARGETS = [
    { code: 'frame' as const },
    { code: 'kingdom' as const, reset: true },
    { code: 'hp' as const, reset: true },
    /** 重绘技能区布局，但保留用户已调的字号/间距等排版配置 */
    { code: 'skillsDesc' as const },
    { code: 'skillsName' as const, reset: true },
    { code: 'title' as const, reset: true },
  ] as const

  /** 边框布局切换时需联动 reset 的图层（与 frame.src watch 一致） */
  const buildFrameLayoutCoupledReloadTargets = (): LayerReloadTarget<ZhuoyueLayerCode>[] => [
    { code: 'frame', reset: true },
    { code: 'name', reset: true },
    { code: 'title', reset: true },
    { code: 'kingdom', reset: true },
    { code: 'hp', reset: true },
    { code: 'skillsDesc' },
    { code: 'skillsName', reset: true },
    { code: 'bottomInfo', reset: true },
    { code: 'package', reset: true },
  ]

  /** 预设势力 ↔ 神：与 frame.src watch 同目标，但走协调 batch，避免多路 reload 与中途写历史 */
  const reloadAfterPresetKingdomShenTransition = () => {
    const previousFrameSrc = lastFrameSrcForLayout
    applyFrameLayoutTransitionSideEffects(previousFrameSrc)
    reloadAfterPresetKingdomChange(buildFrameLayoutCoupledReloadTargets())
  }

  const reloadAfterPresetKingdomChange = (
    targets: readonly LayerReloadTarget<ZhuoyueLayerCode>[],
  ) => {
    syncLayoutTrackingSnapshot()
    if (!canReloadLayersCore()) return
    if (!isKingdomToggleCanvasBatchActive()) {
      beginKingdomToggleCanvasBatch()
    }
    scheduleKingdomCoordinatedReload(targets, KINGDOM_TOGGLE_REFRESH_CODES)
  }

  /** 自定义势力字变更时联动 chrome（kingdom_frame、hp 等着色在 load 时烘焙） */
  const buildCustomKingdomTextCoupledReloadTargets = (): LayerReloadTarget<ZhuoyueLayerCode>[] => [
    { code: 'frame' },
    { code: 'kingdom', reset: true },
    { code: 'hp', reset: true },
  ]

  const applyFrameLayoutTransitionSideEffects = (previousFrameSrc: string) => {
    const frameSrc = legendRenderItems().frame.src
    const frameLayoutChanged = previousFrameSrc !== frameSrc
    if (frameLayoutChanged) {
      applyShenFrameKingdomGlyphColor(info, previousFrameSrc)
      disableBottomInfoStrokeIfNotShenLayout(info)
      if (hasCustomKingdomGlyphText(info)) {
        resetCustomKingdomSingleTextDefaults(info)
      }
    } else if (!isCustomKingdomActive(info) && frameSrc?.trim() === 'shen') {
      syncShenFrameGlyphColorFlag(info)
    }
    if (usesShenCardLayout(info) && info.baseInfo.masterFlag) {
      info.baseInfo.masterFlag = false
    }
    return frameLayoutChanged
  }

  const needsFullCardLayoutReload = (previousFrameSrc: string) =>
    applyFrameLayoutTransitionSideEffects(previousFrameSrc) ||
    lastCardLayoutKey !== resolveCardLayoutKey(info)

  const KINGDOM_TOGGLE_REFRESH_CODES: ZhuoyueLayerCode[] = [
    'frame',
    'hp',
    'kingdom',
    'skillsName',
    'skillsDesc',
  ]

  const DOUBLE_KINGDOM_TOGGLE_RELOAD_TARGETS = [
    { code: 'frame' as const },
    { code: 'kingdom' as const, reset: true },
    { code: 'hp' as const, reset: true },
    { code: 'title' as const },
    { code: 'skillsDesc' as const },
    { code: 'skillsName' as const },
  ] as const

  /** 主公开关：刷新 frame/hp/势力字等 chrome；称号仅换色，武将名/称号位置不 reset */
  const buildMasterFlagChromeReloadTargets = (): LayerReloadTarget<ZhuoyueLayerCode>[] => [
    { code: 'frame' },
    { code: 'kingdom', reset: true },
    { code: 'hp', reset: true },
    { code: 'skillsDesc' },
    { code: 'skillsName', reset: true },
    { code: 'title' },
  ]

  const shouldSkipKingdomLayoutWatch = () => isKingdomToggleCanvasBatchActive()

  const KINGDOM_TOGGLE_LOADING_IDS = [
    'frame',
    'hp',
    'kingdom',
    'skillsDesc',
    'skillsName',
  ] as const satisfies readonly ZhuoyueLayerCode[]

  const releaseKingdomToggleLoadingTasks = () => {
    for (const taskId of KINGDOM_TOGGLE_LOADING_IDS) {
      diyStore.releaseLoadingTask(taskId)
    }
  }

  let kingdomCoordinatedReloadEpoch = 0

  const { getFilters } = useKonvaBrightnessFilters()

  const refreshSkillsNameKingdomTintIfActive = () => {
    if (!isCustomKingdomActive(info)) return
    const synced = syncSkillsNameFrameTintToCanvasConfig(
      canvas.canvasConfigs.skillsName,
      info,
      getFilters,
    )
    if (synced) canvas.canvasConfigs.skillsName = synced
    scheduleSkillsNameSideImageFilterCacheRefresh(synced, info, getFilters)
  }

  const debouncedRefreshSkillsNameKingdomTint = debounce(
    refreshSkillsNameKingdomTintIfActive,
    shouldUseReducedCanvasQuality() ? 72 : 48,
  )

  const notifyCanvasVisualSettled = () => {
    scheduleCanvasVisualSettled({ isCanvasLoading: () => diyStore.isCanvasLoading })
    debouncedRefreshSkillsNameKingdomTint()
  }

  let lastNameCharCount = info.baseInfo.name.length
  let lastTitleCharCount = info.baseInfo.title.length
  const debouncedReloadName = debounce(() => {
    if (!canReloadLayers()) return
    const charCount = info.baseInfo.name.length
    const resetLayout =
      charCount !== lastNameCharCount || usesShenCardLayout(info) !== lastUsesShenCardLayout
    lastNameCharCount = charCount
    void Promise.resolve(loaders.name(resetLayout)).finally(() => {
      lastUsesShenCardLayout = usesShenCardLayout(info)
      notifyCanvasVisualSettled()
    })
  }, TEXT_LAYER_RELOAD_DEBOUNCE_MS)

  const debouncedReloadTitle = debounce(() => {
    if (!canReloadLayers()) return
    const charCount = info.baseInfo.title.length
    const resetLayout =
      charCount !== lastTitleCharCount || usesShenCardLayout(info) !== lastUsesShenCardLayout
    lastTitleCharCount = charCount
    void Promise.resolve(loaders.title(resetLayout)).finally(() => {
      lastUsesShenCardLayout = usesShenCardLayout(info)
      notifyCanvasVisualSettled()
    })
  }, TEXT_LAYER_RELOAD_DEBOUNCE_MS)

  const reloadWatermarkLayer = () => {
    if (!canReloadLayers()) return
    void Promise.resolve(loaders.watermark()).finally(notifyCanvasVisualSettled)
  }

  const debouncedReloadWatermark = debounce(reloadWatermarkLayer, TEXT_LAYER_RELOAD_DEBOUNCE_MS)

  const debouncedReloadPackage = debounce((reset = false) => {
    if (!canReloadLayers()) return
    void Promise.resolve(loaders.package(reset)).finally(notifyCanvasVisualSettled)
  }, TEXT_LAYER_RELOAD_DEBOUNCE_MS)

  const debouncedReloadKingdom = debounce((reset = false) => {
    if (!canReloadLayers()) return
    void Promise.resolve(loaders.kingdom(reset)).finally(notifyCanvasVisualSettled)
  }, TEXT_LAYER_RELOAD_DEBOUNCE_MS)

  const refreshSkillOverlapHoles = () => {
    if (isOutOfFrameEditorOpen()) return
    void refreshLegendOutOfFrameSkillOverlapHoles(
      canvas.canvasConfigs,
      info,
      canvas.props,
      diyStore.mmToPx,
      diyStore.maxBleed,
    ).then((refreshed) => {
      if (!refreshed) return
      canvas.legendOutOfFrameRenderVersion.value++
      canvas.schedulePreviewFilterCacheRefresh('legendOutOfFrame', { force: true })
    })
    refreshCustomMaterialSkillOverlapHolesOnly()
  }

  const refreshCustomMaterialSkillOverlapHolesOnly = () => {
    if (isOutOfFrameEditorOpen()) return
    void refreshCustomMaterialSkillOverlapHoles(
      canvas.canvasConfigs,
      info,
      canvas.props,
      diyStore.mmToPx,
      diyStore.maxBleed,
    ).then((refreshed) => {
      if (!refreshed) return
      canvas.schedulePreviewFilterCacheRefresh('customMaterials', { force: true })
    })
  }

  const skillsAreaReload = createSkillsAreaReloadCoordinator(loaders, {
    canReload: canReloadLayers,
    onSettled: () => {
      refreshSkillOverlapHoles()
      notifyCanvasVisualSettled()
    },
  })

  let cancelToggleSkillsAreaDefer: (() => void) | undefined

  const scheduleSkillsAreaReload = (
    reset: boolean,
    mode: 'config' | 'desc' | 'name',
    defer: 'switch' | 'none' = mode === 'desc' ? 'none' : 'switch',
  ) => {
    if (mode === 'config') {
      debouncedReloadSkillsFromEdit.cancel()
    } else if (mode === 'desc') {
      debouncedReloadSkills.cancel()
      debouncedReloadSkillsFromEdit.cancel()
    } else {
      debouncedReloadSkills.cancel()
      debouncedReloadSkillsFromEdit.cancel()
    }

    const enqueue = () => {
      skillsAreaReload.schedule({
        reset,
        mode: mode === 'config' ? 'full' : mode,
      })
    }

    if (mode === 'desc' || defer === 'none') {
      enqueue()
      return
    }

    cancelToggleSkillsAreaDefer?.()
    cancelToggleSkillsAreaDefer = scheduleAfterSwitchTransition(() => {
      cancelToggleSkillsAreaDefer = undefined
      enqueue()
    })
  }

  const debouncedReloadSkills = debounce((reset = false) => {
    scheduleSkillsAreaReload(reset, 'config', 'none')
  }, SKILLS_CONFIG_RELOAD_DEBOUNCE_MS)

  const debouncedReloadSkillsLayout = debounce((reset = false) => {
    scheduleSkillsAreaReload(reset, 'config', 'none')
  }, SKILLS_CONFIG_RELOAD_DEBOUNCE_MS)

  type SkillsEditReloadIntent = 'desc' | 'name' | 'full'
  let skillsEditReloadIntent: SkillsEditReloadIntent = 'desc'

  const mergeSkillsEditReloadIntent = (next: SkillsEditReloadIntent): SkillsEditReloadIntent => {
    if (skillsEditReloadIntent === 'full' || next === 'full') return 'full'
    if (skillsEditReloadIntent !== next) return 'full'
    return next
  }

  const queueSkillsEditReloadIntent = (next: SkillsEditReloadIntent) => {
    skillsEditReloadIntent = mergeSkillsEditReloadIntent(next)
    debouncedReloadSkillsFromEdit()
  }

  /** 技能名/描述/引言连打：合并意图，desc/name 分开 reload，仅同时变更时才 full */
  const debouncedReloadSkillsFromEdit = debounce((reset = false) => {
    if (!canReloadLayers()) return
    const intent = skillsEditReloadIntent
    skillsEditReloadIntent = 'desc'
    normalizeLegendSkillsDescContent(info)
    if (intent === 'name') {
      scheduleSkillsAreaReload(reset, 'name', 'none')
      return
    }
    scheduleSkillsAreaReload(reset, intent === 'full' ? 'config' : 'desc', 'none')
  }, SKILLS_DESC_CONTENT_DEBOUNCE_MS)

  const cancelKingdomTogglePendingReloads = () => {
    kingdomCoordinatedReloadEpoch += 1
    cancelKingdomCoordinatedDefer?.()
    cancelToggleSkillsAreaDefer?.()
    cancelToggleSkillsAreaDefer = undefined
    cancelLayerReload()
    cancelToggleLayerReload()
    debouncedReloadName.cancel()
    debouncedReloadTitle.cancel()
    debouncedReloadWatermark.cancel()
    debouncedReloadPackage.cancel()
    debouncedReloadSkills.cancel()
    debouncedReloadSkillsLayout.cancel()
    debouncedReloadSkillsFromEdit.cancel()
    debouncedReloadSkillsName.cancel()
    debouncedReloadSkillsNameFromToggle.cancel()
    debouncedReloadBottomInfo.cancel()
    debouncedReloadKingdom.cancel()
    skillsAreaReload.cancel()
    releaseKingdomToggleLoadingTasks()
    diyStore.releaseLoadingTask('legendImage')
  }

  /** batch 结束时只清 debounce，不 bump epoch / 不释放 loading */
  const cancelDebouncedReloadsQueuedDuringBatch = () => {
    debouncedReloadName.cancel()
    debouncedReloadTitle.cancel()
    debouncedReloadWatermark.cancel()
    debouncedReloadPackage.cancel()
    debouncedReloadSkills.cancel()
    debouncedReloadSkillsLayout.cancel()
    debouncedReloadSkillsFromEdit.cancel()
    debouncedReloadSkillsName.cancel()
    debouncedReloadSkillsNameFromToggle.cancel()
    debouncedReloadBottomInfo.cancel()
    debouncedReloadKingdom.cancel()
  }

  const runKingdomCoordinatedLayerReload = async (
    targets: readonly LayerReloadTarget<ZhuoyueLayerCode>[],
  ) => {
    const skillCodes = new Set<ZhuoyueLayerCode>(['skillsDesc', 'skillsName'])
    const skillTargets = targets.filter((target) => skillCodes.has(target.code))
    const otherTargets = targets.filter((target) => !skillCodes.has(target.code))

    if (shouldUseReducedCanvasQuality()) {
      for (const target of otherTargets) {
        await runLayerReload(loaders, [target])
      }
      if (skillTargets.length) {
        await runLayerReload(loaders, skillTargets)
      }
      return
    }
    await runLayerReload(loaders, [...targets])
  }

  registerKingdomToggleCanvasBatchHooks({
    onBegin: cancelKingdomTogglePendingReloads,
    onEnd: () => {
      cancelDebouncedReloadsQueuedDuringBatch()
      syncLayoutTrackingSnapshot()
      void historyStore.syncAndPersistActiveEntry()
    },
  })

  const scheduleKingdomCoordinatedReload = (
    targets: readonly LayerReloadTarget<ZhuoyueLayerCode>[],
    refreshCodes: ZhuoyueLayerCode[] = ['frame', 'hp', 'skillsName', 'skillsDesc'],
  ) => {
    if (!canReloadLayersCore()) {
      releaseKingdomToggleLoadingTasks()
      endKingdomToggleCanvasBatch()
      return
    }
    const reloadEpoch = kingdomCoordinatedReloadEpoch
    cancelKingdomCoordinatedDefer?.()

    cancelKingdomCoordinatedDefer = scheduleAfterSwitchTransition(() => {
      if (reloadEpoch !== kingdomCoordinatedReloadEpoch) return
      cancelKingdomCoordinatedDefer = undefined
      void runKingdomCoordinatedLayerReload(targets)
        .catch(() => undefined)
        .finally(() => {
          if (reloadEpoch !== kingdomCoordinatedReloadEpoch) {
            releaseKingdomToggleLoadingTasks()
            return
          }
          releaseKingdomToggleLoadingTasks()
          for (const code of refreshCodes) {
            canvas.schedulePreviewFilterCacheRefresh(
              code,
              code === 'kingdom' ? { force: true } : undefined,
            )
          }
          scheduleSkillDescShenBgImageFilterCacheRefresh(canvas.canvasConfigs.skillsDesc, {
            force: true,
          })
          endKingdomToggleCanvasBatch()
          notifyCanvasVisualSettled()
          scheduleAfterUiPaint(syncLayoutTrackingSnapshot)
        })
    })
  }

  const reloadAfterCustomKingdomToggle = () => {
    const previousFrameSrc = lastFrameSrcForLayout
    const needsFullReset = needsFullCardLayoutReload(previousFrameSrc)
    const targets = needsFullReset
      ? buildFrameLayoutCoupledReloadTargets()
      : [...CUSTOM_KINGDOM_TOGGLE_RELOAD_TARGETS]
    scheduleKingdomCoordinatedReload(targets, KINGDOM_TOGGLE_REFRESH_CODES)
  }

  /**
   * 预设势力 / 主公 / 自定义势力色联动 chrome（kingdom_frame、hp、势力字、技能框）。
   * 与「先开主公再选预设」同路径：协调 batch reload 结束后再 remount（见 index.vue batch onEnd）。
   */
  const reloadKingdomChromePresentation = () => {
    if (!canReloadLayersCore()) {
      endKingdomToggleCanvasBatch()
      return
    }
    ensureCustomKingdomSetup(info)
    syncFrameSrcToKingdom(info)
    if (!isKingdomToggleCanvasBatchActive()) {
      beginKingdomToggleCanvasBatch()
    }
    scheduleKingdomCoordinatedReload(
      buildFrameLayoutCoupledReloadTargets(),
      KINGDOM_TOGGLE_REFRESH_CODES,
    )
  }

  /** 自定义势力：神/双势力/布局模式切换，统一全量 reset frame 及关联图层 */
  const reloadAfterCustomKingdomLayoutModeChange = () => {
    const previousFrameSrc = lastFrameSrcForLayout
    applyFrameLayoutTransitionSideEffects(previousFrameSrc)
    scheduleKingdomCoordinatedReload(buildFrameLayoutCoupledReloadTargets(), KINGDOM_TOGGLE_REFRESH_CODES)
  }

  const applyCustomKingdomShenTransitionSideEffects = (kingdom: string, oldKingdom: string) => {
    if (kingdom !== 'shen' && oldKingdom !== 'shen') return
    syncBottomInfoStrokeForShenLayout(info)
    disableBottomInfoStrokeIfNotShenLayout(info)
    resetCustomKingdomGlyphLayout(kingdom === 'shen')
    if (legendRenderItems().frame.src?.trim() === 'shen') {
      syncShenFrameGlyphColorFlag(info)
    } else {
      applyShenKingdomGlyphColorEnabled(info, kingdom === 'shen')
    }
  }

  const scheduleCustomKingdomLayoutModeReload = (
    kingdom: string,
    oldKingdom: string,
    options?: { doubleTurnedOff?: boolean },
  ) => {
    if (options?.doubleTurnedOff) {
      purgeKingdomGlyphPreviewState(canvas)
      resetCustomKingdomGlyphLayout(kingdom === 'shen')
    }
    if (!canReloadLayersCore()) return
    if (!isKingdomToggleCanvasBatchActive()) {
      beginKingdomToggleCanvasBatch()
    }
    applyCustomKingdomShenTransitionSideEffects(kingdom, oldKingdom)
    reloadAfterCustomKingdomLayoutModeChange()
  }

  const reloadAfterMasterFlagToggle = () => {
    if (!canReloadLayersCore()) {
      endKingdomToggleCanvasBatch()
      return
    }
    if (isCustomKingdomActive(info) || isPresetKingdomActive(info)) {
      ensureCustomKingdomSetup(info)
      syncFrameSrcToKingdom(info)
    }
    if (!isKingdomToggleCanvasBatchActive()) {
      beginKingdomToggleCanvasBatch()
    }
    syncLayoutTrackingSnapshot()
    scheduleKingdomCoordinatedReload(
      buildMasterFlagChromeReloadTargets(),
      KINGDOM_TOGGLE_REFRESH_CODES,
    )
  }

  const reloadAfterDoubleKingdomToggle = () => {
    const previousFrameSrc = lastFrameSrcForLayout
    const needsFullReset = needsFullCardLayoutReload(previousFrameSrc)
    let targets: LayerReloadTarget<ZhuoyueLayerCode>[] = needsFullReset
      ? buildFrameLayoutCoupledReloadTargets()
      : [...DOUBLE_KINGDOM_TOGGLE_RELOAD_TARGETS]
    if (!needsFullReset && info.baseInfo.kingdom === 'shen') {
      targets = mergeLayerReloadTargets([
        ...targets,
        { code: 'name', reset: true },
        { code: 'title', reset: true },
      ])
    }
    scheduleKingdomCoordinatedReload(mergeLayerReloadTargets(targets), KINGDOM_TOGGLE_REFRESH_CODES)
  }

  const resolveKingdomConfigPartialReloadTargets = (
    value: readonly [
      string,
      string,
      string,
      boolean,
      boolean,
      1 | 2,
      number,
      boolean,
      string,
      string,
    ],
    oldValue: readonly [
      string,
      string,
      string,
      boolean,
      boolean,
      1 | 2,
      number,
      boolean,
      string,
      string,
    ],
  ): LayerReloadTarget<ZhuoyueLayerCode>[] => {
    const targets: LayerReloadTarget<ZhuoyueLayerCode>[] = []
    const colorChanged =
      value[0] !== oldValue[0] ||
      value[1] !== oldValue[1] ||
      value[2] !== oldValue[2]
    const titleColorFlagChanged = value[4] !== oldValue[4]
    const fontChanged = value[5] !== oldValue[5]
    const spacingChanged = value[6] !== oldValue[6]

    if (fontChanged || spacingChanged) {
      targets.push({ code: 'kingdom', reset: true })
    }
    if (titleColorFlagChanged) {
      targets.push({ code: 'title' })
    }
    if (colorChanged) {
      targets.push(
        { code: 'frame' },
        { code: 'kingdom', reset: true },
        { code: 'hp', reset: true },
        { code: 'skillsDesc' },
        // 与 hp/frame 一致：reload 时烘焙着色；batch 结束后 notifyCanvasVisualSettled 再补刷 ref cache
        { code: 'skillsName' },
      )
      if (shouldTitleUseCustomKingdomColor(info)) {
        targets.push({ code: 'title' })
      }
    }
    return mergeLayerReloadTargets(targets)
  }

  const debouncedReloadBottomInfo = debounce((reset = false) => {
    if (!canReloadLayers()) return
    void Promise.resolve(loaders.bottomInfo(reset)).finally(notifyCanvasVisualSettled)
  }, TEXT_LAYER_RELOAD_DEBOUNCE_MS)

  /** 技能框素材跟势力/边框/自定义色；走 infoStore 直读 ref，避免 info 代理导致 watch 不触发 */
  const debouncedReloadSkillsName = debounce((reset = false) => {
    if (!canReloadLayers()) return
    scheduleSkillsAreaReload(reset, 'name', 'none')
  }, SKILLS_CONFIG_RELOAD_DEBOUNCE_MS)

  const debouncedReloadSkillsNameFromToggle = debounce((reset = false) => {
    if (!canReloadLayers()) return
    scheduleSkillsAreaReload(reset, 'name', 'switch')
  }, SKILLS_CONFIG_RELOAD_DEBOUNCE_MS)

  onScopeDispose(() => {
    disposeOutOfFrameEditorCloseListener()
    resetKingdomToggleCanvasBatchHooks()
    endKingdomToggleCanvasBatch()
    cancelLayerReload()
    cancelToggleLayerReload()
    cancelKingdomCoordinatedDefer?.()
    cancelToggleSkillsAreaDefer?.()
    debouncedReloadName.cancel()
    debouncedReloadTitle.cancel()
    debouncedReloadWatermark.cancel()
    debouncedReloadPackage.cancel()
    debouncedReloadKingdom.cancel()
    debouncedReloadSkills.cancel()
    debouncedReloadSkillsLayout.cancel()
    debouncedReloadSkillsFromEdit.cancel()
    debouncedReloadSkillsName.cancel()
    debouncedReloadSkillsNameFromToggle.cancel()
    debouncedReloadBottomInfo.cancel()
    debouncedRefreshSkillsNameKingdomTint.cancel()
  })

  const cancelPendingDebouncedReloads = () => {
    debouncedReloadName.cancel()
    debouncedReloadTitle.cancel()
    debouncedReloadWatermark.cancel()
    debouncedReloadPackage.cancel()
    debouncedReloadKingdom.cancel()
    debouncedReloadSkills.cancel()
    debouncedReloadSkillsLayout.cancel()
    debouncedReloadSkillsFromEdit.cancel()
    debouncedReloadSkillsName.cancel()
    debouncedReloadSkillsNameFromToggle.cancel()
    debouncedReloadBottomInfo.cancel()
    skillsAreaReload.cancel()
    cancelLayerReload()
    cancelToggleLayerReload()
    cancelKingdomCoordinatedDefer?.()
    cancelToggleSkillsAreaDefer?.()
    cancelSkillsAreaLayoutTasks()
  }

  watch(
    () => {
      const kingdom = info.renderConfig.items.kingdom
      const bi = legendBaseInfo()
      return [
        kingdom.customColor,
        kingdom.customColorPrimary,
        kingdom.customColorSecondary,
        kingdom.customKingdomFlag,
        kingdom.customShenTitleColorFlag,
        kingdom.customFont,
        kingdom.customDualCharSpacingMm,
        kingdom.doubleKingdom,
        bi.doubleKingdom?.join('\0') ?? '',
        bi.kingdom,
      ] as const
    },
    (value, oldValue) => {
      if (!oldValue) return

      const customFlagTurnedOff = oldValue[3] === true && value[3] === false
      const customFlagTurnedOn = oldValue[3] === false && value[3] === true
      if (customFlagTurnedOff || customFlagTurnedOn) {
        if (!canReloadLayersCore()) return
        if (!isKingdomToggleCanvasBatchActive()) {
          beginKingdomToggleCanvasBatch()
        }
        reloadAfterCustomKingdomToggle()
        return
      }

      const doubleKingdomChanged =
        value[7] !== oldValue[7] || value[8] !== oldValue[8]
      const doubleTurnedOff = oldValue[7] === true && value[7] === false
      const kingdomShenTransition =
        value[9] !== oldValue[9] &&
        (value[9] === 'shen' || oldValue[9] === 'shen')
      if (doubleKingdomChanged || kingdomShenTransition) {
        if (isCustomKingdomActive(info)) {
          scheduleCustomKingdomLayoutModeReload(value[9], oldValue[9], { doubleTurnedOff })
          return
        }
        if (kingdomShenTransition && hasCustomKingdomGlyphText(info)) {
          if (!canReloadLayersCore()) return
          applyCustomKingdomShenTransitionSideEffects(value[9], oldValue[9])
          if (!isKingdomToggleCanvasBatchActive()) {
            beginKingdomToggleCanvasBatch()
          }
          reloadAfterCustomKingdomLayoutModeChange()
          return
        }
        if (doubleKingdomChanged) {
          if (!canReloadLayersCore()) return
          if (doubleTurnedOff) {
            purgeKingdomGlyphPreviewState(canvas)
          }
          if (!isKingdomToggleCanvasBatchActive()) {
            beginKingdomToggleCanvasBatch()
          }
          reloadAfterDoubleKingdomToggle()
          return
        }
      }

      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) {
        const colorChanged =
          value[0] !== oldValue[0] ||
          value[1] !== oldValue[1] ||
          value[2] !== oldValue[2]
        if (
          colorChanged &&
          (isCustomKingdomActive(info) || shouldCustomShenSkillUseKingdomColor(info))
        ) {
          void Promise.resolve(loaders.skillsDesc(false)).finally(() => {
            canvas.schedulePreviewFilterCacheRefresh('skillsDesc', { force: true })
            scheduleSkillDescShenBgImageFilterCacheRefresh(canvas.canvasConfigs.skillsDesc, {
              force: true,
            })
            notifyCanvasVisualSettled()
          })
        }
        return
      }
      if (isCustomKingdomActive(info)) {
        syncFrameSrcToKingdom(info)
      }
      const targets = resolveKingdomConfigPartialReloadTargets(value, oldValue)
      if (targets.length) {
        const titleColorFlagChanged = value[4] !== oldValue[4]
        const colorChanged =
          value[0] !== oldValue[0] ||
          value[1] !== oldValue[1] ||
          value[2] !== oldValue[2]
        const layoutChanged =
          value[5] !== oldValue[5] || value[6] !== oldValue[6]
        if (titleColorFlagChanged && !colorChanged && !layoutChanged) {
          guardedScheduleToggleLayerReload(targets)
        } else {
          guardedScheduleLayerReload(targets)
        }
      }
    },
  )

  watch(
    () => {
      const bi = legendBaseInfo()
      const items = legendRenderItems()
      const kingdom = items.kingdom
      return [
        bi.kingdom,
        bi.masterFlag,
        bi.doubleKingdom?.join('\0') ?? '',
        items.frame.src,
        kingdom.doubleKingdom,
        kingdom.customKingdomFlag,
        kingdom.customColor,
        kingdom.customColorPrimary,
        kingdom.customColorSecondary,
      ] as const
    },
    (value, oldValue) => {
      if (historyStore.isRestoring || !oldValue) return
      if (shouldSkipKingdomLayoutWatch()) return
      const previousKingdom =
        oldValue[4] && oldValue[2]
          ? (oldValue[2].split('\0').find((k: string) => k && k !== 'shen') ?? oldValue[0])
          : oldValue[0]
      syncFrameSrcToKingdom(info, { previousKingdom })
      const reset = value[0] === 'shen' || oldValue[0] === 'shen'
      const kingdomChanged = value[0] !== oldValue[0]
      debouncedReloadSkills(reset || kingdomChanged)
    },
  )

  watch(
    () => [diyStore.bleedFlag, diyStore.bleedValue],
    () => {
      if (!canReloadLayers()) return
      const shouldReflowLegendImage = diyStore.consumeLegendImageReflow()
      const linkedOutOfFrame = shouldKeepLegendOutOfFrameLinkedToLegendImage(info)
      const bleedLayoutSyncGeneration = ++bleedLayoutSyncToken
      void (async () => {
        await Promise.resolve(loaders.legendImage(shouldReflowLegendImage))
        if (bleedLayoutSyncGeneration !== bleedLayoutSyncToken) return
        if (!shouldReflowLegendImage) {
          syncMaterialLayout('legendImage')
        }
        if (linkedOutOfFrame) {
          invalidateLegendOutOfFrameComposite()
          await Promise.resolve(loaders.legendOutOfFrame(false))
        }
        if (bleedLayoutSyncGeneration !== bleedLayoutSyncToken) return
        await Promise.all([
          loaders.frame(true),
          ...BLEED_RELOAD_LAYOUT_CODES.map((code) => Promise.resolve(loaders[code](false))),
        ])
        if (bleedLayoutSyncGeneration !== bleedLayoutSyncToken) return
        for (const code of BLEED_SYNC_LAYOUT_CODES) {
          syncMaterialLayout(code)
        }
        if (info.renderConfig.items.kingdom.doubleGlyphs) {
          canvas.syncMaterialLayout('kingdom-primary')
          canvas.syncMaterialLayout('kingdom-secondary')
        }
        refreshCustomMaterialSkillOverlapHolesOnly()
        notifyCanvasVisualSettled()
      })()
    },
  )

  watch(
    () => legendBaseInfo().kingdom,
    (value, oldValue) => {
      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      if (isCustomKingdomActive(info)) return
      if (value === 'shen' || oldValue === 'shen') {
        syncBottomInfoStrokeForShenLayout(info)
        reloadAfterPresetKingdomShenTransition()
      } else if (value !== oldValue) {
        reloadAfterPresetKingdomChange([
          { code: 'frame' },
          { code: 'hp' },
          { code: 'skillsDesc' },
          { code: 'skillsName' },
          { code: 'kingdom', reset: true },
          ...(isMasterFlagActive(info) ? ([{ code: 'title' as const }] as const) : []),
        ])
      } else if (isMasterFlagActive(info)) {
        guardedScheduleLayerReload([{ code: 'title' }])
      }
    },
  )

  watch(
    () => usesShenCardLayout(info),
    (now, was) => {
      if (historyStore.isRestoring || was === undefined) return
      resetSkillsDescMinHeightOnShenLayoutChange(info, was)
      lastUsesShenCardLayout = now
    },
  )

  watch(
    () => historyStore.isRestoring,
    (restoring, wasRestoring) => {
      if (wasRestoring && !restoring) {
        syncLayoutTrackingSnapshot()
        lastNameCharCount = info.baseInfo.name.length
      }
    },
  )

  watch(
    () => info.renderConfig.display.fullModeFlag,
    (fullMode) => {
      if (!canReloadLayers()) return
      const shouldReflowLegendImage = diyStore.consumeLegendImageReflow()
      const linkedOutOfFrame = shouldKeepLegendOutOfFrameLinkedToLegendImage(info)
      const fullModeLayoutSyncGeneration = ++fullModeLayoutSyncToken

      if (fullMode) {
        syncBottomInfoStrokeForShenLayout(info)
      } else {
        disableBottomInfoStrokeIfNotShenLayout(info)
      }

      const reloadTasks = [
        { code: 'frame' as const, reset: true },
        { code: 'skillsDesc' as const },
        { code: 'skillsName' as const, reset: true },
        { code: 'bottomInfo' as const, reset: true },
      ]

      void (async () => {
        if (shouldReflowLegendImage) {
          await Promise.resolve(loaders.legendImage(true))
          if (fullModeLayoutSyncGeneration !== fullModeLayoutSyncToken) return
        } else if (linkedOutOfFrame) {
          syncMaterialLayout('legendImage')
          if (fullModeLayoutSyncGeneration !== fullModeLayoutSyncToken) return
        }

        if (linkedOutOfFrame) {
          invalidateLegendOutOfFrameComposite()
          await Promise.resolve(loaders.legendOutOfFrame(false))
          if (fullModeLayoutSyncGeneration !== fullModeLayoutSyncToken) return
        }

        await Promise.all(
          reloadTasks.map(({ code, reset }) => Promise.resolve(loaders[code](reset ?? false))),
        )
        if (fullModeLayoutSyncGeneration !== fullModeLayoutSyncToken) return
        refreshCustomMaterialSkillOverlapHolesOnly()
        notifyCanvasVisualSettled()
      })()
    },
  )

  watch(
    () => {
      const bi = legendBaseInfo()
      const items = legendRenderItems()
      return [
        items.frame.src,
        bi.kingdom,
        items.kingdom.doubleKingdom,
        bi.doubleKingdom?.join('\0'),
      ] as const
    },
    () => {
      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      const frameSrc = legendRenderItems().frame.src
      const previousFrameSrc = lastFrameSrcForLayout
      const needsFullReset = needsFullCardLayoutReload(previousFrameSrc)
      lastFrameSrcForLayout = frameSrc
      lastCardLayoutKey = resolveCardLayoutKey(info)
      if (needsFullReset) {
        guardedScheduleLayerReload(buildFrameLayoutCoupledReloadTargets())
      } else {
        guardedScheduleLayerReload([
          { code: 'frame' },
          { code: 'hp' },
        ])
      }
    },
  )

  watch(
    () => {
      const bi = legendBaseInfo()
      const kingdom = legendRenderItems().kingdom
      return [
        resolveKingdomSelectionSignature(info),
        kingdom.glyphColorFlag,
        kingdom.glyphGradientFlag,
        bi.masterFlag,
      ] as const
    },
    (value, oldValue) => {
      if (!oldValue || !canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      if (value[3]) return
      if (value[0] === oldValue[0]) return
      if (!value[1] && !value[2]) return
      guardedScheduleLayerReload([{ code: 'kingdom', reset: true }])
    },
  )

  watch(
    () => info.renderConfig.items.kingdom.glyphEmptyFlag,
    () => {
      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      debouncedReloadKingdom(false)
    },
  )

  watch(
    () => {
      const kingdom = info.renderConfig.items.kingdom
      return [
        kingdom.doubleSingleGlyphFlag,
        kingdom.doubleSingleGlyphRole,
      ] as const
    },
    (_value, oldValue) => {
      if (!oldValue) return
      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      debouncedReloadKingdom.cancel()
      resetKingdomCanvasPreviewShell(canvas)
      resetCustomKingdomGlyphLayout(false)
      ensureCustomKingdomSetup(info)
      void Promise.all([loaders.frame(true), loaders.kingdom(true)]).finally(
        notifyCanvasVisualSettled,
      )
    },
    { flush: 'sync' },
  )

  watch(
    () => {
      const kingdom = info.renderConfig.items.kingdom
      if (isDoubleKingdomRenderActive(info)) {
        return [kingdom.customText.primary, kingdom.customText.secondary] as const
      }
      return kingdom.customText.single
    },
    (value, oldValue) => {
      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      clearPresetKingdomWhenCustomTextFilled(info)
      ensureCustomKingdomSetup(info)
      if (!isDoubleKingdomRenderActive(info)) {
        const prevMode = resolveCustomKingdomSingleTextMode(String(oldValue ?? ''))
        const nextMode = resolveCustomKingdomSingleTextMode(String(value ?? ''))
        if (prevMode !== nextMode) {
          resetCustomKingdomSingleTextDefaults(info)
          if (isCustomKingdomActive(info)) {
            guardedScheduleLayerReload(buildCustomKingdomTextCoupledReloadTargets())
          } else {
            debouncedReloadKingdom(true)
          }
          return
        }
      }
      if (isCustomKingdomActive(info)) {
        guardedScheduleLayerReload(buildCustomKingdomTextCoupledReloadTargets())
        return
      }
      debouncedReloadKingdom(false)
    },
  )

  watch(
    () => info.renderConfig.items.kingdom.presetKingdomKey ?? '',
    (next, prev) => {
      if (next === prev) return
      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      reloadKingdomChromePresentation()
    },
  )

  watch(
    () => info.baseInfo.masterFlag,
    () => {
      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      reloadAfterMasterFlagToggle()
    },
  )

  watch(() => info.baseInfo.name, debouncedReloadName)

  watch(
    () => info.renderConfig.items.name.splitFlag,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleToggleLayerReload([{ code: 'name' }])
    },
  )

  watch(
    () => info.renderConfig.items.name.characterSpacing,
    () => {
      if (!canReloadLayers()) return
      if (info.renderConfig.items.name.splitFlag) {
        delete info.renderConfig.items.name.splitChars
      }
      guardedScheduleLayerReload([{ code: 'name' }])
    },
  )

  watch(
    () => info.renderConfig.items.name.convertTChFlag,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleToggleLayerReload([{ code: 'name' }])
    },
  )

  watch(
    () => info.renderConfig.items.title.characterSpacing,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleLayerReload([{ code: 'title' }])
    },
  )

  watch(() => info.baseInfo.title, debouncedReloadTitle)

  watch(
    () => info.renderConfig.items.title.convertTChFlag,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleToggleLayerReload([{ code: 'title' }])
    },
  )

  watch(
    () =>
      info.baseInfo.skills
        .map((skill) =>
          resolveSkillDescLayoutSignature(skill.desc ?? '', {
            autoFullNumberFlag: info.renderConfig.items.skillsDesc.autoFullNumberFlag,
            autoOptimizeFlag: resolveSkillsDescAutoOptimizeFlag(
              info.renderConfig.items.skillsDesc.autoOptimizeFlag,
            ),
          }),
        )
        .join('\0'),
    (value, oldValue) => {
      if (value === oldValue) return
      info.renderConfig.items.skillsDesc.manualSizeFlag = false
      if (!canReloadLayers()) return
      queueSkillsEditReloadIntent('desc')
    },
  )

  watch(
    () =>
      info.baseInfo.skills
        .map((skill) => `${skill.name}:${skill.derivedFlag ?? false}:${skill.kingdom ?? ''}`)
        .join('|'),
    (value, oldValue) => {
      if (!canReloadLayers() || value === oldValue) return
      queueSkillsEditReloadIntent('name')
    },
  )

  watch(
    () => info.baseInfo.quote,
    (value, oldValue) => {
      if (value === oldValue) return
      info.renderConfig.items.skillsDesc.manualSizeFlag = false
      if (!canReloadLayers()) return
      queueSkillsEditReloadIntent('desc')
    },
  )

  watch(
    () => info.renderConfig.items.skillsDesc.autoOptimizeFlag,
    (enabled, prev) => {
      if (!canReloadLayers() || enabled === prev) return
      debouncedReloadSkills(false)
    },
  )

  watch(
    () =>
      resolveSkillsDescAutoSizeFlag(
        info.renderConfig.items.skillsDesc.autoOptimizeSizeFlag,
        info.renderConfig.items.skillsDesc.autoOptimizeFlag,
      ),
    (enabled, prev) => {
      if (!canReloadLayers() || enabled === prev) return
      debouncedReloadSkillsLayout(false)
    },
  )

  watch(
    () => info.renderConfig.items.skillsDesc.size,
    (newSize, oldSize) => {
      if (!canReloadLayers() || isSkillsDescAutoSizeSyncing()) return
      if (typeof newSize !== 'number' || newSize <= 0 || newSize === oldSize) return
      info.renderConfig.items.skillsDesc.rowSpacing = resolveSkillsDescRowSpacingPt(newSize)
      syncQuoteFontSizeFromSkillsDesc(info, newSize, { force: true })
    },
  )

  watch(
    () => {
      const desc = info.renderConfig.items.skillsDesc
      return [
        desc.newFontFlag,
        desc.autoFullNumberFlag,
        desc.textBoldFlag,
        desc.bgOpaque,
      ] as const
    },
    () => {
      if (!canReloadLayers() || isSkillsDescAutoSizeSyncing()) return
      debouncedReloadSkills(false)
    },
  )

  watch(
    () => {
      const desc = info.renderConfig.items.skillsDesc
      const quote = info.renderConfig.items.quote
      return [
        desc.size,
        desc.paraSpacing,
        desc.singleLineParaSpacing,
        desc.rowSpacing,
        desc.characterSpacing,
        desc.marginTop,
        desc.marginBottom,
        desc.marginLeft,
        desc.marginRight,
        desc.minHeightMm,
        quote.size,
        quote.characterSpacing,
        quote.marginTop,
        quote.marginBottom,
        quote.marginLeft,
        quote.marginRight,
      ] as const
    },
    () => {
      if (!canReloadLayers() || isSkillsDescAutoSizeSyncing()) return
      debouncedReloadSkillsLayout(false)
    },
  )

  watch(
    () => info.renderConfig.items.skillsName.convertTChFlag,
    () => {
      if (!canReloadLayers()) return
      debouncedReloadSkillsNameFromToggle(false)
    },
  )

  watch(
    () => [
      info.renderConfig.items.skillsName.marginTop,
      info.renderConfig.items.skillsName.size,
      info.renderConfig.items.skillsName.characterSpacing,
    ] as const,
    () => {
      if (!canReloadLayers()) return
      debouncedReloadSkillsName(false)
    },
  )

  watch(
    () =>
      [
        info.baseInfo.copyright,
        info.baseInfo.legendId,
        info.renderConfig.items.bottomInfo.marginLeft,
        info.renderConfig.items.bottomInfo.marginRight,
        info.renderConfig.items.bottomInfo.showFlag,
      ] as const,
    () => {
      if (!canReloadLayers()) return
      debouncedReloadBottomInfo(false)
    },
  )

  watch(
    () => info.renderConfig.items.bottomInfo.strokeFlag,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleToggleLayerReload([{ code: 'bottomInfo' }])
    },
  )

  watch(
    () =>
      [
        infoStore.renderConfig.watermark.showFlag,
        infoStore.renderConfig.watermark.username,
      ] as const,
    debouncedReloadWatermark,
  )

  watch(
    () => {
      const identify = legendBaseInfo().packageIdentify
      return [identify.name, identify.pic, identify.text, identify.textFlag] as const
    },
    () => {
      if (!canReloadLayers()) return
      debouncedReloadPackage(false)
    },
  )

  watch(
    () => info.renderConfig.items.package.convertTChFlag,
    () => {
      if (!canReloadLayers()) return
      debouncedReloadPackage(false)
    },
  )

  watch(
    () => [
      info.renderConfig.items.package.customColor,
      info.renderConfig.items.package.customColorEnd,
    ] as const,
    () => {
      if (!canReloadLayers()) return
      debouncedReloadPackage.cancel()
      void Promise.resolve(loaders.package(false)).finally(notifyCanvasVisualSettled)
    },
  )

  watch(
    () => [
      info.renderConfig.items.kingdom.glyphGradientFlag,
      info.renderConfig.items.kingdom.glyphGradientEndColor,
      info.renderConfig.items.kingdom.glyphGradientEndColorPrimary,
      info.renderConfig.items.kingdom.glyphGradientEndColorSecondary,
    ] as const,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleToggleLayerReload([{ code: 'kingdom', reset: true }])
    },
  )

  watch(
    () => {
      const bi = legendBaseInfo()
      const items = legendRenderItems()
      return [
        bi.kingdom,
        bi.masterFlag,
        items.frame.src,
        items.kingdom.doubleKingdom,
        bi.doubleKingdom?.join('\0'),
        items.kingdom.glyphColorFlag,
        items.kingdom.glyphColor,
        items.kingdom.glyphColorPrimary,
        items.kingdom.glyphColorSecondary,
      ] as const
    },
    (_value, oldValue) => {
      if (!canReloadLayers()) return
      if (shouldSkipKingdomLayoutWatch()) return
      const items = legendRenderItems()
      const bi = legendBaseInfo()
      if (
        oldValue !== undefined &&
        oldValue[0] !== bi.kingdom &&
        (bi.kingdom === 'shen' || oldValue[0] === 'shen') &&
        !isCustomKingdomActive(info)
      ) {
        return
      }
      const prevDoubleFlag = oldValue?.[3]
      const nextDoubleFlag = items.kingdom.doubleKingdom
      const doubleFlagChanged =
        prevDoubleFlag !== undefined && prevDoubleFlag !== nextDoubleFlag
      if (doubleFlagChanged) return

      const glyphColorFlagChanged =
        oldValue !== undefined && oldValue[5] !== items.kingdom.glyphColorFlag
      const glyphColorChanged =
        oldValue !== undefined && oldValue[6] !== items.kingdom.glyphColor
      const glyphColorPrimaryChanged =
        oldValue !== undefined && oldValue[7] !== items.kingdom.glyphColorPrimary
      const glyphColorSecondaryChanged =
        oldValue !== undefined && oldValue[8] !== items.kingdom.glyphColorSecondary
      const masterFlagChanged =
        oldValue !== undefined && oldValue[1] !== bi.masterFlag
      const layoutFieldsExceptMasterUnchanged =
        oldValue !== undefined &&
        oldValue[0] === bi.kingdom &&
        oldValue[2] === items.frame.src &&
        oldValue[3] === nextDoubleFlag &&
        oldValue[4] === (bi.doubleKingdom?.join('\0') ?? '')
      if (masterFlagChanged && layoutFieldsExceptMasterUnchanged) {
        if (isCustomKingdomActive(info) || isPresetKingdomActive(info)) {
          guardedScheduleLayerReload([{ code: 'kingdom', reset: true }])
        }
        return
      }
      const layoutUnchanged =
        oldValue !== undefined &&
        oldValue[0] === bi.kingdom &&
        oldValue[1] === bi.masterFlag &&
        oldValue[2] === items.frame.src &&
        oldValue[3] === nextDoubleFlag &&
        oldValue[4] === (bi.doubleKingdom?.join('\0') ?? '')

      if (
        (glyphColorFlagChanged ||
          glyphColorChanged ||
          glyphColorPrimaryChanged ||
          glyphColorSecondaryChanged) &&
        layoutUnchanged
      ) {
        guardedScheduleToggleLayerReload([
          { code: 'kingdom', reset: true },
          ...(isCustomShenKingdomActive(info) ? ([{ code: 'frame' as const }] as const) : []),
        ])
        return
      }

      guardedScheduleLayerReload([
        { code: 'kingdom', reset: true },
        ...(isCustomShenKingdomActive(info) ? ([{ code: 'frame' as const }] as const) : []),
      ])
    },
  )

  watch(
    () => info.renderConfig.items.hp.customColorFlag,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleToggleLayerReload([{ code: 'hp' }])
    },
  )

  watch(
    () => info.renderConfig.items.title.customColorFlag,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleToggleLayerReload([{ code: 'title' }])
    },
  )

  watch(
    () => [
      info.renderConfig.items.title.customColor,
      info.renderConfig.items.title.customColorPrimary,
      info.renderConfig.items.title.customColorSecondary,
    ] as const,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleLayerReload([{ code: 'title' }])
    },
  )

  watch(
    () => [
      info.baseInfo.hp,
      info.baseInfo.maxHp,
      info.baseInfo.shield,
      info.renderConfig.items.hp.equalFlag,
      info.renderConfig.items.hp.customColor,
      info.renderConfig.items.hp.customColorPrimary,
      info.renderConfig.items.hp.customColorSecondary,
    ] as const,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleLayerReload([{ code: 'hp' }])
    },
  )

  watch(
    () => info.baseInfo.pic,
    (newPic, oldPic) => {
      // batch（百科应用等）期间 canReloadLayers 为 false，由 diyStore.reload 统一 cover
      if (!canReloadLayers()) return
      if (!oldPic || newPic === oldPic) return
      invalidateLegendOutOfFrameComposite()
      resetOutOfFrameOnPicChange(info.renderConfig)
      resetLegendImageLayoutOnPicChange(info)
      if (historyStore.bootstrappedKinds[historyStore.activeInfoKind]) {
        historyStore.syncLayoutSnapshotNow()
      }
      void Promise.resolve(loaders.legendImage(true)).finally(notifyCanvasVisualSettled)
      scheduleLegendOutOfFrameReload({
        fullRecover: true,
        commitLayoutToHistory: true,
        reset: true,
      })
    },
  )

  watch(
    () =>
      [
        info.renderConfig.outOfFrame?.enabled,
        info.renderConfig.outOfFrame?.maskDataUrl,
      ] as const,
    () => {
      if (!canReloadLayers()) return
      scheduleLegendOutOfFrameReload({
        fullRecover: true,
        commitLayoutToHistory: true,
        reset: true,
      })
    },
  )

  watch(
    () => {
      const item = info.renderConfig.items.legendImage
      return [item.width, item.height, item.scale, item.rotation] as const
    },
    () => {
      if (!canReloadLayers()) return
      if (!info.renderConfig.outOfFrame?.enabled) return
      if (info.renderConfig.items.legendImage.outOfFrameIndependentLayout) return
      scheduleLegendOutOfFrameReload()
    },
  )

  watch(
    () => {
      if (!info.renderConfig.items.legendImage.outOfFrameIndependentLayout) return null
      const item = info.renderConfig.items.legendOutOfFrame
      if (!item) return null
      return [item.width, item.height, item.scale, item.rotation] as const
    },
    () => {
      if (!canReloadLayers()) return
      if (!info.renderConfig.outOfFrame?.enabled) return
      if (!info.renderConfig.items.legendImage.outOfFrameIndependentLayout) return
      scheduleLegendOutOfFrameReload()
    },
  )

  watch(
    () => info.renderConfig.items.legendImage.outOfFrameIndependentLayout,
    (enabled) => {
      if (!canReloadLayers()) return
      if (!info.renderConfig.outOfFrame?.enabled) return
      if (enabled) {
        syncLegendOutOfFrameLayoutFromCanvas(
          info,
          canvas.canvasConfigs.legendOutOfFrame,
          resolveStageContentOriginFromDiy(diyStore),
          diyStore.mmToPx,
        )
        scheduleLegendOutOfFrameReload({
          fullRecover: true,
          commitLayoutToHistory: true,
          reset: true,
        })
        return
      }
      scheduleLegendOutOfFrameReload({ fullRecover: true })
    },
  )

  watch(
    () => [
      info.renderConfig.items.legendImage.hideOutOfFrameSkillOverlap,
      diyStore.innerStageBleed,
      info.renderConfig.customImage.hidePartialSkillOverlap,
      resolveCustomMaterialLayerPosition(info),
      info.renderConfig.display.fullModeFlag,
      info.renderConfig.items.skillsName.marginTop,
      info.renderConfig.items.skillsDesc.size,
      info.renderConfig.items.skillsDesc.rowSpacing,
      info.renderConfig.items.skillsDesc.paraSpacing,
      info.renderConfig.items.skillsDesc.singleLineParaSpacing,
      info.renderConfig.items.skillsDesc.characterSpacing,
      info.renderConfig.items.skillsDesc.marginTop,
      info.renderConfig.items.skillsDesc.marginBottom,
      info.renderConfig.items.skillsDesc.marginLeft,
      info.renderConfig.items.skillsDesc.marginRight,
      info.renderConfig.items.skillsDesc.minHeightMm,
      info.renderConfig.items.skillsDesc.autoOptimizeFlag,
      resolveSkillsDescAutoSizeFlag(
        info.renderConfig.items.skillsDesc.autoOptimizeSizeFlag,
        info.renderConfig.items.skillsDesc.autoOptimizeFlag,
      ),
      info.renderConfig.items.quote.marginTop,
      info.renderConfig.items.quote.marginBottom,
      info.baseInfo.quote,
      info.baseInfo.skills.length,
      info.baseInfo.skills.map((skill) => `${skill.kingdom}:${skill.desc?.length ?? 0}`).join(','),
      getSkillsAreaBlockLayoutSignature(),
    ] as const,
    () => {
      if (!canReloadLayers()) return
      refreshSkillOverlapHoles()
    },
  )

  watch(
    () =>
      [
        info.customMaterialList.map((item) => `${item.id}:${item.order}`).join(','),
        info.customMaterialList.length,
        resolveCustomMaterialLayerPosition(info),
        info.renderConfig.customImage.hidePartialSkillOverlap,
      ] as const,
    () => {
      if (!canReloadLayers()) return
      guardedScheduleLayerReload([{ code: 'customMaterials' }])
    },
  )

  /** 首屏 loadAll 完成后补刷自定义势力着色（配合 index.vue bootstrap remount） */
  watch(
    () => isInitialLoadComplete(),
    (ready) => {
      if (!ready) return
      const needsSkillsKingdomTint =
        isCustomKingdomActive(info) || shouldCustomShenSkillUseKingdomColor(info)
      if (!needsSkillsKingdomTint) return
      ensureCustomKingdomSetup(info)
      void Promise.resolve(loaders.skillsDesc(false))
        .then(() => loaders.skillsName(false))
        .finally(() => {
          canvas.schedulePreviewFilterCacheRefresh('skillsDesc', { force: true })
          canvas.schedulePreviewFilterCacheRefresh('skillsName', { force: true })
          scheduleSkillDescShenBgImageFilterCacheRefresh(
            canvas.canvasConfigs.skillsDesc,
            { force: true },
          )
          notifyCanvasVisualSettled()
        })
    },
    { once: true },
  )

  /** 首屏并行 load 时出框挖洞可能早于技能区测高/字体，bootstrap 后再重算一次 */
  watch(
    () => isInitialLoadComplete(),
    (ready) => {
      if (!ready) return
      refreshSkillOverlapHoles()
      notifyCanvasVisualSettled()
    },
    { once: true },
  )

  return cancelPendingDebouncedReloads
}
