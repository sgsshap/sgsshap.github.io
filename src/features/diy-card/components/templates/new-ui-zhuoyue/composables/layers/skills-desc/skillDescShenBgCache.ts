import {
  cacheKonvaNode,
  clearKonvaFilterPreviewFromNode,
  konvaConfigNeedsFilterCache,
  konvaFilterPreviewCacheUpToDate,
  konvaNodeNeedsFilterCache,
  syncKonvaTintAttrsFromConfig,
} from '@/features/diy-card/composables/konva/konvaCache'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import type Konva from 'konva'

type VueKonvaNodeRef = { getNode?: () => Konva.Node } | null

const SHEN_BG_IMAGE_CODE = /^skillsDesc_shen_bg_(image|corner_bl|corner_br)$/

const skillDescShenBgImageRefRegistry = new Map<string, VueKonvaNodeRef>()

const MAX_SKILL_DESC_SHEN_BG_CACHE_DEFER = 48

export const isSkillDescShenBgImageCode = (code: string | undefined) =>
  Boolean(code && SHEN_BG_IMAGE_CODE.test(code))

export const bindSkillDescShenBgImageRef = (code: string | undefined, el: unknown) => {
  if (!code || !isSkillDescShenBgImageCode(code)) return
  if (!el) {
    skillDescShenBgImageRefRegistry.delete(code)
    return
  }
  skillDescShenBgImageRefRegistry.set(code, el as VueKonvaNodeRef)
}

const collectShenBgImageConfigs = (
  config: CanvasItemConfig | undefined,
  out: CanvasItemConfig[],
) => {
  if (!config) return
  if (config.code && isSkillDescShenBgImageCode(config.code)) {
    out.push(config)
  }
  for (const child of config.children ?? []) {
    collectShenBgImageConfigs(child, out)
  }
}

export const refreshSkillDescShenBgImageFilterCache = (
  skillsDescConfig: CanvasItemConfig | undefined,
  options?: { force?: boolean },
  imageRefs: ReadonlyMap<string, VueKonvaNodeRef> = skillDescShenBgImageRefRegistry,
): { pending: boolean; applied: number } => {
  const imageConfigs: CanvasItemConfig[] = []
  collectShenBgImageConfigs(skillsDescConfig, imageConfigs)
  let pending = false
  let applied = 0

  for (const imageConfig of imageConfigs) {
    const code = imageConfig.code!
    const node = imageRefs.get(code)?.getNode?.()
    if (!node) {
      pending = true
      continue
    }
    if (!konvaConfigNeedsFilterCache(imageConfig)) {
      if (konvaNodeNeedsFilterCache(node)) {
        clearKonvaFilterPreviewFromNode(node)
        applied++
      }
      continue
    }
    if (!options?.force && konvaFilterPreviewCacheUpToDate(node, imageConfig)) continue
    syncKonvaTintAttrsFromConfig(node, imageConfig)
    cacheKonvaNode(node, code, ['skillsDesc'], imageConfig)
    applied++
  }

  return { pending, applied }
}

export const scheduleSkillDescShenBgImageFilterCacheRefresh = (
  skillsDescConfig: CanvasItemConfig | undefined,
  options?: { force?: boolean },
  deferAttempt = 0,
) => {
  const { pending, applied } = refreshSkillDescShenBgImageFilterCache(skillsDescConfig, options)
  if (pending && deferAttempt < MAX_SKILL_DESC_SHEN_BG_CACHE_DEFER) {
    requestAnimationFrame(() =>
      scheduleSkillDescShenBgImageFilterCacheRefresh(skillsDescConfig, options, deferAttempt + 1),
    )
    return
  }
  if (applied > 0) {
    for (const inst of skillDescShenBgImageRefRegistry.values()) {
      inst?.getNode?.()?.getLayer()?.batchDraw()
      break
    }
  }
}
