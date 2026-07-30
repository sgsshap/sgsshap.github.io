import { getCanvasVisualSettledDebounceMs } from '@/shared/utils/deviceCapability'
import { debounce, scheduleAfterUiPaint } from '@/shared/utils/scheduling'
import { ref } from 'vue'

/**
 * Konva 主画布完成一轮可见更新后递增，悬挂预览等镜像层监听此 revision。
 */
export const canvasVisualSettledRevision = ref(0)

export type ScheduleCanvasVisualSettledOptions = {
  /** 为 true 时等待异步素材/字体 loading 结束后再判定 settled */
  isCanvasLoading?: () => boolean
}

let paintAfterUiCancel: (() => void) | null = null
let loadingPollId: ReturnType<typeof globalThis.setTimeout> | null = null

const cancelPendingSettle = () => {
  paintAfterUiCancel?.()
  paintAfterUiCancel = null
  if (loadingPollId !== null) {
    globalThis.clearTimeout(loadingPollId)
    loadingPollId = null
  }
}

const bumpRevision = () => {
  canvasVisualSettledRevision.value++
}

const flushCanvasVisualSettled = (options?: ScheduleCanvasVisualSettledOptions) => {
  cancelPendingSettle()

  const isLoading = options?.isCanvasLoading ?? (() => false)

  const waitLoadingThenCapturePaint = () => {
    if (isLoading()) {
      loadingPollId = globalThis.setTimeout(waitLoadingThenCapturePaint, 40)
      return
    }
    loadingPollId = null

    paintAfterUiCancel = scheduleAfterUiPaint(() => {
      paintAfterUiCancel = null
      requestAnimationFrame(bumpRevision)
    })
  }

  waitLoadingThenCapturePaint()
}

/**
 * 在 Konva 图层更新、布局同步或配置变更后调用。
 * 防抖合并同一帧内的多次请求，并在 loading 结束且 Konva batchDraw 后再递增 revision。
 */
export const scheduleCanvasVisualSettled = debounce(
  (options?: ScheduleCanvasVisualSettledOptions) => flushCanvasVisualSettled(options),
  getCanvasVisualSettledDebounceMs(),
)

export const cancelCanvasVisualSettled = () => {
  scheduleCanvasVisualSettled.cancel()
  cancelPendingSettle()
}
