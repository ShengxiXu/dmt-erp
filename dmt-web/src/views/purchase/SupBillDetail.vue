<template>
  <main class="space-y-4 p-6">
    <div v-if="!d" class="rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">加载中…</div>
    <template v-else>
      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
        <div>
          <div class="flex items-center gap-2">
            <router-link to="/bills" class="text-[11px] text-[#165DFF] hover:underline">← 供应商账单</router-link>
            <span class="font-mono text-lg font-semibold text-[#1D2129]">{{ d.bill.billNo }}</span>
            <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[d.bill.status]">{{ d.bill.status }}</span>
            <span v-if="d.bill.tag" class="rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">{{ d.bill.tag }}</span>
            <span v-if="d.overdue" class="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">超期未付</span>
          </div>
          <div class="mt-1 text-[11px] text-[#86909C]">{{ d.bill.supplier }} · 账期 {{ d.bill.period }}</div>
        </div>
        <div class="text-right">
          <div class="text-[11px] text-[#86909C]">账单金额（元）</div>
          <div class="font-mono text-2xl font-semibold text-[#1D2129]">{{ d.bill.amount.toLocaleString('zh-CN') }}</div>
        </div>
      </div>

      <div class="rounded-[4px] border border-[#E5E6EB] bg-white">
        <div class="border-b px-4 py-2.5 text-sm font-semibold text-[#1D2129]">基础信息</div>
        <div class="grid grid-cols-2 gap-x-8 gap-y-2.5 px-4 py-3 text-xs md:grid-cols-3">
          <div><span class="text-[#86909C]">供应商：</span><span class="text-[#1D2129]">{{ d.bill.supplier }}</span></div>
          <div><span class="text-[#86909C]">账期：</span><span class="text-[#1D2129]">{{ d.bill.period }}</span></div>
          <div><span class="text-[#86909C]">费用归类：</span><span class="text-[#1D2129]">{{ d.costItemName ?? '未归类' }}</span></div>
          <div><span class="text-[#86909C]">关联采购单：</span><span class="font-mono text-[#1D2129]">{{ d.bill.poNo ?? '—' }}</span></div>
          <div><span class="text-[#86909C]">关联采购合同：</span><span class="font-mono text-[#1D2129]">{{ d.bill.contractNo ?? '—' }}</span></div>
          <div><span class="text-[#86909C]">关联资源：</span><span class="font-mono text-[#1D2129]">{{ d.bill.resRef ?? '—' }}</span></div>
          <div><span class="text-[#86909C]">付款到期：</span><span :class="d.overdue ? 'font-medium text-[#F53F3F]' : 'text-[#1D2129]'">{{ d.bill.payDueDate ?? '—' }}</span></div>
          <div><span class="text-[#86909C]">录入时间：</span><span class="text-[#1D2129]">{{ (d.bill.createdAt ?? '').slice(0, 16).replace('T', ' ') }}</span></div>
          <div class="col-span-2 md:col-span-3"><span class="text-[#86909C]">备注：</span><span class="text-[#1D2129]">{{ d.bill.note ?? '—' }}</span></div>
        </div>
      </div>

      <div v-if="d.refs?.length" class="rounded-[4px] border border-[#E5E6EB] bg-white">
        <div class="border-b px-4 py-2.5 text-sm font-semibold text-[#1D2129]">被哪些核算单引用（{{ d.refs.length }} 条核算行）</div>
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b text-left text-[#4E5969]">
              <th class="px-4 py-2">核算行</th><th class="px-3 py-2">条目</th><th class="px-3 py-2">部门</th>
              <th class="px-3 py-2 text-right">数量</th><th class="px-3 py-2 text-right">金额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in d.refs" :key="r.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-4 py-3 font-mono text-[#165DFF]">核算单 #{{ r.sheetId }} · 行 #{{ r.id }}</td>
              <td class="px-3 py-3 text-[#1D2129]">{{ r.itemKey }}</td>
              <td class="px-3 py-3 text-[#4E5969]">{{ r.dept ?? '—' }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ r.qty ?? '—' }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ r.amount != null ? Number(r.amount).toLocaleString('zh-CN') : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <span class="text-[11px] text-[#86909C]">入账后可被核算单引用（来源单号＝账单号）；已月结账单不可作废。</span>
        <div class="flex gap-2">
          <template v-if="d.bill.status === '待入账'">
            <UiButton size="sm" @click="doPost">入账</UiButton>
            <UiButton size="sm" variant="outline" @click="doVoid">作废</UiButton>
          </template>
          <UiButton v-else-if="d.bill.status === '已入账'" size="sm" variant="outline" @click="doVoid">作废</UiButton>
        </div>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import { http } from '../../api/request'
import { postSupBill, voidSupBill } from '../../api/pur'
import type { SupBill } from '../../api/pur'

interface Detail {
  bill: SupBill
  costItemName?: string
  overdue: boolean
  refs?: { id: number; sheetId: number; itemKey: string; dept?: string; qty?: number; amount?: number }[]
}

const CLS: Record<string, string> = {
  待入账: 'bg-[#FFF3E8] text-[#FF7D00]',
  已入账: 'bg-[#E8F3FF] text-[#165DFF]',
  已月结: 'bg-[#E8F8F2] text-[#00B42A]',
  已作废: 'bg-[#F2F3F5] text-[#86909C]',
}

const route = useRoute()
const router = useRouter()
const d = ref<Detail | null>(null)
const id = Number(route.params.id)

async function load() {
  d.value = await http.get<Detail>(`/purchase/bills/${id}`)
}

function doPost() {
  Modal.warning({
    title: `账单 ${d.value?.bill.billNo} 入账？`,
    content: `${d.value?.bill.supplier} · ${d.value?.bill.period} · ${d.value?.bill.amount.toLocaleString('zh-CN')} 元。入账后可被核算单引用。`,
    onOk: async () => {
      await postSupBill(id)
      Message.success('已入账')
      load()
    },
  })
}

function doVoid() {
  Modal.warning({
    title: `作废账单 ${d.value?.bill.billNo}？`,
    content: '作废后不可恢复，留痕可查。',
    onOk: async () => {
      await voidSupBill(id)
      Message.success('已作废')
      router.push('/bills')
    },
  })
}

onMounted(load)
</script>
