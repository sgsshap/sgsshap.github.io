import type { ApiResult } from '@/shared/types/api'

/** 判定接口是否成功（与 sgs-shap-server Result 约定一致） */
export const isSuccess = <T>(res: ApiResult<T> | null | undefined): res is ApiResult<T> & { data: T } =>
  Boolean(res && (res.success === true || res.code === 200))
