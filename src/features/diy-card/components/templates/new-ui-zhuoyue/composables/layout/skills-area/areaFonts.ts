import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import type { useDiyStore } from '@/features/diy-card/stores'
import {
  buildFontProbe,
  loadWebFontFamilies,
  loadWebFontFamily,
  waitForWebFontFamily,
  whenWebFontFamilyReady,
} from '@/features/diy-card/utils/loadWebFontFamily'
import { QUOTE_FONT_FAMILY } from '../../constants/quote'
import {
  SKILL_DESC_DERIVED_FONT_NEW,
  SKILL_DESC_DERIVED_FONT_OLD,
  SKILL_DESC_FONT_NEW,
  SKILL_DESC_FONT_OLD,
  SKILL_NAME_FONT_FAMILY,
} from '../../constants/skills'

type DiyStore = ReturnType<typeof useDiyStore>

export const SKILL_NAME_FONT_PROBE = buildFontProbe(SKILL_NAME_FONT_FAMILY)

type SkillsAreaFontEntry = {
  family: string
  label: string
  probe: ReturnType<typeof buildFontProbe>
}

const SKILLS_AREA_FONT_REGISTRY: Record<string, SkillsAreaFontEntry> = {
  [SKILL_DESC_FONT_OLD]: {
    family: SKILL_DESC_FONT_OLD,
    label: '技能描述字体',
    probe: buildFontProbe(SKILL_DESC_FONT_OLD),
  },
  [SKILL_DESC_FONT_NEW]: {
    family: SKILL_DESC_FONT_NEW,
    label: '技能描述字体',
    probe: buildFontProbe(SKILL_DESC_FONT_NEW),
  },
  [SKILL_DESC_DERIVED_FONT_OLD]: {
    family: SKILL_DESC_DERIVED_FONT_OLD,
    label: '技能描述字体',
    probe: buildFontProbe(SKILL_DESC_DERIVED_FONT_OLD),
  },
  [SKILL_DESC_DERIVED_FONT_NEW]: {
    family: SKILL_DESC_DERIVED_FONT_NEW,
    label: '技能描述字体',
    probe: buildFontProbe(SKILL_DESC_DERIVED_FONT_NEW),
  },
  [QUOTE_FONT_FAMILY]: {
    family: QUOTE_FONT_FAMILY,
    label: '引言字体',
    probe: buildFontProbe(QUOTE_FONT_FAMILY),
  },
  [SKILL_NAME_FONT_FAMILY]: {
    family: SKILL_NAME_FONT_FAMILY,
    label: '技能名字体',
    probe: SKILL_NAME_FONT_PROBE,
  },
}

export type LoadSkillsAreaFontsOptions = {
  /** skills-desc / 出框挖洞等只测描述区时可不加载技能名字体 */
  includeSkillName?: boolean
}

/** 按当前卡牌配置解析技能区实际需要的 Web 字体族 */
export const resolveSkillsAreaFontFamilies = (
  info: LegendInfo,
  options: LoadSkillsAreaFontsOptions = {},
): string[] => {
  const { includeSkillName = true } = options
  const families = new Set<string>()
  const descItem = info.renderConfig.items.skillsDesc
  const useNewDescFont = Boolean(descItem.newFontFlag)

  families.add(useNewDescFont ? SKILL_DESC_FONT_NEW : SKILL_DESC_FONT_OLD)

  if (info.baseInfo.skills.some((skill) => skill.derivedFlag)) {
    families.add(
      useNewDescFont ? SKILL_DESC_DERIVED_FONT_NEW : SKILL_DESC_DERIVED_FONT_OLD,
    )
  }

  const quoteText = (info.baseInfo.quote ?? '').replace(/ /g, ' ')
  if (quoteText) {
    families.add(QUOTE_FONT_FAMILY)
  }

  if (includeSkillName) {
    families.add(SKILL_NAME_FONT_FAMILY)
  }

  return [...families]
}

const resolveSkillsAreaFontEntries = (
  info: LegendInfo,
  options: LoadSkillsAreaFontsOptions = {},
): SkillsAreaFontEntry[] =>
  resolveSkillsAreaFontFamilies(info, options)
    .map((family) => SKILLS_AREA_FONT_REGISTRY[family])
    .filter((entry): entry is SkillsAreaFontEntry => Boolean(entry))

/** 技能区测高与技能名排版共用的 Web 字体（按当前配置按需加载） */
export const loadSkillsAreaFonts = async (
  diyStore: DiyStore,
  info: LegendInfo,
  options: LoadSkillsAreaFontsOptions = {},
): Promise<{ skillNameFontReady: boolean }> => {
  const entries = resolveSkillsAreaFontEntries(info, options)
  if (!entries.length) {
    return { skillNameFontReady: false }
  }

  const descEntries = entries.filter((entry) => entry.family !== SKILL_NAME_FONT_FAMILY)
  const skillNameEntry = entries.find((entry) => entry.family === SKILL_NAME_FONT_FAMILY)

  if (descEntries.length) {
    await loadWebFontFamilies(
      descEntries.map(({ family }) => family),
      {
        diyStore,
        label: '技能描述字体',
        probes: Object.fromEntries(descEntries.map(({ family, probe }) => [family, probe])),
      },
    )
  }

  if (skillNameEntry) {
    await loadWebFontFamily(skillNameEntry.family, {
      diyStore,
      label: skillNameEntry.label,
      probe: skillNameEntry.probe,
    })
  }

  const readyFlags = await Promise.all(
    entries.map(({ family, probe }) => waitForWebFontFamily(family, { probe })),
  )

  const skillNameIndex = entries.findIndex(
    (entry) => entry.family === SKILL_NAME_FONT_FAMILY,
  )

  return {
    skillNameFontReady: skillNameIndex >= 0 ? Boolean(readyFlags[skillNameIndex]) : false,
  }
}

/** 技能名字体晚于首屏就绪时回调（动画已结束但 woff2 刚下载完） */
export const whenSkillNameFontReady = (callback: () => void): (() => void) =>
  whenWebFontFamilyReady(SKILL_NAME_FONT_FAMILY, callback, { probe: SKILL_NAME_FONT_PROBE })

export { SKILL_NAME_FONT_FAMILY }
