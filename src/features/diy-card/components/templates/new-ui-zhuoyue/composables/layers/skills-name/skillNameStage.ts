import { isCustomKingdomActive } from '@/features/diy-card/composables/doubleKingdom'
import {
  cacheKonvaNode,
  konvaConfigNeedsFilterCache,
  syncKonvaTintAttrsFromConfig,
} from '@/features/diy-card/composables/konva/konvaCache'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import type Konva from 'konva'
import { resolveSkillFrameSideKeys, usesShenSkillNameFrame } from './frameAssets'
import { resolveSkillFrameSideTintForSlot } from './skillFrameTint'

type VueKonvaNodeRef = { getNode?: () => Konva.Node } | null

const SKILLS_NAME_SIDE_CODE = /^skillsName_(left|right)_(\d+)$/

const skillsNameSideImageRefRegistry = new Map<string, VueKonvaNodeRef>()

const MAX_SKILLS_NAME_SIDE_CACHE_DEFER = 48

export const isSkillsNameFrameSideCode = (code: string | undefined) =>
  Boolean(code && SKILLS_NAME_SIDE_CODE.test(code))

/** 绑定技能框 left/right vue-konva Image ref（供离屏 cache 直刷） */
export const bindSkillsNameSideImageRef = (code: string | undefined, el: unknown) => {
  if (!code || !isSkillsNameFrameSideCode(code)) return
  if (!el) {
    skillsNameSideImageRefRegistry.delete(code)
    return
  }
  skillsNameSideImageRefRegistry.set(code, el as VueKonvaNodeRef)
}

const stripSkillFrameSideTintAttrs = (layer: CanvasItemConfig): CanvasItemConfig => {
  const {
    red: _red,
    green: _green,
    blue: _blue,
    filters: _filters,
    brightness: _brightness,
    globalCompositeOperation: _gco,
    ...rest
  } = layer
  return rest
}

const mergeSkillFrameSideTint = (
  layer: CanvasItemConfig,
  tint: Record<string, unknown>,
): CanvasItemConfig => {
  const hasRgbTint =
    typeof tint.red === 'number' &&
    typeof tint.green === 'number' &&
    typeof tint.blue === 'number' &&
    Array.isArray(tint.filters) &&
    tint.filters.length >= 1
  if (!hasRgbTint) return stripSkillFrameSideTintAttrs(layer)
  return { ...stripSkillFrameSideTintAttrs(layer), ...tint }
}

/** 将技能框组内图层叠加上组偏移，写入 skillsName 根 children（与 hp/frame 同级） */
export const offsetLayer = (
  layer: CanvasItemConfig,
  offsetX: number,
  offsetY: number,
): CanvasItemConfig => {
  const originX = layer.originX ?? layer.x ?? 0
  const originY = layer.originY ?? layer.y ?? 0
  return {
    ...layer,
    originX: offsetX + originX,
    originY: offsetY + originY,
    x: offsetX + (layer.x ?? originX),
    y: offsetY + (layer.y ?? originY),
  }
}

/** 技能名 group 配置：children / 亮度滤镜勿写入 Konva attrs */
export const resolveSkillsNameKonvaGroupConfig = (
  root: CanvasItemConfig | undefined,
): CanvasItemConfig | undefined => {
  if (!root) return undefined
  const {
    children: _children,
    filters: _filters,
    brightness: _brightness,
    globalCompositeOperation: _gco,
    ...konvaConfig
  } = root
  return konvaConfig
}

/** skillsName 根 children（加载阶段已展平；left/right RGB 滤镜须为根组直接子节点） */
export const flattenSkillsNameStageLayers = (
  root: CanvasItemConfig | undefined,
): CanvasItemConfig[] => root?.children ?? []

export const applySkillsNameFrameKingdomTint = (
  layers: CanvasItemConfig[],
  info: LegendInfo,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
): CanvasItemConfig[] => {
  if (!isCustomKingdomActive(info)) return layers
  return layers.map((layer) => {
    const match = layer.code?.match(SKILLS_NAME_SIDE_CODE)
    if (!match || !layer.image) return layer
    const side = match[1] as 'left' | 'right'
    const index = Number(match[2])
    const skill = info.baseInfo.skills[index]
    if (!skill) return layer

    const keys = resolveSkillFrameSideKeys(info, skill)
    if (usesShenSkillNameFrame(keys)) return layer

    const slot = side === 'left' ? keys.leftColorSlot : keys.rightColorSlot
    if (!slot) return stripSkillFrameSideTintAttrs(layer)

    return mergeSkillFrameSideTint(
      layer,
      resolveSkillFrameSideTintForSlot(info, slot, getFilters),
    )
  })
}

/** 根 children + 实时 left/right 着色（vue-konva 与 Konva cache 共用） */
export const resolveSkillsNameStageLayersWithTint = (
  root: CanvasItemConfig | undefined,
  info: LegendInfo,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
): CanvasItemConfig[] =>
  applySkillsNameFrameKingdomTint(flattenSkillsNameStageLayers(root), info, getFilters)

const SKILLS_NAME_SIDE_LAYER_NAME = new Set(['技能框左', '技能框右'])

export const isSkillsNameFrameSideLayerName = (name: string | undefined) =>
  Boolean(name && SKILLS_NAME_SIDE_LAYER_NAME.has(name))

/**
 * 将 left/right frame 色域着色写回 canvasConfigs.skillsName.children（与 hp/frame 一致，Konva cache 与模板同源）
 */
/**
 * 经 vue-konva ref 直接对 left/right Image 刷 RGB 滤镜离屏 cache（避免 Group 子节点 code 匹配失败）
 */
export const refreshSkillsNameSideImageFilterCache = (
  root: CanvasItemConfig | undefined,
  info: LegendInfo,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
  sideRefs: ReadonlyMap<string, VueKonvaNodeRef> = skillsNameSideImageRefRegistry,
): { pending: boolean; applied: number } => {
  if (!isCustomKingdomActive(info)) return { pending: false, applied: 0 }
  const layers = resolveSkillsNameStageLayersWithTint(root, info, getFilters)
  let pending = false
  let applied = 0
  for (const layer of layers) {
    if (!isSkillsNameFrameSideCode(layer.code) || !konvaConfigNeedsFilterCache(layer)) continue
    const code = layer.code!
    const node = sideRefs.get(code)?.getNode?.()
    if (!node) {
      pending = true
      continue
    }
    syncKonvaTintAttrsFromConfig(node, layer)
    cacheKonvaNode(node, code, undefined, layer)
    applied++
  }
  return { pending, applied }
}

/** 按 ref 直刷技能框 left/right 离屏 cache（调用方须已 sync 着色到 root） */
export const scheduleSkillsNameSideImageFilterCacheRefresh = (
  root: CanvasItemConfig | undefined,
  info: LegendInfo,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
  deferAttempt = 0,
) => {
  const { pending, applied } = refreshSkillsNameSideImageFilterCache(root, info, getFilters)
  if (pending && deferAttempt < MAX_SKILLS_NAME_SIDE_CACHE_DEFER) {
    requestAnimationFrame(() =>
      scheduleSkillsNameSideImageFilterCacheRefresh(root, info, getFilters, deferAttempt + 1),
    )
    return
  }
  if (applied > 0) {
    for (const inst of skillsNameSideImageRefRegistry.values()) {
      inst?.getNode?.()?.getLayer()?.batchDraw()
      break
    }
  }
}

export const syncSkillsNameFrameTintToCanvasConfig = (
  root: CanvasItemConfig | undefined,
  info: LegendInfo,
  getFilters: (rgb?: { red: number; green: number; blue: number }) => Record<string, unknown>,
): CanvasItemConfig | undefined => {
  if (!root?.children?.length) return root
  const flattened = flattenSkillsNameStageLayers(root)
  if (!isCustomKingdomActive(info)) {
    const children = flattened.map((layer) =>
      isSkillsNameFrameSideCode(layer.code) ? stripSkillFrameSideTintAttrs(layer) : layer,
    )
    return { ...root, children }
  }
  return {
    ...root,
    children: applySkillsNameFrameKingdomTint(flattened, info, getFilters),
  }
}
