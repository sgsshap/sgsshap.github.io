/** 是否已缓存弱性能判定（会话内不变） */
let lightEffectsCached: boolean | null = null

/** 是否已缓存 iOS / iPadOS WebKit 判定（会话内不变） */
let iosWebKitCached: boolean | null = null

/** iOS / iPadOS Safari（含 iPad 桌面 UA） */
export function isIOSWebKit(): boolean {
  if (iosWebKitCached !== null) return iosWebKitCached
  if (typeof navigator === 'undefined') {
    iosWebKitCached = false
    return false
  }
  const ua = navigator.userAgent
  const isClassicIOS = /iPad|iPhone|iPod/.test(ua)
  const isIPadDesktopUA =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1
  iosWebKitCached = isClassicIOS || isIPadDesktopUA
  return iosWebKitCached
}

/** 与 systemStore.narrowScreenWidth 一致：canvasMaxWidth(640) × 2 */
const NARROW_VIEWPORT_MAX_WIDTH = 1280

/** 制图页 PC 双栏 / 桌面弹层阈值（与 systemStore.isDiyPcLayout 一致） */
export const DIY_PC_LAYOUT_MIN_WIDTH = 1024

/** 当前视口是否走制图页 PC 布局与 PC 弹层样式 */
export function isDiyPcLayoutViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= DIY_PC_LAYOUT_MIN_WIDTH
}

/** 用户或系统要求减少动效 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 当前视口是否为制图页窄屏布局（移动端） */
export function isNarrowViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < NARROW_VIEWPORT_MAX_WIDTH
}

/**
 * 弱性能设备：减少动效、降低拖拽与画布重绘开销。
 * 依据 prefers-reduced-motion、CPU 核数、deviceMemory（Chromium）。
 */
export function shouldUseLightDragEffects(): boolean {
  if (lightEffectsCached !== null) return lightEffectsCached
  if (typeof window === 'undefined') {
    lightEffectsCached = false
    return false
  }
  if (prefersReducedMotion()) {
    lightEffectsCached = true
    return true
  }
  const cores = navigator.hardwareConcurrency ?? 8
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const lowCores = cores > 0 && cores <= 4
  const lowMemory = memory !== undefined && memory < 4
  lightEffectsCached = lowCores || lowMemory || isIOSWebKit()
  return lightEffectsCached
}

/**
 * 预览区 Canvas 是否应降画质（弱机或窄屏）。
 * 窄屏随窗口 resize 重新判定，不写入 lightEffectsCached。
 */
export function shouldUseReducedCanvasQuality(): boolean {
  return shouldUseLightDragEffects() || isNarrowViewport()
}

/** Konva 节点缓存 / 画布导出用的像素比上限 */
export function getKonvaPixelRatioCap(): number {
  if (isIOSWebKit()) return 1.25
  if (shouldUseReducedCanvasQuality()) return 1.5
  return 2
}

/** 预览 Stage 在 CSS scale 缩小时补偿 pixelRatio 的上限（仅影响画布预览，不影响导出） */
export function getPreviewStagePixelRatioMax(): number {
  if (isIOSWebKit()) return 1.25
  return shouldUseReducedCanvasQuality() ? 2.5 : 3
}

/**
 * 预览区 Stage pixelRatio：CSS transform 缩小时提高内部分辨率，减轻文字/细线发糊。
 * 导出走 captureStageDataURL 独立 pixelRatio，不受此函数影响。
 */
export function resolvePreviewStagePixelRatio(displayScale: number): number {
  const baseDpr = Math.min(
    Math.max(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1),
    getKonvaPixelRatioCap(),
  )
  const scale = Math.min(Math.max(displayScale, 0.01), 1)
  const maxRatio = getPreviewStagePixelRatioMax()
  if (isIOSWebKit()) {
    // iOS：CSS transform + 高 DPR buffer 易卡顿且易出现 canvas 与容器 1px 缝隙
    return Math.min(baseDpr, maxRatio)
  }
  if (scale >= 0.999) return baseDpr
  return Math.min(maxRatio, baseDpr / scale)
}

/** 竖排文字等高 DPR 缓存图层在弱机上的 pixelRatio */
export function getKonvaHighCachePixelRatio(): number {
  if (isIOSWebKit()) return 1.25
  if (shouldUseReducedCanvasQuality()) return 1.5
  return 2.5
}

/** 悬挂预览刷新 debounce（ms） */
export function getFloatPreviewRefreshDebounceMs(): number {
  return shouldUseReducedCanvasQuality() ? 140 : 56
}

/** 悬挂预览两次截图之间的最小间隔（ms），避免编辑连打时 GPU/内存峰值 */
export function getFloatPreviewMinRefreshIntervalMs(): number {
  return shouldUseReducedCanvasQuality() ? 360 : 140
}

/** 显式即时刷新（delay=0）允许的最小间隔，低于常规 min interval */
export function getFloatPreviewImmediateMinIntervalMs(): number {
  return shouldUseReducedCanvasQuality() ? 120 : 48
}

/** 悬挂预览从 Stage 导出时使用的 pixelRatio（低于主画布，减内存） */
export function getFloatPreviewSnapshotPixelRatio(): number {
  return shouldUseReducedCanvasQuality() ? 1 : 1.25
}

/** Konva settled 防抖（ms），合并 reload 触发的 revision 递增 */
export function getCanvasVisualSettledDebounceMs(): number {
  return shouldUseReducedCanvasQuality() ? 96 : 48
}

/** 技能描述正文编辑触发的画布重载 debounce（ms） */
export function getSkillsDescContentReloadDebounceMs(): number {
  return shouldUseReducedCanvasQuality() ? 480 : 320
}

/** 技能区配置项（间距/字号/繁体等）触发的重载 debounce（ms） */
export function getSkillsConfigReloadDebounceMs(): number {
  return shouldUseReducedCanvasQuality() ? 280 : 128
}

/** 弱机下自动优化字号的最小间隔（ms），避免连打时反复二分测高 */
export function getSkillsDescAutoSizeMinIntervalMs(): number {
  return shouldUseReducedCanvasQuality() ? 640 : 320
}

/** 用户操作 / 新增历史步的 IndexedDB 持久化 debounce（ms） */
export function getHistoryPersistDebounceMs(): number {
  return shouldUseReducedCanvasQuality() ? 120 : 80
}

/** 仅 layout 几何写回后的持久化 debounce（ms），拖拽等高频场景略长 */
export function getHistoryLayoutPersistDebounceMs(): number {
  return shouldUseReducedCanvasQuality() ? 900 : 500
}

/** 画布 settle 后同步 layout 到快照的 debounce（ms） */
export function getHistoryCanvasSettleSyncDebounceMs(): number {
  return shouldUseReducedCanvasQuality() ? 280 : 180
}

/** 弱机撤销/重做后延后刷新滤镜 cache（ms） */
export function getHistoryFilterCacheDeferMs(): number {
  return shouldUseReducedCanvasQuality() ? 120 : 0
}

/** 首屏历史锚点写入前等待画布稳定（ms） */
export function getHistoryBootstrapSettleMs(): number {
  return shouldUseReducedCanvasQuality() ? 480 : 240
}

/** iOS WebKit 下单张 canvas 长边上限，避免 GPU 回收导致双画布空白 */
export const IOS_OUT_OF_FRAME_MAX_EDGE = 2048

/** 按设备能力限制出框相关 canvas 尺寸（仅 iOS 缩边，其它平台原样返回） */
export function capOutOfFrameDimensionsForDevice(width: number, height: number) {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  if (!isIOSWebKit()) return { width: w, height: h }
  const maxEdge = Math.max(w, h)
  if (maxEdge <= IOS_OUT_OF_FRAME_MAX_EDGE) return { width: w, height: h }
  const scale = IOS_OUT_OF_FRAME_MAX_EDGE / maxEdge
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  }
}
