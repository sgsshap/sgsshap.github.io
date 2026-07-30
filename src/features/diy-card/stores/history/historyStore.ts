import { isKingdomToggleCanvasBatchActive } from '@/features/diy-card/composables/kingdomToggleCanvasGate'
import { useDiyStore } from '../stage/diy'
import { useInfoStore } from '../infoStore'
import { useTemplateStore } from '../template/template'
import {
  cloneSnapshot,
  createEmptyStack,
  flushRestoreGuards,
  nextEntryId,
  snapshotRecordSignature,
  snapshotSemanticSignature,
  syncLayoutGeometryIntoSnapshot,
  toPlainSnapshot,
  type InfoHistoryStack,
} from './snapshot'
import {
  hydrateSnapshotFromPersist,
  mergeRuntimePersistedBinaryAssets,
  resolvePersistedImagesInSnapshot,
  restoreInlineBinaryRefsFromPlain,
  stripSnapshotForPersist,
  shareBinaryRefsWithStack,
  type PersistedBinaryAssets,
} from './persistSnapshot'
import {
  DIY_HISTORY_MAX_ENTRIES,
  type DiyHistoryRecordInput,
  type DiyInfoKind,
  type DiyInfoSnapshot,
  resolveInfoKind,
} from '@/features/diy-card/types/diy/history'
import {
  clearPersistedHistoryState,
  DIY_HISTORY_PERSIST_VERSION,
  loadPersistedHistoryState,
  savePersistedHistoryState,
  type PersistedHistoryState,
} from '@/features/diy-card/utils/diyHistoryPersistence'
import {
  recreateFreshInfoForKind,
} from '@/features/diy-card/utils/resetRenderConfig'
import { syncFrameSrcWhenKingdomChanges } from '@/features/diy-card/utils/syncFrameKingdom'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import type { TemplateType } from '@/features/diy-card/types/template'
import { getHistoryCanvasSettleSyncDebounceMs, getHistoryLayoutPersistDebounceMs, getHistoryPersistDebounceMs, shouldUseReducedCanvasQuality } from '@/shared/utils/deviceCapability'
import { scheduleIdleTask } from '@/shared/utils/scheduling'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

/** 等待 Konva 模板 loadAll 与 layout 写回后再捕获快照 */
const waitForCanvasSettle = async (diyStore: ReturnType<typeof useDiyStore>) => {
  if (diyStore.isCanvasLoading) {
    await new Promise<void>((resolve) => {
      const stop = watch(
        () => diyStore.isCanvasLoading,
        (loading) => {
          if (!loading) {
            stop()
            resolve()
          }
        },
      )
    })
  }
  await flushRestoreGuards()
}

const PERSIST_URGENT_DEBOUNCE_MS = getHistoryPersistDebounceMs()
const PERSIST_LAYOUT_DEBOUNCE_MS = getHistoryLayoutPersistDebounceMs()
const CANVAS_SETTLE_SYNC_DEBOUNCE_MS = getHistoryCanvasSettleSyncDebounceMs()

const historyCanvasReloadOptions = () => ({
  skipRemount: true,
  deferFilterCacheRefresh: shouldUseReducedCanvasQuality(),
  sequentialLoad: shouldUseReducedCanvasQuality(),
})

/**
 * 制图撤销/重做：按 legend / game / mark 分别维护历史栈
 */
export const useDiyHistoryStore = defineStore('diyHistory', () => {
  const templateStore = useTemplateStore()
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()

  const stacks = ref<Record<DiyInfoKind, InfoHistoryStack>>({
    legend: createEmptyStack(),
    game: createEmptyStack(),
    mark: createEmptyStack(),
  })

  /** 正在恢复快照时跳过自动记录 */
  const isRestoring = ref(false)
  let restoreChain: Promise<void> = Promise.resolve()

  /** 各域是否已完成「画布就绪」锚点（完成前不记录历史） */
  const bootstrappedKinds = ref<Record<DiyInfoKind, boolean>>({
    legend: false,
    game: false,
    mark: false,
  })

  /** 是否已尝试过从本地存储恢复（避免与 initDiyHistory 竞态覆盖） */
  const sessionRestoreFinished = ref(false)
  let sessionRestorePromise: Promise<boolean> | null = null

  let persistTimer: ReturnType<typeof globalThis.setTimeout> | undefined
  let persistInFlight: Promise<boolean> | null = null
  let cancelPersistIdle: (() => void) | undefined
  let canvasSettleSyncTimer: ReturnType<typeof globalThis.setTimeout> | undefined
  let pendingUrgentPersist = false
  let pendingLayoutOnlyPersist = false

  const stripStackForPersist = (
    stack: InfoHistoryStack,
    assets: PersistedBinaryAssets,
  ): InfoHistoryStack => ({
    index: stack.index,
    entries: stack.entries.map((entry) => ({
      ...entry,
      snapshot: stripSnapshotForPersist(entry.snapshot, assets),
    })),
  })

  const hydrateStackFromPersistedEntries = (
    stack: InfoHistoryStack,
    assets: PersistedBinaryAssets,
  ): InfoHistoryStack => ({
    index: stack.index,
    entries: stack.entries.map((entry) => ({
      ...entry,
      snapshot: hydrateSnapshotFromPersist(entry.snapshot, assets),
    })),
  })

  const activeInfoKind = computed(() => resolveInfoKind(templateStore.templateType))

  const isBootstrapping = computed(() => !bootstrappedKinds.value[activeInfoKind.value])

  const activeStack = computed(() => stacks.value[activeInfoKind.value])

  const historyMaxEntries = DIY_HISTORY_MAX_ENTRIES

  const activeEntryCount = computed(() => activeStack.value.entries.length)

  const isHistoryAtLimit = computed(
    () => activeEntryCount.value >= DIY_HISTORY_MAX_ENTRIES,
  )

  const currentEntry = computed(() => {
    const stack = activeStack.value
    if (stack.index < 0) return null
    return stack.entries[stack.index] ?? null
  })

  const canUndo = computed(() => activeStack.value.index > 0)

  const canRedo = computed(() => {
    const stack = activeStack.value
    return stack.index >= 0 && stack.index < stack.entries.length - 1
  })

  /** 时间倒序，供历史面板展示（最新在上，含最底部的初始状态） */
  const recentEntriesDesc = computed(() => {
    const stack = activeStack.value
    return stack.entries
      .map((entry, index) => ({ entry, index }))
      .slice()
      .reverse()
  })

  const buildStackForPersist = (
    kind: DiyInfoKind,
    binaryAssets: PersistedBinaryAssets,
  ): InfoHistoryStack => {
    const stack = stacks.value[kind]
    if (!bootstrappedKinds.value[kind] || stack.index < 0 || !stack.entries.length) {
      return stripStackForPersist(stack, binaryAssets)
    }

    const shouldMergeLive = kind === activeInfoKind.value
    const liveSnapshot = shouldMergeLive ? captureSnapshot(kind) : null
    if (liveSnapshot) {
      shareBinaryRefsWithStack(
        stack.entries.map((entry) => entry.snapshot),
        liveSnapshot,
      )
    }

    return {
      index: stack.index,
      entries: stack.entries.map((entry, index) => ({
        ...entry,
        snapshot: stripSnapshotForPersist(
          shouldMergeLive && index === stack.index && liveSnapshot
            ? liveSnapshot
            : entry.snapshot,
          binaryAssets,
        ),
      })),
    }
  }

  const buildPersistPayload = (): PersistedHistoryState => {
    const binaryAssets: PersistedBinaryAssets = {}
    return {
      version: DIY_HISTORY_PERSIST_VERSION,
      savedAt: Date.now(),
      binaryAssets,
      stacks: {
        legend: buildStackForPersist('legend', binaryAssets),
        game: buildStackForPersist('game', binaryAssets),
        mark: buildStackForPersist('mark', binaryAssets),
      },
      bootstrappedKinds: { ...bootstrappedKinds.value },
      lastActiveInfoKind: activeInfoKind.value,
    }
  }

  const schedulePersist = (options?: { layoutOnly?: boolean }) => {
    if (typeof localStorage === 'undefined') return

    if (options?.layoutOnly) {
      if (pendingUrgentPersist) return
      pendingLayoutOnlyPersist = true
    } else {
      pendingUrgentPersist = true
      pendingLayoutOnlyPersist = false
    }

    if (persistTimer) globalThis.clearTimeout(persistTimer)
    cancelPersistIdle?.()
    cancelPersistIdle = undefined

    const delay = pendingUrgentPersist
      ? PERSIST_URGENT_DEBOUNCE_MS
      : PERSIST_LAYOUT_DEBOUNCE_MS

    persistTimer = globalThis.setTimeout(() => {
      persistTimer = undefined
      const deferToIdle = pendingLayoutOnlyPersist && !pendingUrgentPersist
      pendingUrgentPersist = false
      pendingLayoutOnlyPersist = false

      const runPersist = () => {
        cancelPersistIdle = undefined
        void persistNow()
      }

      if (deferToIdle) {
        cancelPersistIdle = scheduleIdleTask(runPersist)
      } else {
        runPersist()
      }
    }, delay)
  }

  const persistNow = async (): Promise<boolean> => {
    if (typeof localStorage === 'undefined') return false
    if (!Object.values(bootstrappedKinds.value).some(Boolean)) return false
    if (isKingdomToggleCanvasBatchActive()) return false

    const payload = buildPersistPayload()
    const task = savePersistedHistoryState(payload)
      .then(() => true)
      .catch((error) => {
        console.warn('[diy-history] persist failed', error)
        return false
      })
    persistInFlight = task
    try {
      return await task
    } finally {
      if (persistInFlight === task) {
        persistInFlight = null
      }
    }
  }

  const captureSnapshot = (kind: DiyInfoKind): DiyInfoSnapshot => {
    const plain = toPlainSnapshot(infoStore.toInfoSnapshot(kind)) as DiyInfoSnapshot
    const snapshot = cloneSnapshot(plain)
    restoreInlineBinaryRefsFromPlain(plain, snapshot)
    return snapshot
  }

  /**
   * 将快照数据写入当前 info（不触发画布 reload，供首屏 prepare 使用）
   */
  const applySnapshotData = (kind: DiyInfoKind, snapshot: DiyInfoSnapshot) => {
    const cloned = cloneSnapshot(snapshot)
    resolvePersistedImagesInSnapshot(cloned)
    infoStore.applyInfo(cloned, kind)

    const templateName = snapshot.template?.name
    const matchedTemplate = templateName ? templateStore.getTemplate(templateName) : undefined
    if (matchedTemplate) {
      templateStore.currentTemplateName = matchedTemplate.name
    }
  }

  /**
   * 合并恢复快照并重载画布（撤销/重做、显式恢复）
   */
  const applySnapshot = async (kind: DiyInfoKind, snapshot: DiyInfoSnapshot) => {
    await applySnapshotToCanvas(kind, snapshot, { reload: true })
  }

  type ApplySnapshotToCanvasOptions = {
    /** 是否触发 diyStore.reload；首屏 prepare 为 false */
    reload?: boolean
    /** 恢复后追加一条历史（读取进度） */
    historyRecord?: DiyHistoryRecordInput
    /** 历史条目快照；默认 capture；导入时传入文件快照 */
    historySnapshot?: DiyInfoSnapshot
  }

  /**
   * 快照 → info → 可选历史栈 → 可选 reload。
   * 与首屏 prepareFromPersisted / 撤销重做 / 读取进度共用：
   * 1. runSerializedRestore 内仅 applySnapshotData（阻塞 watch）
   * 2. reload 在 isRestoring 之外执行，loadAll 内 reconcile 还原布局
   */
  const applySnapshotToCanvas = async (
    kind: DiyInfoKind,
    snapshot: DiyInfoSnapshot,
    options: ApplySnapshotToCanvasOptions = {},
  ) => {
    const { reload = true, historyRecord, historySnapshot } = options

    diyStore.beginHistoryRestoreLoading()
    try {
      await runSerializedRestore(async () => {
        applySnapshotData(kind, snapshot)
      })

      if (historyRecord) {
        appendHistoryEntry(
          historyRecord,
          kind,
          historySnapshot ?? captureSnapshot(kind),
          { syncFrameBeforeRecord: historySnapshot === undefined },
        )
      }

      if (reload) {
        await diyStore.reload(false, historyCanvasReloadOptions())
      }
    } finally {
      diyStore.endHistoryRestoreLoading()
    }
  }

  const hydrateStackFromPersisted = (
    persisted: PersistedHistoryState,
    kind: DiyInfoKind,
  ) => {
    if (!persisted.bootstrappedKinds[kind]) return
    const stack = persisted.stacks[kind]
    if (!stack?.entries?.length) return
    mergeRuntimePersistedBinaryAssets(persisted.binaryAssets ?? {})
    stacks.value[kind] = hydrateStackFromPersistedEntries(
      stack,
      persisted.binaryAssets ?? {},
    )
    bootstrappedKinds.value[kind] = true
  }

  const runSerializedRestore = async (task: () => Promise<void>) => {
    const previous = restoreChain
    let release!: () => void
    restoreChain = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    isRestoring.value = true
    try {
      await task()
      await flushRestoreGuards()
    } finally {
      isRestoring.value = false
      release()
    }
  }

  const restoreToIndex = async (kind: DiyInfoKind, index: number) => {
    const stack = stacks.value[kind]
    const entry = stack.entries[index]
    if (!entry) return

    stack.index = index
    await applySnapshotToCanvas(kind, entry.snapshot, { reload: true })
    schedulePersist()
  }

  /**
   * 画布与模板加载完成后写入锚点（操作历史列表最底部展示为「初始状态」）
   */
  const finishBootstrap = (options?: { skipSchedulePersist?: boolean; force?: boolean }) => {
    const kind = activeInfoKind.value
    if (bootstrappedKinds.value[kind] && !options?.force) return

    bootstrappedKinds.value[kind] = true
    const stack = stacks.value[kind]
    const snapshot = captureSnapshot(kind)
    stack.entries = [
      {
        id: nextEntryId(),
        category: 'other',
        label: '初始状态',
        infoKind: kind,
        templateName: templateStore.currentTemplateName,
        createdAt: Date.now(),
        snapshot,
        isAnchor: true,
      },
    ]
    stack.index = 0
    if (!options?.skipSchedulePersist) {
      void persistNow()
    }
  }

  /** 切换模板等场景：清空当前域历史，待画布再次就绪后重新写入「初始状态」 */
  const resetBootstrap = (kind?: DiyInfoKind) => {
    const target = kind ?? activeInfoKind.value
    bootstrappedKinds.value[target] = false
    stacks.value[target] = createEmptyStack()
    schedulePersist()
  }

  /**
   * 追加历史栈条目（可指定快照，读取进度时用文件快照且不改 frame 联动）
   */
  const appendHistoryEntry = (
    input: DiyHistoryRecordInput,
    kind: DiyInfoKind,
    snapshot: DiyInfoSnapshot,
    options?: { syncFrameBeforeRecord?: boolean },
  ) => {
    if (!bootstrappedKinds.value[kind]) return

    const stack = stacks.value[kind]
    if (options?.syncFrameBeforeRecord !== false && kind === 'legend') {
      const prevEntry = stack.entries[stack.index]
      const prevKingdom =
        prevEntry && 'baseInfo' in prevEntry.snapshot
          ? (prevEntry.snapshot as LegendInfo).baseInfo.kingdom
          : undefined
      syncFrameSrcWhenKingdomChanges(infoStore.accessKind('legend').info as LegendInfo, prevKingdom)
    }

    const prev = stack.entries[stack.index]
    shareBinaryRefsWithStack(
      stack.entries.map((entry) => entry.snapshot),
      snapshot,
    )
    if (
      !input.force &&
      prev &&
      snapshotRecordSignature(prev.snapshot) === snapshotRecordSignature(snapshot)
    ) {
      return
    }

    const truncated = stack.entries.slice(0, stack.index + 1)
    truncated.push({
      id: nextEntryId(),
      category: input.category,
      label: input.label,
      infoKind: kind,
      templateName: templateStore.currentTemplateName,
      createdAt: Date.now(),
      snapshot,
    })

    if (truncated.length > DIY_HISTORY_MAX_ENTRIES) {
      const anchor = truncated.find((entry) => entry.isAnchor)
      const rest = truncated.filter((entry) => !entry.isAnchor)
      const maxRest = DIY_HISTORY_MAX_ENTRIES - (anchor ? 1 : 0)
      const trimmedRest = rest.slice(-Math.max(0, maxRest))
      truncated.splice(0, truncated.length, ...(anchor ? [anchor, ...trimmedRest] : trimmedRest))
    }

    stack.entries = truncated
    stack.index = truncated.length - 1
    if (input.category === 'layout') {
      schedulePersist({ layoutOnly: true })
    } else {
      void persistNow()
    }
  }

  /** 等待进行中的持久化（页面卸载 / flush 前） */
  const awaitPersistInFlight = async () => {
    if (persistInFlight) {
      await persistInFlight.catch(() => false)
    }
  }

  /**
   * 记录一次可撤销操作（会截断当前指针之后的「未来」步骤）
   * 须先完成 finishBootstrap（画布就绪后的「初始状态」）
   */
  const record = (input: DiyHistoryRecordInput) => {
    if (isRestoring.value) return
    appendHistoryEntry(input, activeInfoKind.value, captureSnapshot(activeInfoKind.value))
  }

  /** 读取 .shap 进度（与 prepareFromPersisted + reload 同一套恢复时序） */
  const importProgressSnapshot = async (snapshot: DiyInfoSnapshot, kind: DiyInfoKind) => {
    await applySnapshotToCanvas(kind, snapshot, {
      reload: true,
      historyRecord: {
        category: 'import',
        label: '读取进度',
        force: true,
      },
      historySnapshot: cloneSnapshot(snapshot),
    })
  }

  /** 当前 info 与历史指针快照不一致时需重新应用（如切换牌类型后画布重载） */
  const shouldReapplyActiveEntry = (kind: DiyInfoKind = activeInfoKind.value) => {
    if (isRestoring.value) return false
    if (!bootstrappedKinds.value[kind]) return false
    const stack = stacks.value[kind]
    const entry = stack.entries[stack.index]
    if (!entry) return false
    const currentPlain = toPlainSnapshot(infoStore.toInfoSnapshot(kind)) as DiyInfoSnapshot
    return (
      snapshotSemanticSignature(currentPlain) !==
      snapshotSemanticSignature(entry.snapshot)
    )
  }

  /**
   * 以当前历史指针快照恢复 live info 中的用户布局坐标（loadAll 可能已重置为模板默认）
   */
  const reconcileLiveLayoutFromActiveEntryNow = (
    kind: DiyInfoKind = activeInfoKind.value,
  ) => {
    if (isRestoring.value) return
    if (!bootstrappedKinds.value[kind]) return

    const stack = stacks.value[kind]
    const entry = stack.entries[stack.index]
    if (!entry) return

    syncLayoutGeometryIntoSnapshot(
      infoStore.info as DiyInfoSnapshot,
      entry.snapshot,
    )
  }

  /**
   * 将 live info 写回当前历史指针快照（不新增步骤）。
   * 仅用于切势力 batch 结束、刷新前 flush 等显式场景；日常编辑不在 settle 时调用，避免与 record() 去重竞态。
   */
  const syncActiveEntrySnapshotFromLiveNow = (
    kind: DiyInfoKind = activeInfoKind.value,
  ) => {
    if (isRestoring.value) return
    if (!bootstrappedKinds.value[kind]) return

    const stack = stacks.value[kind]
    const entry = stack.entries[stack.index]
    if (!entry) return

    const liveSnapshot = captureSnapshot(kind)
    shareBinaryRefsWithStack(
      stack.entries.filter((item) => item !== entry).map((item) => item.snapshot),
      liveSnapshot,
    )
    entry.snapshot = liveSnapshot
  }

  /**
   * 画布 settle 后仅调度持久化；指针快照在 flush / persist 时以 live info 为准合并写入 IndexedDB
   */
  const syncActiveEntrySnapshotAfterCanvasSettleNow = (
    kind: DiyInfoKind = activeInfoKind.value,
  ) => {
    if (isRestoring.value) return
    if (isKingdomToggleCanvasBatchActive()) return
    if (!bootstrappedKinds.value[kind]) return
    schedulePersist({ layoutOnly: true })
  }

  /** 切势力 batch 结束：把 reload 后的 layout 写回当前历史指针并立即持久化 */
  const syncAndPersistActiveEntry = async (
    kind: DiyInfoKind = activeInfoKind.value,
  ) => {
    syncActiveEntrySnapshotFromLiveNow(kind)
    await flushPersist()
  }

  const syncActiveEntrySnapshotAfterCanvasSettle = (
    kind: DiyInfoKind = activeInfoKind.value,
  ) => {
    if (canvasSettleSyncTimer) globalThis.clearTimeout(canvasSettleSyncTimer)
    canvasSettleSyncTimer = globalThis.setTimeout(() => {
      canvasSettleSyncTimer = undefined
      syncActiveEntrySnapshotAfterCanvasSettleNow(kind)
    }, CANVAS_SETTLE_SYNC_DEBOUNCE_MS)
  }

  /**
   * 从持久化数据恢复模板类型与 name，避免刷新后仍用默认 templates[0] 导致读错历史域
   */
  const restoreTemplateContextFromPersisted = (
    persisted: PersistedHistoryState,
    preferredKind?: DiyInfoKind,
  ): DiyInfoKind | null => {
    const kindCandidates: DiyInfoKind[] = preferredKind
      ? [preferredKind, persisted.lastActiveInfoKind, 'legend', 'game', 'mark'].filter(
          (k, i, arr): k is DiyInfoKind => Boolean(k) && arr.indexOf(k) === i,
        )
      : [
          persisted.lastActiveInfoKind,
          'legend',
          'game',
          'mark',
        ].filter((k): k is DiyInfoKind => Boolean(k))

    for (const kind of kindCandidates) {
      if (!persisted.bootstrappedKinds[kind]) continue
      const stack = persisted.stacks[kind]
      if (!stack?.entries?.length) continue

      const index = Math.min(Math.max(0, stack.index), stack.entries.length - 1)
      const entry = stack.entries[index]
      const templateName = entry?.snapshot.template?.name
      if (!templateName) continue

      const template = templateStore.getTemplate(templateName)
      if (!template) continue

      templateStore.templateType = template.type as TemplateType
      templateStore.currentTemplateName = template.name
      return kind
    }

    return null
  }

  /**
   * 从本地存储恢复历史栈并写入 info（单例 Promise，避免多处并发恢复 / 竞态 init）
   */
  const restoreSessionFromStorage = async (
    preferredKind?: DiyInfoKind,
  ): Promise<boolean> => {
    if (typeof localStorage === 'undefined') return false

    const persisted = await loadPersistedHistoryState()
    if (!persisted) return false

    const targetKind =
      restoreTemplateContextFromPersisted(persisted, preferredKind) ??
      preferredKind ??
      activeInfoKind.value
    if (!persisted.bootstrappedKinds[targetKind]) return false

    const stack = persisted.stacks[targetKind]
    if (!stack?.entries?.length) return false

    if (bootstrappedKinds.value[targetKind]) {
      return stacks.value[targetKind].entries.length > 0
    }

    const index = Math.min(Math.max(0, stack.index), stack.entries.length - 1)
    const entry = stack.entries[index]
    if (!entry) return false

    const templateName = entry.snapshot.template?.name
    if (!templateName || !templateStore.getTemplate(templateName)) return false

    hydrateStackFromPersisted(persisted, targetKind)
    stacks.value[targetKind].index = index

    const hydrateOtherKinds = () => {
      for (const otherKind of ['legend', 'game', 'mark'] as const) {
        if (otherKind === targetKind || bootstrappedKinds.value[otherKind]) continue
        hydrateStackFromPersisted(persisted, otherKind)
      }
    }
    if (shouldUseReducedCanvasQuality()) {
      scheduleIdleTask(hydrateOtherKinds)
    } else {
      hydrateOtherKinds()
    }

    const hydratedEntry = stacks.value[targetKind].entries[index]
    if (!hydratedEntry) return false

    await applySnapshotToCanvas(targetKind, hydratedEntry.snapshot, { reload: false })
    return true
  }

  const ensureSessionRestored = async (
    preferredKind?: DiyInfoKind,
  ): Promise<boolean> => {
    if (sessionRestorePromise) return sessionRestorePromise

    sessionRestorePromise = restoreSessionFromStorage(preferredKind)
      .catch((error) => {
        console.warn('[diy-history] session restore failed', error)
        return false
      })
      .finally(() => {
        sessionRestoreFinished.value = true
      })

    return sessionRestorePromise
  }

  /** 先恢复本地会话，若无历史则写入「初始状态」锚点 */
  const ensureHistoryBootstrapped = async (kind?: DiyInfoKind) => {
    await ensureSessionRestored(kind)
    const targetKind = kind ?? activeInfoKind.value
    if (!bootstrappedKinds.value[targetKind]) {
      finishBootstrap()
    }
  }

  /**
   * 首屏：从 IndexedDB 恢复历史栈并写入 info，不 reload（由模板首次 loadAll 拉图）
   */
  const prepareFromPersisted = async (kind: DiyInfoKind = activeInfoKind.value) => {
    if (bootstrappedKinds.value[kind]) return false
    return ensureSessionRestored(kind)
  }

  /**
   * 从 IndexedDB 恢复历史栈（仅写入 info / 栈指针，画布由模板首屏 loadAll 绘制）
   */
  const tryRestorePersisted = async (kind: DiyInfoKind = activeInfoKind.value) => {
    if (typeof localStorage === 'undefined') return false

    if (bootstrappedKinds.value[kind]) {
      return stacks.value[kind].entries.length > 0
    }

    return ensureSessionRestored(kind)
  }

  const undo = async () => {
    const kind = activeInfoKind.value
    const stack = stacks.value[kind]
    if (stack.index <= 0) return
    await restoreToIndex(kind, stack.index - 1)
  }

  const redo = async () => {
    const kind = activeInfoKind.value
    const stack = stacks.value[kind]
    if (stack.index >= stack.entries.length - 1) return
    await restoreToIndex(kind, stack.index + 1)
  }

  /** 跳转到指定历史步骤（PS 历史面板点选） */
  const jumpTo = async (index: number) => {
    const kind = activeInfoKind.value
    const stack = stacks.value[kind]
    if (index < 0 || index >= stack.entries.length) return
    if (index === stack.index) return
    await restoreToIndex(kind, index)
  }

  /** 强制按当前指针重新应用快照（画布重载后与栈不一致时） */
  const reapplyActiveEntry = async (kind: DiyInfoKind = activeInfoKind.value) => {
    const stack = stacks.value[kind]
    if (stack.index < 0) return
    diyStore.beginHistoryRestoreLoading()
    try {
      await restoreToIndex(kind, stack.index)
    } finally {
      diyStore.endHistoryRestoreLoading()
    }
  }

  const clearActiveStack = () => {
    stacks.value[activeInfoKind.value] = createEmptyStack()
  }

  /** 将历史栈中的「初始状态」锚点同步为当前画布快照（不读取锚点） */
  const syncAnchorSnapshot = (kind: DiyInfoKind = activeInfoKind.value) => {
    const stack = stacks.value[kind]
    const anchor = stack.entries.find((entry) => entry.isAnchor)
    if (!anchor) return
    const snapshot = captureSnapshot(kind)
    shareBinaryRefsWithStack(
      stack.entries.filter((entry) => entry !== anchor).map((entry) => entry.snapshot),
      snapshot,
    )
    anchor.snapshot = snapshot
    schedulePersist()
  }

  /** 当前域历史栈中的「初始状态」锚点快照 */
  const getInitialSnapshot = (kind: DiyInfoKind = activeInfoKind.value) => {
    const stack = stacks.value[kind]
    const anchor = stack.entries.find((entry) => entry.isAnchor)
    return anchor?.snapshot ?? null
  }

  /** 取消待写入的持久化任务 */
  const cancelPendingPersist = async () => {
    if (persistTimer) {
      globalThis.clearTimeout(persistTimer)
      persistTimer = undefined
    }
    pendingUrgentPersist = false
    pendingLayoutOnlyPersist = false
    cancelPersistIdle?.()
    cancelPersistIdle = undefined
    if (persistInFlight) {
      await persistInFlight.catch(() => undefined)
    }
  }

  /** 1. 清空全部历史栈与本机 IndexedDB */
  const clearAllHistoryIncludingPersisted = async () => {
    await cancelPendingPersist()
    stacks.value = {
      legend: createEmptyStack(),
      game: createEmptyStack(),
      mark: createEmptyStack(),
    }
    bootstrappedKinds.value = {
      legend: false,
      game: false,
      mark: false,
    }
    await clearPersistedHistoryState()
  }

  /** 2. 按工厂默认值重置当前画布（不读写历史） */
  const resetCanvasToFactoryDefaults = async (kind: DiyInfoKind = activeInfoKind.value) => {
    await runSerializedRestore(async () => {
      recreateFreshInfoForKind(kind)
      await diyStore.reload(true)
      await waitForCanvasSettle(diyStore)
    })
  }

  /** 3. 写入「初始状态」锚点并立即持久化 */
  const bootstrapInitialHistoryAnchor = async () => {
    finishBootstrap({ force: true, skipSchedulePersist: true })
    await persistNow()
  }

  /**
   * 重置画布：按工厂默认值重新创建 info，不读取历史锚点；重置后刷新锚点供后续持久化
   */
  const resetToInitialState = async () => {
    const kind = activeInfoKind.value

    await resetCanvasToFactoryDefaults(kind)

    if (!bootstrappedKinds.value[kind]) return

    syncAnchorSnapshot(kind)

    record({
      category: 'reset',
      label: '重置画布',
    })
  }

  /**
   * 从零开始：① 清空历史（含 IndexedDB）→ ② 重置画布 → ③ 写入「初始状态」
   */
  const resetCanvasAndHistoryCompletely = async () => {
    const kind = activeInfoKind.value

    await clearAllHistoryIncludingPersisted()
    await resetCanvasToFactoryDefaults(kind)
    await bootstrapInitialHistoryAnchor()
  }

  const flushPersist = async () => {
    if (canvasSettleSyncTimer) {
      globalThis.clearTimeout(canvasSettleSyncTimer)
      canvasSettleSyncTimer = undefined
    }
    syncActiveEntrySnapshotFromLiveNow()
    await cancelPendingPersist()
    await persistNow()
    await awaitPersistInFlight()
  }

  return {
    stacks,
    isRestoring,
    isBootstrapping,
    bootstrappedKinds,
    activeInfoKind,
    activeStack,
    currentEntry,
    canUndo,
    canRedo,
    recentEntriesDesc,
    historyMaxEntries,
    activeEntryCount,
    isHistoryAtLimit,
    sessionRestoreFinished,
    finishBootstrap,
    resetBootstrap,
    record,
    undo,
    redo,
    jumpTo,
    clearActiveStack,
    captureSnapshot,
    getInitialSnapshot,
    resetToInitialState,
    resetCanvasAndHistoryCompletely,
    ensureSessionRestored,
    ensureHistoryBootstrapped,
    prepareFromPersisted,
    tryRestorePersisted,
    shouldReapplyActiveEntry,
    reapplyActiveEntry,
    syncActiveEntrySnapshotAfterCanvasSettle,
    syncLayoutSnapshotNow: syncActiveEntrySnapshotFromLiveNow,
    syncAndPersistActiveEntry,
    reconcileLiveLayoutFromActiveEntryNow,
    importProgressSnapshot,
    persistNow,
    flushPersist,
    runBulkMutation: runSerializedRestore,
  }
})
