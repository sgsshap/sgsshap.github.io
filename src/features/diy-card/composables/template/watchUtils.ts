import { scheduleCanvasVisualSettled } from '@/features/diy-card/composables/preview/canvasVisualSettled'
import { useDiyStore } from '@/features/diy-card/stores'
import { debounce, scheduleAfterSwitchTransition, scheduleAfterUiPaint } from '@/shared/utils/scheduling'
import { shouldUseReducedCanvasQuality } from '@/shared/utils/deviceCapability'
import type { LayerLoaderMap, LayerReloadTarget } from './types'

const notifyCanvasVisualSettled = () => {
  const diyStore = useDiyStore()
  scheduleCanvasVisualSettled({ isCanvasLoading: () => diyStore.isCanvasLoading })
}

/** 配置开关触发的图层重载防抖（ms），合并同一轮 watch */
const LAYER_RELOAD_DEBOUNCE_MS = () => (shouldUseReducedCanvasQuality() ? 72 : 48)

/** 开关动画期间合并多路 watch，动画结束后再 flush */
const TOGGLE_LAYER_RELOAD_MERGE_MS = () => (shouldUseReducedCanvasQuality() ? 24 : 16)

export type LayerReloadDeferStrategy = 'uiPaint' | 'switchTransition'

/** 按目标列表调用各图层 load / load(true)，并等待异步 load 完成 */
export const runLayerReload = async <C extends string>(
  loaders: LayerLoaderMap<C>,
  targets: LayerReloadTarget<C>[],
) => {
  const tasks: Promise<unknown>[] = []
  const skillsDescTarget = targets.find((target) => target.code === 'skillsDesc')
  const skillsNameTarget = targets.find((target) => target.code === 'skillsName')
  const otherTargets = targets.filter(
    (target) => target.code !== 'skillsDesc' && target.code !== 'skillsName',
  )

  for (const { code, reset } of otherTargets) {
    const result = reset ? loaders[code](true) : loaders[code]()
    if (result instanceof Promise) {
      tasks.push(result)
    }
  }

  if (skillsDescTarget || skillsNameTarget) {
    tasks.push(
      (async () => {
        for (const target of [skillsDescTarget, skillsNameTarget]) {
          if (!target) continue
          const loader = loaders[target.code as C]
          if (!loader) continue
          const result = target.reset ? loader(true) : loader()
          if (result instanceof Promise) await result
        }
      })(),
    )
  }

  await Promise.all(tasks)
}

/**
 * 合并同一轮配置变更的图层重载。
 * - uiPaint：数字/文本等，DOM 绘制后再 load
 * - switchTransition：详细设置开关，等 n-switch 动画结束后再 load
 */
export const createBatchedLayerReload = <C extends string>(
  loaders: LayerLoaderMap<C>,
  options?: { defer?: LayerReloadDeferStrategy },
) => {
  const deferStrategy = options?.defer ?? 'uiPaint'
  const pending = new Map<C, LayerReloadTarget<C>>()
  let cancelDeferredFlush: (() => void) | undefined

  const flushNow = () => {
    cancelDeferredFlush = undefined
    if (!pending.size) return
    const batch = [...pending.values()]
    pending.clear()
    void runLayerReload(loaders, batch).finally(notifyCanvasVisualSettled)
  }

  const flushAfterDefer = () => {
    cancelDeferredFlush?.()
    cancelDeferredFlush =
      deferStrategy === 'switchTransition'
        ? scheduleAfterSwitchTransition(flushNow)
        : scheduleAfterUiPaint(flushNow)
  }

  const debouncedFlushAfterDefer = debounce(
    flushAfterDefer,
    deferStrategy === 'switchTransition'
      ? TOGGLE_LAYER_RELOAD_MERGE_MS()
      : LAYER_RELOAD_DEBOUNCE_MS(),
  )

  const schedule = (targets: LayerReloadTarget<C>[]) => {
    for (const target of targets) {
      const prev = pending.get(target.code)
      pending.set(target.code, {
        code: target.code,
        reset: Boolean(prev?.reset || target.reset),
      })
    }
    debouncedFlushAfterDefer()
  }

  const cancel = () => {
    debouncedFlushAfterDefer.cancel()
    cancelDeferredFlush?.()
    cancelDeferredFlush = undefined
    pending.clear()
  }

  return { schedule, flush: flushNow, cancel }
}
