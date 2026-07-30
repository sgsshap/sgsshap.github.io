import { http } from '@/shared/api/http'
import type { DictResponse } from '@/shared/types/api'

export const getDict = (code: string) => http.get<DictResponse>(`/system/dict/${code}`)
