import { http } from '@/shared/api/http'
import type { PageQuery, PageResult } from '@/shared/types/api'

export const getMaterialPage = (data: PageQuery & Record<string, unknown>) =>
  http.post<PageResult<Record<string, unknown>>>('/material/page', data)

export const getMaterial = (id: number) =>
  http.get<Record<string, unknown>>(`/material?id=${id}`)
