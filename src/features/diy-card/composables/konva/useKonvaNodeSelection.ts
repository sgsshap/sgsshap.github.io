import {
  isDoubleKingdomRenderActive,
  resolveKingdomLayoutItem,
} from '@/features/diy-card/composables/doubleKingdom'
import {
  SKILL_DESC_HIT_CODE,
  SKILL_NAME_HIT_CODE,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { findCustomMaterial } from '@/features/diy-card/utils/customMaterial'
import { resolveNameLayoutItem } from '@/features/diy-card/utils/nameSplit'
import Konva from 'konva'

const FRAME_KINGDOM_STRIP_CODE = /^frame_kingdom_(?:left|right)$/
const SKILLS_NAME_CHILD_CODE = /^skillsName_/

/**
 * Konva 图层点击选中
 *
 * 从点击目标向上遍历节点树，匹配 `attrs.code` 且 `editable.selectable` 的图层，
 * 通过 `getSelectHandlers()` 挂到 Group/Image 的 onClick / onTap。
 *
 * @param info 当前模板数据（含 renderConfig.items）
 * @param onSelect 选中回调，通常映射为 emit('click', code)
 */
export function useKonvaNodeSelection(info: LegendInfo, onSelect: (code: string) => void) {
  const resolveSelectableLayoutItem = (key: string) => {
    if (FRAME_KINGDOM_STRIP_CODE.test(key) && !isDoubleKingdomRenderActive(info)) {
      return info.renderConfig.items.kingdom
    }
    if (
      key === 'skillsName' ||
      key === SKILL_NAME_HIT_CODE ||
      SKILLS_NAME_CHILD_CODE.test(key)
    ) {
      return info.renderConfig.items.skillsName
    }
    if (key === 'skillsDesc' || key === SKILL_DESC_HIT_CODE || key.startsWith('skillsDesc_')) {
      return info.renderConfig.items.skillsDesc
    }
    return (
      findCustomMaterial(info, key) ??
      resolveNameLayoutItem(info, key) ??
      resolveKingdomLayoutItem(info, key) ??
      info.renderConfig.items[key as keyof typeof info.renderConfig.items]
    )
  }

  /** 沿节点树向上查找第一个可选择的图层 code */
  const handleNodeClick = (e: Konva.KonvaEventObject<Event>) => {
    let node: Konva.Node | null = e.target

    while (node) {
      const key = node.attrs?.code as string | undefined
      if (key) {
        const renderObj = resolveSelectableLayoutItem(key)
        if (renderObj?.editable?.selectable) {
          const active = document.activeElement
          if (active instanceof HTMLElement) {
            active.blur()
          }
          onSelect(renderObj.code)
          return
        }
      }
      node = node.getParent()
    }
  }

  /** 绑定到 Konva 节点的 onClick / onTap */
  const getSelectHandlers = () => ({
    onClick: handleNodeClick,
    onTap: handleNodeClick,
  })

  return { handleNodeClick, getSelectHandlers }
}
