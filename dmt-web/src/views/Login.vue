<template>
  <div class="flex min-h-screen bg-[#F7F8FA]">
    <!-- 左侧品牌区 -->
    <div class="hidden flex-1 flex-col justify-between bg-gradient-to-br from-[#1D2B64] via-[#2B3A8F] to-[#4658C8] p-12 lg:flex">
      <div class="flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/15 text-[18px] font-bold text-white backdrop-blur">D</span>
        <div>
          <div class="text-[17px] font-semibold text-white">DMT-ERP</div>
          <div class="text-[12px] text-white/60">交付与核算系统</div>
        </div>
      </div>
      <div>
        <div class="text-[28px] font-semibold leading-snug text-white">合同签订之后的交付与核算，<br />一条主线管到底。</div>
        <div class="mt-4 max-w-md text-[13px] leading-6 text-white/60">已签合同同步建档 → 成本核算双部门填报 → 审批 → 开通工单 → 资源绑定扣减 → 计费出账与月结。</div>
      </div>
      <div class="text-[12px] text-white/40">上海地面通信息网络有限公司 · 第一期</div>
    </div>

    <!-- 右侧登录卡 -->
    <div class="flex w-full items-center justify-center px-6 lg:w-[520px] lg:shrink-0">
      <div class="w-full max-w-[380px]">
        <div class="mb-8 lg:hidden">
          <div class="text-[20px] font-semibold text-[#1D2129]">DMT-ERP 交付与核算系统</div>
        </div>
        <div class="rounded-[8px] border border-[#E5E6EB] bg-white p-8 shadow-[0_8px_30px_rgba(29,43,100,0.06)]">
          <div class="mb-1 text-[20px] font-semibold text-[#1D2129]">登录</div>
          <div class="mb-6 text-[12px] text-[#86909C]">使用公司分配的账号登录系统</div>

          <!-- 方式切换 -->
          <div class="mb-5 grid grid-cols-2 gap-1 rounded-[6px] bg-[#F2F3F5] p-1">
            <button
              v-for="m in modes"
              :key="m.key"
              class="flex items-center justify-center gap-1.5 rounded-[4px] py-1.5 text-[13px] transition-colors"
              :class="mode === m.key ? 'bg-white font-medium text-[#165DFF] shadow-sm' : 'text-[#4E5969] hover:text-[#1D2129]'"
              @click="mode = m.key; error = ''"
            >
              <component :is="m.icon" :size="14" /> {{ m.label }}
            </button>
          </div>

          <template v-if="mode === 'pwd'">
            <div class="space-y-3.5">
              <div>
                <div class="mb-1 text-xs text-[#4E5969]">账号</div>
                <UiInput v-model="account" placeholder="登录账号" autofocus @keydown="onPwdKeydown" />
              </div>
              <div>
                <div class="mb-1 text-xs text-[#4E5969]">密码</div>
                <UiInput v-model="password" type="password" placeholder="请输入密码" @keydown="onPwdKeydown" />
              </div>
              <div v-if="error" class="rounded-[4px] bg-[#FFECE8] px-3 py-2 text-[12px] text-[#F53F3F]">{{ error }}</div>
              <UiButton class="w-full" :disabled="busy" @click="doPwdLogin">{{ busy ? '登录中…' : '登 录' }}</UiButton>
            </div>
          </template>
          <template v-else>
            <div class="space-y-3.5">
              <div>
                <div class="mb-1 text-xs text-[#4E5969]">手机号</div>
                <UiInput v-model="phone" placeholder="请输入绑定的 11 位手机号" />
              </div>
              <div>
                <div class="mb-1 text-xs text-[#4E5969]">验证码</div>
                <div class="flex gap-2">
                  <UiInput v-model="code" placeholder="6 位验证码" @keydown="onSmsKeydown" />
                  <UiButton variant="outline" class="shrink-0" :disabled="countdown > 0" @click="doSendCode">
                    {{ countdown > 0 ? `${countdown}s 后重发` : '发送验证码' }}
                  </UiButton>
                </div>
              </div>
              <div v-if="demoCode" class="rounded-[4px] bg-[#E8F3FF] px-3 py-2 text-[12px] leading-5 text-[#165DFF]">
                演示环境未接短信网关，本次验证码：<span class="font-mono font-semibold tracking-wider">{{ demoCode }}</span>（10 分钟内有效）
              </div>
              <div v-if="error" class="rounded-[4px] bg-[#FFECE8] px-3 py-2 text-[12px] text-[#F53F3F]">{{ error }}</div>
              <UiButton class="w-full" :disabled="busy" @click="doSmsLogin">{{ busy ? '登录中…' : '登 录' }}</UiButton>
            </div>
          </template>

          <div class="mt-6 border-t border-[#F2F3F5] pt-4">
            <div class="mb-2 flex items-center gap-1 text-[11px] text-[#86909C]"><ShieldCheck :size="12" /> 演示账号（密码均为 admin123）</div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] leading-5 text-[#86909C]">
              <button
                v-for="u in demoAccounts"
                :key="u.username"
                class="text-left hover:text-[#165DFF]"
                title="点击填入账号"
                @click="fillAccount(u.username)"
              >
                <span class="text-[#4E5969]">{{ u.name }}</span> <span class="font-mono">{{ u.username }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { KeyRound, MessageSquareText, ShieldCheck } from 'lucide-vue-next'
import UiButton from '../components/ui/Button.vue'
import UiInput from '../components/ui/Input.vue'
import { sendSmsCode } from '../api/auth'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const modes = [
  { key: 'pwd', label: '账号密码登录', icon: KeyRound },
  { key: 'sms', label: '手机验证码登录', icon: MessageSquareText },
] as const

const mode = ref<'pwd' | 'sms'>('pwd')
const account = ref('')
const password = ref('')
const phone = ref('')
const code = ref('')
const demoCode = ref<string | null>(null)
const countdown = ref(0)
const error = ref('')
const busy = ref(false)
let timer: number | undefined

const demoAccounts = [
  { name: '系统管理员', username: 'admin' },
  { name: '张云', username: 'zhangyun' },
  { name: '李强', username: 'liqiang' },
  { name: '陈明', username: 'chenming' },
  { name: '王芳', username: 'wangfang' },
  { name: '赵磊', username: 'zhaolei' },
]

function fillAccount(username: string) {
  mode.value = 'pwd'
  account.value = username
  password.value = 'admin123'
  error.value = ''
}

function startCountdown() {
  countdown.value = 60
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      window.clearInterval(timer)
    }
  }, 1000)
}

async function doPwdLogin() {
  error.value = ''
  if (!account.value || !password.value) {
    error.value = '请输入账号和密码'
    return
  }
  busy.value = true
  try {
    await auth.loginByPassword(account.value, password.value)
    router.replace('/workbench')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请重试'
  } finally {
    busy.value = false
  }
}

async function doSendCode() {
  error.value = ''
  if (!/^1\d{10}$/.test(phone.value)) {
    error.value = '请输入正确的手机号'
    return
  }
  try {
    const data = await sendSmsCode(phone.value)
    demoCode.value = data.demoCode
    startCountdown()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败'
  }
}

async function doSmsLogin() {
  error.value = ''
  busy.value = true
  try {
    await auth.loginBySms(phone.value, code.value)
    router.replace('/workbench')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请重试'
  } finally {
    busy.value = false
  }
}

function onPwdKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    doPwdLogin()
  }
}

function onSmsKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    doSmsLogin()
  }
}

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer)
  }
})
</script>
