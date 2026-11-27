<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-[#1D2129]">欠费与坏账</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['欠费账单', `停机复机工单${pendingTickets ? `（${pendingTickets}）` : ''}`, '坏账申请']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t.split('（')[0] ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t.split('（')[0]"
          >{{ t }}</button>
        </div>
        <UiInput v-model="kw" class="w-44" placeholder="搜索单号 / 客户" />
      </div>
      <UiButton v-if="tab === '欠费账单'" size="sm" variant="outline" @click="rescan">运行欠费扫描</UiButton>
      <UiButton v-else-if="tab === '坏账申请'" size="sm" @click="openApply">＋ 坏账申请</UiButton>
    </div>

    <!-- 欠费账单 -->
    <template v-if="tab === '欠费账单'">
      <!-- 欠费策略卡（A5 配置） -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="mb-3 text-sm font-semibold text-[#1D2129]">欠费策略（A5 配置）</div>
        <div class="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
          <div v-for="p in policy" :key="p.label">
            <div class="text-[13px] text-[#1D2129]">{{ p.label }}：<span class="font-semibold">{{ p.value }}</span></div>
            <div class="mt-0.5 text-[11px] leading-4 text-[#86909C]">{{ p.hint }}</div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <span class="text-[#86909C]">账龄筛选：</span>
        <button
          v-for="t in ['全部', '30天内', '30-90天', '90天以上']"
          :key="t"
          class="rounded-[2px] px-2 py-0.5"
          :class="aging === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
          @click="aging = t"
        >{{ t }}</button>
      </div>

      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">账单号</th><th class="px-3 py-2">客户</th><th class="px-3 py-2 text-right">逾期金额</th>
              <th class="px-3 py-2">应收日</th><th class="px-3 py-2 text-right">逾期天数</th><th class="px-3 py-2">滞纳金估算</th>
              <th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in filteredOverdue" :key="b.billId" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-mono text-[#165DFF]">{{ b.billNo }}</td>
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ b.customer }}</td>
              <td class="px-3 py-3 text-right font-mono text-[#FF7D00]">{{ b.balance.toLocaleString('zh-CN') }}</td>
              <td class="px-3 py-3 text-[#86909C]">{{ b.dueDate }}</td>
              <td class="px-3 py-3 text-right font-mono font-semibold text-[#F53F3F]">{{ b.overdueDays }} 天</td>
              <td class="px-3 py-3 font-mono text-[#4E5969]">
                {{ lateFee(b) }} 元 <span class="text-[10px] text-[#86909C]">（{{ lateFeeRate }}%/日，入下期账单）</span>
              </td>
              <td class="px-3 py-3">
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="b.suspended ? 'bg-[#FFECE8] text-[#F53F3F]' : 'bg-[#FFF3E8] text-[#FF7D00]'">{{ b.suspended ? '欠停' : '逾期' }}</span>
              </td>
              <td class="px-3 py-3 text-right">
                <button
                  v-if="!b.suspended && b.overdueDays > suspendDays"
                  class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]"
                  @click="doSuspend(b)"
                >生成停机工单</button>
                <router-link to="/finance/claims" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]">去收款</router-link>
              </td>
            </tr>
            <tr v-if="!filteredOverdue.length"><td colspan="8" class="px-3 py-10 text-center text-[#86909C]">当前无逾期账单 ✓</td></tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        ① 欠费扫描：过应收日且逾期超过宽限期 → 逾期 + 按策略判定（提醒 / 停机）；② 停机条件：逾期 &gt; {{ suspendDays }} 天，停机执行后订阅=欠停，欠停期间周期费照常计；③ 复机仅由足额收讫自动触发（生成复机工单），不接受人工手工复机；④ 滞纳金 {{ lateFeeRate }}%/日按账期入下期账单；⑤ 坏账门槛：逾期 ≥ {{ badDebtDays }} 天，审批通过 → 账单=坏账 + 订阅强制退订；所有参数在策略中心维护。
      </div>
    </template>

    <!-- 停机复机工单 -->
    <template v-else-if="tab === '停机复机工单'">
      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">工单号</th><th class="px-3 py-2">类型</th><th class="px-3 py-2">客户</th>
              <th class="px-3 py-2">欠费摘要</th><th class="px-3 py-2">原因</th><th class="px-3 py-2">状态</th>
              <th class="px-3 py-2">执行信息</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in filteredTickets" :key="t.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-mono text-[#4E5969]">{{ t.ticketNo }}</td>
              <td class="px-3 py-3">
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="t.type === '停机' ? 'bg-[#FFECE8] text-[#F53F3F]' : 'bg-[#E8F8F2] text-[#00B42A]'">{{ t.type }}</span>
              </td>
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ t.customer }}</td>
              <td class="px-3 py-3 text-[#4E5969]">{{ t.debtSummary ?? '—' }}</td>
              <td class="px-3 py-3 text-[#86909C]">{{ t.reason ?? '—' }}</td>
              <td class="px-3 py-3">
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="t.status === '待执行' ? 'bg-[#FFF3E8] text-[#FF7D00]' : 'bg-[#E8F8F2] text-[#00B42A]'">{{ t.status }}</span>
              </td>
              <td class="px-3 py-3 text-[#86909C]">
                <template v-if="t.status === '已执行'">{{ t.action }} · {{ t.result }} · {{ (t.executedAt ?? '').slice(0, 16).replace('T', ' ') }}</template>
                <template v-else>—</template>
              </td>
              <td class="px-3 py-3 text-right">
                <button v-if="t.status === '待执行'" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]" @click="openExecute(t)">执行</button>
                <span v-else class="text-[#C9CDD4]">—</span>
              </td>
            </tr>
            <tr v-if="!filteredTickets.length"><td colspan="8" class="px-3 py-10 text-center text-[#86909C]">暂无工单</td></tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        停机工单由欠费行生成，网络侧执行后订阅=欠停；复机工单由足额收讫自动生成。执行需选动作与结果并留痕。
      </div>
    </template>

    <!-- 坏账申请 -->
    <template v-else>
      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">申请单号</th><th class="px-3 py-2">账单 / 客户</th><th class="px-3 py-2 text-right">坏账金额</th>
              <th class="px-3 py-2">坏账原因</th><th class="px-3 py-2">处置方式</th><th class="px-3 py-2">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in badDebts" :key="b.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-mono text-[#4E5969]">{{ b.bdNo }}</td>
              <td class="px-3 py-3">
                <div class="font-mono text-[#4E5969]">{{ b.billNo }}</div>
                <div class="font-medium text-[#1D2129]">{{ b.customer }}</div>
              </td>
              <td class="px-3 py-3 text-right font-mono text-[#F53F3F]">{{ b.amount.toLocaleString('zh-CN') }}</td>
              <td class="px-3 py-3 text-[#4E5969]">{{ b.reason }}</td>
              <td class="px-3 py-3 text-[#4E5969]">{{ b.handling }}</td>
              <td class="px-3 py-3">
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="BD_CLS[b.status]">{{ b.status }}</span>
                <div v-if="b.rejectNote" class="mt-0.5 text-[10px] text-[#F53F3F]">{{ b.rejectNote }}</div>
              </td>
            </tr>
            <tr v-if="!badDebts.length"><td colspan="6" class="px-3 py-10 text-center text-[#86909C]">暂无坏账申请</td></tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        审批通过 → 选中账单状态=坏账（挂账观察的保持逾期、暂停滞纳金与停机动作）；坏账确认后订阅强制进入退订流程（自动发起，退订原因=坏账）；后续收回款项可对该账单正常收款登记（坏账状态转回并留痕）。门槛：逾期 ≥ {{ badDebtDays }} 天（策略中心可配）。
      </div>
    </template>

    <!-- 执行工单 -->
    <CenterModal :model-value="!!executing" :title="`${executing?.type ?? ''}工单执行单 · ${executing?.ticketNo ?? ''}`" :sub="executing ? `${executing.customer} · ${executing.debtSummary ?? ''}` : ''" :width="520" @update:model-value="executing = null">
      <div v-if="executing" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">执行动作 <span class="text-[#F53F3F]">*</span></div>
            <select v-model="execForm.action" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="" disabled>请选择…</option>
              <option v-for="a in executing.type === '停机' ? ['断网', '端口 shutdown', '整机下架'] : ['恢复网络', '端口 no shutdown', '整机上架']" :key="a">{{ a }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">执行结果 <span class="text-[#F53F3F]">*</span></div>
            <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              <button
                v-for="r in ['成功', '部分成功', '失败']"
                :key="r"
                class="flex-1 rounded-[2px] px-2 py-1 text-xs"
                :class="execForm.result === r ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
                @click="execForm.result = r"
              >{{ r }}</button>
            </div>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">执行留痕</div>
          <UiInput v-model="execForm.note" placeholder="如：核心侧端口已 shutdown，工单号 NOC-xxx" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="executing = null">取消</UiButton>
          <UiButton size="sm" :disabled="!execForm.action || !execForm.result" @click="doExecute">确认执行</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 坏账申请弹窗 -->
    <CenterModal :model-value="applyOpen" title="坏账申请" :sub="`仅逾期账单可选（当前门槛：逾期 ≥ ${badDebtDays} 天，可在策略中心配置）；提交走管理层审批`" :width="560" @update:model-value="applyOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">逾期账单 <span class="text-[#F53F3F]">*</span></div>
          <select v-model="form.billId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option :value="undefined" disabled>请选择</option>
            <option v-for="b in overdueRows" :key="b.billId" :value="b.billId">
              {{ b.billNo }} · {{ b.customer }} · 余额 {{ b.balance.toLocaleString('zh-CN') }} · 逾期 {{ b.overdueDays }} 天
            </option>
          </select>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">坏账原因 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.reason" placeholder="如：客户失联，多次催收无果" />
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">处置方式</div>
          <select v-model="form.handling" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option>核销坏账</option><option>继续挂账观察</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="applyOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.billId || !form.reason" @click="doApply">提交审批</UiButton>
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
import {
  badDebtList, createSuspend, executeTicket, overdueBillList, submitBadDebt, ticketList,
} from '../../api/fin'
import type { BadDebt, OverdueBill, SuspendTicket } from '../../api/fin'
import { configList } from '../../api/sys'

const BD_CLS: Record<string, string> = {
  审批中: 'bg-[#FFF3E8] text-[#FF7D00]',
  已通过: 'bg-[#E8F8F2] text-[#00B42A]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
}

const tab = ref('欠费账单')
const kw = ref('')
const aging = ref('全部')
const overdueRows = ref<OverdueBill[]>([])
const tickets = ref<SuspendTicket[]>([])
const badDebts = ref<BadDebt[]>([])
const cfg = ref<Record<string, string>>({})
const executing = ref<SuspendTicket | null>(null)
const execForm = ref({ action: '', result: '成功', note: '' })
const applyOpen = ref(false)
const form = ref({ billId: undefined as number | undefined, reason: '', handling: '核销坏账' })
const scanning = ref(false)

const graceDays = computed(() => Number(cfg.value['overdue.graceDays'] ?? 3))
const suspendDays = computed(() => Number(cfg.value['overdue.suspendDays'] ?? 30))
const badDebtDays = computed(() => Number(cfg.value['overdue.badDebtDays'] ?? 180))
const lateFeeRate = computed(() => Number(cfg.value['overdue.lateFeeRate'] ?? 0.05))

const policy = computed(() => [
  { label: '宽限期', value: `${graceDays.value} 天`, hint: `逾期 ≤ ${graceDays.value} 天仅提醒，不停机` },
  { label: '提醒频率', value: `每 ${cfg.value['overdue.remindDays'] ?? 7} 天一次`, hint: '通知客户联系人 + 归属销售 + 财务；不重复堆叠' },
  { label: '停机条件', value: `逾期 > ${suspendDays.value} 天`, hint: '信用额度客户按额度判定；命中即逐订阅生成停机工单' },
  { label: '滞纳金', value: `${lateFeeRate.value}% / 日`, hint: '逾期金额 × 比例 × 天数，按账期入下期账单；收讫即停止' },
  { label: '停机期间计费', value: '照常计', hint: '欠停期间周期费是否仍计入账单（A5 计费规则中配置）' },
  { label: '复机', value: '仅收讫触发', hint: '足额核销自动生成复机工单；不接受人工手工复机' },
  { label: '坏账门槛', value: `逾期 ≥ ${badDebtDays.value} 天`, hint: '坏账走管理层审批' },
])

const filteredOverdue = computed(() => overdueRows.value.filter((b) => {
  if (kw.value && !b.billNo.includes(kw.value) && !b.customer.includes(kw.value)) return false
  if (aging.value === '30天内') return b.overdueDays <= 30
  if (aging.value === '30-90天') return b.overdueDays > 30 && b.overdueDays <= 90
  if (aging.value === '90天以上') return b.overdueDays > 90
  return true
}))

const filteredTickets = computed(() => tickets.value.filter((t) =>
  !kw.value || t.ticketNo.includes(kw.value) || (t.customer ?? '').includes(kw.value)))

const pendingTickets = computed(() => tickets.value.filter((t) => t.status === '待执行').length)

function lateFee(b: OverdueBill) {
  return Math.round(b.balance * (lateFeeRate.value / 100) * b.overdueDays)
}

async function load() {
  const [o, t, b] = await Promise.all([overdueBillList(), ticketList(), badDebtList()])
  overdueRows.value = o
  tickets.value = t
  badDebts.value = b
}

function rescan() {
  scanning.value = true
  load().then(() => Message.success(`欠费扫描完成：${overdueRows.value.length} 笔逾期（宽限期 ${graceDays.value} 天，策略中心可配）`))
    .finally(() => { scanning.value = false })
}

function doSuspend(b: OverdueBill) {
  Modal.warning({
    title: `为 ${b.billNo} 生成停机工单？`,
    content: `${b.customer} · 欠费 ${b.balance.toLocaleString('zh-CN')} 元 · 逾期 ${b.overdueDays} 天（停机条件 > ${suspendDays.value} 天）。网络侧执行后订阅=欠停。`,
    onOk: async () => {
      await createSuspend(b.billId, `逾期 ${b.overdueDays} 天，命中停机条件（> ${suspendDays.value} 天）`)
      Message.success('停机工单已生成（待执行）')
      load()
    },
  })
}

function openExecute(t: SuspendTicket) {
  executing.value = t
  execForm.value = { action: '', result: '成功', note: '' }
}

async function doExecute() {
  if (!executing.value) return
  await executeTicket(executing.value.id, execForm.value)
  Message.success(`${executing.value.type}工单已执行`)
  executing.value = null
  load()
}

function openApply() {
  form.value = { billId: undefined, reason: '', handling: '核销坏账' }
  applyOpen.value = true
}

async function doApply() {
  if (!form.value.billId) return
  await submitBadDebt({ billId: form.value.billId, reason: form.value.reason, handling: form.value.handling })
  Message.success('坏账申请已提交（管理层审批）')
  applyOpen.value = false
  load()
}

onMounted(async () => {
  const cfgs = await configList()
  cfg.value = Object.fromEntries(cfgs.map((c) => [c.cfgKey, c.cfgValue ?? '']))
  await load()
})
</script>
