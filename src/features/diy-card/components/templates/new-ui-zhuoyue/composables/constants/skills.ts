/** 技能描述组内透明命中区 code（子层 listening:false 时承接点击选中） */
export const SKILL_DESC_HIT_CODE = 'skillsDesc-hit'

/** 技能名组内透明命中区 code（框图 listening:false 时承接点击选中） */
export const SKILL_NAME_HIT_CODE = 'skillsName-hit'

/** 技能名距成品区左缘（mm） */
export const SKILL_NAME_ORIGIN_X_MM = 2

/** 神势力技能名距成品区左缘（mm） */
export const SKILL_NAME_ORIGIN_X_SHEN_MM = 3.1

/** 技能名纵向微调（mm，相对技能区坐标；正值下移） */
export const SKILL_NAME_ORIGIN_Y_MM = 1

/** 神势力技能名纵向微调（mm，相对技能区坐标；正值下移） */
export const SKILL_NAME_ORIGIN_Y_SHEN_MM = 1.2

/** 技能名整体占位宽（mm，单技能框组外框宽；与各饰边图宽独立，改此项不影响左/底/右图宽） */
export const SKILL_NAME_GROUP_WIDTH_MM = 18.8

/** 技能框元素布局（mm，相对单技能框组左上） */
export interface SkillNameFrameElementMm {
  x: number
  y: number
  /** PNG 渲染宽；文字节点不使用 width */
  width: number
}

/** 技能框左饰边图 */
export const SKILL_NAME_FRAME_LEFT_MM: SkillNameFrameElementMm = {
  x: 0,
  y: 0,
  width: 16,
}

/** 技能框投影图 */
export const SKILL_NAME_FRAME_SHADOW_MM: SkillNameFrameElementMm = {
  x: -0.3,
  y: -0.3,
  width: 14.3,
}

/** 技能框底图 */
export const SKILL_NAME_FRAME_BG_MM: SkillNameFrameElementMm = {
  x: 0,
  y: 0.2,
  width: 15.4,
}

/** 技能框右饰边 */
export const SKILL_NAME_FRAME_RIGHT_MM: SkillNameFrameElementMm = {
  x: 0,
  y: 0,
  width: 16,
}

/** 技能名文字 - 普通 */
export const SKILL_NAME_TEXT_MM: SkillNameFrameElementMm = {
  x: 1.4,
  y: 0.1,
  width: 0,
}

/**
 * 衍生技技能名纵向上移（mm，负值上移）。
 * derived 底图视觉重心高于 normal，须补偿以使文字与非衍生技对齐。
 */
export const SKILL_NAME_DERIVED_TEXT_OFFSET_Y_MM = -0.15

/** 技能名文字 - 神 */
export const SKILL_NAME_SHEN_TEXT_MM: SkillNameFrameElementMm = {
  x: 2,
  y: 0.12,
  width: 0,
}

/** 神势力技能名整框图（单张 shen.png，替代左/底/右拼接） */
export const SKILL_NAME_SHEN_FRAME_MM: SkillNameFrameElementMm = {
  x: 0,
  y: 0,
  width: SKILL_NAME_GROUP_WIDTH_MM,
}

/** 技能名默认字号 */
export const SKILL_NAME_FONT_FAMILY = '隶书'
export const SKILL_NAME_FONT_SIZE_PT = 10

/** 技能名默认字间距（PS tracking） */
export const SKILL_NAME_TRACKING = 0

/** 技能名默认上边距（mm，用户可调；正值下移） */
export const SKILL_NAME_DEFAULT_MARGIN_TOP_MM = 0

/** 技能描述字体 */
export const SKILL_DESC_FONT_OLD = '汉仪中圆'
export const SKILL_DESC_FONT_NEW = '方正准圆'
export const SKILL_DESC_DERIVED_FONT_OLD = '汉仪粗仿宋简体'
export const SKILL_DESC_DERIVED_FONT_NEW = '方正仿宋'

/** 技能描述默认字号（印刷 pt，与 PS / 水印一致） */
export const SKILL_DESC_DEFAULT_FONT_SIZE_PT = 6
/** 技能描述「优化描述」默认开启（语言判断、标点纠正、句末补标点） */
export const SKILL_DESC_AUTO_OPTIMIZE_DEFAULT = true
/** 技能描述「优化字号」默认开启（字号自适应、区间限制 [5, 6.5] pt） */
export const SKILL_DESC_AUTO_SIZE_DEFAULT = true

export const resolveSkillsDescAutoOptimizeFlag = (
  autoOptimizeFlag: boolean | undefined,
): boolean => autoOptimizeFlag ?? SKILL_DESC_AUTO_OPTIMIZE_DEFAULT

/** 缺省字段时写入默认开关，便于面板与存储一致 */
export const ensureSkillsDescAutoOptimizeDefault = (descItem: {
  autoOptimizeFlag?: boolean
}) => {
  if (descItem.autoOptimizeFlag === undefined) {
    descItem.autoOptimizeFlag = SKILL_DESC_AUTO_OPTIMIZE_DEFAULT
  }
}

export const resolveSkillsDescAutoSizeFlag = (
  autoOptimizeSizeFlag: boolean | undefined,
  autoOptimizeFlag?: boolean | undefined,
): boolean => {
  if (autoOptimizeSizeFlag !== undefined) return autoOptimizeSizeFlag
  // 旧存档：字号优化曾捆绑在 autoOptimizeFlag
  return autoOptimizeFlag ?? SKILL_DESC_AUTO_SIZE_DEFAULT
}

/** 缺省字段时写入默认开关；未迁移的旧数据沿用 autoOptimizeFlag */
export const ensureSkillsDescAutoSizeDefault = (descItem: {
  autoOptimizeSizeFlag?: boolean
  autoOptimizeFlag?: boolean
}) => {
  if (descItem.autoOptimizeSizeFlag === undefined) {
    descItem.autoOptimizeSizeFlag = resolveSkillsDescAutoSizeFlag(
      undefined,
      descItem.autoOptimizeFlag,
    )
  }
}
/** 普通势力技能描述半透明底框默认不透明度（0–1） */
export const SKILL_DESC_BG_OPAQUE_DEFAULT = 0.65
/** 神势力技能描述背景 SVG 默认不透明度（0–1） */
export const SKILL_DESC_BG_OPAQUE_SHEN_DEFAULT = 0.7
/** 自动优化字号：描述+引言+底栏整体高度上限 = 成品区高度 × 该比例 */
export const SKILL_DESC_AUTO_SIZE_HEIGHT_RATIO = 0.3
/** 自动优化测高容差（px）：弥补布局测高与实绘偏差，避免偏小一档 */
export const SKILL_DESC_AUTO_SIZE_FIT_SLACK_PX = 18
/** 严格测高略超限时，仍允许放大一档的最大超出量（px） */
export const SKILL_DESC_AUTO_SIZE_ONE_STEP_RELAX_PX = 16
/** 自动优化字号下限（pt） */
export const SKILL_DESC_AUTO_SIZE_MIN_FONT_PT = 5
/** 自动优化字号上限（pt），仅开启自动优化时生效 */
export const SKILL_DESC_AUTO_SIZE_MAX_FONT_PT = 6.5
/** 技能描述字号下限（pt），与自动优化开关无关，手动/布局均受此限制 */
export const SKILL_DESC_MIN_FONT_PT = 4
/** 技能描述字号上限（pt），与自动优化开关无关，手动/布局均受此限制 */
export const SKILL_DESC_MAX_FONT_PT = 7
/** 自动优化字号搜索步进（pt） */
export const SKILL_DESC_AUTO_SIZE_STEP_PT = 0.5
/** 技能描述字号→行距标定点（pt），中间线性插值；例：5→6、6→7、6.5→8、7→9 */
export const SKILL_DESC_ROW_SPACING_FONT_KNOTS = [
  [5, 6],
  [6, 7],
  [6.5, 8],
  [7, 9],
] as const
/** 引言相对技能描述字号的默认差值（pt） */
export const SKILL_DESC_QUOTE_SIZE_DELTA_PT = 0.5
export const SKILL_DESC_QUOTE_MIN_FONT_PT = 3

/**
 * 普通技能描述正文描边（加粗关闭）
 */
export const SKILL_DESC_SHADOW_STROKE_EM = 0
/**
 * 衍生技描述正文描边（加粗关闭，旧字体）
 */
export const SKILL_DESC_DERIVED_SHADOW_STROKE_EM_OLD = 0
/**
 * 衍生技描述正文描边（加粗关闭，新字体；对齐旧版 .derived.new-font text-stroke）
 */
export const SKILL_DESC_DERIVED_SHADOW_STROKE_EM_NEW = 0.01
/**
 * 普通技能 <b> 描边（加粗关闭）
 */
export const SKILL_DESC_BOLD_STROKE_EM = 0.03
/**
 * 衍生技 <b> 描边（加粗关闭）
 */
export const SKILL_DESC_DERIVED_BOLD_STROKE_EM = 0.03
/**
 * 技能描述「加粗」开启时，在四种基础描边上统一追加的量（em）
 */
export const SKILL_DESC_TEXT_BOLD_STROKE_EM = 0.004

/** 解析技能描述片段描边标量（em） */
export const resolveSkillDescStrokeEm = (
  textBoldFlag: boolean,
  derivedSkillFlag: boolean,
  isBoldMarkup: boolean,
  newFontFlag: boolean,
): number => {
  let strokeEm = isBoldMarkup
    ? derivedSkillFlag
      ? SKILL_DESC_DERIVED_BOLD_STROKE_EM
      : SKILL_DESC_BOLD_STROKE_EM
    : derivedSkillFlag
      ? newFontFlag
        ? SKILL_DESC_DERIVED_SHADOW_STROKE_EM_NEW
        : SKILL_DESC_DERIVED_SHADOW_STROKE_EM_OLD
      : SKILL_DESC_SHADOW_STROKE_EM
  if (textBoldFlag) {
    strokeEm += SKILL_DESC_TEXT_BOLD_STROKE_EM
  }
  return strokeEm
}

/** 技能描述下划线：距文字顶部的纵向位置（em，略低于字面底部，避免压字） */
export const SKILL_DESC_UNDERLINE_OFFSET_FROM_TOP_EM = 1
/** 技能描述下划线粗细（em） */
export const SKILL_DESC_UNDERLINE_THICKNESS_EM = 0.02

/** 花色符号默认红色 */
export const SKILL_DESC_SUIT_COLOR_RED = '#a40000'

/** 非末技能描述最小高度（普通，保证技能名对齐有空间，mm） */
export const SKILL_DESC_FIRST_BLOCK_MIN_MM = 3.8
/** 非末技能描述最小高度（神，mm） */
export const SKILL_DESC_FIRST_BLOCK_MIN_SHEN_MM = 4
/**
 * 普通势力无引言：下边距布局偏置（mm，不显示在面板）。
 */
export const SKILL_DESC_MARGIN_BOTTOM_NORMAL_BIAS_MM = 0
/** 技能区最小高度（普通，mm） */
export const SKILL_DESC_MIN_HEIGHT_MM = 15
/** 技能区最小高度（神，mm） */
export const SKILL_DESC_MIN_HEIGHT_SHEN_MM = 21
/** 技能描述与底部信息的分隔线宽（mm，高度按 line.png 宽高比等比缩放） */
export const SKILL_DESC_LINE_WIDTH_MM = 45.4
/** 分隔线 x 轴（mm） */
export const SKILL_DESC_LINE_X_MM = 0

/* 边距安全区（普通势力，mm） */
export const SKILL_DESC_MARGIN_SAFE_TOP_MM = 1.7
export const SKILL_DESC_MARGIN_SAFE_RIGHT_MM = 1.5
export const SKILL_DESC_MARGIN_SAFE_BOTTOM_MM = 0
export const SKILL_DESC_MARGIN_SAFE_LEFT_MM = 12.5

/* 边距安全区（神势力，mm） */
export const SKILL_DESC_MARGIN_SAFE_TOP_SHEN_MM = 1.5
export const SKILL_DESC_MARGIN_SAFE_RIGHT_SHEN_MM = 5
export const SKILL_DESC_MARGIN_SAFE_BOTTOM_SHEN_MM = 1.5
export const SKILL_DESC_MARGIN_SAFE_LEFT_SHEN_MM = 15.5

/** 神势力技能描述背景（skill-desc/shen.svg）距成品区左缘（mm） */
export const SKILL_DESC_BG_MARGIN_LEFT_SHEN_MM = 4.16
/** 神势力技能描述背景距成品区右缘（mm） */
export const SKILL_DESC_BG_MARGIN_RIGHT_SHEN_MM = 4
/** 神势力技能描述背景距成品区下缘（mm） */
export const SKILL_DESC_BG_MARGIN_BOTTOM_SHEN_MM = 6
/** 神势力技能描述背景：上缘到内容顶部的安全留白（mm） */
export const SKILL_DESC_BG_SAFE_TOP_SHEN_MM = 0.12
/** 神势力技能描述背景 SVG 填充色 */
export const SKILL_DESC_SHEN_BG_FILL_RGB = [230, 230, 140] as const
/** 神势力技能描述背景：四角保护区（设计稿 px，不参与纵向/横向拉伸） */
export const SKILL_DESC_SHEN_BG_SLICE_LEFT_PX = 33
export const SKILL_DESC_SHEN_BG_SLICE_RIGHT_PX = 33
export const SKILL_DESC_SHEN_BG_SLICE_TOP_PX = 33
export const SKILL_DESC_SHEN_BG_SLICE_BOTTOM_PX = 33
/** 神势力技能描述背景左下角饰 x（相对神底图左缘 mm） */
export const SKILL_DESC_SHEN_CORNER_BL_X_MM = -0.36
/** 神势力技能描述背景左下角饰 y（距神底图下缘 mm，角饰底边对齐） */
export const SKILL_DESC_SHEN_CORNER_BL_Y_MM = -3.22
/** 神势力技能描述背景左下角饰宽（mm；高随 SVG 原比例） */
export const SKILL_DESC_SHEN_CORNER_BL_WIDTH_MM = 20.8
/** 神势力技能描述背景右下角饰 x（相对神底图左缘 mm） */
export const SKILL_DESC_SHEN_CORNER_BR_X_MM = 38.8
/** 神势力技能描述背景右下角饰 y（距神底图下缘 mm，角饰底边对齐） */
export const SKILL_DESC_SHEN_CORNER_BR_Y_MM = -3.2
export const SKILL_DESC_SHEN_CORNER_BR_WIDTH_MM = 20.8
/** 角饰 SVG 设计稿 fallback 宽高比（高/宽，无 naturalSize 时使用） */
export const SKILL_DESC_SHEN_CORNER_ASPECT = 185 / 369
/** 默认间距（用户面板可见值，不含安全区，mm） */
export const SKILL_DESC_DEFAULT_MARGIN_TOP_MM = 0
export const SKILL_DESC_DEFAULT_MARGIN_RIGHT_MM = 0.76
export const SKILL_DESC_DEFAULT_MARGIN_LEFT_MM = 0.2
export const SKILL_DESC_DEFAULT_MARGIN_BOTTOM_MM = 0
export const SKILL_DESC_DEFAULT_PARA_SPACING_MM = 0.76
/** 非末技能且描述仅一行时的段间距（mm），默认 0 */
export const SKILL_DESC_DEFAULT_SINGLE_LINE_PARA_SPACING_MM = 0
/** 默认字间距 */
export const SKILL_DESC_DEFAULT_TRACKING = -25
/** 默认行距（pt，对应默认字号 6 → 7） */
export const SKILL_DESC_DEFAULT_ROW_SPACING_PT = 7
