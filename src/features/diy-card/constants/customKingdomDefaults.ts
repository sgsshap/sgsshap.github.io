/**
 * 自定义势力工厂默认（legend 初始 renderConfig 与 ensureCustom* 共用）
 */

/**
 * 自定义势力色取色器：魏蜀吴群晋边框/体力等着色预设（与势力字 PNG 着色预设分离）
 */
export const CUSTOM_KINGDOM_CUSTOM_COLOR_PRESETS = [
  { key: 'wei', label: '魏', color: '#73B1EC' },
  { key: 'shu', label: '蜀', color: '#E3500F' },
  { key: 'wu', label: '吴', color: '#82D048' },
  { key: 'qun', label: '群', color: '#979797' },
  { key: 'jin', label: '晋', color: '#663288' },
] as const

const customKingdomPresetColor = (
  key: (typeof CUSTOM_KINGDOM_CUSTOM_COLOR_PRESETS)[number]['key'],
) => CUSTOM_KINGDOM_CUSTOM_COLOR_PRESETS.find((item) => item.key === key)!.color

/** 单势力自定义字输入框 placeholder（存档默认置空） */
export const CUSTOM_SINGLE_KINGDOM_TEXT_PLACEHOLDER = '原神'

/** 单势力自定义默认色 */
export const DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR = customKingdomPresetColor('jin')

/** 双势力自定义字输入框 placeholder（存档默认置空） */
export const CUSTOM_DOUBLE_KINGDOM_TEXT_PLACEHOLDER = {
  primary: '楚',
  secondary: '汉',
} as const

/** 自定义双势力默认色：势力1 魏 / 势力2 晋 */
export const DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY = customKingdomPresetColor('jin')
export const DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY = customKingdomPresetColor('wei')

/** `n-color-picker` 底部预设色块（魏 → 晋） */
export const CUSTOM_KINGDOM_CUSTOM_COLOR_SWATCHES = CUSTOM_KINGDOM_CUSTOM_COLOR_PRESETS.map(
  (item) => item.color,
)
