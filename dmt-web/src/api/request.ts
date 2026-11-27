import axios from 'axios'
import { Message } from '@arco-design/web-vue'

export const TOKEN_KEY = 'dmt_token'

const request = axios.create({ baseURL: '/api', timeout: 15000 })

request.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function onUnauthorized() {
  sessionStorage.removeItem(TOKEN_KEY)
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

request.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        return body.data
      }
      if (body.code === 2001) {
        onUnauthorized()
      } else {
        Message.error(body.message || '请求失败')
      }
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body
  },
  (err) => {
    if (err.response?.status === 401) {
      onUnauthorized()
    } else {
      Message.error(err.response?.data?.message || err.message || '网络错误')
    }
    return Promise.reject(err)
  },
)

export const http = {
  get: <T = unknown>(url: string, params?: Record<string, unknown>) =>
    request.get(url, { params }) as unknown as Promise<T>,
  post: <T = unknown>(url: string, data?: unknown) =>
    request.post(url, data) as unknown as Promise<T>,
  put: <T = unknown>(url: string, data?: unknown) =>
    request.put(url, data) as unknown as Promise<T>,
  delete: <T = unknown>(url: string) =>
    request.delete(url) as unknown as Promise<T>,
}

export default request
