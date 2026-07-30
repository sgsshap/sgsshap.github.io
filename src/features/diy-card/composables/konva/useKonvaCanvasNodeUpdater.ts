import { useDiyStore, useInfoStore } from '@/features/diy-card/stores'
import { scheduleCanvasVisualSettled } from '@/features/diy-card/composables/preview/canvasVisualSettled'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { resolveStageContentOriginFromDiy } from '@/features/diy-card/composables/konva/konvaStageEdgeSnap'
import { useKonvaBrightnessFilters } from '@/features/diy-card/composables/konva/useKonvaBrightnessFilters'
import {
  scheduleSkillsNameSideImageFilterCacheRefresh,
  syncSkillsNameFrameTintToCanvasConfig,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/skills-name/skillNameStage'
import { scheduleFrameKingdomStripFilterCacheRefresh } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/frame/kingdomStripCache'
import { schedulePackageTextBgFilterCacheRefresh } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/package/packageTextBgCache'
import { scheduleSkillDescShenBgImageFilterCacheRefresh } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/skills-desc/skillDescShenBgCache'
import {
  cacheKonvaNode,
  clearKonvaFilterPreviewFromNode,
  invalidateKonvaTextNodesInSubtree,
  invalidateKonvaTextSubtree,
  konvaConfigNeedsFilterCache,
  konvaFilterPreviewCacheUpToDate,
  konvaNodeNeedsFilterCache,
  syncKonvaTintAttrsFromConfig,
} from '@/features/diy-card/composables/konva/konvaCache'
import {
  isKingdomGlyphCode,
  resolveKingdomLayoutItem,
} from '@/features/diy-card/composables/doubleKingdom'
import { applyLayoutFromRenderObj, createDiyUnitConverters, mergeConfig } from '@/features/diy-card/utils/canvas'
import {
  refreshCustomMaterialDisplayImage,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/custom-material/skillOverlapDisplay'
import {
  isLegendOutOfFrameLoadInFlight,
  refreshLegendOutOfFrameDisplayImage,
  syncLegendOutOfFrameWithLegendImage,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/legend-out-of-frame'
import { shouldKeepLegendOutOfFrameLinkedToLegendImage } from '@/features/diy-card/types/diy/outOfFrame'
import { syncPackageGroupChildrenLayout, isPackageTextBadgeCanvasConfig } from '@/features/diy-card/utils/packageGroupLayout'
import { findCustomMaterial, isCustomMaterialCode } from '@/features/diy-card/utils/customMaterial'
import {
  findCanvasConfigByCode,
  isNameSplitCharCode,
  resolveNameLayoutItem,
} from '@/features/diy-card/utils/nameSplit'
import { shouldUseReducedCanvasQuality } from '@/shared/utils/deviceCapability'
import Konva from 'konva'
import { nextTick, type Reactive, type ShallowRef } from 'vue'

/**
 * useKonvaCanvasNodeUpdater 入参
 */
export interface KonvaCanvasNodeUpdaterOptions {
  /** 各图层 Konva 配置 */
  canvasConfigs: Reactive<Record<string, CanvasItemConfig>>
  /**
   * 图层 code → vue-konva ref + loadFunc
   * loadFunc 在配置缺失时用于兜底重载；ref 用于 updateNode 后 clearCache/cache
   */
  itemCacheMap: ShallowRef<
    Record<string, { ref: ShallowRef<unknown>; loadFunc: () => void }> | undefined
  >
  /** 需要更高 cache pixelRatio 的图层 code（如竖排文字 name） */
  highDprCacheCodes?: string[]
  /** 联动态出框跟随原画后，强制 vue-konva 刷新出框层 */
  bumpLegendOutOfFrameRenderVersion?: () => void
}

/**
 * Konva 节点更新与缓存
 *
 * - `updateNode`：合并 DIY renderConfig → 写入 canvasConfigs → 双 rAF 后 refresh cache
 * - `syncMaterialLayout`：拖拽等场景仅同步位置/旋转/缩放，不重新拉图
 *
 * 由 `useTemplateCanvas` 组装进 TemplateCanvasState。
 */
/** 势力字文字层不做离屏缓存；带 kingdomFrameTint 的图片须 cache（与边框 frame 一致） */
const shouldSkipKonvaPreviewCache = (config: CanvasItemConfig, node: Konva.Node) => {
  if (node.getType() === 'Text') return true
  if (config.text && !config.image) return true
  if (config.code === 'kingdom' || isKingdomGlyphCode(config.code)) {
    return !konvaConfigNeedsFilterCache(config)
  }
  return false
}

const isTextCanvasConfig = (config: CanvasItemConfig) =>
  typeof config.text === 'string' && config.text.length > 0 && !config.image

const configHasTextDescendant = (config: CanvasItemConfig): boolean => {
  if (isTextCanvasConfig(config)) return true
  return config.children?.some(configHasTextDescendant) ?? false
}

const configHasFilterImageDescendant = (config: CanvasItemConfig): boolean => {
  if (konvaConfigNeedsFilterCache(config)) return true
  return config.children?.some(configHasFilterImageDescendant) ?? false
}

/** 含文字或滤镜着色图的 Group 须逐子节点缓存，避免整组 cache 导致边框着色失效 */
const groupNeedsChildCacheTraversal = (config: CanvasItemConfig) =>
  configHasTextDescendant(config) || configHasFilterImageDescendant(config)

const canvasItemLayoutSignature = (config: CanvasItemConfig) =>
  [
    config.x,
    config.y,
    config.width,
    config.height,
    config.scaleX,
    config.scaleY,
    config.rotation,
    config.originX,
    config.originY,
    config.offsetX,
    config.offsetY,
  ].join('|')

type PreviewCacheTarget = { node: Konva.Node; config: CanvasItemConfig }

const SKILLS_DESC_SHEN_BG_CAP_CODE = /^skillsDesc_shen_bg_(top|bottom)$/
const SKILLS_DESC_LAYER_FALLBACK_CODES = ['legendImage', 'frame', 'hp', 'skillsName'] as const

const collectSkillsDescShenBgCapConfigs = (
  config: CanvasItemConfig,
  out: CanvasItemConfig[],
) => {
  if (config.code && SKILLS_DESC_SHEN_BG_CAP_CODE.test(config.code)) {
    if (konvaConfigNeedsFilterCache(config)) out.push(config)
  }
  for (const child of config.children ?? []) {
    collectSkillsDescShenBgCapConfigs(child, out)
  }
}

const findLayerImageByCode = (layer: Konva.Layer, code: string) => {
  for (const node of layer.find('Image') as Konva.Image[]) {
    if ((node.attrs?.code as string | undefined) === code) return node
  }
  return undefined
}

const supplementSkillsDescShenBgCacheTargets = (
  latestConfig: CanvasItemConfig,
  layer: Konva.Layer | null | undefined,
  cacheTargets: PreviewCacheTarget[],
) => {
  if (!layer) return
  const capConfigs: CanvasItemConfig[] = []
  collectSkillsDescShenBgCapConfigs(latestConfig, capConfigs)
  for (const capConfig of capConfigs) {
    const code = capConfig.code
    if (!code) continue
    if (cacheTargets.some(({ node }) => (node.attrs?.code as string | undefined) === code)) {
      continue
    }
    const imageNode = findLayerImageByCode(layer, code)
    if (imageNode) {
      cacheTargets.push({ node: imageNode, config: capConfig })
    }
  }
}

const resolvePreviewLayerForCode = (
  layerCode: string,
  primaryNode: Konva.Node | null | undefined,
  itemCacheMap: KonvaCanvasNodeUpdaterOptions['itemCacheMap'],
) => {
  const primaryLayer = primaryNode?.getLayer()
  if (primaryLayer) return primaryLayer
  if (layerCode !== 'skillsDesc') return null
  for (const fallbackCode of SKILLS_DESC_LAYER_FALLBACK_CODES) {
    const fallbackRef = itemCacheMap.value?.[fallbackCode]?.ref?.value as
      | { getNode?: () => Konva.Node }
      | null
      | undefined
    const fallbackLayer = fallbackRef?.getNode?.()?.getLayer()
    if (fallbackLayer) return fallbackLayer
  }
  return null
}

const applyPreviewCacheTargets = (
  cacheTargets: PreviewCacheTarget[],
  options: { force?: boolean } | undefined,
  highDprCacheCodes: readonly string[] | undefined,
  layer: Konva.Layer | null | undefined,
) => {
  cacheTargets.forEach(({ node: cacheNode, config: nodeConfig }) => {
    if (!konvaConfigNeedsFilterCache(nodeConfig)) {
      if (konvaNodeNeedsFilterCache(cacheNode)) {
        clearKonvaFilterPreviewFromNode(cacheNode)
      }
      return
    }
    if (!options?.force && konvaFilterPreviewCacheUpToDate(cacheNode, nodeConfig)) return
    const nodeCode = (cacheNode.attrs?.code as string | undefined) ?? 'skillsDesc'
    syncKonvaTintAttrsFromConfig(cacheNode, nodeConfig)
    cacheKonvaNode(cacheNode, nodeCode, highDprCacheCodes, nodeConfig)
  })
  layer?.batchDraw()
}

/** 含文字的 Group 只缓存图片子节点，避免 Web 字体未就绪时把 fallback 字形烘焙进离屏缓存 */
const resolvePreviewCacheTargets = (
  node: Konva.Node,
  config: CanvasItemConfig,
): PreviewCacheTarget[] => {
  if (shouldSkipKonvaPreviewCache(config, node)) return []

  if (node.getType() === 'Group' && groupNeedsChildCacheTraversal(config)) {
    const group = node as Konva.Group
    const configChildren = config.children ?? []
    const targets: PreviewCacheTarget[] = []
    for (const child of group.getChildren() ?? []) {
      const childCode = child.attrs?.code as string | undefined
      const childConfig = configChildren.find((item) => item.code === childCode)
      if (!childConfig) {
        if (child.getType() === 'Text') child.clearCache()
        continue
      }
      if (isTextCanvasConfig(childConfig) || child.getType() === 'Text') {
        child.clearCache()
        continue
      }
      targets.push(...resolvePreviewCacheTargets(child, childConfig))
    }
    return targets
  }

  return [{ node, config }]
}

const resolveMaterialReloadCode = (materialCode: string, info: LegendInfo) => {
  if (isNameSplitCharCode(materialCode)) return 'name'
  if (isCustomMaterialCode(info, materialCode)) return 'customMaterials'
  if (materialCode.startsWith('kingdom-')) return 'kingdom'
  return materialCode
}

const scheduleDeferredPreviewFilterRefresh = (
  refresh: (
    layerCode: string,
    config: CanvasItemConfig,
    deferAttempt: number,
    options?: { force?: boolean },
  ) => void,
  layerCode: string,
  config: CanvasItemConfig,
  deferAttempt: number,
  options?: { force?: boolean },
) => {
  requestAnimationFrame(() => refresh(layerCode, config, deferAttempt + 1, options))
}

const collectGroupChildPreviewCacheTargets = (
  group: Konva.Group,
  latestConfig: CanvasItemConfig,
): PreviewCacheTarget[] => {
  const cacheTargets: PreviewCacheTarget[] = []

  for (const child of group.children ?? []) {
    const childCode = (child as Konva.Group).attrs?.code as string | undefined
    if (childCode && isNameSplitCharCode(childCode)) {
      child.clearCache()
      continue
    }

    const childConfig = latestConfig.children?.find((item) => item.code === childCode) ?? latestConfig
    cacheTargets.push(...resolvePreviewCacheTargets(child, childConfig))
  }

  return cacheTargets
}

const scheduleFilterCacheRefreshForCode = (
  code: string,
  nextConfig: CanvasItemConfig,
  schedulePreviewFilterCacheRefresh: (layerCode: string, options?: { force?: boolean }) => void,
  scheduleSkillsNameSideImageFilterCacheRefresh: (
    config: CanvasItemConfig,
    info: LegendInfo,
    getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
  ) => void,
  scheduleSkillDescShenBgImageFilterCacheRefresh: (config: CanvasItemConfig) => void,
  info: LegendInfo,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
) => {
  if (code === 'skillsName') {
    scheduleSkillsNameSideImageFilterCacheRefresh(nextConfig, info, getFilters)
    return
  }
  if (code === 'skillsDesc') {
    schedulePreviewFilterCacheRefresh(code)
    scheduleSkillDescShenBgImageFilterCacheRefresh(nextConfig)
    return
  }
  const force = code === 'legendOutOfFrame' || code === 'package'
  schedulePreviewFilterCacheRefresh(code, force ? { force: true } : undefined)
}

export function useKonvaCanvasNodeUpdater(options: KonvaCanvasNodeUpdaterOptions) {
  const diyStore = useDiyStore()
  const infoStore = useInfoStore()
  const { getFilters } = useKonvaBrightnessFilters()
  const { canvasConfigs, itemCacheMap, highDprCacheCodes = [], bumpLegendOutOfFrameRenderVersion } =
    options
  const getContentOrigin = () => resolveStageContentOriginFromDiy(diyStore)

  /**
   * 根据 renderConfig 同步节点位置/旋转/缩放，不重新请求图片
   * @param materialCode 图层 code
   * @param info 含 renderConfig.items 的模板数据
   */
  const replaceCanvasConfigChild = (
    root: CanvasItemConfig,
    code: string,
    next: CanvasItemConfig,
  ): CanvasItemConfig => {
    if (root.code === code) {
      return { ...root, ...next }
    }
    if (!root.children?.length) return root
    return {
      ...root,
      children: root.children.map((child) =>
        child.code === code ? { ...child, ...next } : replaceCanvasConfigChild(child, code, next),
      ),
    }
  }

  /** 拆分单字 group 含多层 Text，禁止整组 cache（否则会烘焙成仅黑描边） */
  const refreshSplitNameCharGroups = (codes: string[], deferAttempt = 0) => {
    const nodes: Konva.Node[] = []
    for (const code of codes) {
      const inst = itemCacheMap.value?.[code]?.ref?.value as
        | { getNode?: () => Konva.Node }
        | null
        | undefined
      const node = inst?.getNode?.()
      if (node) nodes.push(node)
    }
    if (nodes.length === 0) {
      if (deferAttempt < 16) {
        requestAnimationFrame(() => refreshSplitNameCharGroups(codes, deferAttempt + 1))
      }
      return
    }
    nodes.forEach((node) => invalidateKonvaTextSubtree(node))
  }

  const syncMaterialLayout = (
    materialCode: string,
    info: LegendInfo,
  ) => {
    const items = info.renderConfig.items as Record<string, LayoutItem>
    const renderObj =
      resolveNameLayoutItem(info, materialCode) ??
      resolveKingdomLayoutItem(info, materialCode) ??
      findCustomMaterial(info, materialCode) ??
      items[materialCode]
    if (!renderObj) return

    const located = findCanvasConfigByCode(canvasConfigs, materialCode)
    if (!located) {
      itemCacheMap.value?.[resolveMaterialReloadCode(materialCode, info)]?.loadFunc?.()
      return
    }

    const config = { ...located.target } as CanvasItemConfig
    const contentOrigin = getContentOrigin()
    const converters = createDiyUnitConverters(diyStore.mmToPx)
    applyLayoutFromRenderObj(renderObj, config, contentOrigin, diyStore.mmToPx)

    if (isCustomMaterialCode(info, materialCode)) {
      refreshCustomMaterialDisplayImage(
        materialCode,
        config,
        info,
        {
          stageWidth: diyStore.finalStageConfig.width,
          stageHeight: diyStore.finalStageConfig.height,
          stageOrigin: contentOrigin,
        },
        diyStore.mmToPx,
        diyStore.maxBleed,
      )
    }

    if (materialCode === 'package' && !isPackageTextBadgeCanvasConfig(config)) {
      syncPackageGroupChildrenLayout(
        config,
        converters.mmToPx(renderObj.width),
        converters.mmToPx(renderObj.height),
      )
    }

    if (located.rootKey === materialCode && canvasConfigs[materialCode]) {
      if (materialCode === 'legendOutOfFrame') {
        const refreshed = refreshLegendOutOfFrameDisplayImage(
          config,
          info,
          {
            stageWidth: diyStore.finalStageConfig.width,
            stageHeight: diyStore.finalStageConfig.height,
            stageOrigin: contentOrigin,
          },
          diyStore.mmToPx,
          diyStore.maxBleed,
        )
        if (!refreshed) {
          if (!isLegendOutOfFrameLoadInFlight()) {
            itemCacheMap.value?.legendOutOfFrame?.loadFunc?.()
          }
          return
        }
      }
      updateNode(renderObj, config, false, materialCode === 'package' ? { skipLayoutMerge: true } : undefined)
      return
    }

    const rootConfig = replaceCanvasConfigChild(
      { ...canvasConfigs[located.rootKey]! },
      materialCode,
      config,
    )
    const rootRenderObj = items[located.rootKey]
    if (rootRenderObj) {
      updateNode(rootRenderObj, rootConfig, false)
      return
    }

    // 自定义素材等挂在 group 下、但不在 renderConfig.items 的节点
    if (canvasConfigs[located.rootKey]) {
      canvasConfigs[located.rootKey] = rootConfig
      schedulePreviewFilterCacheRefresh(located.rootKey)
    }
  }

  const MAX_PREVIEW_FILTER_CACHE_DEFER = 32

  const refreshPreviewFilterCache = (
    layerCode: string,
    config: CanvasItemConfig,
    deferAttempt = 0,
    options?: { force?: boolean },
  ) => {
    const latestConfig = canvasConfigs[layerCode] ?? config
    const vueKonvaRef = itemCacheMap.value?.[layerCode]?.ref?.value as
      | { getNode?: () => Konva.Node }
      | null
      | undefined
    const node = vueKonvaRef?.getNode?.()
    const finishPreviewFilterRefresh = (
      cacheTargets: PreviewCacheTarget[],
      textInvalidateRoot?: Konva.Node | null,
    ) => {
      const layer = resolvePreviewLayerForCode(layerCode, node ?? textInvalidateRoot, itemCacheMap)
      applyPreviewCacheTargets(cacheTargets, options, highDprCacheCodes, layer)
      if (textInvalidateRoot && configHasTextDescendant(latestConfig)) {
        if (layerCode === 'skillsDesc') {
          invalidateKonvaTextNodesInSubtree(textInvalidateRoot)
        } else {
          invalidateKonvaTextSubtree(textInvalidateRoot)
        }
      }
      if (layerCode === 'skillsName') {
        scheduleSkillsNameSideImageFilterCacheRefresh(latestConfig, infoStore.info as LegendInfo, getFilters)
      }
      if (layerCode === 'frame') {
        scheduleFrameKingdomStripFilterCacheRefresh(latestConfig, options)
      }
      if (layerCode === 'package') {
        schedulePackageTextBgFilterCacheRefresh(latestConfig, options)
        if (textInvalidateRoot && configHasTextDescendant(latestConfig)) {
          invalidateKonvaTextNodesInSubtree(textInvalidateRoot)
        }
      }
      scheduleCanvasVisualSettled({
        isCanvasLoading: () => diyStore.isCanvasLoading,
      })
    }

    if (!node) {
      const splitCodes =
        latestConfig.children
          ?.filter((child) => isNameSplitCharCode(child.code))
          .map((child) => child.code) ?? []
      if (splitCodes.length > 0) {
        refreshSplitNameCharGroups(splitCodes)
      }
      if (layerCode === 'skillsDesc' && configHasFilterImageDescendant(latestConfig)) {
        const layer = resolvePreviewLayerForCode(layerCode, undefined, itemCacheMap)
        const cacheTargets: PreviewCacheTarget[] = []
        supplementSkillsDescShenBgCacheTargets(latestConfig, layer, cacheTargets)
        if (cacheTargets.length > 0) {
          finishPreviewFilterRefresh(cacheTargets)
          return
        }
      }
      if (
        configHasFilterImageDescendant(latestConfig) &&
        deferAttempt < MAX_PREVIEW_FILTER_CACHE_DEFER
      ) {
        scheduleDeferredPreviewFilterRefresh(
          refreshPreviewFilterCache,
          layerCode,
          latestConfig,
          deferAttempt,
          options,
        )
      }
      return
    }
    const legendInfo = infoStore.info as LegendInfo
    if (layerCode === 'skillsName') {
      scheduleSkillsNameSideImageFilterCacheRefresh(latestConfig, legendInfo, getFilters)
      if (configHasTextDescendant(latestConfig)) {
        invalidateKonvaTextNodesInSubtree(node)
      }
      node.getLayer()?.batchDraw()
      scheduleCanvasVisualSettled({
        isCanvasLoading: () => diyStore.isCanvasLoading,
      })
      return
    }

    const cacheTargets: PreviewCacheTarget[] =
      node.getType() === 'Group'
        ? collectGroupChildPreviewCacheTargets(node as Konva.Group, latestConfig)
        : resolvePreviewCacheTargets(node, config)
    if (layerCode === 'skillsDesc') {
      supplementSkillsDescShenBgCacheTargets(
        latestConfig,
        resolvePreviewLayerForCode(layerCode, node, itemCacheMap),
        cacheTargets,
      )
    }
    if (cacheTargets.length === 0) {
      if (
        configHasFilterImageDescendant(latestConfig) &&
        deferAttempt < MAX_PREVIEW_FILTER_CACHE_DEFER
      ) {
        scheduleDeferredPreviewFilterRefresh(
          refreshPreviewFilterCache,
          layerCode,
          latestConfig,
          deferAttempt,
          options,
        )
        return
      }
      if (configHasTextDescendant(latestConfig)) {
        if (layerCode === 'skillsDesc') {
          invalidateKonvaTextNodesInSubtree(node)
        } else {
          invalidateKonvaTextSubtree(node)
        }
        scheduleCanvasVisualSettled({
          isCanvasLoading: () => diyStore.isCanvasLoading,
        })
      }
      return
    }
    finishPreviewFilterRefresh(cacheTargets, node)
  }

  /** remount 后补刷滤镜离屏 cache（frame / hp 自定义势力色等） */
  const schedulePreviewFilterCacheRefresh = (
    layerCode: string,
    options?: { force?: boolean },
  ) => {
    const resolvedOptions =
      layerCode === 'skillsName' ? { ...options, force: true } : options
    nextTick(() => {
      const run = () => {
        const config = canvasConfigs[layerCode]
        if (!config) return
        refreshPreviewFilterCache(layerCode, config, 0, resolvedOptions)
      }
      if (shouldUseReducedCanvasQuality()) {
        requestAnimationFrame(run)
      } else {
        requestAnimationFrame(() => {
          requestAnimationFrame(run)
        })
      }
    })
  }

  /**
   * 联动态：原画布局写入后同步出框 Konva 配置（cover 重铺 / 拖拽落库等须走此路径）
   */
  const pushLinkedLegendOutOfFrameAfterLegendImage = (info: LegendInfo) => {
    if (!shouldKeepLegendOutOfFrameLinkedToLegendImage(info)) return

    const previousConfig = canvasConfigs.legendOutOfFrame
    const templateProps = {
      stageWidth: diyStore.finalStageConfig.width,
      stageHeight: diyStore.finalStageConfig.height,
      stageOrigin: getContentOrigin(),
    }
    const synced = syncLegendOutOfFrameWithLegendImage(
      canvasConfigs,
      info,
      templateProps,
      diyStore.mmToPx,
      diyStore.maxBleed,
    )
    if (!synced) return

    const nextConfig = canvasConfigs.legendOutOfFrame
    if (
      !nextConfig ||
      (previousConfig &&
        canvasItemLayoutSignature(previousConfig) === canvasItemLayoutSignature(nextConfig))
    ) {
      return
    }

    bumpLegendOutOfFrameRenderVersion?.()
    schedulePreviewFilterCacheRefresh('legendOutOfFrame', { force: true })
  }

  /**
   * 合并布局、写入 canvasConfigs，并在双 rAF 后刷新 Konva cache
   * @param renderObj 渲染配置
   * @param config 节点配置
   * @param isReset 是否按默认布局重置
   * @param options.refreshFilterCache 为 false 时跳过滤镜离屏 cache（仅文案/位移变更）
   */
  const updateNode = (
    renderObj: LayoutItem,
    config: CanvasItemConfig,
    isReset: boolean = false,
    options?: {
      refreshFilterCache?: boolean
      skipLayoutMerge?: boolean
      skipLinkedOutOfFrameSync?: boolean
    },
  ) => {
    if (!options?.skipLayoutMerge) {
      mergeConfig(renderObj, config, getContentOrigin(), diyStore.mmToPx, isReset)
    }
    let nextConfig = config
    if (config.code === 'skillsName') {
      const synced = syncSkillsNameFrameTintToCanvasConfig(
        config,
        infoStore.info as LegendInfo,
        getFilters,
      )
      if (synced) nextConfig = synced
    }
    canvasConfigs[config.code] = nextConfig
    if (config.code === 'legendImage' && !options?.skipLinkedOutOfFrameSync) {
      pushLinkedLegendOutOfFrameAfterLegendImage(infoStore.info as LegendInfo)
    } else if (config.code === 'legendOutOfFrame') {
      bumpLegendOutOfFrameRenderVersion?.()
    }
    if (options?.refreshFilterCache !== false) {
      scheduleFilterCacheRefreshForCode(
        config.code,
        nextConfig,
        schedulePreviewFilterCacheRefresh,
        scheduleSkillsNameSideImageFilterCacheRefresh,
        scheduleSkillDescShenBgImageFilterCacheRefresh,
        infoStore.info as LegendInfo,
        getFilters,
      )
    }
  }

  return { syncMaterialLayout, updateNode, schedulePreviewFilterCacheRefresh }
}
