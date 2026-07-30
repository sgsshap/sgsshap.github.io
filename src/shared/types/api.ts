/** 与 sgs-shap-server 对齐的统一响应结构 */
export interface ApiResult<T = unknown> {
  success?: boolean
  code?: number
  message?: string
  data?: T
}

/** MyBatis-Plus 分页结果 */
export interface PageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
}

export interface PageQuery {
  current?: number
  size?: number
  keyword?: string
}

export interface DictItem {
  label: string
  value: string
}

export interface DictResponse {
  itemList: DictItem[]
}
