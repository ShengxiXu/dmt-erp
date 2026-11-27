<template>
  <main class="space-y-4 p-6">
    <!-- 数据模型说明 -->
    <div class="rounded-[4px] border border-[#BEDAFF] bg-[#F0F5FF] px-4 py-2.5 text-xs leading-5 text-[#1D2129]">
      <span class="font-semibold">出口池：</span>多出口自组的资源实体（如 BGP 三网互通资源池）：客户向池采购带宽、不指向池内具体出口；池容量 / 池月成本 = 成员出口合计；池化计收基数 = 挂在池上的订单占用（②层实时聚合）。
    </div>

    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-[#1D2129]">R0 · 出口池档案</span>
        <span class="text-[11px] text-[#86909C]">池化计价的基础：容量 / 占用 / 池月成本 / 成员出口分摊权重</span>
      </div>
      <UiButton size="sm" @click="openCreate">＋ 新建出口池</UiButton>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div v-for="p in rows" :key="p.id" class="rounded-[4px] border border-[#E5E6EB] bg-white p-5">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-mono text-[12px] text-[#86909C]">{{ p.code }}</span>
            <div class="mt-0.5 text-[15px] font-semibold text-[#1D2129]">{{ p.name }}</div>
          </div>
          <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="p.status === '启用' || p.status === '生效' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ p.status }}</span>
        </div>
        <div class="mt-3">
          <div class="mb-1 flex justify-between text-[12px]">
            <span class="text-[#4E5969]">已售 {{ p.usedM }}M / 池容量 {{ p.capacityM }}M <span class="rounded-[2px] bg-[#E8F3FF] px-1 text-[9px] text-[#165DFF]">②层</span></span>
            <span class="font-medium" :class="pct(p) > 85 ? 'text-[#F53F3F]' : 'text-[#1D2129]'">{{ pct(p).toFixed(1) }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-[#F2F3F5]">
            <div class="h-full rounded-full" :class="pct(p) > 85 ? 'bg-gradient-to-r from-[#E11D48] to-[#F43F5E]' : 'bg-gradient-to-r from-[#6366F1] to-[#818CF8]'" :style="{ width: `${Math.min(Math.max(pct(p), 2), 100)}%` }" />
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-[12px]">
          <div class="flex justify-between rounded-[2px] bg-[#F7F8FA] px-2 py-1.5"><span class="text-[#86909C]">归属产品</span><span class="text-[#1D2129]">{{ p.product ?? '—' }}</span></div>
          <div class="flex justify-between rounded-[2px] bg-[#F7F8FA] px-2 py-1.5"><span class="text-[#86909C]">池月成本</span><span class="font-mono text-[#1D2129]">{{ p.rentMonth != null ? `${p.rentMonth.toLocaleString('zh-CN')} 元` : '—' }}</span></div>
        </div>
        <!-- 成员出口 -->
        <div class="mt-3">
          <button class="text-[11px] text-[#165DFF] hover:underline" @click="toggleMembers(p.id)">
            {{ expanded === p.id ? '▾ 收起成员出口' : '▸ 成员出口' }}
          </button>
          <div v-if="expanded === p.id" class="mt-1.5 space-y-1">
            <div v-for="m in members" :key="m.id" class="flex items-center justify-between rounded-[2px] border border-[#F2F3F5] px-2 py-1.5 text-[11px]">
              <span class="font-mono text-[#4E5969]">{{ m.code }}</span>
              <span class="flex-1 truncate px-2 text-[#1D2129]">{{ m.name }}</span>
              <span class="font-mono text-[#86909C]">{{ m.bandwidthM }}M</span>
            </div>
            <div v-if="!members.length" class="rounded-[2px] bg-[#F7F8FA] px-2 py-2 text-center text-[11px] text-[#86909C]">暂无成员出口</div>
          </div>
        </div>
      </div>
      <div v-if="!rows.length" class="col-span-2 rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">暂无出口池</div>
    </div>

    <CenterModal :model-value="createOpen" title="新建出口池" sub="池由成员出口自组；容量 / 月成本可手工核定或按成员合计" :width="520" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">池编码 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.code" placeholder="如 P-BGP-02" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">归属产品类型</div>
            <UiInput v-model="form.product" placeholder="如 BGP 三网互通" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">池名称 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.name" placeholder="见名知意，如 BGP 三网互通资源池（二期）" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">池容量（M）</div>
            <UiInput v-model="form.capacityText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">池月成本（元）</div>
            <UiInput v-model="form.rentText" type="number" />
          </div>
        </div>
        <div>
          <div class="mb-1 text-xs font-semibold text-[#4E5969]">成员出口（多选）</div>
          <label v-for="e in exits" :key="e.id" class="mb-1 flex items-center gap-2 text-xs text-[#1D2129]">
            <input v-model="form.exitIds" type="checkbox" :value="e.id" class="accent-[#165DFF]" />
            <span class="font-mono text-[#4E5969]">{{ e.code }}</span> {{ e.name }}
            <span class="text-[#86909C]">{{ e.bandwidthM }}M</span>
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.code || !form.name" @click="doCreate">保存</UiButton>
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
import { exitList, poolList } from '../../api/prd'
import { http } from '../../api/request'
import type { ExitLine, ExitPool } from '../../api/types'

const rows = ref<ExitPool[]>([])
const exits = ref<ExitLine[]>([])
const expanded = ref<number | null>(null)
const members = ref<{ id: number; code: string; name: string; bandwidthM: number }[]>([])
const createOpen = ref(false)
const form = ref({ code: '', name: '', product: '', capacityText: '', rentText: '', exitIds: [] as number[] })

function pct(p: ExitPool) {
  return p.capacityM ? (p.usedM / p.capacityM) * 100 : 0
}

async function toggleMembers(id: number) {
  if (expanded.value === id) {
    expanded.value = null
    return
  }
  expanded.value = id
  const links = await http.get<{ exitId: number; weight?: number }[]>(`/archives/pools/${id}/members`)
  members.value = links
    .map((l) => exits.value.find((e) => e.id === l.exitId))
    .filter((e): e is ExitLine => !!e)
    .map((e) => ({ id: e.id, code: e.code, name: e.name, bandwidthM: e.bandwidthM }))
}

function openCreate() {
  form.value = { code: '', name: '', product: '', capacityText: '', rentText: '', exitIds: [] }
  createOpen.value = true
}

async function doCreate() {
  const f = form.value
  await http.post('/archives/pools', {
    code: f.code, name: f.name, product: f.product || undefined,
    capacityM: f.capacityText ? Number(f.capacityText) : undefined,
    rentMonth: f.rentText ? Number(f.rentText) : undefined,
    members: f.exitIds.map((exitId) => ({ exitId })),
  })
  Message.success('出口池已创建')
  createOpen.value = false
  rows.value = await poolList()
}

onMounted(async () => {
  rows.value = await poolList()
  exits.value = await exitList()
})
</script>
