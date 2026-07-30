/**
 * Konva 制图模板框架
 *
 * 各业务模板（如 new-ui-zhuoyue）只需：
 * 1. 在 `composables/setup.ts` 用 `defineTemplateSetup` 登记图层
 * 2. 在 `composables/layers/` 实现 `drawXxx(canvas)`
 * 3. 在 `useTemplate.ts` 中调用 `useDiyTemplate(props, emit, templateSetup)`
 */

export { defineTemplateSetup } from './defineTemplateSetup'
export { useDiyTemplate, type DiyTemplateReturn } from './useDiyTemplate'
export { useTemplateCanvas } from './useTemplateCanvas'
export { createBatchedLayerReload, runLayerReload } from './watchUtils'
export type {
  DrawLayerFn,
  KonvaNodeRef,
  LayerCode,
  LayerDef,
  LayerLoader,
  LayerLoaderMap,
  LayerReloadTarget,
  SetupTemplateWatches,
  TemplateCanvasState,
  TemplateEmit,
  TemplateProps,
  TemplateSetup,
  TemplateWatchContext,
} from './types'
