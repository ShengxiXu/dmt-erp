<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">特批申请</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in [['mine', '我的申请'], ['todo', `待我审批（${todoCount}）`]] as const"
            :key="t[0]"
            class="rounded-[2px] px-3 py-1 text-xs"
            :class="tab === t[0] ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t[0]; load()"
          >{{ t[1] }}</button>
        </div>
        <UiInput v-model="kw" class="w-56" placeholder="搜索单号 / 客户 / 商机" @keydown.enter="load" />
      </div>
      <UiButton size="sm" @click="creating = true">＋ 发起特批申请</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">特批单号</th><th class="px-3 py-2">客户 / 商机</th><th class="px-3 py-2">折扣率</th>
            <th class="px-3 py-2">特殊条款摘要</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">申请人 / 时间</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in shown" :key="s.id" class="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" @click="sel = s">
            <td class="px-3 py-3 font-mono text-[#165DFF]">{{ s.code }}</td>
            <td class="px-3 py-3">
              <div class="font-medium text-[#1D2129]">{{ s.customerName }}</div>
              <div class="mt-0.5 text-[10px] text-[#86909C]">{{ s.opportunityName ?? s.opportunityId }}</div>
            </td>
            <td class="px-3 py-3 font-mono text-[#FF7D00]">{{ s.discount }}</td>
            <td class="max-w-[280px] truncate px-3 py-3 text-[#4E5969]" :title="s.reason">{{ s.reason ?? '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STATUS_CLS[s.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ s.status }}</span></td>
            <td class="px-3 py-3 text-[#86909C]">{{ (s.createdAt ?? '').slice(0, 10) }}</td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">{{ s.status === '审批中' ? '去审批' : '查看' }}</button>
            </td>
          </tr>
          <tr v-if="!shown.length">
            <td colspan="7" class="px-3 py-10 text-center text-[#86909C]">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      要点：折扣与特殊条款在特批层一次性审定，特批必须挂在具体<strong>商机</strong>上（客户 → 商机 → 特批 → 合同）；同商机在途特批唯一（应用预检 + 数据库唯一索引兜底）；合同起草时引用已通过特批单并校验折扣一致。
      <router-link to="/opportunity" class="ml-1 text-[#165DFF] hover:underline">去商机管理 →</router-link>
    </div>

    <!-- 详情 -->
    <CenterModal :model-value="!!sel" :title="sel?.code ?? ''" :sub="sel ? `${sel.customerName ?? ''} · ${sel.opportunityName ?? ''} · 折扣 ${sel.discount}` : ''" :width="560" @update:model-value="sel = null">
      <template v-if="sel">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-[4px] border border-[#E5E6EB] p-3">
              <div class="text-[#86909C]">申请折扣率</div>
              <div class="mt-0.5 font-mono text-lg font-semibold text-[#FF7D00]">{{ sel.discount }}</div>
            </div>
            <div class="rounded-[4px] border border-[#E5E6EB] p-3">
              <div class="text-[#86909C]">当前状态</div>
              <div class="mt-1"><span class="rounded-[2px] px-2 py-0.5 text-[11px]" :class="STATUS_CLS[sel.status]">{{ sel.status }}</span></div>
            </div>
          </div>
          <div class="rounded-[4px] border border-[#E5E6EB] p-3 text-xs leading-5">
            <div class="mb-1 font-semibold text-[#4E5969]">变更说明（申请原因）</div>
            <div class="text-[#1D2129]">{{ sel.reason ?? '—' }}</div>
          </div>
          <div>
            <div class="mb-2 text-xs font-semibold text-[#4E5969]">审批进度（页面默认三级模板 · 可在「审批流配置」挂接「特批申请单 · 提交」自定义，M3 接入）</div>
            <div class="space-y-2">
              <div
                v-for="(lv, i) in ['业务支撑部', '财务', '管理层']"
                :key="lv"
                class="rounded-[4px] border p-3 text-xs"
                :class="stepCls(i)"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-[#1D2129]">第{{ ['一', '二', '三'][i] }}级 · {{ lv }}</span>
                  <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="stepBadgeCls(i)">{{ stepText(i) }}</span>
                </div>
                <div class="mt-1 text-[#86909C]">审批动作经审批引擎写回（M3 接入后按配置流实例化）</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </CenterModal>

    <!-- 发起 -->
    <CenterModal :model-value="creating" title="发起特批申请" :width="520" @update:model-value="creating = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">关联客户</div>
          <select v-model="form.customerId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm" @change="form.opportunityId = undefined">
            <option :value="undefined">选择客户</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">商机 <span class="text-[#F53F3F]">*</span><span v-if="!form.customerId" class="text-[#86909C]">（请先选择客户）</span></div>
          <select v-model="form.opportunityId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F7F8FA]" :disabled="!form.customerId">
            <option :value="undefined">{{ form.customerId ? '选择该客户下的商机' : '—' }}</option>
            <option v-for="o in dealOptions" :key="o.id" :value="o.id" :disabled="!!blockReason(o.id)">
              {{ o.name }} · 预计 {{ (o.expectAmount ?? 0).toLocaleString('zh-CN') }} 元（{{ o.stage }}{{ blockReason(o.id) ? ` · ${blockReason(o.id)}，不可再发起` : '' }}）
            </option>
          </select>
          <div v-if="form.customerId && !dealOptions.length" class="mt-1 text-[10px] leading-4 text-[#FF7D00]">该客户暂无商机，请先到商机管理创建后再发起特批</div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">折扣率（如 0.95 = 95 折；0 表示无折扣）</div>
          <UiInput v-model="form.discount" type="number" placeholder="如 0.95" />
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">变更说明（申请原因）</div>
          <textarea v-model="form.reason" class="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows="3" placeholder="非标条款与申请原因" />
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="creating = false">取消</UiButton>
          <UiButton size="sm" @click="submitNew">提交（进入审批）</UiButton>
        </div>
        <div class="rounded-[4px] bg-[#FFF7E8] px-2 py-1.5 text-[10px] leading-4 text-[#FF7D00]">
          尚未配置特批审批流：提交后按页面默认三级模板流转（业务支撑部 → 财务 → 管理层）；管理员可在「审批流配置」挂接动作「特批申请单 · 提交」自定义审批链（M3）。
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { contractPage, createSpecial, customerPage, opportunityPage, specialPage } from '../../api/mdm'
import type { Special } from '../../api/mdm'
import type { Contract, Customer, Opportunity } from '../../api/types'

const STATUS_CLS: Record<string, string> = {
  审批中: 'bg-[#FFF3E8] text-[#FF7D00]',
  已通过: 'bg-[#E8F8F2] text-[#00B42A]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
}

const tab = ref<'mine' | 'todo'>('mine')
const kw = ref('')
const list = ref<Special[]>([])
const allOpps = ref<Opportunity[]>([])
const allContracts = ref<Contract[]>([])
const customers = ref<Customer[]>([])
const sel = ref<Special | null>(null)
const creating = ref(false)
const form = reactive<{ customerId?: number; opportunityId?: number; discount: string; reason: string }>({
  customerId: undefined, opportunityId: undefined, discount: '', reason: '',
})

const shown = computed(() =>
  list.value.filter((s) => !kw.value || s.code.includes(kw.value) || (s.customerName ?? '').includes(kw.value) || (s.opportunityName ?? '').includes(kw.value)),
)

const todoCount = computed(() => list.value.filter((s) => s.status === '审批中').length)

const dealOptions = computed(() => (form.customerId ? allOpps.value.filter((o) => o.customerId === form.customerId) : []))

function blockReason(oppId: number) {
  const sp = list.value.find((s) => s.opportunityId === oppId && s.status === '审批中')
  if (sp) return `在途特批 ${sp.code}`
  const ct = allContracts.value.find((c) => c.opportunityId === oppId && ['审批中', '待出合同', '待用章', '签署中', '待修订'].includes(c.status))
  if (ct) return `已关联合同 ${ct.code}（${ct.status}）`
  return ''
}

// 三级模板展示：审批中 → 全部「待审批」徽标按当前状态推导（引擎未接入前的页面默认模板口径）
function stepCls(i: number) {
  if (sel.value?.status === '已驳回') return i === 0 ? 'border-[#F53F3F]' : 'border-dashed border-[#E5E6EB] opacity-60'
  if (sel.value?.status === '已通过') return 'border-[#E5E6EB]'
  return 'border-dashed border-[#E5E6EB] opacity-70'
}
function stepBadgeCls(i: number) {
  if (sel.value?.status === '已通过') return 'bg-[#E8F8F2] text-[#00B42A]'
  if (sel.value?.status === '已驳回' && i === 0) return 'bg-[#FFECE8] text-[#F53F3F]'
  return 'bg-[#F2F3F5] text-[#86909C]'
}
function stepText(i: number) {
  if (sel.value?.status === '已通过') return '通过'
  if (sel.value?.status === '已驳回') return i === 0 ? '驳回' : '未开始'
  return '待审批（引擎 M3）'
}

async function load() {
  list.value = (await specialPage({ pageNum: 1, pageSize: 100 })).records
}

async function submitNew() {
  if (!form.customerId || !form.opportunityId) return
  const dup = list.value.find((s) => s.opportunityId === form.opportunityId && s.status === '审批中')
  if (dup) return
  await createSpecial({
    opportunityId: form.opportunityId,
    customerId: form.customerId,
    discount: Number(form.discount) || 0,
    reason: form.reason || undefined,
  })
  creating.value = false
  form.opportunityId = undefined
  form.discount = ''
  form.reason = ''
  load()
}

onMounted(async () => {
  await Promise.all([
    load(),
    customerPage({ pageNum: 1, pageSize: 100 }).then((d) => (customers.value = d.records)),
    opportunityPage({ pageNum: 1, pageSize: 200 }).then((d) => (allOpps.value = d.records)),
    contractPage({ pageNum: 1, pageSize: 200 }).then((d) => (allContracts.value = d.records)),
  ])
})
</script>
