/**
 * 卓越模板图层配置（新增模板见 docs/diy-card/templates.md）
 *
 * layers：顺序由 order 决定，draw 指向 layers/ 下的绘制函数
 */
import {
  defineTemplateSetup,
  type LayerCode,
  type TemplateWatchContext,
} from '@/features/diy-card/composables/template'
import { drawBottomInfo } from './layers/bottom-info'
import { drawCustomMaterials } from './layers/custom-material'
import { drawFrame } from './layers/frame'
import { drawHp } from './layers/hp'
import { drawKingdom } from './layers/kingdom'
import { drawLegendImage } from './layers/legend-image'
import { drawLegendOutOfFrame } from './layers/legend-out-of-frame'
import { drawName } from './layers/name'
import { drawPackage } from './layers/package'
import { drawSkillsDesc } from './layers/skills-desc'
import { drawSkillsName } from './layers/skills-name'
import { drawTitle } from './layers/title'
import { drawWatermark } from './layers/watermark'

export const templateSetup = defineTemplateSetup({
  layers: [
    {
      code: 'legendImage',
      name: '武将图',
      refKey: 'legendImageRef',
      order: 10,
      draw: drawLegendImage,
    },
    {
      code: 'skillsDesc',
      name: '技能描述',
      refKey: 'skillsDescRef',
      order: 15,
      group: true,
      draw: drawSkillsDesc,
      resetOnLoadAll: true,
      highDprCache: true,
    },
    {
      code: 'customMaterials',
      name: '自定义素材',
      refKey: 'customMaterialsRef',
      order: 16,
      group: true,
      draw: drawCustomMaterials,
    },
    {
      code: 'legendOutOfFrame',
      name: '人物出框',
      refKey: 'legendOutOfFrameRef',
      order: 17,
      draw: drawLegendOutOfFrame,
      highDprCache: true,
    },
    {
      code: 'frame',
      name: '边框',
      refKey: 'frameRef',
      order: 20,
      group: true,
      draw: drawFrame,
      resetOnLoadAll: true,
    },
    {
      code: 'package',
      name: '角标',
      refKey: 'packageRef',
      order: 22,
      group: true,
      draw: drawPackage,
    },
    {
      code: 'bottomInfo',
      name: '底部信息',
      refKey: 'bottomInfoRef',
      order: 25,
      group: true,
      draw: drawBottomInfo,
      resetOnLoadAll: true,
      highDprCache: true,
    },
    {
      code: 'hp',
      name: '体力',
      refKey: 'hpRef',
      order: 30,
      group: true,
      draw: drawHp,
      resetOnLoadAll: true,
      highDprCache: true,
    },
    {
      code: 'skillsName',
      name: '技能名',
      refKey: 'skillsNameRef',
      order: 35,
      group: true,
      draw: drawSkillsName,
      resetOnLoadAll: true,
      highDprCache: true,
    },
    {
      code: 'kingdom',
      name: '势力',
      refKey: 'kingdomRef',
      order: 40,
      draw: drawKingdom,
    },
    {
      code: 'name',
      name: '武将名',
      refKey: 'nameRef',
      order: 50,
      group: true,
      draw: drawName,
      resetOnLoadAll: true,
      highDprCache: true,
    },
    {
      code: 'title',
      name: '称号',
      refKey: 'titleRef',
      order: 60,
      group: true,
      draw: drawTitle,
      resetOnLoadAll: true,
      highDprCache: true,
    },
    {
      code: 'watermark',
      name: '水印',
      refKey: 'watermarkRef',
      order: 70,
      group: true,
      draw: drawWatermark,
      resetOnLoadAll: true,
    },
  ],
})

/** 本模板图层 code 联合类型 */
export type ZhuoyueLayerCode = LayerCode<typeof templateSetup>

/** 本模板 watch 上下文（loaders 带图层 code 自动补全） */
export type ZhuoyueWatchContext = TemplateWatchContext<typeof templateSetup>
