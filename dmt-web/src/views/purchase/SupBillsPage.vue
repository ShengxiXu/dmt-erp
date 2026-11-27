<template>
  <main class="space-y-4 p-6">
    <!-- 关联逻辑引导条 -->
    <div class="rounded-[4px] border border-[#BEDAFF] bg-[#F0F5FF] px-4 py-2.5 text-xs leading-5 text-[#1D2129]">
      <span class="font-semibold text-[#165DFF]">账单怎么关联到订单：</span>
      录入账单，选一个「费用归类」 → 系统自动判断口径：专属成本随单算，间接费用归入对应成本中心 → 核算单按归属引用账单（来源单号 = 账单号）→ 核算单通过审批后挂在合同上。<span class="text-[#4E5969]">全程不用手选订单。</span>
    </div>

    <!-- 统计卡 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">待入账</div>
        <div class="mt-1"><span class="font-mono text-2xl font-semibold text-[#FF7D00]">{{ stats.pending }}</span> <span class="text-xs text-[#86909C]">张</span></div>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">已入账金额（本期）</div>
        <div class="mt-1"><span class="font-mono text-2xl font-semibold text-[#165DFF]">{{ stats.postedAmt.toLocaleString('zh-CN') }}</span> <span class="text-xs text-[#86909C]">元</span></div>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">已月结</div>
        <div class="mt-1"><span class="font-mono text-2xl font-semibold text-[#00B42A]">{{ stats.settled }}</span> <span class="text-xs text-[#86909C]">张</span></div>
      </div>
      <div class="rounded-[4px] border bg-white p-4" :class="stats.overdueAmt > 0 ? 'border-[#F53F3F]' : 'border-[#E5E6EB]'">
        <div class="text-[11px] text-[#86909C]">超期未付</div>
        <div class="mt-1">
          <span class="font-mono text-2xl font-semibold" :class="stats.overdueAmt > 0 ? 'text-[#F53F3F]' : 'text-[#1D2129]'">{{ stats.overdueAmt.toLocaleString('zh-CN') }}</span>
          <span class="text-xs text-[#86909C]"> 元 · {{ stats.overdueCnt }} 笔</span>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">供应商账单</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '待入账', '已入账', '已月结']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load()"
          >{{ t }}</button>
          <button
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === '超期未付' ? 'bg-[#F53F3F] text-white' : 'text-[#F53F3F] hover:bg-[#FFECE8]'"
            @click="tab = '超期未付'; load()"
          >超期未付{{ stats.overdueCnt ? ` ${stats.overdueCnt}` : '' }}</button>
          <button
            v-for="t in ['差异', '争议']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load()"
          >{{ t }}</button>
        </div>
        <UiInput v-model="kw" class="w-48" placeholder="搜索账单号 / 供应商 / 费用" @keydown.enter="load" />
      </div>
      <div class="flex items-center gap-2">
        <UiButton size="sm" variant="outline" @click="exportCsv">⭳ 导出</UiButton>
        <UiButton size="sm" @click="openCreate">录入账单</UiButton>
      </div>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">账单号</th><th class="px-3 py-2">供应商</th><th class="px-3 py-2">账期</th>
            <th class="px-3 py-2">费用归类</th><th class="px-3 py-2">记到哪</th><th class="px-3 py-2 text-right">金额（元）</th>
            <th class="px-3 py-2">状态</th><th class="px-3 py-2">被引用</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in filteredRows" :key="b.id" class="border-b last:border-0" :class="isOverdue(b) ? 'bg-[#FFFBE8] hover:bg-[#FFF7D6]' : 'hover:bg-[#F7F8FA]'">
            <td class="px-3 py-3 font-mono"><router-link :to="`/bills/${b.id}`" class="text-[#165DFF] hover:underline">{{ b.billNo }}</router-link></td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ b.supplier }}</td>
            <td class="px-3 py-3 text-[#86909C]">{{ b.period }}</td>
            <td class="px-3 py-3">
              <div class="text-[#1D2129]">{{ itemName(b.costItemId) }}</div>
              <div v-if="b.poNo || b.contractNo" class="font-mono text-[10px] text-[#86909C]">{{ b.poNo ? `采购单 ${b.poNo}` : `合同 ${b.contractNo}` }}</div>
            </td>
            <td class="px-3 py-3"><span class="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{{ ledgerOf(b) }}</span></td>
            <td class="px-3 py-3 text-right font-mono">{{ b.amount.toLocaleString('zh-CN') }}</td>
            <td class="px-3 py-3">
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[b.status]">{{ b.status }}</span>
              <span v-if="b.tag" class="ml-1 rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">{{ b.tag }}</span>
              <span v-if="isOverdue(b)" class="ml-1 rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">超期 {{ overdueDays(b) }} 天</span>
            </td>
            <td class="px-3 py-3 text-[#4E5969]">
              <span v-if="b.refCount" class="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{{ b.refCount }} 条核算行</span>
              <span v-else>—</span>
            </td>
            <td class="px-3 py-3 text-right">
              <template v-if="b.status === '待入账'">
                <button class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]" @click="doPost(b)">入账</button>
                <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="doVoid(b)">作废</button>
              </template>
              <router-link v-else :to="`/bills/${b.id}`" class="text-[11px] text-[#86909C] hover:text-[#165DFF]">详情 →</router-link>
            </td>
          </tr>
          <tr v-if="!filteredRows.length"><td colspan="9" class="px-3 py-10 text-center text-[#86909C]">暂无供应商账单</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      费用归类＝成本条目，决定直接/间接口径与归集成本中心；「差异」= 与合同基准不符但已按实入账（留痕）；「争议」= 暂挂对账，未入账、月结自动跳过；超期未付按付款到期日判定（整行标黄）。邮件导入通道（运营商账单邮件 → 解析附件 → 与合同基准核对 → 生成账单）待接入邮件网关后开放。
    </div>

    <CenterModal :model-value="createOpen" title="录入供应商账单" :width="560" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">供应商 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.supplier" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">账期（YYYY-MM）<span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.period" placeholder="2026-11" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">费用归类（成本条目）</div>
            <select v-model="form.costItemId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option :value="undefined">未归类</option>
              <option v-for="i in costItems" :key="i.id" :value="i.id">{{ i.name }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">金额（元）<span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.amountText" type="number" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">关联采购单号</div>
            <UiInput v-model="form.poNo" placeholder="PO-…" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">关联采购合同</div>
            <select v-model="form.contractNo" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="">不关联</option>
              <option v-for="c in contracts" :key="c.id" :value="c.code">{{ c.code }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">付款到期日</div>
            <UiInput v-model="form.payDueDate" type="date" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
          <UiInput v-model="form.note" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.supplier || !form.period || !form.amountText" @click="doCreate">保存（待入账）</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { createSupBill, postSupBill, purContractList, supBillList, voidSupBill } from '../../api/pur'
import type { PurContract, SupBill } from '../../api/pur'
import { costItemList } from '../../api/prd'
import type { CostItem } from '../../api/types'

const CLS: Record<string, string> = {
  待入账: 'bg-[#FFF3E8] text-[#FF7D00]',
  已入账: 'bg-[#E8F3FF] text-[#165DFF]',
  已月结: 'bg-[#E8F8F2] text-[#00B42A]',
  已作废: 'bg-[#F2F3F5] text-[#86909C]',
}

const tab = ref('全部')
const kw = ref('')
const rows = ref<SupBill[]>([])
const costItems = ref<CostItem[]>([])
const contracts = ref<PurContract[]>([])
const createOpen = ref(false)
const form = ref({ supplier: '', period: '', costItemId: undefined as number | undefined, amountText: '', poNo: '', contractNo: '', payDueDate: '', note: '' })

function itemName(id?: number) {
  if (!id) return '未归类'
  return costItems.value.find((i) => i.id === id)?.name ?? `#${id}`
}

function ledgerOf(b: SupBill) {
  const item = costItems.value.find((i) => i.id === b.costItemId)
  if (!item) return '待归类'
  const t = (item as unknown as { costType?: string }).costType
  return t === '一次性' || t === '周期性' ? '随单直接成本' : (item as unknown as { subject?: string }).subject ?? '归集成本中心'
}

function overdueDays(b: SupBill) {
  if (!b.payDueDate) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(b.payDueDate).getTime()) / 86400000))
}

function isOverdue(b: SupBill) {
  return !!b.payDueDate && b.payDueDate < new Date().toISOString().slice(0, 10) && !['已月结', '已作废'].includes(b.status)
}

const stats = computed(() => {
  const nowPeriod = new Date().toISOString().slice(0, 7)
  const overdue = rows.value.filter(isOverdue)
  return {
    pending: rows.value.filter((b) => b.status === '待入账').length,
    postedAmt: rows.value
      .filter((b) => ['已入账', '已月结'].includes(b.status) && (b.period === nowPeriod || nowPeriod >= b.period))
      .reduce((s, b) => s + b.amount, 0),
    settled: rows.value.filter((b) => b.status === '已月结').length,
    overdueAmt: overdue.reduce((s, b) => s + b.amount, 0),
    overdueCnt: overdue.length,
  }
})

const filteredRows = computed(() => {
  if (tab.value === '超期未付') return rows.value.filter(isOverdue)
  if (tab.value === '差异' || tab.value === '争议') return rows.value.filter((b) => b.tag === tab.value)
  return rows.value
})

async function load() {
  const params: Record<string, unknown> = {}
  if (['待入账', '已入账', '已月结'].includes(tab.value)) params.status = tab.value
  if (kw.value) params.kw = kw.value
  rows.value = await supBillList(params)
}

function exportCsv() {
  const header = '账单号,供应商,账期,费用归类,金额,状态,付款到期,备注'
  const lines = filteredRows.value.map((b) =>
    [b.billNo, b.supplier, b.period, itemName(b.costItemId), b.amount, b.status, b.payDueDate ?? '', (b.note ?? '').replaceAll(',', '，')].join(','))
  const blob = new Blob(['﻿' + header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `供应商账单_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function openCreate() {
  form.value = { supplier: '', period: '', costItemId: undefined, amountText: '', poNo: '', contractNo: '', payDueDate: '', note: '' }
  createOpen.value = true
}

async function doCreate() {
  const f = form.value
  await createSupBill({
    supplier: f.supplier, period: f.period,
    costItemId: f.costItemId, amount: Number(f.amountText),
    poNo: f.poNo || undefined, contractNo: f.contractNo || undefined,
    payDueDate: f.payDueDate || undefined, note: f.note || undefined,
  })
  Message.success('账单已录入（待入账）')
  createOpen.value = false
  load()
}

function doPost(b: SupBill) {
  Modal.warning({
    title: `账单 ${b.billNo} 入账？`,
    content: `${b.supplier} · ${b.period} · ${b.amount.toLocaleString('zh-CN')} 元。入账后可被核算单引用。`,
    onOk: async () => {
      await postSupBill(b.id)
      Message.success('已入账')
      load()
    },
  })
}

function doVoid(b: SupBill) {
  Modal.warning({
    title: `作废账单 ${b.billNo}？`,
    content: '作废后不可恢复，留痕可查。',
    onOk: async () => {
      await voidSupBill(b.id)
      Message.success('已作废')
      load()
    },
  })
}

onMounted(async () => {
  await load()
  costItems.value = await costItemList()
  contracts.value = await purContractList()
})
</script>
