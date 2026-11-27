<template>
  <main class="mx-auto max-w-4xl space-y-4 p-6">
    <div class="rounded-[4px] border border-[#E5E6EB] bg-[#FFF7E8] px-4 py-2.5 text-[11px] leading-5 text-[#B25E00]">
      流程说明：合同由<strong>销售发起</strong>（本页填写）→ 合同申请审批 → 通过转「待出合同」，业务支撑部出具正式合同并上传 → 签署 → 生效。
    </div>

    <!-- 步骤条 -->
    <div class="flex items-center rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
      <template v-for="(s, i) in STEPS" :key="s">
        <div class="flex flex-1 items-center last:flex-none">
          <button class="flex items-center gap-2 text-sm" :class="i === step ? 'font-semibold text-[#165DFF]' : i < step ? 'text-[#00B42A]' : 'text-[#C9CDD4]'" @click="i < step && (step = i)">
            <span class="flex h-5 w-5 items-center justify-center rounded-full text-[11px]" :class="i === step ? 'bg-[#165DFF] text-white' : i < step ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5]'">{{ i < step ? '✓' : i + 1 }}</span>
            {{ s }}
          </button>
          <div v-if="i < STEPS.length - 1" class="mx-3 h-px flex-1" :class="i < step ? 'bg-[#00B42A]' : 'bg-[#E5E6EB]'" />
        </div>
      </template>
    </div>

    <!-- ① 合同要素 -->
    <div v-if="step === 0" class="space-y-4 rounded-[4px] border border-[#E5E6EB] bg-white p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <div class="mb-0.5 truncate text-xs text-[#4E5969]">关联客户 <span class="text-[#F53F3F]">*</span></div>
          <CustomerSelect v-model="base.customerId" :customers="customers" />
        </div>
        <div>
          <div class="mb-0.5 truncate text-xs text-[#4E5969]">关联商机 <span class="text-[#F53F3F]">*</span></div>
          <select
            v-model="base.opportunityId"
            class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F7F8FA]"
            :disabled="!base.customerId || !!base.specialId"
            @change="applyDeal(Number(($event.target as HTMLSelectElement).value))"
          >
            <option :value="undefined">{{ base.customerId ? (oppsOfCust.length ? '选择该客户名下的商机' : '该客户暂无可签商机') : '请先选择客户' }}</option>
            <option v-for="o in oppsOfCust" :key="o.id" :value="o.id" :disabled="!!contractBlock(o.id)">
              {{ o.code }} · {{ o.name }} · {{ o.stage }}{{ contractBlock(o.id) ? ' · 已有在途合同' : '' }}
            </option>
          </select>
          <div class="mt-0.5 truncate text-[10px] text-[#C9CDD4]">选定商机后按意向产品自动预填订单行</div>
          <div v-if="base.opportunityId && contractBlock(base.opportunityId)" class="mt-1 rounded-[2px] border border-[#FFE1B3] bg-[#FFF7E8] px-2 py-1 text-[10px] leading-4 text-[#B25E00]">
            ⚠ 该商机已关联在途合同，不允许重复签约
          </div>
        </div>
        <div>
          <div class="mb-0.5 truncate text-xs text-[#4E5969]">关联特批单</div>
          <select v-model="base.specialId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F7F8FA]" :disabled="!base.opportunityId" @change="pickSpecial">
            <option :value="undefined">{{ base.opportunityId ? '无偏离 · 标准合同' : '请先选择商机' }}</option>
            <option v-for="s in approvedSpecials" :key="s.id" :value="s.id">{{ s.code }} · 折扣 {{ s.discount }}{{ approvedSpecials.length === 1 ? '（自动锁定）' : '' }}</option>
          </select>
          <div v-if="base.opportunityId && !approvedSpecials.length" class="mt-0.5 truncate text-[10px] text-[#86909C]">该商机暂无已通过特批单；非标条款请先到特批申请发起</div>
        </div>
        <div>
          <div class="mb-0.5 truncate text-xs text-[#4E5969]">
            折扣率（%）<span class="text-[#F53F3F]">*</span>
            <span v-if="base.specialId" class="ml-1 text-[10px] text-[#165DFF]">（特批单锁定，不可改）</span>
          </div>
          <UiInput v-model="base.discount" type="number" :disabled="!!base.specialId" />
        </div>
        <div>
          <div class="mb-0.5 truncate text-xs text-[#4E5969]">签约主体 <span class="text-[#F53F3F]">*</span></div>
          <select v-model="base.entityId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option v-for="e in entities.filter((x) => x.status === '启用')" :key="e.id" :value="e.id">{{ e.shortName }} · {{ e.fullName }}</option>
          </select>
          <div class="mt-0.5 truncate text-[10px] text-[#C9CDD4]">抬头 / 用印 / 销方税号 / 收款账户由主体决定</div>
        </div>
        <div>
          <div class="mb-0.5 truncate text-xs text-[#4E5969]">用章方式 <span class="text-[#F53F3F]">*</span></div>
          <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
            <button
              v-for="s in [['online', '线上 · 契约锁'], ['offline', '线下 · 实物章']] as const"
              :key="s[0]"
              class="flex-1 rounded-[2px] px-2 py-1.5 text-xs"
              :class="base.seal === s[0] ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
              @click="base.seal = s[0]"
            >{{ s[1] }}</button>
          </div>
        </div>
        <div>
          <div class="mb-0.5 truncate text-xs text-[#4E5969]">付款方式 <span class="text-[#F53F3F]">*</span></div>
          <select v-model="base.payCycle" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option v-for="p in ['月付', '季度付', '半年付', '年付']" :key="p">{{ p }}</option>
          </select>
        </div>
        <div class="flex gap-2">
          <div class="flex-1">
            <div class="mb-0.5 truncate text-xs text-[#4E5969]">合同起始 <span class="text-[#F53F3F]">*</span></div>
            <input v-model="base.startDate" type="date" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] px-2 text-sm" />
          </div>
          <div class="flex-1">
            <div class="mb-0.5 truncate text-xs text-[#4E5969]">合同截止 <span class="text-[#F53F3F]">*</span></div>
            <input v-model="base.endDate" type="date" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] px-2 text-sm" />
          </div>
        </div>
      </div>
      <div>
        <div class="mb-0.5 truncate text-xs text-[#4E5969]">
          特殊条款
          <span v-if="base.specialId" class="ml-1 text-[10px] text-[#165DFF]">（随特批单带出）</span>
        </div>
        <textarea v-model="base.terms" class="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows="2" :disabled="!!base.specialId" placeholder="标准合同可为空" />
      </div>
      <div v-if="discountErr" class="rounded-[2px] border border-[#F53F3F] bg-[#FFECE8] px-3 py-2 text-xs text-[#B3261E]">⚠ 折扣校验：{{ discountErr }}</div>
      <div v-else-if="Number(base.discount) > 0" class="rounded-[2px] border border-[#00B42A] bg-[#E8F8F2] px-3 py-2 text-xs text-[#00701A]">✓ 折扣校验通过：与特批单 {{ specialCode }} 一致（{{ base.discount }}）</div>
      <div class="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
        <span v-if="!canNext1" class="text-[11px] text-[#86909C]">带 * 字段均为必填；折扣大于 0 时必须关联已通过特批</span>
        <span v-else />
        <div class="flex gap-2">
          <UiButton variant="outline" @click="router.push('/contract')">取消</UiButton>
          <UiButton :disabled="!canNext1" @click="step = 1">下一步：填写订单行</UiButton>
        </div>
      </div>
    </div>

    <!-- ② 订单行：规格来自产品定义，不可自由输入 -->
    <div v-else-if="step === 1" class="space-y-3 rounded-[4px] border border-[#E5E6EB] bg-white p-5">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-[#1D2129]">订单行（合同生效即订单生效，本表数据直接进入成本核算）</span>
        <UiButton size="sm" variant="outline" @click="lines.push(emptyLine())">＋ 增行</UiButton>
      </div>
      <div v-for="(l, i) in lines" :key="i" class="space-y-3 rounded-[4px] border border-[#E5E6EB] p-4">
        <div class="flex items-center justify-between">
          <span class="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] font-medium text-[#4E5969]">订单行 {{ i + 1 }}</span>
          <button class="text-[11px] text-[#86909C] hover:text-[#F53F3F] disabled:opacity-30" :disabled="lines.length === 1" @click="lines.splice(i, 1)">删除此行</button>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-[11px] text-[#4E5969]">产品类别 <span class="text-[#F53F3F]">*</span></div>
            <select
              v-model="l.cat"
              class="h-8 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs"
              @change="l.ptype = typesOf(l.cat)[0] ?? ''; l.planId = ''; l.specs = {}"
            >
              <option v-for="c in cats" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-[11px] text-[#4E5969]">产品类型 <span class="text-[#F53F3F]">*</span></div>
            <select
              v-model="l.ptype"
              class="h-8 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs"
              @change="l.planId = ''; l.specs = {}"
            >
              <option v-for="t in typesOf(l.cat)" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 truncate text-[11px] text-[#4E5969]">套餐<span class="ml-1 text-[10px] text-[#86909C]">（选了自动带出规格和价）</span></div>
            <select v-model="l.planId" class="h-8 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs" @change="applyPlan(l)">
              <option value="">自由组合（不选套餐）</option>
              <option v-for="p in plansOf(l.cat, l.ptype)" :key="p.id" :value="p.id">{{ p.name }}{{ p.price ? ` · ${Number(p.price).toLocaleString('zh-CN')} 元/月` : '' }}</option>
            </select>
          </div>
        </div>
        <div class="rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[11px] font-medium text-[#4E5969]">规格<span class="ml-1 font-normal text-[#86909C]">（选项来自产品定义，不可自由输入）</span></span>
            <span v-if="missingOf(l).length" class="text-[10px] text-[#F53F3F]">必填未填：{{ missingOf(l).join('、') }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div v-for="f in specFieldsOf(l.cat, l.ptype)" :key="f.key">
              <div class="mb-0.5 truncate text-[10px] text-[#86909C]">{{ f.label }}<span v-if="f.required" class="text-[#F53F3F]"> *</span></div>
              <select v-if="f.type === 'select'" v-model="l.specs[f.key]" class="h-7 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs">
                <option value="">请选择</option>
                <option v-for="o in f.options ?? []" :key="o" :value="o">{{ o }}</option>
              </select>
              <div v-else-if="f.type === 'switch'" class="flex h-7 overflow-hidden rounded-[2px] border border-[#E5E6EB]">
                <button
                  v-for="o in ['是', '否']"
                  :key="o"
                  type="button"
                  class="flex-1 text-xs transition-colors"
                  :class="l.specs[f.key] === o ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
                  @click="l.specs[f.key] = l.specs[f.key] === o ? '' : o"
                >{{ o }}</button>
              </div>
              <input
                v-else
                v-model="l.specs[f.key]"
                :type="f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'"
                class="h-7 w-full rounded-[2px] border border-[#E5E6EB] px-2 text-xs"
                :placeholder="f.placeholder ?? ''"
              />
            </div>
            <div>
              <div class="mb-0.5 text-[10px] text-[#86909C]">月租（元/月）<span class="text-[#F53F3F]">*</span></div>
              <UiInput v-model="l.priceText" type="number" />
            </div>
          </div>
          <div v-if="specText(l)" class="mt-2 border-t border-dashed border-[#E5E6EB] pt-2 font-mono text-[11px] text-[#165DFF]">规格摘要：{{ specText(l) }}</div>
        </div>
      </div>
      <div class="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
        <span class="text-sm text-[#4E5969]">
          月租合计：<span class="font-mono text-lg font-semibold text-[#1D2129]">{{ fmtMoney(amount) }}</span> 元/月
          <span v-if="Number(base.discount) > 0" class="ml-2 text-xs text-[#FF7D00]">（折扣 {{ base.discount }} 已含在报价中）</span>
        </span>
        <div class="flex gap-2">
          <UiButton variant="outline" @click="step = 0">上一步</UiButton>
          <UiButton :disabled="!linesValid" @click="step = 2">下一步：确认</UiButton>
        </div>
      </div>
    </div>

    <!-- ③ 确认并提交申请 -->
    <div v-else class="space-y-4 rounded-[4px] border border-[#E5E6EB] bg-white p-5">
      <div>
        <div class="mb-2 text-sm font-semibold text-[#1D2129]">合同申请确认单</div>
        <dl class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs md:grid-cols-3">
          <div v-for="[k, v] in summaryItems" :key="k" class="flex justify-between border-b border-dashed border-[#F2F3F5] py-1">
            <dt class="text-[#86909C]">{{ k }}</dt>
            <dd class="truncate font-medium text-[#1D2129]">{{ v }}</dd>
          </div>
        </dl>
      </div>
      <div class="overflow-x-auto rounded-[2px] border border-[#E5E6EB]">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-1.5">类别 / 产品类型</th>
              <th class="px-3 py-1.5">规格（产品基础数据）</th>
              <th class="px-3 py-1.5 text-right">月租</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in lines" :key="i" class="border-b last:border-0">
              <td class="px-3 py-1.5">
                <div class="font-medium">{{ l.ptype }}<span v-if="planName(l)" class="ml-1 rounded-[2px] bg-[#E8F3FF] px-1 text-[10px] text-[#165DFF]">{{ planName(l) }}</span></div>
                <div class="text-[10px] text-[#86909C]">{{ l.cat }}</div>
              </td>
              <td class="px-3 py-1.5 font-mono text-[#4E5969]">{{ specText(l) || '—' }}</td>
              <td class="px-3 py-1.5 text-right font-mono">{{ fmtMoney(Number(l.priceText) || 0) }}</td>
            </tr>
            <tr class="font-semibold">
              <td colspan="2" class="px-3 py-1.5 text-right">合计</td>
              <td class="px-3 py-1.5 text-right font-mono">{{ fmtMoney(amount) }} 元/月</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-[2px] bg-[#E8F3FF] px-3 py-2 text-xs leading-5 text-[#165DFF]">
        提交后合同进入<strong>合同申请审批</strong>，通过后转「待出合同」由业务支撑部出具正式合同并上传，登记「待用章」后进入签署流程。
      </div>
      <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
        <UiButton variant="outline" @click="step = 1">上一步</UiButton>
        <UiButton :disabled="submitting" @click="submit">提交合同申请</UiButton>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CustomerSelect from '../../components/CustomerSelect.vue'
import { contractPage, createContract, customerPage, entityList, opportunityPage, specialPage } from '../../api/mdm'
import type { Entity, Special } from '../../api/mdm'
import { productTypeList } from '../../api/prd'
import type { Contract, Customer, Opportunity, ProductType } from '../../api/types'

const STEPS = ['① 合同要素', '② 订单行', '③ 确认并提交申请']
const route = useRoute()
const router = useRouter()

const step = ref(0)
const submitting = ref(false)
const customers = ref<Customer[]>([])
const allOpps = ref<Opportunity[]>([])
const allContracts = ref<Contract[]>([])
const allSpecials = ref<Special[]>([])
const entities = ref<Entity[]>([])
const productTypes = ref<ProductType[]>([])

const base = reactive({
  customerId: undefined as number | undefined,
  opportunityId: undefined as number | undefined,
  specialId: undefined as number | undefined,
  discount: '0',
  entityId: undefined as number | undefined,
  seal: 'online' as 'online' | 'offline',
  payCycle: '月付',
  terms: '',
  startDate: '',
  endDate: '',
})

interface Line {
  cat: string
  ptype: string
  planId: string
  specs: Record<string, string>
  priceText: string
}
const lines = ref<Line[]>([])

function emptyLine(): Line {
  const cat = cats.value[0] ?? ''
  return { cat, ptype: typesOf(cat)[0] ?? '', planId: '', specs: {}, priceText: '' }
}

interface SpecField {
  key: string
  label: string
  type: 'select' | 'number' | 'text' | 'date' | 'switch'
  options?: string[]
  placeholder?: string
  required?: boolean
}
interface Plan {
  id: string
  name: string
  price?: number
  values: Record<string, string>
  remark?: string
}

const cats = computed(() => [...new Set(productTypes.value.map((t) => t.cat))])
function typesOf(cat: string) {
  return productTypes.value.filter((t) => t.cat === cat && t.status === '启用').map((t) => t.name)
}
function typeOf(cat: string, ptype: string): ProductType | undefined {
  return productTypes.value.find((t) => t.cat === cat && t.name === ptype)
}
function specFieldsOf(cat: string, ptype: string): SpecField[] {
  return (typeOf(cat, ptype) as any)?.specFields ?? []
}
function plansOf(cat: string, ptype: string): Plan[] {
  return (typeOf(cat, ptype) as any)?.plans ?? []
}

const oppsOfCust = computed(() => (base.customerId ? allOpps.value.filter((o) => o.customerId === base.customerId && o.stage !== '输单') : []))
const approvedSpecials = computed(() => (base.opportunityId ? allSpecials.value.filter((s) => s.opportunityId === base.opportunityId && s.status === '已通过') : []))

const IN_FLIGHT = ['审批中', '待出合同', '待用章', '签署中', '待修订']
function contractBlock(oppId?: number) {
  if (!oppId) return ''
  const c = allContracts.value.find((x) => x.opportunityId === oppId && IN_FLIGHT.includes(x.status))
  return c ? c.code : ''
}

const discountErr = computed(() => {
  const d = Number(base.discount) || 0
  if (d <= 0) return ''
  if (!base.specialId) return '折扣大于 0 必须关联特批申请'
  const sp = allSpecials.value.find((s) => s.id === base.specialId)
  if (!sp || sp.status !== '已通过') return '关联的特批申请未通过'
  if (Number(sp.discount) !== d) return '合同折扣必须与特批折扣一致'
  return ''
})
const specialCode = computed(() => allSpecials.value.find((s) => s.id === base.specialId)?.code ?? '')

/** 全部必填：客户 / 商机 / 折扣 / 主体 / 用章 / 付款 / 起止日期 */
const canNext1 = computed(() =>
  !!base.customerId && !!base.opportunityId && !!base.entityId && !!base.payCycle
  && !!base.seal && !!base.startDate && !!base.endDate && base.discount !== ''
  && !discountErr.value && !contractBlock(base.opportunityId),
)

const amount = computed(() => lines.value.reduce((s, l) => s + (Number(l.priceText) || 0), 0))
function missingOf(l: Line) {
  return specFieldsOf(l.cat, l.ptype).filter((f) => f.required && !(l.specs[f.key] ?? '').toString().trim()).map((f) => f.label)
}
const linesValid = computed(() =>
  lines.value.length > 0 && lines.value.every((l) => l.cat && l.ptype && Number(l.priceText) > 0 && missingOf(l).length === 0),
)

function specText(l: Line) {
  const parts = specFieldsOf(l.cat, l.ptype)
    .map((f) => (l.specs[f.key] ? `${f.label} ${l.specs[f.key]}` : ''))
    .filter(Boolean)
  return parts.join(' · ')
}

function planName(l: Line) {
  return plansOf(l.cat, l.ptype).find((p) => p.id === l.planId)?.name ?? ''
}

function applyPlan(l: Line) {
  const plan = plansOf(l.cat, l.ptype).find((p) => p.id === l.planId)
  if (!plan) return
  l.specs = { ...l.specs, ...plan.values }
  if (plan.price) {
    l.priceText = String(plan.price)
  }
}

function fmtMoney(n: number) {
  return n.toLocaleString('zh-CN')
}

function pickSpecial() {
  const sp = allSpecials.value.find((s) => s.id === base.specialId)
  if (sp) {
    suppressCustomerWatch = true
    base.customerId = sp.customerId
    base.opportunityId = sp.opportunityId
    base.discount = String(sp.discount)
    base.terms = sp.reason ?? ''
  } else {
    base.terms = ''
  }
}

let suppressCustomerWatch = false
watch(() => base.customerId, (nv, ov) => {
  if (suppressCustomerWatch) {
    suppressCustomerWatch = false
    return
  }
  if (nv !== ov) {
    base.opportunityId = undefined
    base.specialId = undefined
    base.discount = '0'
    base.terms = ''
  }
})

function applyDeal(dealId?: number) {
  if (dealId) {
    base.opportunityId = dealId
  }
  const sp = approvedSpecials.value.length === 1 ? approvedSpecials.value[0] : undefined
  base.specialId = sp?.id
  base.discount = sp ? String(sp.discount) : '0'
  base.terms = sp?.reason ?? ''
}

const summaryItems = computed<[string, string][]>(() => {
  const cust = customers.value.find((c) => c.id === base.customerId)
  const opp = allOpps.value.find((o) => o.id === base.opportunityId)
  const ent = entities.value.find((e) => e.id === base.entityId)
  return [
    ['客户', cust?.name ?? '—'],
    ['关联商机', opp ? `${opp.code} · ${opp.name}` : '—'],
    ['关联特批单', specialCode.value || '无（标准合同）'],
    ['折扣率', String(base.discount ?? '0')],
    ['签约主体', ent ? `${ent.shortName}（${ent.fullName}）` : '—'],
    ['销方税号', ent?.taxNo ?? '—'],
    ['用章方式', base.seal === 'online' ? '线上 · 契约锁' : '线下 · 实物章'],
    ['付款方式', base.payCycle],
    ['合同期限', `${base.startDate || '—'} ~ ${base.endDate || '—'}`],
  ]
})

async function submit() {
  if (!canNext1.value || !linesValid.value || !base.entityId) return
  submitting.value = true
  try {
    await createContract({
      customerId: base.customerId!,
      opportunityId: base.opportunityId!,
      specialId: base.specialId ?? null,
      entityId: base.entityId,
      discount: Number(base.discount) || 0,
      payCycle: base.payCycle,
      seal: base.seal,
      terms: base.terms || undefined,
      startDate: base.startDate || undefined,
      endDate: base.endDate || undefined,
      amount: amount.value,
      lines: lines.value.map((l) => ({
        cat: l.cat,
        ptype: l.ptype,
        specs: l.specs,
        price: Number(l.priceText) || 0,
      })),
    })
    router.push('/contract')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const [c, o, ct, sp, e, p] = await Promise.all([
    customerPage({ pageNum: 1, pageSize: 100 }),
    opportunityPage({ pageNum: 1, pageSize: 200 }),
    contractPage({ pageNum: 1, pageSize: 200 }),
    specialPage({ pageNum: 1, pageSize: 100 }),
    entityList(),
    productTypeList(),
  ])
  customers.value = c.records
  allOpps.value = o.records
  allContracts.value = ct.records
  allSpecials.value = sp.records
  entities.value = e
  productTypes.value = p
  base.entityId = e.find((x) => x.status === '启用')?.id ?? e[0]?.id
  lines.value = [emptyLine()]
  // 「去签约」直达：?customer=客户ID&deal=商机ID
  const qCustomer = route.query.customer ? Number(route.query.customer) : undefined
  const qDeal = route.query.deal ? Number(route.query.deal) : undefined
  if (qCustomer) {
    base.customerId = qCustomer
  }
  if (qDeal) {
    applyDeal(qDeal)
    const opp = allOpps.value.find((x) => x.id === qDeal)
    if (opp?.products?.length) {
      lines.value = opp.products.map((prod) => ({ cat: prod.cat, ptype: prod.ptype, planId: '', specs: {}, priceText: '' }))
    }
  }
})
</script>
