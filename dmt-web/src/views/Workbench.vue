<template>
  <main class="space-y-4 p-6">
    <!-- 问候横幅：藏青紫渐变 + 极光光晕 -->
    <section
      class="relative overflow-hidden rounded-[16px] px-10 py-10 text-white"
      style="background: linear-gradient(115deg, #0E1130 0%, #1A1B4B 45%, #2B1E5E 100%)"
    >
      <div class="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full blur-3xl" style="background: radial-gradient(circle, rgba(99,102,241,0.55) 0%, transparent 70%); animation: wb-aurora-a 10s ease-in-out infinite" />
      <div class="pointer-events-none absolute -bottom-40 right-32 h-[420px] w-[420px] rounded-full blur-3xl" style="background: radial-gradient(circle, rgba(167,139,250,0.4) 0%, transparent 70%); animation: wb-aurora-b 13s ease-in-out infinite" />
      <div class="pointer-events-none absolute right-1/3 top-0 h-56 w-56 rounded-full blur-3xl" style="background: radial-gradient(circle, rgba(45,212,191,0.25) 0%, transparent 70%); animation: wb-aurora-c 11s ease-in-out infinite" />
      <div class="pointer-events-none absolute inset-0 opacity-[0.12]" style="background-image: linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px); background-size: 56px 56px" />

      <div class="relative flex items-end justify-between gap-8">
        <div>
          <div class="flex items-center gap-2">
            <span class="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[12px] text-white/90 backdrop-blur-sm">{{ d?.role ?? '—' }}</span>
            <span class="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[12px] text-white/70 backdrop-blur-sm">{{ dateStr }}</span>
          </div>
          <h1 class="mt-4 text-[34px] font-semibold leading-tight tracking-tight">{{ greet }}，{{ d?.userName ?? '同事' }}</h1>
          <p class="mt-2 max-w-[560px] text-[15px] leading-7 text-white/70">{{ bannerText }}</p>
        </div>
        <div class="hidden shrink-0 items-center gap-3 lg:flex">
          <div
            v-for="s in d?.banner ?? []"
            :key="s.label"
            class="rounded-[14px] border border-white/15 bg-white/10 px-5 py-4 shadow-[0_8px_24px_rgba(6,8,40,0.35)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/15"
          >
            <div class="text-[11px] tracking-wide text-white/60">{{ s.label }}</div>
            <div class="mt-1 text-[22px] font-semibold leading-6 tracking-tight" :class="s.alert ? 'text-[#FCD34D]' : 'text-white'">{{ s.value }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- KPI 指标卡（随角色切换） -->
    <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <component
        :is="k.to.startsWith('#') ? 'a' : 'router-link'"
        v-for="(k, i) in d?.kpis ?? []"
        :key="k.label"
        :href="k.to.startsWith('#') ? k.to : undefined"
        :to="k.to.startsWith('#') ? undefined : k.to"
        class="block rounded-[14px] border border-[#E5E6EB] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5"
        :class="KPI_TONES[i % KPI_TONES.length].glow"
      >
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-[#86909C]">{{ k.label }}</span>
          <span class="flex h-8 w-8 items-center justify-center rounded-[10px] text-white shadow-md" :class="KPI_TONES[i % KPI_TONES.length].chip">
            <TrendingUp v-if="k.good" :size="15" />
            <TrendingDown v-else :size="15" />
          </span>
        </div>
        <div class="mt-3 bg-gradient-to-br from-[#1D2129] to-[#4B5563] bg-clip-text text-[30px] font-semibold leading-8 tracking-tight text-transparent">{{ k.value }}</div>
        <div class="mt-2 truncate text-[12px]" :class="k.good ? 'text-[#86909C]' : 'text-[#E11D48]'">{{ k.delta }}</div>
      </component>
    </div>

    <!-- 快捷入口 -->
    <div class="grid grid-cols-4 gap-3 xl:grid-cols-8">
      <router-link
        v-for="q in quickEntries"
        :key="q.to + q.label"
        :to="q.to"
        class="group rounded-[14px] border border-[#E5E6EB] bg-white px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(29,33,41,0.08)]"
      >
        <div class="flex items-center justify-between">
          <span class="flex h-8 w-8 items-center justify-center rounded-[10px] transition-transform duration-200 group-hover:scale-110" :class="q.tone">
            <component :is="q.icon" :size="17" :stroke-width="1.8" />
          </span>
          <ArrowUpRight :size="14" class="text-[#C9CDD4] transition-all group-hover:translate-x-0.5 group-hover:text-[#165DFF]" />
        </div>
        <div class="mt-3 text-[14px] font-medium tracking-tight text-[#1D2129]">{{ q.label }}</div>
        <div class="mt-0.5 truncate text-[12px] text-[#86909C]">{{ q.desc }}</div>
      </router-link>
    </div>

    <!-- 主内容：2/3 + 1/3 -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <!-- 我的待办 -->
      <section id="todo" class="overflow-hidden rounded-[14px] border border-[#E5E6EB] bg-white xl:col-span-2">
        <div class="flex h-14 items-center justify-between border-b border-[#F2F3F5] px-6">
          <h2 class="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#1D2129]">
            <span class="h-4 w-1 rounded-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA]" />我的待办
          </h2>
          <span class="text-[13px] text-[#86909C]">{{ d?.todos?.length ?? 0 }} 项 · 按紧急度排序</span>
        </div>
        <div class="divide-y divide-[#F2F3F5]">
          <router-link
            v-for="t in d?.todos ?? []"
            :key="t.title"
            :to="t.link"
            class="group flex items-center gap-4 border-l-[3px] px-5 py-4 transition-colors hover:bg-[#F7F8FA]"
            :class="t.hot ? 'border-l-[#E11D48] bg-[#FFF5F6]' : 'border-l-transparent'"
          >
            <CircleAlert v-if="t.hot" :size="18" class="shrink-0 text-[#E11D48]" />
            <span v-else class="h-2 w-2 shrink-0 rounded-full bg-[#C9CDD4]" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-[14px] text-[#1D2129]">{{ t.title }}</div>
              <div class="mt-0.5 truncate text-[13px] text-[#86909C]">{{ t.sub }}</div>
            </div>
            <span class="flex h-7 shrink-0 items-center rounded-[2px] border border-[#E5E6EB] px-3 text-[13px] text-[#4E5969] group-hover:border-[#165DFF] group-hover:text-[#165DFF]">{{ t.cta }}</span>
          </router-link>
          <div v-if="!d?.todos?.length" class="px-5 py-10 text-center text-[13px] text-[#86909C]">当前没有待办，一切正常</div>
        </div>
      </section>

      <!-- 右列：角色关注卡 + 出口水位 -->
      <aside class="space-y-4">
        <section class="rounded-[14px] border border-[#E5E6EB] bg-white p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#1D2129]">
              <span class="h-4 w-1 rounded-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA]" />{{ d?.focus?.title ?? '关注' }}
            </h2>
            <router-link :to="d?.focus?.linkTo ?? '/workbench'" class="text-[13px] text-[#165DFF] hover:underline">{{ d?.focus?.linkText }}</router-link>
          </div>
          <div class="space-y-3">
            <template v-for="row in d?.focus?.rows ?? []" :key="row.label">
              <div v-if="row.text != null" class="flex justify-between text-[13px]">
                <span class="text-[#86909C]">{{ row.label }}</span>
                <span class="font-medium text-[#1D2129]">{{ row.text }}</span>
              </div>
              <div v-else>
                <div class="mb-1 flex justify-between text-[13px]">
                  <span class="text-[#4E5969]">{{ row.label }}</span>
                  <span class="font-medium" :class="['逾期', '欠停', '坏账'].includes(row.label) ? 'text-[#F53F3F]' : 'text-[#1D2129]'">
                    {{ row.count }} 笔<template v-if="row.sum"> · 未收 {{ row.sum }}</template>
                  </span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
                  <div
                    class="h-full rounded-full"
                    :class="['逾期', '欠停', '坏账'].includes(row.label) ? 'bg-gradient-to-r from-[#E11D48] to-[#F43F5E]' : 'bg-gradient-to-r from-[#6366F1] to-[#818CF8]'"
                    :style="{ width: `${((row.count ?? 0) / focusMax) * 100}%` }"
                  />
                </div>
              </div>
            </template>
          </div>
          <p class="mt-4 text-[12px] leading-5 text-[#86909C]">{{ d?.focus?.note }}</p>
        </section>

        <section class="rounded-[14px] border border-[#E5E6EB] bg-white p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#1D2129]">
              <span class="h-4 w-1 rounded-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA]" />出口水位
            </h2>
            <router-link to="/resources/r1" class="text-[13px] text-[#165DFF] hover:underline">全部</router-link>
          </div>
          <div class="space-y-4">
            <div v-for="e in d?.exits ?? []" :key="e.label">
              <div class="mb-1.5 flex justify-between text-[13px]">
                <span class="truncate text-[#4E5969]">{{ e.label }}</span>
                <span class="ml-2 shrink-0 font-medium" :class="e.pct > 85 ? 'text-[#E11D48]' : 'text-[#1D2129]'">{{ e.pct }}%</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
                <div
                  class="h-full rounded-full"
                  :class="e.pct > 85 ? 'bg-gradient-to-r from-[#E11D48] to-[#F43F5E]' : 'bg-gradient-to-r from-[#6366F1] to-[#818CF8]'"
                  :style="{ width: `${Math.max(e.pct, 2)}%` }"
                />
              </div>
            </div>
            <div v-if="!d?.exits?.length" class="text-[12px] text-[#86909C]">暂无出口线路</div>
          </div>
          <p class="mt-4 text-[12px] leading-5 text-[#86909C]">按利用率排序取前 4 · 超 85% 红色告警</p>
        </section>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowUpRight, Banknote, Calculator, CheckSquare, CircleAlert, Receipt,
  ReceiptText, RefreshCcw, TrendingDown, TrendingUp, Wrench,
} from 'lucide-vue-next'
import { http } from '../api/request'

interface Todo { title: string; sub: string; link: string; cta: string; hot: boolean }
interface Kpi { label: string; value: string; delta: string; good: boolean; to: string }
interface FocusRow { label: string; count?: number; sum?: string; text?: string }
interface Overview {
  role: string
  userName: string
  todos: Todo[]
  kpis: Kpi[]
  banner: { label: string; value: string; alert: boolean }[]
  focus: { title: string; linkTo: string; linkText: string; rows: FocusRow[]; note: string }
  exits: { label: string; pct: number }[]
  quick: { approving: number; woOnway: number; latestPeriod: string; unread: number }
}

const KPI_TONES = [
  { chip: 'bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]', glow: 'hover:shadow-[0_12px_32px_rgba(99,102,241,0.15)]' },
  { chip: 'bg-gradient-to-br from-[#0D9488] to-[#14B8A6]', glow: 'hover:shadow-[0_12px_32px_rgba(13,148,136,0.15)]' },
  { chip: 'bg-gradient-to-br from-[#D97706] to-[#F59E0B]', glow: 'hover:shadow-[0_12px_32px_rgba(217,119,6,0.15)]' },
  { chip: 'bg-gradient-to-br from-[#E11D48] to-[#F43F5E]', glow: 'hover:shadow-[0_12px_32px_rgba(225,29,72,0.15)]' },
]

const d = ref<Overview | null>(null)

const now = new Date()
const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${wd}`
const hour = now.getHours()
const greet = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

const bannerText = computed(() => {
  if (!d.value) return ''
  const t = d.value.todos.length
  const approving = d.value.quick.approving
  switch (d.value.role) {
    case '业务支撑部': return `今天有 ${t} 项待办：起草核算单、跟进技术提交。核算单由合同流程带入，从下方待办或「成本台账」进入处理。`
    case '技术部': return `${t} 项待办：核算单技术条目、在途工单处理。工单从「开通工单」列表按节点推进。`
    case '财务': return `${approving} 张核算单待审批。审批在「审批中心」处理，月结在「月结」页跑批，逾期应收在「欠费与坏账」跟进。`
    case '管理层': return `经营概览：${approving} 单在审。经营分析与月结批次提供毛利与差异视角。`
    case '销售部': return `今天有 ${t} 项待办：商机跟进与未读通知。客户与商机按「仅本人数据」隔离。`
    default: return `系统概览：${d.value.quick.unread} 条未读通知、${approving} 单在审。用户与角色、审批流、策略参数在「系统管理」维护。`
  }
})

const quickEntries = computed(() => {
  const q = d.value?.quick
  return [
    { to: '/cost', label: '成本台账', icon: Calculator, desc: '核算单总览 · 填报入口', tone: 'bg-[#EEF2FF] text-[#4F46E5]' },
    { to: '/approval', label: '审批中心', icon: CheckSquare, desc: `${q?.approving ?? 0} 单待审`, tone: 'bg-[#F0FDFA] text-[#0D9488]' },
    { to: '/delivery', label: '开通工单', icon: Wrench, desc: `${q?.woOnway ?? 0} 个在途`, tone: 'bg-[#FFFBEB] text-[#B45309]' },
    { to: '/finance/settle', label: '月结', icon: Calculator, desc: q?.latestPeriod ? `最近 ${q.latestPeriod}` : '本月待跑', tone: 'bg-[#F5F3FF] text-[#7C3AED]' },
    { to: '/billing', label: '客户账单', icon: ReceiptText, desc: '应收总览', tone: 'bg-[#ECFEFF] text-[#0891B2]' },
    { to: '/finance/invoices', label: '开票管理', icon: Receipt, desc: '开票申请', tone: 'bg-[#FFF1F2] text-[#BE123C]' },
    { to: '/finance/claims', label: '回款认领', icon: Banknote, desc: '收款核销', tone: 'bg-[#F0FDF4] text-[#15803D]' },
    { to: '/lifecycle', label: '变更与退订', icon: RefreshCcw, desc: '生命周期', tone: 'bg-[#FFF7ED] text-[#C2410C]' },
  ]
})

const focusMax = computed(() =>
  Math.max(...(d.value?.focus?.rows ?? []).map((r) => r.count ?? 0), 1),
)

onMounted(async () => {
  d.value = await http.get<Overview>('/workbench/overview')
})
</script>

<style>
@keyframes wb-aurora-a { 0%,100% { transform: translate(0,0) scale(1); opacity:.5; } 50% { transform: translate(40px,-20px) scale(1.15); opacity:.7; } }
@keyframes wb-aurora-b { 0%,100% { transform: translate(0,0) scale(1.1); opacity:.4; } 50% { transform: translate(-30px,24px) scale(1); opacity:.6; } }
@keyframes wb-aurora-c { 0%,100% { transform: translate(0,0) scale(1); opacity:.35; } 50% { transform: translate(16px,30px) scale(1.2); opacity:.55; } }
</style>
