import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login, logout as apiLogout, profile, smsLogin } from '../api/auth'
import { TOKEN_KEY } from '../api/request'
import type { Profile } from '../api/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(sessionStorage.getItem(TOKEN_KEY) ?? '')
  const profileData = ref<Profile | null>(null)

  function setToken(t: string) {
    token.value = t
    sessionStorage.setItem(TOKEN_KEY, t)
  }

  async function loginByPassword(username: string, password: string) {
    const data = await login(username, password)
    setToken(data.accessToken)
    await fetchProfile()
  }

  async function loginBySms(mobile: string, code: string) {
    const data = await smsLogin(mobile, code)
    setToken(data.accessToken)
    await fetchProfile()
  }

  async function fetchProfile() {
    profileData.value = await profile()
  }

  function hasPerm(code: string) {
    return profileData.value?.perms?.includes(code) ?? false
  }

  async function logout() {
    try {
      await apiLogout()
    } catch {
      // 无状态退出，失败也继续清理本地
    }
    token.value = ''
    profileData.value = null
    sessionStorage.removeItem(TOKEN_KEY)
  }

  return { token, profileData, loginByPassword, loginBySms, fetchProfile, hasPerm, logout }
})
