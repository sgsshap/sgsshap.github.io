/**
 * 体力取色器：六势力官方色（魏蜀吴群晋神）
 *
 * 图片模式：当所选颜色与「当前势力体力素材」对应项一致时，不再叠 Konva 着色滤镜，直接显示原 PNG。
 * 跨势力改色或自定义 hex 时仍用魏底图 + hp 色域着色。
 */
export const CUSTOM_HP_OFFICIAL_COLOR_PRESETS = [
  /** 冰蓝魏体力（对齐 assets/hp/normal/full/wei.png 主色相，用于匹配原图时跳过着色） */
  { key: 'wei', label: '魏', color: '#2783AE' },
  { key: 'shu', label: '蜀', color: '#EA5B1E' },
  { key: 'wu', label: '吴', color: '#C4ED7A' },
  { key: 'qun', label: '群', color: '#E0E0E0' },
  { key: 'jin', label: '晋', color: '#CCA7CC' },
  { key: 'shen', label: '神', color: '#FFF600' },
] as const

export type OfficialHpColorPresetKey = (typeof CUSTOM_HP_OFFICIAL_COLOR_PRESETS)[number]['key']

/** `n-color-picker` 底部预设色块（魏 → 神） */
export const CUSTOM_HP_COLOR_SWATCHES = CUSTOM_HP_OFFICIAL_COLOR_PRESETS.map((item) => item.color)

/** 开启自定义体力颜色时的默认 hex（单势力 / 双势力势力1 full tier） */
export const DEFAULT_CUSTOM_HP_COLOR = CUSTOM_HP_OFFICIAL_COLOR_PRESETS[0].color

/** 双势力自定义体力色：势力2（half tier） */
export const DEFAULT_CUSTOM_HP_COLOR_SECONDARY = '#e8c547'
