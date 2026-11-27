<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">付款申请</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '待审批', '已审批', '已付款']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >{{ t }}</button>
        </div>
      </div>
      <UiButton size="sm" @click="createOpen = true">＋ 新建付款申请</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">申请单号</th><th class="px-3 py-2">收款方</th><th class="px-3 py-2 text-right">金额</th>
            <th class="px-3 py-2">事由</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ r.reqNo }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ r.payee }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ r.amount.toLocaleString('zh-CN') }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ r.reason ?? '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[r.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ r.status }}</span></td>
            <td class="px-3 py-3 text-right">
              <button v-if="r.status === '待审批'" class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]" @click="doAction(r, 'approve', '确认审批通过？')">审批</button>
              <button v-if="r.status === '已审批'" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#00B42A] hover:border-[#00B42A]" @click="doAction(r, 'pay', '确认已付款？')">付款</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="px-3 py-10 text-center text-[#86909C]">暂无付款申请</td></tr>
        </tbody>
      </table>
    </div>

    <CenterModal :model-value="createOpen" title="新建付款申请" :width="460" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">收款方 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.payee" />
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">金额（元）<span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.amountText" type="number" />
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">事由</div>
          <UiInput v-model="form.reason" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.payee || !form.amountText" @click="doCreate">保存</UiButton>
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
import { createPayReq, payReqAction, payReqPage } from '../../api/fin'
import type { PayRequest } from '../../api/fin'

const CLS: Record<string, string> = {
  待审批: 'bg-[#FFF3E8] text-[#FF7D00]',
  已审批: 'bg-[#E8F3FF] text-[#165DFF]',
  已付款: 'bg-[#E8F8F2] text-[#00B42A]',
}

const tab = ref('全部')
const rows = ref<PayRequest[]>([])
const createOpen = ref(false)
const form = ref({ payee: '', amountText: '', reason: '' })

async function load(page?: number) {
  const params: Record<string, unknown> = { pageNum: page ?? 1, pageSize: 50 }
  if (tab.value !== '全部') params.status = tab.value
  rows.value = (await payReqPage(params)).records
}

function doAction(r: PayRequest, action: string, tip: string) {
  Modal.warning({
    title: `${tip} ${r.reqNo}`,
    content: `${r.payee} · ${r.amount.toLocaleString('zh-CN')} 元`,
    onOk: async () => {
      await payReqAction(r.id, action)
      Message.success('操作成功')
      load()
    },
  })
}

async function doCreate() {
  await createPayReq({ payee: form.value.payee, amount: Number(form.value.amountText), reason: form.value.reason || undefined })
  Message.success('付款申请已提交')
  createOpen.value = false
  form.value = { payee: '', amountText: '', reason: '' }
  load()
}

onMounted(() => load(1))
</script>
