<script setup lang="ts">
import DiyResourceSearchDrawer from '@/features/diy-card/components/search/DiyResourceSearchDrawer.vue'
import OutOfFrameEditor from '@/features/diy-card/components/out-of-frame/OutOfFrameEditor.vue'
import {
  createDefaultOutOfFrameConfig,
  resetOutOfFrameOnPicChange,
  resolveOutOfFrameConfig,
} from '@/features/diy-card/types/diy/outOfFrame'
import { resetLegendImageLayoutOnPicChange, resolveLegendImageDownloadFileName, resolveOutOfFrameDownloadFileName } from '@/features/diy-card/utils/legendImageLayout'
import { invalidateLegendOutOfFrameComposite } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/legend-out-of-frame'
import { composeOutOfFramePngDataUrl } from '@/features/diy-card/utils/outOfFrame/exportOutOfFramePng'
import OrderedKingdomPicker from '@/features/diy-card/components/config/OrderedKingdomPicker.vue'
import { KINGDOM_DISPLAY_ORDER } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import { resolveSkillsDescAutoOptimizeFlag, resolveSkillsDescAutoSizeFlag } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import {
  buildCustomSkillKingdomSkillOptions,
  buildSkillKingdomSkillOptions,
  clearMasterFlagForDoubleKingdom,
  ensureCustomKingdomSetup,
  isCustomKingdomActive,
  isCustomDoubleKingdomSkillPickerActive,
  normalizeCustomSkillKingdom,
  onDoubleKingdomEnabled,
  resolveDoubleKingdomListOnChange,
  usesShenCardLayout,
  normalizeSkillKingdom,
  SKILL_KINGDOM_BOTH_VALUE,
} from '@/features/diy-card/composables/doubleKingdom'
import type { DiySearchMode, DiySearchSelectPayload } from '@/features/diy-card/types/search'
import type { LegendInfo, LegendSkill } from '@/features/diy-card/types/diy/legend'
import {
  applyDiySearchSelection,
  applyLegendWikiSelectionBatched,
} from '@/features/diy-card/utils/applyWikiSelection'
import { fetchLegendNumberForLegend } from '@/features/diy-card/utils/legendNumber'
import {
  PACKAGE_IDENTIFY_PRESETS,
  PACKAGE_IDENTIFY_CONFIG_TITLE,
  isPackageLibraryKind,
  isPackageUploadImageKind,
  resolvePackageIdentifyPreset,
} from '@/features/diy-card/types/diy/packageIdentify'
import {
  isPackageTextBadgeGradientEnabled,
  isPackageTextBadgeKind,
  resolvePackageTextBadgeDefaultColor,
  resolvePackageTextBadgeDefaultColorEnd,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/package'
import { CUSTOM_COLOR_PICKER_UI } from '@/features/diy-card/constants/customColorPickerOptions'
import { applyPackageTextBadgeDefaultColor } from '@/features/diy-card/utils/packageCustomColor'
import { recordPackageConfigChange } from '@/features/diy-card/utils/packageLegendSnapshot'
import { useDiyStore } from '@/features/diy-card/stores'
import { useDiyHistoryStore } from '@/features/diy-card/stores'
import { useInfoStore } from '@/features/diy-card/stores'
import { useTemplateStore } from '@/features/diy-card/stores'
import { applyFieldChange, recordModify, createTextBlurHistoryHandlers, recordTextBlurModify } from '@/features/diy-card/utils/diyHistoryField'
import { applySkillsDescAutoOptimizeChange } from '@/features/diy-card/utils/skillsDescAutoOptimize'
import { applySkillsDescAutoSizeChange } from '@/features/diy-card/utils/skillsDescAutoOptimizeSize'
import {
  syncFrameSrcToKingdom,
  syncShenFrameGlyphColorFlag,
} from '@/features/diy-card/utils/syncFrameKingdom'
import DescInput from '@/shared/components/input/DescInput.vue'
import {
  AddCircleRound,
  DownloadRound,
  FileUploadOutlined,
  HelpRound,
  KeyboardDoubleArrowUpRound,
  PublicRound,
  LockOpenRound,
  LockRound,
  OpenWithRound,
  RemoveCircleOutlineFilled,
} from '@/shared/icons'
import { shouldUseLightDragEffects } from '@/shared/utils/deviceCapability'
import { downloadImage, downloadRemoteFile, fileToBase64 } from '@/shared/utils/file'
import { getKingdomLabel } from '@/shared/utils/kingdom'
import { type UploadInst, useDialog, useMessage } from 'naive-ui'
import type { UploadOnFinish, UploadSettledFileInfo } from 'naive-ui/es/upload/src/public-types'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import {
  buildResourceSearchListQuery,
  clearAllDiyOverlayQuery,
  isOutOfFrameOverlayOpen,
  isResourceSearchDrawerOpen,
  parseResourceSearchRouteMode,
} from '@/features/diy-card/constants/diyDrawerRoute'
import { useDiyDrawerRoute } from '@/features/diy-card/composables/useDiyDrawerRoute'

/* 参数定义 */
const dialog = useDialog()
const message = useMessage()
const route = useRoute()
const router = useRouter()
const { openOutOfFrame, dismissOverlayReplace } = useDiyDrawerRoute()

const searchMode = ref<DiySearchMode>('legend')
const searchKeyword = ref('')
const searchSkillIndex = ref(0)
const wikiApplying = ref(false)

const searchDrawerVisible = computed(() => isResourceSearchDrawerOpen(route.query))
const outOfFrameEditorVisible = computed(() => isOutOfFrameOverlayOpen(route.query))

const closeResourceSearchDrawer = () => {
  void router.replace({ query: clearAllDiyOverlayQuery(route.query) })
}

const handleOutOfFrameShowUpdate = (visible: boolean) => {
  if (!visible && isOutOfFrameOverlayOpen(route.query)) {
    void router.back()
  }
}

const openResourceSearch = (mode: DiySearchMode, keyword = '', skillIndex = 0) => {
  searchMode.value = mode
  searchKeyword.value = keyword
  searchSkillIndex.value = skillIndex
  void router.push({
    query: buildResourceSearchListQuery(route.query, mode),
  })
}

const openSkillSearch = (index: number, keyword: string) => {
  openResourceSearch('skill', keyword, index)
}

watch(
  () => parseResourceSearchRouteMode(route.query),
  (modeFromRoute) => {
    if (!modeFromRoute) return
    searchMode.value = modeFromRoute
  },
  { immediate: true },
)

const handleSearchApply = async (payload: DiySearchSelectPayload) => {
  if (wikiApplying.value) return

  if (payload.type === 'legend') {
    wikiApplying.value = true
    try {
      await applyLegendWikiSelectionBatched(legend.value, payload)
      closeResourceSearchDrawer()
      message.success('已应用到当前卡牌')
    } catch (error) {
      console.error('[wiki] apply legend failed', error)
      message.error('应用失败，请重试')
    } finally {
      wikiApplying.value = false
    }
    return
  }

  applyDiySearchSelection(legend.value, payload)
  closeResourceSearchDrawer()
  message.success('已应用到当前卡牌')
}

const legendNumberFetching = ref(false)

const fetchLegendNumber = async () => {
  if (legendNumberFetching.value) return
  if (!legend.value.baseInfo.name.trim()) {
    message.warning('请先填写武将名称')
    return
  }

  legendNumberFetching.value = true
  try {
    const nextId = await fetchLegendNumberForLegend(legend.value)
    if (!nextId) {
      message.warning('未找到匹配的武将编号')
      return
    }

    const prev = legend.value.baseInfo.legendId
    if (prev === nextId) {
      message.info('编号未变化')
      return
    }

    applyFieldChange('武将编号', prev, nextId, (val) => {
      legend.value.baseInfo.legendId = val
    }, { category: 'baseInfo' })
    message.success('已获取武将编号')
  } catch (error) {
    console.error('[legend-number] fetch failed', error)
    message.error('获取失败，请稍后重试')
  } finally {
    legendNumberFetching.value = false
  }
}

/* 依赖注入 */
const diyStore = useDiyStore()
const infoStore = useInfoStore()
const legend = computed(() => infoStore.info as LegendInfo)
const templateStore = useTemplateStore()
const historyStore = useDiyHistoryStore()

const ensureOutOfFrameConfig = () => {
  if (!legend.value.renderConfig.outOfFrame) {
    legend.value.renderConfig.outOfFrame = createDefaultOutOfFrameConfig()
  }
}

const outOfFrameConfig = computed(() => resolveOutOfFrameConfig(legend.value.renderConfig.outOfFrame))

/** 与预览区 legendImage 一致：含出血边距的 Stage 尺寸 */
const stageSize = computed(() => diyStore.finalStageConfig)

const openOutOfFrameEditor = () => {
  if (!legend.value.baseInfo.pic) {
    message.warning('请先上传或选择武将图')
    return
  }
  ensureOutOfFrameConfig()
  openOutOfFrame()
}

const onOutOfFrameApply = (maskDataUrl: string) => {
  ensureOutOfFrameConfig()
  const cfg = legend.value.renderConfig.outOfFrame!
  cfg.enabled = true
  cfg.maskDataUrl = maskDataUrl
  cfg.sourcePic = legend.value.baseInfo.pic
  recordModify('人物出框', { category: 'renderConfig' })
  message.success('人物出框已应用')
  dismissOverlayReplace()
}

const clearOutOfFrame = () => {
  ensureOutOfFrameConfig()
  const cfg = legend.value.renderConfig.outOfFrame!
  cfg.enabled = false
  cfg.maskDataUrl = ''
  cfg.sourcePic = ''
  recordModify('人物出框', { category: 'renderConfig', label: '关闭出框' })
  message.success('已关闭人物出框')
}

watch(
  () => legend.value.baseInfo.pic,
  (newPic, oldPic) => {
    if (!oldPic || newPic === oldPic) return
    if (isOutOfFrameOverlayOpen(route.query)) {
      dismissOverlayReplace()
    }
  },
)

const templateKingdomValues = computed(() => {
  const raw = templateStore.currentTemplate.config?.kingdoms?.value
  if (!Array.isArray(raw)) {
    return [] as string[]
  }
  return raw.map((k) => String(k))
})

const onDoubleKingdomListChange = (value: string[]) => {
  const prev = [...(legend.value.baseInfo.doubleKingdom ?? [])]
  const normalized = resolveDoubleKingdomListOnChange(
    prev,
    value,
    KINGDOM_DISPLAY_ORDER,
  )
  if (JSON.stringify(prev) === JSON.stringify(normalized)) return
  legend.value.baseInfo.doubleKingdom = normalized
  const picked = normalized
  if (picked.length === 1) {
    legend.value.baseInfo.kingdom = picked[0]!
  }
  syncSkillsKingdom()
  recordModify('势力', {
    category: 'baseInfo',
    format: 'kingdoms',
    before: prev,
    after: normalized,
  })
}

const doubleKingdomList = computed({
  get: () => legend.value.baseInfo.doubleKingdom ?? [],
  set: onDoubleKingdomListChange,
})

const activeDoubleKingdoms = computed(() =>
  doubleKingdomList.value.filter((k) => k && k !== 'shen'),
)

const isCustomKingdom = computed(() =>
  Boolean(legend.value.renderConfig.items.kingdom.customKingdomFlag),
)

const isDoubleKingdomSwitchOn = computed(
  () => legend.value.renderConfig.items.kingdom.doubleKingdom,
)

const showDoubleKingdomPicker = computed(() => isDoubleKingdomSwitchOn.value)

const isDoubleKingdomPickerDisabled = computed(() => false)

const showSkillKingdomPicker = computed(
  () =>
    showDoubleKingdomPicker.value &&
    (isCustomDoubleKingdomSkillPickerActive(legend.value) ||
      activeDoubleKingdoms.value.length >= 2),
)

const skillKingdomSelectOptions = computed(() =>
  isCustomKingdom.value
    ? buildCustomSkillKingdomSkillOptions(legend.value)
    : buildSkillKingdomSkillOptions(activeDoubleKingdoms.value),
)

const resolveSkillKingdomSelectValue = (value: string | undefined) =>
  isCustomKingdom.value
    ? normalizeCustomSkillKingdom(value)
    : normalizeSkillKingdom(value, activeDoubleKingdoms.value)

const syncSkillsKingdom = () => {
  if (!showSkillKingdomPicker.value) return
  if (isCustomKingdom.value) {
    legend.value.baseInfo.skills.forEach((skill) => {
      skill.kingdom = normalizeCustomSkillKingdom(skill.kingdom)
    })
    return
  }
  const kingdoms = activeDoubleKingdoms.value
  legend.value.baseInfo.skills.forEach((skill) => {
    skill.kingdom = normalizeSkillKingdom(skill.kingdom, kingdoms)
  })
}

/* 监听器 */
// 势力/边框变化时：势力变则联动边框；神框下同步势力字自定义色开关
watch(
  () =>
    [
      legend.value.baseInfo.kingdom,
      legend.value.baseInfo.doubleKingdom?.join('\0'),
      legend.value.renderConfig.items.kingdom.doubleKingdom,
      legend.value.renderConfig.items.frame.src,
    ] as const,
  (value, oldValue) => {
    if (historyStore.isRestoring) return
    let previousKingdom: string | undefined
    if (oldValue) {
      const [oldBase, oldDoubleJoined, oldDoubleFlag] = oldValue
      if (oldDoubleFlag && oldDoubleJoined) {
        previousKingdom =
          oldDoubleJoined.split('\0').find((k) => k && k !== 'shen') ?? oldBase
      } else {
        previousKingdom = oldBase
      }
    }
    const kingdomChanged =
      !oldValue ||
      value[0] !== oldValue[0] ||
      value[1] !== oldValue[1] ||
      value[2] !== oldValue[2]
    if (kingdomChanged) {
      syncFrameSrcToKingdom(legend.value, { previousKingdom })
    }
    if (!isCustomKingdomActive(legend.value)) {
      syncShenFrameGlyphColorFlag(legend.value)
    }
  },
)

watch(
  () => legend.value.renderConfig.items.kingdom.doubleKingdom,
  (on) => {
    if (historyStore.isRestoring) return
    if (on) clearMasterFlagForDoubleKingdom(legend.value)
  },
  { immediate: true },
)

watch(showSkillKingdomPicker, (show) => {
  if (historyStore.isRestoring) return
  if (show) syncSkillsKingdom()
})

// 体力值变化时处理最大体力值
watch(
  () => legend.value.baseInfo.hp,
  (value: number) => {
    if (legend.value.renderConfig.items.hp.equalFlag) {
      legend.value.baseInfo.maxHp = value
    } else if (value > legend.value.baseInfo.maxHp) {
      legend.value.baseInfo.maxHp = value
    }
  },
)

/* 核心逻辑 */
// 删除技能
const handleSkillDelete = (index: number) => {
  const skill = legend.value.baseInfo.skills[index]
  if (!skill) {
    return
  }
  const removeSkill = () => {
    recordModify('技能', {
      category: 'skills',
      detail: skill.name ? `【${skill.name}】已删除` : '已删除',
    })
    legend.value.baseInfo.skills.splice(index, 1)
  }
  if (!skill.name && !skill.desc) {
    removeSkill()
    return
  }
  dialog.warning({
    title: '警告',
    content: `确定删除技能【${skill.name}】？`,
    positiveText: '删除',
    negativeText: '取消',
    draggable: true,
    onPositiveClick: removeSkill,
  })
}

/** 拖拽列表行 id（仅 UI 用，不写入存档；避免 item-key=name 时改技能名导致输入失焦） */
let skillRowKeySeq = 0
const skillRowKeys = new WeakMap<LegendSkill, string>()
const resolveSkillRowKey = (item: unknown) => {
  const skill = item as LegendSkill
  let rowKey = skillRowKeys.get(skill)
  if (!rowKey) {
    skillRowKeySeq += 1
    rowKey = `skill-row-${skillRowKeySeq}`
    skillRowKeys.set(skill, rowKey)
  }
  return rowKey
}

const handleSkillAdd = () => {
  const skill: (typeof legend.value.baseInfo.skills)[number] = {
    name: '',
    desc: '',
  }
  if (showSkillKingdomPicker.value) {
    skill.kingdom = SKILL_KINGDOM_BOTH_VALUE
  }
  legend.value.baseInfo.skills.push(skill)
  recordModify('技能', { category: 'skills', detail: '添加' })
}

const skillsDescAutoOptimizeEnabled = computed(() =>
  resolveSkillsDescAutoOptimizeFlag(legend.value.renderConfig.items.skillsDesc.autoOptimizeFlag),
)

const skillsDescAutoSizeEnabled = computed(() =>
  resolveSkillsDescAutoSizeFlag(
    legend.value.renderConfig.items.skillsDesc.autoOptimizeSizeFlag,
    legend.value.renderConfig.items.skillsDesc.autoOptimizeFlag,
  ),
)

const onSkillsDescAutoOptimizeChange = (value: boolean) => {
  applySkillsDescAutoOptimizeChange(legend.value, value)
}

const onSkillsDescAutoSizeChange = (value: boolean) => {
  applySkillsDescAutoSizeChange(legend.value, value)
}

const snapshotSkillNames = () => legend.value.baseInfo.skills.map((s) => s.name ?? '')
let lastSkillOrderSnapshot = snapshotSkillNames()

watch(
  () => snapshotSkillNames(),
  (names) => {
    const prev = lastSkillOrderSnapshot
    const sameItems =
      names.length === prev.length && [...names].sort().join('\0') === [...prev].sort().join('\0')
    const orderChanged = sameItems && names.join('\0') !== prev.join('\0')

    if (orderChanged) {
      recordModify('技能顺序', {
        category: 'skills',
        before: prev.map((n) => n || '未命名').join('、'),
        after: names.map((n) => n || '未命名').join('、'),
      })
    }
    lastSkillOrderSnapshot = [...names]
  },
  { deep: true },
)

/** 弱机关闭排序过渡与 ghost，减轻列表重排开销 */
const skillDragAnimation = computed(() => (shouldUseLightDragEffects() ? 0 : 200))
const skillDragGhostClass = computed(() =>
  shouldUseLightDragEffects() ? '' : 'legend-config__skill--ghost',
)

/** 上传组件内部会累计文件数，:max="1" 时首次上传后需 clear 才能再次选图 */
const legendPicUploadRef = ref<UploadInst | null>(null)
const downloadingLegendPic = ref(false)
const downloadingOutOfFrame = ref(false)

const canDownloadOutOfFrame = computed(() => {
  const cfg = outOfFrameConfig.value
  const pic = legend.value.baseInfo.pic
  return Boolean(cfg.enabled && cfg.maskDataUrl && pic)
})

const downloadLegendImage = async () => {
  const pic = legend.value.baseInfo.pic
  if (!pic) {
    message.warning('请先上传或选择武将图')
    return
  }

  downloadingLegendPic.value = true
  try {
    const filename = resolveLegendImageDownloadFileName(
      legend.value.baseInfo.title,
      legend.value.baseInfo.name,
    )
    if (pic.startsWith('data:') || pic.startsWith('blob:')) {
      downloadImage(pic, filename)
      message.success('武将图已开始下载')
      return
    }

    const ok = await downloadRemoteFile(pic, filename)
    if (ok) {
      message.success('武将图已开始下载')
      return
    }

    globalThis.open(pic, '_blank', 'noopener,noreferrer')
    message.info('无法直接下载，已在新标签页打开原图')
  } finally {
    downloadingLegendPic.value = false
  }
}

const downloadOutOfFrameImage = async () => {
  const pic = legend.value.baseInfo.pic
  const cfg = outOfFrameConfig.value
  if (!pic) {
    message.warning('请先上传或选择武将图')
    return
  }
  if (!cfg.enabled || !cfg.maskDataUrl) {
    message.warning('请先制作并应用人物出框')
    return
  }
  if (cfg.sourcePic && cfg.sourcePic !== pic) {
    message.warning('武将图已更换，请重新制作人物出框后再下载')
    return
  }

  downloadingOutOfFrame.value = true
  try {
    const dataUrl = await composeOutOfFramePngDataUrl(pic, cfg.maskDataUrl)
    downloadImage(dataUrl, resolveOutOfFrameDownloadFileName(
      legend.value.baseInfo.title,
      legend.value.baseInfo.name,
    ))
    message.success('出框图已开始下载')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '出框图导出失败')
  } finally {
    downloadingOutOfFrame.value = false
  }
}

const uploadLegendImage = async ({
  file,
  onFinish,
}: {
  file: UploadSettledFileInfo
  onFinish: UploadOnFinish
}) => {
  try {
    const next = (await fileToBase64(file.file as File)) as string
    if (next !== legend.value.baseInfo.pic) {
      resetOutOfFrameOnPicChange(legend.value.renderConfig)
      resetLegendImageLayoutOnPicChange(legend.value)
      invalidateLegendOutOfFrameComposite()
    }
    legend.value.baseInfo.pic = next
    recordModify('武将图', { category: 'baseInfo' })
    onFinish?.({ file })
  } finally {
    legendPicUploadRef.value?.clear()
  }
}

const packageIdentifyOptions = PACKAGE_IDENTIFY_PRESETS.map((item) => ({
  label: item.label,
  value: item.name,
}))

const packageIdentifyValue = computed(
  () => legend.value.baseInfo.packageIdentify.name,
)

const packageIdentifyLabel = (name: string) =>
  PACKAGE_IDENTIFY_PRESETS.find((item) => item.name === name)?.label ?? name

const onPackageIdentifyChange = (value: string | null) => {
  if (value == null) return
  const prev = packageIdentifyValue.value
  if (prev === value) return
  legend.value.baseInfo.packageIdentify = resolvePackageIdentifyPreset(value)
  applyPackageTextBadgeDefaultColor(legend.value.renderConfig.items.package, value)
  recordPackageConfigChange('角标', {
    category: 'baseInfo',
    label: `修改 角标：${packageIdentifyLabel(prev)} → ${packageIdentifyLabel(value)}`,
  })
}

const isPackageUploadImage = computed(() =>
  isPackageUploadImageKind(packageIdentifyValue.value),
)

const isPackageLibrary = computed(() => isPackageLibraryKind(packageIdentifyValue.value))

const isPackageCustomText = computed(
  () => legend.value.baseInfo.packageIdentify.textFlag,
)

const packageTextMaxLength = computed(
  () => legend.value.baseInfo.packageIdentify.maxLength || 1,
)

const packageImageUploadRef = ref<UploadInst | null>(null)

const uploadPackageImage = async ({
  file,
  onFinish,
}: {
  file: UploadSettledFileInfo
  onFinish: UploadOnFinish
}) => {
  try {
    const next = (await fileToBase64(file.file as File)) as string
    legend.value.baseInfo.packageIdentify.pic = next
    recordPackageConfigChange('角标图片', { category: 'baseInfo' })
    onFinish?.({ file })
  } finally {
    packageImageUploadRef.value?.clear()
  }
}

const onPackageTextChange = (value: string) => {
  const identify = legend.value.baseInfo.packageIdentify
  const prev = identify.text
  if (prev === value) return
  identify.text = value
  recordPackageConfigChange('角标文字', {
    category: 'baseInfo',
    before: prev,
    after: value,
  })
}

const packageColorPicker = ref({
  showFlag: false,
  slot: 'start' as 'start' | 'end',
  value: resolvePackageTextBadgeDefaultColor('text_ccxh'),
})

const isPackageGradientBadge = computed(() => {
  const kind = packageIdentifyValue.value
  return isPackageTextBadgeKind(kind) && isPackageTextBadgeGradientEnabled(kind)
})

const packageColorPreview = (slot: 'start' | 'end' = 'start') => {
  const kind = packageIdentifyValue.value
  const fallbackStart = isPackageTextBadgeKind(kind)
    ? resolvePackageTextBadgeDefaultColor(kind)
    : resolvePackageTextBadgeDefaultColor('text_ccxh')
  const fallbackEnd = isPackageTextBadgeKind(kind)
    ? resolvePackageTextBadgeDefaultColorEnd(kind)
    : resolvePackageTextBadgeDefaultColorEnd('text_ccxh')
  if (slot === 'end') {
    const color = legend.value.renderConfig.items.package.customColorEnd?.trim()
    return color || fallbackEnd
  }
  const color = legend.value.renderConfig.items.package.customColor?.trim()
  return color || fallbackStart
}

const openPackageColorPicker = (slot: 'start' | 'end' = 'start') => {
  packageColorPicker.value.slot = slot
  packageColorPicker.value.value = packageColorPreview(slot)
  packageColorPicker.value.showFlag = true
}

const handlePackageColorConfirm = () => {
  const slot = packageColorPicker.value.slot
  const next = packageColorPicker.value.value
  if (slot === 'end') {
    const prev = legend.value.renderConfig.items.package.customColorEnd
    if (prev === next) return
    legend.value.renderConfig.items.package.customColorEnd = next
    recordPackageConfigChange('角标渐变终点色', {
      category: 'renderConfig',
      before: prev,
      after: next,
    })
    return
  }
  const packageItem = legend.value.renderConfig.items.package
  const prev = packageItem.customColor
  const prevEnd = packageItem.customColorEnd
  const syncEnd = isPackageGradientBadge.value
  if (prev === next && (!syncEnd || prevEnd === next)) return
  packageItem.customColor = next
  if (syncEnd) {
    packageItem.customColorEnd = next
  }
  recordPackageConfigChange('角标颜色', {
    category: 'renderConfig',
    before: prev,
    after: next,
  })
  if (syncEnd && prevEnd !== next) {
    recordPackageConfigChange('角标渐变终点色', {
      category: 'renderConfig',
      before: prevEnd,
      after: next,
    })
  }
}

const handleHpEqualFlag = () => {
  const prev = legend.value.renderConfig.items.hp.equalFlag
  const next = !prev
  if (!next) {
    legend.value.baseInfo.maxHp = legend.value.baseInfo.hp
  }
  legend.value.renderConfig.items.hp.equalFlag = next
  recordModify('体力与上限联动', {
    category: 'baseInfo',
    format: 'bool',
    before: prev,
    after: next,
  })
}

const legendNameHistory = createTextBlurHistoryHandlers(
  '武将名',
  () => legend.value.baseInfo.name,
  { category: 'baseInfo' },
)
const legendTitleHistory = createTextBlurHistoryHandlers(
  '称号',
  () => legend.value.baseInfo.title,
  { category: 'baseInfo' },
)
const legendQuoteHistory = createTextBlurHistoryHandlers(
  '引言',
  () => legend.value.baseInfo.quote ?? '',
  { category: 'baseInfo' },
)
const legendCopyrightHistory = createTextBlurHistoryHandlers(
  '版权画师',
  () => legend.value.baseInfo.copyright,
  { category: 'baseInfo' },
)
const legendIdHistory = createTextBlurHistoryHandlers(
  '武将编号',
  () => legend.value.baseInfo.legendId,
  { category: 'baseInfo' },
)

const skillNameFocusMap = new Map<number, string>()

const onSkillNameFocus = (index: number) => {
  skillNameFocusMap.set(index, legend.value.baseInfo.skills[index]?.name ?? '')
}

const onSkillNameBlur = (index: number) => {
  const prev = skillNameFocusMap.get(index) ?? ''
  const next = legend.value.baseInfo.skills[index]?.name ?? ''
  recordTextBlurModify('技能名', prev, next, { category: 'skills' })
}

const onSkillDescFocus = (index: number) => {
  skillDescFocusMap.set(index, legend.value.baseInfo.skills[index]?.desc ?? '')
}
const onSkillDescBlur = (index: number) => {
  const prev = skillDescFocusMap.get(index) ?? ''
  const next = legend.value.baseInfo.skills[index]?.desc ?? ''
  if (prev === next) return
  const skill = legend.value.baseInfo.skills[index]
  const skillLabel = skill?.name ? `【${skill.name}】` : `第${index + 1}项`
  recordModify('技能描述', { category: 'skills', detail: skillLabel, force: true })
}
const skillDescFocusMap = new Map<number, string>()

watch(
  () => diyStore.reloadFlag,
  () => {
    lastSkillOrderSnapshot = snapshotSkillNames()
  },
)
</script>

<template>
  <n-collapse-item title="基础信息" name="base">
    <n-form-item label="武将版本">
      <n-button type="primary" @click="openResourceSearch('legend', legend.baseInfo.name)">
        <template #icon>
          <n-icon><PublicRound /></n-icon>
        </template>
        武将搜索
      </n-button>
    </n-form-item>
    <n-form-item label="双势力">
      <n-switch
        :value="legend.renderConfig.items.kingdom.doubleKingdom"
        @update:value="
          (v) =>
            applyFieldChange(
              '双势力',
              legend.renderConfig.items.kingdom.doubleKingdom,
              v,
              (val) => {
                legend.renderConfig.items.kingdom.doubleKingdom = val
                if (val) {
                  onDoubleKingdomEnabled(legend, KINGDOM_DISPLAY_ORDER)
                  ensureCustomKingdomSetup(legend)
                  syncSkillsKingdom()
                }
              },
              { category: 'baseInfo', format: 'bool' },
            )
        "
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </n-form-item>
    <div v-if="!showDoubleKingdomPicker">
      <n-form-item label="势力">
        <div class="kingdom-option-buttons">
          <n-button
            v-for="kingdom in templateKingdomValues"
            :key="kingdom"
            size="small"
            :class="[
              'kingdom-option',
              `kingdom-option--${kingdom}`,
              { 'kingdom-option--selected': legend.baseInfo.kingdom === kingdom },
            ]"
            @click="
              applyFieldChange(
                '势力',
                legend.baseInfo.kingdom,
                kingdom,
                (val) => {
                  legend.baseInfo.kingdom = val
                },
                { category: 'baseInfo', format: 'kingdom' },
              )
            "
          >
            {{ getKingdomLabel(kingdom) }}
          </n-button>
        </div>
      </n-form-item>
      <n-form-item label="边框">
        <div class="kingdom-option-buttons">
          <n-button
            v-for="kingdom in templateKingdomValues"
            :key="kingdom"
            size="small"
            :disabled="legend.baseInfo.kingdom === 'shen' ? kingdom !== 'shen' : false"
            :class="[
              'kingdom-option',
              `kingdom-option--${kingdom}`,
              {
                'kingdom-option--selected': legend.renderConfig.items.frame.src === kingdom,
              },
            ]"
            @click="
              applyFieldChange(
                '边框',
                legend.renderConfig.items.frame.src,
                kingdom,
                (val) => {
                  legend.renderConfig.items.frame.src = val
                },
                { category: 'baseInfo', format: 'kingdom' },
              )
            "
          >
            {{ getKingdomLabel(kingdom) }}
          </n-button>
        </div>
      </n-form-item>
    </div>
    <div v-else>
      <n-form-item label="势力">
        <OrderedKingdomPicker
          v-model="doubleKingdomList"
          :options="templateKingdomValues"
          :max="2"
          :disabled="isDoubleKingdomPickerDisabled"
          :display-order="KINGDOM_DISPLAY_ORDER"
        />
      </n-form-item>
    </div>
    <n-form-item label="名称">
      <div class="legend-config__name-row">
        <n-input
          v-model:value="legend.baseInfo.name"
          class="legend-config__name-input"
          :maxlength="10"
          @focus="legendNameHistory.onFocus"
          @blur="legendNameHistory.onBlur"
        />
        <n-button
          type="primary"
          secondary
          :loading="legendNumberFetching"
          @click="fetchLegendNumber"
        >
          获取武将编号
        </n-button>
      </div>
    </n-form-item>
    <n-form-item label="称号">
      <n-input
        v-model:value="legend.baseInfo.title"
        :maxlength="8"
        @focus="legendTitleHistory.onFocus"
        @blur="legendTitleHistory.onBlur"
      />
    </n-form-item>
    <n-form-item label="武将图">
      <n-space wrap :size="8" align="center">
        <n-upload
          ref="legendPicUploadRef"
          action="#"
          :max="1"
          :accept="'.png,.jpg,.jpeg'"
          :show-file-list="false"
          :custom-request="uploadLegendImage"
        >
          <n-button type="info">
            <template #icon>
              <n-icon>
                <FileUploadOutlined />
              </n-icon>
            </template>
            上传武将图
          </n-button>
        </n-upload>
        <n-button type="primary" @click="openResourceSearch('image', legend.baseInfo.name)">
          <template #icon>
            <n-icon><PublicRound /></n-icon>
          </template>
          原画搜索
        </n-button>
        <n-button
          secondary
          :disabled="!legend.baseInfo.pic"
          :loading="downloadingLegendPic"
          @click="downloadLegendImage"
        >
          <template #icon>
            <n-icon><DownloadRound /></n-icon>
          </template>
          下载武将图
        </n-button>
      </n-space>
    </n-form-item>
    <n-form-item label="人物出框">
      <n-space wrap :size="8" align="center">
        <n-button type="warning" @click="openOutOfFrameEditor">
          <template #icon>
            <n-icon><OpenWithRound /></n-icon>
          </template>
          制作人物出框
        </n-button>
        <n-button
          secondary
          :disabled="!canDownloadOutOfFrame"
          :loading="downloadingOutOfFrame"
          @click="downloadOutOfFrameImage"
        >
          <template #icon>
            <n-icon><DownloadRound /></n-icon>
          </template>
          下载出框图
        </n-button>
        <n-button
          v-if="outOfFrameConfig.enabled"
          quaternary
          type="error"
          @click="clearOutOfFrame"
        >
          关闭出框
        </n-button>
      </n-space>
    </n-form-item>
    <OutOfFrameEditor
      :show="outOfFrameEditorVisible"
      @update:show="handleOutOfFrameShowUpdate"
      :source-pic="legend.baseInfo.pic"
      :mask-data-url="outOfFrameConfig.maskDataUrl"
      :stage-width="stageSize.width"
      :stage-height="stageSize.height"
      @apply="onOutOfFrameApply"
    />
    <n-form-item label="主公" v-if="!usesShenCardLayout(legend)">
      <n-switch
        :disabled="isDoubleKingdomSwitchOn"
        :value="legend.baseInfo.masterFlag"
        @update:value="
          (v) =>
            applyFieldChange(
              '主公',
              legend.baseInfo.masterFlag,
              v,
              (val) => {
                legend.baseInfo.masterFlag = val
              },
              { category: 'baseInfo', format: 'yesNo' },
            )
        "
      >
        <template #checked>是</template>
        <template #unchecked>否</template>
      </n-switch>
    </n-form-item>
    <n-form-item label="体力值">
      <div class="legend-config__hp-row">
        <n-input-number
          :value="legend.baseInfo.hp"
          :min="0"
          :max="99"
          button-placement="both"
          @update:value="
            (v) => {
              if (typeof v !== 'number') return
              applyFieldChange(
                '体力',
                legend.baseInfo.hp,
                v,
                (val) => {
                  legend.baseInfo.hp = val
                },
                { category: 'baseInfo' },
              )
            }
          "
        />
        <n-button
          strong
          :secondary="legend.renderConfig.items.hp.equalFlag"
          :tertiary="!legend.renderConfig.items.hp.equalFlag"
          circle
          type="info"
          @click="handleHpEqualFlag"
        >
          <template #icon>
            <n-icon>
              <LockRound v-if="legend.renderConfig.items.hp.equalFlag" />
              <LockOpenRound v-else />
            </n-icon>
          </template>
        </n-button>
        <n-input-number
          v-show="!legend.renderConfig.items.hp.equalFlag"
          :value="legend.baseInfo.maxHp"
          :min="0"
          :max="99"
          button-placement="both"
          @update:value="
            (v) => {
              if (typeof v !== 'number') return
              applyFieldChange(
                '体力上限',
                legend.baseInfo.maxHp,
                v,
                (val) => {
                  legend.baseInfo.maxHp = val
                },
                { category: 'baseInfo' },
              )
            }
          "
        />
      </div>
    </n-form-item>
    <n-form-item label="护甲值">
      <n-input-number
        :value="legend.baseInfo.shield"
        :min="0"
        :max="99"
        button-placement="both"
        @update:value="
          (v) => {
            if (typeof v !== 'number') return
            applyFieldChange(
              '护甲',
              legend.baseInfo.shield,
              v,
              (val) => {
                legend.baseInfo.shield = val
              },
              { category: 'baseInfo' },
            )
          }
        "
      />
    </n-form-item>
  </n-collapse-item>
  <n-collapse-item title="武将技能" name="skill">
    <div class="legend-config__skills">
      <div class="legend-config__skill-auto-options">
        <n-form-item label="优化描述">
          <template #label>
            <div class="legend-config__skill-auto-label">
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-icon size="1.1em">
                    <HelpRound />
                  </n-icon>
                </template>
                开启后：纠正标点符号，并在句末自动补标点。
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
            <div class="legend-config__skill-auto-label">
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-icon size="1.1em">
                    <HelpRound />
                  </n-icon>
                </template>
                开启后：自动适配描述字号，并启用字号限制。
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
      </div>
      <draggable
        v-model="legend.baseInfo.skills"
        class="legend-config__skill-list"
        :item-key="resolveSkillRowKey"
        handle=".legend-config__drag-handle"
        :animation="skillDragAnimation"
        :ghost-class="skillDragGhostClass || undefined"
        :force-fallback="shouldUseLightDragEffects()"
        fallback-class="legend-config__skill--fallback"
      >
        <template #item="{ element: skill, index }">
          <n-el tag="div" class="legend-config__skill-wrapper">
            <div class="legend-config__skill">
              <div class="legend-config__skill-actions">
                <n-tooltip>
                  <template #trigger>
                    <n-button circle secondary class="legend-config__drag-handle">
                      <template #icon>
                        <n-icon>
                          <OpenWithRound />
                        </n-icon>
                      </template>
                    </n-button>
                  </template>
                  拖拽排序
                </n-tooltip>
                <n-tooltip>
                  <template #trigger>
                    <n-button
                      circle
                      type="info"
                      :secondary="!skill.derivedFlag"
                      @click="
                        () => {
                          const prev = Boolean(skill.derivedFlag)
                          const next = !prev
                          skill.derivedFlag = next
                          recordModify('衍生技标识', {
                            category: 'skills',
                            detail: `【${skill.name || '未命名'}】`,
                          })
                        }
                      "
                    >
                      <template #icon>
                        <n-icon>
                          <KeyboardDoubleArrowUpRound />
                        </n-icon>
                      </template>
                    </n-button>
                  </template>
                  衍生技标识
                </n-tooltip>
                <n-tooltip>
                  <template #trigger>
                    <n-button circle type="error" secondary @click="handleSkillDelete(index)">
                      <template #icon>
                        <n-icon>
                          <RemoveCircleOutlineFilled />
                        </n-icon>
                      </template>
                    </n-button>
                  </template>
                  删除技能
                </n-tooltip>
              </div>
              <div class="legend-config__skill-body">
                <div class="legend-config__skill-meta">
                  <label class="legend-config__skill-field">
                    <span class="legend-config__skill-field-label">技能名</span>
                    <div class="legend-config__skill-name-row">
                      <n-input
                        v-model:value="skill.name"
                        size="medium"
                        class="legend-config__skill-name-input"
                        :maxlength="2"
                        placeholder="二字"
                        @focus="onSkillNameFocus(index)"
                        @blur="onSkillNameBlur(index)"
                      />
                      <n-button
                        circle
                        type="primary"
                        class="legend-config__skill-search-btn"
                        @click="openSkillSearch(index, skill.name)"
                      >
                        <template #icon>
                          <n-icon><PublicRound /></n-icon>
                        </template>
                      </n-button>
                    </div>
                  </label>
                  <label v-if="showSkillKingdomPicker" class="legend-config__skill-field">
                    <span class="legend-config__skill-field-label">势力技</span>
                    <n-select
                      :value="resolveSkillKingdomSelectValue(skill.kingdom)"
                      size="medium"
                      :options="skillKingdomSelectOptions"
                      placeholder="选择"
                      class="legend-config__skill-kingdom-select"
                      @update:value="
                        (val) => {
                          skill.kingdom = resolveSkillKingdomSelectValue(val ?? undefined)
                        }
                      "
                    />
                  </label>
                </div>
                <div v-if="skill.desc !== undefined" class="legend-config__skill-desc">
                  <DescInput
                    v-model="skill.desc"
                    @focus="onSkillDescFocus(index)"
                    @blur="onSkillDescBlur(index)"
                  />
                </div>
              </div>
            </div>
          </n-el>
        </template>
      </draggable>
      <div class="legend-config__skill-add">
        <n-button type="primary" secondary @click="handleSkillAdd">
          <template #icon>
            <n-icon>
              <AddCircleRound />
            </n-icon>
          </template>
          添加技能
        </n-button>
      </div>
    </div>
  </n-collapse-item>
  <n-collapse-item :title="PACKAGE_IDENTIFY_CONFIG_TITLE" name="package">
    <n-form-item label="类型">
      <n-select
        :value="packageIdentifyValue"
        :options="packageIdentifyOptions"
        placeholder="武将牌右下角角标"
        style="width: 100%"
        @update:value="onPackageIdentifyChange"
      />
    </n-form-item>
    <n-form-item v-if="isPackageLibrary" label="角标库">
      <n-space wrap :size="8" align="center">
        <n-button type="primary" @click="openResourceSearch('package')">
          <template #icon>
            <n-icon><PublicRound /></n-icon>
          </template>
          搜索角标
        </n-button>
        <img
          v-if="legend.baseInfo.packageIdentify.pic"
          class="legend-config__package-preview"
          :src="legend.baseInfo.packageIdentify.pic"
          alt="已选角标"
        />
      </n-space>
    </n-form-item>
    <n-form-item v-if="isPackageUploadImage" label="上传图片">
      <n-upload
        ref="packageImageUploadRef"
        :max="1"
        :show-file-list="false"
        accept="image/*"
        :custom-request="uploadPackageImage"
      >
        <n-button type="primary" secondary>
          <template #icon>
            <n-icon>
              <FileUploadOutlined />
            </n-icon>
          </template>
          上传图片
        </n-button>
      </n-upload>
    </n-form-item>
    <n-form-item v-if="isPackageCustomText" label="角标文字">
      <n-input
        :value="legend.baseInfo.packageIdentify.text"
        :maxlength="packageTextMaxLength"
        show-count
        placeholder="请输入角标文字"
        @update:value="onPackageTextChange"
      />
    </n-form-item>
    <template v-if="isPackageCustomText">
      <n-form-item v-if="isPackageGradientBadge" label="角标颜色">
        <div class="legend-config__package-colors">
          <div class="legend-config__package-color-row">
            <span class="legend-config__package-color-label">起点</span>
            <div class="legend-config__color">
              <div
                class="legend-config__color-swatch"
                :style="{ backgroundColor: packageColorPreview('start') }"
                @click="openPackageColorPicker('start')"
              />
            </div>
          </div>
          <div class="legend-config__package-color-row">
            <span class="legend-config__package-color-label">终点</span>
            <div class="legend-config__color">
              <div
                class="legend-config__color-swatch"
                :style="{ backgroundColor: packageColorPreview('end') }"
                @click="openPackageColorPicker('end')"
              />
            </div>
          </div>
          <n-color-picker
            v-model:show="packageColorPicker.showFlag"
            v-model:value="packageColorPicker.value"
            class="legend-config__color-picker"
            :show-alpha="CUSTOM_COLOR_PICKER_UI.package.showAlpha"
            :modes="CUSTOM_COLOR_PICKER_UI.package.modes"
            :swatches="CUSTOM_COLOR_PICKER_UI.package.swatches"
            :actions="['confirm']"
            @confirm="handlePackageColorConfirm"
          />
        </div>
      </n-form-item>
      <n-form-item v-else label="角标颜色">
        <div class="legend-config__color">
          <div
            class="legend-config__color-swatch"
            :style="{ backgroundColor: packageColorPreview('start') }"
            @click="openPackageColorPicker('start')"
          />
          <n-color-picker
            v-model:show="packageColorPicker.showFlag"
            v-model:value="packageColorPicker.value"
            class="legend-config__color-picker"
            :show-alpha="CUSTOM_COLOR_PICKER_UI.package.showAlpha"
            :modes="CUSTOM_COLOR_PICKER_UI.package.modes"
            :swatches="CUSTOM_COLOR_PICKER_UI.package.swatches"
            :actions="['confirm']"
            @confirm="handlePackageColorConfirm"
          />
        </div>
      </n-form-item>
    </template>
  </n-collapse-item>
  <n-collapse-item title="其他信息" name="other">
    <n-form-item label="引言">
      <n-input
        v-model:value="legend.baseInfo.quote"
        type="textarea"
        :maxlength="99"
        show-count
        :rows="3"
        placeholder="技能区右下角引言…"
        @focus="legendQuoteHistory.onFocus"
        @blur="legendQuoteHistory.onBlur"
      />
    </n-form-item>
    <n-form-item label="底部信息">
      <n-switch
        :value="legend.renderConfig.items.bottomInfo.showFlag"
        @update:value="
          (v) =>
            applyFieldChange(
              '底部信息',
              legend.renderConfig.items.bottomInfo.showFlag,
              v,
              (val) => {
                legend.renderConfig.items.bottomInfo.showFlag = val
              },
              { category: 'baseInfo', format: 'bool' },
            )
        "
      >
        <template #checked>显示</template>
        <template #unchecked>隐藏</template>
      </n-switch>
    </n-form-item>
    <template v-if="legend.renderConfig.items.bottomInfo.showFlag">
      <n-form-item label="版权画师">
        <n-input
          v-model:value="legend.baseInfo.copyright"
          :maxlength="50"
          show-count
          placeholder="™&© … .Illustration: …"
          @focus="legendCopyrightHistory.onFocus"
          @blur="legendCopyrightHistory.onBlur"
        />
      </n-form-item>
      <n-form-item label="武将编号" class="legend-config__legend-id">
        <DescInput
          v-model="legend.baseInfo.legendId"
          :maxlength="100"
          :rows="2"
          placeholder="WEI 027"
          @focus="legendIdHistory.onFocus"
          @blur="legendIdHistory.onBlur"
        />
      </n-form-item>
    </template>
  </n-collapse-item>

  <DiyResourceSearchDrawer
    :show="searchDrawerVisible"
    :mode="searchMode"
    :keyword="searchKeyword"
    :skill-index="searchSkillIndex"
    :apply-pending="wikiApplying"
    @apply="handleSearchApply"
  />
</template>

<style scoped>
.legend-config__hp-row {
  display: flex;
  align-items: center;
  gap: 15px;
}
.legend-config__skills {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-config__skill-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.legend-config__skill {
  display: flex;
  gap: 10px;
  align-items: stretch;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--n-color);
}

.legend-config__skill-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  flex-shrink: 0;
  padding-top: 4px;
}

.legend-config__skill-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-config__skill-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.legend-config__skill-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.legend-config__skill-field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-2);
  line-height: 1.2;
}

.legend-config__skill-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-config__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.legend-config__name-input {
  flex: 1;
  min-width: 0;
}

.legend-config__skill-name-input {
  width: 88px;
}

.legend-config__skill-search-btn {
  flex-shrink: 0;
}

.legend-config__skill-kingdom-select {
  width: min(100%, 176px);
  min-width: 140px;
}

.legend-config__skill-desc,
.legend-config__legend-id :deep(.n-form-item-blank) {
  min-width: 0;
}

.legend-config__legend-id :deep(.desc-input) {
  gap: 4px;
}

.legend-config__skill-desc :deep(.desc-input) {
  gap: 4px;
}

.legend-config__skill-desc :deep(.desc-input__tools) {
  background: color-mix(in srgb, var(--body-color) 55%, transparent);
}

.legend-config__skill-desc :deep(.n-input .n-input__textarea-el) {
  min-height: 72px;
}

.legend-config__skill-auto-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.legend-config__skill-auto-options :deep(.n-form-item-feedback-wrapper) {
  min-height: 0 !important;
  margin: 0;
  padding: 0;
}

.legend-config__skill-auto-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;
}

.legend-config__drag-handle {
  cursor: grab;
}

.legend-config__drag-handle:active {
  cursor: grabbing;
}
.legend-config__skill--ghost {
  opacity: 0.5;
}

.legend-config__skill--fallback {
  opacity: 0.85;
}

.legend-config__package-preview {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--body-color);
}

.legend-config__color {
  width: 34px;
  height: 34px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.legend-config__package-colors {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-config__package-color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.legend-config__package-color-label {
  min-width: 2.5em;
  font-size: 12px;
  color: var(--text-color-3);
}

.legend-config__color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.legend-config__color-picker {
  position: absolute;
  left: 0;
  top: 0;
  width: 22px;
  height: 22px;
  opacity: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .legend-config__skill-list :deep(.sortable-ghost),
  .legend-config__skill--ghost,
  .legend-config__skill--fallback {
    transition: none !important;
  }
}
</style>
