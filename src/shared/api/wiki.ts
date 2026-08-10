import { http } from '@/shared/api/http'
import { API_BASE_URL } from '@/shared/constants/env'
import type { PageQuery, PageResult } from '@/shared/types/api'
import { downloadBlob } from '@/shared/utils/file'

export const getLegendWikiPage = (data: PageQuery & Record<string, unknown>) =>
  http.post<PageResult<Record<string, unknown>>>('/wiki/legend-wiki', data)

export const getLegendWiki = (id: number) =>
  http.get<Record<string, unknown>>(`/wiki/legend-wiki?id=${id}`)

export const getLegendVersionPage = (
  data: PageQuery & { legendId?: number; showFlag?: boolean },
) => http.post<PageResult<Record<string, unknown>>>('/wiki/legend-version', data)

export const getLegendVersion = (id: number) =>
  http.get<Record<string, unknown>>(`/wiki/legend-version?id=${id}`)

/** 按武将名 + 势力查询编号表（返回全部匹配，如 WEI 027） */
export const getLegendNumber = (name: string, kingdom: string) => {
  const params = new URLSearchParams({ name, kingdom })
  return http.get<string[]>(`/wiki/legend-number?${params.toString()}`)
}

export const getImageWikiPage = (data: PageQuery & Record<string, unknown>) =>
  http.post<PageResult<Record<string, unknown>>>('/wiki/image-wiki', data)

export const getImageWiki = (id: number) =>
  http.get<Record<string, unknown>>(`/wiki/image-wiki?id=${id}`)

export const getSkillWikiPage = (data: PageQuery & Record<string, unknown>) =>
  http.post<PageResult<Record<string, unknown>>>('/wiki/skill-wiki', data)

export const getSkillWiki = (id: number) =>
  http.get<Record<string, unknown>>(`/wiki/skill-wiki?id=${id}`)

const buildDownloadHeaders = (): Headers => {
  const headers = new Headers()
  const token = localStorage.getItem('token')
  if (token) {
    headers.set('Shap-Authorization', token)
  }
  const deviceId = localStorage.getItem('deviceId')
  if (deviceId) {
    headers.set('Shap-Device-Id', deviceId)
  }
  return headers
}

/** 下载武将编号 Excel 表 */
export const downloadLegendNumberExcel = async () => {
  const response = await fetch(`${API_BASE_URL}/wiki/legend-number/excel`, {
    method: 'GET',
    headers: buildDownloadHeaders(),
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`下载失败（${response.status}）`)
  }
  const blob = await response.blob()
  downloadBlob(blob, '武将编号表.xlsx')
}
