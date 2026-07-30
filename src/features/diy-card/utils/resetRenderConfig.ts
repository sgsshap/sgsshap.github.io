import { resetPackageCardLayoutTracking } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/package/index'
import { useInfoStore } from '@/features/diy-card/stores'
import { useTemplateStore } from '@/features/diy-card/stores'
import type { DiyInfoKind } from '@/features/diy-card/types/diy/history'
import { createDefaultRenderConfig as createGameRenderConfig } from '@/features/diy-card/types/diy/game'
import {
  createDefaultLegendBaseInfo,
  createDefaultRenderConfig as createLegendRenderConfig,
  type LegendInfo,
} from '@/features/diy-card/types/diy/legend'
import { createDefaultRenderConfig as createMarkRenderConfig } from '@/features/diy-card/types/diy/mark'

const cloneRenderConfig = <T>(config: T): T => JSON.parse(JSON.stringify(config)) as T

const FRAME_KINGDOM_SRC_KEYS = {
  wei: 1,
  shu: 1,
  wu: 1,
  qun: 1,
  jin: 1,
  shen: 1,
} as const

const syncLegendFrameSrcToKingdom = () => {
  const legend = useInfoStore().accessKind<LegendInfo>('legend')
  const kingdom = legend.baseInfo.kingdom
  if (kingdom && kingdom in FRAME_KINGDOM_SRC_KEYS) {
    legend.renderConfig.items.frame.src = kingdom
  }
}

/** 整表替换 renderConfig，避免局部 merge 残留 customColor 等字段 */
const applyDefaultLegendRenderConfig = () => {
  const legend = useInfoStore().accessKind<LegendInfo>('legend')
  legend.renderConfig = cloneRenderConfig(createLegendRenderConfig())
  syncLegendFrameSrcToKingdom()
}

const applyDefaultBaseInfoForKind = (kind: DiyInfoKind) => {
  switch (kind) {
    case 'game':
      useInfoStore().accessKind('game').baseInfo = { name: '测试' }
      break
    case 'mark':
      useInfoStore().accessKind('mark').baseInfo = { name: '测试' }
      break
    default:
      // 整表替换 baseInfo，避免局部写入残留 nation 等可选字段
      useInfoStore().accessKind<LegendInfo>('legend').baseInfo = cloneRenderConfig(
        createDefaultLegendBaseInfo(),
      )
      break
  }
}

const applyDefaultRenderConfigForKind = (kind: DiyInfoKind) => {
  switch (kind) {
    case 'game':
      useInfoStore().accessKind('game').renderConfig = cloneRenderConfig(createGameRenderConfig())
      break
    case 'mark':
      useInfoStore().accessKind('mark').renderConfig = cloneRenderConfig(createMarkRenderConfig())
      break
    default:
      applyDefaultLegendRenderConfig()
      break
  }
}

const resetCustomMaterialListForKind = (kind: DiyInfoKind) => {
  useInfoStore().accessKind(kind).customMaterialList = []
}

const applyDefaultInfoForKind = (kind: DiyInfoKind) => {
  applyDefaultBaseInfoForKind(kind)
  applyDefaultRenderConfigForKind(kind)
  resetCustomMaterialListForKind(kind)
}

const syncCurrentTemplateName = (kind: DiyInfoKind) => {
  const templateName = useTemplateStore().currentTemplateName
  if (!templateName) return
  useInfoStore().accessKind(kind).setTemplateName(templateName)
}

/**
 * 按工厂默认值重新创建当前牌类型的 info（不读取历史锚点或持久化快照）
 */
export const recreateFreshInfoForKind = (kind: DiyInfoKind) => {
  applyDefaultInfoForKind(kind)
  if (kind === 'legend') {
    resetPackageCardLayoutTracking()
  }
  syncCurrentTemplateName(kind)
}
