import { resolveSkillsDescAutoSizeFlag } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { applyFieldChange } from '@/features/diy-card/utils/diyHistoryField'

/** 切换技能描述「优化字号」（首页与详细设置共用） */
export const applySkillsDescAutoSizeChange = (info: LegendInfo, value: boolean) => {
  const descItem = info.renderConfig.items.skillsDesc
  applyFieldChange(
    '优化字号',
    resolveSkillsDescAutoSizeFlag(descItem.autoOptimizeSizeFlag, descItem.autoOptimizeFlag),
    value,
    (val) => {
      descItem.autoOptimizeSizeFlag = val
      if (val) {
        descItem.manualSizeFlag = false
      }
    },
    { category: 'renderConfig', format: 'bool' },
  )
}
