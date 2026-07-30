<script setup lang="ts">
import { useDiyStore } from '@/features/diy-card/stores'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { PACKAGE_IDENTIFY_CONFIG_TITLE } from '@/features/diy-card/types/diy/packageIdentify'
import { useInfoStore } from '@/features/diy-card/stores'
import { useTemplateStore } from '@/features/diy-card/stores'
import {
  applyFieldChange,
  recordModify,
  recordTextBlurModify,
  type HistoryValueFormat,
} from '@/features/diy-card/utils/diyHistoryField'
import {
  applyCustomKingdomPresetKingdom,
  applyCustomKingdomShenKingdom,
  ensureCustomKingdomSetup,
  hasCustomKingdomGlyphText,
  onDoubleKingdomEnabled,
  resetCustomKingdomGlyphLayout,
  resolveDoubleKingdomSlotDisplayLabel,
  usesShenCardLayout,
} from '@/features/diy-card/composables/doubleKingdom'
import {
  CUSTOM_DOUBLE_KINGDOM_TEXT_PLACEHOLDER,
  CUSTOM_SINGLE_KINGDOM_TEXT_PLACEHOLDER,
  DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY,
  DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY,
  DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR,
} from '@/features/diy-card/constants/customKingdomDefaults'
import {
  DEFAULT_CUSTOM_HP_COLOR,
  DEFAULT_CUSTOM_HP_COLOR_SECONDARY,
} from '@/features/diy-card/constants/customHpDefaults'
import {
  DEFAULT_CUSTOM_TITLE_COLOR,
  DEFAULT_CUSTOM_TITLE_COLOR_SECONDARY,
} from '@/features/diy-card/constants/customTitleDefaults'
import { resolveOfficialTitleColorForSlot } from '@/features/diy-card/utils/customTitleColor'
import { CUSTOM_COLOR_PICKER_UI } from '@/features/diy-card/constants/customColorPickerOptions'
import { keepNaiveColorPickerOpen } from '@/shared/utils/naive'
import {
  DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR,
  DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR_SECONDARY,
} from '@/features/diy-card/constants/customKingdomGlyphDefaults'
import {
  DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR,
  DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR_SECONDARY,
} from '@/features/diy-card/constants/customKingdomGlyphGradientDefaults'
import { applyKingdomPresetSelection, clearPresetKingdomWhenCustomTextFilled } from '@/features/diy-card/composables/kingdomPreset'
import { KINGDOM_PRESETS } from '@/features/diy-card/constants/kingdomPresets'
import { KINGDOM_DISPLAY_ORDER } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import {
  SKILL_DESC_BG_OPAQUE_DEFAULT,
  SKILL_DESC_BG_OPAQUE_SHEN_DEFAULT,
  SKILL_DESC_FONT_NEW,
  SKILL_DESC_FONT_OLD,
  SKILL_DESC_MIN_FONT_PT,
  SKILL_DESC_MAX_FONT_PT,
  SKILL_DESC_AUTO_SIZE_MIN_FONT_PT,
  SKILL_DESC_AUTO_SIZE_MAX_FONT_PT,
  SKILL_DESC_AUTO_SIZE_STEP_PT,
  SKILL_DESC_MIN_HEIGHT_MM,
  SKILL_DESC_MIN_HEIGHT_SHEN_MM,
  resolveSkillsDescAutoOptimizeFlag,
  resolveSkillsDescAutoSizeFlag,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import {
  applyCustomMaterialLayerPosition,
  CUSTOM_MATERIAL_LAYER_POSITION_OPTIONS,
  resolveCustomMaterialLayerPosition,
  resolveHideCustomMaterialPartialSkillOverlap,
} from '@/features/diy-card/utils/customMaterial'
import { applySkillsDescFontSizePt, applyQuoteFontSizePt, syncQuoteFontSizeFromSkillsDesc } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/skills-area/layout'
import { clampSkillsDescEditableFontSizePt } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/skills-area/scale'
import { applySkillsDescAutoOptimizeChange } from '@/features/diy-card/utils/skillsDescAutoOptimize'
import { applySkillsDescAutoSizeChange } from '@/features/diy-card/utils/skillsDescAutoOptimizeSize'
import {
  applyOutOfFrameIndependentLayout,
  resolveHideOutOfFrameSkillOverlap,
  resolveOutOfFrameIndependentLayout,
} from '@/features/diy-card/types/diy/outOfFrame'
import {
  syncFrameSrcToKingdom,
  applyShenKingdomGlyphColorEnabled,
  syncShenFrameGlyphColorFlag,
} from '@/features/diy-card/utils/syncFrameKingdom'
import { HelpRound, LinkOffRound, LockOpenRound, LockRound } from '@/shared/icons'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MmNumberInput from './MmNumberInput.vue'
import PtNumberInput from './PtNumberInput.vue'
import TrackingNumberInput from './TrackingNumberInput.vue'
import { useFullModeChange } from '@/features/diy-card/composables/useFullModeChange'
import { useDialog } from 'naive-ui'

const diyStore = useDiyStore()
const dialog = useDialog()
const { changeFullModeFlag } = useFullModeChange(dialog)
const infoStore = useInfoStore()
const legend = computed(() => infoStore.info as LegendInfo)
const templateStore = useTemplateStore()

const items = computed(() => legend.value.renderConfig.items)
const templateConfig = computed(() => templateStore.currentTemplate.config || {})
const isLegendTemplate = computed(
  () => templateStore.templateType === 'legend' || templateStore.templateType === 'full-legend',
)
const isShenCardLayout = computed(() => usesShenCardLayout(legend.value))

const reloadPreview = (reset = false) => {
  void diyStore.reload(reset)
}

/** 多数开关仅影响导出/排版配置，画布由模板 watch 增量重绘；勿默认全量 reload */
const onField =
  <T,>(label: string, get: () => T, set: (v: T) => void, format: HistoryValueFormat = 'default') =>
  (value: T) => {
    applyFieldChange(label, get(), value, set, {
      category: 'renderConfig',
      format,
    })
  }

const patchItemField = (
  label: string,
  read: () => number,
  write: (value: number) => void,
) =>
  (value: number | null) => {
    if (typeof value !== 'number') return
    applyFieldChange(label, read(), value, write, {
      category: 'renderConfig',
    })
  }

/** 拆分单字 / 自定义势力色等：由模板 watch 重绘，默认不走全量 reload */
const bindField =
  <T,>(
    label: string,
    get: () => T,
    set: (v: T) => void,
    format: HistoryValueFormat = 'default',
    options?: { reload?: boolean },
  ) =>
  (value: T) => {
    applyFieldChange(label, get(), value, set, {
      category: 'renderConfig',
      format,
      after: options?.reload ? reloadPreview : undefined,
    })
  }

const onNameSplitFlagChange = bindField(
  '武将名拆分单字',
  () => items.value.name.splitFlag,
  (v) => {
    items.value.name.splitFlag = v
  },
  'bool',
)

const isDoubleKingdomMode = computed(() => {
  const kingdom = legend.value.renderConfig.items.kingdom
  if (!kingdom.doubleKingdom) return false
  if (kingdom.customKingdomFlag) return true
  const list = legend.value.baseInfo.doubleKingdom?.filter((k) => k && k !== 'shen') ?? []
  return list.length >= 2
})

const doubleSingleGlyphRoleLabels = computed(() => ({
  primary: resolveDoubleKingdomSlotDisplayLabel(legend.value, 'primary'),
  secondary: resolveDoubleKingdomSlotDisplayLabel(legend.value, 'secondary'),
}))

const hideKingdomGlyphColorSetting = computed(() => {
  if (!items.value.kingdom.doubleKingdom) return false
  return !isDoubleKingdomMode.value
})

/** 非神势力字渐变：须先开「势力字自定义颜色」；神势力 / 神框 / 势力字置空时不展示 */
const showKingdomGlyphGradientSetting = computed(() => {
  if (!items.value.kingdom.glyphColorFlag) return false
  if (items.value.kingdom.glyphEmptyFlag) return false
  if (hideKingdomGlyphColorSetting.value) return false
  if (isCustomKingdomShen.value) return false
  if (usesShenCardLayout(legend.value)) return false
  return true
})

const showCustomDualCharSpacing = computed(() => {
  if (isDoubleKingdomMode.value && items.value.kingdom.doubleSingleGlyphFlag) return false
  if (isDoubleKingdomMode.value) return true
  const single = items.value.kingdom.customText.single?.trim() ?? ''
  return single.length >= 2
})

const isCustomKingdomShen = computed(() => legend.value.baseInfo.kingdom === 'shen')

/** 双势力与神势力并列展示（互斥，开启其一自动关闭另一） */
const showKingdomLinkedOptions = computed(
  () =>
    items.value.kingdom.customKingdomFlag &&
    Boolean(templateConfig.value.doubleKingdom?.value),
)

const kingdomLinkedRef = ref<HTMLElement | null>(null)
const topKingdomSwitchRef = ref<{ $el: HTMLElement } | null>(null)
const bottomKingdomSwitchRef = ref<{ $el: HTMLElement } | null>(null)

const kingdomLinkedConnector = ref({ top: '', bottom: '' })
const kingdomLinkedMarkerStyle = ref<Record<string, string>>({
  top: '0',
  left: '0',
  transform: 'translate(-50%, -50%)',
})

const KINGDOM_LINK_H_ARM = 15
const KINGDOM_LINK_GAP = 2
const KINGDOM_LINK_SPINE_TAIL = 21
const KINGDOM_LINK_CORNER_R = KINGDOM_LINK_SPINE_TAIL - KINGDOM_LINK_H_ARM
const KINGDOM_LINK_MARKER_GAP = 5
const KINGDOM_LINK_MARKER_SIZE = 16

const updateKingdomLinkedConnector = () => {
  const root = kingdomLinkedRef.value
  const topEl = topKingdomSwitchRef.value?.$el
  const bottomEl = bottomKingdomSwitchRef.value?.$el
  if (!root || !topEl || !bottomEl) return

  const rootRect = root.getBoundingClientRect()
  if (rootRect.height <= 0) return

  const topRect = topEl.getBoundingClientRect()
  const bottomRect = bottomEl.getBoundingClientRect()

  const topY = topRect.top + topRect.height / 2 - rootRect.top
  const bottomY = bottomRect.top + bottomRect.height / 2 - rootRect.top
  const topStartX = topRect.right - rootRect.left + KINGDOM_LINK_GAP
  const bottomStartX = bottomRect.right - rootRect.left + KINGDOM_LINK_GAP
  const spineX = topStartX + KINGDOM_LINK_SPINE_TAIL
  const cornerR = KINGDOM_LINK_CORNER_R

  const lockY = (topY + bottomY) / 2
  const topEndY = lockY - KINGDOM_LINK_MARKER_GAP - KINGDOM_LINK_MARKER_SIZE / 2
  const bottomStartY = lockY + KINGDOM_LINK_MARKER_GAP + KINGDOM_LINK_MARKER_SIZE / 2

  kingdomLinkedConnector.value = {
    top: `M ${topStartX} ${topY} H ${spineX - cornerR} Q ${spineX} ${topY} ${spineX} ${topY + cornerR} V ${topEndY}`,
    bottom: `M ${spineX} ${bottomStartY} V ${bottomY - cornerR} Q ${spineX} ${bottomY} ${spineX - cornerR} ${bottomY} H ${bottomStartX}`,
  }

  kingdomLinkedMarkerStyle.value = {
    top: `${lockY}px`,
    left: `${spineX}px`,
    transform: 'translate(-50%, -50%)',
  }
}

let kingdomLinkedResizeObserver: ResizeObserver | undefined

const mountKingdomLinkedConnectorObserver = () => {
  kingdomLinkedResizeObserver?.disconnect()
  if (!kingdomLinkedRef.value) return

  kingdomLinkedResizeObserver = new ResizeObserver(() => updateKingdomLinkedConnector())
  kingdomLinkedResizeObserver.observe(kingdomLinkedRef.value)

  const topEl = topKingdomSwitchRef.value?.$el
  const bottomEl = bottomKingdomSwitchRef.value?.$el
  if (topEl) kingdomLinkedResizeObserver.observe(topEl)
  if (bottomEl) kingdomLinkedResizeObserver.observe(bottomEl)

  updateKingdomLinkedConnector()
}

const onCustomKingdomShenChange = (value: boolean) => {
  const prev = legend.value.baseInfo.kingdom === 'shen'
  applyFieldChange('神势力', prev, value, (v) => {
    const info = legend.value
    if (v) {
      applyCustomKingdomShenKingdom()
    } else {
      applyCustomKingdomPresetKingdom(KINGDOM_DISPLAY_ORDER)
    }
    resetCustomKingdomGlyphLayout(v)
    ensureCustomKingdomSetup(info)
    syncFrameSrcToKingdom(info, { previousKingdom: prev ? 'shen' : undefined })
    // 神框 + 神势力不自动开；神框 + 非神势力自动开；非神框 + 神势力沿用官方色
    if (info.renderConfig.items.frame.src?.trim() === 'shen') {
      syncShenFrameGlyphColorFlag(info)
    } else {
      applyShenKingdomGlyphColorEnabled(info, v)
    }
  }, { category: 'baseInfo', format: 'bool' })
}

const onCustomShenTitleColorFlagChange = bindField(
  '神势力称号颜色更改',
  () => items.value.kingdom.customShenTitleColorFlag,
  (v) => {
    items.value.kingdom.customShenTitleColorFlag = v
  },
  'bool',
)

const presetKingdomOptions = KINGDOM_PRESETS.map((item) => ({
  label: item.label,
  value: item.key,
}))

const onPresetKingdomChange = (value: string | null) => {
  const prev = items.value.kingdom.presetKingdomKey || null
  applyFieldChange('预设势力', prev, value, (next) => {
    applyKingdomPresetSelection(legend.value, next)
  }, { category: 'renderConfig', format: 'presetKingdom' })
}

const onCustomKingdomFlagChange = (value: boolean) => {
  const prev = items.value.kingdom.customKingdomFlag
  applyFieldChange('自定义势力', prev, value, (v) => {
    items.value.kingdom.customKingdomFlag = v
    const info = legend.value
    if (!v) {
      items.value.kingdom.presetKingdomKey = ''
    }
    ensureCustomKingdomSetup(info)
    syncFrameSrcToKingdom(info)
  }, { category: 'renderConfig', format: 'bool' })
}

const onDoubleSingleGlyphFlagChange = (value: boolean) => {
  const prev = items.value.kingdom.doubleSingleGlyphFlag
  applyFieldChange('双势力单字显示', prev, value, (v) => {
    items.value.kingdom.doubleSingleGlyphFlag = v
    resetCustomKingdomGlyphLayout(false)
    ensureCustomKingdomSetup(legend.value)
  }, { category: 'renderConfig', format: 'bool' })
}

const onKingdomGlyphEmptyFlagChange = bindField(
  '势力字置空',
  () => items.value.kingdom.glyphEmptyFlag,
  (v) => {
    items.value.kingdom.glyphEmptyFlag = v
  },
  'bool',
)

const onDoubleSingleGlyphRoleChange = (value: 'primary' | 'secondary') => {
  const prev = items.value.kingdom.doubleSingleGlyphRole
  applyFieldChange('双势力显示势力', prev, value, (v) => {
    items.value.kingdom.doubleSingleGlyphRole = v
    resetCustomKingdomGlyphLayout(false)
    ensureCustomKingdomSetup(legend.value)
  }, { category: 'renderConfig', format: 'default' })
}

const onDoubleKingdomFlagChange = (value: boolean) => {
  const prev = items.value.kingdom.doubleKingdom
  applyFieldChange('双势力', prev, value, (v) => {
    const info = legend.value
    const wasCustomShen =
      items.value.kingdom.customKingdomFlag &&
      (info.baseInfo.kingdom === 'shen' ||
        info.renderConfig.items.frame.src?.trim() === 'shen')
    items.value.kingdom.doubleKingdom = v
    if (v) {
      items.value.kingdom.presetKingdomKey = ''
      onDoubleKingdomEnabled(info, KINGDOM_DISPLAY_ORDER)
      if (wasCustomShen) {
        resetCustomKingdomGlyphLayout(false)
        applyShenKingdomGlyphColorEnabled(info, false)
      }
    } else if (items.value.kingdom.customKingdomFlag) {
      resetCustomKingdomGlyphLayout(info.baseInfo.kingdom === 'shen')
    }
    ensureCustomKingdomSetup(info)
    syncFrameSrcToKingdom(info)
  }, { category: 'renderConfig', format: 'bool' })
}

/** 面板挂载或撤销/重做时同步势力可编辑状态；画布重绘由模板 watch / 开关回调负责 */
onMounted(() => {
  ensureCustomKingdomSetup(legend.value)
  nextTick(mountKingdomLinkedConnectorObserver)
})

onBeforeUnmount(() => {
  kingdomLinkedResizeObserver?.disconnect()
})

watch(showKingdomLinkedOptions, (show) => {
  if (show) nextTick(mountKingdomLinkedConnectorObserver)
})

watch(
  () => [
    items.value.kingdom.doubleKingdom,
    legend.value.baseInfo.kingdom,
    items.value.kingdom.customKingdomFlag,
  ],
  () => nextTick(updateKingdomLinkedConnector),
)

const customKingdomTextFocusMap = ref<Record<'single' | 'primary' | 'secondary', string>>({
  single: '',
  primary: '',
  secondary: '',
})
const onCustomKingdomTextFocus = (key: 'single' | 'primary' | 'secondary') => {
  customKingdomTextFocusMap.value[key] = items.value.kingdom.customText[key] ?? ''
}
const onCustomKingdomFontChange = bindField(
  '势力字体',
  () => items.value.kingdom.customFont,
  (v) => {
    items.value.kingdom.customFont = v as 1 | 2
  },
  'default',
)

const trimCustomText = (key: 'single' | 'primary' | 'secondary', maxLen: number) => {
  const raw = items.value.kingdom.customText[key] ?? ''
  const next = [...raw].slice(0, maxLen).join('')
  if (next !== raw) {
    items.value.kingdom.customText[key] = next
  }
}

const onCustomKingdomTextBlur = (
  key: 'single' | 'primary' | 'secondary',
  label: string,
) => {
  if (key === 'single') {
    trimCustomText('single', 2)
  } else {
    trimCustomText(key, 1)
  }
  const next = items.value.kingdom.customText[key] ?? ''
  if (next.trim()) {
    clearPresetKingdomWhenCustomTextFilled(legend.value)
  } else if (
    items.value.kingdom.customKingdomFlag &&
    !hasCustomKingdomGlyphText(legend.value)
  ) {
    resetCustomKingdomGlyphLayout(
      isCustomKingdomShen.value || usesShenCardLayout(legend.value),
    )
    ensureCustomKingdomSetup(legend.value)
  }
  recordTextBlurModify(label, customKingdomTextFocusMap.value[key], next, {
    category: 'renderConfig',
  })
}

type KingdomColorPickerSlot = 'single' | 'primary' | 'secondary'

const defaultKingdomColor = (slot: KingdomColorPickerSlot) => {
  if (slot === 'primary') return DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY
  if (slot === 'secondary') return DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY
  return DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR
}

const kingdomColorPicker = ref<{
  slot: KingdomColorPickerSlot
  showFlag: boolean
  value: string
}>({
  slot: 'single',
  showFlag: false,
  value: DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR,
})

const readKingdomColor = (slot: KingdomColorPickerSlot) => {
  const kingdom = items.value.kingdom
  if (slot === 'primary') return kingdom.customColorPrimary
  if (slot === 'secondary') return kingdom.customColorSecondary
  return kingdom.customColor
}

const writeKingdomColor = (slot: KingdomColorPickerSlot, value: string) => {
  if (slot === 'primary') {
    items.value.kingdom.customColorPrimary = value
    return
  }
  if (slot === 'secondary') {
    items.value.kingdom.customColorSecondary = value
    return
  }
  items.value.kingdom.customColor = value
}

const openKingdomColorPicker = (slot: KingdomColorPickerSlot) => {
  kingdomColorPicker.value.slot = slot
  kingdomColorPicker.value.value = readKingdomColor(slot) || defaultKingdomColor(slot)
  kingdomColorPicker.value.showFlag = true
}

const kingdomColorPreview = (slot: KingdomColorPickerSlot) =>
  readKingdomColor(slot) || defaultKingdomColor(slot)

const kingdomColorPickerLabel = (slot: KingdomColorPickerSlot) => {
  if (slot === 'primary') return '自定义势力色1'
  if (slot === 'secondary') return '自定义势力色2'
  return '自定义势力色'
}

const handleColorSelectorConfirm = () => {
  try {
    const slot = kingdomColorPicker.value.slot
    const prev = readKingdomColor(slot)
    const next = kingdomColorPicker.value.value
    if (prev === next) return
    writeKingdomColor(slot, next)
    recordModify(kingdomColorPickerLabel(slot), {
      category: 'renderConfig',
      before: prev,
      after: next,
    })
  } finally {
    keepNaiveColorPickerOpen(kingdomColorPicker)
  }
}

type HpColorPickerSlot = 'single' | 'primary' | 'secondary'

const defaultHpColor = (slot: HpColorPickerSlot) => {
  if (slot === 'secondary') return DEFAULT_CUSTOM_HP_COLOR_SECONDARY
  return DEFAULT_CUSTOM_HP_COLOR
}

const hpColorPicker = ref<{
  slot: HpColorPickerSlot
  showFlag: boolean
  value: string
}>({
  slot: 'single',
  showFlag: false,
  value: DEFAULT_CUSTOM_HP_COLOR,
})

const readHpColor = (slot: HpColorPickerSlot) => {
  const hp = items.value.hp
  if (slot === 'primary') return hp.customColorPrimary || hp.customColor
  if (slot === 'secondary') return hp.customColorSecondary
  return hp.customColor
}

const writeHpColor = (slot: HpColorPickerSlot, value: string) => {
  if (slot === 'primary') {
    items.value.hp.customColorPrimary = value
    return
  }
  if (slot === 'secondary') {
    items.value.hp.customColorSecondary = value
    return
  }
  items.value.hp.customColor = value
}

const openHpColorPicker = (slot: HpColorPickerSlot = 'single') => {
  hpColorPicker.value.slot = slot
  hpColorPicker.value.value = readHpColor(slot) || defaultHpColor(slot)
  hpColorPicker.value.showFlag = true
}

const hpColorPreview = (slot: HpColorPickerSlot) =>
  readHpColor(slot) || defaultHpColor(slot)

const hpColorPickerLabel = (slot: HpColorPickerSlot) => {
  if (slot === 'primary') return '自定义体力颜色1'
  if (slot === 'secondary') return '自定义体力颜色2'
  return '自定义体力颜色'
}

const handleHpColorConfirm = () => {
  try {
    const slot = hpColorPicker.value.slot
    const prev = readHpColor(slot)
    const next = hpColorPicker.value.value
    if (prev === next) return
    writeHpColor(slot, next)
    recordModify(hpColorPickerLabel(slot), {
      category: 'renderConfig',
      before: prev,
      after: next,
    })
  } finally {
    keepNaiveColorPickerOpen(hpColorPicker)
  }
}

const onCustomHpColorFlagChange = (value: boolean) => {
  applyFieldChange('自定义体力颜色', items.value.hp.customColorFlag, value, (v) => {
    items.value.hp.customColorFlag = v
    if (!v) return
    if (isDoubleKingdomMode.value) {
      if (!items.value.hp.customColorPrimary.trim() && !items.value.hp.customColor.trim()) {
        items.value.hp.customColorPrimary = DEFAULT_CUSTOM_HP_COLOR
      }
      if (!items.value.hp.customColorSecondary.trim()) {
        items.value.hp.customColorSecondary = DEFAULT_CUSTOM_HP_COLOR_SECONDARY
      }
    } else if (!items.value.hp.customColor.trim()) {
      items.value.hp.customColor = DEFAULT_CUSTOM_HP_COLOR
    }
  }, { category: 'renderConfig', format: 'bool' })
}

type TitleColorPickerSlot = 'single' | 'primary' | 'secondary'

const defaultTitleColor = (slot: TitleColorPickerSlot) => {
  if (slot === 'secondary') return DEFAULT_CUSTOM_TITLE_COLOR_SECONDARY
  return DEFAULT_CUSTOM_TITLE_COLOR
}

const titleColorPicker = ref<{
  slot: TitleColorPickerSlot
  showFlag: boolean
  value: string
}>({
  slot: 'single',
  showFlag: false,
  value: DEFAULT_CUSTOM_TITLE_COLOR,
})

const readTitleColor = (slot: TitleColorPickerSlot) => {
  const title = items.value.title
  if (slot === 'primary') return title.customColorPrimary || title.customColor
  if (slot === 'secondary') return title.customColorSecondary
  return title.customColor
}

const writeTitleColor = (slot: TitleColorPickerSlot, value: string) => {
  if (slot === 'primary') {
    items.value.title.customColorPrimary = value
    return
  }
  if (slot === 'secondary') {
    items.value.title.customColorSecondary = value
    return
  }
  items.value.title.customColor = value
}

const openTitleColorPicker = (slot: TitleColorPickerSlot = 'single') => {
  titleColorPicker.value.slot = slot
  titleColorPicker.value.value = readTitleColor(slot) || defaultTitleColor(slot)
  titleColorPicker.value.showFlag = true
}

const titleColorPreview = (slot: TitleColorPickerSlot): string =>
  readTitleColor(slot) || defaultTitleColor(slot)

const titleColorPickerLabel = (slot: TitleColorPickerSlot) => {
  if (slot === 'primary') return '自定义称号颜色1'
  if (slot === 'secondary') return '自定义称号颜色2'
  return '自定义称号颜色'
}

const handleTitleColorConfirm = () => {
  try {
    const slot = titleColorPicker.value.slot
    const prev = readTitleColor(slot)
    const next = titleColorPicker.value.value
    if (prev === next) return
    writeTitleColor(slot, next)
    recordModify(titleColorPickerLabel(slot), {
      category: 'renderConfig',
      before: prev,
      after: next,
    })
  } finally {
    keepNaiveColorPickerOpen(titleColorPicker)
  }
}

const onCustomTitleColorFlagChange = (value: boolean) => {
  applyFieldChange('自定义称号颜色', items.value.title.customColorFlag, value, (v) => {
    items.value.title.customColorFlag = v
    if (!v) return
    if (isDoubleKingdomMode.value) {
      if (!items.value.title.customColorPrimary.trim() && !items.value.title.customColor.trim()) {
        items.value.title.customColorPrimary =
          resolveOfficialTitleColorForSlot(legend.value, 'primary') ??
          DEFAULT_CUSTOM_TITLE_COLOR
      }
      if (!items.value.title.customColorSecondary.trim()) {
        items.value.title.customColorSecondary =
          resolveOfficialTitleColorForSlot(legend.value, 'secondary') ??
          DEFAULT_CUSTOM_TITLE_COLOR_SECONDARY
      }
    } else if (!items.value.title.customColor.trim()) {
      items.value.title.customColor =
        resolveOfficialTitleColorForSlot(legend.value, 'single') ?? DEFAULT_CUSTOM_TITLE_COLOR
    }
  }, { category: 'renderConfig', format: 'bool' })
}

type KingdomGlyphColorPickerSlot = 'single' | 'primary' | 'secondary'

const defaultKingdomGlyphColor = (slot: KingdomGlyphColorPickerSlot) => {
  if (slot === 'secondary') return DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR_SECONDARY
  return DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR
}

const kingdomGlyphColorPicker = ref<{
  slot: KingdomGlyphColorPickerSlot
  showFlag: boolean
  value: string
}>({
  slot: 'single',
  showFlag: false,
  value: DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR,
})

const readKingdomGlyphColor = (slot: KingdomGlyphColorPickerSlot) => {
  const kingdom = items.value.kingdom
  if (slot === 'primary') return kingdom.glyphColorPrimary || kingdom.glyphColor
  if (slot === 'secondary') return kingdom.glyphColorSecondary
  return kingdom.glyphColor
}

const writeKingdomGlyphColor = (slot: KingdomGlyphColorPickerSlot, value: string) => {
  if (slot === 'primary') {
    items.value.kingdom.glyphColorPrimary = value
    return
  }
  if (slot === 'secondary') {
    items.value.kingdom.glyphColorSecondary = value
    return
  }
  items.value.kingdom.glyphColor = value
}

const openKingdomGlyphColorPicker = (slot: KingdomGlyphColorPickerSlot = 'single') => {
  kingdomGlyphColorPicker.value.slot = slot
  kingdomGlyphColorPicker.value.value =
    readKingdomGlyphColor(slot) || defaultKingdomGlyphColor(slot)
  kingdomGlyphColorPicker.value.showFlag = true
}

const kingdomGlyphColorPreview = (slot: KingdomGlyphColorPickerSlot) =>
  readKingdomGlyphColor(slot) || defaultKingdomGlyphColor(slot)

const kingdomGlyphColorPickerLabel = (slot: KingdomGlyphColorPickerSlot) => {
  if (slot === 'primary') return '势力字颜色1'
  if (slot === 'secondary') return '势力字颜色2'
  return '势力字颜色'
}

const handleKingdomGlyphColorConfirm = () => {
  try {
    const slot = kingdomGlyphColorPicker.value.slot
    const prev = readKingdomGlyphColor(slot)
    const next = kingdomGlyphColorPicker.value.value
    if (prev === next) return
    writeKingdomGlyphColor(slot, next)
    recordModify(kingdomGlyphColorPickerLabel(slot), {
      category: 'renderConfig',
      before: prev,
      after: next,
    })
  } finally {
    keepNaiveColorPickerOpen(kingdomGlyphColorPicker)
  }
}

const showDualKingdomGlyphColorPickers = computed(
  () => isDoubleKingdomMode.value && !items.value.kingdom.doubleSingleGlyphFlag,
)

const onCustomKingdomGlyphColorFlagChange = (value: boolean) => {
  if (hideKingdomGlyphColorSetting.value) return
  applyFieldChange('势力字自定义颜色', items.value.kingdom.glyphColorFlag, value, (v) => {
    items.value.kingdom.glyphColorFlag = v
    if (!v) {
      items.value.kingdom.glyphGradientFlag = false
      return
    }
    if (showDualKingdomGlyphColorPickers.value) {
      if (
        !items.value.kingdom.glyphColorPrimary.trim() &&
        !items.value.kingdom.glyphColor.trim()
      ) {
        items.value.kingdom.glyphColorPrimary = DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR
      }
      if (!items.value.kingdom.glyphColorSecondary.trim()) {
        items.value.kingdom.glyphColorSecondary = DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR_SECONDARY
      }
    } else if (!items.value.kingdom.glyphColor.trim()) {
      items.value.kingdom.glyphColor = DEFAULT_CUSTOM_KINGDOM_GLYPH_COLOR
    }
  }, { category: 'renderConfig', format: 'bool' })
}

type KingdomGlyphGradientEndPickerSlot = KingdomGlyphColorPickerSlot

const defaultKingdomGlyphGradientEndColor = (slot: KingdomGlyphGradientEndPickerSlot) => {
  if (slot === 'secondary') return DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR_SECONDARY
  return DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR
}

const kingdomGlyphGradientColorPicker = ref<{
  slot: KingdomGlyphGradientEndPickerSlot
  showFlag: boolean
  value: string
}>({
  slot: 'single',
  showFlag: false,
  value: DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR,
})

const readKingdomGlyphGradientEndColor = (slot: KingdomGlyphGradientEndPickerSlot = 'single') => {
  const kingdom = items.value.kingdom
  if (slot === 'primary') {
    return kingdom.glyphGradientEndColorPrimary || kingdom.glyphGradientEndColor
  }
  if (slot === 'secondary') return kingdom.glyphGradientEndColorSecondary
  return kingdom.glyphGradientEndColor
}

const writeKingdomGlyphGradientEndColor = (
  slot: KingdomGlyphGradientEndPickerSlot,
  value: string,
) => {
  if (slot === 'primary') {
    items.value.kingdom.glyphGradientEndColorPrimary = value
    return
  }
  if (slot === 'secondary') {
    items.value.kingdom.glyphGradientEndColorSecondary = value
    return
  }
  items.value.kingdom.glyphGradientEndColor = value
}

const kingdomGlyphGradientEndPreview = (slot: KingdomGlyphGradientEndPickerSlot) =>
  readKingdomGlyphGradientEndColor(slot)?.trim() || defaultKingdomGlyphGradientEndColor(slot)

const kingdomGlyphGradientEndPickerLabel = (slot: KingdomGlyphGradientEndPickerSlot) => {
  if (slot === 'primary') return '渐变终点色1'
  if (slot === 'secondary') return '渐变终点色2'
  return '渐变终点色'
}

const openKingdomGlyphGradientColorPicker = (slot: KingdomGlyphGradientEndPickerSlot = 'single') => {
  kingdomGlyphGradientColorPicker.value.slot = slot
  kingdomGlyphGradientColorPicker.value.value =
    readKingdomGlyphGradientEndColor(slot)?.trim() || defaultKingdomGlyphGradientEndColor(slot)
  kingdomGlyphGradientColorPicker.value.showFlag = true
}

const onKingdomGlyphGradientFlagChange = (value: boolean) => {
  if (!showKingdomGlyphGradientSetting.value) return
  applyFieldChange('势力字渐变', items.value.kingdom.glyphGradientFlag, value, (v) => {
    items.value.kingdom.glyphGradientFlag = v
    if (!v) return
    if (showDualKingdomGlyphColorPickers.value) {
      if (
        !items.value.kingdom.glyphGradientEndColorPrimary.trim() &&
        !items.value.kingdom.glyphGradientEndColor.trim()
      ) {
        items.value.kingdom.glyphGradientEndColorPrimary = DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR
      }
      if (!items.value.kingdom.glyphGradientEndColorSecondary.trim()) {
        items.value.kingdom.glyphGradientEndColorSecondary =
          DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR_SECONDARY
      }
    } else if (!items.value.kingdom.glyphGradientEndColor.trim()) {
      items.value.kingdom.glyphGradientEndColor = DEFAULT_KINGDOM_GLYPH_GRADIENT_END_COLOR
    }
  }, { category: 'renderConfig', format: 'bool' })
}

const handleKingdomGlyphGradientColorConfirm = () => {
  try {
    const slot = kingdomGlyphGradientColorPicker.value.slot
    const prev = readKingdomGlyphGradientEndColor(slot)?.trim() || defaultKingdomGlyphGradientEndColor(slot)
    const next = kingdomGlyphGradientColorPicker.value.value
    if (prev === next) return
    writeKingdomGlyphGradientEndColor(slot, next)
    recordModify(kingdomGlyphGradientEndPickerLabel(slot), {
      category: 'renderConfig',
      before: prev,
      after: next,
    })
  } finally {
    keepNaiveColorPickerOpen(kingdomGlyphGradientColorPicker)
  }
}

const hideOutOfFrameSkillOverlap = computed(() =>
  resolveHideOutOfFrameSkillOverlap(legend.value.renderConfig.items.legendImage),
)

const onHideOutOfFrameSkillOverlapChange = onField(
  '隐藏出框技能框重叠',
  () => hideOutOfFrameSkillOverlap.value,
  (val) => {
    legend.value.renderConfig.items.legendImage.hideOutOfFrameSkillOverlap = val
  },
  'bool',
)

const outOfFrameIndependentLayout = computed(() =>
  resolveOutOfFrameIndependentLayout(legend.value.renderConfig.items.legendImage),
)

const onOutOfFrameIndependentLayoutChange = onField(
  '出框独立布局',
  () => outOfFrameIndependentLayout.value,
  (val) => {
    applyOutOfFrameIndependentLayout(legend.value, val)
  },
  'bool',
)

const onCustomMaterialLayerPositionChange = onField(
  '自定义素材图层位置',
  () => resolveCustomMaterialLayerPosition(legend.value),
  (val) => {
    applyCustomMaterialLayerPosition(legend.value.renderConfig.customImage, val)
  },
)

const hideCustomMaterialPartialSkillOverlap = computed(() =>
  resolveHideCustomMaterialPartialSkillOverlap(legend.value.renderConfig.customImage),
)

const onHideCustomMaterialPartialSkillOverlapChange = onField(
  '隐藏覆盖边框技能区重叠',
  () => hideCustomMaterialPartialSkillOverlap.value,
  (val) => {
    legend.value.renderConfig.customImage.hidePartialSkillOverlap = val
  },
  'bool',
)

const onNameConvertTChChange = onField(
  '武将名繁体转化',
  () => items.value.name.convertTChFlag,
  (val) => {
    items.value.name.convertTChFlag = val
  },
  'bool',
)

const onTitleConvertTChChange = onField(
  '武将称号繁体转化',
  () => items.value.title.convertTChFlag,
  (val) => {
    items.value.title.convertTChFlag = val
  },
  'bool',
)

const onSkillsNameConvertTChChange = onField(
  '技能名繁体转化',
  () => items.value.skillsName.convertTChFlag,
  (val) => {
    items.value.skillsName.convertTChFlag = val
  },
  'bool',
)

const onSkillsNameMarginTopChange = patchItemField(
  '技能名上边距',
  () => items.value.skillsName.marginTop,
  (val) => {
    items.value.skillsName.marginTop = val
  },
)

const onSkillsDescNewFontChange = onField(
  '技能描述新版字体',
  () => items.value.skillsDesc.newFontFlag,
  (val) => {
    items.value.skillsDesc.newFontFlag = val
  },
  'bool',
)

const skillsDescCurrentFontLabel = computed(() =>
  items.value.skillsDesc.newFontFlag ? SKILL_DESC_FONT_NEW : SKILL_DESC_FONT_OLD,
)

const onSkillsDescAutoOptimizeChange = (value: boolean) => {
  applySkillsDescAutoOptimizeChange(legend.value, value)
}

const onSkillsDescAutoSizeChange = (value: boolean) => {
  applySkillsDescAutoSizeChange(legend.value, value)
}

const onSkillsDescAutoFullNumberChange = onField(
  '技能描述自动全角',
  () => items.value.skillsDesc.autoFullNumberFlag,
  (val) => {
    items.value.skillsDesc.autoFullNumberFlag = val
  },
  'bool',
)

const onSkillsDescTextBoldChange = onField(
  '技能描述加粗',
  () => items.value.skillsDesc.textBoldFlag,
  (val) => {
    items.value.skillsDesc.textBoldFlag = val
  },
  'bool',
)

const onBottomInfoStrokeChange = onField(
  '底部描边',
  () => items.value.bottomInfo.strokeFlag,
  (val) => {
    items.value.bottomInfo.strokeFlag = val
  },
  'bool',
)

const onBottomInfoMarginLeftChange = patchItemField(
  '底部信息左边距',
  () => items.value.bottomInfo.marginLeft,
  (val) => {
    items.value.bottomInfo.marginLeft = Math.max(0, val)
  },
)

const onBottomInfoMarginRightChange = patchItemField(
  '底部信息右边距',
  () => items.value.bottomInfo.marginRight,
  (val) => {
    items.value.bottomInfo.marginRight = Math.max(0, val)
  },
)

const onPackageConvertTChChange = onField(
  '角标繁体转化',
  () => items.value.package.convertTChFlag,
  (val) => {
    items.value.package.convertTChFlag = val
  },
  'bool',
)

const onCustomDualCharSpacingChange = patchItemField(
  '势力两字间距',
  () => items.value.kingdom.customDualCharSpacingMm,
  (val) => {
    items.value.kingdom.customDualCharSpacingMm = val
  },
)

const onNameSpacingChange = patchItemField(
  '武将名字间距',
  () => items.value.name.characterSpacing,
  (val) => {
    items.value.name.characterSpacing = val
  },
)

const onTitleSpacingChange = patchItemField(
  '武将称号字间距',
  () => items.value.title.characterSpacing,
  (val) => {
    items.value.title.characterSpacing = val
  },
)

const skillsDescAutoOptimizeEnabled = computed(() =>
  resolveSkillsDescAutoOptimizeFlag(items.value.skillsDesc.autoOptimizeFlag),
)

const skillsDescAutoSizeEnabled = computed(() =>
  resolveSkillsDescAutoSizeFlag(
    items.value.skillsDesc.autoOptimizeSizeFlag,
    items.value.skillsDesc.autoOptimizeFlag,
  ),
)

const onSkillsDescSizeChange = (value: number | null) => {
  if (typeof value !== 'number') return
  const nextSize = clampSkillsDescEditableFontSizePt(
    value,
    skillsDescAutoSizeEnabled.value,
  )
  applyFieldChange(
    '技能描述字号',
    items.value.skillsDesc.size ?? 0,
    nextSize,
    (val) => {
      applySkillsDescFontSizePt(legend.value, val, {
        markManual: skillsDescAutoSizeEnabled.value,
      })
    },
    { category: 'renderConfig' },
  )
}

const skillsDescSizeMin = computed(() =>
  skillsDescAutoSizeEnabled.value
    ? SKILL_DESC_AUTO_SIZE_MIN_FONT_PT
    : SKILL_DESC_MIN_FONT_PT,
)
const skillsDescSizeMax = computed(() =>
  skillsDescAutoSizeEnabled.value
    ? SKILL_DESC_AUTO_SIZE_MAX_FONT_PT
    : SKILL_DESC_MAX_FONT_PT,
)
const skillsDescSizeStep = computed(() =>
  skillsDescAutoSizeEnabled.value ? SKILL_DESC_AUTO_SIZE_STEP_PT : 0.5,
)

const onSkillsDescParaSpacingChange = patchItemField(
  '技能描述段间距',
  () => items.value.skillsDesc.paraSpacing,
  (val) => {
    items.value.skillsDesc.paraSpacing = val
  },
)

const onSkillsDescSingleLineParaSpacingChange = patchItemField(
  '技能描述单行段间距',
  () => items.value.skillsDesc.singleLineParaSpacing,
  (val) => {
    items.value.skillsDesc.singleLineParaSpacing = val
  },
)

const onSkillsDescRowSpacingChange = patchItemField(
  '技能描述行间距',
  () => items.value.skillsDesc.rowSpacing,
  (val) => {
    items.value.skillsDesc.rowSpacing = val
  },
)

const onSkillsDescCharacterSpacingChange = patchItemField(
  '技能描述字间距',
  () => items.value.skillsDesc.characterSpacing,
  (val) => {
    items.value.skillsDesc.characterSpacing = val
  },
)

const onSkillsDescMarginTopChange = patchItemField(
  '技能描述上边距',
  () => items.value.skillsDesc.marginTop,
  (val) => {
    items.value.skillsDesc.marginTop = val
  },
)

const onSkillsDescMarginBottomChange = patchItemField(
  '技能描述下边距',
  () => items.value.skillsDesc.marginBottom,
  (val) => {
    items.value.skillsDesc.marginBottom = val
  },
)

const onSkillsDescMarginLeftChange = patchItemField(
  '技能描述左边距',
  () => items.value.skillsDesc.marginLeft,
  (val) => {
    items.value.skillsDesc.marginLeft = val
  },
)

const onSkillsDescMarginRightChange = patchItemField(
  '技能描述右边距',
  () => items.value.skillsDesc.marginRight,
  (val) => {
    items.value.skillsDesc.marginRight = val
  },
)

const skillsDescMinHeightDefaultMm = computed(() =>
  isShenCardLayout.value ? SKILL_DESC_MIN_HEIGHT_SHEN_MM : SKILL_DESC_MIN_HEIGHT_MM,
)

const skillsDescMinHeightMm = computed(
  () => items.value.skillsDesc.minHeightMm ?? skillsDescMinHeightDefaultMm.value,
)

const onSkillsDescMinHeightChange = (value: number | null) => {
  const defaultMm = skillsDescMinHeightDefaultMm.value
  const prev = items.value.skillsDesc.minHeightMm ?? defaultMm
  if (value === null) {
    applyFieldChange('技能区最小高度', prev, defaultMm, () => {
      delete items.value.skillsDesc.minHeightMm
    }, { category: 'renderConfig' })
    return
  }
  const next = Math.max(0, value)
  if (next === defaultMm) {
    applyFieldChange('技能区最小高度', prev, defaultMm, () => {
      delete items.value.skillsDesc.minHeightMm
    }, { category: 'renderConfig' })
    return
  }
  applyFieldChange('技能区最小高度', prev, next, (val) => {
    items.value.skillsDesc.minHeightMm = val
  }, { category: 'renderConfig' })
}

const skillsDescBgOpaqueDefault = computed(() =>
  isShenCardLayout.value
    ? SKILL_DESC_BG_OPAQUE_SHEN_DEFAULT
    : SKILL_DESC_BG_OPAQUE_DEFAULT,
)

const skillsDescBgOpaquePercent = computed(() =>
  Math.round((items.value.skillsDesc.bgOpaque ?? skillsDescBgOpaqueDefault.value) * 100),
)

const onSkillsDescBgOpaqueChange = (value: number | null) => {
  if (typeof value !== 'number') return
  const nextOpaque = Math.min(100, Math.max(0, value)) / 100
  const prevOpaque = items.value.skillsDesc.bgOpaque ?? skillsDescBgOpaqueDefault.value
  applyFieldChange(
    '技能描述背景不透明度',
    Math.round(prevOpaque * 100),
    Math.round(nextOpaque * 100),
    (percent) => {
      items.value.skillsDesc.bgOpaque = percent / 100
    },
    { category: 'renderConfig' },
  )
}

const onQuoteSizeChange = (value: number | null) => {
  if (typeof value !== 'number') return
  applyFieldChange(
    '引言字号',
    items.value.quote.size ?? 0,
    value,
    (val) => {
      applyQuoteFontSizePt(legend.value, val)
    },
    { category: 'renderConfig' },
  )
}

const onQuoteSizeLockToggle = () => {
  const quote = items.value.quote
  const prev = Boolean(quote.lockSizeFlag)
  const next = !prev
  applyFieldChange(
    next ? '锁定引言字号' : '解锁引言字号',
    prev,
    next,
    (locked) => {
      quote.lockSizeFlag = locked
      if (!locked) {
        const descSize = items.value.skillsDesc.size
        if (typeof descSize === 'number' && descSize > 0) {
          syncQuoteFontSizeFromSkillsDesc(legend.value, descSize, { force: true })
        }
      }
    },
    { category: 'renderConfig' },
  )
}

const onQuoteCharacterSpacingChange = patchItemField(
  '引言字间距',
  () => items.value.quote.characterSpacing,
  (val) => {
    items.value.quote.characterSpacing = val
  },
)

const onQuoteMarginTopChange = patchItemField(
  '引言上边距',
  () => items.value.quote.marginTop,
  (val) => {
    items.value.quote.marginTop = val
  },
)

const onQuoteMarginBottomChange = patchItemField(
  '引言下边距',
  () => items.value.quote.marginBottom,
  (val) => {
    items.value.quote.marginBottom = Math.max(0, val)
  },
)

const onQuoteMarginLeftChange = patchItemField(
  '引言左边距',
  () => items.value.quote.marginLeft,
  (val) => {
    items.value.quote.marginLeft = Math.max(0, val)
  },
)

const onQuoteMarginRightChange = patchItemField(
  '引言右边距',
  () => items.value.quote.marginRight,
  (val) => {
    items.value.quote.marginRight = Math.max(0, val)
  },
)
</script>

<template>
  <n-empty v-if="!isLegendTemplate" description="当前模板暂无额外配置" />
  <n-el v-else class="other-config">
    <n-form label-placement="left" label-width="124" size="medium">
      <n-collapse
        :default-expanded-names="[
          'display',
          'legendImage',
          'customImage',
          'watermark',
          'kingdom',
          'kingdomGlyph',
          'hp',
          'name',
          'title',
          'skillsName',
          'skillsDesc',
          'quote',
          'bottomInfo',
          'package',
        ]"
      >
        <n-collapse-item title="显示设置" name="display">
          <n-form-item label="全幅模式">
            <n-switch
              :value="legend.renderConfig.display.fullModeFlag"
              @update:value="changeFullModeFlag"
            >
              <template #checked> 打开 </template>
              <template #unchecked> 关闭 </template>
            </n-switch>
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item title="武将图" name="legendImage">
          <n-form-item label="出框重叠">
            <div class="other-config__field-stack">
              <n-switch
                :value="hideOutOfFrameSkillOverlap"
                @update:value="onHideOutOfFrameSkillOverlapChange"
              >
                <template #checked>隐藏</template>
                <template #unchecked>显示</template>
              </n-switch>
              <p class="other-config__field-hint">
                打开后，人物出框图与技能区重叠部分会自动隐藏（左侧边框区保留）
              </p>
            </div>
          </n-form-item>
          <n-form-item label="出框独立">
            <div class="other-config__field-stack">
              <n-switch
                :value="outOfFrameIndependentLayout"
                @update:value="onOutOfFrameIndependentLayoutChange"
              >
                <template #checked>开启</template>
                <template #unchecked>关闭</template>
              </n-switch>
              <p class="other-config__field-hint">
                打开后，人物出框图可作为独立元素单独拖拽、缩放与旋转，不再跟随武将图
              </p>
            </div>
          </n-form-item>
        </n-collapse-item>
        <n-collapse-item title="自定义素材" name="customImage">
          <n-form-item label="图层位置">
            <div class="other-config__field-stack">
              <n-radio-group
                :value="resolveCustomMaterialLayerPosition(legend)"
                @update:value="onCustomMaterialLayerPositionChange"
              >
                <n-space vertical :size="8">
                  <n-radio
                    v-for="option in CUSTOM_MATERIAL_LAYER_POSITION_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </n-radio>
                </n-space>
              </n-radio-group>
              <p class="other-config__field-hint">
                {{
                  CUSTOM_MATERIAL_LAYER_POSITION_OPTIONS.find(
                    (item) => item.value === resolveCustomMaterialLayerPosition(legend),
                  )?.description
                }}
              </p>
            </div>
          </n-form-item>
          <n-form-item
            v-if="resolveCustomMaterialLayerPosition(legend) === 'partial'"
            label="技能重叠"
          >
            <div class="other-config__field-stack">
              <n-switch
                :value="hideCustomMaterialPartialSkillOverlap"
                @update:value="onHideCustomMaterialPartialSkillOverlapChange"
              >
                <template #checked>隐藏</template>
                <template #unchecked>显示</template>
              </n-switch>
              <p class="other-config__field-hint">
                打开后，覆盖边框素材与技能区重叠部分会自动隐藏（左侧边框区保留）
              </p>
            </div>
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item title="武将势力" name="kingdom">
          <n-form-item label="预设势力">
            <n-select
              :value="items.kingdom.presetKingdomKey || null"
              :options="presetKingdomOptions"
              clearable
              placeholder="这里有一堆势力哦~"
              @update:value="onPresetKingdomChange"
            />
          </n-form-item>
          <n-form-item label="自定义势力色">
            <n-switch
              :value="items.kingdom.customKingdomFlag"
              @update:value="onCustomKingdomFlagChange"
            >
              <template #checked> 打开 </template>
              <template #unchecked> 关闭 </template>
            </n-switch>
          </n-form-item>
          <div
            v-if="showKingdomLinkedOptions"
            ref="kingdomLinkedRef"
            class="other-config__kingdom-linked"
            role="group"
            aria-label="双势力与神势力互斥"
          >
            <label class="other-config__kingdom-linked-label">双势力</label>
            <n-switch
              ref="topKingdomSwitchRef"
              class="other-config__kingdom-linked-switch"
              :value="items.kingdom.doubleKingdom"
              @update:value="onDoubleKingdomFlagChange"
            >
              <template #checked> 打开 </template>
              <template #unchecked> 关闭 </template>
            </n-switch>
            <label class="other-config__kingdom-linked-label">神势力</label>
            <n-switch
              ref="bottomKingdomSwitchRef"
              class="other-config__kingdom-linked-switch"
              :value="isCustomKingdomShen"
              @update:value="onCustomKingdomShenChange"
            >
              <template #checked> 是 </template>
              <template #unchecked> 否 </template>
            </n-switch>
            <div class="other-config__kingdom-linked-overlay" aria-hidden="true">
              <svg class="other-config__kingdom-linked-svg">
                <path :d="kingdomLinkedConnector.top" />
                <path :d="kingdomLinkedConnector.bottom" />
              </svg>
              <n-tooltip trigger="hover" placement="right">
                <template #trigger>
                  <n-icon
                    class="other-config__kingdom-linked-mutex"
                    :size="16"
                    :style="kingdomLinkedMarkerStyle"
                  >
                    <LinkOffRound />
                  </n-icon>
                </template>
                互斥：不可同时开启（非锁定）
              </n-tooltip>
            </div>
          </div>
          <n-form-item v-else-if="items.kingdom.customKingdomFlag" label="神势力">
            <n-switch
              :value="isCustomKingdomShen"
              @update:value="onCustomKingdomShenChange"
            >
              <template #checked> 是 </template>
              <template #unchecked> 否 </template>
            </n-switch>
          </n-form-item>
          <n-form-item
            v-if="items.kingdom.customKingdomFlag && isCustomKingdomShen"
            label="称号颜色更改"
          >
            <n-switch
              :value="items.kingdom.customShenTitleColorFlag"
              @update:value="onCustomShenTitleColorFlagChange"
            >
              <template #checked> 打开 </template>
              <template #unchecked> 关闭 </template>
            </n-switch>
          </n-form-item>
          <template v-if="items.kingdom.customKingdomFlag">
            <n-form-item
              v-if="templateConfig.customKingdomColor?.value"
              label="势力色"
            >
              <div
                v-if="isDoubleKingdomMode"
                class="other-config__kingdom-colors"
              >
                <div class="other-config__color-row">
                  <span class="other-config__color-label">势力1</span>
                  <div
                    class="other-config__color-swatch"
                    :style="{ backgroundColor: kingdomColorPreview('primary') }"
                    @click="openKingdomColorPicker('primary')"
                  />
                </div>
                <div class="other-config__color-row">
                  <span class="other-config__color-label">势力2</span>
                  <div
                    class="other-config__color-swatch"
                    :style="{ backgroundColor: kingdomColorPreview('secondary') }"
                    @click="openKingdomColorPicker('secondary')"
                  />
                </div>
              </div>
              <div v-else class="other-config__color">
                <div
                  class="other-config__color-swatch"
                  :style="{ backgroundColor: kingdomColorPreview('single') }"
                  @click="openKingdomColorPicker('single')"
                />
              </div>
              <n-color-picker
                v-model:show="kingdomColorPicker.showFlag"
                v-model:value="kingdomColorPicker.value"
                class="other-config__color-picker"
                :show-alpha="CUSTOM_COLOR_PICKER_UI.kingdomCustom.showAlpha"
                :modes="CUSTOM_COLOR_PICKER_UI.kingdomCustom.modes"
                :swatches="CUSTOM_COLOR_PICKER_UI.kingdomCustom.swatches"
                :actions="['confirm']"
                @confirm="handleColorSelectorConfirm"
              />
            </n-form-item>
          </template>
        </n-collapse-item>

        <n-collapse-item title="势力字" name="kingdomGlyph">
          <n-form-item label="势力字置空">
            <n-switch
              :value="items.kingdom.glyphEmptyFlag"
              @update:value="onKingdomGlyphEmptyFlagChange"
            >
              <template #checked> 置空 </template>
              <template #unchecked> 显示 </template>
            </n-switch>
          </n-form-item>
          <n-form-item v-if="isDoubleKingdomMode" label="单势力字">
            <n-switch
              :value="items.kingdom.doubleSingleGlyphFlag"
              @update:value="onDoubleSingleGlyphFlagChange"
            >
              <template #checked> 打开 </template>
              <template #unchecked> 关闭 </template>
            </n-switch>
          </n-form-item>
          <n-form-item
            v-if="isDoubleKingdomMode && items.kingdom.doubleSingleGlyphFlag"
            label="选择势力字"
          >
            <n-radio-group
              :value="items.kingdom.doubleSingleGlyphRole"
              @update:value="onDoubleSingleGlyphRoleChange"
            >
              <n-radio value="primary">
                势力1（{{ doubleSingleGlyphRoleLabels.primary }}）
              </n-radio>
              <n-radio value="secondary">
                势力2（{{ doubleSingleGlyphRoleLabels.secondary }}）
              </n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item label="势力字体">
            <n-radio-group
              :value="items.kingdom.customFont"
              @update:value="onCustomKingdomFontChange"
            >
              <n-radio :value="1">字体1（汉仪尚巍手书）</n-radio>
              <n-radio :value="2">字体2（汉仪秦川飞影）</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item
            v-if="templateConfig.customKingdomName?.value"
            label="自定义势力字"
          >
            <div class="other-config__kingdom-texts">
              <template v-if="isDoubleKingdomMode">
                <n-input
                  v-model:value="items.kingdom.customText.primary"
                  maxlength="1"
                  :placeholder="CUSTOM_DOUBLE_KINGDOM_TEXT_PLACEHOLDER.primary"
                  @focus="onCustomKingdomTextFocus('primary')"
                  @blur="onCustomKingdomTextBlur('primary', '自定义势力字1')"
                />
                <n-input
                  v-model:value="items.kingdom.customText.secondary"
                  maxlength="1"
                  :placeholder="CUSTOM_DOUBLE_KINGDOM_TEXT_PLACEHOLDER.secondary"
                  @focus="onCustomKingdomTextFocus('secondary')"
                  @blur="onCustomKingdomTextBlur('secondary', '自定义势力字2')"
                />
              </template>
              <n-input
                v-else
                v-model:value="items.kingdom.customText.single"
                maxlength="2"
                :placeholder="CUSTOM_SINGLE_KINGDOM_TEXT_PLACEHOLDER"
                @focus="onCustomKingdomTextFocus('single')"
                @blur="onCustomKingdomTextBlur('single', '自定义势力字')"
              />
            </div>
          </n-form-item>
          <n-form-item v-if="showCustomDualCharSpacing" label="两字间距">
            <MmNumberInput
              :value="items.kingdom.customDualCharSpacingMm"
              @update:value="onCustomDualCharSpacingChange"
            />
          </n-form-item>
          <template v-if="!hideKingdomGlyphColorSetting">
            <n-form-item label="自定义颜色">
              <n-switch
                :value="Boolean(items.kingdom.glyphColorFlag)"
                @update:value="onCustomKingdomGlyphColorFlagChange"
              >
                <template #checked> 打开 </template>
                <template #unchecked> 关闭 </template>
              </n-switch>
            </n-form-item>
            <n-form-item v-if="items.kingdom.glyphColorFlag" label="势力字颜色">
              <div
                v-if="showDualKingdomGlyphColorPickers"
                class="other-config__kingdom-colors"
              >
                <div class="other-config__color-row">
                  <span class="other-config__color-label">势力1（左）</span>
                  <div
                    class="other-config__color-swatch"
                    :style="{ backgroundColor: kingdomGlyphColorPreview('primary') }"
                    @click="openKingdomGlyphColorPicker('primary')"
                  />
                </div>
                <div class="other-config__color-row">
                  <span class="other-config__color-label">势力2（右）</span>
                  <div
                    class="other-config__color-swatch"
                    :style="{ backgroundColor: kingdomGlyphColorPreview('secondary') }"
                    @click="openKingdomGlyphColorPicker('secondary')"
                  />
                </div>
              </div>
              <div v-else class="other-config__color">
                <div
                  class="other-config__color-swatch"
                  :style="{ backgroundColor: kingdomGlyphColorPreview('single') }"
                  @click="openKingdomGlyphColorPicker('single')"
                />
              </div>
              <n-color-picker
                v-model:show="kingdomGlyphColorPicker.showFlag"
                v-model:value="kingdomGlyphColorPicker.value"
                class="other-config__color-picker"
                :show-alpha="CUSTOM_COLOR_PICKER_UI.kingdomGlyph.showAlpha"
                :modes="CUSTOM_COLOR_PICKER_UI.kingdomGlyph.modes"
                :swatches="CUSTOM_COLOR_PICKER_UI.kingdomGlyph.swatches"
                :actions="['confirm']"
                @confirm="handleKingdomGlyphColorConfirm"
              />
            </n-form-item>
          </template>
          <template v-if="showKingdomGlyphGradientSetting">
            <n-form-item label="势力字渐变">
              <n-switch
                :value="Boolean(items.kingdom.glyphGradientFlag)"
                @update:value="onKingdomGlyphGradientFlagChange"
              >
                <template #checked> 打开 </template>
                <template #unchecked> 关闭 </template>
              </n-switch>
            </n-form-item>
            <n-form-item v-if="items.kingdom.glyphGradientFlag" label="渐变终点色">
              <div
                v-if="showDualKingdomGlyphColorPickers"
                class="other-config__kingdom-colors"
              >
                <div class="other-config__color-row">
                  <span class="other-config__color-label">势力1（左）</span>
                  <div
                    class="other-config__color-swatch"
                    :style="{ backgroundColor: kingdomGlyphGradientEndPreview('primary') }"
                    @click="openKingdomGlyphGradientColorPicker('primary')"
                  />
                </div>
                <div class="other-config__color-row">
                  <span class="other-config__color-label">势力2（右）</span>
                  <div
                    class="other-config__color-swatch"
                    :style="{ backgroundColor: kingdomGlyphGradientEndPreview('secondary') }"
                    @click="openKingdomGlyphGradientColorPicker('secondary')"
                  />
                </div>
              </div>
              <div v-else class="other-config__color">
                <div
                  class="other-config__color-swatch"
                  :style="{ backgroundColor: kingdomGlyphGradientEndPreview('single') }"
                  @click="openKingdomGlyphGradientColorPicker('single')"
                />
              </div>
              <n-color-picker
                v-model:show="kingdomGlyphGradientColorPicker.showFlag"
                v-model:value="kingdomGlyphGradientColorPicker.value"
                class="other-config__color-picker"
                :show-alpha="CUSTOM_COLOR_PICKER_UI.kingdomGlyph.showAlpha"
                :modes="CUSTOM_COLOR_PICKER_UI.kingdomGlyph.modes"
                :swatches="CUSTOM_COLOR_PICKER_UI.kingdomGlyph.swatches"
                :actions="['confirm']"
                @confirm="handleKingdomGlyphGradientColorConfirm"
              />
            </n-form-item>
          </template>
        </n-collapse-item>

        <n-collapse-item title="体力" name="hp">
          <n-form-item label="自定义颜色">
            <n-switch
              :value="items.hp.customColorFlag"
              @update:value="onCustomHpColorFlagChange"
            >
              <template #checked> 打开 </template>
              <template #unchecked> 关闭 </template>
            </n-switch>
          </n-form-item>
          <n-form-item v-if="items.hp.customColorFlag" label="体力颜色">
            <div
              v-if="isDoubleKingdomMode"
              class="other-config__kingdom-colors"
            >
              <div class="other-config__color-row">
                <span class="other-config__color-label">势力1（下）</span>
                <div
                  class="other-config__color-swatch"
                  :style="{ backgroundColor: hpColorPreview('primary') }"
                  @click="openHpColorPicker('primary')"
                />
              </div>
              <div class="other-config__color-row">
                <span class="other-config__color-label">势力2（上）</span>
                <div
                  class="other-config__color-swatch"
                  :style="{ backgroundColor: hpColorPreview('secondary') }"
                  @click="openHpColorPicker('secondary')"
                />
              </div>
            </div>
            <div v-else class="other-config__color">
              <div
                class="other-config__color-swatch"
                :style="{ backgroundColor: hpColorPreview('single') }"
                @click="openHpColorPicker('single')"
              />
            </div>
            <n-color-picker
              v-model:show="hpColorPicker.showFlag"
              v-model:value="hpColorPicker.value"
              class="other-config__color-picker"
              :show-alpha="CUSTOM_COLOR_PICKER_UI.hp.showAlpha"
              :modes="CUSTOM_COLOR_PICKER_UI.hp.modes"
              :swatches="CUSTOM_COLOR_PICKER_UI.hp.swatches"
              :actions="['confirm']"
              @confirm="handleHpColorConfirm"
            />
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item title="武将名称" name="name">
          <n-form-item label="繁体转化">
            <n-switch :value="items.name.convertTChFlag" @update:value="onNameConvertTChChange">
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="字间距">
            <PtNumberInput
              :value="items.name.characterSpacing"
              @update:value="onNameSpacingChange"
            />
          </n-form-item>
          <n-form-item label="拆分单字">
            <n-switch :value="items.name.splitFlag" @update:value="onNameSplitFlagChange">
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item title="武将称号" name="title">
          <n-form-item label="自定义颜色">
            <n-switch
              :value="items.title.customColorFlag"
              @update:value="onCustomTitleColorFlagChange"
            >
              <template #checked> 打开 </template>
              <template #unchecked> 关闭 </template>
            </n-switch>
          </n-form-item>
          <n-form-item v-if="items.title.customColorFlag" label="称号颜色">
            <div
              v-if="isDoubleKingdomMode"
              class="other-config__kingdom-colors"
            >
              <div class="other-config__color-row">
                <span class="other-config__color-label">势力1（下）</span>
                <div
                  class="other-config__color-swatch"
                  :style="{ backgroundColor: titleColorPreview('primary') }"
                  @click="openTitleColorPicker('primary')"
                />
              </div>
              <div class="other-config__color-row">
                <span class="other-config__color-label">势力2（上）</span>
                <div
                  class="other-config__color-swatch"
                  :style="{ backgroundColor: titleColorPreview('secondary') }"
                  @click="openTitleColorPicker('secondary')"
                />
              </div>
            </div>
            <div v-else class="other-config__color">
              <div
                class="other-config__color-swatch"
                :style="{ backgroundColor: titleColorPreview('single') }"
                @click="openTitleColorPicker('single')"
              />
            </div>
            <n-color-picker
              v-model:show="titleColorPicker.showFlag"
              v-model:value="titleColorPicker.value"
              class="other-config__color-picker"
              :show-alpha="CUSTOM_COLOR_PICKER_UI.title.showAlpha"
              :modes="CUSTOM_COLOR_PICKER_UI.title.modes"
              :swatches="CUSTOM_COLOR_PICKER_UI.title.swatches"
              :actions="['confirm']"
              @confirm="handleTitleColorConfirm"
            />
          </n-form-item>
          <n-form-item label="繁体转化">
            <n-switch :value="items.title.convertTChFlag" @update:value="onTitleConvertTChChange">
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="字间距">
            <PtNumberInput
              :value="items.title.characterSpacing"
              @update:value="onTitleSpacingChange"
            />
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item title="技能名称" name="skillsName">
          <n-form-item label="繁体转化">
            <n-switch
              :value="items.skillsName.convertTChFlag"
              @update:value="onSkillsNameConvertTChChange"
            >
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="上边距">
            <MmNumberInput
              :value="items.skillsName.marginTop"
              :step="0.1"
              @update:value="onSkillsNameMarginTopChange"
            />
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item title="技能描述" name="skillsDesc">
          <n-form-item label="新版字体">
            <div class="other-config__inline-switch">
              <n-switch
                :value="items.skillsDesc.newFontFlag"
                @update:value="onSkillsDescNewFontChange"
              >
                <template #checked>开启</template>
                <template #unchecked>关闭</template>
              </n-switch>
              <span class="other-config__font-name">{{ skillsDescCurrentFontLabel }}</span>
            </div>
          </n-form-item>
          <n-form-item label="加粗">
            <template #label>
              <div class="other-config__form-label">
                <span>加粗</span>
              </div>
            </template>
            <n-switch
              :value="items.skillsDesc.textBoldFlag"
              @update:value="onSkillsDescTextBoldChange"
            >
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="优化描述">
            <template #label>
              <div class="other-config__form-label">
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon size="1.1em">
                      <HelpRound />
                    </n-icon>
                  </template>
                  <div>
                    开启后：纠正标点符号，并在句末自动补标点。
                  </div>
                </n-tooltip>
                <span>优化描述</span>
              </div>
            </template>
            <n-switch
              :value="skillsDescAutoOptimizeEnabled"
              @update:value="onSkillsDescAutoOptimizeChange"
            >
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="优化字号">
            <template #label>
              <div class="other-config__form-label">
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon size="1.1em">
                      <HelpRound />
                    </n-icon>
                  </template>
                  <div>
                    开启后：自动适配描述字号，并启用字号限制。
                  </div>
                </n-tooltip>
                <span>优化字号</span>
              </div>
            </template>
            <n-switch
              :value="skillsDescAutoSizeEnabled"
              @update:value="onSkillsDescAutoSizeChange"
            >
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="自动全角">
            <template #label>
              <div class="other-config__form-label">
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon size="1.1em">
                      <HelpRound />
                    </n-icon>
                  </template>
                  <div>
                    开启后，单个阿拉伯数字会自动显示为全角数字。
                  </div>
                </n-tooltip>
                <span>自动全角</span>
              </div>
            </template>
            <n-switch
              :value="items.skillsDesc.autoFullNumberFlag"
              @update:value="onSkillsDescAutoFullNumberChange"
            >
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="背景不透明度">
            <n-input-number
              :value="skillsDescBgOpaquePercent"
              size="medium"
              button-placement="both"
              :precision="0"
              :min="0"
              :max="100"
              :step="1"
              @update:value="onSkillsDescBgOpaqueChange"
            >
              <template #suffix> % </template>
            </n-input-number>
          </n-form-item>
          <n-form-item label="字号">
            <PtNumberInput
              :value="items.skillsDesc.size ?? null"
              :min="skillsDescSizeMin"
              :max="skillsDescSizeMax"
              :step="skillsDescSizeStep"
              @update:value="onSkillsDescSizeChange"
            />
          </n-form-item>
          <n-divider title-placement="left">间距调整</n-divider>
          <n-form-item label="段间距">
            <MmNumberInput
              :value="items.skillsDesc.paraSpacing"
              :min="0"
              :step="0.5"
              @update:value="onSkillsDescParaSpacingChange"
            />
          </n-form-item>
          <n-form-item label="单行段间距">
            <MmNumberInput
              :value="items.skillsDesc.singleLineParaSpacing"
              :min="0"
              :step="0.5"
              @update:value="onSkillsDescSingleLineParaSpacingChange"
            />
          </n-form-item>
          <n-form-item label="行间距">
            <PtNumberInput
              :value="items.skillsDesc.rowSpacing"
              :min="6"
              :max="25"
              :step="0.5"
              @update:value="onSkillsDescRowSpacingChange"
            />
          </n-form-item>
          <n-form-item label="字间距">
            <TrackingNumberInput
              :value="items.skillsDesc.characterSpacing"
              :step="20"
              @update:value="onSkillsDescCharacterSpacingChange"
            />
          </n-form-item>
          <n-divider title-placement="left">边距调整</n-divider>
          <n-form-item label="上边距">
            <MmNumberInput
              :value="items.skillsDesc.marginTop"
              @update:value="onSkillsDescMarginTopChange"
            />
          </n-form-item>
          <n-form-item label="下边距">
            <MmNumberInput
              :value="items.skillsDesc.marginBottom"
              @update:value="onSkillsDescMarginBottomChange"
            />
          </n-form-item>
          <n-form-item label="左边距">
            <MmNumberInput
              :value="items.skillsDesc.marginLeft"
              @update:value="onSkillsDescMarginLeftChange"
            />
          </n-form-item>
          <n-form-item label="右边距">
            <MmNumberInput
              :value="items.skillsDesc.marginRight"
              @update:value="onSkillsDescMarginRightChange"
            />
          </n-form-item>
          <n-form-item label="最小高度">
            <MmNumberInput
              :value="skillsDescMinHeightMm"
              :min="0"
              :step="0.5"
              @update:value="onSkillsDescMinHeightChange"
            />
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item title="引言" name="quote">
          <n-form-item label="字号">
            <div class="other-config__inline-input-row">
              <PtNumberInput
                :value="items.quote.size ?? null"
                :min="3"
                :step="0.5"
                @update:value="onQuoteSizeChange"
              />
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    quaternary
                    circle
                    :type="items.quote.lockSizeFlag ? 'primary' : 'default'"
                    @click="onQuoteSizeLockToggle"
                  >
                    <template #icon>
                      <n-icon>
                        <LockRound v-if="items.quote.lockSizeFlag" />
                        <LockOpenRound v-else />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{
                  items.quote.lockSizeFlag
                    ? '已锁定：引言字号不随技能描述变化'
                    : '锁定后，引言字号不随技能描述变化'
                }}
              </n-tooltip>
            </div>
          </n-form-item>
          <n-form-item label="字间距">
            <TrackingNumberInput
              :value="items.quote.characterSpacing"
              :step="20"
              @update:value="onQuoteCharacterSpacingChange"
            />
          </n-form-item>
          <n-divider title-placement="left">边距调整</n-divider>
          <n-form-item label="上边距">
            <MmNumberInput
              :value="items.quote.marginTop"
              @update:value="onQuoteMarginTopChange"
            />
          </n-form-item>
          <n-form-item label="下边距">
            <MmNumberInput
              :value="items.quote.marginBottom"
              :min="0"
              @update:value="onQuoteMarginBottomChange"
            />
          </n-form-item>
          <n-form-item label="左边距">
            <MmNumberInput
              :value="items.quote.marginLeft"
              :min="0"
              @update:value="onQuoteMarginLeftChange"
            />
          </n-form-item>
          <n-form-item label="右边距">
            <MmNumberInput
              :value="items.quote.marginRight"
              :min="0"
              @update:value="onQuoteMarginRightChange"
            />
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item title="底部信息" name="bottomInfo">
          <n-form-item label="底部描边">
            <n-switch
              :value="items.bottomInfo.strokeFlag"
              @update:value="onBottomInfoStrokeChange"
            >
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="左边距">
            <MmNumberInput
              :value="items.bottomInfo.marginLeft"
              :min="0"
              @update:value="onBottomInfoMarginLeftChange"
            />
          </n-form-item>
          <n-form-item label="右边距">
            <MmNumberInput
              :value="items.bottomInfo.marginRight"
              :min="0"
              @update:value="onBottomInfoMarginRightChange"
            />
          </n-form-item>
        </n-collapse-item>

        <n-collapse-item :title="PACKAGE_IDENTIFY_CONFIG_TITLE" name="package">
          <n-form-item label="繁体转化">
            <n-switch
              :value="items.package.convertTChFlag"
              @update:value="onPackageConvertTChChange"
            >
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
        </n-collapse-item>
      </n-collapse>
    </n-form>
  </n-el>
</template>

<style scoped>
.other-config {
  --other-config-control-width: 60%;
}

.other-config :deep(.n-form-item-blank > .n-input-number),
.other-config :deep(.n-form-item-blank > .n-input:not(.n-input--textarea)),
.other-config :deep(.n-form-item-blank > .n-select),
.other-config :deep(.n-form-item-blank .other-config__kingdom-texts .n-input) {
  width: var(--other-config-control-width);
  max-width: 100%;
  box-sizing: border-box;
}

.other-config :deep(.n-form-item .n-input-number) {
  display: flex;
}

.other-config :deep(.n-form-item .n-input-number .n-input) {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
}

.other-config :deep(.n-form-item .n-input-number .n-input-wrapper) {
  width: 100%;
}

.other-config__field-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
}

.other-config__field-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-color-3);
  max-width: 100%;
}

.other-config__color {
  width: 34px;
  height: 34px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.other-config__kingdom-colors {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.other-config__color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.other-config__color-label {
  min-width: 42px;
  font-size: 13px;
  color: var(--n-text-color-2);
}

.other-config__color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.other-config__color-picker {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  pointer-events: none;
}

.other-config__kingdom-texts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.other-config__kingdom-linked {
  display: grid;
  grid-template-columns: 124px max-content;
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 12px;
  row-gap: 24px;
  margin-bottom: 24px;
  position: relative;
}

.other-config__kingdom-linked-label {
  justify-self: end;
  padding-right: 0;
  color: var(--n-text-color);
  line-height: 1.6;
}

.other-config__kingdom-linked-switch {
  justify-self: start;
}

.other-config__kingdom-linked-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.other-config__kingdom-linked-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.other-config__kingdom-linked-svg path {
  fill: none;
  stroke: var(--primary-color);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.5;
}

.other-config__kingdom-linked-mutex {
  position: absolute;
  z-index: 1;
  line-height: 0;
  color: var(--primary-color);
  pointer-events: auto;
  cursor: help;
}

.other-config__form-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  width: 100%;
}

.other-config__inline-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: var(--other-config-control-width);
  max-width: 100%;
  box-sizing: border-box;
}

.other-config__inline-input-row :deep(.n-input-number) {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  max-width: none;
}

.other-config__inline-input-row :deep(.n-button) {
  flex-shrink: 0;
}

.other-config__inline-switch {
  display: flex;
  align-items: center;
  gap: 10px;
}

.other-config__font-name {
  color: var(--text-color-3);
  font-size: 13px;
}

</style>
