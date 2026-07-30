/**
 * 势力字取色器：六势力官方色（魏蜀吴群晋神）
 *
 * 图片模式：当所选颜色与「当前势力素材」对应项一致时，不再叠 Konva 着色滤镜，直接显示原 PNG（保留发光/渐变）。
 * 跨势力改色或自定义 hex 时仍走 kingdomFrameTint。
 */
export const CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS = [
  { key: 'wei', label: '魏', color: '#6CA7D2' },
  { key: 'shu', label: '蜀', color: '#C27B33' },
  { key: 'wu', label: '吴', color: '#6C9B51' },
  { key: 'qun', label: '群', color: '#878787' },
  { key: 'jin', label: '晋', color: '#571E71' },
  { key: 'shen', label: '神', color: '#A8A8A8' },
] as const

/** 神势力字官方色（神框自动开启势力字变色时使用） */
export const SHEN_KINGDOM_GLYPH_OFFICIAL_COLOR =
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS.find((item) => item.key === 'shen')!.color

/** 用户选灰时势力字图片着色参考（群字官方银灰，保留发光/明暗纹理） */
export const KINGDOM_GLYPH_GRAY_TINT_REFERENCE_HEX =
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS.find((item) => item.key === 'qun')!.color

export type OfficialKingdomGlyphColorPresetKey =
  (typeof CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS)[number]['key']

/** `n-color-picker` 底部预设色块（魏 → 神） */
export const CUSTOM_KINGDOM_GLYPH_COLOR_SWATCHES =
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS.map((item) => item.color)

/** 开启势力字单独变色时的默认 hex（魏） */
export const DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR =
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS[0].color

/** 双势力势力字单独变色：势力2（右）默认 hex（蜀） */
export const DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR_SECONDARY =
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS[1].color
