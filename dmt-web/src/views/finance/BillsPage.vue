<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">计费与出账</span>
        <span class="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">正常账单自动发出 · 例外进人工审核</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['账期出账', '订阅台账']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="view === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="view = t"
          >{{ t }}{{ t === '账期出账' && pendingReview ? `（待审 ${pendingReview}）` : '' }}</button>
        </div>
      </div>
      <div v-if="view === '账期出账'" class="flex items-center gap-2">
        <UiInput v-model="kw" class="w-44" placeholder="搜索单号" @keydown.enter="load" />
        <UiInput v-model="scanPeriod" class="w-24" placeholder="2026-12" />
        <UiButton size="sm" :loading="scanning" @click="doScan">账期扫描出账</UiButton>
        <UiButton size="sm" variant="outline" @click="createOpen = true">＋ 手工账单</UiButton>
      </div>
    </div>

    <!-- 账期出账 -->
    <template v-if="view === '账期出账'">
      <div class="flex items-center gap-2 text-xs">
        <span class="text-[#86909C]">状态筛选：</span>
        <button
          v-for="t in ['全部', '审核中', '已发出', '已驳回']"
          :key="t"
          class="rounded-[2px] px-2 py-0.5"
          :class="issueTab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
          @click="issueTab = t; load()"
        >{{ t }}</button>
      </div>
      <div v-if="scanMsg" class="rounded-[4px] border border-[#B7EB8F] bg-[#F6FFED] px-4 py-2.5 text-xs text-[#389E0D]">{{ scanMsg }}</div>

      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">账单号</th><th class="px-3 py-2">账期</th><th class="px-3 py-2">客户 / 合同</th>
              <th class="px-3 py-2">明细</th><th class="px-3 py-2 text-right">金额（元）</th>
              <th class="px-3 py-2">应收日期</th><th class="px-3 py-2">生成时间</th><th class="px-3 py-2">审核</th>
              <th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.bill.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-mono text-[#165DFF]">{{ r.bill.billNo }}</td>
              <td class="px-3 py-3 text-[#86909C]">{{ r.bill.period ?? '—' }}</td>
              <td class="px-3 py-3">
                <div class="font-medium text-[#1D2129]">{{ r.customerName ?? '—' }}</div>
                <div class="font-mono text-[10px] text-[#86909C]">{{ r.contractCode ?? '—' }}</div>
              </td>
              <td class="max-w-48 truncate px-3 py-3 text-[#4E5969]" :title="r.linesSummary">{{ r.linesSummary ?? '手工账单' }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ r.bill.amount.toLocaleString('zh-CN') }}</td>
              <td class="px-3 py-3" :class="isOverdue(r.bill) ? 'font-medium text-[#F53F3F]' : 'text-[#86909C]'">{{ r.bill.dueDate ?? '—' }}</td>
              <td class="px-3 py-3 text-[#86909C]">{{ (r.bill.createdAt ?? '').slice(0, 16).replace('T', ' ') }}</td>
              <td class="px-3 py-3 text-[10px] text-[#86909C]">
                <template v-if="r.bill.issueStatus === '已发出' && !r.bill.reviewNote">系统自动 · {{ (r.bill.issuedAt ?? '').slice(0, 16).replace('T', ' ') }}</template>
                <template v-else-if="r.bill.issueStatus === '已发出'">人工通过</template>
                <template v-else>—</template>
              </td>
              <td class="px-3 py-3">
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="ISSUE_CLS[r.bill.issueStatus ?? '已发出']">{{ r.bill.issueStatus ?? '已发出' }}</span>
                <span v-if="r.bill.issueStatus === '已发出'" class="ml-1 rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[r.bill.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ r.bill.status }}</span>
                <div v-if="r.bill.reviewNote" class="mt-0.5 text-[10px] text-[#F53F3F]">{{ r.bill.reviewNote }}</div>
              </td>
              <td class="px-3 py-3 text-right">
                <template v-if="r.bill.issueStatus === '审核中'">
                  <button class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#00B42A] hover:border-[#00B42A]" @click="doReview(r.bill, true)">通过并发出</button>
                  <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="doReview(r.bill, false)">驳回</button>
                </template>
                <span v-else class="text-[#C9CDD4]">—</span>
              </td>
            </tr>
            <tr v-if="!rows.length"><td colspan="10" class="px-3 py-10 text-center text-[#86909C]">暂无账单</td></tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        <div class="mb-1 font-semibold text-[#4E5969]">账单从哪里来（P03 口径）</div>
        <div>1. 账单明细来源：周期费 = 订阅行月租（合同行单价 × 数量）；账期按账期扫描生成，同合同同账期去重</div>
        <div>2. 付款时点：后付费（账期结束后出账收款）；应收日 = 账期截止日 + 10 天付款期</div>
        <div>3. 退订订阅自退订生效账期停止出账（变更与退订联动）</div>
        <div>4. 出账审核（例外管理）：正常账单【自动发出】——金额=订阅月租的机械计算；手工账单必审，通过并发出后才进应收</div>
        <div>5. 应收登记是唯一流入入口：发出即登记；收款/催收只改状态与金额，不维护账单主数据；收款走「回款认领」核销</div>
      </div>
    </template>

    <!-- 订阅台账 -->
    <template v-else>
      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">订阅编号</th><th class="px-3 py-2">客户</th><th class="px-3 py-2">合同</th>
              <th class="px-3 py-2">产品 / 规格</th><th class="px-3 py-2 text-right">月租</th>
              <th class="px-3 py-2">起止</th><th class="px-3 py-2">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in subs" :key="s.subNo" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-mono text-[#4E5969]">{{ s.subNo }}</td>
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ s.customer }}</td>
              <td class="px-3 py-3 font-mono text-[#4E5969]">{{ s.contractNo }}</td>
              <td class="px-3 py-3 text-[#4E5969]">{{ s.product ?? '—' }}<span v-if="s.spec" class="text-[#86909C]"> · {{ s.spec }}</span></td>
              <td class="px-3 py-3 text-right font-mono">{{ s.monthlyFee != null ? s.monthlyFee.toLocaleString('zh-CN') : '—' }}</td>
              <td class="px-3 py-3 text-[#86909C]">{{ s.startDate ?? '—' }} ~ {{ s.endDate ?? '—' }}</td>
              <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="SUB_CLS[s.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ s.status }}</span></td>
            </tr>
            <tr v-if="!subs.length"><td colspan="7" class="px-3 py-10 text-center text-[#86909C]">暂无订阅（合同生效后自动生成）</td></tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        订阅＝已生效合同行（客户账单的取数基础）；变更/退订在「变更与退订」发起，退订生效后该订阅停止出账。
      </div>
    </template>

    <CenterModal :model-value="createOpen" title="手工账单（例外①：必审，通过后发出）" :width="460" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">客户 <span class="text-[#F53F3F]">*</span></div>
          <CustomerSelect v-model="form.customerId" :customers="customers" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">账期（YYYY-MM）</div>
            <UiInput v-model="form.period" placeholder="2026-12" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">到期日</div>
            <UiInput v-model="form.dueDate" type="date" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">应收金额（元）<span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.amountText" type="number" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.customerId || !form.amountText" @click="doCreate">保存（进审核）</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import CustomerSelect from '../../components/CustomerSelect.vue'
import { billPage, createBill, reviewBill, runBillingScan } from '../../api/fin'
import type { Bill } from '../../api/fin'
import { subscriptionList } from '../../api/lifecycle'
import type { Subscription } from '../../api/lifecycle'
import { customerPage } from '../../api/mdm'
import type { Customer } from '../../api/types'

const CLS: Record<string, string> = {
  未收讫: 'bg-[#FFF3E8] text-[#FF7D00]',
  部分收讫: 'bg-[#E8F3FF] text-[#165DFF]',
  已收讫: 'bg-[#E8F8F2] text-[#00B42A]',
  坏账: 'bg-[#FFECE8] text-[#F53F3F]',
}
const ISSUE_CLS: Record<string, string> = {
  已生成: 'bg-[#F7F8FA] text-[#4E5969]',
  审核中: 'bg-[#FFF3E8] text-[#FF7D00]',
  已发出: 'bg-[#E8F3FF] text-[#165DFF]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
}
const SUB_CLS: Record<string, string> = {
  在网: 'bg-[#E8F8F2] text-[#00B42A]',
  欠停: 'bg-[#FFECE8] text-[#F53F3F]',
  退订: 'bg-[#F2F3F5] text-[#86909C]',
}

const view = ref('账期出账')
const issueTab = ref('全部')
const kw = ref('')
const rows = ref<{ bill: Bill; customerName?: string; contractCode?: string; linesSummary?: string }[]>([])
const pendingReview = ref(0)
const subs = ref<Subscription[]>([])
const customers = ref<Customer[]>([])
const createOpen = ref(false)
const form = ref({ customerId: undefined as number | undefined, period: '', dueDate: '', amountText: '' })
const scanPeriod = ref('')
const scanning = ref(false)
const scanMsg = ref('')

function isOverdue(b: Bill) {
  return !!b.dueDate && b.dueDate < new Date().toISOString().slice(0, 10) && b.status !== '已收讫' && b.issueStatus === '已发出'
}

async function load() {
  const params: Record<string, unknown> = { pageNum: 1, pageSize: 50 }
  if (kw.value) params.kw = kw.value
  if (issueTab.value !== '全部') params.issueStatus = issueTab.value
  rows.value = (await billPage(params)).records
  pendingReview.value = (await billPage({ pageNum: 1, pageSize: 1, issueStatus: '审核中' })).total
}

async function doScan() {
  if (!scanPeriod.value) {
    Message.warning('请先填写账期（YYYY-MM）')
    return
  }
  scanning.value = true
  try {
    const r = await runBillingScan(scanPeriod.value)
    scanMsg.value = `账期 ${scanPeriod.value} 扫描完成：生成 ${r.generated} 张账单（自动发出即应收），跳过 ${r.skipped} 个${r.details.length ? '（' + r.details.join('；') + '）' : ''}`
    load()
  } finally {
    scanning.value = false
  }
}

function doReview(b: Bill, pass: boolean) {
  Modal.warning({
    title: pass ? `通过并发出 ${b.billNo}？` : `驳回账单 ${b.billNo}？`,
    content: pass
      ? `${b.amount.toLocaleString('zh-CN')} 元 · 发出即登记应收，可被回款认领核销。`
      : '驳回后账单不进应收，留痕可查。',
    onOk: async () => {
      await reviewBill(b.id, pass, pass ? undefined : '人工驳回')
      Message.success(pass ? '已发出' : '已驳回')
      load()
    },
  })
}

async function doCreate() {
  await createBill({
    customerId: form.value.customerId,
    period: form.value.period || undefined,
    dueDate: form.value.dueDate || undefined,
    amount: Number(form.value.amountText),
  })
  Message.success('手工账单已创建（审核中），通过后发出')
  createOpen.value = false
  form.value = { customerId: undefined, period: '', dueDate: '', amountText: '' }
  load()
}

onMounted(async () => {
  await load()
  subs.value = await subscriptionList()
  customers.value = (await customerPage({ pageNum: 1, pageSize: 100 })).records
})
</script>
