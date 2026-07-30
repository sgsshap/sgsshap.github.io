type FloatPreviewRefreshFn = (delay?: number) => void

let refreshFn: FloatPreviewRefreshFn | null = null

/** 由 useDiyCanvasFloatPreview 注册，供拖拽等高频交互触发镜像刷新 */
export function registerFloatPreviewLiveRefresh(fn: FloatPreviewRefreshFn | null) {
  refreshFn = fn
}

/** 交互进行中请求悬挂预览尽快跟上（仍受设备能力节流） */
export function scheduleFloatPreviewLiveRefresh() {
  refreshFn?.(0)
}
