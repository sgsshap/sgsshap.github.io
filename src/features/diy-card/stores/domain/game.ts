import { useTemplateStore } from '../template/template'
import {
  applyInfoContentSnapshot,
  buildInfoSnapshot,
  createStableInfoView,
} from '../internal/infoView'
import type { BaseGameInfo, GameInfo } from '@/features/diy-card/types/diy/game'
import { createDefaultRenderConfig } from '@/features/diy-card/types/diy/game'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 游戏牌域业务数据。
 * 持有该类型模板下的 baseInfo、renderConfig 与自定义素材列表。
 */
export const useGameStore = defineStore('game', () => {
  const templateStore = useTemplateStore()

  const templateName = ref(
    templateStore.resolveDefaultTemplateNameForType('game'),
  )

  const baseInfo = ref<BaseGameInfo>({ name: '测试' })

  const renderConfig = ref(createDefaultRenderConfig())

  const customMaterialList = ref<GameInfo['customMaterialList']>([])

  const contentSources = { baseInfo, renderConfig, customMaterialList }

  /** 稳定引用，供画布与配置读取（勿 JSON 序列化，请用 toInfoSnapshot） */
  const info = createStableInfoView<GameInfo>(contentSources, () => ({
    name: templateName.value,
  }))

  const setTemplateName = (name: string) => {
    templateName.value = name
  }

  const toInfoSnapshot = () => buildInfoSnapshot(contentSources, templateName.value)

  const applyInfo = (next: GameInfo) => {
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
