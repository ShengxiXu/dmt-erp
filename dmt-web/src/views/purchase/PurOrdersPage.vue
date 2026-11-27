<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">采购单</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '草稿', '待审批', '已下单', '部分到货', '验收完成', '已驳回']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >{{ t }}</button>
        </div>
      </div>
      <UiButton size="sm" @click="openCreate">＋ 新建采购单</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">采购单号</th><th class="px-3 py-2">供应商</th><th class="px-3 py-2">关联采购合同</th>
            <th class="px-3 py-2 text-right">明细行</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in rows" :key="r.order.id">
            <tr class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-mono text-[#4E5969]"><router-link :to="`/purchase/orders/${r.order.id}`" class="text-[#165DFF] hover:underline">{{ r.order.poNo }}</router-link></td>
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ r.order.supplier }}</td>
              <td class="px-3 py-3 font-mono text-[#4E5969]">{{ r.contractCode ?? '—' }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ r.lines?.length ?? 0 }}</td>
              <td class="px-3 py-3">
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[r.order.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ r.order.status }}</span>
                <span v-if="r.order.rejectReason" class="ml-1 text-[10px] text-[#F53F3F]">（{{ r.order.rejectReason }}）</span>
              </td>
              <td class="px-3 py-3 text-right">
                <button class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="expanded = expanded === r.order.id ? null : r.order.id">{{ expanded === r.order.id ? '收起' : '明细' }}</button>
                <button v-if="r.order.status === '草稿' || r.order.status === '已驳回'" class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]" @click="doSubmit(r.order)">提交审批</button>
                <button v-if="['已下单', '部分到货'].includes(r.order.status)" class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#FF7D00] hover:border-[#FF7D00]" @click="openReceipt(r)">到货验收</button>
                <button v-if="['已下单', '部分到货', '验收完成'].includes(r.order.status)" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#00B42A] hover:border-[#00B42A]" @click="openInbound(r)">入库</button>
              </td>
            </tr>
            <tr v-if="expanded === r.order.id" class="border-b bg-[#F7F8FA] last:border-0">
              <td colspan="6" class="px-3 py-2">
                <table class="w-full text-[11px]">
                  <thead>
                    <tr class="text-left text-[#86909C]">
                      <th class="py-1 pr-3">类型</th><th class="py-1 pr-3">规格</th><th class="py-1 pr-3 text-right">单价</th>
                      <th class="py-1 pr-3 text-right">订购</th><th class="py-1 pr-3 text-right">到货</th><th class="py-1 text-right">合格</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="l in r.lines" :key="l.id" class="border-t border-[#EEF0F2] text-[#4E5969]">
                      <td class="py-1 pr-3">{{ l.lineType }}</td>
                      <td class="py-1 pr-3 font-medium text-[#1D2129]">{{ l.spec }}</td>
                      <td class="py-1 pr-3 text-right font-mono">{{ l.unitPrice.toLocaleString('zh-CN') }}</td>
                      <td class="py-1 pr-3 text-right font-mono">{{ l.quantity }}</td>
                      <td class="py-1 pr-3 text-right font-mono">{{ l.receivedQty }}</td>
                      <td class="py-1 text-right font-mono" :class="l.acceptedQty >= l.quantity ? 'text-[#00B42A]' : ''">{{ l.acceptedQty }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
          <tr v-if="!rows.length"><td colspan="6" class="px-3 py-10 text-center text-[#86909C]">暂无采购单</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 新建采购单 -->
    <CenterModal :model-value="createOpen" title="新建采购单" :width="640" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">供应商 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.supplier" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">关联采购合同</div>
            <select v-model="form.contractId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option :value="undefined">不关联</option>
              <option v-for="c in contracts" :key="c.id" :value="c.id">{{ c.code }} · {{ c.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">税率（%）</div>
            <UiInput v-model="form.taxRateText" type="number" placeholder="13" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">付款条款</div>
            <UiInput v-model="form.paymentTerms" placeholder="如：月结 30 天" />
          </div>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs font-semibold text-[#4E5969]">采购明细 <span class="text-[#F53F3F]">*</span></span>
            <button class="text-[11px] text-[#165DFF] hover:underline" @click="form.lines.push({ lineType: '设备', spec: '', unitPriceText: '', quantityText: '1' })">＋ 添加行</button>
          </div>
          <div v-for="(l, i) in form.lines" :key="i" class="mb-1.5 flex items-center gap-2">
            <select v-model="l.lineType" class="h-8 w-20 shrink-0 rounded-[2px] border border-[#E5E6EB] bg-white px-1 text-xs">
              <option v-for="t in ['设备', '带宽', 'IP', '服务', '其他']" :key="t">{{ t }}</option>
            </select>
            <UiInput v-model="l.spec" class="flex-1" placeholder="规格说明" />
            <UiInput v-model="l.unitPriceText" type="number" class="w-24" placeholder="单价" />
            <UiInput v-model="l.quantityText" type="number" class="w-16" placeholder="数量" />
            <button class="text-[#86909C] hover:text-[#F53F3F]" @click="form.lines.splice(i, 1)">✕</button>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.supplier || !validLines.length" @click="doCreate">保存（草稿）</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 到货验收 -->
    <CenterModal :model-value="!!receipting" :title="`到货验收 · ${receipting?.order.poNo ?? ''}`" :width="560" @update:model-value="receipting = null">
      <div v-if="receipting" class="space-y-3">
        <div v-for="l in receipting.lines" :key="l.id" class="flex items-center gap-3 rounded-[4px] border border-[#E5E6EB] px-3 py-2 text-xs">
          <span class="w-14 shrink-0 text-[#4E5969]">{{ l.lineType }}</span>
          <span class="flex-1 font-medium text-[#1D2129]">{{ l.spec }}</span>
          <span class="font-mono text-[#86909C]">订购 {{ l.quantity }} · 已到 {{ l.receivedQty }}</span>
          <UiInput v-model="receiptItems[l.id].arrivedText" type="number" class="w-20" placeholder="到货" />
          <select v-model="receiptItems[l.id].result" class="h-8 w-20 rounded-[2px] border border-[#E5E6EB] bg-white px-1 text-xs">
            <option>合格</option><option>不合格</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="receipting = null">取消</UiButton>
          <UiButton size="sm" @click="doReceipt">确认验收</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 入库 -->
    <CenterModal :model-value="!!inbounding" :title="`入库建档 · ${inbounding?.order.poNo ?? ''}`" :width="640" @update:model-value="inbounding = null">
      <div v-if="inbounding" class="space-y-3">
        <div>
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs font-semibold text-[#4E5969]">设备台账（写 R4 库存并溯源本采购单）</span>
            <button class="text-[11px] text-[#165DFF] hover:underline" @click="devices.push({ assetNo: '', sn: '', brand: '', model: '', warrantyEnd: '' })">＋ 添加设备</button>
          </div>
          <div v-for="(d, i) in devices" :key="i" class="mb-1.5 flex items-center gap-2">
            <UiInput v-model="d.assetNo" class="flex-1" placeholder="资产编号" />
            <UiInput v-model="d.sn" class="flex-1" placeholder="SN" />
            <UiInput v-model="d.brand" class="w-20" placeholder="品牌" />
            <UiInput v-model="d.model" class="w-24" placeholder="型号" />
            <UiInput v-model="d.warrantyEnd" type="date" class="w-32" />
            <button class="text-[#86909C] hover:text-[#F53F3F]" @click="devices.splice(i, 1)">✕</button>
          </div>
          <div v-if="!devices.length" class="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#86909C]">仅 IP 段入库可不填设备</div>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs font-semibold text-[#4E5969]">IP 段（可选）</span>
            <button class="text-[11px] text-[#165DFF] hover:underline" @click="segments.push({ segment: '', mask: '', gateway: '' })">＋ 添加 IP 段</button>
          </div>
          <div v-for="(s, i) in segments" :key="i" class="mb-1.5 flex items-center gap-2">
            <UiInput v-model="s.segment" class="flex-1" placeholder="如 103.86.41.0" />
            <UiInput v-model="s.mask" class="w-20" placeholder="掩码" />
            <UiInput v-model="s.gateway" class="w-32" placeholder="网关" />
            <button class="text-[#86909C] hover:text-[#F53F3F]" @click="segments.splice(i, 1)">✕</button>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="inbounding = null">取消</UiButton>
          <UiButton size="sm" :disabled="!devices.length && !segments.length" @click="doInbound">确认入库</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { createPurOrder, purContractList, purInbound, purOrderPage, purReceipt, submitPurOrder } from '../../api/pur'
import type { PurContract, PurOrder, PurOrderLine } from '../../api/pur'

const CLS: Record<string, string> = {
  草稿: 'bg-[#F2F3F5] text-[#4E5969]',
  待审批: 'bg-[#FFF3E8] text-[#FF7D00]',
  已下单: 'bg-[#E8F3FF] text-[#165DFF]',
  部分到货: 'bg-[#E8F3FF] text-[#165DFF]',
  验收完成: 'bg-[#E8F8F2] text-[#00B42A]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
}

type Row = { order: PurOrder; contractCode?: string; lines: PurOrderLine[] }

const tab = ref('全部')
const rows = ref<Row[]>([])
const expanded = ref<number | null>(null)
const contracts = ref<PurContract[]>([])
const createOpen = ref(false)
const form = ref({
  supplier: '', contractId: undefined as number | undefined, taxRateText: '', paymentTerms: '',
  lines: [] as { lineType: string; spec: string; unitPriceText: string; quantityText: string }[],
})
const receipting = ref<Row | null>(null)
const receiptItems = reactive<Record<number, { arrivedText: string; result: string }>>({})
const inbounding = ref<Row | null>(null)
const devices = ref<{ assetNo: string; sn: string; brand: string; model: string; warrantyEnd: string }[]>([])
const segments = ref<{ segment: string; mask: string; gateway: string }[]>([])

const validLines = computed(() =>
  form.value.lines.filter((l) => l.spec && Number(l.unitPriceText) >= 0 && Number(l.quantityText) > 0),
)

async function load(page?: number) {
  const params: Record<string, unknown> = { pageNum: page ?? 1, pageSize: 50 }
  if (tab.value !== '全部') params.status = tab.value
  rows.value = (await purOrderPage(params)).records
}

function openCreate() {
  form.value = { supplier: '', contractId: undefined, taxRateText: '', paymentTerms: '', lines: [{ lineType: '设备', spec: '', unitPriceText: '', quantityText: '1' }] }
  createOpen.value = true
}

async function doCreate() {
  await createPurOrder(
    {
      supplier: form.value.supplier,
      contractId: form.value.contractId,
      taxRate: form.value.taxRateText ? Number(form.value.taxRateText) : undefined,
      paymentTerms: form.value.paymentTerms || undefined,
    },
    validLines.value.map((l) => ({ lineType: l.lineType, spec: l.spec, unitPrice: Number(l.unitPriceText), quantity: Number(l.quantityText) })),
  )
  Message.success('采购单已保存（草稿），请提交审批')
  createOpen.value = false
  load()
}

function doSubmit(o: PurOrder) {
  Modal.warning({
    title: `提交采购单 ${o.poNo} 审批？`,
    content: '提交后进入采购单审批流，审批通过后状态变为「已下单」。',
    onOk: async () => {
      await submitPurOrder(o.id)
      Message.success('已提交审批')
      load()
    },
  })
}

function openReceipt(r: Row) {
  receipting.value = r
  for (const l of r.lines) {
    receiptItems[l.id] = { arrivedText: String(l.quantity - l.receivedQty), result: '合格' }
  }
}

async function doReceipt() {
  if (!receipting.value) return
  const items = receipting.value.lines
    .filter((l) => Number(receiptItems[l.id]?.arrivedText) > 0)
    .map((l) => ({ lineId: l.id, arrived: Number(receiptItems[l.id].arrivedText), result: receiptItems[l.id].result }))
  await purReceipt(receipting.value.order.id, items)
  Message.success('验收批次已登记')
  receipting.value = null
  load()
}

function openInbound(r: Row) {
  inbounding.value = r
  devices.value = [{ assetNo: '', sn: '', brand: '', model: '', warrantyEnd: '' }]
  segments.value = []
}

async function doInbound() {
  if (!inbounding.value) return
  const devs = devices.value
    .filter((d) => d.assetNo || d.sn || d.model)
    .map((d) => ({ assetNo: d.assetNo || undefined, sn: d.sn || undefined, brand: d.brand || undefined, model: d.model || undefined, warrantyEnd: d.warrantyEnd || undefined }))
  const segs = segments.value
    .filter((s) => s.segment)
    .map((s) => ({ segment: s.segment, mask: s.mask || undefined, gateway: s.gateway || undefined }))
  await purInbound(inbounding.value.order.id, devs, segs.length ? segs : undefined)
  Message.success('入库完成：设备已写入 R4 库存')
  inbounding.value = null
  load()
}

onMounted(async () => {
  await load(1)
  contracts.value = await purContractList()
})
</script>
