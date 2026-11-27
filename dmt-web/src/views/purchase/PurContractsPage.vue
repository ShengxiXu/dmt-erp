<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">采购合同</span>
        <span class="text-xs text-[#86909C]">与供应商签订的框架/单价合同，供采购单关联</span>
      </div>
      <UiButton size="sm" @click="openCreate">＋ 新建采购合同</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">合同编码</th><th class="px-3 py-2">名称</th><th class="px-3 py-2">供应商</th>
            <th class="px-3 py-2 text-right">带宽(M)</th><th class="px-3 py-2 text-right">线路月价</th><th class="px-3 py-2 text-right">单价</th>
            <th class="px-3 py-2">生效</th><th class="px-3 py-2">到期</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ c.code }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ c.name }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ c.supplier }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ c.bwM ?? '—' }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ c.linePrice != null ? c.linePrice.toLocaleString('zh-CN') : '—' }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ c.unitPrice != null ? c.unitPrice.toLocaleString('zh-CN') : '—' }}</td>
            <td class="px-3 py-3 text-[#86909C]">{{ c.effectAt ?? '—' }}</td>
            <td class="px-3 py-3 text-[#86909C]">{{ c.endAt ?? '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">{{ c.status ?? '—' }}</span></td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(c)">编辑</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="10" class="px-3 py-10 text-center text-[#86909C]">暂无采购合同</td></tr>
        </tbody>
      </table>
    </div>

    <CenterModal :model-value="editorOpen" :title="form.id ? `编辑采购合同 ${form.code}` : '新建采购合同'" :width="640" @update:model-value="editorOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">合同编码 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.code" placeholder="如 PURC-2026-0003" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">采购主体</div>
            <select v-model="form.buyerId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option :value="undefined">请选择</option>
              <option v-for="e in entities" :key="e.id" :value="e.id">{{ e.fullName }}</option>
            </select>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">合同名称 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.name" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">供应商 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.supplier" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">计费方式</div>
            <select v-model="form.billing" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="按带宽">按带宽</option><option value="按流量">按流量</option><option value="包月">包月</option>
            </select>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">合同标的</div>
          <UiInput v-model="form.subject" placeholder="如：国际出口带宽采购" />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">带宽(M)</div>
            <UiInput v-model="form.bwMText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">容量(M)</div>
            <UiInput v-model="form.capacityMText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">税率（%）</div>
            <UiInput v-model="form.taxRateText" type="number" placeholder="6" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">线路月价（元）</div>
            <UiInput v-model="form.linePriceText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">单价（元/M/月）</div>
            <UiInput v-model="form.unitPriceText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">月成本（元）</div>
            <UiInput v-model="form.monthlyCostText" type="number" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">生效日期</div>
            <UiInput v-model="form.effectAt" type="date" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">到期日期</div>
            <UiInput v-model="form.endAt" type="date" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
          <UiInput v-model="form.remark" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="editorOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.code || !form.name || !form.supplier" @click="doSave">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { purContractList, savePurContract } from '../../api/pur'
import type { PurContract } from '../../api/pur'
import { entityList } from '../../api/mdm'
import type { Entity } from '../../api/mdm'

const rows = ref<PurContract[]>([])
const entities = ref<Entity[]>([])
const editorOpen = ref(false)
const empty = { id: undefined as number | undefined, code: '', buyerId: undefined as number | undefined, name: '', supplier: '', billing: '按带宽', subject: '', bwMText: '', capacityMText: '', taxRateText: '', linePriceText: '', unitPriceText: '', monthlyCostText: '', effectAt: '', endAt: '', remark: '' }
const form = ref({ ...empty })

async function load() {
  rows.value = await purContractList()
}

function openCreate() {
  form.value = { ...empty }
  editorOpen.value = true
}

function openEdit(c: PurContract) {
  form.value = {
    id: c.id, code: c.code, buyerId: c.buyerId, name: c.name, supplier: c.supplier,
    billing: c.billing ?? '按带宽', subject: c.subject ?? '',
    bwMText: c.bwM != null ? String(c.bwM) : '', capacityMText: c.capacityM != null ? String(c.capacityM) : '',
    taxRateText: '', linePriceText: c.linePrice != null ? String(c.linePrice) : '',
    unitPriceText: c.unitPrice != null ? String(c.unitPrice) : '',
    monthlyCostText: c.monthlyCost != null ? String(c.monthlyCost) : '',
    effectAt: c.effectAt ?? '', endAt: c.endAt ?? '', remark: c.remark ?? '',
  }
  editorOpen.value = true
}

async function doSave() {
  const f = form.value
  await savePurContract({
    id: f.id, code: f.code, buyerId: f.buyerId, name: f.name, supplier: f.supplier,
    billing: f.billing, subject: f.subject || undefined,
    bwM: f.bwMText ? Number(f.bwMText) : undefined,
    capacityM: f.capacityMText ? Number(f.capacityMText) : undefined,
    linePrice: f.linePriceText ? Number(f.linePriceText) : undefined,
    unitPrice: f.unitPriceText ? Number(f.unitPriceText) : undefined,
    monthlyCost: f.monthlyCostText ? Number(f.monthlyCostText) : undefined,
    effectAt: f.effectAt || undefined, endAt: f.endAt || undefined,
    remark: f.remark || undefined,
  })
  Message.success('采购合同已保存')
  editorOpen.value = false
  load()
}

onMounted(async () => {
  await load()
  entities.value = await entityList()
})
</script>
