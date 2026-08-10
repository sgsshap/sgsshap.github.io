/** 与部署路径对齐的应用根路径 */
export const PUBLIC_BASE_URL = import.meta.env.BASE_URL

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

/** 百科等后端 API 根路径；未配置时由同源服务器代理 `/api`。 */
export const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, '')
  : '/api'
