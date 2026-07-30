/** 百科技能描述：仅还原游戏内常用标记，其余 HTML 转义 */
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const restoreWikiSkillDescTags = (escaped: string) => {
  let html = escaped

  html = html.replace(/&lt;b&gt;/gi, '<b class="wiki-skill-desc__bold">')
  html = html.replace(/&lt;\/b&gt;/gi, '</b>')
  html = html.replace(/&lt;i&gt;/gi, '<i>')
  html = html.replace(/&lt;\/i&gt;/gi, '</i>')
  html = html.replace(/&lt;bi&gt;/gi, '<b class="wiki-skill-desc__bold"><i>')
  html = html.replace(/&lt;\/bi&gt;/gi, '</i></b>')
  html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>')
  html = html.replace(/&lt;u&gt;/gi, '<u>')
  html = html.replace(/&lt;\/u&gt;/gi, '</u>')
  html = html.replace(/&lt;s&gt;/gi, '<s>')
  html = html.replace(/&lt;\/s&gt;/gi, '</s>')
  html = html.replace(/&lt;full&gt;/gi, '<span class="wiki-skill-desc__full">')
  html = html.replace(/&lt;\/full&gt;/gi, '</span>')
  html = html.replace(
    /&lt;span\s+style=&quot;color:\s*([^&]*?)&quot;\s*&gt;/gi,
    '<span style="color:$1">',
  )
  html = html.replace(
    /&lt;span\s+style=&#39;color:\s*([^&]*?)&#39;\s*&gt;/gi,
    '<span style="color:$1">',
  )
  html = html.replace(/&lt;\/span&gt;/gi, '</span>')

  return html
}

/** 将百科技能描述转为可安全 v-html 的 HTML（支持 &lt;b&gt; 等游戏标记） */
export const formatWikiSkillDescHtml = (raw: string | undefined | null): string => {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  return restoreWikiSkillDescTags(escapeHtml(text))
}

/** 列表摘要：保留加粗语义，去掉块级换行 */
export const formatWikiSkillDescPreviewHtml = (raw: string | undefined | null): string => {
  const html = formatWikiSkillDescHtml(raw)
  if (!html) return ''
  return html.replace(/<br\s*\/?>/gi, ' ')
}
