<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">R4 设备库存</span>
        <UiInput v-model="kw" class="w-52" placeholder="搜索名称 / 型号" @keydown.enter="load" />
        <select v-model="category" class="h-8 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs" @change="load">
          <option value="">全部类别</option>
          <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
        </select>
      </div>
      <UiButton size="sm" @click="openCreate">＋ 新建台账</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">设备编码</th><th class="px-3 py-2">设备名称/型号</th><th class="px-3 py-2">类别</th>
            <th class="px-3 py-2 text-right">采购价</th><th class="px-3 py-2">供应商</th>
            <th class="px-3 py-2 text-right">现存量</th><th class="px-3 py-2 text-right">锁定量</th><th class="px-3 py-2 text-right">可用量</th>
            <th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in rows" :key="e.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#86909C]">DEV-{{ String(e.id).padStart(4, '0') }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ e.name }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ e.category ?? '—' }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ e.costPrice != null ? e.costPrice.toLocaleString('zh-CN') : '—' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ e.supplier ?? '—' }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ e.stock }}</td>
            <td class="px-3 py-3 text-right font-mono" :class="e.locked > 0 ? 'text-[#FF7D00]' : ''">{{ e.locked }}</td>
            <td class="px-3 py-3 text-right font-mono" :class="e.stock - e.locked > 0 ? 'text-[#00B42A]' : 'text-[#F53F3F]'">{{ e.stock - e.locked }}</td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(e)">编辑</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="9" class="px-3 py-10 text-center text-[#86909C]">暂无设备台账</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      现存量由采购入库自动累加（采购单「入库」逐台建档并溯源）；可用量 = 现存量 − 锁定量（核算单选中未出库）。采购价出库时直接结转成本。
    </div>

    <CenterModal :model-value="editorOpen" :title="form.id ? `编辑台账 DEV-${String(form.id).padStart(4, '0')}` : '新建设备台账'" :width="520" @update:model-value="editorOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">设备名称/型号 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.name" placeholder="品牌 + 型号，如 华为 AR6121 CPE" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">设备类别</div>
            <select v-model="form.category" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">供应商</div>
            <UiInput v-model="form.supplier" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">采购价（元）</div>
            <UiInput v-model="form.costPriceText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">现存量</div>
            <UiInput v-model="form.stockText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">锁定量</div>
            <UiInput v-model="form.lockedText" type="number" />
          </div>
        </div>
        <div class="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#86909C]">手工改库存仅用于期初建账/盘盈盘亏；日常入库请走采购单「入库」以保留溯源。</div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="editorOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.name" @click="doSave">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import UiInput from '../../components/ui/Input.vue'
import UiButton from '../../components/ui/Button.vue'
import CenterModal from '../../components/CenterModal.vue'
import { createEquipment, equipmentList, updateEquipment } from '../../api/prd'
import type { Equipment } from '../../api/prd'

const CATEGORIES = ['CPE', '光模块', '板卡', '服务器配件（网卡/HBA）', '交换机']

const rows = ref<Equipment[]>([])
const kw = ref('')
const category = ref('')
const editorOpen = ref(false)
const form = ref({ id: undefined as number | undefined, name: '', category: 'CPE', supplier: '', costPriceText: '', stockText: '0', lockedText: '0' })

async function load() {
  const params: Record<string, unknown> = {}
  if (kw.value) params.kw = kw.value
  if (category.value) params.category = category.value
  rows.value = await equipmentList(params)
}

function openCreate() {
  form.value = { id: undefined, name: '', category: 'CPE', supplier: '', costPriceText: '', stockText: '0', lockedText: '0' }
  editorOpen.value = true
}

function openEdit(e: Equipment) {
  form.value = {
    id: e.id, name: e.name, category: e.category ?? 'CPE', supplier: e.supplier ?? '',
    costPriceText: e.costPrice != null ? String(e.costPrice) : '',
    stockText: String(e.stock), lockedText: String(e.locked),
  }
  editorOpen.value = true
}

async function doSave() {
  const f = form.value
  const data = {
    name: f.name,
    category: f.category,
    supplier: f.supplier || undefined,
    costPrice: f.costPriceText ? Number(f.costPriceText) : undefined,
    stock: Number(f.stockText) || 0,
    locked: Number(f.lockedText) || 0,
  }
  if (f.id) {
    await updateEquipment(f.id, data)
  } else {
    await createEquipment(data)
  }
  Message.success('设备台账已保存')
  editorOpen.value = false
  load()
}

onMounted(load)
</script>
