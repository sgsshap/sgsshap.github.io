import {
  cacheKonvaNode,
  invalidateKonvaTextNodesInSubtree,
  konvaConfigNeedsFilterCache,
  konvaFilterPreviewCacheUpToDate,
  syncKonvaTintAttrsFromConfig,
} from '@/features/diy-card/composables/konva/konvaCache'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type Konva from 'konva'

type VueKonvaNodeRef = { getNode?: () => Konva.Node } | null

export const PACKAGE_TEXT_BG_CODE = 'package-text-bg'

const packageTextBgImageRefRegistry = new Map<string, VueKonvaNodeRef>()

const MAX_PACKAGE_TEXT_BG_CACHE_DEFER = 48

export const isPackageTextBgCode = (code: string | undefined) => code === PACKAGE_TEXT_BG_CODE

/** 绑定文字角标底图 vue-konva Image ref（Group 子节点 code 匹配不稳定时直刷 cache） */
export const bindPackageTextBgImageRef = (code: string | undefined, el: unknown) => {
  if (!isPackageTextBgCode(code)) return
  if (!el) {
    packageTextBgImageRefRegistry.delete(PACKAGE_TEXT_BG_CODE)
    return
  }
  packageTextBgImageRefRegistry.set(PACKAGE_TEXT_BG_CODE, el as VueKonvaNodeRef)
}

const resolvePackageTextBgConfig = (packageConfig: CanvasItemConfig | undefined) =>
  packageConfig?.children?.find((child) => child.code === PACKAGE_TEXT_BG_CODE)

/** 经 ref 直刷角标底图 RGB 滤镜离屏 cache */
export const refreshPackageTextBgFilterCache = (
  packageConfig: CanvasItemConfig | undefined,
  options?: { force?: boolean },
  refs: ReadonlyMap<string, VueKonvaNodeRef> = packageTextBgImageRefRegistry,
): { pending: boolean; applied: number } => {
  const bgConfig = resolvePackageTextBgConfig(packageConfig)
  if (!bgConfig || !konvaConfigNeedsFilterCache(bgConfig)) {
    return { pending: false, applied: 0 }
  }

  const node = refs.get(PACKAGE_TEXT_BG_CODE)?.getNode?.()
  if (!node) {
    return { pending: true, applied: 0 }
  }
  if (!options?.force && konvaFilterPreviewCacheUpToDate(node, bgConfig)) {
    return { pending: false, applied: 0 }
  }

  syncKonvaTintAttrsFromConfig(node, bgConfig)
  cacheKonvaNode(node, PACKAGE_TEXT_BG_CODE, undefined, bgConfig)
  const group = node.getParent()
  if (group) {
    invalidateKonvaTextNodesInSubtree(group)
  }
  return { pending: false, applied: 1 }
}

export const schedulePackageTextBgFilterCacheRefresh = (
  packageConfig: CanvasItemConfig | undefined,
  options?: { force?: boolean },
  deferAttempt = 0,
) => {
  const { pending, applied } = refreshPackageTextBgFilterCache(packageConfig, options)
  if (pending && deferAttempt < MAX_PACKAGE_TEXT_BG_CACHE_DEFER) {
    requestAnimationFrame(() =>
      schedulePackageTextBgFilterCacheRefresh(packageConfig, options, deferAttempt + 1),
    )
    return
  }
  if (applied > 0) {
    packageTextBgImageRefRegistry.get(PACKAGE_TEXT_BG_CODE)?.getNode?.()?.getLayer()?.batchDraw()
  }
}
