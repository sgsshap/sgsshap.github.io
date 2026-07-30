import { TITLE_COLORS } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/title'

/**
 * 称号取色器：六势力官方称号色（神 / 魏 / 蜀 / 吴 / 群 / 晋）
 *
 * 与体力 CUSTOM_HP_OFFICIAL_COLOR_PRESETS 独立，数值对齐 TITLE_COLORS 默认称号填色。
 */
export const CUSTOM_TITLE_OFFICIAL_COLOR_PRESETS = [
  { key: 'shen', label: '神', color: TITLE_COLORS[0] ?? '#FFFF48' },
  { key: 'wei', label: '魏', color: TITLE_COLORS[1] ?? '#4D6993' },
  { key: 'shu', label: '蜀', color: TITLE_COLORS[2] ?? '#C97E62' },
  { key: 'wu', label: '吴', color: TITLE_COLORS[3] ?? '#85AE6D' },
  { key: 'qun', label: '群', color: TITLE_COLORS[4] ?? '#959394' },
  { key: 'jin', label: '晋', color: TITLE_COLORS[5] ?? '#BD6EB9' },
] as const

export type OfficialTitleColorPresetKey =
  (typeof CUSTOM_TITLE_OFFICIAL_COLOR_PRESETS)[number]['key']

/** `n-color-picker` 底部预设色块（神 → 晋） */
export const CUSTOM_TITLE_COLOR_SWATCHES = CUSTOM_TITLE_OFFICIAL_COLOR_PRESETS.map(
  (item) => item.color,
)

/** 开启自定义称号颜色时的默认 hex（单势力 / 双势力势力1） */
export const DEFAULT_CUSTOM_TITLE_COLOR = CUSTOM_TITLE_OFFICIAL_COLOR_PRESETS[1].color

/** 双势力自定义称号色：势力2 */
export const DEFAULT_CUSTOM_TITLE_COLOR_SECONDARY = CUSTOM_TITLE_OFFICIAL_COLOR_PRESETS[4].color
