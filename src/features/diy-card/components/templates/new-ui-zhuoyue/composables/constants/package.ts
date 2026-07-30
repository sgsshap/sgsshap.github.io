// =============================================================================
// 公共 — 画布布局
// =============================================================================

import type { CustomColorTintGamutOptions } from '@/features/diy-card/constants/customColorPickerOptions'
import { resolvePublicAssetSrc } from '@/features/diy-card/constants/publicAssets'

/** 渐变底图着色：保留原图亮度纹理的默认权重（血点标偏低，避免终点色偏暗） */
export const DEFAULT_PACKAGE_GRADIENT_TINT_LIGHTNESS_TEXTURE = 0.05

/** 渐变底图着色参数（可按预设覆盖） */
export type PackageTextBgGradientTintOptions = {
  /**
   * 原图亮度纹理混入比（0–1）。
   * 光感/玻璃质感底图宜偏高（如十周年圆标）；扁平喷溅底图宜偏低（如血点标）。
   */
  lightnessTexture?: number
  /** 与 package 默认色域合并的覆盖项 */
  gamut?: Partial<CustomColorTintGamutOptions>
}

/** 普通框：角标默认左上角位置、最大显示宽高、相对素材的默认缩放 */
export const PACKAGE_LAYOUT_NORMAL = {
  /** 角标左上角相对成品区左上角的 X（mm） */
  xMm: 55.5,
  /** 角标左上角相对成品区左上角的 Y（mm） */
  yMm: 80.6,
  /** 角标最大宽度（mm）；宽≥高时以 max 宽为准，高度等比 */
  maxWidthMm: 4.5,
  /** 角标最大高度（mm）；高>宽时以 max 高为准，宽度等比 */
  maxHeightMm: 4.5,
  /** 在 fit 进 max 框后的额外缩放倍率（1 = 不放大） */
  defaultScale: 1,
} as const

/** 神框：单独一套默认位置与 max 框（与普通框解耦，便于微调） */
export const PACKAGE_LAYOUT_SHEN = {
  /** 角标左上角相对成品区左上角的 X（mm） */
  xMm: 54.2,
  /** 角标左上角相对成品区左上角的 Y（mm） */
  yMm: 76.9,
  /** 角标最大宽度（mm）；宽≥高时以 max 宽为准，高度等比 */
  maxWidthMm: 5,
  /** 角标最大高度（mm）；高>宽时以 max 高为准，宽度等比 */
  maxHeightMm: 5,
  /** 在 fit 进 max 框后的额外缩放倍率（1 = 不放大） */
  defaultScale: 1,
} as const

export type PackageLayoutPreset = {
  xMm: number
  yMm: number
  maxWidthMm: number
  maxHeightMm: number
  defaultScale: number
}

// =============================================================================
// 公共 — 文字角标类型、默认布局与栅格字参数
// =============================================================================

/**
 * 文字角标独立底图 PNG（每种预设一张，不再从雪碧图裁剪）。
 * `layoutRef*` 为文字排版的设计基准尺寸，可与 PNG 像素尺寸不同。
 */
export type PackageTextBgAsset = {
  /** 相对 `public/diy/shared/package/` 的文件名 */
  assetFile: string
  /** 文字排版基准宽（px）；字号/位置比例按此宽设计 */
  layoutRefWidthPx: number
  /** 文字排版基准高（px） */
  layoutRefHeightPx: number
}

/** 解析文字角标底图完整加载 URL */
export const resolvePackageTextBgSrc = (bg: PackageTextBgAsset) =>
  resolvePublicAssetSrc('package', bg.assetFile)

/**
 * 文字角标底图在角标组（badge）内的位置与尺寸（相对 badge 宽高的比例）。
 * 绘制层据此计算 Konva Image 的 x / y / width / height。
 */
export type PackageTextBgLayout = {
  /** 底图左上角 X 比例（0 = 贴左） */
  xRatio: number
  /** 底图左上角 Y 比例（0 = 贴上） */
  yRatio: number
  /** 底图宽度比例（1 = 与角标同宽） */
  widthRatio: number
  /** 底图高度比例（1 = 与角标同高） */
  heightRatio: number
}

/** 默认底图布局：铺满整个角标区域（与旧站 background 填满容器一致） */
export const PACKAGE_TEXT_BG_LAYOUT: PackageTextBgLayout = {
  xRatio: 0,
  yRatio: 0,
  widthRatio: 1,
  heightRatio: 1,
} as const

/** 渐变栅格字模拟加粗 / 外轮廓：描边宽 px = fontSize × ratio（无额外下限） */
export const DEFAULT_PACKAGE_TEXT_SYNTHETIC_BOLD_WIDTH_RATIO = 0.055

/** 小于该 px 的描边不绘制（避免亚像素糊边） */
export const PACKAGE_TEXT_RASTER_MIN_VISIBLE_STROKE_PX = 0.25

/** 渐变栅格字外阴影 / 暗色外轮廓（Canvas 绘制） */
export type PackageTextCharRasterShadow = {
  /** 阴影色；建议带 alpha 的黑色 */
  color: string
  /** shadowBlur = fontSize × ratio */
  blurRatio?: number
  /** shadowOffsetX = fontSize × ratio */
  offsetXRatio?: number
  /** shadowOffsetY = fontSize × ratio */
  offsetYRatio?: number
  /** 暗色外描边宽 = fontSize × ratio（叠在阴影之上、渐变字之下） */
  outlineWidthRatio?: number
}

/** 自定义文字角标种类（对应 packageIdentify.name） */
export type PackageTextBadgeKind = 'text_ccxh' | 'blood_point' | 'text_10th'

/**
 * 自定义文字角标双色线性渐变。
 * 起终点用户色见 renderConfig.items.package.customColor / customColorEnd。
 */
export type PackageTextBadgeGradient = {
  /**
   * 渐变流向角度（CSS 惯例：0°=向上，90°=向右，180°=向下，顺时针）。
   * 例：135° ≈ 左上 → 右下。
   */
  angleDeg: number
  /**
   * 沿渐变轴的起色位置（0–1）；此前保持 customColor。
   * 例：0.2 表示轴长 20% 之前均为起点色。
   */
  startAt?: number
  /**
   * 沿渐变轴的终色位置（0–1）；此后保持 customColorEnd。
   * 例：0.6 表示轴长 60% 处已完成过渡；须 ≥ startAt。
   */
  endAt?: number
}

/** 单字文字填充渐变参数（每字独立，与底图 customColor 渐变无关） */
export type PackageTextCharFillGradient = {
  /** 渐变起点色（180° 时为顶部） */
  startHex: string
  /** 渐变终点色（180° 时为底部） */
  endHex: string
  /** 渐变流向角度；默认 180°（上 → 下） */
  angleDeg?: number
  startAt?: number
  endAt?: number
}

/** 逐字文字填充：纯色与渐变互斥，预设里只配置其一 */
export type PackageTextCharFill =
  | { type: 'solid'; color: string }
  | ({ type: 'gradient' } & PackageTextCharFillGradient)

/** 归一化渐变角到 [0, 360) */
export const normalizePackageTextBadgeGradientAngleDeg = (angleDeg: number) => {
  const n = angleDeg % 360
  return n < 0 ? n + 360 : n
}

export const resolvePackageTextBadgeGradientAngleDeg = (gradient: PackageTextBadgeGradient) =>
  normalizePackageTextBadgeGradientAngleDeg(gradient.angleDeg)

/** 血点标：沿渐变轴过渡区间（0–1） */
export const resolvePackageTextBadgeGradientStartAt = (gradient: PackageTextBadgeGradient) =>
  Math.min(1, Math.max(0, gradient.startAt ?? 0))

export const resolvePackageTextBadgeGradientEndAt = (gradient: PackageTextBadgeGradient) => {
  const startAt = resolvePackageTextBadgeGradientStartAt(gradient)
  return Math.min(1, Math.max(startAt, gradient.endAt ?? 1))
}

/** 文字相对锚点的水平对齐（决定 xRatio 锚点是字的左缘 / 中心 / 右缘） */
export type PackageTextCharAlign = 'left' | 'center' | 'right'

/**
 * 单个文字槽位的排版参数。
 * 所有坐标、字号均以「当前角标容器 badge 的宽高」为基准换算成比例，缩放角标时自动同比。
 */
export type PackageTextCharSlot = {
  /**
   * 字号比例：实际字号 px = badgeWidth × fontSizeRatio。
   * 例：CSS `font-size: 18px`、badge 参考宽 30px → 18/30。
   */
  fontSizeRatio: number
  /** 锚点 X 比例，相对 badge 宽度（0=左缘，1=右缘，0.5=水平中心） */
  xRatio: number
  /** 锚点 Y 比例，相对 badge 高度（0=顶边，1=底边） */
  yRatio: number
  /** 锚点对齐方式；默认 `left` */
  align?: PackageTextCharAlign
  /** 逐字横向缩放（Konva scaleX；璀璨星河单字约 1.02） */
  scaleX?: number
  /** 逐字纵向缩放（Konva scaleY；血点标单字约 1.2） */
  scaleY?: number
  /** 无 Bold 字重时，Canvas 描边模拟加粗（仅渐变栅格字生效） */
  syntheticBold?: boolean
  /**
   * 模拟加粗描边宽 = fontSize × ratio
   * 描边宽 px = fontSize × ratio，无硬下限；小于 0.25px 时不绘制。
   * 设为 `0` 则关闭模拟加粗（即使 `syntheticBold: true`）。
   */
  syntheticBoldWidthRatio?: number
}

/**
 * 文字描边 / 外阴影。
 * Konva 无 CSS 多层 text-shadow，此处用 stroke + shadow 近似旧站效果。
 */
export type PackageTextStrokeStyle = {
  /** 是否启用；false 时不写 stroke / shadow 字段 */
  enabled: boolean
  /** Konva Text 描边颜色（固定 hex；与 strokeFromBadgeColor 二选一） */
  stroke?: string
  /**
   * 描边色取自角标 customColor，按 HSL 微调（璀璨星河外描边）。
   * 为 true 时忽略 `stroke` 固定值。
   */
  strokeFromBadgeColor?: boolean
  /**
   * 描边色取自 customColorEnd（实色，不走渐变轴）。
   * 与 strokeFromBadgeColor 同时为 true 时以本项为准；血点标次字描边。
   */
  strokeFromBadgeColorEnd?: boolean
  /**
   * 描边沿 preset.gradient 做双色线性渐变（须 strokeFromBadgeColor 且非 strokeFromBadgeColorEnd）。
   */
  strokeFollowsGradient?: boolean
  /**
   * 渐变模式下描边直接用 customColor / customColorEnd，不做 HSL 微调。
   * 默认 false，仍走 strokeLightnessDelta / strokeSaturationDelta。
   */
  strokeGradientDirect?: boolean
  /** 相对角标色亮度偏移（负=略加深）；默认 -0.08 */
  strokeLightnessDelta?: number
  /** 相对角标色饱和度偏移（正=更饱和）；默认 +0.12 */
  strokeSaturationDelta?: number
  /**
   * 外描边：描边层在下、白字在上，避免 Konva 居中描边污染字芯。
   * 须配合 `strokeWidthRatio`（全宽；可见外圈约为一半）。
   */
  outerStroke?: boolean
  /** 描边宽度比例：strokeWidth px = badgeWidth × strokeWidthRatio */
  strokeWidthRatio?: number
  /** 外阴影颜色（模拟 CSS 黑色 text-shadow 外轮廓） */
  shadowColor?: string
  /** 阴影模糊比例：shadowBlur px = badgeWidth × shadowBlurRatio */
  shadowBlurRatio?: number
  /** 阴影 X 偏移比例 */
  shadowOffsetXRatio?: number
  /** 阴影 Y 偏移比例 */
  shadowOffsetYRatio?: number
}

/** 禁用描边时的占位配置 */
export const PACKAGE_TEXT_STROKE_NONE: PackageTextStrokeStyle = { enabled: false }

/**
 * 单字模式：用户只输入 1 个字，或不支持双字时取首字。
 */
export type PackageTextSingleMode = {
  /** 单字在角标内的位置、字号、拉伸 */
  char: PackageTextCharSlot
  /** 单字描边/阴影；血点标关闭，璀璨星河开启 */
  stroke: PackageTextStrokeStyle
}

/**
 * 双字模式：用户输入 2 个字且 `supportsDualChar === true` 时生效。
 * 首字通常偏大靠左上，次字偏小靠右下（与旧站 CSS 一致）。
 */
export type PackageTextDualMode = {
  /** 首字（左上）槽位 */
  first: PackageTextCharSlot
  /** 次字（右下）槽位 */
  second: PackageTextCharSlot
  /**
   * 双字共用描边/阴影；若省略则回退到 `firstStroke` / `secondStroke`。
   * 未配置任一项则双字均不描边。
   */
  stroke?: PackageTextStrokeStyle
  /** 首字独立描边（优先级低于 `stroke`） */
  firstStroke?: PackageTextStrokeStyle
  /** 次字独立描边（优先级低于 `stroke`） */
  secondStroke?: PackageTextStrokeStyle
}

/** 一种自定义文字角标的完整预设（底图 + 字体 + 单/双字排版） */
export type PackageTextBadgePreset = {
  kind: PackageTextBadgeKind
  /** 单字（或不支持双字时）底图 PNG 与文字排版基准尺寸 */
  bg: PackageTextBgAsset
  /** 双字模式专用底图；省略时与 `bg` 共用同一张 */
  dualBg?: PackageTextBgAsset
  /**
   * 底图在角标组内的位置与尺寸；省略时使用 `PACKAGE_TEXT_BG_LAYOUT`（铺满）。
   */
  bgLayout?: PackageTextBgLayout
  /** 字体族名（需在 public/diy/fonts/font.css 注册 webfont，或依赖系统字体） */
  fontFamily: string
  /** 逐字文字填充（纯色 / 渐变二选一） */
  charFill: PackageTextCharFill
  /**
   * 是否支持双字布局。
   * true：输入 2 字时用 `dual`；false：始终只用 `single`（超长取首字）。
   */
  supportsDualChar: boolean
  /** 切换为该文字标时下拉框填充的默认文字 */
  defaultText: string
  /** 用户可输入的最大字数（与 supportsDualChar 配合，通常为 1 或 2） */
  maxLength: number
  /** 底图 kingdomCustom 着色默认 hex（切换为该文字标时写入 renderConfig.items.package.customColor） */
  defaultCustomColor: string
  /** 渐变终点默认 hex（仅 gradient 启用时使用） */
  defaultCustomColorEnd?: string
  /** 文字/描边/底图双色线性渐变；省略则仅使用 customColor 单色 */
  gradient?: PackageTextBadgeGradient
  /** 渐变底图着色参数；省略时使用 package 默认色域 + 默认纹理权重 */
  bgGradientTint?: PackageTextBgGradientTintOptions
  /** 渐变栅格字外阴影 / 暗色外轮廓；仅 charFill 为 gradient 时使用 */
  charRasterShadow?: PackageTextCharRasterShadow
  /** 单字模式排版 */
  single: PackageTextSingleMode
  /** 双字模式排版（仅 supportsDualChar 为 true 时使用） */
  dual: PackageTextDualMode
}

// =============================================================================
// 血点标 (blood_point)
// =============================================================================

/** 底图：`public/diy/shared/package/blood_point.png` */
export const PACKAGE_TEXT_BG_BLOOD_POINT: PackageTextBgAsset = {
  assetFile: 'blood_point.png',
  layoutRefWidthPx: 28,
  layoutRefHeightPx: 28,
}

/** 次字：实色描边，取渐变终点 customColorEnd */
export const BLOOD_POINT_SECOND_CHAR_STROKE: PackageTextStrokeStyle = {
  enabled: true,
  outerStroke: true,
  strokeFromBadgeColor: true,
  strokeFromBadgeColorEnd: true,
  strokeGradientDirect: true,
  strokeWidthRatio: 1.5 / 28,
}

/** 血点标完整预设；排版对照 `sgs-shap-web/src/assets/package.css` 中 `.blood_point` */
export const PACKAGE_TEXT_BADGE_BLOOD_POINT: PackageTextBadgePreset = {
  kind: 'blood_point',
  bg: PACKAGE_TEXT_BG_BLOOD_POINT,
  fontFamily: '方正隶二',
  charFill: { type: 'solid', color: '#FFFFFF' },
  supportsDualChar: true,
  defaultText: '血点',
  maxLength: 2,
  defaultCustomColor: '#9C1708',
  defaultCustomColorEnd: '#E47724',
  gradient: {
    angleDeg: 150,
    startAt: 0.35,
    endAt: 0.65,
  },
  single: {
    char: {
      fontSizeRatio: 16 / 28,
      xRatio: 13.5 / 28,
      yRatio: 6 / 28,
      align: 'center',
      scaleY: 1,
    },
    stroke: PACKAGE_TEXT_STROKE_NONE,
  },
  dual: {
    first: {
      fontSizeRatio: 19 / 28,
      xRatio: 14 / 28,
      yRatio: 5 / 28,
      align: 'center',
      scaleY: 1,
    },
    second: {
      fontSizeRatio: 13 / 28,
      xRatio: 22 / 28,
      yRatio: 16 / 28,
      align: 'center',
      scaleY: 1,
    },
    firstStroke: PACKAGE_TEXT_STROKE_NONE,
    secondStroke: BLOOD_POINT_SECOND_CHAR_STROKE,
  },
}

// =============================================================================
// 十周年圆标 (text_10th)
// =============================================================================

/** 单字底图：`public/diy/shared/package/10th-1.png` */
export const PACKAGE_TEXT_BG_10TH_SINGLE: PackageTextBgAsset = {
  assetFile: '10th-1.png',
  layoutRefWidthPx: 26,
  layoutRefHeightPx: 26,
}

/** 双字底图：`public/diy/shared/package/10th-2.png` */
export const PACKAGE_TEXT_BG_10TH_DUAL: PackageTextBgAsset = {
  assetFile: '10th-2.png',
  layoutRefWidthPx: 28,
  layoutRefHeightPx: 28,
}

/** 文字：轻微硬投影（blur 仅用于柔化阴影，勿过大以免小字发粗发糊） */
export const PACKAGE_TEXT_10TH_CHAR_RASTER_SHADOW: PackageTextCharRasterShadow = {
  color: 'rgba(0, 0, 0, 1)',
  blurRatio: 0.8,
  offsetXRatio: 0,
  offsetYRatio: 0,
  outlineWidthRatio: 0,
}

/** 十周年圆标完整预设；排版对照 `sgs-shap-web/src/assets/package.css` 中 `.text_10th` */
export const PACKAGE_TEXT_BADGE_10TH: PackageTextBadgePreset = {
  kind: 'text_10th',
  bg: PACKAGE_TEXT_BG_10TH_SINGLE,
  dualBg: PACKAGE_TEXT_BG_10TH_DUAL,
  fontFamily: '方正北魏楷书简体',
  charFill: {
    type: 'gradient',
    startHex: '#FFFFFF',
    endHex: '#eff1c8',
    angleDeg: 180,
    startAt: 0.4,
    endAt: 0.5,
  },
  supportsDualChar: true,
  defaultText: '天府',
  maxLength: 2,
  defaultCustomColor: '#6F117B',
  defaultCustomColorEnd: '#115B7B',
  gradient: {
    angleDeg: 150,
    startAt: 0.4,
    endAt: 0.7,
  },
  bgGradientTint: {
    lightnessTexture: 0.68,
    gamut: {
      baseSatFactor: 0.36,
      textureSatWeight: 0.96,
      maxOutSaturation: 0.98,
      originalMix: 0.06,
    },
  },
  charRasterShadow: PACKAGE_TEXT_10TH_CHAR_RASTER_SHADOW,
  single: {
    char: {
      fontSizeRatio: 15.6 / 26,
      xRatio: 14 / 28,
      yRatio: 6.6 / 28,
      align: 'center',
    },
    stroke: PACKAGE_TEXT_STROKE_NONE,
  },
  dual: {
    first: {
      fontSizeRatio: 15.6 / 28,
      xRatio: 12.5 / 28,
      yRatio: 5.2 / 28,
      align: 'center',
    },
    second: {
      fontSizeRatio: 9 / 28,
      xRatio: 21.5 / 28,
      yRatio: 17.5 / 28,
      align: 'center',
      syntheticBold: true,
      syntheticBoldWidthRatio: 0.03,
    },
    firstStroke: PACKAGE_TEXT_STROKE_NONE,
    secondStroke: PACKAGE_TEXT_STROKE_NONE,
  },
}

// =============================================================================
// 璀璨星河 (text_ccxh)
// =============================================================================

/** 底图：`public/diy/shared/package/ccxh.png` */
export const PACKAGE_TEXT_BG_CCXH: PackageTextBgAsset = {
  assetFile: 'ccxh.png',
  layoutRefWidthPx: 30,
  layoutRefHeightPx: 30,
}

/** 文字描边 */
const CCXH_TEXT_STROKE: PackageTextStrokeStyle = {
  enabled: true,
  outerStroke: true,
  strokeFromBadgeColor: true,
  strokeLightnessDelta: -0.4,
  strokeSaturationDelta: 0.14,
  strokeWidthRatio: 2 / 30,
}

/** 璀璨星河完整预设；排版对照 `sgs-shap-web/src/assets/package.css` 中 `.text_ccxh` */
export const PACKAGE_TEXT_BADGE_CCXH: PackageTextBadgePreset = {
  kind: 'text_ccxh',
  bg: PACKAGE_TEXT_BG_CCXH,
  fontFamily: '方正隶变',
  charFill: { type: 'solid', color: '#FFFFFF' },
  supportsDualChar: true,
  defaultText: '星',
  maxLength: 2,
  defaultCustomColor: '#3A8FD9',
  single: {
    char: {
      fontSizeRatio: 14 / 30,
      xRatio: 0.5,
      yRatio: 0.28,
      align: 'center',
      scaleX: 1.02,
    },
    stroke: CCXH_TEXT_STROKE,
  },
  dual: {
    first: {
      fontSizeRatio: 18 / 30,
      xRatio: 12 / 30,
      yRatio: 4 / 30,
      align: 'center',
    },
    second: {
      fontSizeRatio: 10 / 30,
      xRatio: 20 / 30,
      yRatio: 16 / 30,
      align: 'center',
    },
    stroke: CCXH_TEXT_STROKE,
  },
}

// =============================================================================
// 预设表与解析工具
// =============================================================================

/**
 * 自定义文字角标预设表。
 * 修改排版时优先对照 `sgs-shap-web/src/assets/package.css` 中对应 class。
 */
export const PACKAGE_TEXT_BADGE_PRESETS: Record<PackageTextBadgeKind, PackageTextBadgePreset> = {
  blood_point: PACKAGE_TEXT_BADGE_BLOOD_POINT,
  text_10th: PACKAGE_TEXT_BADGE_10TH,
  text_ccxh: PACKAGE_TEXT_BADGE_CCXH,
}

/** 解析双字模式下某个字的描边配置（逐字独立 → 共用 → 无） */
export const resolvePackageTextDualStroke = (
  dual: PackageTextDualMode,
  role: 'first' | 'second',
): PackageTextStrokeStyle | undefined => {
  const roleStroke = role === 'first' ? dual.firstStroke : dual.secondStroke
  if (roleStroke !== undefined) {
    return roleStroke.enabled ? roleStroke : undefined
  }
  if (dual.stroke?.enabled) return dual.stroke
  return undefined
}

/** 是否为自定义文字角标种类 */
export const isPackageTextBadgeKind = (name: string): name is PackageTextBadgeKind =>
  name in PACKAGE_TEXT_BADGE_PRESETS

/** 当前展示文字是否走双字布局 */
export const isPackageTextBadgeDualLayout = (preset: PackageTextBadgePreset, displayText: string) =>
  preset.supportsDualChar && [...displayText].length >= 2

/** 按单/双字解析应加载的底图资源 */
export const resolvePackageTextBadgeBgAsset = (
  preset: PackageTextBadgePreset,
  displayText: string,
): PackageTextBgAsset => {
  if (isPackageTextBadgeDualLayout(preset, displayText) && preset.dualBg) {
    return preset.dualBg
  }
  return preset.bg
}

/** 读取文字角标预设的默认文字与字数上限 */
export const resolvePackageTextBadgeTextDefaults = (kind: PackageTextBadgeKind) => {
  const preset = PACKAGE_TEXT_BADGE_PRESETS[kind]
  return {
    defaultText: preset.defaultText,
    maxLength: preset.maxLength,
  }
}

/** 读取文字角标预设的底图默认着色 hex */
export const resolvePackageTextBadgeDefaultColor = (kind: PackageTextBadgeKind) =>
  PACKAGE_TEXT_BADGE_PRESETS[kind].defaultCustomColor

/** 读取文字角标预设的渐变终点默认 hex */
export const resolvePackageTextBadgeDefaultColorEnd = (kind: PackageTextBadgeKind) => {
  const preset = PACKAGE_TEXT_BADGE_PRESETS[kind]
  return preset.defaultCustomColorEnd ?? preset.defaultCustomColor
}

/** 该文字角标是否启用双色线性渐变 */
export const isPackageTextBadgeGradientEnabled = (kind: PackageTextBadgeKind) =>
  Boolean(PACKAGE_TEXT_BADGE_PRESETS[kind].gradient)

/** 读取文字角标渐变配置 */
export const resolvePackageTextBadgeGradient = (kind: PackageTextBadgeKind) =>
  PACKAGE_TEXT_BADGE_PRESETS[kind].gradient
