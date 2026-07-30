import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import { reactive, shallowRef } from 'vue'
import { isKingdomGlyphCode } from '@/features/diy-card/composables/doubleKingdom'
import { isNameSplitCharCode } from '@/features/diy-card/utils/nameSplit'
import { useKonvaCanvasNodeUpdater } from '../konva/useKonvaCanvasNodeUpdater'
import { useKonvaMaterialDragger } from '../konva/useKonvaMaterialDragger'
import { useKonvaNodeSelection } from '../konva/useKonvaNodeSelection'
import { createLiveDiyInfo } from './createLiveDiyInfo'
import type { KonvaNodeRef, LayerDef, TemplateCanvasState, TemplateEmit, TemplateProps } from './types'

/** 按 LayerDef.refKey 创建 vue-konva 组件 ref */
function createTemplateRefs(layers: LayerDef[]) {
  const refs: Record<string, KonvaNodeRef> = {}
  for (const layer of layers) {
    refs[layer.refKey] = shallowRef(null)
  }
  return refs
}

/** 按 LayerDef 生成初始 canvasConfigs（Group 图层带空 children） */
function createDefaultCanvasConfigs(layers: LayerDef[]) {
  const configs: Record<string, CanvasItemConfig> = {}
  for (const layer of layers) {
    configs[layer.code] = {
      code: layer.code,
      name: layer.name,
      ...(layer.group ? { children: [] } : {}),
    }
  }
  return reactive(configs)
}

/**
 * 创建单张模板实例的画布运行时
 *
 * 组装 DIY store、refs、canvasConfigs、节点更新 / 拖拽 / 选中能力。
 * 由 `useDiyTemplate` 调用，结果通过参数传给各 `drawXxx`，不使用模块级隐式状态。
 *
 * @param props 画布尺寸与原点（DiyPreview 传入）
 * @param emit 点击图层时向父组件上报 code
 * @param layers 与模板 setup.ts 中一致的图层定义列表
 */
export function useTemplateCanvas(
  props: TemplateProps,
  emit: TemplateEmit,
  layers: LayerDef[],
): TemplateCanvasState {
  const info = createLiveDiyInfo()

  const refs = createTemplateRefs(layers)
  const canvasConfigs = createDefaultCanvasConfigs(layers)
  const itemCacheMap = shallowRef<
    Record<string, { ref: KonvaNodeRef; loadFunc: () => void }> | undefined
  >()
  const canvasRenderVersion = shallowRef(0)
  const legendOutOfFrameRenderVersion = shallowRef(0)

  const highDprCacheCodes = layers.filter((l) => l.highDprCache).map((l) => l.code)

  const { updateNode, syncMaterialLayout: syncLayout, schedulePreviewFilterCacheRefresh } =
    useKonvaCanvasNodeUpdater({
      canvasConfigs,
      itemCacheMap,
      highDprCacheCodes,
      bumpLegendOutOfFrameRenderVersion: () => {
        legendOutOfFrameRenderVersion.value++
      },
    })
  const syncMaterialLayout = (materialCode: string) => syncLayout(materialCode, info)

  const { getSelectHandlers } = useKonvaNodeSelection(info, (code) => emit('click', code))
  const { getDragger } = useKonvaMaterialDragger({
    onDragSelect: (code) => emit('click', code),
    syncMaterialLayout,
  })

  /** 子图层 vue-konva ref（双势力字、拆分单字等） */
  const registerSubLayerRef = (
    code: string,
    inst: unknown,
    options: { matchCode: (code: string) => boolean; parentCode: string },
  ) => {
    if (!options.matchCode(code)) return
    const map = itemCacheMap.value ?? {}
    const parentLoader = map[options.parentCode]?.loadFunc
    const nodeRef = inst as KonvaNodeRef['value']
    if (!inst) {
      if (map[code]) map[code]!.ref.value = null
      return
    }
    if (!map[code]) {
      map[code] = {
        ref: shallowRef(nodeRef),
        loadFunc: parentLoader ?? (() => undefined),
      }
    } else {
      map[code]!.ref.value = nodeRef
    }
    itemCacheMap.value = map
  }

  const registerKingdomGlyphRef = (code: string, inst: unknown) =>
    registerSubLayerRef(code, inst, { matchCode: isKingdomGlyphCode, parentCode: 'kingdom' })

  const registerSplitNameGroupRef = (code: string, inst: unknown) =>
    registerSubLayerRef(code, inst, { matchCode: isNameSplitCharCode, parentCode: 'name' })

  return {
    props,
    refs,
    info,
    canvasConfigs,
    itemCacheMap,
    canvasRenderVersion,
    legendOutOfFrameRenderVersion,
    updateNode,
    syncMaterialLayout,
    getDragger,
    getSelectHandlers,
    registerSplitNameGroupRef,
    registerKingdomGlyphRef,
    schedulePreviewFilterCacheRefresh,
  }
}
