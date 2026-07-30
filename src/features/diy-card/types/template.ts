/**
 * 模板对象接口
 */
export type TemplateType = 'legend' | 'full-legend' | 'game' | 'mark'

export interface TemplateAuthor {
  name: string
  contact?: string
}

export interface TemplateInfo {
  type: TemplateType
  name: string
  label: string
  desc: string
  apply: string
  authors: TemplateAuthor[]
  height: number
  width: number
  supportBleed: boolean
  bleed: number
  config?: Record<string, TemplateConfigValue>
  exportName: string // 支持模板变量，如 "${template.name}.${info.name}.${code}"
}

/**
 * 配置项值接口
 */
export interface TemplateConfigValue {
  label: string
  value?: unknown
  numValue?: number
  developFlag?: boolean
  remark?: string
  showFlag?: boolean
}

/** 作者未填写联系方式时的展示文案 */
export const TEMPLATE_AUTHOR_NO_CONTACT_LABEL = '无联系方式'

/** 拼接模板作者名（用于下拉、水印等单行展示） */
export const formatTemplateAuthorNames = (authors: TemplateAuthor[]) =>
  authors.map((a) => a.name).join('、')

/** 作者联系方式展示（空则返回默认文案；有联系方式时前缀 @） */
export const getTemplateAuthorContactLabel = (author: TemplateAuthor) => {
  const contact = author.contact?.trim()
  if (!contact) return TEMPLATE_AUTHOR_NO_CONTACT_LABEL
  return contact.startsWith('@') ? contact : `@${contact}`
}

// 创建一个带有默认值的工厂函数（替代构造函数）
export function createTemplateInfo(
  type: TemplateType,
  name: string,
  label: string,
  desc: string,
  apply: string,
  authors: TemplateAuthor[],
  exportName: string,
  options: Partial<
    Pick<TemplateInfo, 'height' | 'width' | 'supportBleed' | 'bleed' | 'config'>
  > = {},
): TemplateInfo {
  const supportBleed = options.supportBleed ?? true
  return {
    type,
    name,
    label,
    desc,
    apply,
    authors,
    exportName,
    height: options.height ?? 87,
    width: options.width ?? 62,
    config: options.config ?? {},
    supportBleed,
    bleed: supportBleed ? (options.bleed ?? 3) : 0,
  }
}
