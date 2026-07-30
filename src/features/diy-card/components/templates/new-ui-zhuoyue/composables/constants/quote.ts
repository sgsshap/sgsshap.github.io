/** 引言字体（纵向 105%、倾斜 15°） */
export const QUOTE_FONT_FAMILY = '方正书宋'
export const QUOTE_FILL_COLOR = '#000000'
export const QUOTE_LINE_HEIGHT = 1.2
export const QUOTE_SCALE_Y = 1.05
/** 水平倾斜角度（°）→ Konva skewX 用 tan(θ) */
export const QUOTE_SKEW_DEG = 15
export const QUOTE_SKEW_X = Math.tan((QUOTE_SKEW_DEG * Math.PI) / 180)
/** 引言描边（em，0 为不描边；旧版 .quote 无 text-stroke） */
export const QUOTE_STROKE_EM = 0.01
/** 引言描边色（QUOTE_STROKE_EM > 0 时生效） */
export const QUOTE_STROKE_COLOR = '#000000'
/** 引言描边最小宽度（px，与字号比例取较大值） */
export const QUOTE_STROKE_MIN_PX = 0.1
/** 引言字间距 */
export const QUOTE_DEFAULT_TRACKING = -25

/** 引言倾斜（15°）时右边距额外补偿（mm） */
export const QUOTE_MARGIN_RIGHT_SKEW_EXTRA_MM = 0.2
/** 引言边距默认值（mm；在技能描述四边距内盒基础上再内缩） */
export const QUOTE_DEFAULT_MARGIN_TOP_MM = 0.76
export const QUOTE_DEFAULT_MARGIN_BOTTOM_MM = 0
export const QUOTE_DEFAULT_MARGIN_LEFT_MM = 0
export const QUOTE_DEFAULT_MARGIN_RIGHT_MM = 0.76
