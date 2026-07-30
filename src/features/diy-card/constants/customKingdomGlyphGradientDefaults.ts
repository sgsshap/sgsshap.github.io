import {
  CUSTOM_KINGDOM_GLYPH_END_TILT_X_RATIO,
  CUSTOM_KINGDOM_GLYPH_TEXT_END_TILT_X_RATIO,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'

import {
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS,
} from '@/features/diy-card/constants/customKingdomGlyphDefaults'

/** 蜀字等官方 PNG 底部绿点缀色（吴）；势力字主色用蜀橙 + 终点色用此绿 ≈ 参考图白-橙-绿 */
export const DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR =
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS[2].color

/** 双势力：势力2 渐变终点默认（蜀橙，与势力字 secondary 默认呼应） */
export const DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR_SECONDARY =
  CUSTOM_KINGDOM_GLYPH_OFFICIAL_COLOR_PRESETS[1].color

/**
 * 魏蜀吴群晋非神势力字 · 三层渐变（文字 / 图片共用）
 * - Layer1+2：顶白 + 势力主色（CUSTOM_KINGDOM_GLYPH_*_FILL_STOPS）
 * - Layer3：底部叠终点色（如蜀字：主色蜀橙 + 终点吴绿 → 白/橙/绿三段）
 */
export const KINGDOM_GLYPH_TRIPLE_LAYER_GRADIENT = {
  /** Layer3 叠加强度：position 沿字框渐变轴 0（顶）→ 1（底） */
  layer3BlendStops: [
    { position: 0, blend: 0.5 },
    { position: 0.2, blend: 0 },
    { position: 0.28, blend: 0.4 },
    { position: 0.38, blend: 0.2 },
    { position: 0.6, blend: 1 },
    { position: 0.8, blend: 0.3 },
    { position: 0.92, blend: 0.75 },
    { position: 1, blend: 0.5 },
  ],
  /** bridge→终点色：position 与 layer3BlendStops 同轴（整字 0→1），段间 cosine 插值 */
  layer3EndMixStops: [
    { position: 0, mix: 0 },
    { position: 0.6, mix: 0 },
    { position: 0.7, mix: 0.2 },
    { position: 0.72, mix: 0.5 },
    { position: 0.75, mix: 0.5 },
    { position: 1, mix: 1 },
  ],
  /** Layer3 blend/mix 曲线沿轴多点柔化（减轻条带感） */
  layer3ScalarSoftness: 0.05,
  image: {
    endTiltXRatio: CUSTOM_KINGDOM_GLYPH_END_TILT_X_RATIO,
    gradientEndUsesFullBox: false,
    gradientAxisSoftness: 0.05,
  },
  text: {
    endTiltXRatio: CUSTOM_KINGDOM_GLYPH_TEXT_END_TILT_X_RATIO,
    gradientEndUsesFullBox: false,
    gradientAxisSoftness: 0.05,
  },
} as const
