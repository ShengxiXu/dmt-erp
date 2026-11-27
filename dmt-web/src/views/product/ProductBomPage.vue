<template>
  <main class="space-y-4 p-6">
    <!-- ============ 目录态：产品类型清单总览 ============ -->
    <template v-if="!current">
      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div class="flex items-center gap-3">
          <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">资源清单</span>
          <span class="text-[11px] text-[#86909C]">选择产品类型进入维护：清单 = 这个产品由哪些资源组成（直接成本自动推导）＋ 用哪些成本中心（间接费用）</span>
        </div>
        <UiInput v-model="kw" class="w-52" placeholder="搜索产品类型 / 类别" />
      </div>

      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">产品类别</th><th class="px-3 py-2">产品类型</th>
              <th class="px-3 py-2 text-right">清单资源</th><th class="px-3 py-2 text-right">间接成本中心</th>
              <th class="px-3 py-2 text-right">账目数</th><th class="px-3 py-2">版本</th><th class="px-3 py-2">算账口径</th>
              <th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in filteredTypes" :key="t.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 text-[#4E5969]">{{ catOf(t) }}</td>
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ t.name }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ matsOf(t.id).length }}</td>
              <td class="px-3 py-3 text-right font-mono" :class="centersOf(t).length ? '' : 'text-[#C9CDD4]'">{{ centersOf(t).length }}</td>
              <td class="px-3 py-3 text-right font-mono">{{ billCount(t) }}</td>
              <td class="px-3 py-3 font-mono text-[#4E5969]">v{{ asmVersion(t) }}</td>
              <td class="px-3 py-3">
                <span v-if="!problems(t).length" class="text-[11px] text-[#00B42A]">✓ 齐全</span>
                <span v-else class="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">{{ problems(t).length }} 项待办</span>
              </td>
              <td class="px-3 py-3 text-right">
                <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="pick(t)">维护清单</button>
              </td>
            </tr>
            <tr v-if="!filteredTypes.length"><td colspan="8" class="px-3 py-10 text-center text-[#86909C]">暂无产品类型</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ============ 编辑态：单类型清单维护 ============ -->
    <template v-else>
      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div class="flex flex-wrap items-center gap-2">
          <button class="text-xs text-[#165DFF] hover:underline" @click="current = null">← 资源清单</button>
          <span class="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{{ catOf(current) }}</span>
          <span class="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{{ current.name }}</span>
          <span class="rounded-[2px] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] text-[#4E5969]">当前 v{{ asmVersion(current) }}</span>
          <span v-if="!problems(current).length" class="text-[10px] text-[#00B42A]">✓ 算账口径齐全</span>
          <span v-else class="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">{{ problems(current).length }} 项待办</span>
          <div class="relative">
            <button class="text-[10px] text-[#4E5969] hover:text-[#165DFF]" @click="historyOpen = !historyOpen">▼ 版本历史（{{ historyOf(current).length }}）</button>
            <div v-if="historyOpen" class="absolute left-0 top-6 z-30 w-64 rounded-[4px] border border-[#E5E6EB] bg-white py-1 shadow-lg">
              <div v-for="h in historyOf(current)" :key="h.ver" class="flex justify-between px-3 py-1.5 text-[11px]">
                <span class="font-mono text-[#165DFF]">v{{ h.ver }}</span>
                <span class="text-[#86909C]">{{ h.at }} · {{ h.by }}</span>
              </div>
              <div v-if="!historyOf(current).length" class="px-3 py-2 text-[11px] text-[#86909C]">暂无历史（保存清单自动 +1）</div>
            </div>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <router-link to="/cost-items" class="text-[11px] text-[#165DFF] hover:underline">管理成本条目库 →</router-link>
          <UiButton size="sm" :disabled="!dirty" @click="save">{{ dirty ? '保存清单（版本自动 +1）' : '清单无改动' }}</UiButton>
        </div>
      </div>

      <!-- 产品组成 -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white">
        <div class="flex items-center justify-between border-b bg-[#F7F8FA] px-4 py-2">
          <div class="text-xs">
            <span class="font-semibold text-[#1D2129]">产品组成</span>
            <span class="ml-2 text-[#86909C]">由哪些资源组成。各资源关联的直接成本项自动列出——点击可切换计入 / 不计入</span>
          </div>
          <UiButton size="sm" @click="pickOpen = true">＋ 选用资源</UiButton>
        </div>
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b text-left text-[#4E5969]">
              <th class="px-4 py-2">资源</th><th class="px-3 py-2">形态</th>
              <th class="px-3 py-2">关联直接成本（点击计入 / 不计入）</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in lines" :key="l.materialKey" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-4 py-3">
                <span class="font-medium text-[#1D2129]">{{ matName(l.materialKey) }}</span>
                <span v-if="rCode(l.materialKey)" class="ml-1.5 font-mono text-[10px] text-[#165DFF]">{{ rCode(l.materialKey) }}</span>
              </td>
              <td class="px-3 py-3">
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="FORM_STYLE[matOf(l.materialKey)?.form ?? ''] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ matOf(l.materialKey)?.form ?? '—' }}</span>
              </td>
              <td class="px-3 py-3">
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="it in itemsOfResource(l.materialKey)"
                    :key="it.itemKey"
                    class="rounded-[2px] border px-2 py-0.5 text-[11px] transition-colors"
                    :class="isOff(it.itemKey)
                      ? 'border-[#E5E6EB] bg-[#F7F8FA] text-[#C9CDD4] line-through'
                      : 'border-[#BEDAFF] bg-white text-[#1D2129] hover:border-[#165DFF]'"
                    :title="isOff(it.itemKey) ? '已剔除：点击恢复计入' : '计入中：点击剔除（本产品不算这笔账）'"
                    @click="toggleOff(it.itemKey)"
                  >
                    {{ it.name }} <span class="text-[10px] text-[#86909C]">{{ it.calcKind }}</span>
                  </button>
                  <span v-if="!itemsOfResource(l.materialKey).length" class="text-[11px] text-[#C9CDD4]">无适用条目（到成本条目库给条目设「适用资源」）</span>
                </div>
              </td>
              <td class="px-3 py-3 text-right">
                <button class="text-[11px] text-[#F53F3F] hover:underline" @click="lines.splice(i, 1)">移除</button>
              </td>
            </tr>
            <tr v-if="!lines.length"><td colspan="4" class="px-4 py-8 text-center text-[#86909C]">还没有资源。点「选用资源」从资源目录挑——挑好后，关联的直接成本项会自动列出。</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 选用资源弹窗 -->
    <CenterModal :model-value="pickOpen" :title="`选用资源 · ${current?.name ?? ''}`" sub="从资源目录挑这个产品由哪些资源组成" :width="520" @update:model-value="pickOpen = false">
      <div class="space-y-2 text-xs">
        <div
          v-for="d in materialDefs.filter((x) => x.status !== '停用' && !lines.some((l) => l.materialKey === x.matKey))"
          :key="d.matKey"
          class="flex items-center gap-2 rounded-[2px] border border-[#E5E6EB] px-3 py-2"
        >
          <span class="font-medium text-[#1D2129]">{{ d.name }}</span>
          <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="FORM_STYLE[d.form] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ d.form }}</span>
          <span class="text-[10px] text-[#86909C]">{{ d.groupName ?? '' }}</span>
          <span class="ml-auto max-w-[200px] truncate text-[10px] text-[#86909C]" :title="d.remark">{{ d.remark ?? '' }}</span>
          <UiButton size="sm" variant="outline" @click="pickResource(d.matKey)">选用</UiButton>
        </div>
        <div
          v-if="!materialDefs.some((x) => x.status !== '停用' && !lines.some((l) => l.materialKey === x.matKey))"
          class="rounded-[2px] bg-[#F7F8FA] px-3 py-4 text-center text-[11px] text-[#86909C]"
        >
          资源目录里的资源都已选用。需要新资源请到 <router-link to="/materials" class="text-[#165DFF] hover:underline" @click="pickOpen = false">资源目录</router-link> 新增。
        </div>
        <div class="text-right">
          <router-link to="/materials" class="text-[11px] text-[#165DFF] hover:underline" @click="pickOpen = false">去资源目录新增 / 维护资源 →</router-link>
        </div>
      </div>
    </CenterModal>

    <!-- 间接费用（成本中心归集） -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white">
        <div class="flex items-center justify-between border-b bg-[#F7F8FA] px-4 py-2">
          <div class="text-xs">
            <span class="font-semibold text-[#1D2129]">间接费用（成本中心归集）</span>
            <span class="ml-2 text-[#86909C]">分不清算哪单的共用账：平台运维、维保、监控等——月末由中心按分法切分到订单</span>
          </div>
          <router-link to="/cost-centers" class="text-[11px] text-[#165DFF] hover:underline">管理成本中心 →</router-link>
        </div>
        <div class="divide-y">
          <label
            v-for="c in centerDefs"
            :key="c.code"
            class="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-[#F7F8FA]"
          >
            <input v-model="checkedCenters" type="checkbox" :value="c.code" class="accent-[#165DFF]" />
            <span class="font-medium text-[#1D2129]">{{ c.name }}</span>
            <span class="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{{ c.settleRule ?? '—' }}</span>
            <span class="ml-auto text-[11px] text-[#86909C]">{{ c.settleType }}</span>
          </label>
          <div v-if="!centerDefs.length" class="px-4 py-6 text-center text-[11px] text-[#86909C]">暂无成本中心</div>
        </div>
      </div>

      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        推导链：组成资源 → 条目的「适用资源」→ 直接成本自动进入核算单，无需逐个勾条目，也不会选出不一致的组合；被剔除的条目仅对本产品不生效。
        存量合同绑定签订时的清单版本，修改不影响已签合同。
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { http } from '../../api/request'
import { productTypeList, saveTypeMaterials, typeMaterials } from '../../api/prd'
import type { TypeMaterial } from '../../api/prd'
import { materialList } from '../../api/material'
import type { Material } from '../../api/material'
import { costItemList } from '../../api/prd'
import type { CostItem, ProductType } from '../../api/types'

interface Center { id: number; code: string; name: string; settleType: string; settleRule?: string }
interface HistRow { ver: number; at: string; by: string }
type TypeX = ProductType & {
  cat?: string; asmVersion?: number; asmHistoryJson?: string
  centersJson?: string; directOffJson?: string
}

const FORM_STYLE: Record<string, string> = {
  实物: 'bg-[#FFF3E8] text-[#FF7D00]',
  服务化资源: 'bg-[#E8F3FF] text-[#165DFF]',
  人工服务: 'bg-[#F2F3F5] text-[#4E5969]',
}

const types = ref<ProductType[]>([])
const materialDefs = ref<Material[]>([])
const centerDefs = ref<Center[]>([])
const costItems = ref<CostItem[]>([])
const matsByType = ref<Record<number, TypeMaterial[]>>({})
const kw = ref('')

const current = ref<ProductType | null>(null)
const lines = ref<{ materialKey: string }[]>([])
const checkedCenters = ref<string[]>([])
const offKeys = ref<string[]>([])
const original = ref('')
const pickOpen = ref(false)
const historyOpen = ref(false)

const filteredTypes = computed(() =>
  types.value.filter((t) => !kw.value || t.name.includes(kw.value) || catOf(t).includes(kw.value)))

const dirty = computed(() => current.value != null && snapshot() !== original.value)

function catOf(t: ProductType | null) {
  return (t as TypeX | null)?.cat ?? '未分类'
}

function asmVersion(t: ProductType | null) {
  return (t as TypeX | null)?.asmVersion ?? 1
}

function historyOf(t: ProductType | null): HistRow[] {
  try {
    return JSON.parse((t as TypeX | null)?.asmHistoryJson ?? '[]')
  } catch {
    return []
  }
}

function centersOf(t: ProductType | null): string[] {
  try {
    return JSON.parse((t as TypeX | null)?.centersJson ?? '[]')
  } catch {
    return []
  }
}

function offOf(t: ProductType | null): string[] {
  try {
    return JSON.parse((t as TypeX | null)?.directOffJson ?? '[]')
  } catch {
    return []
  }
}

function matsOf(id: number) {
  return matsByType.value[id] ?? []
}

function activeItems() {
  return costItems.value.filter((i) => i.status !== '停用')
}

function billCount(t: ProductType) {
  const keys = new Set(matsOf(t.id).map((m) => m.materialKey))
  const direct = activeItems().filter((i) => i.appliesTo && keys.has(i.appliesTo) && !offOf(t).includes(i.itemKey)).length
  return direct + centersOf(t).length
}

function problems(t: ProductType): string[] {
  const out: string[] = []
  if (!matsOf(t.id).length) out.push('还没配置产品组成')
  return out
}

function matOf(key: string) {
  return materialDefs.value.find((m) => m.matKey === key)
}

function matName(key: string) {
  return matOf(key)?.name ?? key
}

function rCode(key: string) {
  return matOf(key)?.archiveKey ?? ''
}

function itemsOfResource(key: string) {
  return activeItems().filter((i) => i.appliesTo === key)
}

function isOff(key: string) {
  return offKeys.value.includes(key)
}

function toggleOff(key: string) {
  offKeys.value = isOff(key) ? offKeys.value.filter((k) => k !== key) : [...offKeys.value, key]
}

function pickResource(matKey: string) {
  lines.value.push({ materialKey: matKey })
  pickOpen.value = false
}

function snapshot() {
  return JSON.stringify({
    m: lines.value.filter((l) => l.materialKey).map((l) => l.materialKey),
    c: [...checkedCenters.value].sort(),
    o: [...offKeys.value].sort(),
  })
}

async function pick(t: ProductType) {
  current.value = t
  historyOpen.value = false
  const mats = await typeMaterials(t.id)
  lines.value = mats.map((m: TypeMaterial) => ({ materialKey: m.materialKey }))
  checkedCenters.value = centersOf(t)
  offKeys.value = offOf(t)
  original.value = snapshot()
}

async function save() {
  if (!current.value) return
  const t = current.value as TypeX
  const materials = lines.value
    .filter((l) => l.materialKey)
    .map((l) => ({ materialKey: l.materialKey, qty: 1 }))
  await saveTypeMaterials(t.id, {
    cat: t.cat, name: t.name, status: t.status,
    materials,
    centersJson: JSON.stringify(checkedCenters.value),
    directOffJson: JSON.stringify(offKeys.value),
  } as Parameters<typeof saveTypeMaterials>[1])
  Message.success('清单已保存（版本 +1）')
  await reload()
  const again = types.value.find((x) => x.id === t.id)
  if (again) await pick(again)
}

async function reload() {
  types.value = await productTypeList()
  const entries = await Promise.all(types.value.map(async (t) => [t.id, await typeMaterials(t.id)] as const))
  matsByType.value = Object.fromEntries(entries)
}

onMounted(async () => {
  await reload()
  materialDefs.value = await materialList()
  costItems.value = await costItemList()
  centerDefs.value = await http.get<Center[]>('/cost-centers')
})
</script>
