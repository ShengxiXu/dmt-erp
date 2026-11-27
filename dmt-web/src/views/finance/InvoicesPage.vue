<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">开票管理</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '待开票', '已开票', '已作废']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >{{ t }}</button>
        </div>
      </div>
      <UiButton size="sm" @click="createOpen = true">＋ 新建开票申请</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">申请单号</th><th class="px-3 py-2">客户</th><th class="px-3 py-2 text-right">金额</th>
            <th class="px-3 py-2">发票抬头</th><th class="px-3 py-2">税号</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ r.appNo }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ customerName(r.customerId) }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ r.amount.toLocaleString('zh-CN') }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ r.title ?? '—' }}</td>
            <td class="px-3 py-3 font-mono text-[#86909C]">{{ r.taxNo ?? '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[r.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ r.status }}</span></td>
            <td class="px-3 py-3 text-right">
              <button v-if="r.status === '待开票'" class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]" @click="doAction(r, 'issue', '确认已开票？')">开票</button>
              <button v-if="r.status !== '已作废'" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="doAction(r, 'void', '确认作废该开票申请？')">作废</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="7" class="px-3 py-10 text-center text-[#86909C]">暂无开票申请</td></tr>
        </tbody>
      </table>
    </div>

    <CenterModal :model-value="createOpen" title="新建开票申请" :width="460" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">客户 <span class="text-[#F53F3F]">*</span></div>
          <CustomerSelect v-model="form.customerId" :customers="customers" />
          <div v-if="picked" class="mt-1 rounded-[2px] bg-[#F7F8FA] px-2 py-1.5 text-[11px] text-[#4E5969]">
            抬头：{{ picked.invoiceTitle || picked.name }} · 税号：{{ picked.taxNo || '未维护（专票前请补齐）' }}
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">开票金额（元）<span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.amountText" type="number" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.customerId || !form.amountText" @click="doCreate">保存</UiButton>
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
import CustomerSelect from '../../components/CustomerSelect.vue'
import { createInvoice, invoiceAction, invoicePage } from '../../api/fin'
import type { InvoiceApp } from '../../api/fin'
import { customerPage } from '../../api/mdm'
import type { Customer } from '../../api/types'

const CLS: Record<string, string> = {
  待开票: 'bg-[#FFF3E8] text-[#FF7D00]',
  已开票: 'bg-[#E8F8F2] text-[#00B42A]',
  已作废: 'bg-[#FFECE8] text-[#F53F3F]',
}

const tab = ref('全部')
const rows = ref<InvoiceApp[]>([])
const customers = ref<Customer[]>([])
const createOpen = ref(false)
const form = ref({ customerId: undefined as number | undefined, amountText: '' })

const picked = computed(() => customers.value.find((c) => c.id === form.value.customerId))

function customerName(id: number) {
  return customers.value.find((c) => c.id === id)?.name ?? `客户 #${id}`
}

async function load(page?: number) {
  const params: Record<string, unknown> = { pageNum: page ?? 1, pageSize: 50 }
  if (tab.value !== '全部') params.status = tab.value
  rows.value = (await invoicePage(params)).records
}

function doAction(r: InvoiceApp, action: string, tip: string) {
  Modal.warning({
    title: tip,
    content: `${r.appNo} · ${customerName(r.customerId)} · ${r.amount.toLocaleString('zh-CN')} 元`,
    onOk: async () => {
      await invoiceAction(r.id, action)
      Message.success('操作成功')
      load()
    },
  })
}

async function doCreate() {
  await createInvoice({ customerId: form.value.customerId, amount: Number(form.value.amountText) })
  Message.success('开票申请已创建（抬头/税号自动取自客户主数据）')
  createOpen.value = false
  form.value = { customerId: undefined, amountText: '' }
  load()
}

onMounted(async () => {
  await load(1)
  customers.value = (await customerPage({ pageNum: 1, pageSize: 100 })).records
})
</script>
