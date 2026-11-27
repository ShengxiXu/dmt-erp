<template>
  <main class="space-y-4 p-6">
    <div v-if="!d" class="rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">加载中…</div>
    <template v-else>
      <!-- 头部 -->
      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
        <div>
          <div class="flex items-center gap-2">
            <router-link to="/purchase/orders" class="text-[11px] text-[#165DFF] hover:underline">← 采购单</router-link>
            <span class="font-mono text-sm font-semibold text-[#1D2129]">{{ d.order.poNo }}</span>
            <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[d.order.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ d.order.status }}</span>
            <span v-if="d.activeInstanceId" class="text-[10px] text-[#FF7D00]">
              审批在途 → <router-link to="/approval" class="text-[#165DFF] hover:underline">审批中心</router-link>
            </span>
          </div>
          <div class="mt-1 text-[11px] text-[#86909C]">
            供应商 {{ d.order.supplier }}
            <template v-if="d.contractCode"> · 采购合同 <span class="font-mono">{{ d.contractCode }}</span></template>
            <template v-if="d.order.paymentTerms"> · {{ d.order.paymentTerms }}</template>
            <template v-if="d.order.taxRate != null"> · 税率 {{ d.order.taxRate }}%</template>
          </div>
          <div v-if="d.order.rejectReason" class="mt-1 text-[11px] text-[#F53F3F]">驳回记录：{{ d.order.rejectReason }}</div>
        </div>
        <div class="text-right text-[11px] leading-5 text-[#86909C]">
          <div>四步办理：采购审批 → 下单 → 到货验收 → 入库建档</div>
          <div>操作入口在列表页（验收/入库弹窗）</div>
        </div>
      </div>

      <!-- 明细行 -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white">
        <div class="border-b bg-[#F7F8FA] px-4 py-2 text-xs font-semibold text-[#4E5969]">采购明细（{{ d.lines.length }} 行）</div>
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b text-left text-[#4E5969]">
              <th class="px-4 py-2">类型</th><th class="px-3 py-2">规格</th><th class="px-3 py-2 text-right">单价</th>
              <th class="px-3 py-2 text-right">订购</th><th class="px-3 py-2 text-right">到货</th><th class="px-3 py-2 text-right">合格</th>
              <th class="px-3 py-2 text-right">金额小计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in d.lines" :key="l.id" class="border-b last:border-0">
              <td class="px-4 py-2.5 text-[#4E5969]">{{ l.lineType }}</td>
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ l.spec }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ l.unitPrice.toLocaleString('zh-CN') }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ l.quantity }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ l.receivedQty }}</td>
              <td class="px-3 py-3 text-right font-mono" :class="l.acceptedQty >= l.quantity ? 'text-[#00B42A]' : ''">{{ l.acceptedQty }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ (l.unitPrice * l.quantity).toLocaleString('zh-CN') }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-[#F7F8FA] text-xs font-semibold text-[#1D2129]">
              <td colspan="6" class="px-4 py-2 text-right">合计</td>
              <td class="px-3 py-2 text-right font-mono">{{ totalAmount.toLocaleString('zh-CN') }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- 验收批次 -->
        <div class="rounded-[4px] border border-[#E5E6EB] bg-white">
          <div class="border-b bg-[#F7F8FA] px-4 py-2 text-xs font-semibold text-[#4E5969]">到货验收批次（{{ d.receipts.length }}）</div>
          <div class="divide-y">
            <div v-for="r in d.receipts" :key="r.id" class="px-4 py-2.5 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-medium text-[#1D2129]">第 {{ r.batchNo }} 批</span>
                <span class="text-[10px] text-[#86909C]">{{ (r.createdAt ?? '').slice(0, 16).replace('T', ' ') }}</span>
              </div>
              <div class="mt-1 space-y-0.5 font-mono text-[11px] text-[#4E5969]">
                <div v-for="(it, i) in parseItems(r.itemsJson)" :key="i">
                  行#{{ it.lineId }} 到货 {{ it.arrived }} · <span :class="it.result === '合格' ? 'text-[#00B42A]' : 'text-[#F53F3F]'">{{ it.result }}</span>
                </div>
              </div>
            </div>
            <div v-if="!d.receipts.length" class="px-4 py-6 text-center text-[11px] text-[#86909C]">尚无验收记录</div>
          </div>
        </div>

        <!-- 入库设备 -->
        <div class="rounded-[4px] border border-[#E5E6EB] bg-white">
          <div class="border-b bg-[#F7F8FA] px-4 py-2 text-xs font-semibold text-[#4E5969]">入库设备台账（{{ d.devices.length }} 台，溯源本单）</div>
          <table class="w-full text-[13px]">
            <thead>
              <tr class="border-b text-left text-[#4E5969]">
                <th class="px-4 py-2">资产编号</th><th class="px-3 py-2">SN</th><th class="px-3 py-2">品牌/型号</th><th class="px-3 py-2">保修至</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="dev in d.devices" :key="dev.id" class="border-b last:border-0">
                <td class="px-4 py-2 font-mono text-[#4E5969]">{{ dev.assetNo ?? '—' }}</td>
                <td class="px-3 py-2 font-mono text-[#86909C]">{{ dev.sn ?? '—' }}</td>
                <td class="px-3 py-2 text-[#1D2129]">{{ [dev.brand, dev.model].filter(Boolean).join(' ') || '—' }}</td>
                <td class="px-3 py-2 text-[#86909C]">{{ dev.warrantyEnd ?? '—' }}</td>
              </tr>
              <tr v-if="!d.devices.length"><td colspan="4" class="px-4 py-6 text-center text-[11px] text-[#86909C]">尚未入库建档</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 关联需求 -->
      <div v-if="d.reqs.length" class="rounded-[4px] border border-[#E5E6EB] bg-white">
        <div class="border-b bg-[#F7F8FA] px-4 py-2 text-xs font-semibold text-[#4E5969]">来源采购需求（{{ d.reqs.length }}）</div>
        <div class="divide-y">
          <div v-for="r in d.reqs" :key="r.id" class="flex items-center gap-3 px-4 py-2.5 text-xs">
            <span class="font-mono text-[#4E5969]">{{ r.reqNo }}</span>
            <span class="flex-1 text-[#1D2129]">{{ r.spec }}</span>
            <span class="text-[#86909C]">{{ r.source }}</span>
            <span class="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{{ r.status }}</span>
          </div>
        </div>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { http } from '../../api/request'
import type { PurOrder, PurOrderLine, PurReq } from '../../api/pur'

interface Receipt { id: number; batchNo: number; itemsJson: string; createdAt?: string }
interface Device { id: number; assetNo?: string; sn?: string; brand?: string; model?: string; warrantyEnd?: string }
interface Detail {
  order: PurOrder
  contractCode?: string
  lines: PurOrderLine[]
  receipts: Receipt[]
  devices: Device[]
  reqs: PurReq[]
  activeInstanceId?: number
}

const CLS: Record<string, string> = {
  草稿: 'bg-[#F2F3F5] text-[#4E5969]',
  待审批: 'bg-[#FFF3E8] text-[#FF7D00]',
  已下单: 'bg-[#E8F3FF] text-[#165DFF]',
  部分到货: 'bg-[#E8F3FF] text-[#165DFF]',
  验收完成: 'bg-[#E8F8F2] text-[#00B42A]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
}

const route = useRoute()
const d = ref<Detail | null>(null)

const totalAmount = computed(() =>
  (d.value?.lines ?? []).reduce((s, l) => s + l.unitPrice * l.quantity, 0),
)

function parseItems(json: string): { lineId: number; arrived: number; result: string }[] {
  try {
    return JSON.parse(json)
  } catch {
    return []
  }
}

onMounted(async () => {
  d.value = await http.get<Detail>(`/purchase/orders/${route.params.id}/detail`)
})
</script>
