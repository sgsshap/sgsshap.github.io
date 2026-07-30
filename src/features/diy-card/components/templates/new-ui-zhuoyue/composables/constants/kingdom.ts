/**
 * 双势力展示顺序（左→右，索引越小优先级越高）
 * 与边框左右叠层、势力字拼接顺序一致
 */
export const KINGDOM_DISPLAY_ORDER = ['qun', 'shu', 'wu', 'wei', 'jin'] as const

/** 单势力双字 kingdom 组内透明命中区 code（与 name 拆分 hit 层同理） */
export const KINGDOM_DUAL_CHAR_HIT_CODE = 'kingdom-hit'

/** 各势力标识在画布上的位置（mm）与显示宽度 */
export const KINGDOMS_POSITION_INFO = {
  wei: { x: 1.76, y: 0.95, width: 70 },
  shu: { x: 2.85, y: 1.5, width: 72 },
  wu: { x: 2.04, y: 1.36, width: 76 },
  qun: { x: 2.44, y: 1.5, width: 68 },
  jin: { x: 2.04, y: 1.76, width: 70 },
  shen: { x: 2.54, y: 1.28, width: 75 },
} as const

/** 双势力字素材 key（魏蜀吴群晋） */
type DoubleKingdomAssetKey = 'wei' | 'shu' | 'wu' | 'qun' | 'jin'

/** 自定义势力字布局 key（拖拽持久化 track 用） */
export const CUSTOM_KINGDOM_LAYOUT_KEY = 'custom' as const

type KingdomLayoutAssetKey = DoubleKingdomAssetKey | typeof CUSTOM_KINGDOM_LAYOUT_KEY

/** 双势力字槽位：第一势力为上，第二势力为下 */
export type DoubleKingdomGlyphSlot = 'top' | 'bottom'

/** 双势力字布局项（mm，相对画布内容区原点） */
export type DoubleKingdomGlyphLayoutEntry = {
  x: number
  y: number
  /** 相对统一默认宽度的缩放（1 = DOUBLE_KINGDOM_GLYPH_DEFAULT_WIDTH_PX） */
  scale: number
}

/** 双势力字统一默认显示宽度（px）；高度按素材宽高比推算 */
export const DOUBLE_KINGDOM_GLYPH_DEFAULT_WIDTH_PX = 45

/** 未在布局表中的势力沿用上/下槽位默认坐标 */
export const DOUBLE_KINGDOM_GLYPH_LAYOUT_FALLBACK: Record<
  DoubleKingdomGlyphSlot,
  DoubleKingdomGlyphLayoutEntry
> = {
  top: { x: 2.5, y: 1.5, scale: 1 },
  bottom: { x: 2.5, y: 4.0, scale: 1 },
}

/**
 * 双势力字布局（魏蜀吴群晋 × 上/下槽位；其余势力走 FALLBACK）
 * 坐标单位 mm，原点 = 画布内容区左上角
 */
export const DOUBLE_KINGDOM_GLYPH_LAYOUT: Partial<
  Record<KingdomLayoutAssetKey, Record<DoubleKingdomGlyphSlot, DoubleKingdomGlyphLayoutEntry>>
> = {
  qun: {
    top: { x: 2.08, y: 2.29, scale: 0.9 },
    bottom: { x: 5.63, y: 4.8, scale: 0.9 },
  },
  wei: {
    top: { x: 1.26, y: 1.55, scale: 1 },
    bottom: { x: 4.95, y: 4.24, scale: 1 },
  },
  shu: {
    top: { x: 2.23, y: 1.8, scale: 1.06 },
    bottom: { x: 6.1, y: 4.06, scale: 1.06 },
  },
  wu: {
    top: { x: 1.76, y: 1.62, scale: 1 },
    bottom: { x: 5.5, y: 4.9, scale: 1 },
  },
  jin: {
    top: { x: 2.04, y: 1.46, scale: 1 },
    bottom: { x: 5.36, y: 4.64, scale: 1 },
  },
}

/** 自定义势力布局默认值（字号 / 位置 / 间距） */
export const CUSTOM_KINGDOM_LAYOUT = {
  /** 单字默认字号 */
  singleFontSizePt: 21,
  /** 单字默认位置（mm，相对画布内容区） */
  singleTextMm: { x: 2.6, y: 2.6 },
  /** 双字 / 双势力自定义字默认字号 */
  dualFontSizePt: 14,
  /** 双字第一字默认位置（mm，相对画布内容区） */
  dualCharTopMm: { x: 2.4, y: 2.8 },
  /** 双字第二字相对第一字的默认水平间距（mm） */
  dualCharSpacingMm: 3.6,
  /** 双字垂直间距 = 水平间距 × 该比例 */
  dualCharSpacingYRatio: 3 / 4,
} as const

/** 普通框：自上而下浅→深停靠 */
export type KingdomGlyphToneStop = {
  position: number
  lightness?: number
  satMul?: number
  useDarkestTone?: boolean
}

/** 神框：提亮 / 原明度条带停靠 */
export type KingdomGlyphBrightenStop = {
  position: number
  brighten: boolean
}

/** 主公势力字：固定 hex 停靠（不随基准色推导） */
export type KingdomGlyphFixedColorStop = {
  position: number
  color: string
}

export const CUSTOM_KINGDOM_GLYPH_END_TILT_X_RATIO = 0.1

/** 自定义势力字文本：略加大水平分量，拉长渐变轴（须保持竖向为主，避免居中字全落高亮区） */
export const CUSTOM_KINGDOM_GLYPH_TEXT_END_TILT_X_RATIO = 0.36

/** 预设 PNG 叠色 / 图片滤镜用渐变停靠 */
export const CUSTOM_KINGDOM_GLYPH_FILL_STOPS: readonly KingdomGlyphToneStop[] = [
  { position: 0, lightness: 0.97, satMul: 0.14 },
  { position: 0.3, lightness: 0.94, satMul: 0.28 },
  { position: 0.58, lightness: 0.91, satMul: 0.42 },
  { position: 0.84, lightness: 0, satMul: 0, useDarkestTone: true },
  { position: 1, lightness: 0, satMul: 0, useDarkestTone: true },
]

/** 自定义势力字文本填充：停靠略拉开（仍与竖向渐变轴匹配） */
export const CUSTOM_KINGDOM_GLYPH_TEXT_FILL_STOPS: readonly KingdomGlyphToneStop[] = [
  { position: 0, lightness: 0.97, satMul: 0.11 },
  { position: 0.2, lightness: 0.94, satMul: 0.22 },
  { position: 0.5, lightness: 0.91, satMul: 0.34 },
  { position: 0.95, lightness: 0.9, satMul: 0.2, useDarkestTone: true },
  { position: 1, lightness: 0.9, satMul: 0.2, useDarkestTone: true },
]

/** 主公势力字渐变：深色 / 浅色 */
export const MASTER_KINGDOM_GLYPH_DARK_HEX = '#c3ae54'
export const MASTER_KINGDOM_GLYPH_LIGHT_HEX = '#ececce'

/** 主公 + 自定义势力字 / 扩展预设：沿轴深浅深浅深（左上→右下） */
export const MASTER_KINGDOM_GLYPH_FILL_STOPS: readonly KingdomGlyphFixedColorStop[] = [
  { position: 0, color: MASTER_KINGDOM_GLYPH_DARK_HEX },
  { position: 0.38, color: MASTER_KINGDOM_GLYPH_LIGHT_HEX },
  { position: 0.5, color: MASTER_KINGDOM_GLYPH_DARK_HEX },
  { position: 0.68, color: MASTER_KINGDOM_GLYPH_LIGHT_HEX },
  { position: 1, color: MASTER_KINGDOM_GLYPH_DARK_HEX },
]

/** 神框：沿轴 brighten 交替（高亮=自定义色+提亮，否则=原明度） */
export const CUSTOM_SHEN_KINGDOM_GLYPH_BRIGHTEN_STOPS: readonly KingdomGlyphBrightenStop[] = [
  { position: 0, brighten: true },
  { position: 0.3, brighten: false },
  { position: 0.4, brighten: true },
  { position: 0.46, brighten: false },
  { position: 0.53, brighten: true },
  { position: 0.74, brighten: false },
]

/** 神框自定义势力字文本：条带沿轴拉长至字框底部 */
export const CUSTOM_SHEN_KINGDOM_GLYPH_TEXT_BRIGHTEN_STOPS: readonly KingdomGlyphBrightenStop[] = [
  { position: 0, brighten: true },
  { position: 0.38, brighten: false },
  { position: 0.52, brighten: true },
  { position: 0.62, brighten: false },
  { position: 0.72, brighten: true },
  { position: 0.92, brighten: false },
]

/** 自定义势力字可选字体（与 public/diy/fonts/font.css 一致） */
export const KINGDOM_CUSTOM_FONT_BY_ID = {
  1: '汉仪尚巍手书',
  2: '汉仪秦川飞影',
} as const

export type KingdomCustomFontId = keyof typeof KINGDOM_CUSTOM_FONT_BY_ID

/** 势力预设字在画布上的位置（mm）与显示宽度 */
export type KingdomGlyphPositionMm = {
  x: number
  y: number
  width: number
}

export const CUSTOM_SHEN_KINGDOM_LAYOUT = {
  /** 自定义势力 · 单字默认字号 */
  singleFontSizePt: 25,
  /** 自定义势力 · 单字默认位置（mm） */
  singleTextMm: { x: 3.38, y: 3.4 },
  /** 自定义势力 · 双字 / 双势力默认字号 */
  dualFontSizePt: 18,
  /** 自定义势力 · 双字第一字默认位置（mm） */
  dualCharTopMm: { x: 2.19, y: 3.24 },
  /** 自定义势力 · 双字第二字相对第一字的默认水平间距（mm） */
  dualCharSpacingMm: 4.6,
  /** 双字垂直间距 = 水平间距 × 该比例 */
  dualCharSpacingYRatio: 3 / 4,
  /**
   * 神框内各势力预设 PNG 字（魏蜀吴群晋神）默认位置与宽度（mm）
   * 与普通框 `KINGDOMS_POSITION_INFO` 分开，便于按神框单独微调
   */
  presetGlyph: {
    wei: { x: 1.9, y: 1.48, width: 80 },
    shu: { x: 3.6, y: 2.32, width: 82 },
    wu: { x: 2.38, y: 2.32, width: 84 },
    qun: { x: 2.96, y: 2.86, width: 76 },
    jin: { x: 2.5, y: 2.59, width: 80 },
    shen: { x: 2.54, y: 1.28, width: 75 },
  },
} as const

export type CustomKingdomTextMode = 'single' | 'dual'
