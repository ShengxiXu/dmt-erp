import { http } from './request'
import type { Profile } from './types'

export interface LoginResult {
  accessToken: string
  user: { id: number; username: string; name: string; deptId?: number }
}

export function login(username: string, password: string) {
  return http.post<LoginResult>('/auth/login', { username, password })
}

export function sendSmsCode(mobile: string) {
  return http.post<{ demoCode: string }>('/auth/sms-code', { mobile })
}

export function smsLogin(mobile: string, code: string) {
  return http.post<LoginResult>('/auth/sms-login', { mobile, code })
}

export function logout() {
  return http.post<void>('/auth/logout')
}

export function profile() {
  return http.get<Profile>('/auth/profile')
}
