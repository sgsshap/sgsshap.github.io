import { KINGDOM_DISPLAY_ORDER } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/kingdom'
import {
  getDoubleKingdomList,
  normalizeSkillKingdom,
  onDoubleKingdomEnabled,
  resetPresetKingdomGlyphLayout,
} from '@/features/diy-card/composables/doubleKingdom'
import {
  beginKingdomToggleCanvasBatch,
  endKingdomToggleCanvasBatch,
} from '@/features/diy-card/composables/kingdomToggleCanvasGate'
import { cancelSkillsAreaLayoutTasks } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/skills-area/areaLayoutGate'
import {
  clearSkillsDescManualFontSize,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/skills-area/layout'
import { resetSkillDescLineImageCache } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/skills-desc/lineAsset'
import { resetSkillDescShenBgImageCache } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/skills-desc/skillDescBg'
import {
  DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY,
  DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY,
  DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR,
} from '@/features/diy-card/constants/customKingdomDefaults'
import type { LegendInfo, LegendSkill } from '@/features/diy-card/types/diy/legend'
import { resetOutOfFrameOnPicChange } from '@/features/diy-card/types/diy/outOfFrame'
import { resetLegendImageLayoutOnPicChange } from '@/features/diy-card/utils/legendImageLayout'
import { invalidateLegendOutOfFrameComposite } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layers/legend-out-of-frame'
import { resolvePackageIdentifyPreset } from '@/features/diy-card/types/diy/packageIdentify'
import type {
  DiySearchSelectPayload,
  MaterialSelectPayload,
  WikiImageSelectPayload,
  WikiLegendSelectPayload,
  WikiSkillSelectPayload,
} from '@/features/diy-card/types/search'
import { useDiyHistoryStore, useDiyStore } from '@/features/diy-card/stores'
import { recordModify } from '@/features/diy-card/utils/diyHistoryField'
import { recordPackageConfigChange } from '@/features/diy-card/utils/packageLegendSnapshot'
import {
  applyShenFrameKingdomGlyphColor,
  resolveKingdomForFrame,
  syncFrameSrcToKingdom,
  syncShenFrameGlyphColorFlag,
} from '@/features/diy-card/utils/syncFrameKingdom'
import { usesShenCardLayout } from '@/features/diy-card/composables/doubleKingdom'
import { resetPresetCardLayoutOnModeChange } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/cardTextLayout'
import { sortKingdomsByDisplayOrder } from '@/shared/utils/kingdom'

const WIKI_DOUBLE_KINGDOM_SEP = /&/

const normalizeKingdom = (raw: unknown): string => {
  let kingdom = String(raw ?? 'wei').trim().toLowerCase()
  if (kingdom === 'le' || kingdom === '神') {
    kingdom = 'shen'
  }
  return kingdom
}

/** 百科势力字段可能为 wei&qun 形式的双势力 */
const parseWikiKingdomKeys = (raw: unknown): string[] => {
  let text = String(raw ?? 'wei').trim()
  if (!text) return ['wei']
  try {
    text = decodeURIComponent(text)
  } catch {
    // 保持原样
  }
  return text
    .split(WIKI_DOUBLE_KINGDOM_SEP)
    .map((part) => normalizeKingdom(part.trim()))
    .filter((k) => k.length > 0)
}

/** 按百科势力写入单/双势力（需在 resetLegendOverridesForWikiVersion 之后调用） */
const applyWikiKingdomFromLegend = (legend: LegendInfo, wikiKingdomRaw: unknown) => {
  const keys = parseWikiKingdomKeys(wikiKingdomRaw)
  const playable = keys.filter((k) => k !== 'shen')

  if (playable.length >= 2) {
    const kingdomItem = legend.renderConfig.items.kingdom
    kingdomItem.doubleKingdom = true
    const sorted = sortKingdomsByDisplayOrder(playable.slice(0, 2), KINGDOM_DISPLAY_ORDER)
    legend.baseInfo.doubleKingdom = sorted
    legend.baseInfo.kingdom = sorted[0]!
    onDoubleKingdomEnabled(legend, KINGDOM_DISPLAY_ORDER)
    return
  }

  legend.renderConfig.items.kingdom.doubleKingdom = false
  legend.baseInfo.doubleKingdom = undefined
  legend.baseInfo.kingdom = playable[0] ?? normalizeKingdom(keys[0] ?? 'wei')
}

const syncSkillsKingdomAfterWikiApply = (legend: LegendInfo) => {
  if (!legend.renderConfig.items.kingdom.doubleKingdom) return
  const kingdoms = getDoubleKingdomList(legend)
  if (kingdoms.length < 2) return
  legend.baseInfo.skills.forEach((skill) => {
    skill.kingdom = normalizeSkillKingdom(skill.kingdom, kingdoms)
  })
}

export const replacePainterInCopyright = (copyright: string, painter: string) => {
  const marker = '.Illustration:'
  const start = copyright.indexOf(marker)
  if (start < 0) {
    return copyright
  }
  return copyright.slice(0, start + marker.length) + ' ' + painter
}

const mapVersionSkills = (skills: unknown): LegendSkill[] => {
  if (!Array.isArray(skills)) {
    return []
  }
  return skills.map((skill) => {
    const row = skill as Record<string, unknown>
    return {
      name: String(row.skillName ?? ''),
      desc: String(row.description ?? ''),
      derivedFlag: Boolean(row.derivedFlag),
      masterFlag: Boolean(row.masterFlag),
      kingdom: row.kingdom ? String(row.kingdom) : undefined,
    }
  })
}

type ApplyWikiOptions = {
  skipRecord?: boolean
}

const cloneDiySearchPayload = (payload: DiySearchSelectPayload): DiySearchSelectPayload =>
  JSON.parse(JSON.stringify(payload)) as DiySearchSelectPayload

const toImageSrc = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed === '[object Object]') return undefined
  return trimmed
}

/** 画布武将图使用原图 url；previewUrl 为列表缩略图，部分环境下无法正常解码 */
const resolveWikiImageUrl = (image: Record<string, unknown> | undefined): string | undefined => {
  if (!image) return undefined
  return toImageSrc(image.url) ?? toImageSrc(image.previewUrl)
}

const buildLegendWikiHistoryLabel = (legendName: unknown, versionLabel?: unknown) => {
  const name = String(legendName ?? '').trim() || '未命名武将'
  const version = String(versionLabel ?? '').trim() || '未命名版本'
  return `使用 武将版本：【${name}】${version}`
}

/** 应用百科版本前：关闭自定义势力/双势力/扩展预设等覆盖，按版本标准势力渲染 */
const resetLegendOverridesForWikiVersion = (legend: LegendInfo) => {
  const kingdom = legend.renderConfig.items.kingdom
  kingdom.customKingdomFlag = false
  kingdom.presetKingdomKey = ''
  kingdom.doubleKingdom = false
  kingdom.doubleSingleGlyphFlag = false
  kingdom.doubleSingleGlyphRole = 'primary'
  kingdom.customText = { single: '', primary: '', secondary: '' }
  kingdom.glyphEmptyFlag = false
  kingdom.glyphColorFlag = false
  kingdom.glyphColor = ''
  kingdom.glyphColorPrimary = ''
  kingdom.glyphColorSecondary = ''
  kingdom.glyphGradientFlag = false
  kingdom.glyphGradientEndColor = ''
  kingdom.glyphGradientEndColorPrimary = ''
  kingdom.glyphGradientEndColorSecondary = ''
  kingdom.customColor = DEFAULT_CUSTOM_SINGLE_KINGDOM_COLOR
  kingdom.customColorPrimary = DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_PRIMARY
  kingdom.customColorSecondary = DEFAULT_CUSTOM_DOUBLE_KINGDOM_COLOR_SECONDARY
  kingdom.customShenTitleColorFlag = false
  resetPresetKingdomGlyphLayout(kingdom)
  delete kingdom.size

  legend.baseInfo.doubleKingdom = undefined

  const hp = legend.renderConfig.items.hp
  hp.customColorFlag = false
  hp.customColor = ''
  hp.customColorPrimary = ''
  hp.customColorSecondary = ''

  const title = legend.renderConfig.items.title
  title.customColorFlag = false
  title.customColor = ''
  title.customColorPrimary = ''
  title.customColorSecondary = ''
}

export const applyLegendWikiSelection = (
  legend: LegendInfo,
  payload: WikiLegendSelectPayload,
  options?: ApplyWikiOptions,
) => {
  const wikiLegend = payload.data.legend
  const version = payload.data.version

  legend.baseInfo.name = String(wikiLegend.name ?? '')
  legend.baseInfo.legendId = String(wikiLegend.number ?? '')
  legend.baseInfo.title = String(version.title ?? '')
  legend.baseInfo.masterFlag = Boolean(version.masterFlag)
  legend.baseInfo.quote = String(version.quote ?? '')

  const hp = Number(version.hp ?? legend.baseInfo.hp)
  const maxHp = Number(version.maxHp ?? hp)
  legend.baseInfo.hp = hp
  legend.baseInfo.maxHp = maxHp
  legend.renderConfig.items.hp.equalFlag = hp === maxHp
  legend.baseInfo.shield = Number(version.shield ?? 0)

  if (version.gameMode === 'national') {
    legend.baseInfo.nation = {
      ...legend.baseInfo.nation,
      hp: Number(version.nationalHp ?? hp),
      relation: String(version.pairLegends ?? ''),
    }
  } else {
    legend.baseInfo.nation = undefined
  }

  resetLegendOverridesForWikiVersion(legend)
  applyWikiKingdomFromLegend(legend, wikiLegend.kingdom)

  const image = version.image as Record<string, unknown> | undefined
  const picUrl = resolveWikiImageUrl(image)
  if (picUrl) {
    if (picUrl !== legend.baseInfo.pic) {
      resetOutOfFrameOnPicChange(legend.renderConfig)
      resetLegendImageLayoutOnPicChange(legend)
      invalidateLegendOutOfFrameComposite()
    }
    legend.baseInfo.pic = picUrl
    const painter = String(image?.painter ?? '佚名')
    legend.baseInfo.copyright = replacePainterInCopyright(legend.baseInfo.copyright, painter)
  }

  legend.baseInfo.skills = mapVersionSkills(version.skills)
  syncSkillsKingdomAfterWikiApply(legend)
  clearSkillsDescManualFontSize(legend)

  if (!options?.skipRecord) {
    recordModify('武将', {
      category: 'baseInfo',
      label: buildLegendWikiHistoryLabel(
        wikiLegend.name ?? legend.baseInfo.name,
        payload.data.versionLabel,
      ),
    })
  }
}

/** 批量应用百科武将：抑制联动 watch 的多次画布重载，结束后单次全量 reload */
export const applyLegendWikiSelectionBatched = async (
  legend: LegendInfo,
  payload: WikiLegendSelectPayload,
) => {
  const historyStore = useDiyHistoryStore()
  const diyStore = useDiyStore()
  const plain = cloneDiySearchPayload(payload) as WikiLegendSelectPayload

  beginKingdomToggleCanvasBatch()
  try {
    cancelSkillsAreaLayoutTasks()
    resetSkillDescLineImageCache()
    resetSkillDescShenBgImageCache()
    diyStore.releaseLoadingTask('legendImage')
    diyStore.releaseLoadingTask('skillsDesc')
    diyStore.clearLoading()

    const previousKingdom =
      resolveKingdomForFrame(legend) ?? legend.baseInfo.kingdom
    const previousFrameSrc = legend.renderConfig.items.frame.src?.trim() ?? ''
    const previousUsesShenLayout = usesShenCardLayout(legend)

    await historyStore.runBulkMutation(async () => {
      applyLegendWikiSelection(legend, plain, { skipRecord: true })
      syncFrameSrcToKingdom(legend, { previousKingdom })
      applyShenFrameKingdomGlyphColor(legend, previousFrameSrc)
      if (legend.renderConfig.items.frame.src?.trim() === 'shen') {
        syncShenFrameGlyphColorFlag(legend)
      }
    })

    const needsShenLayoutTransition = usesShenCardLayout(legend) !== previousUsesShenLayout
    if (needsShenLayoutTransition) {
      resetPresetCardLayoutOnModeChange(legend)
    }

    // 换原画时 apply 已把 legendImage 置回工厂布局，load(false) 会走 cover；勿 reload(true) 以免冲掉其它图层位置
    await diyStore.reload(needsShenLayoutTransition, {
      skipRemount: true,
      sequentialLoad: true,
    })

    recordModify('武将', {
      category: 'baseInfo',
      label: buildLegendWikiHistoryLabel(
        plain.data.legend.name ?? legend.baseInfo.name,
        plain.data.versionLabel,
      ),
    })

    if (historyStore.bootstrappedKinds[historyStore.activeInfoKind]) {
      await historyStore.flushPersist()
    }
  } finally {
    endKingdomToggleCanvasBatch()
  }
}

export const applyImageWikiSelection = (legend: LegendInfo, payload: WikiImageSelectPayload) => {
  const { url, title, painter } = payload.data
  if (url !== legend.baseInfo.pic) {
    resetOutOfFrameOnPicChange(legend.renderConfig)
    resetLegendImageLayoutOnPicChange(legend)
    invalidateLegendOutOfFrameComposite()
  }
  legend.baseInfo.pic = url
  if (title) {
    legend.baseInfo.title = title
  }
  legend.baseInfo.copyright = replacePainterInCopyright(
    legend.baseInfo.copyright,
    painter || '佚名',
  )
  recordModify('百科原画', { category: 'baseInfo', label: '使用百科原画' })
}

export const applyPackageMaterialSelection = (legend: LegendInfo, payload: MaterialSelectPayload) => {
  legend.baseInfo.packageIdentify = resolvePackageIdentifyPreset('user-select')
  legend.baseInfo.packageIdentify.pic = payload.data.url
  recordPackageConfigChange('角标库', { category: 'baseInfo' })
}

export const applySkillWikiSelection = (legend: LegendInfo, payload: WikiSkillSelectPayload) => {
  const skill = legend.baseInfo.skills[payload.skillIndex]
  if (!skill) {
    return
  }
  skill.name = payload.data.name
  skill.desc = payload.data.desc
  const skillName = String(skill.name ?? '').trim() || '未命名'
  recordModify('百科技能', {
    category: 'skills',
    label: `使用 百科技能：【${skillName}】`,
  })
}

export const applyDiySearchSelection = (
  legend: LegendInfo,
  payload: DiySearchSelectPayload,
  options?: ApplyWikiOptions,
) => {
  switch (payload.type) {
    case 'legend':
      applyLegendWikiSelection(legend, payload, options)
      break
    case 'image':
      applyImageWikiSelection(legend, payload)
      break
    case 'skill':
      applySkillWikiSelection(legend, payload)
      break
    case 'material':
      applyPackageMaterialSelection(legend, payload)
      break
  }
}
