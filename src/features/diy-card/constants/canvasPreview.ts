/** 导出圆角白边：成品外侧留白宽度（mm），仅用于 exportCanvas 合成 */
export const WHITE_BORDER_PREVIEW_MM = 3

/** 画布圆角白边预览：卡牌圆角（mm） */
export const WHITE_BORDER_CORNER_MM = 3

/** 圆角白边：第一层阴影右下 X 偏移（mm） */
export const WHITE_BORDER_SHADOW_OFFSET_X_MM = 0.8

/** 圆角白边：第一层阴影右下 Y 偏移（mm） */
export const WHITE_BORDER_SHADOW_OFFSET_Y_MM = 0.7

/** 圆角白边：第一层阴影模糊（mm） */
export const WHITE_BORDER_SHADOW_BLUR_MM = 0.5

/** 圆角白边：第一层阴影透明度 */
export const WHITE_BORDER_SHADOW_ALPHA = 0.6

/** 圆角白边：第二层无偏移柔光阴影模糊（mm） */
export const WHITE_BORDER_AMBIENT_SHADOW_BLUR_MM = 1.2

/** 圆角白边：第二层无偏移柔光阴影透明度 */
export const WHITE_BORDER_AMBIENT_SHADOW_ALPHA = 0.4

/** 预览用双层 box-shadow（模拟导出圆角白边的卡片阴影） */
export const buildWhiteBorderCardBoxShadow = (mmToPx: number) => {
  const offsetX = WHITE_BORDER_SHADOW_OFFSET_X_MM * mmToPx
  const offsetY = WHITE_BORDER_SHADOW_OFFSET_Y_MM * mmToPx
  const blur = WHITE_BORDER_SHADOW_BLUR_MM * mmToPx
  const ambientBlur = WHITE_BORDER_AMBIENT_SHADOW_BLUR_MM * mmToPx
  return `${offsetX}px ${offsetY}px ${blur}px rgba(0, 0, 0, ${WHITE_BORDER_SHADOW_ALPHA}), 0 0 ${ambientBlur}px rgba(0, 0, 0, ${WHITE_BORDER_AMBIENT_SHADOW_ALPHA})`
}
