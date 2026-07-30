import { useTemplateStore } from '../template/template'
import {
  applyInfoContentSnapshot,
  buildInfoSnapshot,
  createStableInfoView,
} from '../internal/infoView'
import {
  createDefaultLegendBaseInfo,
  createDefaultRenderConfig,
  type LegendInfo,
} from '@/features/diy-card/types/diy/legend'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 武将牌域业务数据：基础信息、技能列表、渲染配置与导入导出。
 * 仅服务于 template.type 为 legend / full-legend 的模板。
 */
export const useLegendStore = defineStore('legend', () => {
  const templateStore = useTemplateStore()

  const templateName = ref(
    templateStore.resolveDefaultTemplateNameForType('legend'),
  )

  /** 武将基础字段（姓名、势力、体力、插画路径等） */
  const baseInfo = ref(createDefaultLegendBaseInfo())

  /** 各画布元素的布局与样式配置 */
  const renderConfig = ref(createDefaultRenderConfig())

  const customMaterialList = ref<LegendInfo['customMaterialList']>([])

  const contentSources = { baseInfo, renderConfig, customMaterialList }

  /** 稳定引用，供画布与配置读取（勿 JSON 序列化，请用 toInfoSnapshot） */
  const info = createStableInfoView<LegendInfo>(contentSources, () => ({
    name: templateName.value,
  }))

  const setTemplateName = (name: string) => {
    templateName.value = name
  }

  const toInfoSnapshot = () => buildInfoSnapshot(contentSources, templateName.value)

  const applyInfo = (next: LegendInfo) => {
    applyInfoContentSnapshot(contentSources, next)
    templateName.value = next.template.name
  }

  /** 从 JSON 字符串恢复武将数据，并校验模板是否存在 */
  const importLegendInfo = (newLegendInfoStr: string) => {
    let parsed: LegendInfo
    try {
      parsed = JSON.parse(newLegendInfoStr)
    } catch {
      throw new Error('导入的武将信息格式错误')
    }
    const matched = templateStore.getTemplate(parsed.template.name)
    if (!matched) {
      throw new Error('导入的武将信息模板不存在')
    }
    applyInfo(parsed)
  }

  return {
    templateName,
    setTemplateName,
    baseInfo,
    renderConfig,
    customMaterialList,
    info,
    toInfoSnapshot,
    importLegendInfo,
    applyInfo,
  }
})
