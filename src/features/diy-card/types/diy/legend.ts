import type { CustomMaterialLayerPosition } from '@/features/diy-card/utils/customMaterial'
import { resolvePublicAssetSrc } from '@/features/diy-card/constants/publicAssets'
import {
  createDefaultOutOfFrameConfig,
  type LegendOutOfFrameConfig,
} from '@/features/diy-card/types/diy/outOfFrame'
import {
  DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY,
  DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY,
  DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR,
} from '@/features/diy-card/constants/customKingdomDefaults'
import {
  resolvePackageTextBadgeDefaultColor,
  resolvePackageTextBadgeDefaultColorEnd,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/package'
import {
  BOTTOM_INFO_DEFAULT_MARGIN_LEFT_MM,
  BOTTOM_INFO_DEFAULT_MARGIN_RIGHT_MM,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/bottomInfo'
import { CUSTOM_KINGDOM_LAYOUT } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import { NAME_LAYOUTS } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/name'
import {
  QUOTE_DEFAULT_MARGIN_BOTTOM_MM,
  QUOTE_DEFAULT_MARGIN_LEFT_MM,
  QUOTE_DEFAULT_MARGIN_RIGHT_MM,
  QUOTE_DEFAULT_MARGIN_TOP_MM,
  QUOTE_DEFAULT_TRACKING,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/quote'
import {
  SKILL_DESC_AUTO_OPTIMIZE_DEFAULT,
  SKILL_DESC_AUTO_SIZE_DEFAULT,
  SKILL_DESC_BG_OPAQUE_DEFAULT,
  SKILL_DESC_DEFAULT_FONT_SIZE_PT,
  SKILL_DESC_DEFAULT_MARGIN_BOTTOM_MM,
  SKILL_DESC_DEFAULT_MARGIN_LEFT_MM,
  SKILL_DESC_DEFAULT_MARGIN_RIGHT_MM,
  SKILL_DESC_DEFAULT_MARGIN_TOP_MM,
  SKILL_DESC_DEFAULT_PARA_SPACING_MM,
  SKILL_DESC_DEFAULT_SINGLE_LINE_PARA_SPACING_MM,
  SKILL_DESC_DEFAULT_ROW_SPACING_PT,
  SKILL_DESC_DEFAULT_TRACKING,
  SKILL_DESC_QUOTE_MIN_FONT_PT,
  SKILL_DESC_QUOTE_SIZE_DELTA_PT,
  SKILL_NAME_DEFAULT_MARGIN_TOP_MM,
  SKILL_NAME_FONT_SIZE_PT,
  SKILL_NAME_TRACKING,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import { TITLE_LAYOUTS } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/title'
import {
  createDefaultPackageIdentify,
  type PackageIdentify,
} from '@/features/diy-card/types/diy/packageIdentify'
import type { BaseRenderConfig, BaseSkill, DiyCardInfoBase, LayoutItem } from './base'

/**
 * 武将牌模板完整类型定义
 */
// ======================
// 基础武将信息（纯内容数据）
// ======================

/** 国战扩展信息（预留，未接入 UI 前可缺省） */
export interface LegendNationInfo {
  hp?: number
  subHp?: number
  equalHp?: boolean
  relation?: string
}

export interface BaseLegendInfo {
  name: string // 中文名
  title: string // 称号
  kingdom: string // 势力
  doubleKingdom?: string[] // 双势力
  hp: number // 当前体力
  maxHp: number // 最大体力
  shield: number // 护甲（可选）
  /** 国战扩展（预留） */
  nation?: LegendNationInfo
  quality: 'epic' | 'legend' | 'common' | string // 品质
  legendId: string // 编号
  life: string // 生平简介
  pic: string // 插画路径
  skills: LegendSkill[]
  /** 技能区引言（右下倾斜文案） */
  quote?: string
  copyright: string // 版权信息
  masterFlag: boolean // 主公技标识（可选）
  /** 角标 */
  packageIdentify: PackageIdentify
}

export interface LegendSkill extends BaseSkill {
  masterFlag?: boolean
  /** 势力技：空字符串 = 双势力技；预设为势力 key（wei/qun）；自定义双势力为 primary/secondary */
  kingdom?: string
  derivedFlag?: boolean
}

// ======================
// 渲染配置
// ======================
export interface LegendRenderConfig extends BaseRenderConfig {
  // === 全局图像设置 ===
  customImage: {
    defaultScale: number // 默认素材缩放
    layerPosition: CustomMaterialLayerPosition // 画布叠放档位
    /** 覆盖边框模式下与技能区重叠时自动隐藏（默认开启） */
    hidePartialSkillOverlap?: boolean
  }

  // === 显示设置（详细设置）===
  display: {
    /** 全幅模式：隐藏边框等装饰图层，突出立绘区域 */
    fullModeFlag: boolean
  }

  /** 人物出框（原画蒙版） */
  outOfFrame: LegendOutOfFrameConfig

  // === 各 UI 组件的布局与样式（每个都继承 LayoutItem）===
  items: {
    // 背景框
    frame: LayoutItem & {
      src: string
      fullUiType: '' | 'skill' | 'life'
      /** 边框默认位置所属卡面布局（神框 / 普通框） */
      frameCardLayoutKey?: 'shen' | 'normal'
    }

    // 武将名
    name: LayoutItem & {
      convertTChFlag: boolean
      /** 竖排字间距（pt） */
      characterSpacing: number
      splitFlag: boolean
      /** 拆分单字后的各字布局（key 为 name-0、name-1…） */
      splitChars?: Record<string, LayoutItem>
      /** 武将名默认位置所属卡面布局（神框 / 普通框） */
      textCardLayoutKey?: 'shen' | 'normal'
    }

    // 称号
    title: LayoutItem & {
      convertTChFlag: boolean
      /** 竖排字间距（pt） */
      characterSpacing: number
      /** 称号默认位置所属卡面布局（神框 / 普通框） */
      textCardLayoutKey?: 'shen' | 'normal'
      /** 是否自定义称号颜色 */
      customColorFlag: boolean
      /** 自定义称号色（单势力；双势力时作势力1回退） */
      customColor: string
      /** 双势力：势力1自定义称号色 */
      customColorPrimary: string
      /** 双势力：势力2自定义称号色 */
      customColorSecondary: string
    }

    // 体力值（HP）
    hp: LayoutItem & {
      equalFlag: boolean
      /** 是否自定义颜色 */
      customColorFlag: boolean
      /** 自定义体力色（单势力；双势力时作势力1 / full 档回退） */
      customColor: string
      /** 双势力：势力1（hp full 档）自定义色 */
      customColorPrimary: string
      /** 双势力：势力2（hp half 档）自定义色 */
      customColorSecondary: string
    }

    // 技能名称列表
    skillsName: LayoutItem & {
      convertTChFlag: boolean
      /** 上边距（mm，整体纵向偏移；正值下移，默认 0） */
      marginTop: number
      /** 字间距（PS Tracking，±1000 整数） */
      characterSpacing: number
    }

    // 技能描述区域
    skillsDesc: LayoutItem & {
      /** 优化描述：语言判断、标点纠正与句末补标点（仅画布展示） */
      autoOptimizeFlag: boolean
      /** 优化字号：字号自适应与区间限制 [5, 6.5] pt */
      autoOptimizeSizeFlag: boolean
      /** 用户手动调整过字号；自动优化开启时保留手动值，仅溢出时缩小，改描述或重开自动优化后清除 */
      manualSizeFlag?: boolean
      /** 单个阿拉伯数字自动应用 <full> 全角数字（默认开启） */
      autoFullNumberFlag: boolean
      newFontFlag: boolean
      derivedSkillFontFlag: boolean
      /** 技能描述正文加粗描边（默认关闭，与旧版无描边效果一致） */
      textBoldFlag: boolean
      /** 段间距（mm，多行非末技能） */
      paraSpacing: number
      /** 单行非末技能段间距（mm） */
      singleLineParaSpacing: number
      /** 行间距（pt，PS 绝对 Leading） */
      rowSpacing: number
      /** 字间距（PS Tracking，±1000 整数） */
      characterSpacing: number
      /** 上边距（mm） */
      marginTop: number
      /** 下边距（mm） */
      marginBottom: number
      /** 左边距（mm） */
      marginLeft: number
      /** 右边距（mm） */
      marginRight: number
  /** 技能描述背景不透明度（0–1）；普通势力底框与神势力背景 SVG 共用 */
  bgOpaque: number
  /** 技能区最小高度（mm）；未设置时使用模板默认值 */
  minHeightMm?: number
}

    // 引言
    quote: LayoutItem & {
      /** 锁定引言字号，不随技能描述字号联动 */
      lockSizeFlag?: boolean
      /** 用户手动调整过字号；描述字号变更时会重新联动并清除 */
      manualSizeFlag?: boolean
      /** 字间距（PS Tracking，±1000 整数） */
      characterSpacing: number
      /** 上边距（mm，相对描述正文底缘；可为负与描述重叠） */
      marginTop: number
      /** 下边距（mm，引言底缘与分隔线之间的间距，先于技能描述下边距） */
      marginBottom: number
      /** 左边距（mm，相对技能描述内盒左缘） */
      marginLeft: number
      /** 右边距（mm，相对技能描述内盒右缘） */
      marginRight: number
    }

    // 底部信息（版权 + 编号）
    bottomInfo: LayoutItem & {
      showFlag: boolean
      strokeFlag: boolean
      /** 左边距（mm，版权栏起点） */
      marginLeft: number
      /** 右边距（mm，武将编号右缘） */
      marginRight: number
    }

    // 扩展包标识
    package: LayoutItem & {
      convertTChFlag: boolean
      /** 文字角标底图自定义色 hex（渐变起点） */
      customColor: string
      /** 文字角标渐变终点 hex（仅启用 gradient 的预设使用） */
      customColorEnd: string
      /** 角标默认位置所属卡面布局（神框 / 普通框），刷新后避免沿用另一套 preset 坐标 */
      packageCardLayoutKey?: 'shen' | 'normal'
    }

    // 势力
    kingdom: LayoutItem & {
      doubleKingdom: boolean
      /** 双势力下仅显示一字，位置与单势力一致 */
      doubleSingleGlyphFlag: boolean
      /** 双势力单字模式显示势力1 / 势力2 */
      doubleSingleGlyphRole: 'primary' | 'secondary'
      /** 双势力模式下各势力字独立布局（kingdom-primary / kingdom-secondary） */
      doubleGlyphs?: Record<string, LayoutItem>
      /** 记录双势力字当前对应的素材 key，切换组合时重置默认坐标 */
      doubleGlyphKingdoms?: { primary: string; secondary: string }
      /**
       * 单势力预设 PNG 字布局指纹（势力 key + 神框/普通表），
       * 切换势力或神框布局后刷新时避免沿用旧坐标。
       */
      singlePresetGlyphKey?: string
      convertTChFlag: boolean
      /** 详细设置「自定义势力」总开关 */
      customKingdomFlag: boolean
      /** 扩展预设势力 key（public/diy/shared/kingdom-preset；与魏蜀吴群晋隔离） */
      presetKingdomKey?: string
      customText: {
        single: string
        primary: string
        secondary: string
      }
      /** 自定义势力字字体 */
      customFont: 1 | 2
      /** 单势力自定义色 */
      customColor: string
      /** 双势力：势力1 / 势力2 自定义色 */
      customColorPrimary: string
      customColorSecondary: string
      /** 自定义势力 + 神势力：开启后称号使用自定义势力色（默认关闭，仍为黄色） */
      customShenTitleColorFlag: boolean
      /** 自定义双字：第二字相对第一字的水平间距（mm） */
      customDualCharSpacingMm: number
      /** 详细设置：势力字置空（隐藏图片 / 文字势力字） */
      glyphEmptyFlag: boolean
      /** 详细设置：势力字单独变色（图片 / 文字模式均生效） */
      glyphColorFlag: boolean
      /** 势力字单独变色 hex（单势力；双势力时作势力1 / 单势力字回退） */
      glyphColor: string
      /** 双势力：势力1（左）势力字色 */
      glyphColorPrimary: string
      /** 双势力：势力2（右）势力字色 */
      glyphColorSecondary: string
      /** 详细设置：非神势力字渐变（上：原势力色，下：终点色） */
      glyphGradientFlag: boolean
      /** 势力字渐变终点色 hex（单势力；双势力单字回退） */
      glyphGradientEndColor: string
      /** 双势力：势力1（左）渐变终点色 */
      glyphGradientEndColorPrimary: string
      /** 双势力：势力2（右）渐变终点色 */
      glyphGradientEndColorSecondary: string
    }

    // 水印文本
    watermark: LayoutItem

    // 人物出框（独立布局时与武将图分开操作）
    legendOutOfFrame: LayoutItem

    // 主插画（武将立绘）
    legendImage: LayoutItem & {
      /** 出框人物与技能框重叠时自动隐藏（默认开启） */
      hideOutOfFrameSkillOverlap?: boolean
      /** 出框图独立于武将图布局（默认关闭，与武将图同步） */
      outOfFrameIndependentLayout?: boolean
    }
  }
}

/** 新建/重置画布时的默认演示技能 */
export const createDefaultLegendSkills = (): LegendSkill[] => [
  {
    name: '梁燕',
    desc: '出牌阶段限一次，你可以选择一名其他角色并摸/弃置至多两张牌，令该角色弃置/摸等量张牌。若你与其的手牌数因此相同，摸牌的角色跳过其下一个弃牌阶段。',
  },
  {
    name: '明慧',
    desc: '每回合结束时，若你的手牌数全场：最少，你可以视为使用一张无距离限制的【杀】；最多，你可以将手牌弃置至不为全场最多，然后令一名角色回复1点体力。',
  },
]

/** 新建/重置画布时的默认武将基础信息 */
export const createDefaultLegendBaseInfo = (): BaseLegendInfo => ({
  name: '张春华',
  title: '皑雪皎月',
  kingdom: 'wei',
  doubleKingdom: ['wei', 'qun'],
  hp: 3,
  maxHp: 3,
  shield: 0,
  quality: 'epic',
  legendId: 'WEI 027',
  life: '张春华，司马懿的正妻。 张春华年轻时就有德行，智慧见识超过常人，为司马懿生下司马师、司马昭、司马干和南阳公主。 正始八年夏季四月，张春华去世，葬于洛阳高原陵，追赠广平县君。咸熙元年，追号宣穆妃。张春华的孙子晋武帝司马炎接收禅让建立西晋后，于泰始元年十二月丁卯追尊张春华为宣穆皇后。',
  pic: resolvePublicAssetSrc('images', 'legend_picture_demo_2026.1.9.jpg'),
  skills: createDefaultLegendSkills(),
  quote: '',
  copyright: '™&© 2026 游卡桌游 .Illustration: ShapByAI',
  masterFlag: false,
  packageIdentify: createDefaultPackageIdentify(),
})

// ======================
// 最终模板根结构
// ======================
export interface LegendInfo extends DiyCardInfoBase<BaseLegendInfo, LegendRenderConfig> {}

/**
 * 默认的配置工厂
 */
export const createDefaultRenderConfig = (): LegendRenderConfig => {
  return {
    customImage: {
      defaultScale: 50,
      layerPosition: 'partial',
      hidePartialSkillOverlap: true,
    },
    display: {
      fullModeFlag: false,
    },
    outOfFrame: createDefaultOutOfFrameConfig(),
    watermark: {
      showFlag: true,
      username: '',
    },
    items: createDefaultItemsConfig(),
  }
}

/**
 * 默认的布局配置工厂
 */
const createDefaultItemsConfig = (): LegendRenderConfig['items'] => {
  const baseItem: LayoutItem = {
    code: '',
    name: 'unknown',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    scale: 1,
    order: 99,
    rotation: 0,
    editable: {
      selectable: false,
      movable: false,
      rotatable: false,
      scalable: false,
    },
  }

  return {
    frame: {
      ...baseItem,
      code: 'frame',
      src: 'wei',
      fullUiType: '',
    },
    // 武将名
    name: {
      ...baseItem,
      code: 'name',
      order: 2,
      convertTChFlag: true,
      characterSpacing: NAME_LAYOUTS[0]!.characterSpacingPt,
      splitFlag: false,
      editable: {
        selectable: true,
        movable: true,
        rotatable: false,
        scalable: true,
      },
    },
    // 称号
    title: {
      ...baseItem,
      code: 'title',
      order: 3,
      convertTChFlag: true,
      characterSpacing: TITLE_LAYOUTS[0]!.characterSpacingPt,
      customColorFlag: false,
      customColor: '',
      customColorPrimary: '',
      customColorSecondary: '',
      editable: {
        selectable: true,
        movable: true,
        rotatable: false,
        scalable: true,
      },
    },
    // 体力值
    hp: {
      ...baseItem,
      code: 'hp',
      equalFlag: true,
      customColorFlag: false,
      customColor: '',
      customColorPrimary: '',
      customColorSecondary: '',
    },
    // 技能名称
    skillsName: {
      ...baseItem,
      code: 'skillsName',
      order: 5,
      convertTChFlag: true,
      size: SKILL_NAME_FONT_SIZE_PT,
      characterSpacing: SKILL_NAME_TRACKING,
      marginTop: SKILL_NAME_DEFAULT_MARGIN_TOP_MM,
      editable: {
        selectable: true,
        movable: false,
        rotatable: false,
        scalable: false,
      },
    },
    // 技能描述
    skillsDesc: {
      ...baseItem,
      code: 'skillsDesc',
      order: 4,
      size: SKILL_DESC_DEFAULT_FONT_SIZE_PT,
      autoOptimizeFlag: SKILL_DESC_AUTO_OPTIMIZE_DEFAULT,
      autoOptimizeSizeFlag: SKILL_DESC_AUTO_SIZE_DEFAULT,
      autoFullNumberFlag: true,
      newFontFlag: false,
      derivedSkillFontFlag: true,
      textBoldFlag: false,
      paraSpacing: SKILL_DESC_DEFAULT_PARA_SPACING_MM,
      singleLineParaSpacing: SKILL_DESC_DEFAULT_SINGLE_LINE_PARA_SPACING_MM,
      rowSpacing: SKILL_DESC_DEFAULT_ROW_SPACING_PT,
      characterSpacing: SKILL_DESC_DEFAULT_TRACKING,
      marginTop: SKILL_DESC_DEFAULT_MARGIN_TOP_MM,
      marginBottom: SKILL_DESC_DEFAULT_MARGIN_BOTTOM_MM,
      marginLeft: SKILL_DESC_DEFAULT_MARGIN_LEFT_MM,
      marginRight: SKILL_DESC_DEFAULT_MARGIN_RIGHT_MM,
      bgOpaque: SKILL_DESC_BG_OPAQUE_DEFAULT,
      editable: {
        selectable: true,
        movable: false,
        rotatable: false,
        scalable: true,
      },
    },
    // 引言
    quote: {
      ...baseItem,
      code: 'quote',
      order: 16,
      size: Math.max(
        SKILL_DESC_DEFAULT_FONT_SIZE_PT - SKILL_DESC_QUOTE_SIZE_DELTA_PT,
        SKILL_DESC_QUOTE_MIN_FONT_PT,
      ),
      characterSpacing: QUOTE_DEFAULT_TRACKING,
      marginTop: QUOTE_DEFAULT_MARGIN_TOP_MM,
      marginBottom: QUOTE_DEFAULT_MARGIN_BOTTOM_MM,
      marginLeft: QUOTE_DEFAULT_MARGIN_LEFT_MM,
      marginRight: QUOTE_DEFAULT_MARGIN_RIGHT_MM,
      editable: {
        selectable: false,
        movable: false,
        rotatable: false,
        scalable: true,
      },
    },
    // 底部信息
    bottomInfo: {
      ...baseItem,
      code: 'bottomInfo',
      order: 25,
      showFlag: true,
      strokeFlag: false,
      marginLeft: BOTTOM_INFO_DEFAULT_MARGIN_LEFT_MM,
      marginRight: BOTTOM_INFO_DEFAULT_MARGIN_RIGHT_MM,
      editable: {
        selectable: false,
        movable: false,
        rotatable: false,
        scalable: false,
      },
    },
    // 扩展包
    package: {
      ...baseItem,
      code: 'package',
      name: '角标',
      order: 6,
      convertTChFlag: false,
      customColor: resolvePackageTextBadgeDefaultColor('text_ccxh'),
      customColorEnd: resolvePackageTextBadgeDefaultColorEnd('text_ccxh'),
      editable: {
        selectable: true,
        movable: true,
        rotatable: true,
        scalable: true,
      },
    },
    // 势力
    kingdom: {
      ...baseItem,
      code: 'kingdom',
      order: 7,
      doubleKingdom: false,
      doubleSingleGlyphFlag: false,
      doubleSingleGlyphRole: 'primary',
      convertTChFlag: false,
      customKingdomFlag: false,
      presetKingdomKey: '',
      customText: {
        single: '',
        primary: '',
        secondary: '',
      },
      customFont: 1,
      customColor: DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR,
      customColorPrimary: DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY,
      customColorSecondary: DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY,
      customShenTitleColorFlag: false,
      customDualCharSpacingMm: CUSTOM_KINGDOM_LAYOUT.dualCharSpacingMm,
      glyphEmptyFlag: false,
      glyphColorFlag: false,
      glyphColor: '',
      glyphColorPrimary: '',
      glyphColorSecondary: '',
      glyphGradientFlag: false,
      glyphGradientEndColor: '',
      glyphGradientEndColorPrimary: '',
      glyphGradientEndColorSecondary: '',
      editable: {
        selectable: true,
        movable: true,
        rotatable: true,
        scalable: true,
      },
    },
    // 水印
    watermark: {
      ...baseItem,
      code: 'watermark',
      order: 9,
      editable: {
        selectable: true,
        movable: true,
        rotatable: true,
        scalable: true,
      },
    },
    // 人物出框（默认跟随武将图，不可单独选中）
    legendOutOfFrame: {
      ...baseItem,
      code: 'legendOutOfFrame',
      name: '人物出框',
      order: 1,
      editable: {
        selectable: false,
        movable: false,
        rotatable: false,
        scalable: false,
      },
    },
    // 主插画
    legendImage: {
      ...baseItem,
      code: 'legendImage',
      name: '武将图',
      order: 1,
      hideOutOfFrameSkillOverlap: true,
      editable: {
        selectable: true,
        movable: true,
        rotatable: true,
        scalable: true,
        snapToStageEdge: true,
      },
    },
  }
}
