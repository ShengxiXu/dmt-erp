import { http } from './request'
import type { PageResult } from './types'

export interface SysConfig {
  id: number
  cfgKey: string
  cfgValue?: string
  remark?: string
}
export function configList() {
  return http.get<SysConfig[]>('/configs')
}
export function upsertConfig(key: string, value: string, remark?: string) {
  const q = new URLSearchParams({ key, value })
  if (remark) q.set('remark', remark)
  return http.put<void>(`/configs?${q.toString()}`)
}

export interface Notification {
  id: number
  type?: string
  title: string
  content?: string
  isRead: number
  refType?: string
  refId?: number
  createdAt?: string
}
export function notificationPage(params: Record<string, unknown>) {
  return http.get<PageResult<Notification>>('/notifications', params)
}
export function notificationUnreadCount() {
  return http.get<{ count: number }>('/notifications/unread-count')
}
export function markNotificationsRead(ids: number[] | null, all = false) {
  return http.post<void>('/notifications/read', all ? { all: true } : { ids })
}
