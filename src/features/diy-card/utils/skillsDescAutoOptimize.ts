import { resolveSkillsDescAutoOptimizeFlag } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { applyFieldChange } from '@/features/diy-card/utils/diyHistoryField'

/** 切换技能描述「优化描述」（首页与详细设置共用） */
export const applySkillsDescAutoOptimizeChange = (info: LegendInfo, value: boolean) => {
  applyFieldChange(
    '优化描述',
    resolveSkillsDescAutoOptimizeFlag(info.renderConfig.items.skillsDesc.autoOptimizeFlag),
    value,
    (val) => {
      info.renderConfig.items.skillsDesc.autoOptimizeFlag = val
    },
    { category: 'renderConfig', format: 'bool' },
  )
}
