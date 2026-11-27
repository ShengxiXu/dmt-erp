<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div>
        <span class="text-sm font-semibold text-[#1D2129]">成本中心</span>
        <span class="ml-2 text-[11px] text-[#86909C]">间接费用的归集与分配单元：不归属单个订单的账（平台研发运维、维保、监控、SLA 冗余等）先归集到中心，月末按所选分法切分到各订单。直接成本挂资源清单的资源随单算，不进中心</span>
      </div>
      <div class="flex items-center gap-2">
        <UiInput v-model="kw" class="w-52" placeholder="搜索编号 / 名称 / 分法" />
        <UiButton size="sm" @click="openEdit(null)">＋ 新建成本中心</UiButton>
      </div>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">中心编号</th><th class="px-3 py-2">中心名称</th>
            <th class="px-3 py-2">归集条目</th><th class="px-3 py-2">分配动因（分法）</th>
            <th class="px-3 py-2 text-right">当月归集{{ period ? `（${period}）` : '' }}</th>
            <th class="px-3 py-2 text-right">在用产品</th>
            <th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filtered" :key="c.id" class="border-b align-top last:border-0 hover:bg-[#F7F8FA]" :class="c.status === '停用' ? 'opacity-55' : ''">
            <td class="px-3 py-3 font-mono font-semibold text-[#165DFF]">{{ c.code }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ c.name }}</td>
            <td class="max-w-64 px-3 py-3">
              <div v-if="c.itemKeys?.length" class="flex flex-wrap gap-1">
                <span
                  v-for="k in c.itemKeys"
                  :key="k"
                  class="rounded-[2px] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] text-[#4E5969]"
                  :title="`${itemName(k)}：金额由本中心按分法统一算`"
                >{{ itemName(k) }}</span>
              </div>
              <span v-else class="text-[#FF7D00]">未归集条目</span>
            </td>
            <td class="max-w-52 px-3 py-3">
              <span class="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]" :title="c.formula ?? ''">{{ c.settleRule ?? '—' }}</span>
            </td>
            <td class="px-3 py-3 text-right">
              <span v-if="(c.monthTotal ?? 0) > 0" class="font-mono text-[#1D2129]" title="来自供应商账单（已入账）">
                ¥ {{ c.monthTotal!.toLocaleString('zh-CN') }}
              </span>
              <span v-else class="text-[#C9CDD4]">—</span>
            </td>
            <td class="px-3 py-3 text-right font-mono text-[#4E5969]" :title="c.usedByNames ?? ''">{{ c.usedByCount || '—' }}</td>
            <td class="px-3 py-3">
              <span v-if="c.status === '停用'" class="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">已停用</span>
              <span v-else class="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">启用</span>
            </td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(c)">编辑</button>
            </td>
          </tr>
          <tr v-if="!filtered.length"><td colspan="8" class="px-3 py-10 text-center text-[#86909C]">{{ kw ? '无匹配成本中心' : '暂无成本中心，点右上角「新建成本中心」创建' }}</td></tr>
        </tbody>
      </table>
      <div class="border-t border-[#F2F3F5] px-4 py-2 text-[11px] text-[#86909C]">
        计价路径：核算按中心月费用<strong>预估切分</strong>（报价 / 审批依据）；真实账单入账后自动归集为「当月归集」水位，月结按同一动因重算、差异留中心滚动（月结）。
      </div>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      ① 成本中心只装<strong class="text-[#4E5969]">间接费用</strong>（分不清算哪单的共用账：平台运维、维保、监控等）；直接成本随单实时算，不进中心；
      ② 产品在「资源清单」勾选用到的中心，中心归集的条目即进核算单；
      ③ 每笔记多少由中心的分法统一算，条目口径在<strong>成本条目库</strong>维护。「当月归集」= 最新账期已入账供应商账单按归集条目合计。
    </div>

    <!-- 新建 / 编辑成本中心 -->
    <CenterModal :model-value="!!editing" :title="editing?.id ? `编辑成本中心 · ${editing.name}` : '新建成本中心'" sub="间接费用在这里归集，月末按动因分配到订单" :width="520" @update:model-value="editing = null">
      <div v-if="editing" class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-[#4E5969]">中心编号</div>
            <UiInput :model-value="editing.code || '（保存后自动生成 CC-xx）'" disabled />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">中心名称 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="editing.name" placeholder="如：出口调度平台" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">结转类型</div>
            <select v-model="editing.settleType" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>间接</option><option>直接</option>
            </select>
          </div>
        </div>

        <!-- 归集的间接费用条目 -->
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">归集的间接费用条目（成本条目库中算账去向 = 间接的条目）<span class="text-[#F53F3F]"> *</span></div>
          <div class="max-h-40 space-y-1 overflow-y-auto rounded-[2px] border border-[#E5E6EB] p-2">
            <label
              v-for="i in indirectItems"
              :key="i.itemKey"
              class="flex cursor-pointer items-center gap-2 px-1 py-0.5 hover:bg-[#F7F8FA]"
              :title="i.formula"
            >
              <input
                type="checkbox"
                class="accent-[#165DFF]"
                :checked="editing.itemKeys.includes(i.itemKey)"
                :disabled="!!otherCenterOf(i.itemKey) && !editing.itemKeys.includes(i.itemKey)"
                @change="toggleItem(i.itemKey)"
              />
              <span class="text-[#1D2129]">{{ i.name }}</span>
              <span v-if="otherCenterOf(i.itemKey)" class="ml-auto shrink-0 text-[10px] text-[#C9CDD4]">已归集到「{{ otherCenterOf(i.itemKey) }}」</span>
            </label>
            <div v-if="!indirectItems.length" class="px-1 py-2 text-[11px] text-[#C9CDD4]">
              成本条目库还没有间接费用条目，请先到 <router-link class="text-[#165DFF] hover:underline" to="/cost-items">成本条目库</router-link> 新建
            </div>
          </div>
          <div class="mt-1 text-[10px] text-[#C9CDD4]">一笔间接费用只归集到一个成本中心（同制造业：制造费用科目挂成本中心）。</div>
        </div>

        <!-- 分法 -->
        <div>
          <div class="mb-1 text-xs text-[#4E5969]">这个中心的费用怎么分出去？选一种分法 <span class="text-[#F53F3F]">*</span></div>
          <div class="space-y-1.5">
            <label
              v-for="p in DRIVER_PRESETS"
              :key="p.key"
              class="flex cursor-pointer items-start gap-2 rounded-[2px] border px-2.5 py-1.5"
              :class="editing.driverKey === p.key ? 'border-[#165DFF] bg-[#F7FBFF]' : 'border-[#E5E6EB] hover:bg-[#F7F8FA]'"
            >
              <input type="radio" name="driverKey" class="mt-1 accent-[#165DFF]" :checked="editing.driverKey === p.key" @change="pickDriver(p)" />
              <span class="leading-5">
                <span class="font-medium text-[#1D2129]">{{ p.name }}</span>
                <span class="ml-2 text-[#86909C]">{{ p.desc }}</span>
              </span>
            </label>
            <label
              class="flex cursor-pointer items-center gap-2 rounded-[2px] border px-2.5 py-1.5"
              :class="!editing.driverKey ? 'border-[#165DFF] bg-[#F7FBFF]' : 'border-[#E5E6EB] hover:bg-[#F7F8FA]'"
            >
              <input type="radio" name="driverKey" class="accent-[#165DFF]" :checked="!editing.driverKey" @change="editing.driverKey = ''" />
              <span class="text-[#1D2129]">以上都不是，我自己写</span>
            </label>
          </div>
        </div>
        <div v-if="editing.driverKey" class="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] leading-5 text-[#86909C]">
          算式（按所选分法自动生成，不用手填）：<span class="font-medium text-[#1D2129]">{{ activePreset?.gen(editing.name || '本中心') }}</span>
          <div class="mt-0.5">算个例子看看：{{ activePreset?.example }}</div>
        </div>
        <div v-else class="space-y-2">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">分法名称 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="editing.settleRule" placeholder="如：按机柜数分" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">算式（用大白话写：中心当月费用 怎么乘除 本单的什么）<span class="text-[#F53F3F]"> *</span></div>
            <UiInput v-model="editing.formula" placeholder="如：中心当月费用 × 本单机柜数 ÷ 总机柜数" />
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          <button v-if="editing.id" class="text-[11px] text-[#F53F3F] hover:underline" @click="toggleStatus">
            {{ editing.status === '停用' ? '重新启用' : '停用该中心' }}
          </button>
          <span v-else />
          <span class="flex gap-2">
            <UiButton variant="outline" size="sm" @click="editing = null">取消</UiButton>
            <UiButton size="sm" :disabled="!canSave" @click="doSave">保存中心</UiButton>
          </span>
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
import { http } from '../../api/request'

interface Center {
  id: number; code: string; name: string; settleType: string; settleRule?: string
  driverKey?: string; formula?: string; status?: string
  itemCount?: number; itemNames?: string; itemKeys?: string[]
  monthTotal?: number; monthPeriod?: string
  usedByCount?: number; usedByNames?: string
}
interface IndirectItem { itemKey: string; name: string; formula?: string; costCenter?: string }
interface EditForm {
  id?: number; code: string; name: string; settleType: string
  driverKey: string; settleRule: string; formula: string
  itemKeys: string[]; status: string
  usedByCount?: number; usedByNames?: string
}

/** 分法预设（与原型 DRIVER_PRESETS 一致：选一种，算式由中心名自动生成，带数字算例） */
const DRIVER_PRESETS = [
  {
    key: 'bw', name: '按带宽占比分', desc: '谁的订单带宽大，谁多承担。适合出口、调度平台这类和带宽强相关的费用',
    gen: (c: string) => `${c}当月费用 × 本单带宽 ÷ ${c}当月总售出带宽`,
    example: '中心 9 月费用 12,500 元、当月总售出带宽 1,600M；某客户一单带宽 100M → 这一单摊 12,500 × 100 ÷ 1,600 ≈ 781 元/月',
  },
  {
    key: 'eq', name: '按客户数平均分', desc: '每家用得一样多：当月费用除以当月服务的客户数',
    gen: (c: string) => `${c}当月费用 ÷ 当月服务客户数`,
    example: '中心 9 月费用 8,000 元、当月服务 20 家客户 → 每家摊 8,000 ÷ 20 = 400 元/月',
  },
  {
    key: 'node', name: '按节点数分', desc: '谁占用的节点多，谁多承担。适合云节点、监控点位这类按点位计的费用',
    gen: (c: string) => `${c}当月费用 × 本单占用节点数 ÷ 当月节点总数`,
    example: '中心 9 月费用 6,000 元、当月节点总数 30 个；一单占用 3 个 → 摊 6,000 × 3 ÷ 30 = 600 元/月',
  },
  {
    key: 'cap', name: '按容量占比分', desc: '按占用容量的比例分配。适合端口、机柜位、冗余容量这类有容量概念的费用',
    gen: (c: string) => `${c}当月费用 × 本单占用容量 ÷ 总容量（已单独采购的计 0）`,
    example: '中心 9 月费用 5,000 元、总容量 100G；一单占用 10G → 摊 5,000 × 10 ÷ 100 = 500 元/月',
  },
] as const

const rows = ref<Center[]>([])
const indirectItems = ref<IndirectItem[]>([])
const kw = ref('')
const editing = ref<EditForm | null>(null)

const filtered = computed(() => rows.value.filter((c) =>
  !kw.value || c.code.includes(kw.value) || c.name.includes(kw.value) || (c.settleRule ?? '').includes(kw.value)))

const period = computed(() => rows.value.find((c) => c.monthPeriod)?.monthPeriod ?? '')
const activePreset = computed(() => DRIVER_PRESETS.find((p) => p.key === editing.value?.driverKey))

const canSave = computed(() => {
  const e = editing.value
  if (!e || !e.name.trim()) return false
  if (e.driverKey) return true
  return !!e.settleRule.trim() && !!e.formula.trim()
})

function itemName(key: string) {
  return indirectItems.value.find((i) => i.itemKey === key)?.name ?? key
}

/** 该条目已归集到其他哪个中心（一笔间接费用只归集一个中心） */
function otherCenterOf(itemKey: string): string {
  const e = editing.value
  const c = rows.value.find((x) => x.itemKeys?.includes(itemKey) && x.id !== e?.id)
  return c?.name ?? ''
}

async function load() {
  rows.value = await http.get<Center[]>('/cost-centers')
}

async function loadIndirect() {
  const items = await http.get<IndirectItem[]>('/cost-items')
  indirectItems.value = items.filter((i) => (i as unknown as { settleType?: string }).settleType === '间接')
}

function openEdit(c: Center | null) {
  editing.value = c
    ? {
        id: c.id, code: c.code, name: c.name, settleType: c.settleType ?? '间接',
        driverKey: c.driverKey ?? '', settleRule: c.settleRule ?? '', formula: c.formula ?? '',
        itemKeys: [...(c.itemKeys ?? [])], status: c.status ?? '启用',
        usedByCount: c.usedByCount, usedByNames: c.usedByNames,
      }
    : { code: '', name: '', settleType: '间接', driverKey: 'bw', settleRule: '按带宽占比分', formula: '', itemKeys: [], status: '启用' }
}

function pickDriver(p: (typeof DRIVER_PRESETS)[number]) {
  const e = editing.value
  if (!e) return
  e.driverKey = p.key
  e.settleRule = p.name
  e.formula = p.gen(e.name || '本中心')
}

function toggleItem(key: string) {
  const e = editing.value
  if (!e) return
  const i = e.itemKeys.indexOf(key)
  if (i >= 0) {
    e.itemKeys.splice(i, 1)
  } else {
    e.itemKeys.push(key)
  }
}

async function doSave() {
  const e = editing.value
  if (!e) return
  const preset = DRIVER_PRESETS.find((p) => p.key === e.driverKey)
  const body: Record<string, unknown> = {
    name: e.name.trim(), settleType: e.settleType,
    settleRule: preset ? preset.name : e.settleRule.trim(),
    driverKey: e.driverKey || undefined,
    formula: preset ? preset.gen(e.name.trim()) : e.formula.trim(),
    itemKeys: e.itemKeys, status: e.status,
  }
  if (e.id) {
    body.code = e.code
    await http.put(`/cost-centers/${e.id}`, body)
  } else {
    await http.post('/cost-centers', body)
  }
  Message.success('成本中心已保存')
  editing.value = null
  load()
}

/** 停用 / 启用：被产品使用时先确认（停用后新核算单不再分配，历史已分配不受影响） */
async function toggleStatus() {
  const e = editing.value
  if (!e?.id) return
  const next = e.status === '停用' ? '启用' : '停用'
  if (next === '停用' && (e.usedByCount ?? 0) > 0) {
    const ok = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '停用成本中心',
        content: `该成本中心正被 ${e.usedByCount} 个产品使用（${e.usedByNames}），停用后新的核算单不再分配这里的费用（历史已分配不受影响）。确定停用？`,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
    if (!ok) return
  }
  await http.put(`/cost-centers/${e.id}`, {
    code: e.code, name: e.name, settleType: e.settleType,
    settleRule: e.settleRule, driverKey: e.driverKey || undefined, formula: e.formula,
    status: next,
  })
  Message.success(next === '停用' ? '已停用' : '已重新启用')
  editing.value = null
  load()
}

onMounted(() => {
  load()
  loadIndirect()
})
</script>
