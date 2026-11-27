<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">采购需求</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '待处理', '已转采购单', '已转合同变更', '已关闭']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >{{ t }}</button>
        </div>
      </div>
      <UiButton size="sm" @click="createOpen = true">＋ 手工提报</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">需求单号</th><th class="px-3 py-2">来源</th><th class="px-3 py-2">规格说明</th>
            <th class="px-3 py-2 text-right">数量</th><th class="px-3 py-2">机房</th><th class="px-3 py-2">期望到货</th>
            <th class="px-3 py-2">关联工单</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ r.reqNo }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ r.source }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ r.spec }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ r.qty != null ? `${r.qty} ${r.unit ?? ''}` : '—' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ r.room ?? '—' }}</td>
            <td class="px-3 py-3 text-[#86909C]">{{ r.expectDate ?? '—' }}</td>
            <td class="px-3 py-3 font-mono text-[#86909C]">{{ r.linkedWoId ? `WO-${String(r.linkedWoId).padStart(4, '0')}` : '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[r.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ r.status }}</span></td>
            <td class="px-3 py-3 text-right">
              <template v-if="r.status === '待处理'">
                <button class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]" @click="openConvert(r)">转单</button>
                <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="doClose(r)">关闭</button>
              </template>
              <span v-else-if="r.poId" class="font-mono text-[10px] text-[#86909C]">PO #{{ r.poId }}</span>
              <span v-else class="text-[#C9CDD4]">—</span>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="9" class="px-3 py-10 text-center text-[#86909C]">暂无采购需求</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 新建 -->
    <CenterModal :model-value="createOpen" title="手工提报采购需求" :width="520" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">来源</div>
            <select v-model="form.source" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="s in ['手工提报', '资源不足联动', '业务规划']" :key="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">机房</div>
            <UiInput v-model="form.room" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">规格说明 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.spec" placeholder="如：华为 AR6121 CPE × 出口扩容" />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">数量</div>
            <UiInput v-model="form.qtyText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">单位</div>
            <UiInput v-model="form.unit" placeholder="台/条/个" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">期望到货</div>
            <UiInput v-model="form.expectDate" type="date" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
          <UiInput v-model="form.note" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.spec" @click="doCreate">保存</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 转单 -->
    <CenterModal :model-value="!!converting" title="需求转单" :width="460" @update:model-value="converting = null">
      <div v-if="converting" class="space-y-3">
        <div class="rounded-[4px] border border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2 text-xs text-[#4E5969]">
          {{ converting.reqNo }} · {{ converting.spec }}
        </div>
        <div class="space-y-1.5">
          <label class="flex items-center gap-2 text-sm text-[#1D2129]">
            <input v-model="convKind" type="radio" value="po" /> 转采购单（关联已有采购单）
          </label>
          <label class="flex items-center gap-2 text-sm text-[#1D2129]">
            <input v-model="convKind" type="radio" value="contract_change" /> 转采购合同补充协议（带宽扩容类）
          </label>
        </div>
        <div v-if="convKind === 'po'">
          <div class="mb-0.5 text-xs text-[#4E5969]">目标采购单 <span class="text-[#F53F3F]">*</span></div>
          <select v-model="convPoId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option :value="undefined" disabled>请选择</option>
            <option v-for="p in poOptions" :key="p.id" :value="p.id">{{ p.poNo }} · {{ p.supplier }}（{{ p.status }}）</option>
          </select>
          <div class="mt-1 text-[11px] text-[#86909C]">无合适采购单时请先到「采购单」页新建</div>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="converting = null">取消</UiButton>
          <UiButton size="sm" :disabled="convKind === 'po' && !convPoId" @click="doConvert">确认转单</UiButton>
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
import { closePurReq, convertPurReq, createPurReq, purOrderPage, purReqPage } from '../../api/pur'
import type { PurOrder, PurReq } from '../../api/pur'

const CLS: Record<string, string> = {
  待处理: 'bg-[#FFF3E8] text-[#FF7D00]',
  已转采购单: 'bg-[#E8F3FF] text-[#165DFF]',
  已转合同变更: 'bg-[#E8F3FF] text-[#165DFF]',
  已关闭: 'bg-[#F2F3F5] text-[#86909C]',
}

const tab = ref('全部')
const rows = ref<PurReq[]>([])
const createOpen = ref(false)
const form = ref({ source: '手工提报', room: '', spec: '', qtyText: '', unit: '', expectDate: '', note: '' })
const converting = ref<PurReq | null>(null)
const convKind = ref<'po' | 'contract_change'>('po')
const convPoId = ref<number | undefined>(undefined)
const poOptions = ref<PurOrder[]>([])

async function load(page?: number) {
  const params: Record<string, unknown> = { pageNum: page ?? 1, pageSize: 50 }
  if (tab.value !== '全部') params.status = tab.value
  rows.value = (await purReqPage(params)).records
}

async function doCreate() {
  await createPurReq({
    source: form.value.source,
    room: form.value.room || undefined,
    spec: form.value.spec,
    qty: form.value.qtyText ? Number(form.value.qtyText) : undefined,
    unit: form.value.unit || undefined,
    expectDate: form.value.expectDate || undefined,
    note: form.value.note || undefined,
  })
  Message.success('需求已提报')
  createOpen.value = false
  form.value = { source: '手工提报', room: '', spec: '', qtyText: '', unit: '', expectDate: '', note: '' }
  load()
}

async function openConvert(r: PurReq) {
  converting.value = r
  convKind.value = 'po'
  convPoId.value = undefined
  poOptions.value = (await purOrderPage({ pageNum: 1, pageSize: 50 })).records.map((x) => x.order)
}

async function doConvert() {
  if (!converting.value) return
  const r = await convertPurReq(converting.value.id, convKind.value, convPoId.value)
  Message.success(r.note ?? '转单成功')
  converting.value = null
  load()
}

function doClose(r: PurReq) {
  Modal.warning({
    title: `关闭需求 ${r.reqNo}？`,
    content: '关闭后不可再转单。',
    onOk: async () => {
      await closePurReq(r.id)
      Message.success('已关闭')
      load()
    },
  })
}

onMounted(() => load(1))
</script>
