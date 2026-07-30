/**
 * DIY 制图 composables 统一出口
 *
 * - `template/`：Konva 模板框架
 * - `konva/`：Konva 节点、图片、滤镜、拖拽
 * - `preview/`：制图页预览区 UI
 */

export { defineTemplateSetup, useDiyTemplate, useTemplateCanvas } from './template'
export type {
  DiyTemplateReturn,
  DrawLayerFn,
  KonvaNodeRef,
  LayerDef,
  LayerLoader,
  TemplateCanvasState,
  TemplateEmit,
  TemplateProps,
  TemplateSetup,
} from './template'

export { captureStageDataURL } from './konva/konvaStageExport'
export type { StageExportConfig } from './konva/konvaStageExport'
export { createTrackedKonvaImageLoader, loadKonvaImage } from './konva/useKonvaImageLoader'
export { loadWebFontFamily, loadWebFontFamilies } from '../utils/loadWebFontFamily'
export type {
  LoadWebFontFamilyOptions,
  LoadWebFontFamiliesOptions,
} from '../utils/loadWebFontFamily'
export { useKonvaBrightnessFilters } from './konva/useKonvaBrightnessFilters'
export { useKonvaCanvasNodeUpdater } from './konva/useKonvaCanvasNodeUpdater'
export type { KonvaCanvasNodeUpdaterOptions } from './konva/useKonvaCanvasNodeUpdater'
export { useKonvaMaterialDragger } from './konva/useKonvaMaterialDragger'
export type { KonvaMaterialDraggerOptions } from './konva/useKonvaMaterialDragger'
export { useKonvaNodeSelection } from './konva/useKonvaNodeSelection'

export {
  canvasVisualSettledRevision,
  scheduleCanvasVisualSettled,
  cancelCanvasVisualSettled,
} from './preview/canvasVisualSettled'
export type { ScheduleCanvasVisualSettledOptions } from './preview/canvasVisualSettled'
export {
  useDiyCanvasFloatPreview,
} from './preview/useDiyCanvasFloatPreview'
export { useCanvasBackgroundRecovery } from './preview/useCanvasBackgroundRecovery'
export type { CanvasBackgroundRecoveryOptions } from './preview/useCanvasBackgroundRecovery'
export {
  APP_TABBAR_LAYOUT_RESERVE_PX,
  getAppBottomLayoutReservePx,
  measurePreviewFixedFooterChrome,
  resolvePreviewStackMaxCanvasHeight,
} from './preview/previewViewportMetrics'
export { useCanvasBrightnessPreview } from './preview/useCanvasBrightnessPreview'
export {
  useDiyCanvasPin,
  PINNED_SHELL_VIEWPORT_MARGIN_Y_PX,
  PINNED_PIN_BAR_CANVAS_GAP_PX,
  PINNED_CANVAS_INSET_X_PX,
  PINNED_CANVAS_INSET_Y_PX,
  PINNED_VIEWPORT_FIT_BUFFER_PX,
} from './preview/useDiyCanvasPin'
export { useDiyCanvasKeyboardShortcuts } from './preview/useDiyCanvasKeyboardShortcuts'
export type { DiyCanvasKeyboardShortcutsOptions } from './preview/useDiyCanvasKeyboardShortcuts'

export {
  record,
  initDiyHistory,
  recordReadProgress,
  resetCanvasToInitial,
  resetCanvasAndHistoryCompletely,
  suppressHistoryRecord,
} from '../utils/diyHistoryRecord'
export {
  applyFieldChange,
  buildModifyLabel,
  formatHistoryValue,
  recordModify,
  recordTextBlurModify,
  recordTextBlurModifyAgainstHistory,
  createTextBlurHistoryHandlers,
} from '../utils/diyHistoryField'
export type { RecordModifyOptions } from '../utils/diyHistoryField'
export type { DiyRecordInput } from '../utils/diyHistoryRecord'
export { useDiyHistoryStore } from '../stores'
