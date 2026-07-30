import { useTemplateStore } from './template/template'
import { useGameStore } from './domain/game'
import { useLegendStore } from './domain/legend'
import { useMarkStore } from './domain/mark'
import type { DiyDomainStoreApi } from './internal/domainStoreApi'
import type { DiyCardInfoBase } from '@/features/diy-card/types/diy/base'
import type { GameInfo } from '@/features/diy-card/types/diy/game'
import {
  resolveInfoKind,
  type DiyInfoKind,
  type DiyInfoSnapshot,
} from '@/features/diy-card/types/diy/history'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import type { MarkInfo } from '@/features/diy-card/types/diy/mark'
import { defineStore } from 'pinia'
import { computed } from 'vue'

type ActiveInfo = LegendInfo | GameInfo | MarkInfo
type ActiveBaseInfo = ActiveInfo['baseInfo']
type ActiveRenderConfig = ActiveInfo['renderConfig']
type ActiveTemplate = ActiveInfo['template']
type ActiveCustomMaterialList = ActiveInfo['customMaterialList']

/**
 * 当前牌种编辑数据的统一入口。
 * 对外不暴露 legend / game / mark 域 store，按 templateType 路由到对应底层 store。
 */
export const useInfoStore = defineStore('diyInfo', () => {
  const templateStore = useTemplateStore()

  const resolveDomainStore = (kind: DiyInfoKind): DiyDomainStoreApi => {
    switch (kind) {
      case 'game':
        return useGameStore()
      case 'mark':
        return useMarkStore()
      default:
        return useLegendStore()
    }
  }

  const activeKind = computed(() => resolveInfoKind(templateStore.templateType))

  const activeDomain = () => resolveDomainStore(activeKind.value)

  /** 稳定引用的完整 info 视图（勿 JSON 序列化，请用 toInfoSnapshot） */
  const info = computed<ActiveInfo>(() => activeDomain().info as ActiveInfo)

  const template = computed({
    get: (): ActiveTemplate => ({ name: activeDomain().templateName }),
    set: (value: ActiveTemplate) => {
      activeDomain().setTemplateName(value.name)
    },
  })

  const baseInfo = computed({
    get: (): ActiveBaseInfo => activeDomain().baseInfo as ActiveBaseInfo,
    set: (value: ActiveBaseInfo) => {
      activeDomain().baseInfo = value
    },
  })

  const renderConfig = computed({
    get: (): ActiveRenderConfig => activeDomain().renderConfig as ActiveRenderConfig,
    set: (value: ActiveRenderConfig) => {
      activeDomain().renderConfig = value
    },
  })

  const customMaterialList = computed({
    get: (): ActiveCustomMaterialList => activeDomain().customMaterialList,
    set: (value: ActiveCustomMaterialList) => {
      activeDomain().customMaterialList = value
    },
  })

  const toInfoSnapshot = (kind: DiyInfoKind = activeKind.value) =>
    resolveDomainStore(kind).toInfoSnapshot()

  const applyInfo = (snapshot: DiyInfoSnapshot, kind: DiyInfoKind = activeKind.value) => {
    resolveDomainStore(kind).applyInfo(snapshot as DiyCardInfoBase)
  }

  /** 从 JSON 字符串导入武将数据（校验模板是否存在） */
  const importLegendInfo = (json: string) => {
    useLegendStore().importLegendInfo(json)
  }

  /** 按牌种访问底层数据（历史栈、重置等非当前模板场景） */
  const accessKind = <T extends DiyCardInfoBase = DiyCardInfoBase>(
    kind: DiyInfoKind,
  ): DiyDomainStoreApi<T> => resolveDomainStore(kind) as DiyDomainStoreApi<T>

  return {
    activeKind,
    info,
    template,
    baseInfo,
    renderConfig,
    customMaterialList,
    toInfoSnapshot,
    applyInfo,
    importLegendInfo,
    accessKind,
  }
})
