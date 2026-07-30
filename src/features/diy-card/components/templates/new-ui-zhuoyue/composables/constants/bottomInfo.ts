/** 正文、键值、空格：方正黑体 */
export const BOTTOM_INFO_FONT_FAMILY = '方正黑体'
/** 版权栏出版社名（如：游卡桌游） */
export const BOTTOM_INFO_PUBLISHER_FONT_FAMILY = '方正兰亭黑'
/** 年份数字（© 后四位年份段） */
export const BOTTOM_INFO_YEAR_FONT_FAMILY = 'SourceSans3-Medium'
/** ™&©、键名 */
export const BOTTOM_INFO_ID_FONT_FAMILY = 'Arial_EN'

/** 底栏区域总高度（mm，紧贴分隔线下方，普通势力） */
export const BOTTOM_INFO_HEIGHT_MM = 3.8
/** 底栏区域总高度（神势力；老站 41px / 普通 33px 换算） */
export const BOTTOM_INFO_HEIGHT_SHEN_MM = 5.86
/** 底栏内：分隔线与底栏文字顶缘的间距（mm，不改变分隔线位置） */
export const BOTTOM_INFO_GAP_BELOW_LINE_MM = 0.44
/** 版权栏整行相对底栏区域顶部的纵向微调（mm，负值上移） */
export const BOTTOM_INFO_COPYRIGHT_ROW_Y_OFFSET_MM = -0.1
/** 底栏左右边距安全区（用户边距在此基础上叠加，普通势力，mm） */
export const BOTTOM_INFO_MARGIN_SAFE_LEFT_MM = 14.47
export const BOTTOM_INFO_MARGIN_SAFE_RIGHT_MM = 4.35
/** 底栏左右边距安全区（神势力，mm） */
export const BOTTOM_INFO_MARGIN_SAFE_LEFT_SHEN_MM = 14.57
export const BOTTOM_INFO_MARGIN_SAFE_RIGHT_SHEN_MM = 5.5
/** 底栏内：默认边距（mm） */
export const BOTTOM_INFO_DEFAULT_MARGIN_LEFT_MM = 0
export const BOTTOM_INFO_DEFAULT_MARGIN_RIGHT_MM = 5
/** 空格（正文字号；方正黑体；无描边） */
export const BOTTOM_INFO_COPYRIGHT_SPACE_SIZE_PT = 3.5
/** `.`、`:` 等标点 */
export const BOTTOM_INFO_COPYRIGHT_BODY_SIZE_PT = 3.5
/** 游卡桌游相对版权行的视觉微调（mm，负值上移） */
export const BOTTOM_INFO_COPYRIGHT_PUBLISHER_Y_OFFSET_MM = 0.01
/** 神 UI 黑描边底栏：游卡桌游专用字库需额外上移（mm） */
export const BOTTOM_INFO_COPYRIGHT_PUBLISHER_Y_OFFSET_STROKE_MM = 0.04
/** 游卡桌游字号 */
export const BOTTOM_INFO_COPYRIGHT_PUBLISHER_SIZE_PT = 3.9
/** ™&© */
export const BOTTOM_INFO_COPYRIGHT_SYMBOL_SIZE_PT = 3.5
/** 年份，如 2026 */
export const BOTTOM_INFO_COPYRIGHT_YEAR_SIZE_PT = 4.4
/** 神 UI 版权栏年份字号（pt；略小于普通年份，视觉更细） */
export const BOTTOM_INFO_COPYRIGHT_YEAR_SIZE_SHEN_PT = 4.4
/** 年份相对版权行的视觉微调（mm，正值下移） */
export const BOTTOM_INFO_COPYRIGHT_YEAR_Y_OFFSET_MM = 0.02
/** 神 UI 版权栏年份纵向微调（mm，正值下移） */
export const BOTTOM_INFO_COPYRIGHT_YEAR_Y_OFFSET_SHEN_MM = 0.02
/** 年份字距（pt，负值收紧） */
export const BOTTOM_INFO_COPYRIGHT_YEAR_LETTER_SPACING_PT = -0.18
/** 版权栏键名，如 Illustration */
export const BOTTOM_INFO_COPYRIGHT_KEY_SIZE_PT = 3.6
/** 版权栏键名相对版权行的视觉微调（mm，正值下移） */
export const BOTTOM_INFO_COPYRIGHT_KEY_Y_OFFSET_MM = 0
/** 神 UI 版权栏键名纵向微调（mm，正值下移） */
export const BOTTOM_INFO_COPYRIGHT_KEY_Y_OFFSET_SHEN_MM = 0
/** 版权栏键值 */
export const BOTTOM_INFO_COPYRIGHT_VALUE_SIZE_PT = 3.5
/** 版权栏键值（如 Illustration 后画师名）相对版权行的视觉微调（mm，正值下移） */
export const BOTTOM_INFO_COPYRIGHT_VALUE_Y_OFFSET_MM = 0
/** 神 UI 版权栏键值纵向微调（mm，正值下移） */
export const BOTTOM_INFO_COPYRIGHT_VALUE_Y_OFFSET_SHEN_MM = 0
/** 武将编号 */
export const BOTTOM_INFO_LEGEND_ID_SIZE_PT = 3.5
/** 武将编号相对底栏区域顶部的基准间距（mm） */
export const BOTTOM_INFO_LEGEND_ID_Y_MM = 0.15
/** 武将编号纵向微调（mm，正值下移；独立于版权行 offset） */
export const BOTTOM_INFO_LEGEND_ID_Y_OFFSET_MM = 0
/** 神 UI 武将编号额外纵向微调（mm） */
export const BOTTOM_INFO_LEGEND_ID_Y_OFFSET_SHEN_MM = 0.13

/** ™&© */
export const BOTTOM_INFO_COPYRIGHT_SYMBOL_LETTER_SPACING_PT = 0.1
/** `.{key}: ` 段（含 `.`、`:`） */
export const BOTTOM_INFO_COPYRIGHT_KEY_LETTER_SPACING_PT = 0.15
/** 武将编号 */
export const BOTTOM_INFO_LEGEND_ID_LETTER_SPACING_PT = 0.1

// =============================================================================
// 底栏描边粗细（px）
// =============================================================================

/**
 * 普通势力同色细描边（对应旧站 `bottom-info-text__shadow`：`0.004em currentColor`）。
 * 用于版权正文、键值、武将编号等；不随字号缩放。
 */
export const BOTTOM_INFO_FOREGROUND_STROKE_WIDTH_PX = 0.18

/**
 * 神 UI / 全幅底栏同色描边（前景白字层；可与普通势力分开微调）。
 * 默认同 {@link BOTTOM_INFO_FOREGROUND_STROKE_WIDTH_PX}。
 */
export const BOTTOM_INFO_FOREGROUND_STROKE_WIDTH_SHEN_PX = 0.1

/**
 * 版权栏年份数字同色描边（对应旧站 `copyright_year__shadow`：`0 0 0.4px currentColor`）。
 * 仅 `kind === 'year'` 且未开启黑色外描边时使用。
 */
export const BOTTOM_INFO_COPYRIGHT_YEAR_STROKE_WIDTH_PX = 0.24

/** 武将编号同色描边 */
export const BOTTOM_INFO_LEGEND_ID_STROKE_WIDTH_PX = 0.1

/**
 * 神 UI / 全幅「底部描边」黑色外描边底层宽（对应旧站 `bottom-info-text__shadow2` 黑边）。
 * 大于 0 且开启 `strokeFlag` 时，版权栏全部文字（含游卡桌游）与武将编号统一叠加此黑边；空格段除外。
 */
export const BOTTOM_INFO_BLACK_STROKE_WIDTH_PX = 1.2

/**
 * 神 UI 版权栏年份段黑色外描边宽（px）。
 * SourceSans 数字笔画较细，与同宽黑边的中文字形视觉不一致，故单独加粗。
 */
export const BOTTOM_INFO_BLACK_STROKE_WIDTH_YEAR_PX = 1.8
