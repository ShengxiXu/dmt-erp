<template>
  <main class="space-y-4 p-6">
    <!-- 统计卡 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div class="flex items-center gap-3 rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <span class="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#EEF2FF] text-[#4F46E5]">📋</span>
        <div><div class="font-mono text-xl font-semibold text-[#165DFF]">{{ statOf(['已生成']) }}</div><div class="text-[11px] text-[#86909C]">待可用性检查</div></div>
      </div>
      <div class="flex items-center gap-3 rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <span class="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#F0FDFA] text-[#0D9488]">✅</span>
        <div><div class="font-mono text-xl font-semibold text-[#165DFF]">{{ statOf(['资源分配申请', '资源分配审批']) }}</div><div class="text-[11px] text-[#86909C]">分配申请 / 审批中</div></div>
      </div>
      <div class="flex items-center gap-3 rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <span class="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#FFFBEB] text-[#B45309]">🔧</span>
        <div><div class="font-mono text-xl font-semibold text-[#FF7D00]">{{ statOf(['开通实施', '开通确认']) }}</div><div class="text-[11px] text-[#86909C]">实施 / 确认中</div></div>
      </div>
      <div class="flex items-center gap-3 rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <span class="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#F0FDF4] text-[#15803D]">✓</span>
        <div><div class="font-mono text-xl font-semibold text-[#00B42A]">{{ statOf(['激活计费']) }}</div><div class="text-[11px] text-[#86909C]">已开通（激活计费）</div></div>
      </div>
      <div class="flex items-center gap-3 rounded-[4px] border bg-white p-4" :class="expiringCount ? 'border-[#F53F3F]' : 'border-[#E5E6EB]'">
        <span class="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#FFECE8] text-[#F53F3F]">⏰</span>
        <div><div class="font-mono text-xl font-semibold" :class="expiringCount ? 'text-[#F53F3F]' : 'text-[#1D2129]'">{{ expiringCount }}</div><div class="text-[11px] text-[#86909C]">临期（≤7 天）</div></div>
      </div>
    </div>

    <!-- 流程说明 -->
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      <span class="font-semibold text-[#4E5969]">流程：</span>成本核算审批通过 → 系统自动生成开通工单 → ①资源可用性检查（出口负载由工程师评估，IP/CPE 余量系统自动校验）→ ②资源分配申请 → ③资源分配审批（审批流可配置）→ ④资源绑定与扣减（②层数据在此刻写入）→ ⑤开通实施 → ⑥开通确认 → ⑦激活计费（计费起点，账期按开通日滚动）。<span class="text-[#4E5969]">注意：资源占用的生效点在成本核算审批通过（预选锁定），绑定扣减是物理资源落位。</span>
    </div>

    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">开通工单台账</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '已生成', '资源分配申请', '资源分配审批', '开通实施', '开通确认', '激活计费']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >{{ t }}</button>
        </div>
      </div>
      <span class="text-[11px] text-[#86909C]">{{ total }} 单 · 整行可点进入处理</span>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">工单号</th><th class="px-3 py-2">关联核算单</th><th class="px-3 py-2">客户</th>
            <th class="px-3 py-2">进度</th><th class="px-3 py-2">当前环节</th><th class="px-3 py-2">负责人</th><th class="px-3 py-2">要求完成</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in rows" :key="w.id" class="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" @click="open(w)">
            <td class="px-3 py-3 font-mono text-[#165DFF]">{{ w.code }}</td>
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ w.sheetCode }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ w.customerName }}</td>
            <td class="px-3 py-3">
              <div class="flex items-center gap-2">
                <div class="h-1.5 w-20 overflow-hidden rounded-full bg-[#F2F3F5]">
                  <div class="h-full rounded-full bg-[#165DFF]" :style="{ width: `${(doneCount(w) / 7) * 100}%` }" />
                </div>
                <span class="font-mono text-[10px] text-[#86909C]">{{ doneCount(w) }}/7</span>
              </div>
            </td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STATUS_CLS[w.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ w.status }}</span></td>
            <td class="px-3 py-3 text-[#4E5969]">{{ (w as unknown as { owner?: string }).owner ?? '—' }}</td>
            <td class="px-3 py-3">
              <span :class="isExpiring(w) ? 'font-medium text-[#F53F3F]' : 'text-[#86909C]'">{{ (w as unknown as { deadline?: string }).deadline ?? '—' }}</span>
              <span v-if="isExpiring(w)" class="ml-1 rounded-[2px] bg-[#FFECE8] px-1 py-0.5 text-[10px] text-[#F53F3F]">临期</span>
            </td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">处理</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="8" class="px-3 py-10 text-center text-[#86909C]">暂无工单（核算单审批通过后自动生成）</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      工单由核算单审批通过自动生成；IP/CPE 余量系统自动校验、出口负载人工评估；资源分配申请走审批引擎；绑定扣减事务化并写流水；开通确认把实际分配资源固化进<strong>交付快照</strong>（计费与月结依据）。
    </div>

    <!-- 工单处理抽屉 -->
    <div v-if="detail" class="fixed inset-0 z-50 flex justify-end bg-black/30" @click.self="detail = null">
      <div class="flex h-full w-[880px] max-w-[92vw] flex-col bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-[#F2F3F5] px-6 py-4">
          <div>
            <div class="flex items-center gap-3">
              <span class="font-mono text-[16px] font-semibold text-[#1D2129]">{{ detail.code }}</span>
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STATUS_CLS[detail.status]">{{ detail.status }}</span>
            </div>
            <div class="mt-1 text-[12px] text-[#86909C]">{{ detail.customerName }} · 核算单 {{ detail.sheetCode }} · 合同 {{ detail.contractCode }}</div>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="detail.status === '已生成'" class="rounded-[2px] bg-[#165DFF] px-3 py-1.5 text-[12px] text-white hover:bg-[#4080FF]" @click="doCheck">资源可用性检查</button>
            <button v-if="detail.status === '开通实施'" class="rounded-[2px] bg-[#165DFF] px-3 py-1.5 text-[12px] text-white hover:bg-[#4080FF]" @click="doComplete">开通确认（锁交付快照）</button>
            <button v-if="detail.status === '开通确认'" class="rounded-[2px] bg-[#00B42A] px-3 py-1.5 text-[12px] text-white" @click="doActivate">激活计费</button>
            <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-1 text-[#86909C] hover:text-[#1D2129]" @click="detail = null">✕</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <!-- 任务进度 -->
          <div class="mb-4 flex items-center gap-2">
            <template v-for="t in detail.tasks" :key="t.id">
              <div class="flex items-center gap-1.5">
                <span class="flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                  :class="t.done ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#86909C]'">{{ t.done ? '✓' : t.sort }}</span>
                <span class="text-[11px]" :class="t.done ? 'text-[#1D2129]' : 'text-[#86909C]'">{{ t.name }}</span>
              </div>
            </template>
          </div>

          <!-- 资源分配 -->
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[13px] font-semibold text-[#1D2129]">资源分配（{{ detail.assignments.length }}）</span>
            <button v-if="detail.status === '资源分配申请'" class="rounded-[2px] border border-[#E5E6EB] px-2.5 py-1 text-xs text-[#165DFF] hover:bg-[#F7FAFF]" @click="applyVisible = true">＋ 提交分配申请</button>
          </div>
          <table v-if="detail.assignments.length" class="mb-4 w-full text-[13px]">
            <thead><tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th class="px-2 py-1.5">类型</th><th class="px-2 py-1.5">资源</th><th class="px-2 py-1.5 text-right">数量</th><th class="px-2 py-1.5">状态</th><th class="px-2 py-1.5 text-right">操作</th></tr></thead>
            <tbody>
              <tr v-for="a in detail.assignments" :key="a.id" class="border-b last:border-0">
                <td class="px-2 py-1.5">{{ a.kind }}</td>
                <td class="px-2 py-1.5 text-[#4E5969]">{{ a.refName ?? a.refId }}</td>
                <td class="px-2 py-1.5 text-right font-mono">{{ a.qty }}{{ a.kind === '出口带宽' ? 'M' : '' }}</td>
                <td class="px-2 py-1.5"><span class="rounded-[2px] px-1 py-0.5 text-[10px]" :class="A_CLS[a.status]">{{ a.status }}</span></td>
                <td class="px-2 py-1.5 text-right">
                  <button v-if="a.status === '审批'" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#00B42A] hover:border-[#00B42A]" @click="doBind(a)">绑定扣减</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="mb-4 rounded-[4px] bg-[#F7F8FA] px-3 py-4 text-center text-[12px] text-[#86909C]">尚未提交资源分配申请</div>

          <!-- 申请弹窗 -->
          <div v-if="applyVisible" class="mb-4 rounded-[4px] border border-[#BEDAFF] bg-[#F7FAFF] p-3">
            <div class="mb-2 text-[12px] font-semibold text-[#165DFF]">提交资源分配申请（将走审批引擎「资源分配 · 申请」）</div>
            <div v-for="(it, i) in applyItems" :key="i" class="mb-2 grid grid-cols-12 items-end gap-2">
              <select v-model="it.kind" class="col-span-3 h-8 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs">
                <option v-for="k in ['出口带宽', 'IP', 'CPE', '基础线路']" :key="k">{{ k }}</option>
              </select>
              <select v-model="it.refId" class="col-span-6 h-8 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs">
                <option v-for="r in refOptions(it.kind)" :key="r.id" :value="r.id">{{ r.label }}</option>
              </select>
              <UiInput v-model="it.qtyText" type="number" class="col-span-2" />
              <button class="col-span-1 text-[#86909C] hover:text-[#F53F3F]" @click="applyItems.splice(i, 1)">✕</button>
            </div>
            <div class="flex gap-2">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2.5 py-1 text-xs text-[#165DFF]" @click="applyItems.push({ kind: '出口带宽', refId: refOptions('出口带宽')[0]?.id ?? 0, qtyText: '' })">＋ 加一行</button>
              <UiButton size="sm" @click="doApply">提交申请</UiButton>
              <UiButton size="sm" variant="outline" @click="applyVisible = false">取消</UiButton>
            </div>
          </div>

          <!-- 扣减流水 + 交付快照 -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="mb-1.5 text-[13px] font-semibold text-[#1D2129]">绑定扣减流水</div>
              <table v-if="detail.deductRecords.length" class="w-full text-[13px]">
                <thead><tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th class="px-2 py-1.5">资源</th><th class="px-2 py-1.5 text-right">前</th><th class="px-2 py-1.5 text-right">后</th></tr></thead>
                <tbody>
                  <tr v-for="r in detail.deductRecords" :key="r.id" class="border-b last:border-0">
                    <td class="px-2 py-1.5 font-mono text-[#4E5969]">{{ deductLabel(r) }}</td>
                    <td class="px-2 py-1.5 text-right font-mono">{{ r.beforeQty }}</td>
                    <td class="px-2 py-1.5 text-right font-mono">{{ r.afterQty }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="rounded-[4px] bg-[#F7F8FA] px-3 py-4 text-center text-[12px] text-[#86909C]">暂无流水</div>
            </div>
            <div>
              <div class="mb-1.5 text-[13px] font-semibold text-[#1D2129]">交付快照（开通确认锁定）</div>
              <div v-if="snapshot.length" class="space-y-1.5">
                <div v-for="(s, i) in snapshot" :key="i" class="flex justify-between rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[12px]">
                  <span class="text-[#4E5969]">{{ s.kind }} · {{ s.refName }}</span>
                  <span class="font-mono text-[#1D2129]">{{ s.qty }}</span>
                </div>
              </div>
              <div v-else class="rounded-[4px] bg-[#F7F8FA] px-3 py-4 text-center text-[12px] text-[#86909C]">未锁定</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import { activateWo, applyAssignments, availabilityCheck, bindAssignment, completeWo, woDetail, woPage } from '../../api/wo'
import { poolList, exitList, ipSegmentList, equipmentList } from '../../api/prd'
import type { WorkOrder } from '../../api/wo'

const STATUS_CLS: Record<string, string> = {
  已生成: 'bg-[#FFF3E8] text-[#FF7D00]',
  资源分配申请: 'bg-[#E8F3FF] text-[#165DFF]',
  资源分配审批: 'bg-[#E8F3FF] text-[#165DFF]',
  资源绑定与扣减: 'bg-[#F5F3FF] text-[#7C3AED]',
  开通实施: 'bg-[#FFF3E8] text-[#FF7D00]',
  开通确认: 'bg-[#E8F3FF] text-[#165DFF]',
  激活计费: 'bg-[#E8F8F2] text-[#00B42A]',
}
const A_CLS: Record<string, string> = {
  申请: 'bg-[#FFF3E8] text-[#FF7D00]',
  审批: 'bg-[#E8F3FF] text-[#165DFF]',
  绑定: 'bg-[#E8F8F2] text-[#00B42A]',
}

const route = useRoute()
const tab = ref('全部')
const rows = ref<WorkOrder[]>([])
const total = ref(0)
const statRows = ref<WorkOrder[]>([])

function statOf(statuses: string[]) {
  return statRows.value.filter((w) => statuses.includes(w.status)).length
}

function doneCount(w: WorkOrder) {
  return w.tasks?.filter((t) => t.done).length ?? 0
}

function isExpiring(w: WorkOrder) {
  const dl = (w as unknown as { deadline?: string }).deadline
  if (!dl || w.status === '激活计费') return false
  const days = Math.ceil((new Date(dl).getTime() - Date.now()) / 86400000)
  return days <= 7
}

const expiringCount = computed(() => statRows.value.filter(isExpiring).length)
const pageNum = ref(1)
const detail = ref<WorkOrder | null>(null)
const applyVisible = ref(false)
const applyItems = ref<{ kind: string; refId: number; qtyText: string }[]>([{ kind: '出口带宽', refId: 0, qtyText: '' }])
const pools = ref<{ id: number; label: string }[]>([])
const exits = ref<{ id: number; label: string }[]>([])
const segs = ref<{ id: number; label: string }[]>([])
const equips = ref<{ id: number; label: string }[]>([])

const snapshot = computed(() => {
  if (!detail.value?.deliverySnapshot) return []
  try {
    return JSON.parse(detail.value.deliverySnapshot) as { kind: string; refName: string; qty: number }[]
  } catch {
    return []
  }
})

function refOptions(kind: string) {
  return kind === '出口带宽' ? pools.value : kind === 'IP' ? segs.value : kind === 'CPE' ? equips.value : exits.value
}

function deductLabel(r: { assignmentId: number; refId?: number }) {
  const a = detail.value?.assignments.find((x) => x.id === r.assignmentId)
  if (a) return `${a.kind} · ${a.refName ?? a.refId}`
  return refLabel(r.refId)
}

function refLabel(refId?: number) {
  for (const list of [pools.value, exits.value, segs.value, equips.value]) {
    const hit = list.find((x) => x.id === refId)
    if (hit) return hit.label
  }
  return refId
}

async function load(page?: number) {
  if (page) pageNum.value = page
  const params: Record<string, unknown> = { pageNum: pageNum.value, pageSize: 20 }
  if (tab.value !== '全部') params.status = tab.value
  const data = await woPage(params)
  rows.value = data.records
  total.value = data.total
  statRows.value = (await woPage({ pageNum: 1, pageSize: 100 })).records
}

async function open(w: WorkOrder) {
  detail.value = await woDetail(w.id)
  applyVisible.value = false
}

async function reload() {
  if (detail.value) detail.value = await woDetail(detail.value.id)
  load()
}

async function doCheck() {
  if (!detail.value) return
  const r = await availabilityCheck(detail.value.id, '出口负载人工评估：正常')
  if (r.pass) Message.success('可用性检查通过（IP/CPE 自动校验）')
  else Message.warning(`检查未通过：${r.problems.join('；')}`)
  reload()
}

async function doApply() {
  if (!detail.value) return
  const items = applyItems.value.filter((i) => i.refId && i.qtyText).map((i) => ({ kind: i.kind, refId: i.refId, qty: Number(i.qtyText) }))
  if (!items.length) return
  await applyAssignments(detail.value.id, items)
  Message.success('分配申请已提交（审批引擎流转中）')
  applyVisible.value = false
  reload()
}

async function doBind(a: { id: number }) {
  await bindAssignment(a.id)
  Message.success('绑定扣减完成（已写流水）')
  reload()
}

async function doComplete() {
  if (!detail.value) return
  await completeWo(detail.value.id)
  Message.success('交付快照已锁定')
  reload()
}

async function doActivate() {
  if (!detail.value) return
  await activateWo(detail.value.id)
  Message.success('已激活计费（M5 账单钩子位）')
  reload()
}

onMounted(async () => {
  await load(1)
  const qid = Number(route.query.id)
  if (qid) {
    const hit = rows.value.find((w) => w.id === qid)
    if (hit) {
      open(hit)
    } else {
      detail.value = await woDetail(qid)
    }
  }
  const [p, e, s, q] = await Promise.all([poolList(), exitList(), ipSegmentList(), equipmentList()])
  pools.value = p.map((x) => ({ id: x.id, label: `${x.name}（剩 ${x.capacityM - x.usedM}M）` }))
  exits.value = e.map((x) => ({ id: x.id, label: x.name }))
  segs.value = s.map((x: any) => ({ id: x.id, label: `${x.seg}（${x.status}）` }))
  equips.value = q.map((x: any) => ({ id: x.id, label: `${x.name}（可用 ${x.stock - x.locked}）` }))
})
</script>
