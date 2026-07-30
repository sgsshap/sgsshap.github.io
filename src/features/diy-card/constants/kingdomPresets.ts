import { DIY_PUBLIC_ASSET_BASE, resolvePublicAssetSrc } from '@/features/diy-card/constants/publicAssets'

/** 扩展预设势力字布局微调（相对标准布局；神 / 普通框共用） */
export type PresetKingdomLayoutTune = {
  /** 相对标准 widthPx 的缩放比（1 = 标准大小） */
  scale: number
  /** X 轴偏移（mm，相对基准锚点） */
  offsetXMm: number
  /** Y 轴偏移（mm，相对基准锚点） */
  offsetYMm: number
}

/** 扩展预设势力 PNG 根路径（public/diy/shared/kingdom-preset，与模板目录隔离） */
export const KINGDOM_PRESET_ASSET_BASE = `${DIY_PUBLIC_ASSET_BASE}/kingdom-preset`

export const resolveKingdomPresetAssetSrc = (asset: string) =>
  resolvePublicAssetSrc('kingdom-preset', asset)

/** 扩展预设势力（与魏蜀吴群晋素材隔离，存放于 public/diy/shared/kingdom-preset） */
export type KingdomPreset = {
  /** 存盘 / 下拉 value */
  key: string
  /** 下拉展示名 */
  label: string
  /** 素材文件名（不含路径） */
  asset: string
  /** 自定义势力色 hex（历史 / 五行意象） */
  color: string
  /** 是否神 UI 预设：true 选中时切神框+神势力；false 仅普通 UI */
  isShen: boolean
  /** 布局微调（神 / 普通框共用同一套偏移与缩放） */
  layout: PresetKingdomLayoutTune
}

/** 扩展预设势力字布局（相对画布内容区左上） */
export type PresetKingdomGlyphLayout = {
  /** 左上锚点 X（mm） */
  originXMm: number
  /** 左上锚点 Y（mm） */
  originYMm: number
  /**
   * 渲染宽度（px）
   * 与 {@link KINGDOMS_POSITION_INFO} 的 width 同单位；高度按素材宽高比推算
   */
  widthPx: number
}

export const DEFAULT_PRESET_KINGDOM_LAYOUT_TUNE: PresetKingdomLayoutTune = {
  scale: 1,
  offsetXMm: 0,
  offsetYMm: 0,
}

const defineKingdomPreset = (
  key: string,
  label: string,
  asset: string,
  color: string,
  options?: {
    isShen?: boolean
    layout?: Partial<PresetKingdomLayoutTune>
  },
): KingdomPreset => ({
  key,
  label,
  asset,
  color,
  isShen: options?.isShen ?? false,
  layout: { ...DEFAULT_PRESET_KINGDOM_LAYOUT_TUNE, ...options?.layout },
})

/**
 * 其他势力预设（按时间序）
 * 色值取历史意象与五行倾向，供自定义势力着色管线使用。
 * `layout` 为相对标准布局的缩放与 mm 偏移，神 / 普通框共用。
 */
export const KINGDOM_PRESETS: readonly KingdomPreset[] = [
  defineKingdomPreset('xia', '夏', 'xia.png', '#3E6B8A', {
    layout: { offsetXMm: -0.2, offsetYMm: -0.4, scale: 1.1 },
  }),
  defineKingdomPreset('shang', '商', 'shang.png', '#B8956B', {
    layout: { offsetXMm: 0.8, offsetYMm: -0.4, scale: 1 },
  }),
  defineKingdomPreset('zhou', '周', 'zhou.png', '#6B8E23'),
  defineKingdomPreset('qin', '秦', 'qin.png', '#3D5A6C', {
    layout: { offsetXMm: 0, offsetYMm: -0.8, scale: 1.1 },
  }),
  defineKingdomPreset('chu', '楚', 'chu.png', '#C73E3A', {
    layout: { offsetXMm: -0.3, offsetYMm: -0.5, scale: 1.1 },
  }),
  defineKingdomPreset('hanguo', '韩', 'hanguo.png', '#7A9E6B', {
    layout: { offsetXMm: -0.3, offsetYMm: -0.5, scale: 1.1 },
  }),
  defineKingdomPreset('zhao', '赵', 'zhao.png', '#7B68AE', {
    layout: { offsetXMm: -0.2, offsetYMm: -0.5, scale: 1.1 },
  }),
  defineKingdomPreset('yan', '燕', 'yan.png', '#CD853F'),
  defineKingdomPreset('qi', '齐', 'qi.png', '#20B2AA', {
    layout: { offsetXMm: 0.1, offsetYMm: -0.4, scale: 1.1 },
  }),
  defineKingdomPreset('lu', '鲁', 'lu.png', '#A0522D', {
    layout: { offsetXMm: -0.5, offsetYMm: -0.5, scale: 1.1 },
  }),
  defineKingdomPreset('song', '宋', 'song.png', '#DC143C', {
    layout: { offsetXMm: 0, offsetYMm: -0.4, scale: 1.1 },
  }),
  defineKingdomPreset('liangguo', '梁', 'liangguo.png', '#BC8F8F', {
    layout: { offsetXMm: 0.1, offsetYMm: 0.2, scale: 1 },
  }),
  defineKingdomPreset('chen', '陈', 'chen.png', '#9779D4', {
    layout: { offsetXMm: -0.6, offsetYMm: -0.4, scale: 1.1 },
  }),
  defineKingdomPreset('han', '汉', 'han.png', '#C41E3A'),
  defineKingdomPreset('jin-dyn', '晋', 'jin-dyn.png', '#8B4789'),
  defineKingdomPreset('sui', '隋', 'sui.png', '#4169E1', {
    layout: { offsetXMm: 0.2, offsetYMm: 0.1, scale: 1 },
  }),
  defineKingdomPreset('tang', '唐', 'tang.png', '#DAA520', {
    layout: { offsetXMm: 0, offsetYMm: 0, scale: 1.04 },
  }),
  defineKingdomPreset('liao', '辽', 'liao.png', '#708090', {
    layout: { offsetXMm: -0.1, offsetYMm: -0.2, scale: 1.02 },
  }),
  defineKingdomPreset('xi', '西', 'xi.png', '#DE2374'),
  defineKingdomPreset('jin-jur', '金', 'jin-jur.png', '#CFB53B'),
  defineKingdomPreset('yuan', '元', 'yuan.png', '#2E5090', {
    layout: { offsetXMm: 0.1, offsetYMm: 0, scale: 1 },
  }),
  defineKingdomPreset('ming', '明', 'ming.png', '#E34234', {
    layout: { offsetXMm: -0.3, offsetYMm: -1.2, scale: 1.2 },
  }),
  defineKingdomPreset('qing', '清', 'qing.png', '#174466', {
    layout: { offsetXMm: 0.1, offsetYMm: -0.3, scale: 1.1 },
  }),
  defineKingdomPreset('shun', '顺', 'shun.png', '#AD3535', {
    layout: { offsetXMm: -1.1, offsetYMm: 0.2, scale: 1.1 },
  }),
  defineKingdomPreset('zheng', '郑', 'zheng.png', '#D2691E', {
    layout: { offsetXMm: -0.5, offsetYMm: -0.3, scale: 1.14 },
  }),
  defineKingdomPreset('yue', '越', 'yue.png', '#288B8B', {
    layout: { offsetXMm: -0.1, offsetYMm: -0.5, scale: 1.1 },
  }),
  defineKingdomPreset('liangzhou', '凉', 'liangzhou.png', '#556B2F', {
    layout: { offsetXMm: -0.1, offsetYMm: -0.5, scale: 1.1 },
  }),
] as const

export const KINGDOM_PRESET_BY_KEY = new Map(KINGDOM_PRESETS.map((item) => [item.key, item]))

export const resolveKingdomPreset = (key: string | undefined | null) => {
  const trimmed = key?.trim()
  if (!trimmed) return undefined
  return KINGDOM_PRESET_BY_KEY.get(trimmed)
}

/** 操作历史展示：预设势力 key → 中文名（如 xia → 夏） */
export const formatPresetKingdomHistoryLabel = (key: string | null | undefined) => {
  const trimmed = key?.trim()
  if (!trimmed) return ''
  return resolveKingdomPreset(trimmed)?.label ?? trimmed
}
