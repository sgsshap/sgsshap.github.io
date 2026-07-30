import { applyLegendWikiSelectionBatched } from '@/features/diy-card/utils/applyWikiSelection'
import { useDiyStore, useInfoStore, useTemplateStore } from '@/features/diy-card/stores'
import type { TemplateType } from '@/features/diy-card/types/template'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import type { DictItem } from '@/shared/types/api'
import type { WikiLegendSelectPayload } from '@/shared/types/wiki'
import { getLabel } from '@/shared/utils/dict'
import { getKingdomLabel } from '@/shared/utils/kingdom'

export const WIKI_TO_DIY_PENDING_SESSION_KEY = 'shap:wiki-to-diy-pending'

export const DIY_FROM_WIKI_CHROME_KEY = 'shap:diy-from-wiki-chrome'

export const DEFAULT_WIKI_LEGEND_DIY_TEMPLATE_NAME = 'new_ui_zhuoyue'

export type WikiToDiyPendingSession = {
  payload: WikiLegendSelectPayload
  templateName: string
  templateType: TemplateType
}

const DEVIL_KINGDOM_KEYS = new Set(['devil', 'mo', 'magic', 'demon'])

const parseWikiKingdomKeys = (raw: unknown): string[] => {
  let text = String(raw ?? 'wei').trim()
  if (!text) return ['wei']
  try {
    text = decodeURIComponent(text)
  } catch {
    // 保持原样
  }
  return text
    .split('&')
    .map((part) => {
      let kingdom = part.trim().toLowerCase()
      if (kingdom === 'le') kingdom = 'shen'
      return kingdom
    })
    .filter((k) => k.length > 0)
}

/** 需专用模板但尚未上线的场景，用于跳转制图前提示 */
export const resolveWikiLegendDiyTemplateNotices = (
  legend: Record<string, unknown>,
  version: Record<string, unknown>,
  kingdomOptions: DictItem[] = [],
): string[] => {
  const notices: string[] = []

  if (version.gameMode === 'national') {
    notices.push('国战版本需使用国战专用模板，该模板尚未上线')
  }

  const kingdomRaw = String(legend.kingdom ?? '')
  const kingdomParts = parseWikiKingdomKeys(legend.kingdom)
  const kingdomLabels = kingdomParts.map(
    (key) => getLabel(key, kingdomOptions) || getKingdomLabel(key),
  )
  const isDevilKingdom =
    kingdomRaw.includes('魔') ||
    kingdomLabels.some((label) => (label ?? '').includes('魔')) ||
    kingdomParts.some((key) => DEVIL_KINGDOM_KEYS.has(key))

  if (isDevilKingdom) {
    notices.push('魔势力武将需使用魔势力专用模板，该模板尚未上线')
  }

  return notices
}

export const buildWikiToDiyPendingSession = (
  payload: WikiLegendSelectPayload,
): WikiToDiyPendingSession => ({
  payload,
  templateName: DEFAULT_WIKI_LEGEND_DIY_TEMPLATE_NAME,
  templateType: 'legend',
})

export const peekWikiToDiyPendingSession = (): boolean => {
  if (typeof sessionStorage === 'undefined') return false
  return Boolean(sessionStorage.getItem(WIKI_TO_DIY_PENDING_SESSION_KEY))
}

export const stashWikiToDiyPendingSession = (session: WikiToDiyPendingSession) => {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(WIKI_TO_DIY_PENDING_SESSION_KEY, JSON.stringify(session))
  markDiyFromWikiChrome()
}

export const markDiyFromWikiChrome = () => {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(DIY_FROM_WIKI_CHROME_KEY, '1')
}

export const peekDiyFromWikiChrome = (): boolean => {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(DIY_FROM_WIKI_CHROME_KEY) === '1'
}

export const clearDiyFromWikiChrome = () => {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(DIY_FROM_WIKI_CHROME_KEY)
}

export const isDiyFromWikiChromeRoute = (routeName: unknown): boolean =>
  routeName === 'diy' && peekDiyFromWikiChrome()

export const consumeWikiToDiyPendingSession = (): WikiToDiyPendingSession | null => {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(WIKI_TO_DIY_PENDING_SESSION_KEY)
  if (raw) {
    sessionStorage.removeItem(WIKI_TO_DIY_PENDING_SESSION_KEY)
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as WikiToDiyPendingSession
    if (parsed?.payload?.type !== 'legend') return null
    if (!parsed.templateName || !parsed.templateType) return null
    return parsed
  } catch {
    return null
  }
}

export const applyWikiToDiyPendingSession = async (session: WikiToDiyPendingSession) => {
  const templateStore = useTemplateStore()
  const infoStore = useInfoStore()
  const diyStore = useDiyStore()

  const template = templateStore.getTemplate(session.templateName)
  if (!template) {
    throw new Error('template-not-found')
  }

  const templateSwitched =
    templateStore.templateType !== session.templateType ||
    templateStore.currentTemplateName !== template.name

  if (templateStore.templateType !== session.templateType) {
    templateStore.templateType = session.templateType
  }
  if (templateStore.currentTemplateName !== template.name) {
    templateStore.currentTemplateName = template.name
  }
  infoStore.accessKind('legend').setTemplateName(template.name)

  await diyStore.whenReloadConsumerReady()
  if (templateSwitched) {
    await diyStore.waitForCanvasIdle()
  }

  await applyLegendWikiSelectionBatched(infoStore.info as LegendInfo, session.payload)
}

/** 制图页激活时消费百科跳转 session 并导入（兼容 keep-alive 二次进入） */
export const tryApplyWikiToDiyPendingSession = async (): Promise<boolean> => {
  const session = consumeWikiToDiyPendingSession()
  if (!session) return false
  await applyWikiToDiyPendingSession(session)
  return true
}
