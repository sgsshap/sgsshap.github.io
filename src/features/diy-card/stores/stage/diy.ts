import { useExportStore } from '../export/export'
import { useInfoStore } from '../infoStore'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { isDoubleKingdomRenderActive } from '@/features/diy-card/composables/doubleKingdom'
import { useTemplateStore } from '../template/template'
import { useSystemStore } from '@/shared/stores/system'
import {
  canvasVisualSettledRevision,
  scheduleCanvasVisualSettled,
} from '@/features/diy-card/composables/preview/canvasVisualSettled'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

/**
 * 制图页核心 store：画布尺寸、出血、选中、加载与重载等。
 * 卡牌编辑数据请使用 useInfoStore。
 */
export const useDiyStore = defineStore('diy', () => {
  // ==================== 画布尺寸 ====================

  /** 逻辑画布宽高比（含出血对比例的影响） */
  const stageRatio = computed(() => {
    const { width, height } = useTemplateStore().currentTemplate
    return width / height
  })

  /** 未含出血时的预览画布像素尺寸 */
  const stageConfig = computed(() => {
    const { canvasMaxWidth, canvasMaxHeight } = useSystemStore()
    const ratio = stageRatio.value
    let width, height
    if (ratio > 1) {
      width = canvasMaxWidth
      height = width / ratio
    } else {
      height = canvasMaxHeight
      width = height * ratio
    }
    return { width: width, height: height }
  })

  /** 模板宽度（mm）→ 画布像素 的换算比例 */
  const mmToPx = computed(() => {
    const templateWidth = useTemplateStore().currentTemplate.width
    const stageWidth = stageConfig.value.width
    return stageWidth / templateWidth
  })

  /** 磅 → 像素，供 Konva 文本使用 */
  const PT_TO_MM = 25.4 / 72
  const ptToPx = (pt: number) => pt * PT_TO_MM * mmToPx.value

  /** 含出血边距后的 Konva Stage 尺寸 */
  const finalStageConfig = computed(() => {
    const bleedPx = bleed.value
    return {
      width: stageConfig.value.width + bleedPx * 2,
      height: stageConfig.value.height + bleedPx * 2,
    }
  })

  // ==================== 出血 ====================

  /** 是否在画布内显示出血区域 */
  const bleedFlag = ref(false)

  /** 是否用遮罩挡住出血线外的预览内容 */
  const coverBleed = ref(true)

  /** 模板允许的最大出血（mm） */
  const templateBleedValue = computed(() => {
    return useTemplateStore().currentTemplate.bleed
  })

  /** 用户调节的出血宽度（mm），不超过模板上限 */
  const bleedValue = ref(templateBleedValue.value)

  watch(
    () => templateBleedValue.value,
    (value) => {
      if (value < bleedValue.value) {
        bleedValue.value = value
      }
    },
  )

  /**
   * 开关出血；开启时恢复为模板默认出血值
   */
  const setBleedFlag = (flag: boolean) => {
    applyBleedState({ bleedFlag: flag })
  }

  /** 原画显示区域变化后是否 cover 重铺（出血 / 全幅等 UI 写入） */
  let pendingLegendImageReflow = false

  const applyBleedState = (state: { bleedFlag?: boolean; bleedValue?: number }) => {
    if (state.bleedFlag !== undefined) {
      if (state.bleedFlag) {
        bleedValue.value = useTemplateStore().currentTemplate.bleed
        useExportStore().whiteBorder = false
      }
      bleedFlag.value = state.bleedFlag
    }
    if (state.bleedValue !== undefined) {
      bleedValue.value = state.bleedValue
    }
  }

  const scheduleLegendImageReflow = (reflow: boolean) => {
    pendingLegendImageReflow = reflow
  }

  const consumeLegendImageReflow = () => {
    const reflow = pendingLegendImageReflow
    pendingLegendImageReflow = false
    return reflow
  }

  /** 模板允许的最大单边出血（px） */
  const maxBleed = computed(() => {
    return templateBleedValue.value * mmToPx.value
  })

  /** 当前显示在画布内的出血宽度（px） */
  const bleed = computed(() => {
    if (!bleedFlag.value) return 0
    return bleedValue.value * mmToPx.value
  })

  /**
   * 画布外侧预留的出血占位（px）
   * 关闭出血开关时等于 maxBleed；开启时等于 maxBleed − bleed
   */
  const outStageBleed = computed(() => {
    if (!bleedFlag.value) {
      return maxBleed.value
    }
    return maxBleed.value - bleed.value
  })

  /** 画布内侧可见出血（px） */
  const innerStageBleed = computed(() => {
    if (!bleedFlag.value) return 0
    return bleed.value
  })

  // ==================== 选中与可操作元素 ====================

  /** 属性面板当前选中的元素 code */
  const selectedItemValue = ref('')

  const setSelectedItemValue = (value: string) => {
    selectedItemValue.value = value
  }

  const selectedItem = computed(() => {
    return selectableOptions.value.find((item) => item.value === selectedItemValue.value)?.obj
  })

  /** 可在预览区点选、并在配置区编辑的元素列表 */
  const selectableOptions = computed(() => {
    const info = useInfoStore().info
    const items = info.renderConfig.items
    const list: LayoutItem[] = []

    for (const item of Object.values(items)) {
      if (item.name === 'unknown') continue
      if (
        item.code === 'name' &&
        'splitFlag' in item &&
        item.splitFlag &&
        'splitChars' in item &&
        item.splitChars
      ) {
        list.push(...Object.values(item.splitChars))
        continue
      }
      if (
        item.code === 'kingdom' &&
        'doubleGlyphs' in item &&
        item.doubleGlyphs &&
        isDoubleKingdomRenderActive(info as LegendInfo)
      ) {
        list.push(...Object.values(item.doubleGlyphs))
        continue
      }
      if (item.editable?.selectable) {
        list.push(item)
      }
    }

    for (const material of info.customMaterialList) {
      if (material.editable?.selectable !== false) {
        list.push(material)
      }
    }

    return list
      .sort((a, b) => a.order - b.order)
      .map((item) => ({ label: item.name, value: item.code, obj: item as LayoutItem }))
  })

  watch(
    () => selectableOptions.value,
    (options) => {
      const current = selectedItemValue.value
      if (current && options.some((item) => item.value === current)) return
      selectedItemValue.value = options[0]?.value || ''
    },
  )

  // ==================== 画布加载状态 ====================

  /** 并行加载栈：每项对应一次 runWithLoading / startLoading 入栈，完成即弹出；文案取栈顶 */
  interface LoadingStackItem {
    token: string
    taskId: string
    label: string
  }

  const loadingStack = ref<LoadingStackItem[]>([])
  /** startLoading/finishLoading 成对调用时，按 taskId 记录 token 栈 */
  const loadingTokensByTaskId = new Map<string, string[]>()
  let loadingSequence = 0

  /** 从 IndexedDB 恢复历史栈并重载画布时为 true，优先于素材加载文案 */
  const isHistoryRestoreLoading = ref(false)

  /** 首屏 loadAll 完成前为 true，用于延长加载遮罩、避免与 watch 增量重载竞态 */
  const canvasBootstrapPending = ref(false)

  const beginCanvasBootstrap = () => {
    canvasBootstrapPending.value = true
  }

  /** @deprecated 加载文案改由 loadingStack 栈顶驱动，保留空实现避免旧调用报错 */
  const setCanvasBootstrapHint = (_hint: string) => {
    /* noop */
  }

  const endCanvasBootstrap = () => {
    canvasBootstrapPending.value = false
  }

  const activeLoadingTop = computed(() => {
    const stack = loadingStack.value
    return stack.length > 0 ? stack[stack.length - 1]! : null
  })

  const isCanvasLoading = computed(
    () =>
      isHistoryRestoreLoading.value ||
      canvasBootstrapPending.value ||
      loadingStack.value.length > 0,
  )

  const LOADING_SLOW_HINT_DELAY_MS = 20_000
  const loadingSlowHintVisible = ref(false)
  const loadingElapsedSeconds = ref(0)
  let loadingStartedAt = 0
  let loadingSlowHintTimer: ReturnType<typeof globalThis.setTimeout> | undefined
  let loadingElapsedTimer: ReturnType<typeof globalThis.setInterval> | undefined

  const clearLoadingSlowHintTimer = () => {
    if (loadingSlowHintTimer !== undefined) {
      globalThis.clearTimeout(loadingSlowHintTimer)
      loadingSlowHintTimer = undefined
    }
  }

  const clearLoadingElapsedTimer = () => {
    if (loadingElapsedTimer !== undefined) {
      globalThis.clearInterval(loadingElapsedTimer)
      loadingElapsedTimer = undefined
    }
  }

  const syncLoadingElapsedSeconds = () => {
    if (!loadingStartedAt) {
      loadingElapsedSeconds.value = 0
      return
    }
    loadingElapsedSeconds.value = Math.max(0, Math.floor((Date.now() - loadingStartedAt) / 1000))
  }

  const armLoadingSlowHintTimer = () => {
    clearLoadingSlowHintTimer()
    loadingSlowHintTimer = globalThis.setTimeout(() => {
      if (isCanvasLoading.value) {
        loadingSlowHintVisible.value = true
      }
    }, LOADING_SLOW_HINT_DELAY_MS)
  }

  watch(isCanvasLoading, (loading) => {
    clearLoadingSlowHintTimer()
    clearLoadingElapsedTimer()
    loadingSlowHintVisible.value = false
    loadingElapsedSeconds.value = 0
    loadingStartedAt = 0
    if (!loading) return

    loadingStartedAt = Date.now()
    syncLoadingElapsedSeconds()
    loadingElapsedTimer = globalThis.setInterval(syncLoadingElapsedSeconds, 1000)
    armLoadingSlowHintTimer()
  })

  /** 栈顶任务切换时重新计时慢网提示，避免上一项已结束仍误触发 */
  watch(
    () => activeLoadingTop.value?.token,
    (token, prev) => {
      if (!token || token === prev || !isCanvasLoading.value) return
      loadingSlowHintVisible.value = false
      armLoadingSlowHintTimer()
    },
  )

  /** 当前应展示的加载文案（含已等待秒数） */
  const loadingHint = computed(() => {
    let base = ''
    if (isHistoryRestoreLoading.value) {
      base = '正在读取历史记录'
    } else {
      const top = activeLoadingTop.value
      if (top) {
        base = `${top.label}加载中…`
      } else if (canvasBootstrapPending.value) {
        base = '画布加载中…'
      }
    }
    if (!base || loadingElapsedSeconds.value <= 0) return base
    return `${base}（${loadingElapsedSeconds.value}s）`
  })

  /** 加载过久时的第二行提示 */
  const loadingSubHint = computed(() =>
    loadingSlowHintVisible.value ? '网络连接缓慢，可切换网络后刷新重试' : '',
  )

  const beginHistoryRestoreLoading = () => {
    isHistoryRestoreLoading.value = true
  }

  const endHistoryRestoreLoading = () => {
    isHistoryRestoreLoading.value = false
  }

  const pushLoading = (taskId: string, label: string): string => {
    const token = `${taskId}#${++loadingSequence}`
    loadingStack.value = [...loadingStack.value, { token, taskId, label }]
    return token
  }

  const popLoadingToken = (token: string) => {
    const index = loadingStack.value.findIndex((item) => item.token === token)
    if (index < 0) return
    loadingStack.value = [
      ...loadingStack.value.slice(0, index),
      ...loadingStack.value.slice(index + 1),
    ]
  }

  /**
   * 登记一项加载任务（通常仅在实际请求图片/字体时调用）
   * @param taskId 任务唯一标识，建议用素材 code 或 `template:${name}`
   * @param label 展示用中文名，由模板传入，如「原画」「边框」
   */
  const startLoading = (taskId: string, label: string) => {
    const token = pushLoading(taskId, label)
    const tokens = loadingTokensByTaskId.get(taskId) ?? []
    tokens.push(token)
    loadingTokensByTaskId.set(taskId, tokens)
  }

  /**
   * 完成一项加载任务（与 startLoading 成对，弹出该 taskId 最近一次入栈项）
   */
  const finishLoading = (taskId: string) => {
    const tokens = loadingTokensByTaskId.get(taskId)
    if (!tokens?.length) return
    const token = tokens.pop()!
    popLoadingToken(token)
    if (tokens.length === 0) {
      loadingTokensByTaskId.delete(taskId)
    }
  }

  /** clearLoading / release 后递增，丢弃仍在途的 runWithLoading finally */
  let loadingGeneration = 0

  /** 清空所有加载状态（如切换模板组件前） */
  const clearLoading = () => {
    loadingStack.value = []
    loadingTokensByTaskId.clear()
    loadingGeneration += 1
  }

  /** 取消被中断的加载任务（移除栈内同 taskId 的全部项） */
  const releaseLoadingTask = (taskId: string) => {
    loadingStack.value = loadingStack.value.filter((item) => item.taskId !== taskId)
    loadingTokensByTaskId.delete(taskId)
  }

  /**
   * 包裹异步任务并自动维护加载栈（仅用于拉取图片/字体等资源，布局微调请直接改节点）
   */
  const runWithLoading = async <T>(
    taskId: string,
    label: string,
    task: () => Promise<T>,
  ): Promise<T> => {
    const generation = loadingGeneration
    const token = pushLoading(taskId, label)
    try {
      return await task()
    } finally {
      if (generation === loadingGeneration) {
        popLoadingToken(token)
      }
    }
  }

  // ==================== 画布重载 ====================

  /** 递增以通知模板组件重绘 Konva 树 */
  const reloadFlag = ref(0)

  /** 为 true 时模板侧按初始布局重置素材位置/样式 */
  const reloadResetFlag = ref(false)

  type DiyCanvasReloadOptions = {
    /** 历史撤销/重做：不 bump canvasRenderVersion，避免 Konva 整树 remount */
    skipRemount?: boolean
    /** 延后强制刷新滤镜离屏 cache（弱机 history 恢复） */
    deferFilterCacheRefresh?: boolean
    /** 图层 load 串行（弱机降低峰值 CPU） */
    sequentialLoad?: boolean
  }

  let pendingReloadOptions: DiyCanvasReloadOptions = {}

  let reloadSettle: (() => void) | null = null

  /** 模板侧 reload watch 已注册，可安全 await reload() */
  let reloadConsumerReady = false

  const markReloadConsumerReady = () => {
    reloadConsumerReady = true
  }

  const whenReloadConsumerReady = (timeoutMs = 15_000): Promise<void> => {
    if (reloadConsumerReady) return Promise.resolve()
    return new Promise((resolve) => {
      const started = Date.now()
      const tick = () => {
        if (reloadConsumerReady) {
          resolve()
          return
        }
        if (Date.now() - started >= timeoutMs) {
          console.warn('[diyStore] reload consumer ready timeout')
          resolve()
          return
        }
        requestAnimationFrame(tick)
      }
      tick()
    })
  }

  const waitForCanvasIdle = async (timeoutMs = 15_000) => {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (!isCanvasLoading.value) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        })
        return
      }
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, 32)
      })
    }
    console.warn('[diyStore] canvas idle timeout')
  }

  const hasPendingReloadSettlement = () => reloadSettle !== null

  /** 模板尚未挂载时 reload 无法被消费，避免 Promise 永久挂起 */
  const abortPendingReloadSettlement = () => {
    reloadSettle?.()
    reloadSettle = null
  }

  /** 模板 loadAll 完成后由 useDiyTemplate 调用 */
  const settleReload = () => {
    reloadSettle?.()
    reloadSettle = null
    reloadResetFlag.value = false
    scheduleCanvasVisualSettled({ isCanvasLoading: () => isCanvasLoading.value })
  }

  const consumeReloadOptions = (): DiyCanvasReloadOptions => {
    const options = pendingReloadOptions
    pendingReloadOptions = {}
    return options
  }

  /**
   * 触发画布重载
   * @param reset 是否同时重置为默认布局
   * @param options 历史恢复等场景的轻量重载选项
   */
  const reload = (
    reset: boolean = false,
    options: DiyCanvasReloadOptions = {},
  ): Promise<void> => {
    reloadResetFlag.value = reset
    pendingReloadOptions = options
    reloadFlag.value++
    return new Promise((resolve) => {
      reloadSettle = resolve
      if (!reloadConsumerReady) {
        globalThis.setTimeout(() => {
          if (reloadSettle === resolve) {
            console.warn('[diyStore] reload 在模板挂载前未被消费，已自动释放')
            abortPendingReloadSettlement()
          }
        }, 15_000)
      }
    })
  }

  return {
    stageRatio,
    stageConfig,
    finalStageConfig,
    mmToPx,
    ptToPx,
    bleedFlag,
    setBleedFlag,
    applyBleedState,
    scheduleLegendImageReflow,
    consumeLegendImageReflow,
    coverBleed,
    bleedValue,
    maxBleed,
    bleed,
    innerStageBleed,
    outStageBleed,
    selectedItemValue,
    setSelectedItemValue,
    selectedItem,
    selectableOptions,
    reloadFlag,
    reloadResetFlag,
    reload,
    consumeReloadOptions,
    markReloadConsumerReady,
    whenReloadConsumerReady,
    waitForCanvasIdle,
    hasPendingReloadSettlement,
    abortPendingReloadSettlement,
    settleReload,
    canvasVisualSettledRevision,
    scheduleCanvasVisualSettled,
    isCanvasLoading,
    isHistoryRestoreLoading,
    canvasBootstrapPending,
    beginCanvasBootstrap,
    endCanvasBootstrap,
    setCanvasBootstrapHint,
    loadingHint,
    loadingSubHint,
    beginHistoryRestoreLoading,
    endHistoryRestoreLoading,
    startLoading,
    finishLoading,
    clearLoading,
    releaseLoadingTask,
    runWithLoading,
  }
})
