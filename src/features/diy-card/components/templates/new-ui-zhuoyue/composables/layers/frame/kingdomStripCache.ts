import {
  cacheKonvaNode,
  konvaConfigNeedsFilterCache,
  konvaFilterPreviewCacheUpToDate,
  syncKonvaTintAttrsFromConfig,
} from '@/features/diy-card/composables/konva/konvaCache'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import { isFrameKingdomStripChild } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/fullFrame'
import type Konva from 'konva'

type VueKonvaNodeRef = { getNode?: () => Konva.Node } | null

const frameKingdomStripImageRefRegistry = new Map<string, VueKonvaNodeRef>()

const MAX_FRAME_KINGDOM_STRIP_CACHE_DEFER = 48

export const isFrameKingdomStripCode = (code: string | undefined) =>
  Boolean(code && isFrameKingdomStripChild(code))

/** 绑定 frame_kingdom_* vue-konva Image ref（top / partial 共用，与 skillsName left/right 一致） */
export const bindFrameKingdomStripImageRef = (code: string | undefined, el: unknown) => {
  if (!code || !isFrameKingdomStripCode(code)) return
  if (!el) {
    frameKingdomStripImageRefRegistry.delete(code)
    return
  }
  frameKingdomStripImageRefRegistry.set(code, el as VueKonvaNodeRef)
}

const listFrameKingdomStripConfigs = (frameConfig: CanvasItemConfig | undefined) =>
  frameConfig?.children?.filter(
    (child) => isFrameKingdomStripCode(child.code) && konvaConfigNeedsFilterCache(child),
  ) ?? []

/** 经 ref 直刷 kingdom_frame RGB 滤镜离屏 cache（与 top 模式 frameRef 子树刷新等价） */
export const refreshFrameKingdomStripFilterCache = (
  frameConfig: CanvasItemConfig | undefined,
  options?: { force?: boolean },
  sideRefs: ReadonlyMap<string, VueKonvaNodeRef> = frameKingdomStripImageRefRegistry,
): { pending: boolean; applied: number } => {
  const stripConfigs = listFrameKingdomStripConfigs(frameConfig)
  let pending = false
  let applied = 0

  for (const stripConfig of stripConfigs) {
    const code = stripConfig.code!
    const node = sideRefs.get(code)?.getNode?.()
    if (!node) {
      pending = true
      continue
    }
    if (!options?.force && konvaFilterPreviewCacheUpToDate(node, stripConfig)) continue
    syncKonvaTintAttrsFromConfig(node, stripConfig)
    cacheKonvaNode(node, code, undefined, stripConfig)
    applied++
  }

  return { pending, applied }
}

export const scheduleFrameKingdomStripFilterCacheRefresh = (
  frameConfig: CanvasItemConfig | undefined,
  options?: { force?: boolean },
  deferAttempt = 0,
) => {
  const { pending, applied } = refreshFrameKingdomStripFilterCache(frameConfig, options)
  if (pending && deferAttempt < MAX_FRAME_KINGDOM_STRIP_CACHE_DEFER) {
    requestAnimationFrame(() =>
      scheduleFrameKingdomStripFilterCacheRefresh(frameConfig, options, deferAttempt + 1),
    )
    return
  }
  if (applied > 0) {
    for (const inst of frameKingdomStripImageRefRegistry.values()) {
      inst?.getNode?.()?.getLayer()?.batchDraw()
      break
    }
  }
}
