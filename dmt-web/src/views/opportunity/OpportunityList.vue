<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">商机管理</span>
        <span v-if="customerFilter" class="rounded-[2px] bg-[#F7FAFF] px-2 py-0.5 text-[11px] text-[#165DFF]">客户：{{ customerName(customerFilter) }}</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="s in ['全部', ...STAGES]"
            :key="s"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="stage === s ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="stage = s; load(1)"
          >
            {{ s }}<span v-if="s !== '全部'" class="ml-0.5 text-[10px] opacity-70">{{ stageCount(s) }}</span>
          </button>
        </div>
        <UiInput v-model="kw" class="w-56" placeholder="搜索商机编号 / 名称 / 客户" @keydown.enter="load(1)" />
        <button class="flex items-center gap-1 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="exportCsv">⭳ 导出</button>
      </div>
      <UiButton size="sm" @click="openEdit(null)">＋ 新建商机</UiButton>
    </div>

    <!-- 到期拆机 · 商机确认 -->
    <div v-if="followPending.length" class="rounded-[4px] border border-[#FFE58F] bg-[#FFFBE8]">
      <div class="flex items-center gap-2 border-b border-[#FFE58F] px-4 py-2">
        <span class="text-sm font-semibold text-[#1D2129]">到期拆机 · 商机确认</span>
        <span class="rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">{{ followPending.length }} 家待确认</span>
        <span class="text-[11px] text-[#86909C]">客户合同到期拆机后，请确认是否有后续合作商机：录商机（自动关联本任务）或登记无后续原因（留痕）</span>
      </div>
      <div
        v-for="t in followPending"
        :key="t.id"
        class="flex items-center gap-3 px-4 py-2.5 text-xs"
      >
        <span class="font-medium text-[#1D2129]">{{ t.customer }}</span>
        <span class="font-mono text-[#4E5969]">{{ t.contractNo }}</span>
        <span class="text-[#86909C]">拆机 {{ t.tmNo }} 已完工 · {{ (t.executedAt ?? '').slice(5, 10) }}</span>
        <span class="ml-auto flex gap-2">
          <UiButton size="sm" @click="followHas(t)">有后续 · 录商机</UiButton>
          <UiButton size="sm" variant="outline" @click="followNone(t)">无后续 · 登记原因</UiButton>
        </span>
      </div>
    </div>

    <!-- 无后续原因 -->
    <CenterModal :model-value="!!noneTarget" :title="`登记无后续原因 · ${noneTarget?.customer ?? ''}`" :width="440" @update:model-value="noneTarget = null">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">无后续原因 <span class="text-[#F53F3F]">*</span>（留痕，经营分析可查）</div>
          <UiInput v-model="noneReason" placeholder="如：客户业务收缩，暂无带宽需求" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="noneTarget = null">取消</UiButton>
          <UiButton size="sm" :disabled="!noneReason.trim()" @click="doFollowNone">确认登记</UiButton>
        </div>
      </div>
    </CenterModal>

    <div v-if="isSelf" class="rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5] px-4 py-2 text-[11px] text-[#F53F3F]">
      🔒 数据范围「仅本人数据」：列表仅显示本人名下商机
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">商机编号</th><th class="px-3 py-2">客户</th><th class="px-3 py-2">商机名称</th>
            <th class="px-3 py-2">意向产品（产品定义）</th><th class="px-3 py-2 text-right">预计合同额</th><th class="px-3 py-2">预计成交</th>
            <th class="px-3 py-2">阶段</th><th class="px-3 py-2">来源</th><th class="px-3 py-2">负责销售</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in rows" :key="o.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#86909C]">{{ o.code }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ o.customerName }}</td>
            <td class="px-3 py-3 text-[#1D2129]">
              {{ o.name }}
              <div v-if="o.remark" class="mt-0.5 max-w-[220px] truncate text-[10px] text-[#86909C]" :title="o.remark">{{ o.remark }}</div>
            </td>
            <td class="px-3 py-3 text-[#4E5969]">
              <span v-for="(p, i) in o.products ?? []" :key="i" class="mr-1 inline-block whitespace-nowrap rounded-[2px] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px]">{{ p.cat }} · {{ p.ptype }}</span>
              <span v-if="!(o.products ?? []).length">—</span>
            </td>
            <td class="px-3 py-3 text-right">
              <div class="font-mono">{{ o.expectAmount ? `${fmt(o.expectAmount)} 元` : '—' }}</div>
              <div v-if="o.expectMonths" class="mt-0.5 text-[10px] text-[#86909C]">{{ o.expectMonths }} 个月 · 月均 {{ fmt(Math.round((o.expectAmount ?? 0) / o.expectMonths)) }}</div>
            </td>
            <td class="px-3 py-3 text-[#4E5969]">{{ o.expectedCloseAt ?? '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STAGE_CLS[o.stage] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ o.stage }}</span></td>
            <td class="px-3 py-3 text-[#4E5969]">{{ o.source ?? '—' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ o.salesName ?? '—' }}</td>
            <td class="px-3 py-3 text-right">
              <button
                v-if="o.stage === '赢单' && !contractBlock(o.id)"
                class="mr-1 rounded-[2px] bg-[#165DFF] px-2 py-0.5 text-[11px] text-white hover:bg-[#4080FF]"
                @click="$router.push(`/contract/edit?customer=${o.customerId}&deal=${o.id}`)"
              >去签约 →</button>
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(o)">编辑</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="10" class="px-3 py-10 text-center text-[#86909C]">暂无商机</td>
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
      要点：商机是客户之下的成交单元（客户 → 商机 → 特批 → 合同）。<strong>特批申请必须挂在具体商机上</strong>；商机可关联多个意向产品（来自产品定义），金额为<strong>预计合同额</strong>（含预计合同期，推算月均）；正式成本一律以合同生效后的核算单为准。赢单后由合同订单行承接（合同生效自动关闭），输单保留作经营轨迹。
    </div>

    <!-- 新建/编辑商机：与原型 OppForm 同构 -->
    <CenterModal :model-value="!!editing" :title="editing?.id ? `编辑商机 · ${editing.code}` : '新建商机'" sub="意向产品来自产品定义（类别 → 类型两级选择），一个商机可关联多个产品" :width="560" @update:model-value="editing = null">
      <div v-if="editing" class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">归属客户 <span class="text-[#F53F3F]">*</span></div>
          <CustomerSelect v-model="editing.customerId" :customers="customers" />
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">商机名称 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="editing.name" placeholder="如：二期算力扩容 · BGP 三网互通" />
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between">
            <div class="text-xs text-[#4E5969]">意向产品 <span class="text-[#F53F3F]">*</span><span class="ml-1 text-[#86909C]">（可多个，赢单后由合同订单行承接）</span></div>
            <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]" @click="editing.products.push({ cat: cats[0] ?? '', ptype: '' })">＋ 添加产品</button>
          </div>
          <div class="space-y-2">
            <div v-for="(p, i) in editing.products" :key="i" class="flex items-center gap-2">
              <select
                v-model="p.cat"
                class="w-[42%] rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm"
                @change="p.ptype = typesOf(p.cat)[0] ?? ''"
              >
                <option v-for="c in cats" :key="c" :value="c">{{ c }}</option>
              </select>
              <select v-model="p.ptype" class="flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm">
                <option v-for="t in typesOf(p.cat)" :key="t" :value="t">{{ t }}</option>
              </select>
              <button class="rounded-[2px] px-1.5 py-1 text-[#86909C] hover:text-[#F53F3F] disabled:opacity-30" :disabled="editing.products.length <= 1" :title="editing.products.length <= 1 ? '至少保留一个意向产品' : '删除'" @click="editing.products.splice(i, 1)">✕</button>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">预计合同金额（元）</div>
            <UiInput v-model="editing.expectAmountText" type="number" placeholder="如 2112000" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">预计合同期（月）<span class="text-[#F53F3F]"> *</span></div>
            <UiInput v-model="editing.expectMonthsText" type="number" placeholder="如 24" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">月均合同额（自动）</div>
            <div class="rounded-[2px] border border-[#F2F3F5] bg-[#F7F8FA] px-2 py-1.5 text-sm tabular-nums text-[#4E5969]">
              {{ Number(editing.expectAmountText) > 0 && Number(editing.expectMonthsText) > 0 ? `${fmt(Math.round(Number(editing.expectAmountText) / Number(editing.expectMonthsText)))} 元/月` : '—' }}
            </div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">商机阶段</div>
            <select v-model="editing.stage" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="s in STAGES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">来源渠道</div>
            <select v-model="editing.source" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="s in SOURCES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">预计成交日期</div>
            <input v-model="editing.expectedCloseAt" type="date" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] px-2 text-sm" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">负责销售</div>
          <input class="h-9 w-full cursor-not-allowed rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-2 text-sm text-[#86909C]" :value="auth.profileData?.user?.name ?? ''" disabled title="自动取当前登录人" />
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
          <textarea v-model="editing.remark" class="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows="2" placeholder="竞争情况、关键需求、风险提示等" />
        </div>
        <div v-if="formError" class="rounded-[4px] bg-[#FFECE8] px-3 py-2 text-[12px] text-[#F53F3F]">{{ formError }}</div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="editing = null">取消</UiButton>
          <UiButton size="sm" @click="save">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import CustomerSelect from '../../components/CustomerSelect.vue'
import { createOpportunity, customerPage, opportunityPage, updateOpportunity } from '../../api/mdm'
import { contractPage } from '../../api/mdm'
import { productTypeList } from '../../api/prd'
import { confirmFollow, terminateList } from '../../api/lifecycle'
import type { LcTerminate } from '../../api/lifecycle'
import { Modal } from '@arco-design/web-vue'
import { useAuthStore } from '../../stores/auth'
import type { Customer, Opportunity, ProductType } from '../../api/types'

const STAGES = ['跟进中', '已报价', '赢单', '输单'] as const
const SOURCES = ['老客户续扩', '到期拆机延续', '转介绍', '市场活动', '招标', '陌拜', '其他']
const STAGE_CLS: Record<string, string> = {
  跟进中: 'bg-[#FFF3E8] text-[#FF7D00]',
  已报价: 'bg-[#E8F3FF] text-[#165DFF]',
  赢单: 'bg-[#E8F8F2] text-[#00B42A]',
  输单: 'bg-[#F2F3F5] text-[#86909C]',
}

const route = useRoute()
const auth = useAuthStore()

const rows = ref<Opportunity[]>([])
const customers = ref<Customer[]>([])
const allContracts = ref<{ id: number; opportunityId: number; status: string }[]>([])
const allRows = ref<Opportunity[]>([])
const productTypes = ref<ProductType[]>([])
const kw = ref('')
const stage = ref<string>('全部')
const pageNum = ref(1)
const pageSize = 10
const total = ref(0)
const formError = ref('')

interface EditProduct { cat: string; ptype: string }
interface Editing {
  id?: number
  code?: string
  customerId?: number
  name: string
  stage: string
  source: string
  remark: string
  products: EditProduct[]
  expectAmountText: string
  expectMonthsText: string
  expectedCloseAt: string
}
const editing = ref<Editing | null>(null)

const customerFilter = computed(() => (route.query.customer ? Number(route.query.customer) : undefined))
const followPending = ref<LcTerminate[]>([])
const noneTarget = ref<LcTerminate | null>(null)
const noneReason = ref('')

async function loadFollowPending() {
  try {
    const list = await terminateList()
    followPending.value = list.filter((t) => t.followStatus === '待确认')
  } catch {
    followPending.value = []
  }
}

function followHas(t: LcTerminate) {
  Modal.confirm({
    title: '确认有后续合作商机？',
    content: `${t.customer} · ${t.contractNo}。确认后打开新建商机（客户已锁定），本任务标记「有后续」。`,
    onOk: async () => {
      await confirmFollow(t.id, 'has')
      const cust = customers.value.find((c) => c.name === t.customer)
      openEdit(null)
      if (cust && editing.value) {
        (editing.value as { customerId?: number }).customerId = cust.id
      }
      loadFollowPending()
    },
  })
}

function followNone(t: LcTerminate) {
  noneTarget.value = t
  noneReason.value = ''
}

async function doFollowNone() {
  if (!noneTarget.value || !noneReason.value.trim()) {
    Message.warning('请填写无后续原因')
    return
  }
  await confirmFollow(noneTarget.value.id, 'none', noneReason.value.trim())
  Message.success('已登记留痕')
  noneTarget.value = null
  loadFollowPending()
}

function exportCsv() {
  const header = '商机编号,客户,商机名称,预计合同额,预计月数,预计成交,阶段,来源'
  const lines = rows.value.map((o) =>
    [o.code, customerName(o.customerId), o.name, o.expectAmount ?? '', o.expectMonths ?? '', o.expectedCloseAt ?? '', o.stage, (o as unknown as { source?: string }).source ?? '']
      .map((v) => String(v).replaceAll(',', '，')).join(','))
  const blob = new Blob(['﻿' + header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `商机_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
const isSelf = computed(() => (auth.profileData?.roles ?? []).includes('SALES'))

const cats = computed(() => [...new Set(productTypes.value.map((t) => t.cat))])
function typesOf(cat: string) {
  return productTypes.value.filter((t) => t.cat === cat).map((t) => t.name)
}

/** 类别切换后类型自动校正到该类别第一个（change 事件里处理，见模板） */

function fmt(n: number) {
  return n.toLocaleString('zh-CN')
}

function customerName(id: number) {
  return customers.value.find((c) => c.id === id)?.name ?? id
}

function stageCount(s: string) {
  return allRows.value.filter((o) => o.stage === s).length
}

const IN_FLIGHT = ['审批中', '待出合同', '待用章', '签署中', '待修订']
function contractBlock(oppId: number) {
  return allContracts.value.some((c) => c.opportunityId === oppId && IN_FLIGHT.includes(c.status))
}

async function load(page?: number) {
  if (page) pageNum.value = page
  const params: Record<string, unknown> = { kw: kw.value || undefined, pageNum: pageNum.value, pageSize: 100 }
  if (stage.value !== '全部') params.stage = stage.value
  if (customerFilter.value) params.customerId = customerFilter.value
  const data = await opportunityPage(params)
  allRows.value = data.records
  let list = data.records
  total.value = list.length
  const start = (pageNum.value - 1) * pageSize
  rows.value = list.slice(start, start + pageSize)
}

function openEdit(o: Opportunity | null) {
  formError.value = ''
  editing.value = o
    ? {
        id: o.id, code: o.code, customerId: o.customerId, name: o.name, stage: o.stage,
        source: o.source ?? SOURCES[0], remark: o.remark ?? '',
        products: (o.products ?? []).length ? o.products!.map((p) => ({ ...p })) : [{ cat: cats.value[0] ?? '', ptype: typesOf(cats.value[0] ?? '')[0] ?? '' }],
        expectAmountText: o.expectAmount != null ? String(o.expectAmount) : '',
        expectMonthsText: o.expectMonths != null ? String(o.expectMonths) : '',
        expectedCloseAt: o.expectedCloseAt ?? '',
      }
    : {
        customerId: customerFilter.value, name: '', stage: '跟进中',
        source: SOURCES[0], remark: '',
        products: [{ cat: cats.value[0] ?? '', ptype: typesOf(cats.value[0] ?? '')[0] ?? '' }],
        expectAmountText: '', expectMonthsText: '', expectedCloseAt: '',
      }
}

async function save() {
  const e = editing.value
  if (!e) return
  if (!e.customerId) {
    formError.value = '请选择归属客户'
    return
  }
  if (!e.name.trim()) {
    formError.value = '请填写商机名称'
    return
  }
  const products = e.products.filter((p) => p.ptype)
  if (!products.length || products.some((p) => !p.ptype)) {
    formError.value = '请至少选择一个意向产品类型'
    return
  }
  const dup = products.some((p, i) => products.findIndex((q) => q.cat === p.cat && q.ptype === p.ptype) !== i)
  if (dup) {
    formError.value = '意向产品存在重复（同类别同类型），请去重'
    return
  }
  const months = Number(e.expectMonthsText) || 0
  if (e.expectAmountText && months <= 0) {
    formError.value = '请填写预计合同期（月），用于推算月均合同额'
    return
  }
  formError.value = ''
  const body = {
    customerId: e.customerId,
    name: e.name.trim(),
    stage: e.stage,
    source: e.source,
    remark: e.remark || undefined,
    products,
    expectAmount: e.expectAmountText ? Number(e.expectAmountText) : undefined,
    expectMonths: months || undefined,
    expectedCloseAt: e.expectedCloseAt || undefined,
  }
  if (e.id) {
    await updateOpportunity(e.id, body)
  } else {
    await createOpportunity(body)
  }
  Message.success('已保存')
  editing.value = null
  load()
}

onMounted(async () => {
  const [c, p] = await Promise.all([
    customerPage({ pageNum: 1, pageSize: 200 }),
    productTypeList(),
  ])
  customers.value = c.records
  productTypes.value = p
  allContracts.value = (await contractPage({ pageNum: 1, pageSize: 200 })).records
  await load(1)
  loadFollowPending()
})
</script>
