<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">合同管理</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in TABS"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >
            {{ t }}{{ t !== '全部' ? `（${countByStatus(t)}）` : '' }}
          </button>
        </div>
        <UiInput v-model="kw" class="w-52" placeholder="搜索合同号 / 客户" @keydown.enter="load(1)" />
        <button
          class="rounded-[2px] border px-2.5 py-1.5 text-xs transition-colors"
          :class="onlyExpiring ? 'border-[#FF7D00] bg-[#FFF7E8] font-medium text-[#FF7D00]' : 'border-[#E5E6EB] text-[#4E5969] hover:border-[#FF7D00] hover:text-[#FF7D00]'"
          title="只看 90 天内到期的生效合同"
          @click="onlyExpiring = !onlyExpiring; load(1)"
        >
          ⏳ 临期预警{{ expiringCount ? `（${expiringCount}）` : '' }}
        </button>
        <button class="rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="exportCsv">⭳ 导出</button>
      </div>
      <router-link to="/contract/edit">
        <UiButton size="sm">＋ 新建合同</UiButton>
      </router-link>
    </div>

    <!-- 临期预警汇总条 -->
    <div v-if="expiringContracts.length" class="flex items-center gap-3 rounded-[4px] border border-[#FFE58F] bg-[#FFFBE8] px-4 py-2.5 text-xs">
      <span class="text-[#FF7D00]">⏳</span>
      <span class="text-[#1D2129]">
        <strong class="text-[#FF7D00]">{{ expiringContracts.length }}</strong> 份生效合同将于 90 天内到期（合计月租
        <strong class="font-mono text-[#FF7D00]">{{ money(expiringMonthly) }}</strong> 元/月）
      </span>
      <span class="text-[#86909C]">
        {{ expiringContracts.slice(0, 2).map((c) => `${c.code}（${c.customerName}，剩 ${daysLeft(c)} 天）`).join('；') }}
      </span>
      <button class="ml-auto text-[#165DFF] hover:underline" @click="onlyExpiring = true; load(1)">查看生效合同 →</button>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">合同号</th><th class="px-3 py-2">客户</th><th class="px-3 py-2">商机名称</th><th class="px-3 py-2">订单内容摘要</th>
            <th class="px-3 py-2 text-right">月租合计（元）</th><th class="px-3 py-2">付款方式</th><th class="px-3 py-2">折扣</th><th class="px-3 py-2">签约主体</th>
            <th class="px-3 py-2">用章方式</th><th class="px-3 py-2">状态 / 进度</th><th class="px-3 py-2">合同期限</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#165DFF]">{{ c.code }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ c.customerName }}</td>
            <td class="max-w-[180px] truncate px-3 py-3 text-[#4E5969]" :title="c.opportunityName">{{ c.opportunityName ?? '—' }}</td>
            <td class="max-w-[220px] truncate px-3 py-3 text-[#4E5969]">{{ linesSummary(c) }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ money((c as unknown as { monthlyFee?: number }).monthlyFee ?? c.amount) }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ (c as unknown as { payCycle?: string }).payCycle ?? '—' }}</td>
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ c.discount > 0 ? `${c.discount}` : '标准' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ c.entityName ?? '—' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ (c as unknown as { seal?: string }).seal ?? '—' }}</td>
            <td class="px-3 py-3">
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STATUS_CLS[c.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ c.status }}</span>
              <span v-if="c.status === '签署中'" class="ml-1.5 text-[10px] text-[#86909C]">第 {{ (c.step ?? 0) + 1 }} 步</span>
            </td>
            <td class="whitespace-nowrap px-3 py-3 text-[#86909C]">
              {{ c.startDate ?? '—' }} ~ {{ c.endDate ?? '—' }}
              <span v-if="c.status === '已生效' && daysLeft(c) !== null" class="ml-1 rounded-[2px] px-1 py-0.5 text-[10px]" :class="daysLeft(c)! <= 90 ? 'bg-[#FFECE8] text-[#F53F3F]' : 'bg-[#E8F8F2] text-[#00B42A]'">剩 {{ daysLeft(c) }} 天</span>
            </td>
            <td class="px-3 py-3 text-right">
              <button
                class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]"
                @click="goDetail(c)"
              >{{ c.status === '审批中' ? '去审批' : c.status === '待用章' || c.status === '签署中' ? '去签署' : '查看' }}</button>
              <button v-if="CAN_STEP.includes(c.status)" class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#0D9488] hover:text-[#0D9488]" @click="doStep(c)">推进</button>
              <button v-if="c.status === '签署中'" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#00B42A] hover:border-[#00B42A]" @click="doEffect(c)">生效</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="12" class="px-3 py-10 text-center text-[#86909C]">该状态下暂无合同</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-end gap-3 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2 text-[12px] text-[#86909C]">
      <span>共 {{ total }} 条</span>
      <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 hover:border-[#165DFF] hover:text-[#165DFF]" :disabled="pageNum <= 1" @click="load(pageNum - 1)">上一页</button>
      <span class="tabular-nums">{{ pageNum }} / {{ Math.max(1, Math.ceil(total / pageSize)) }}</span>
      <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 hover:border-[#165DFF] hover:text-[#165DFF]" :disabled="pageNum >= Math.ceil(total / pageSize)" @click="load(pageNum + 1)">下一页</button>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      合同与订单合二为一：订单行在合同起草时一次填齐，合同生效即订单生效，售价取合同约定价直接进入成本核算；上传正式合同时校验折扣率与特批单一致，不一致拦截（3002）。
    </div>

  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UiInput from '../../components/ui/Input.vue'
import UiButton from '../../components/ui/Button.vue'
import { useRouter } from 'vue-router'
import { contractEffect, contractPage, contractStep } from '../../api/mdm'
import type { Contract } from '../../api/types'

const STATUS_CLS: Record<string, string> = {
  审批中: 'bg-[#E8F3FF] text-[#165DFF]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
  待出合同: 'bg-[#E8F8F2] text-[#00701A]',
  待用章: 'bg-[#F2F3F5] text-[#4E5969]',
  签署中: 'bg-[#E8F3FF] text-[#165DFF]',
  已生效: 'bg-[#E8F8F2] text-[#00B42A]',
  待修订: 'bg-[#FFF3E8] text-[#FF7D00]',
  已终止: 'bg-[#FFECE8] text-[#F53F3F]',
}
const TABS = ['全部', '审批中', '待出合同', '待用章', '签署中', '已生效', '待修订', '已终止'] as const
const CAN_STEP = ['审批中', '待出合同', '待用章']

const router = useRouter()
const tab = ref<(typeof TABS)[number]>('全部')
const kw = ref('')
const onlyExpiring = ref(false)
const rows = ref<Contract[]>([])
const all = ref<Contract[]>([])
const pageNum = ref(1)
const pageSize = 10
const total = ref(0)

function money(n?: number) {
  return n == null ? '—' : n.toLocaleString('zh-CN')
}

function linesSummary(c: Contract) {
  return (c.lines ?? []).map((l) => l.ptype || l.cat).join(' + ') || '—'
}

function daysLeft(c: Contract) {
  if (!c.endDate) return null
  const diff = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000)
  return diff
}

const expiringCount = computed(() => all.value.filter((c) => c.status === '已生效' && daysLeft(c) !== null && daysLeft(c)! <= 90).length)
const expiringContracts = computed(() =>
  all.value.filter((c) => c.status === '已生效' && daysLeft(c) !== null && daysLeft(c)! <= 90)
    .sort((a, b) => (daysLeft(a) ?? 999) - (daysLeft(b) ?? 999)))
const expiringMonthly = computed(() =>
  expiringContracts.value.reduce((s, c) => s + ((c as unknown as { monthlyFee?: number }).monthlyFee ?? 0), 0))

function exportCsv() {
  const header = '合同号,客户,商机,月租合计,付款方式,折扣,签约主体,用章方式,状态,起始,到期'
  const lines = rows.value.map((c) =>
    [c.code, c.customerName ?? '', c.opportunityName ?? '', (c as unknown as { monthlyFee?: number }).monthlyFee ?? c.amount,
      (c as unknown as { payCycle?: string }).payCycle ?? '', c.discount > 0 ? c.discount : '标准', c.entityName ?? '',
      (c as unknown as { seal?: string }).seal ?? '', c.status, c.startDate ?? '', c.endDate ?? '']
      .map((v) => String(v).replaceAll(',', '，')).join(','))
  const blob = new Blob(['﻿' + header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `合同_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function countByStatus(t: string) {
  return all.value.filter((c) => c.status === t).length
}

async function load(page?: number) {
  if (page) pageNum.value = page
  const status = tab.value === '全部' ? undefined : tab.value
  const data = await contractPage({ kw: kw.value || undefined, status, pageNum: pageNum.value, pageSize: 100 })
  all.value = data.records
  let list = data.records
  if (onlyExpiring.value) {
    list = list.filter((c) => c.status === '已生效' && daysLeft(c) !== null && daysLeft(c)! <= 90)
  }
  total.value = list.length
  const start = (pageNum.value - 1) * pageSize
  rows.value = list.slice(start, start + pageSize)
}


function goDetail(c: Contract) {
  router.push(`/contract/detail?id=${c.id}`)
}

async function doStep(c: Contract) {
  await contractStep(c.id)
  load()
}

async function doEffect(c: Contract) {
  await contractEffect(c.id)
  load()
}


onMounted(() => load(1))
</script>
