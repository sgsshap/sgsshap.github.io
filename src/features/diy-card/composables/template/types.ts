import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import type { Reactive, ShallowRef } from 'vue'

/**
 * vue-konva 节点组件实例 ref（所有 Konva 制图模板共用）
 * 通过 `getNode()` 取得底层 Konva.Node，供节点更新、高 DPR 缓存等逻辑使用
 */
export type KonvaNodeRef = ShallowRef<{ getNode: () => import('konva').default.Node } | null>

/**
 * 模板根组件 props（由 DiyPreview 根据画布尺寸传入）
 */
export interface TemplateProps {
  /** 画布内容区宽度（px） */
  stageWidth: number
  /** 画布内容区高度（px） */
  stageHeight: number
  /** 画布内容区左上角在 Layer 内的偏移（px），用于出血、裁切对齐 */
  stageOrigin: { x: number; y: number }
}

/**
 * 模板向父组件抛出的事件
 * @param e 事件名，目前仅 `click`
 * @param nodeName 被点击的素材 code，与 LayerDef.code 一致
 */
export type TemplateEmit = (e: 'click', nodeName: string) => void

/**
 * 单个图层的加载函数
 * @param isReset 为 true 时按模板默认布局/字号等重置后再绘制（用于全量 reload 或字段变更后的文本层）
 */
export type LayerLoader = (isReset?: boolean) => void | Promise<void>

/**
 * 图层绘制工厂：在 setup 中登记，由 useDiyTemplate 在创建画布后调用
 * @param canvas 当前模板实例的画布运行时
 * @returns 该图层的 load 函数，供 loadAll / watch / reloadMaterial 调用
 */
export type DrawLayerFn = (canvas: TemplateCanvasState) => LayerLoader

/**
 * 图层元数据（在模板 `composables/setup.ts` 的 `layers` 数组中配置）
 */
export interface LayerDef {
  /** 图层唯一标识，对应 canvasConfigs 的 key、DIY renderConfig.items 的 key */
  code: string
  /** 中文名，用于加载提示等 */
  name: string
  /** 与模板 index.vue 中 `ref="xxx"` 一致，也作为 useDiyTemplate 返回对象的属性名 */
  refKey: string
  /** 全量加载顺序，数值越小越先执行 */
  order: number
  /** 是否为 Konva Group（子节点写在 children 中） */
  group?: boolean
  /** 为 true 时 loadAll 对该层始终传入 isReset，避免刷新后 merge 旧布局坐标 */
  resetOnLoadAll?: boolean
  /** 是否对该图层启用高 DPR 离屏缓存（见 useKonvaCanvasNodeUpdater） */
  highDprCache?: boolean
  /** 本图层的绘制实现，定义在模板 `layers/*.ts` */
  draw: DrawLayerFn
}

/**
 * 单张模板组件实例的画布运行时
 * 由 useTemplateCanvas 创建，经 draw 函数与 useDiyTemplate 向下传递，不在模块间隐式共享
 */
export type PreviewFilterCacheRefreshOptions = {
  /** 全量 reload 后强制重建离屏 cache，禁止「仍是最新」判定（避免沿用旧着色） */
  force?: boolean
}

export interface TemplateCanvasState {
  /** 画布 props */
  props: TemplateProps
  /** 各图层 vue-konva ref，key 为 LayerDef.refKey */
  refs: Record<string, KonvaNodeRef>
  /** 当前模板数据（武将牌为 LegendInfo） */
  info: LegendInfo
  /** 各图层 Konva 配置，驱动 index.vue 中的 :config */
  canvasConfigs: Reactive<Record<string, CanvasItemConfig>>
  /**
   * 图层 code → ref + loadFunc，用于 Konva 节点更新器挂载 loadFunc、触发单图层重载
   */
  itemCacheMap: ShallowRef<Record<string, { ref: KonvaNodeRef; loadFunc: () => void }> | undefined>
  /** 递增后用于 index.vue 中 :key，强制整层重挂载（如全局 reload） */
  canvasRenderVersion: ShallowRef<number>
  /** 出框独立开关变更后递增，强制人物出框 v-image remount 以重绑 Konva 事件 */
  legendOutOfFrameRenderVersion: ShallowRef<number>
  /** 将布局数据写入 canvasConfigs 并同步到 Konva 节点 */
  updateNode: (
    renderObj: LayoutItem,
    config: CanvasItemConfig,
    isReset?: boolean,
    options?: {
      refreshFilterCache?: boolean
      skipLayoutMerge?: boolean
      /** 原画渐进解码中跳过出框联动，避免反复 bump / 重载抖动 */
      skipLinkedOutOfFrameSync?: boolean
    },
  ) => void
  /** 拖拽结束后落库某一图层的布局 */
  syncMaterialLayout: (materialCode: string) => void
  /** 生成可拖拽图层的 Konva 拖拽相关属性 */
  getDragger: (renderObj: LayoutItem, code: string) => Record<string, unknown>
  /** 生成图层选中（点击）相关属性 */
  getSelectHandlers: () => Record<string, unknown>
  /** 注册拆分单字 group 的 vue-konva 实例 ref */
  registerSplitNameGroupRef: (code: string, inst: unknown) => void
  /** 注册双势力单字 Image 的 vue-konva 实例 ref */
  registerKingdomGlyphRef: (code: string, inst: unknown) => void
  /** remount 后按 canvasConfigs 补刷滤镜离屏 cache */
  schedulePreviewFilterCacheRefresh: (
    layerCode: string,
    options?: PreviewFilterCacheRefreshOptions,
  ) => void
}

/** 从模板 setup 推导图层 code 联合类型 */
export type LayerCode<S extends TemplateSetup> = S['layers'][number]['code']

/** 图层 code → load 函数（与 setup.layers 一一对应） */
export type LayerLoaderMap<C extends string> = {
  [K in C]: LayerLoader
}

/**
 * 一次 watch 触发后要重载的图层
 */
export interface LayerReloadTarget<C extends string = string> {
  /** 目标图层 code，须已在 TemplateSetup.layers 中登记 */
  code: C
  /** 是否以 isReset=true 调用该图层的 load */
  reset?: boolean
}

/**
 * 模板 `watches.ts` 注册 watch 时可用的运行时上下文
 */
export interface TemplateWatchContext<S extends TemplateSetup = TemplateSetup> {
  info: LegendInfo
  loaders: LayerLoaderMap<LayerCode<S>>
  canvas: TemplateCanvasState
  /** 全量重载全部图层 */
  loadAll: (isReset?: boolean) => void
  /** 单图层热重载（走 canvasConfigs.loadFunc） */
  reloadMaterial: (code: LayerCode<S>) => void
  /** 按目标列表批量 load */
  runLayerReload: (targets: LayerReloadTarget<LayerCode<S>>[]) => void
  /** 按新出血原点同步布局（不重建模板默认位置） */
  syncMaterialLayout: (code: LayerCode<S>) => void
  /** 递增后强制 Konva 子树重挂载 */
  canvasRenderVersion: ShallowRef<number>
  /** 首屏 loadAll 是否已完成（完成前跳过 watch 触发的增量重载） */
  isInitialLoadComplete: () => boolean
}

/** 模板在 `watches.ts` 中实现的 watch 注册函数 */
export type SetupTemplateWatches<S extends TemplateSetup = TemplateSetup> = (
  ctx: TemplateWatchContext<S>,
) => void | (() => void)

/**
 * 模板差异配置（复制新模板时主要在 setup.ts 中维护）
 */
export interface TemplateSetup {
  /** 本模板全部图层定义（含绘制函数引用） */
  layers: LayerDef[]
}
