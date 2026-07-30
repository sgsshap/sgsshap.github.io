import { templates } from '@/features/diy-card/data/templates'
import type { TemplateInfo, TemplateType } from '@/features/diy-card/types/template'
import { defineStore } from 'pinia'
import { computed, type Ref, ref } from 'vue'

/**
 * 模板目录与当前选中模板。
 * 负责模板类型筛选、下拉选项与按 name 查询，不持有卡牌业务字段。
 */
export const useTemplateStore = defineStore('template', () => {
  // ==================== 模板列表 ====================

  /** 内置全部模板元数据 */
  const allTemplates = ref<TemplateInfo[]>(templates)

  /** 模板 name → 配置对象 */
  const templateMap = computed(() => {
    return templates.reduce(
      (map, template) => {
        map[template.name] = template
        return map
      },
      {} as Record<string, TemplateInfo>,
    )
  })

  // ==================== 当前选中 ====================

  /** 当前模板内部 name（对应组件目录名） */
  const currentTemplateName = ref(templates[0]!.name)

  /** 当前模板业务类型：武将 / 游戏 / 标记等 */
  const templateType: Ref<TemplateType> = ref(templates[0]!.type)

  const currentTemplate = computed(() => {
    return templateMap.value[currentTemplateName.value]!
  })

  /** 当前模板支持的出血量（mm），不支持则为 0 */
  const templateBleed = computed(() => {
    return currentTemplate.value.supportBleed ? currentTemplate.value.bleed : 0
  })

  // ==================== 下拉选项 ====================

  const templateTypeOptions = ref([
    { label: '武将牌', value: 'legend' },
    { label: '全幅武将牌', value: 'full-legend' },
    { label: '游戏牌', value: 'game' },
    { label: '标记牌', value: 'mark' },
  ])

  /** 当前类型下的模板下拉项 */
  const templateOptions = computed(() => {
    return allTemplates.value
      .filter((template) => template.type === templateType.value)
      .map((template) => {
        return {
          label: template.label,
          value: template.name,
        }
      })
  })

  // ==================== 查询与切换 ====================

  /**
   * 切换模板业务类型（会由配置页联动模板 name）
   */
  const setTemplateType = (type: string) => {
    templateType.value = type as TemplateType
    const first = templates.find((template) => template.type === type)
    if (first) {
      currentTemplateName.value = first.name
    }
  }

  /**
   * 取某类型下的第一个模板，用于初始化域 store 默认值
   */
  const getFirstTemplate = (type?: string): TemplateInfo | undefined => {
    if (type) {
      return templates.find((template) => template.type === type)
    }
    return (allTemplates.value.length > 0 && templates[0]) || undefined
  }

  /**
   * 域 store 初始化用：优先取该类型的首个模板 name，无配置时回退到当前或列表首项
   */
  const resolveDefaultTemplateNameForType = (type: string): string => {
    const matched = getFirstTemplate(type)
    if (matched) return matched.name
    const current = templateMap.value[currentTemplateName.value]
    if (current) return current.name
    return templates[0]?.name ?? ''
  }

  /** 已下线模板的存档/导入名 → 当前可用模板 */
  const REMOVED_TEMPLATE_ALIASES: Record<string, string> = {
    old_ui_muyi: 'new_ui_zhuoyue',
  }

  const resolveTemplateName = (name: string): string =>
    REMOVED_TEMPLATE_ALIASES[name] ?? name

  /**
   * 按内部 name 查找模板（含已下线模板名迁移）
   */
  const getTemplate = (name: string): TemplateInfo | undefined => {
    const resolved = resolveTemplateName(name)
    return templates.find((template) => template.name === resolved)
  }

  return {
    allTemplates,
    templateType,
    setTemplateType,
    currentTemplateName,
    currentTemplate,
    templateBleed,
    templateOptions,
    getFirstTemplate,
    resolveDefaultTemplateNameForType,
    getTemplate,
    resolveTemplateName,
    templateTypeOptions,
  }
})
