import { BOTTOM_INFO_FONT_FAMILY } from './bottomInfo'

/** @By / 品牌（英文） */
export const WATERMARK_BY_FONT_FAMILY = 'SourceSans3-Medium'
export const WATERMARK_BY_TEXT = '@By'

/** 品牌名 */
export const WATERMARK_BRAND_FONT_FAMILY = 'SourceSans3-Medium'
/** 副标题（网页版） */
export const WATERMARK_SUBTITLE_FONT_FAMILY = '方正兰亭黑'
/** 标签列（与内容同黑体，保证中文笔画清晰） */
export const WATERMARK_LABEL_FONT_FAMILY = BOTTOM_INFO_FONT_FAMILY
/** 内容列 */
export const WATERMARK_VALUE_FONT_FAMILY = BOTTOM_INFO_FONT_FAMILY

/** 水印图层实际用到的 Web 字体族（@By/品牌同族、标签/内容同族，已去重） */
export const WATERMARK_WEB_FONT_FAMILIES = [
  WATERMARK_BY_FONT_FAMILY,
  WATERMARK_SUBTITLE_FONT_FAMILY,
  WATERMARK_LABEL_FONT_FAMILY,
] as const

/** 水印基准字号（pt） */
export const WATERMARK_FONT_SIZE_PT = 6.2

/** 分隔圆点 */
export const WATERMARK_DOT_TEXT = '·'

/** @By 字号比例（与品牌行同级，保证 @ 符号可读） */
export const WATERMARK_BY_SIZE_RATIO = 1.04
/** 品牌行字号比例 */
export const WATERMARK_BRAND_SIZE_RATIO = 1.08
/** 圆点字号比例 */
export const WATERMARK_DOT_SIZE_RATIO = 0.76
/** 副标题字号比例 */
export const WATERMARK_SUBTITLE_SIZE_RATIO = 0.9
/** 标签字号比例（inline 行内，略小于内容） */
export const WATERMARK_LABEL_SIZE_RATIO = 0.96
/** 内容字号比例 */
export const WATERMARK_VALUE_SIZE_RATIO = 1

/** 行距 */
export const WATERMARK_LINE_HEIGHT = 1.34

/** 行间距（相对基准字号 px） */
export const WATERMARK_ROW_GAP_RATIO = 0.3
export const WATERMARK_SEGMENT_GAP_RATIO = 0.36
export const WATERMARK_META_DOT_SIZE_RATIO = 0.68

/** 字距（pt） */
export const WATERMARK_BY_LETTER_SPACING_PT = 0.12
export const WATERMARK_BRAND_LETTER_SPACING_PT = 0.22
export const WATERMARK_DOT_LETTER_SPACING_PT = 0
export const WATERMARK_SUBTITLE_LETTER_SPACING_PT = 0.08
export const WATERMARK_LABEL_LETTER_SPACING_PT = 0.02
export const WATERMARK_VALUE_LETTER_SPACING_PT = 0.02

/** 透明度 */
export const WATERMARK_BODY_OPACITY = 0.96
export const WATERMARK_BY_OPACITY = 0.96
export const WATERMARK_DOT_OPACITY = 0.68
export const WATERMARK_SUBTITLE_OPACITY = 0.86
export const WATERMARK_LABEL_OPACITY = 0.94

/** 前景渐变（自上而下，三段） */
export const WATERMARK_GRADIENT_TOP = 'rgba(255, 255, 255, 1)'
export const WATERMARK_GRADIENT_MID = 'rgba(253, 250, 245, 0.96)'
export const WATERMARK_GRADIENT_MID_STOP = 0.42
export const WATERMARK_GRADIENT_BOTTOM = 'rgba(248, 243, 236, 0.92)'

/** 轻投影（压印感） */
export const WATERMARK_SHADOW_COLOR = 'rgba(0, 0, 0, 0.45)'
export const WATERMARK_SHADOW_BLUR_PX = 2.5
export const WATERMARK_SHADOW_OFFSET_X_PX = 0.35
export const WATERMARK_SHADOW_OFFSET_Y_PX = 0.65

/** 光晕描边（底层，提升深浅背景可读性；独立于前景渐变） */
export const WATERMARK_HALO_FILL = '#0A0909'
export const WATERMARK_HALO_STROKE_WIDTH_PX = 0.72
export const WATERMARK_HALO_OPACITY = 0.82

/** 极淡底衬（提升可读，非卡片底板） */
export const WATERMARK_SCRIM_FILL = 'rgba(6, 6, 6, 0.12)'
export const WATERMARK_SCRIM_PAD_RATIO = 0.42
export const WATERMARK_SCRIM_RADIUS_PX = 2

/** 品牌行下细分隔线（左实右虚） */
export const WATERMARK_DIVIDER_GRADIENT_START = 'rgba(255, 255, 255, 0.42)'
export const WATERMARK_DIVIDER_GRADIENT_MID = 'rgba(255, 255, 255, 0.16)'
export const WATERMARK_DIVIDER_GRADIENT_END = 'rgba(255, 255, 255, 0)'
export const WATERMARK_DIVIDER_HEIGHT_RATIO = 0.055
export const WATERMARK_DIVIDER_GAP_RATIO = 0.28

/** 水印默认倾斜（°，正值：左上 → 右下） */
export const WATERMARK_ROTATION_DEG = 14

/** 子节点 code */
export const WATERMARK_HIT_CODE = 'watermark_hit'
export const WATERMARK_DIVIDER_CODE = 'watermark_divider'
export const WATERMARK_SCRIM_CODE = 'watermark_scrim'

/** 水印默认位置（mm，相对成品区左上） */
export const WATERMARK_ORIGIN_X_MM = 18
export const WATERMARK_ORIGIN_Y_MM = 43

/** 模板作者行标签文案 */
export const WATERMARK_TEMPLATE_LABEL = '模板'
