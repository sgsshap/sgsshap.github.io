<script setup lang="ts">
import { Group as VGroup, Image as VImage, Layer as VLayer, Rect as VRect, Text as VText } from 'vue-konva'
import type { CanvasItemConfig } from '@/features/diy-card/types/canvas'
import Konva from 'konva'
import { computed, nextTick, onScopeDispose, shallowRef, watch } from 'vue'
import { debounce } from '@/shared/utils/scheduling'
import { useDiyStore, useInfoStore } from '@/features/diy-card/stores'
import {
  registerKingdomToggleCanvasBatchHooks,
  resetKingdomToggleCanvasBatchHooks,
} from '@/features/diy-card/composables/kingdomToggleCanvasGate'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { isPackageIdentifyActive } from '@/features/diy-card/types/diy/packageIdentify'
import {
  isCustomKingdomActive,
  isDoubleKingdomRenderActive,
  isDoubleKingdomSingleGlyphMode,
  isKingdomGlyphCode,
  isKingdomGlyphEmpty,
  isMasterFlagActive,
  hasCustomKingdomColor,
  resolveDoubleKingdomSingleGlyphColorSlot,
  shouldCustomShenSkillUseKingdomColor,
  usesShenCardLayout,
  listKingdomGlyphCanvasConfigs,
  type KingdomColorSlot,
} from '@/features/diy-card/composables/doubleKingdom'
import {
  isPresetKingdomActive,
  resolveKingdomChromeTintKey,
  resolvePresetKingdomChromeTintKey,
  shouldUseMasterKingdomGlyphAsset,
  shouldUseMasterKingdomGlyphStyle,
} from '@/features/diy-card/composables/kingdomPreset'
import {
  isCustomTitleColorActive,
  shouldTitleUseCustomKingdomColor,
} from '@/features/diy-card/utils/customTitleColor'
import {
  isCustomKingdomGlyphColorActive,
  isKingdomGlyphOfficialGradientActive,
  resolveKingdomSelectionSignature,
  resolveKingdomGlyphGradientEndColorHex,
  resolveKingdomGlyphLayer12BridgeHex,
  shouldApplyKingdomGlyphLayer12Tone,
  shouldPreserveOriginalKingdomGlyphAsset,
} from '@/features/diy-card/utils/customKingdomGlyphColor'
import { resolveCustomMaterialLayerPosition, resolveHideCustomMaterialPartialSkillOverlap, shouldUsePartialOverlayStack } from '@/features/diy-card/utils/customMaterial'
import { resolveOutOfFrameConfig } from '@/features/diy-card/types/diy/outOfFrame'
import { shouldPreserveOriginalHpAsset } from '@/features/diy-card/utils/customHpColor'
import { shouldOverlayCustomKingdomGradientOnGlyphImage } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/filters/kingdomGlyphGradientTint'
import { KINGDOM_DUAL_CHAR_HIT_CODE } from './composables/constants/kingdom'
import { WATERMARK_DIVIDER_CODE, WATERMARK_HIT_CODE, WATERMARK_SCRIM_CODE } from './composables/constants/watermark'
import { SKILL_DESC_HIT_CODE, SKILL_NAME_HIT_CODE, resolveSkillsDescAutoOptimizeFlag } from './composables/constants/skills'
import { paintSkillDescKonvaTextSubtree } from './composables/layers/skills-desc/skillDescKonvaPaint'
import {
  bindSkillDescShenBgImageRef,
  isSkillDescShenBgImageCode,
  scheduleSkillDescShenBgImageFilterCacheRefresh,
} from './composables/layers/skills-desc/skillDescShenBgCache'
import {
  filterFrameChildrenForFullFrameMode,
  isFrameKingdomStripChild,
  isLayerHiddenInFullFrameMode,
  splitFrameChildrenByKingdomStrip,
} from './composables/layout/fullFrame'
import {
  bindFrameKingdomStripImageRef,
  scheduleFrameKingdomStripFilterCacheRefresh,
} from './composables/layers/frame/kingdomStripCache'
import {
  bindPackageTextBgImageRef,
  isPackageTextBgCode,
} from './composables/layers/package/packageTextBgCache'
import {
  isPackageTextBadgeKind,
  resolvePackageTextBadgeGradient,
  resolvePackageTextBadgeGradientAngleDeg,
} from './composables/constants/package'
import { useKonvaBrightnessFilters } from '@/features/diy-card/composables'
import {
  bindSkillsNameSideImageRef,
  resolveSkillsNameKonvaGroupConfig,
  resolveSkillsNameStageLayersWithTint,
  scheduleSkillsNameSideImageFilterCacheRefresh,
  syncSkillsNameFrameTintToCanvasConfig,
} from './composables/layers/skills-name/skillNameStage'
import { type TemplateProps, useTemplate } from './composables'

/* 参数定义 */
const props = defineProps<TemplateProps>()

const emits = defineEmits<{
  (e: 'click', nodeName: string): void
}>()

/* 核心逻辑 */
const {
  info,
  canvasConfigs,
  canvasRenderVersion,
  legendOutOfFrameRenderVersion,
  legendImageRef,
  nameRef,
  titleRef,
  frameRef,
  kingdomRef,
  hpRef,
  skillsDescRef,
  skillsNameRef,
  bottomInfoRef,
  watermarkRef,
  packageRef,
  customMaterialsRef,
  legendOutOfFrameRef,
  syncMaterialLayout,
  reloadMaterial,
  registerSplitNameGroupRef,
  registerKingdomGlyphRef,
  schedulePreviewFilterCacheRefresh,
} = useTemplate(props, emits)

const legend = info as LegendInfo
const diyStore = useDiyStore()
const infoStore = useInfoStore()
const { getFilters } = useKonvaBrightnessFilters()

/** 传给 vue-konva 的 group 配置（children / 亮度滤镜勿写入 Konva attrs，避免污染子 Text） */
const skillDescKonvaGroupConfig = (item: CanvasItemConfig) => {
  const {
    children: _children,
    filters: _filters,
    brightness: _brightness,
    globalCompositeOperation: _gco,
    ...konvaConfig
  } = item
  return konvaConfig
}

/** 传给 vue-konva 的 text 配置（保留 code 供运行时同步 fill/stroke） */
const skillDescKonvaTextConfig = (item: CanvasItemConfig) => {
  const { name: _name, loadFunc: _loadFunc, children: _children, ...konvaConfig } = item
  return konvaConfig
}

const skillDescTextSegments = computed(() =>
  (canvasConfigs.skillsDesc?.children ?? []).filter(isSkillDescPaintableText),
)

const repaintSkillDescKonvaText = () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      const group = skillsDescRef.value?.getNode?.() as Konva.Group | undefined
      if (!group) return
      paintSkillDescKonvaTextSubtree(group, skillDescTextSegments.value)
    })
  })
}

const debouncedRepaintSkillDescKonvaText = debounce(repaintSkillDescKonvaText, 96)

const isSkillDescRichSegment = (item: CanvasItemConfig) =>
  Boolean(item.code?.startsWith('skillsDesc_text_')) ||
  isSkillDescUnderlineLayer(item) ||
  isSkillDescQuoteLine(item)

const skillDescChildKey = (item: CanvasItemConfig) =>
  isSkillDescRichSegment(item) ? skillDescTextSubKey(item) : item.code

const watermarkContentKey = computed(
  () =>
    `${legend.renderConfig.watermark.showFlag}-${legend.renderConfig.watermark.username}`,
)

const showPackageLayer = computed(() =>
  isPackageIdentifyActive(legend.baseInfo.packageIdentify) &&
  Boolean(canvasConfigs.package?.children?.length),
)

const packageRenderKey = computed(() =>
  [
    canvasRenderVersion.value,
    legend.baseInfo.packageIdentify.name,
    legend.baseInfo.packageIdentify.pic,
    legend.baseInfo.packageIdentify.text,
    legend.renderConfig.items.package.convertTChFlag,
  ].join(':'),
)

const packageChildRenderKey = (item: CanvasItemConfig) => {
  if (isPackageTextBgCode(item.code)) {
    const pkg = legend.renderConfig.items.package
    const identifyName = legend.baseInfo.packageIdentify.name
    const parts = [pkg.customColor ?? '', pkg.customColorEnd ?? '']
    if (isPackageTextBadgeKind(identifyName)) {
      const gradient = resolvePackageTextBadgeGradient(identifyName)
      if (gradient) {
        parts.push(
          String(resolvePackageTextBadgeGradientAngleDeg(gradient)),
          String(gradient.startAt ?? 0),
          String(gradient.endAt ?? 1),
        )
      }
    }
    return `package-text-bg-${parts.join('-')}`
  }
  if (item.code?.startsWith('package-text-') && item.image && !isPackageTextBgCode(item.code)) {
    return [
      item.code,
      item.text ?? '',
      String(item.width ?? ''),
      String(item.height ?? ''),
    ].join(':')
  }
  return item.code
}

const nameSplitFlag = computed(() => legend.renderConfig.items.name.splitFlag)
const nameSplitChildren = computed(() =>
  nameSplitFlag.value ? canvasConfigs.name?.children ?? [] : [],
)
const nameRenderKey = computed(() =>
  [
    canvasRenderVersion.value,
    legend.baseInfo.name,
    legend.renderConfig.items.name.splitFlag,
    legend.renderConfig.items.name.convertTChFlag,
  ].join(':'),
)

const titleRenderKey = computed(() => {
  const parts = [
    canvasRenderVersion.value,
    legend.baseInfo.title,
    legend.renderConfig.items.title.convertTChFlag,
  ]
  const titleItem = legend.renderConfig.items.title
  if (isCustomTitleColorActive(legend)) {
    parts.push(
      String(titleItem.customColorFlag),
      titleItem.customColor,
      titleItem.customColorPrimary,
      titleItem.customColorSecondary,
    )
  } else if (shouldTitleUseCustomKingdomColor(legend)) {
    const kingdom = legend.renderConfig.items.kingdom
    parts.push(
      kingdom.customColor,
      kingdom.customColorPrimary,
      kingdom.customColorSecondary,
    )
  }
  return parts.join(':')
})

const isNameSplitHitLayer = (layer: CanvasItemConfig) => layer.code === 'hit'
const isKingdomDualCharHitLayer = (layer: CanvasItemConfig) =>
  layer.code === KINGDOM_DUAL_CHAR_HIT_CODE

const isImageLayer = (layer: CanvasItemConfig) => Boolean(layer.image)

const isSkillDescUnderlineLayer = (layer: CanvasItemConfig) => layer.code.endsWith('_underline')

const isSkillDescQuoteLine = (layer: CanvasItemConfig) =>
  Boolean(layer.code?.includes('_quote_line_'))

const isSkillDescPaintableText = (layer: CanvasItemConfig) =>
  Boolean(
    (layer.code?.startsWith('skillsDesc_text_') || isSkillDescQuoteLine(layer)) && layer.text,
  )

const isSkillDescRectLayer = (layer: CanvasItemConfig) =>
  isSkillDescUnderlineLayer(layer) ||
  (Boolean(layer.fill) && !layer.image && !layer.text) ||
  layer.code === SKILL_DESC_HIT_CODE

const isSkillsNameHitLayer = (layer: CanvasItemConfig) => layer.code === SKILL_NAME_HIT_CODE

const isWatermarkAuxRect = (layer: CanvasItemConfig) =>
  layer.code === WATERMARK_HIT_CODE ||
  layer.code === WATERMARK_DIVIDER_CODE ||
  layer.code === WATERMARK_SCRIM_CODE

/** 神技能描述背景（单张 SVG 渲染为 Image） */
const isSkillDescShenBgImageLayer = (layer: CanvasItemConfig) =>
  isSkillDescShenBgImageCode(layer.code)

/**
 * 技能描述区结构 key：仅神/普通、势力框型等会改 DOM 树的因素。
 * 勿放入 autoOptimizeFlag、autoFullNumberFlag、字号/边距/技能数——否则整组 remount 会丢自定义神底图 HSL 着色。
 */
const skillsDescStructureKey = computed(() =>
  [
    canvasRenderVersion.value,
    legend.baseInfo.kingdom,
    legend.baseInfo.masterFlag,
    legend.renderConfig.items.frame.src,
    usesShenCardLayout(legend) ? 'shen' : 'normal',
    shouldUsePartialOverlayStack(legend) ? 'partial-overlay' : 'default-overlay',
  ].join(':'),
)

/** 排版相关字段：字号/行距变化时须参与 key，否则 vue-konva 会保留旧 fontSize */
const skillDescTypographySig = (sub: CanvasItemConfig) =>
  [
    sub.fontSize ?? '',
    sub.lineHeight ?? '',
    sub.letterSpacing ?? '',
    sub.fontFamily ?? '',
    sub.fontStyle ?? '',
    sub.y ?? '',
    sub.width ?? '',
    sub.height ?? '',
  ].join('/')

/** 仅随 canvasConfigs 子节点内容变；勿绑 live legend 正文，避免连打时未 reload 就 remount 全部 Text */
const skillDescTextSubKey = (sub: CanvasItemConfig) =>
  `${sub.code}-${sub.fill ?? ''}-${sub.stroke ?? ''}-${sub.strokeWidth ?? ''}-${sub.text ?? ''}-${skillDescTypographySig(sub)}`

const skillDescPaintSegmentSig = computed(() =>
  skillDescTextSegments.value
    .map((segment) =>
      [
        segment.code,
        segment.text ?? '',
        segment.fill ?? '',
        segment.stroke ?? '',
        segment.strokeWidth ?? '',
        segment.fontSize ?? '',
        segment.lineHeight ?? '',
        segment.letterSpacing ?? '',
        segment.fontFamily ?? '',
      ].join('\0'),
    )
    .join('\n'),
)

watch(skillDescPaintSegmentSig, () => {
  if (diyStore.canvasBootstrapPending) return
  debouncedRepaintSkillDescKonvaText()
})

/** 技能描述富文本 remount key：仅重建文案/引言节点，不 remount 整组（保留神底图 HSL 着色） */
const skillsDescTextRenderKey = computed(() => {
  const desc = legend.renderConfig.items.skillsDesc
  const quote = legend.renderConfig.items.quote
  return [
    resolveSkillsDescAutoOptimizeFlag(desc.autoOptimizeFlag),
    desc.autoFullNumberFlag,
    desc.newFontFlag,
    desc.textBoldFlag,
    desc.size,
    desc.characterSpacing,
    desc.rowSpacing,
    desc.paraSpacing,
    desc.singleLineParaSpacing,
    desc.marginTop,
    desc.marginBottom,
    desc.marginLeft,
    desc.marginRight,
    desc.minHeightMm,
    quote.size,
    quote.characterSpacing,
    quote.marginTop,
    quote.marginBottom,
    quote.marginLeft,
    quote.marginRight,
  ].join(':')
})

watch(skillsDescTextRenderKey, () => {
  if (diyStore.canvasBootstrapPending) return
  debouncedRepaintSkillDescKonvaText()
})

/** 神描述底图 cap 着色 remount key（技能个数变化会改底图几何，须与自定义色一并 remount） */
const skillsDescBgTintKey = computed(() => {
  if (!shouldCustomShenSkillUseKingdomColor(legend)) return kingdomFrameStableKey.value
  const color = legend.renderConfig.items.kingdom.customColor?.trim() ?? ''
  return `${kingdomFrameStableKey.value}:${color}:${legend.baseInfo.skills.length}:${frameTintRemountGen.value}`
})

const fullModeFlag = computed(() => Boolean(legend.renderConfig.display.fullModeFlag))

const showSkillsDescLayer = computed(
  () =>
    !isLayerHiddenInFullFrameMode('skillsDesc', fullModeFlag.value) &&
    Boolean(canvasConfigs.skillsDesc?.children?.length),
)

watch(showSkillsDescLayer, (visible) => {
  if (visible) repaintSkillDescKonvaText()
})

const showBottomInfoLayer = computed(() =>
  Boolean(canvasConfigs.bottomInfo?.children?.length),
)

const showWatermarkLayer = computed(
  () =>
    legend.renderConfig.watermark.showFlag &&
    Boolean(canvasConfigs.watermark?.children?.length),
)

const kingdomDoubleSwitchOn = computed(
  () => legend.renderConfig.items.kingdom.doubleKingdom,
)
const kingdomCustomFlag = computed(
  () => legend.renderConfig.items.kingdom.customKingdomFlag,
)

/** 势力 + 边框素材的稳定 key（不含自定义色，关闭自定义势力时不因 remount 抖闪） */
const kingdomFrameStableKey = computed(() => {
  const { baseInfo, renderConfig } = legend
  const base = isMasterFlagActive(legend) ? 'master' : baseInfo.kingdom
  return `${base}:frame:${renderConfig.items.frame.src}`
})

/** 开启自定义势力或自定义色变更时 remount，关闭时不递增 */
const frameTintRemountGen = shallowRef(0)

/** 势力字整图 remount：主公切换会先变 renderKey，须等 load 完成后再 bump 以挂上 *_master 图 */
const kingdomRootRemountGen = shallowRef(0)

/** 技能框饰边 remount key：仅跟势力/边框，主公不改变 left/right 逻辑 */
const skillsNameFrameStableKey = computed(() => {
  const { baseInfo, renderConfig } = legend
  return `${baseInfo.kingdom}:frame:${renderConfig.items.frame.src}`
})

const skillsNameTintRemountGen = shallowRef(0)

/** 技能框 left/right 着色 remount（对齐 hpTintKey，须含双势力色与势力技否则滤镜不刷新） */
const skillsNameTintKey = computed(() => {
  const reloadGen = canvasRenderVersion.value
  const stable = skillsNameFrameStableKey.value
  if (!kingdomCustomFlag.value) {
    return `${reloadGen}:${stable}:${skillsNameTintRemountGen.value}`
  }
  const kingdom = legend.renderConfig.items.kingdom
  const skillKingdoms = legend.baseInfo.skills.map((s) => s.kingdom ?? '').join('|')
  if (isDoubleKingdomRenderActive(legend)) {
    return `dual:${kingdom.customColorPrimary}:${kingdom.customColorSecondary}:${skillKingdoms}:${reloadGen}:${skillsNameTintRemountGen.value}`
  }
  return `single:${kingdom.customColor}:${skillKingdoms}:${reloadGen}:${skillsNameTintRemountGen.value}`
})

const skillsNameKonvaGroupConfig = computed(() =>
  resolveSkillsNameKonvaGroupConfig(canvasConfigs.skillsName),
)

/** 模板实时合并 left/right 着色（与 frame kingdom_frame 一致） */
const skillsNameRenderChildren = computed(() =>
  resolveSkillsNameStageLayersWithTint(canvasConfigs.skillsName, legend, getFilters),
)

/** 自定义势力色变更时立即写回 skillsName children（Konva cache 与 v-image 同源） */
const syncSkillsNameFrameTint = () => {
  const synced = syncSkillsNameFrameTintToCanvasConfig(
    canvasConfigs.skillsName,
    legend,
    getFilters,
  )
  if (synced) {
    canvasConfigs.skillsName = synced
  }
}

const scheduleSkillsNameSideFilterCacheRefresh = () => {
  syncSkillsNameFrameTint()
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleSkillsNameSideImageFilterCacheRefresh(
          canvasConfigs.skillsName,
          legend,
          getFilters,
        )
      })
    })
  })
}

const scheduleSkillDescShenBgImageSideFilterCacheRefresh = (options?: { force?: boolean }) => {
  if (!shouldCustomShenSkillUseKingdomColor(legend)) return
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleSkillDescShenBgImageFilterCacheRefresh(canvasConfigs.skillsDesc, options)
      })
    })
  })
}

const skillsNameLayoutKey = computed(() => {
  const skills = legend.baseInfo.skills
  const name = legend.renderConfig.items.skillsName
  return [
    fullModeFlag.value ? 'full' : 'normal',
    name.marginTop,
    name.size,
    name.characterSpacing,
    skills.map((s) => `${s.derivedFlag}:${s.kingdom ?? ''}`).join('|'),
    skillsDescStructureKey.value,
  ].join(':')
})

const bottomInfoRenderKey = computed(() => {
  const bottom = legend.renderConfig.items.bottomInfo
  return [
    canvasRenderVersion.value,
    fullModeFlag.value ? 'full' : 'normal',
    legend.baseInfo.copyright,
    legend.baseInfo.legendId,
    bottom.showFlag,
    bottom.strokeFlag,
    bottom.marginLeft,
    bottom.marginRight,
    usesShenCardLayout(legend) ? 'shen' : 'normal',
  ].join(':')
})

const kingdomGlyphLayerActive = computed(() => {
  if (isKingdomGlyphEmpty(legend)) return false
  if (!kingdomDoubleSwitchOn.value) return false
  if (isDoubleKingdomSingleGlyphMode(legend)) return false
  if (kingdomCustomFlag.value) return true
  const list = legend.baseInfo.doubleKingdom?.filter((k) => k && k !== 'shen') ?? []
  return list.length >= 2
})

const kingdomGlyphChildren = computed(() =>
  kingdomGlyphLayerActive.value ? listKingdomGlyphCanvasConfigs(canvasConfigs) : [],
)

/** 双字 children 仅适合叠层独立渲染；单字模式或仍残留旧双字结构时不嵌套进 group */
const showKingdomRootGroup = computed(() => {
  if (isKingdomGlyphEmpty(legend)) return false
  const kingdom = canvasConfigs.kingdom
  if (!kingdom?.children?.length) return false
  if (kingdomGlyphLayerActive.value) return false
  if (isDoubleKingdomSingleGlyphMode(legend)) {
    return !kingdom.children.some((child) => isKingdomGlyphCode(child.code))
  }
  return true
})

const showKingdomRootAsset = computed(() => {
  if (isKingdomGlyphEmpty(legend)) return false
  const kingdom = canvasConfigs.kingdom
  if (!kingdom) return false
  if (kingdom.children?.length) return false
  return Boolean(kingdom.image || kingdom.text)
})

const kingdomLayoutModeKey = computed(() => {
  const shen = usesShenCardLayout(legend) ? 'shen' : 'normal'
  const layout = kingdomGlyphLayerActive.value
    ? 'double'
    : isDoubleKingdomSingleGlyphMode(legend)
      ? 'double-single'
      : 'single'
  return `${shen}-${layout}`
})

const kingdomRootGlyphColorSlot = computed((): KingdomColorSlot =>
  isDoubleKingdomSingleGlyphMode(legend)
    ? resolveDoubleKingdomSingleGlyphColorSlot(legend)
    : 'single',
)

const kingdomSelectionKey = computed(() => resolveKingdomSelectionSignature(legend))

const kingdomMasterAssetKey = computed(() =>
  shouldUseMasterKingdomGlyphAsset(legend) ? 'master-asset' : 'normal-asset',
)

const kingdomGlyphColorSlot = (code: string): KingdomColorSlot =>
  code === 'kingdom-secondary' ? 'secondary' : 'primary'

/** 势力字单独变色：颜色 + 当前势力是否走原图（切换势力后须变化以触发重绘） */
const kingdomGlyphTintKey = computed(() => {
  if (isKingdomGlyphOfficialGradientActive(legend)) {
    if (isDoubleKingdomRenderActive(legend)) {
      const pBridge = resolveKingdomGlyphLayer12BridgeHex(legend, 'primary') ?? ''
      const sBridge = resolveKingdomGlyphLayer12BridgeHex(legend, 'secondary') ?? ''
      const pEnd = resolveKingdomGlyphGradientEndColorHex(legend, 'primary')
      const sEnd = resolveKingdomGlyphGradientEndColorHex(legend, 'secondary')
      const pL12 = shouldApplyKingdomGlyphLayer12Tone(legend, 'primary') ? 1 : 0
      const sL12 = shouldApplyKingdomGlyphLayer12Tone(legend, 'secondary') ? 1 : 0
      return `glyph-3l-dual:${pBridge}:${sBridge}:${pEnd}:${sEnd}:p${pL12}:s${sL12}:${kingdomSelectionKey.value}`
    }
    const bridge = resolveKingdomGlyphLayer12BridgeHex(legend, 'single') ?? ''
    const end = resolveKingdomGlyphGradientEndColorHex(legend, 'single')
    const l12 = shouldApplyKingdomGlyphLayer12Tone(legend, 'single') ? 1 : 0
    return `glyph-3l:${bridge}:${end}:l12${l12}:${kingdomSelectionKey.value}`
  }
  if (!isCustomKingdomGlyphColorActive(legend)) return ''
  const kingdom = legend.renderConfig.items.kingdom
  const color = kingdom.glyphColor?.trim() ?? ''
  const singlePreserve = shouldPreserveOriginalKingdomGlyphAsset(legend, 'single')
  const primaryPreserve = shouldPreserveOriginalKingdomGlyphAsset(legend, 'primary')
  const secondaryPreserve = shouldPreserveOriginalKingdomGlyphAsset(legend, 'secondary')
  const singleGrad =
    isCustomKingdomGlyphColorActive(legend) &&
    shouldOverlayCustomKingdomGradientOnGlyphImage(legend, 'single', singlePreserve)
  const primaryGrad =
    isCustomKingdomGlyphColorActive(legend) &&
    shouldOverlayCustomKingdomGradientOnGlyphImage(legend, 'primary', primaryPreserve)
  const secondaryGrad =
    isCustomKingdomGlyphColorActive(legend) &&
    shouldOverlayCustomKingdomGradientOnGlyphImage(legend, 'secondary', secondaryPreserve)
  if (isDoubleKingdomRenderActive(legend)) {
    return `glyph-dual:${kingdomSelectionKey.value}:${kingdom.glyphColorPrimary}:${kingdom.glyphColorSecondary}:${color}:s${singlePreserve ? 1 : 0}:p${primaryPreserve ? 1 : 0}:b${secondaryPreserve ? 1 : 0}:gp${primaryGrad ? 1 : 0}:gs${secondaryGrad ? 1 : 0}`
  }
  return `glyph:${kingdomSelectionKey.value}:${color}:s${singlePreserve ? 1 : 0}:p${primaryPreserve ? 1 : 0}:b${secondaryPreserve ? 1 : 0}:g${singleGrad ? 1 : 0}`
})

const kingdomPresetTintKey = computed(() => resolvePresetKingdomChromeTintKey(legend))

/** 自定义势力色 chrome 签名（仅改色模式须参与 remount，避免首帧滤镜 cache 偏淡） */
const kingdomCustomChromeTintKey = computed(() =>
  kingdomCustomFlag.value ? resolveKingdomChromeTintKey(legend) : '',
)

/** 势力字 remount：开启势力字自定义色时优先于预设/自定义势力 chrome 色 */
const kingdomGlyphRenderTintKey = computed(() => {
  if (isCustomKingdomGlyphColorActive(legend) && kingdomGlyphTintKey.value) {
    return kingdomGlyphTintKey.value
  }
  return kingdomCustomChromeTintKey.value || kingdomPresetTintKey.value || kingdomGlyphTintKey.value
})

const resolveKingdomGlyphTintMode = (slot: KingdomColorSlot, hasImage: boolean) => {
  if (hasImage && shouldUseMasterKingdomGlyphAsset(legend)) {
    return 'orig'
  }
  if (hasImage && isKingdomGlyphOfficialGradientActive(legend)) {
    const l12 = shouldApplyKingdomGlyphLayer12Tone(legend, slot) ? 1 : 0
    return `grad-3l-${l12}`
  }
  if (hasImage && isPresetKingdomActive(legend)) {
    return shouldUseMasterKingdomGlyphStyle(legend) ? 'grad-master' : 'grad'
  }
  const preserve =
    isCustomKingdomGlyphColorActive(legend) &&
    shouldPreserveOriginalKingdomGlyphAsset(legend, slot)
  if (preserve) return 'orig'
  if (
    hasImage &&
    isCustomKingdomGlyphColorActive(legend) &&
    shouldOverlayCustomKingdomGradientOnGlyphImage(legend, slot, preserve)
  ) {
    return 'grad'
  }
  if (hasImage && isCustomKingdomActive(legend) && hasCustomKingdomColor(legend)) {
    return 'tint'
  }
  return isCustomKingdomGlyphColorActive(legend) ? 'tint' : 'none'
}

/** 势力层结构变化时强制 remount（单字 ↔ 双字组 ↔ 图片；含势力选择与字色） */
const kingdomRenderKey = computed(() => {
  const selection = kingdomSelectionKey.value
  const glyphTint = kingdomGlyphTintKey.value
  const kingdom = canvasConfigs.kingdom
  if (!kingdom) return `none-${kingdomLayoutModeKey.value}-${selection}-${glyphTint}`
  if (kingdom.children?.length) {
    const childSig = (c: (typeof kingdom.children)[number]) => {
      if (c.text) return c.text
      if (c.image) return `img:${c.code}`
      return c.children?.map((layer) => layer.text ?? (layer.image ? 'img' : '')).join('') ?? ''
    }
    return `${kingdomLayoutModeKey.value}-group-${selection}-${kingdom.children.map((c) => `${c.code}:${childSig(c)}`).join('|')}-${kingdomGlyphRenderTintKey.value}`
  }
  if (kingdom.text) return `${kingdomLayoutModeKey.value}-text-${selection}-${kingdom.text}-${kingdomGlyphRenderTintKey.value}`
  if (kingdom.image) {
    const rootSlot = kingdomRootGlyphColorSlot.value
    return `${kingdomLayoutModeKey.value}-image-${selection}-${kingdomMasterAssetKey.value}-${kingdomGlyphRenderTintKey.value}-${resolveKingdomGlyphTintMode(rootSlot, true)}-r${kingdomRootRemountGen.value}`
  }
  return `${kingdomLayoutModeKey.value}-empty-${selection}-${glyphTint}`
})

const kingdomGlyphItemRenderKey = (item: CanvasItemConfig) => {
  const slot = kingdomGlyphColorSlot(item.code)
  const preserve =
    isCustomKingdomGlyphColorActive(legend) &&
    shouldPreserveOriginalKingdomGlyphAsset(legend, slot)
  const tintMode = resolveKingdomGlyphTintMode(slot, Boolean(item.image))
  return `${item.code}-${kingdomSelectionKey.value}-${kingdomGlyphRenderTintKey.value}-${tintMode}-${item.image ? 'img' : 'txt'}`
}

const frameLayoutKey = computed(
  () => `${canvasRenderVersion.value}:${kingdomFrameStableKey.value}:${frameTintRemountGen.value}`,
)

/** partial 模式拆出的 kingdom_frame 着色 remount（与 hp / 预设势力字共用 chrome 签名） */
const frameKingdomTintKey = computed(() => {
  const stable = frameLayoutKey.value
  const chrome = resolveKingdomChromeTintKey(legend)
  return chrome ? `${stable}:${chrome}` : stable
})

const frameKingdomGroupRef = shallowRef<{ getNode?: () => Konva.Group } | null>(null)

const frameImageRenderKey = (item: CanvasItemConfig) =>
  isFrameKingdomStripChild(item.code)
    ? `${item.code}-${frameKingdomTintKey.value}`
    : `${item.code}-${frameLayoutKey.value}`

const bindFrameKingdomStripRef = (code: string, el: unknown) => {
  bindFrameKingdomStripImageRef(code, el)
}

const hpTintRemountGen = shallowRef(0)

const hpTintKey = computed(() => {
  const hpItem = legend.renderConfig.items.hp
  const reloadGen = canvasRenderVersion.value
  if (hpItem.customColorFlag) {
    const singlePreserve = shouldPreserveOriginalHpAsset(legend, 'single')
    const primaryPreserve = shouldPreserveOriginalHpAsset(legend, 'primary')
    const secondaryPreserve = shouldPreserveOriginalHpAsset(legend, 'secondary')
    if (isDoubleKingdomRenderActive(legend)) {
      return `custom-hp-dual:${hpItem.customColorPrimary}:${hpItem.customColorSecondary}:${hpItem.customColor}:p${primaryPreserve ? 1 : 0}:s${secondaryPreserve ? 1 : 0}:${reloadGen}:${hpTintRemountGen.value}`
    }
    return `custom-hp:${hpItem.customColor}:o${singlePreserve ? 1 : 0}:${reloadGen}:${hpTintRemountGen.value}`
  }
  const chrome = resolveKingdomChromeTintKey(legend)
  return `${reloadGen}:${kingdomFrameStableKey.value}:${chrome}:${hpTintRemountGen.value}`
})

const refreshCustomKingdomPreviewTint = (options?: { force?: boolean }) => {
  const force = options?.force ?? false
  scheduleSkillsNameSideFilterCacheRefresh()
  scheduleSkillDescShenBgImageSideFilterCacheRefresh({ force: true })
  schedulePreviewFilterCacheRefresh('frame', { force })
  scheduleFrameKingdomStripFilterCacheRefresh(canvasConfigs.frame, { force: true })
  schedulePreviewFilterCacheRefresh('hp', { force })
  schedulePreviewFilterCacheRefresh('skillsDesc', { force })
  if (isPresetKingdomActive(legend) || isCustomKingdomActive(legend) || isKingdomGlyphOfficialGradientActive(legend)) {
    schedulePreviewFilterCacheRefresh('kingdom', { force })
  }
  if (kingdomGlyphLayerActive.value) {
    schedulePreviewFilterCacheRefresh('kingdom-primary', { force })
    schedulePreviewFilterCacheRefresh('kingdom-secondary', { force })
  }
}

registerKingdomToggleCanvasBatchHooks({
  onEnd: () => {
    frameTintRemountGen.value++
    hpTintRemountGen.value++
    skillsNameTintRemountGen.value++
    kingdomRootRemountGen.value++
    refreshCustomKingdomPreviewTint()
  },
})

onScopeDispose(() => {
  resetKingdomToggleCanvasBatchHooks()
})

const debouncedRefreshCustomKingdomPreviewTint = debounce(
  refreshCustomKingdomPreviewTint,
  48,
)

/** 势力字图叠层：独立 v-image 须按字节点刷滤镜 cache */
const refreshKingdomGlyphFilterCache = () => {
  if (
    !isCustomKingdomGlyphColorActive(legend) &&
    !isCustomKingdomActive(legend) &&
    !isKingdomGlyphOfficialGradientActive(legend)
  ) {
    return
  }
  schedulePreviewFilterCacheRefresh('kingdom', { force: true })
  if (!kingdomGlyphLayerActive.value) return
  schedulePreviewFilterCacheRefresh('kingdom-primary', { force: true })
  schedulePreviewFilterCacheRefresh('kingdom-secondary', { force: true })
}

const debouncedRefreshKingdomGlyphFilterCache = debounce(
  refreshKingdomGlyphFilterCache,
  48,
)

watch(
  () =>
    [
      legend.renderConfig.items.kingdom.glyphColorFlag,
      legend.renderConfig.items.kingdom.glyphColor,
      legend.renderConfig.items.kingdom.glyphColorPrimary,
      legend.renderConfig.items.kingdom.glyphColorSecondary,
      legend.renderConfig.items.kingdom.glyphGradientFlag,
      legend.renderConfig.items.kingdom.glyphGradientEndColor,
      legend.renderConfig.items.kingdom.glyphGradientEndColorPrimary,
      legend.renderConfig.items.kingdom.glyphGradientEndColorSecondary,
      kingdomGlyphLayerActive.value,
      kingdomGlyphTintKey.value,
    ] as const,
  () => {
    if (diyStore.canvasBootstrapPending) return
    debouncedRefreshKingdomGlyphFilterCache()
  },
)

watch(
  () =>
    [
      kingdomCustomFlag.value,
      kingdomCustomChromeTintKey.value,
      kingdomSelectionKey.value,
      isCustomKingdomGlyphColorActive(legend),
      isKingdomGlyphOfficialGradientActive(legend),
    ] as const,
  (value, oldValue) => {
    if (diyStore.canvasBootstrapPending || !oldValue) return
    if (!value[3] && !value[4]) return
    if (value[2] === oldValue[2]) return
    kingdomRootRemountGen.value++
    if (!kingdomCustomFlag.value) return
    debouncedRefreshCustomKingdomPreviewTint({ force: true })
  },
)

watch(
  () =>
    [
      kingdomCustomFlag.value,
      legend.renderConfig.items.kingdom.customColor,
      legend.renderConfig.items.kingdom.customColorPrimary,
      legend.renderConfig.items.kingdom.customColorSecondary,
      legend.renderConfig.items.kingdom.presetKingdomKey ?? '',
      legend.baseInfo.masterFlag,
    ] as const,
  ([flag, color, primary, secondary, presetKey, masterFlag], [prevFlag, prevColor, prevPrimary, prevSecondary, prevPresetKey, prevMasterFlag]) => {
    if (diyStore.canvasBootstrapPending) return
    const flagChanged = flag !== prevFlag
    const colorChanged =
      color !== prevColor || primary !== prevPrimary || secondary !== prevSecondary
    const presetChanged = presetKey !== prevPresetKey
    const masterChanged = masterFlag !== prevMasterFlag
    if (flagChanged) {
      // 开关切换由 watches 协调重载 + batch end hook 统一 remount，避免与 runLayerReload 撞车
      return
    }
    if (presetChanged || masterChanged) {
      if (masterChanged && flag) {
        reloadMaterial('kingdom')
      }
      return
    }
    if ((flag || presetKey) && colorChanged) {
      frameTintRemountGen.value++
      hpTintRemountGen.value++
      skillsNameTintRemountGen.value++
      scheduleSkillsNameSideFilterCacheRefresh()
      debouncedRefreshCustomKingdomPreviewTint({ force: true })
      if (shouldTitleUseCustomKingdomColor(legend)) {
        reloadMaterial('title')
      }
      if (shouldCustomShenSkillUseKingdomColor(legend)) {
        reloadMaterial('skillsDesc')
      }
    }
  },
)

/**
 * 首屏 loadAll 期间势力色 watch 会跳过 remount；持久化色已在 legend 中，skillsDescStructureKey 不会变，
 * 需在 bootstrap 结束后再 remount 带 HSL 滤镜的 v-image 并补刷离屏 cache。
 */
watch(
  () => diyStore.canvasBootstrapPending,
  (pending, prevPending) => {
    if (pending || prevPending !== true) return
    if (kingdomCustomFlag.value) {
      frameTintRemountGen.value++
      hpTintRemountGen.value++
      skillsNameTintRemountGen.value++
    }
    refreshCustomKingdomPreviewTint()
  },
)

watch(skillsNameTintKey, () => {
  if (diyStore.canvasBootstrapPending) return
  scheduleSkillsNameSideFilterCacheRefresh()
})

/** 全量 reload 后归零 remount 计数（canvasRenderVersion 已保证 frame/hp 整组 remount） */
watch(canvasRenderVersion, () => {
  frameTintRemountGen.value = 0
  hpTintRemountGen.value = 0
  skillsNameTintRemountGen.value = 0
  kingdomRootRemountGen.value = 0
  legendOutOfFrameRenderVersion.value = 0
})

/** 结构 remount 后补刷自定义神底图 cache（配置开关误触 remount 时亦兜底） */
watch(skillsDescStructureKey, () => {
  if (!shouldCustomShenSkillUseKingdomColor(legend)) return
  debouncedRefreshCustomKingdomPreviewTint()
  scheduleSkillDescShenBgImageSideFilterCacheRefresh({ force: true })
})

/** 自定义神势力：增减技能会改底图布局，补刷 cap 着色与离屏 cache */
watch(
  () => legend.baseInfo.skills.length,
  (count, prevCount) => {
    if (prevCount === undefined || count === prevCount) return
    if (!shouldCustomShenSkillUseKingdomColor(legend)) return
    frameTintRemountGen.value++
    skillsNameTintRemountGen.value++
    refreshCustomKingdomPreviewTint()
  },
)

const visibleFrameChildren = computed(() =>
  filterFrameChildrenForFullFrameMode(canvasConfigs.frame?.children ?? [], fullModeFlag.value),
)

const frameChildrenForRender = computed(() => {
  const visible = visibleFrameChildren.value
  if (shouldUsePartialOverlayStack(legend)) {
    return splitFrameChildrenByKingdomStrip(visible)
  }
  return { base: visible, kingdomStrips: [] as typeof visible }
})

const visibleFrameBaseChildren = computed(() => frameChildrenForRender.value.base)
const visibleKingdomFrameChildren = computed(() => frameChildrenForRender.value.kingdomStrips)

const showFrameBaseLayer = computed(() => visibleFrameBaseChildren.value.length > 0)
const showKingdomFrameLayer = computed(() => visibleKingdomFrameChildren.value.length > 0)

const customMaterialLayerPosition = computed(() =>
  resolveCustomMaterialLayerPosition(legend),
)

/** 人物出框 / 覆盖边框素材：kingdom_frame 会从 frame 组拆到独立 v-group，须补刷 RGB 滤镜 cache */
const partialOverlayStackActive = computed(() => shouldUsePartialOverlayStack(legend))

watch(frameKingdomTintKey, () => {
  if (diyStore.canvasBootstrapPending) return
  scheduleFrameKingdomStripFilterCacheRefresh(canvasConfigs.frame, { force: true })
})

watch(partialOverlayStackActive, () => {
  if (diyStore.canvasBootstrapPending) return
  frameTintRemountGen.value++
  void nextTick(() => {
    refreshCustomKingdomPreviewTint({ force: true })
  })
})

watch(customMaterialLayerPosition, () => {
  if (diyStore.canvasBootstrapPending) return
  debouncedRefreshCustomKingdomPreviewTint({ force: true })
})

const showCustomMaterialsLayer = computed(() => legend.customMaterialList.length > 0)
const showLegendOutOfFrameLayer = computed(() => {
  const outOfFrame = resolveOutOfFrameConfig(legend.renderConfig.outOfFrame)
  return outOfFrame.enabled && Boolean(outOfFrame.maskDataUrl)
})
const customMaterialsRenderKey = computed(
  () =>
    `${legend.customMaterialList.map((item) => item.id).join(':')}:${customMaterialLayerPosition.value}:${resolveHideCustomMaterialPartialSkillOverlap(legend.renderConfig.customImage)}`,
)

/** partial 叠放栈：描述背景在边框下，素材/出框在中层，描述文字在上层 */
const skillsDescBelowCustomMaterial = computed(() => shouldUsePartialOverlayStack(legend))

const skillsDescBackgroundChildren = computed(() =>
  (canvasConfigs.skillsDesc?.children ?? []).filter((item) => !isSkillDescRichSegment(item)),
)

const skillsDescForegroundChildren = computed(() =>
  (canvasConfigs.skillsDesc?.children ?? []).filter((item) => isSkillDescRichSegment(item)),
)

const showSkillsDescBackgroundInPartial = computed(
  () =>
    showSkillsDescLayer.value &&
    skillsDescBelowCustomMaterial.value &&
    skillsDescBackgroundChildren.value.length > 0,
)

const showSkillsDescForegroundInPartial = computed(
  () =>
    showSkillsDescLayer.value &&
    skillsDescBelowCustomMaterial.value &&
    skillsDescForegroundChildren.value.length > 0,
)
/* 暴露接口 */
defineExpose({
  syncMaterialLayout,
  reloadMaterial,
})
</script>

<template>
  <v-layer>
    <v-image
      :key="`legendImage-${canvasRenderVersion}`"
      ref="legendImageRef"
      :config="canvasConfigs.legendImage"
    />
    <!-- 默认 / top 模式：描述在边框之下（与 setup.ts 注释一致） -->
    <v-group
      v-if="showSkillsDescLayer && !skillsDescBelowCustomMaterial"
      :key="`skillsDesc-${skillsDescStructureKey}`"
      ref="skillsDescRef"
      :config="skillDescKonvaGroupConfig(canvasConfigs.skillsDesc!)"
    >
      <template v-for="item in canvasConfigs.skillsDesc?.children ?? []" :key="skillDescChildKey(item)">
        <v-rect v-if="isSkillDescRectLayer(item)" :config="item" />
        <v-image
          v-else-if="item.image"
          :key="
            isSkillDescShenBgImageLayer(item)
              ? `${item.code}-${skillsDescBgTintKey}`
              : skillDescChildKey(item)
          "
          :ref="(el) => bindSkillDescShenBgImageRef(item.code, el)"
          :config="item"
        />
        <v-text
          v-else-if="item.text"
          :key="skillDescTextSubKey(item)"
          :config="skillDescKonvaTextConfig(item)"
          __use-strict-mode
        />
      </template>
    </v-group>
    <!-- partial：描述背景仍在边框之下，避免神底图等盖住 frame -->
    <v-group
      v-if="showSkillsDescBackgroundInPartial"
      :key="`skillsDesc-bg-${skillsDescStructureKey}`"
      :config="skillDescKonvaGroupConfig(canvasConfigs.skillsDesc!)"
    >
      <template
        v-for="item in skillsDescBackgroundChildren"
        :key="skillDescChildKey(item)"
      >
        <v-rect v-if="isSkillDescRectLayer(item)" :config="item" />
        <v-image
          v-else-if="item.image"
          :key="
            isSkillDescShenBgImageLayer(item)
              ? `${item.code}-${skillsDescBgTintKey}`
              : skillDescChildKey(item)
          "
          :ref="(el) => bindSkillDescShenBgImageRef(item.code, el)"
          :config="item"
        />
      </template>
    </v-group>
    <v-group
      v-if="showFrameBaseLayer"
      :key="`frame-base-${frameLayoutKey}`"
      ref="frameRef"
      :config="canvasConfigs.frame"
    >
      <v-image
        v-for="item in visibleFrameBaseChildren"
        :key="frameImageRenderKey(item)"
        :ref="(el) => bindFrameKingdomStripRef(item.code, el)"
        :config="item"
      />
    </v-group>
    <v-group
      v-if="showCustomMaterialsLayer && customMaterialLayerPosition === 'partial'"
      :key="`customMaterials-partial-${customMaterialsRenderKey}`"
      ref="customMaterialsRef"
      :config="canvasConfigs.customMaterials"
    >
      <v-image
        v-for="item in canvasConfigs.customMaterials?.children ?? []"
        :key="item.code"
        :config="item"
      />
    </v-group>
    <v-image
      v-if="showLegendOutOfFrameLayer"
      :key="`legendOutOfFrame-partial-${canvasRenderVersion}-${legendOutOfFrameRenderVersion}`"
      ref="legendOutOfFrameRef"
      :config="canvasConfigs.legendOutOfFrame"
    />
    <!-- partial：仅描述文字/下划线叠在素材之上 -->
    <v-group
      v-if="showSkillsDescForegroundInPartial"
      :key="`skillsDesc-text-${skillsDescStructureKey}-${skillsDescTextRenderKey}`"
      ref="skillsDescRef"
      :config="skillDescKonvaGroupConfig(canvasConfigs.skillsDesc!)"
    >
      <template
        v-for="item in skillsDescForegroundChildren"
        :key="skillDescChildKey(item)"
      >
        <v-rect v-if="isSkillDescUnderlineLayer(item)" :config="item" />
        <v-text
          v-else-if="item.text"
          :key="skillDescTextSubKey(item)"
          :config="skillDescKonvaTextConfig(item)"
          __use-strict-mode
        />
      </template>
    </v-group>
    <v-group
      v-if="showKingdomFrameLayer"
      :key="`frame-kingdom-${frameKingdomTintKey}`"
      ref="frameKingdomGroupRef"
      :config="canvasConfigs.frame"
    >
      <v-image
        v-for="item in visibleKingdomFrameChildren"
        :key="frameImageRenderKey(item)"
        :ref="(el) => bindFrameKingdomStripRef(item.code, el)"
        :config="item"
      />
    </v-group>
    <v-group
      v-if="showBottomInfoLayer"
      :key="`bottomInfo-${bottomInfoRenderKey}`"
      ref="bottomInfoRef"
      :config="canvasConfigs.bottomInfo"
    >
      <template v-for="item in canvasConfigs.bottomInfo?.children ?? []" :key="item.code">
        <v-image v-if="item.image" :config="item" />
        <v-group v-else-if="item.children?.length" :config="item">
          <v-text v-for="sub in item.children" :key="sub.code" :config="sub" />
        </v-group>
        <v-text v-else :config="item" />
      </template>
    </v-group>

    <v-group
      v-if="canvasConfigs.hp?.children?.length"
      :key="`hp-${hpTintKey}`"
      ref="hpRef"
      :config="canvasConfigs.hp"
    >
      <template v-for="item in canvasConfigs.hp.children" :key="item.code">
        <v-image
          v-if="item.image"
          :key="`${item.code}-${hpTintKey}`"
          :config="item"
        />
        <v-text v-else :config="item"></v-text>
      </template>
    </v-group>

    <v-group
      v-if="skillsNameKonvaGroupConfig && skillsNameRenderChildren.length"
      :key="`skillsName-${canvasRenderVersion}-${skillsNameLayoutKey}`"
      ref="skillsNameRef"
      :config="skillsNameKonvaGroupConfig"
    >
      <template v-for="item in skillsNameRenderChildren" :key="item.code">
        <v-rect v-if="isSkillsNameHitLayer(item)" :config="item" />
        <v-image
          v-else-if="item.image"
          :key="`${item.code}-${skillsNameTintKey}`"
          :ref="(el) => bindSkillsNameSideImageRef(item.code, el)"
          :config="item"
        />
        <v-text v-else-if="item.text" :config="item" />
      </template>
    </v-group>

    <!-- 势力字置于体力/文字之上，避免点击被体力组遮挡后仍显示「武将图」 -->
    <template v-if="kingdomGlyphLayerActive && kingdomGlyphChildren.length">
      <template
        v-for="item in kingdomGlyphChildren"
        :key="`kingdom-glyph-${kingdomGlyphItemRenderKey(item)}`"
      >
        <v-group
          v-if="item.children?.length"
          :ref="(el) => registerKingdomGlyphRef(item.code, el)"
          :config="item"
        >
          <template v-for="layer in item.children" :key="layer.code">
            <v-group v-if="layer.children?.length" :config="layer">
              <component
                v-for="sub in layer.children"
                :key="sub.code"
                :is="isImageLayer(sub) ? VImage : VText"
                :config="sub"
              />
            </v-group>
            <v-image v-else-if="layer.image" :config="layer" />
            <v-text v-else :config="layer" />
          </template>
        </v-group>
        <component
          v-else
          :key="`kingdom-glyph-${kingdomGlyphItemRenderKey(item)}`"
          :is="isImageLayer(item) ? VImage : VText"
          :ref="(el) => registerKingdomGlyphRef(item.code, el)"
          :config="item"
        />
      </template>
    </template>
    <v-group
      v-else-if="showKingdomRootGroup"
      :key="`kingdom-group-${kingdomRenderKey}`"
      ref="kingdomRef"
      :config="canvasConfigs.kingdom!"
    >
      <template v-for="item in canvasConfigs.kingdom!.children" :key="item.code">
        <v-rect v-if="isKingdomDualCharHitLayer(item)" :config="item" />
        <v-group v-else-if="item.children?.length" :config="item">
          <template v-for="layer in item.children" :key="layer.code">
            <v-group v-if="layer.children?.length" :config="layer">
              <component
                v-for="sub in layer.children"
                :key="sub.code"
                :is="isImageLayer(sub) ? VImage : VText"
                :config="sub"
              />
            </v-group>
            <v-image v-else-if="layer.image" :config="layer" />
            <v-text v-else :config="layer" />
          </template>
        </v-group>
        <v-text v-else-if="item.text" :config="item" />
        <v-image v-else-if="item.image" :config="item" />
      </template>
    </v-group>
    <component
      v-else-if="showKingdomRootAsset"
      :is="canvasConfigs.kingdom?.image ? VImage : VText"
      :key="`kingdom-${kingdomRenderKey}`"
      ref="kingdomRef"
      :config="canvasConfigs.kingdom!"
    />

    <template v-if="nameSplitFlag && nameSplitChildren.length">
      <v-group
        v-for="item in nameSplitChildren"
        :key="`name-split-${item.code}-${nameRenderKey}`"
        :ref="(el) => registerSplitNameGroupRef(item.code, el)"
        :config="item"
      >
        <template v-for="layer in item.children" :key="layer.code">
          <v-rect v-if="isNameSplitHitLayer(layer)" :config="layer" />
          <v-text v-else :config="layer" />
        </template>
      </v-group>
    </template>
    <v-group
      v-else-if="canvasConfigs.name?.children?.length"
      :key="`name-${nameRenderKey}`"
      ref="nameRef"
      :config="canvasConfigs.name"
    >
      <template v-for="item in canvasConfigs.name.children" :key="item.code">
        <v-text :config="item" />
      </template>
    </v-group>

    <v-group
      v-if="canvasConfigs.title?.children?.length"
      :key="`title-${titleRenderKey}`"
      ref="titleRef"
      :config="canvasConfigs.title"
    >
      <template v-for="item in canvasConfigs.title.children" :key="item.code">
        <v-text :config="item"></v-text>
      </template>
    </v-group>

    <v-group
      v-if="showWatermarkLayer"
      :key="`watermark-${canvasRenderVersion}-${watermarkContentKey}`"
      ref="watermarkRef"
      :config="canvasConfigs.watermark"
    >
      <template v-for="item in canvasConfigs.watermark?.children ?? []" :key="item.code">
        <v-rect v-if="isWatermarkAuxRect(item)" :config="item" />
        <v-text v-else :config="item" />
      </template>
    </v-group>

    <v-group
      v-if="showPackageLayer"
      :key="`package-${packageRenderKey}`"
      ref="packageRef"
      :config="canvasConfigs.package"
    >
      <template v-for="item in canvasConfigs.package?.children ?? []" :key="packageChildRenderKey(item)">
        <v-image
          v-if="item.image"
          :ref="(el) => bindPackageTextBgImageRef(item.code, el)"
          :config="item"
        />
        <v-text v-else-if="item.text !== undefined" :config="item" />
      </template>
    </v-group>
    <v-group
      v-if="showCustomMaterialsLayer && customMaterialLayerPosition === 'top'"
      :key="`customMaterials-top-${customMaterialsRenderKey}`"
      ref="customMaterialsRef"
      :config="canvasConfigs.customMaterials"
    >
      <v-image
        v-for="item in canvasConfigs.customMaterials?.children ?? []"
        :key="item.code"
        :config="item"
      />
    </v-group>
  </v-layer>
</template>
