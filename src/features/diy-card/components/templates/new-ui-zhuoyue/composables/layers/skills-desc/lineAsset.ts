import { loadKonvaImage } from '@/features/diy-card/composables'
import type { useDiyStore } from '@/features/diy-card/stores'
import { markRaw } from 'vue'
import { TEMPLATE_ASSET_BASE } from '../../constants/common'

let skillDescLineImageCache: Promise<HTMLImageElement> | null = null

export const resetSkillDescLineImageCache = () => {
  skillDescLineImageCache = null
}

/** 技能区与底栏分隔线素材（line.png） */
export const loadSkillDescLineImage = (
  diyStore: ReturnType<typeof useDiyStore>,
  label = '技能描述',
) => {
  skillDescLineImageCache ??= diyStore
    .runWithLoading('skillsDesc', label, () =>
      loadKonvaImage(`${TEMPLATE_ASSET_BASE}/assets/skill-desc/line.png`),
    )
    .catch((error) => {
      resetSkillDescLineImageCache()
      throw error
    })
  return skillDescLineImageCache
}

export const markSkillDescLineImageRaw = async (
  diyStore: ReturnType<typeof useDiyStore>,
  label = '技能描述',
) => markRaw(await loadSkillDescLineImage(diyStore, label))
