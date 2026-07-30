import type { LegendInfo, LegendSkill } from '@/features/diy-card/types/diy/legend'
import {
  SKILL_DESC_DERIVED_FONT_NEW,
  SKILL_DESC_DERIVED_FONT_OLD,
  SKILL_DESC_FONT_NEW,
  SKILL_DESC_FONT_OLD,
  ensureSkillsDescAutoOptimizeDefault,
  ensureSkillsDescAutoSizeDefault,
  resolveSkillsDescAutoOptimizeFlag,
} from '../../constants/skills'

/** 已有 <full>…</full> 区块（保留原样，不再自动包裹） */
const SKILL_DESC_FULL_TAG_BLOCK_RE = /(<full>[\s\S]*?<\/full>)/gi

/** HTML 标签片段（自动全角 / 标点纠正不得改写标签内字符） */
const SKILL_DESC_HTML_TAG_RE = /(<[^>]+>)/gi

/** 句末可追加标点前，末尾连续的闭合行内标签 */
const TRAILING_INLINE_CLOSE_RE = /(?:\s|<\/(?:b|i|bi|s|u|full|span)>)*$/i

/** 自动全角：仅当数字两侧为汉字、空格或段首/段尾时才包裹 */
const AUTO_FULL_NUMBER_WRAP_NEIGHBOR_RE = /[\s\u4e00-\u9fff\u3400-\u4dbf]/

const isAutoFullNumberWrapNeighbor = (char: string | undefined) =>
  char === undefined || AUTO_FULL_NUMBER_WRAP_NEIGHBOR_RE.test(char)

const isAsciiDigit = (char: string | undefined): char is string =>
  char !== undefined && char >= '0' && char <= '9'

const wrapSingleArabicDigits = (segment: string) =>
  segment.replace(/(\d)/g, (digit, _match, offset) => {
    const before = segment[offset - 1]
    const after = segment[offset + 1]
    const afterNext = segment[offset + 2]
    if (isAsciiDigit(before)) return digit
    if (isAsciiDigit(after)) return digit
    if (after === '.' && isAsciiDigit(afterNext)) return digit
    if (!isAutoFullNumberWrapNeighbor(before) || !isAutoFullNumberWrapNeighbor(after)) {
      return digit
    }
    return `<full>${digit}</full>`
  })

const CJK_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

export type SkillDescPrimaryLanguage = 'zh' | 'en'

export type SkillDescRawResolveOptions = {
  autoFullNumberFlag: boolean
  autoOptimizeFlag: boolean
}

/** 去掉技能描述首尾空白（空格、换行、<br>、&nbsp; 等） */
export const trimSkillDescEdges = (raw: string): string => {
  let text = raw
  if (!text) return text

  const stripLeading = () => {
    const match =
      text.match(/^\s+/) ??
      text.match(/^<br\s*\/?>/i) ??
      text.match(/^&nbsp;/i)
    if (!match) return false
    text = text.slice(match[0].length)
    return true
  }

  const stripTrailing = () => {
    const match =
      text.match(/\s+$/) ??
      text.match(/<br\s*\/?>$/i) ??
      text.match(/&nbsp;$/i)
    if (!match) return false
    text = text.slice(0, -match[0].length)
    return true
  }

  while (stripLeading()) {}
  while (stripTrailing()) {}
  return text
}

/** 去除技能描述 HTML 标记，保留花色等 Unicode */
export const stripSkillDescMarkup = (raw: string) =>
  trimSkillDescEdges(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<full>(.*?)<\/full>/gi, '$1')
    .replace(/<\/?(?:b|i|bi|s|u)>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<\/?[^>]+>/g, '')
    .trim()

/** 判断技能描述主语言（按可见汉字与拉丁字母数量） */
export const detectSkillDescPrimaryLanguage = (raw: string): SkillDescPrimaryLanguage => {
  const plain = stripSkillDescMarkup(raw)
  if (!plain) return 'zh'

  let cjk = 0
  let latin = 0
  for (const char of plain) {
    if (CJK_CHAR_RE.test(char)) cjk += 1
    else if (/[A-Za-z]/.test(char)) latin += 1
  }
  return cjk >= latin ? 'zh' : 'en'
}

const mapAsciiDoubleQuotesToChinese = (segment: string) => {
  let open = true
  return segment.replace(/"/g, () => {
    const quote = open ? '\u201c' : '\u201d'
    open = !open
    return quote
  })
}

const mapAsciiSingleQuotesToChinese = (segment: string) => {
  let open = true
  return segment.replace(/'/g, () => {
    const quote = open ? '\u2018' : '\u2019'
    open = !open
    return quote
  })
}

/** 纯文本段：英文标点 → 中文标点（跳过小数、时间等数字语境） */
const convertPlainEnglishPunctuationToChinese = (segment: string) => {
  let text = segment.replace(/\.{3}/g, '\u2026\u2026')
  text = text.replace(/,/g, '\uff0c')
  text = text.replace(/(?<!\d)\.(?!\d)/g, '\u3002')
  text = text.replace(/(?<!\d):(?!\d)/g, '\uff1a')
  text = text.replace(/;/g, '\uff1b')
  text = text.replace(/\?/g, '\uff1f')
  text = text.replace(/!/g, '\uff01')
  text = text.replace(/\(/g, '\uff08')
  text = text.replace(/\)/g, '\uff09')
  text = mapAsciiDoubleQuotesToChinese(text)
  text = mapAsciiSingleQuotesToChinese(text)
  return text
}

const convertEnglishPunctuationToChinese = (raw: string) =>
  raw
    .split(SKILL_DESC_HTML_TAG_RE)
    .map((part) => (part.startsWith('<') ? part : convertPlainEnglishPunctuationToChinese(part)))
    .join('')

const hasTerminalPunctuation = (plain: string, language: SkillDescPrimaryLanguage) => {
  if (!plain) return true
  if (language === 'zh') {
    return /[。！？；…：）]$/.test(plain)
  }
  return /[.!?;:]$/.test(plain)
}

/** 为技能描述补句末标点（仅画布展示，不改存储） */
export const appendSkillDescTerminalPunctuation = (
  raw: string,
  language: SkillDescPrimaryLanguage,
) => {
  const plain = stripSkillDescMarkup(raw)
  if (!plain || hasTerminalPunctuation(plain, language)) return raw

  const terminal = language === 'zh' ? '\u3002' : '.'
  const trailing = raw.match(TRAILING_INLINE_CLOSE_RE)?.[0] ?? ''
  const core = trailing ? raw.slice(0, -trailing.length) : raw
  return `${core}${terminal}${trailing}`
}

const applySkillDescAutoOptimize = (raw: string) => {
  const language = detectSkillDescPrimaryLanguage(raw)
  let text = raw
  if (language === 'zh') {
    text = convertEnglishPunctuationToChinese(text)
  }
  return appendSkillDescTerminalPunctuation(text, language)
}

const wrapAutoFullNumberInPlainText = (segment: string) =>
  segment
    .split(SKILL_DESC_HTML_TAG_RE)
    .map((part) => (part.startsWith('<') ? part : wrapSingleArabicDigits(part)))
    .join('')

/** 为未手动标记的单个阿拉伯数字插入 <full> 标签（与手动 <full>5</full> 渲染一致） */
export const applySkillDescAutoFullNumber = (raw: string) => {
  if (!raw || !/\d/.test(raw)) return raw
  return raw
    .split(SKILL_DESC_FULL_TAG_BLOCK_RE)
    .map((segment) => (/^<full>/i.test(segment) ? segment : wrapAutoFullNumberInPlainText(segment)))
    .join('')
}

export const resolveSkillDescRawFromItem = (
  raw: string,
  skillsDesc: Pick<
    LegendInfo['renderConfig']['items']['skillsDesc'],
    'autoFullNumberFlag' | 'autoOptimizeFlag'
  >,
) =>
  resolveSkillDescRaw(raw, {
    autoFullNumberFlag: skillsDesc.autoFullNumberFlag,
    autoOptimizeFlag: resolveSkillsDescAutoOptimizeFlag(skillsDesc.autoOptimizeFlag),
  })

/** 按详细设置解析技能描述原文（画布展示用，不改存储） */
export const resolveSkillDescRaw = (raw: string, options: SkillDescRawResolveOptions) => {
  let text = trimSkillDescEdges(raw)
  if (options.autoOptimizeFlag) {
    text = applySkillDescAutoOptimize(text)
  }
  if (options.autoFullNumberFlag) {
    text = applySkillDescAutoFullNumber(text)
  }
  return text
}

/** 布局/自动优化指纹：与 resolveSkillDescRaw 一致，忽略首尾空白差异 */
export const resolveSkillDescLayoutSignature = (raw: string, options: SkillDescRawResolveOptions) =>
  resolveSkillDescRaw(raw, options)

/** 回写存储：仅去掉首尾空白，不插入全角标签 */
export const normalizeStoredSkillDescContent = (raw: string) => trimSkillDescEdges(raw)

/** 将所有技能描述首尾空白同步裁切到存储数据 */
export const normalizeLegendSkillsDescContent = (info: LegendInfo) => {
  ensureSkillsDescAutoOptimizeDefault(info.renderConfig.items.skillsDesc)
  ensureSkillsDescAutoSizeDefault(info.renderConfig.items.skillsDesc)
  for (const skill of info.baseInfo.skills) {
    if (typeof skill.desc !== 'string') continue
    const normalized = normalizeStoredSkillDescContent(skill.desc)
    if (normalized !== skill.desc) skill.desc = normalized
  }
}

/** 技能描述字体 */
export const resolveSkillDescFontFamily = (
  skill: LegendSkill,
  info: LegendInfo,
): string => {
  const descItem = info.renderConfig.items.skillsDesc
  if (skill.derivedFlag) {
    return descItem.newFontFlag ? SKILL_DESC_DERIVED_FONT_NEW : SKILL_DESC_DERIVED_FONT_OLD
  }
  return descItem.newFontFlag ? SKILL_DESC_FONT_NEW : SKILL_DESC_FONT_OLD
}
