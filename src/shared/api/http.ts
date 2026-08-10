import { API_BASE_URL } from '@/shared/constants/env'
import type { ApiResult } from '@/shared/types/api'

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  Accept: 'application/json',
}

const buildHeaders = (init?: HeadersInit): Headers => {
  const headers = new Headers(DEFAULT_HEADERS)
  const token = localStorage.getItem('token')
  if (token) {
    headers.set('Shap-Authorization', token)
  }
  const deviceId = localStorage.getItem('deviceId')
  if (deviceId) {
    headers.set('Shap-Device-Id', deviceId)
  }
  if (init) {
    new Headers(init).forEach((value, key) => headers.set(key, value))
  }
  return headers
}

const parseJson = async <T>(response: Response): Promise<ApiResult<T>> => {
  if (!response.ok) {
    throw new Error(`服务器连接失败，请稍后重试（${response.status}）`)
  }
  return (await response.json()) as ApiResult<T>
}

export const http = {
  async get<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method: 'GET',
      headers: buildHeaders(init?.headers),
      credentials: 'include',
    })
    return parseJson<T>(response)
  },

  async post<T>(path: string, body?: unknown, init?: RequestInit): Promise<ApiResult<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method: 'POST',
      headers: buildHeaders(init?.headers),
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return parseJson<T>(response)
  },
}
