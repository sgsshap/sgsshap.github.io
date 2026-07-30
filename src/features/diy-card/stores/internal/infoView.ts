import type { DiyCardInfoBase } from '@/features/diy-card/types/diy/base'
import { clampCustomMaterialList } from '@/features/diy-card/utils/customMaterial'
import type { Ref } from 'vue'

/** info 在 store 内持久化的三段内容（template 由 templateName 实时组装） */
export type DiyInfoContentRefs<T extends DiyCardInfoBase> = {
  baseInfo: Ref<T['baseInfo']>
  renderConfig: Ref<T['renderConfig']>
  customMaterialList: Ref<T['customMaterialList']>
}

/**
 * 稳定引用的 info 视图：属性访问走 Pinia ref，不每次 new 对象，减轻配置面板大面积重渲染。
 * template 通过 resolveTemplate 实时读取，避免与 templateStore 双份存储不同步。
 */
export function createStableInfoView<T extends DiyCardInfoBase>(
  sources: DiyInfoContentRefs<T>,
  resolveTemplate: () => T['template'],
): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      switch (prop) {
        case 'template':
          return resolveTemplate()
        case 'baseInfo':
          return sources.baseInfo.value
        case 'renderConfig':
          return sources.renderConfig.value
        case 'customMaterialList':
          return sources.customMaterialList.value
        default:
          return undefined
      }
    },
  })
}

/** 序列化 / 历史快照用的纯对象（勿对 Proxy 视图直接 JSON.stringify） */
export function buildInfoSnapshot<T extends DiyCardInfoBase>(
  sources: DiyInfoContentRefs<T>,
  templateName: string,
): T {
  return {
    template: { name: templateName },
    baseInfo: sources.baseInfo.value,
    renderConfig: sources.renderConfig.value,
    customMaterialList: sources.customMaterialList.value,
  } as T
}

/** 整包写入 info 内容段（撤销/重做、导入等；templateName 由调用方单独写入） */
export function applyInfoContentSnapshot<T extends DiyCardInfoBase>(
  sources: DiyInfoContentRefs<T>,
  next: T,
) {
  sources.baseInfo.value = next.baseInfo
  sources.renderConfig.value = next.renderConfig
  sources.customMaterialList.value = clampCustomMaterialList(next.customMaterialList)
}
