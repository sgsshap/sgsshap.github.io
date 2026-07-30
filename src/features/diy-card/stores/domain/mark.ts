import { useTemplateStore } from '../template/template'
import {
  applyInfoContentSnapshot,
  buildInfoSnapshot,
  createStableInfoView,
} from '../internal/infoView'
import type { BaseMarkInfo, MarkInfo } from '@/features/diy-card/types/diy/mark'
import { createDefaultRenderConfig } from '@/features/diy-card/types/diy/mark'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 标记牌域业务数据。
 * 持有该类型模板下的 baseInfo、renderConfig 与自定义素材列表。
 */
export const useMarkStore = defineStore('mark', () => {
  const templateStore = useTemplateStore()

  const templateName = ref(
    templateStore.resolveDefaultTemplateNameForType('mark'),
  )

  const baseInfo = ref<BaseMarkInfo>({ name: '测试' })

  const renderConfig = ref(createDefaultRenderConfig())

  const customMaterialList = ref<MarkInfo['customMaterialList']>([])

  const contentSources = { baseInfo, renderConfig, customMaterialList }

  /** 稳定引用，供画布与配置读取（勿 JSON 序列化，请用 toInfoSnapshot） */
  const info = createStableInfoView<MarkInfo>(contentSources, () => ({
    name: templateName.value,
  }))

  const setTemplateName = (name: string) => {
    templateName.value = name
  }

  const toInfoSnapshot = () => buildInfoSnapshot(contentSources, templateName.value)

  const applyInfo = (next: MarkInfo) => {
    applyInfoContentSnapshot(contentSources, next)
    templateName.value = next.template.name
  }

  return {
    templateName,
    setTemplateName,
    baseInfo,
    renderConfig,
    customMaterialList,
    info,
    toInfoSnapshot,
    applyInfo,
  }
})
