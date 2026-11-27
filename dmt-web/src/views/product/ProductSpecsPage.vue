<template>
  <main class="space-y-4 p-6">
    <div v-if="!type" class="rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">加载中…</div>
    <template v-else>
      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-[#1D2129]">产品规格</span>
          <span class="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{{ cat }}</span>
          <span class="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{{ type.name }}</span>
        </div>
        <div class="flex items-center gap-2">
          <UiButton size="sm" variant="outline" @click="$router.push('/product')">返回</UiButton>
          <UiButton size="sm" @click="openFieldEdit(null)">＋ 新增字段</UiButton>
        </div>
      </div>

      <!-- 字段表 -->
      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="w-14 px-3 py-2">排序</th><th class="px-3 py-2">字段名称</th><th class="px-3 py-2">类型</th>
              <th class="px-3 py-2">可选项 / 占位</th><th class="px-3 py-2">必填</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(f, i) in fields" :key="f.key" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3">
                <button class="mr-1 text-[#86909C] hover:text-[#165DFF] disabled:opacity-30" :disabled="i === 0" @click="move(i, -1)">▲</button>
                <button class="text-[#86909C] hover:text-[#165DFF] disabled:opacity-30" :disabled="i === fields.length - 1" @click="move(i, 1)">▼</button>
              </td>
              <td class="px-3 py-3">
                <span class="font-medium text-[#1D2129]">{{ f.label }}</span>
                <span class="ml-1.5 font-mono text-[10px] text-[#C9CDD4]">{{ f.key }}</span>
              </td>
              <td class="px-3 py-3 text-[#4E5969]">{{ TYPE_LABEL[f.type] ?? f.type }}</td>
              <td class="px-3 py-3 text-[#4E5969]">
                <template v-if="f.type === 'enum' || f.type === 'select'">{{ (f.options ?? []).join(' / ') || '—' }}</template>
                <template v-else>{{ f.unit ?? '—' }}</template>
              </td>
              <td class="px-3 py-3">
                <span :class="f.required ? 'text-[#F53F3F]' : 'text-[#C9CDD4]'">{{ f.required ? '必填' : '选填' }}</span>
              </td>
              <td class="px-3 py-3 text-right">
                <button class="mr-1.5 text-[11px] text-[#165DFF] hover:underline" @click="openFieldEdit(i)">编辑</button>
                <button class="text-[11px] text-[#F53F3F] hover:underline" @click="fields.splice(i, 1); save()">删除</button>
              </td>
            </tr>
            <tr v-if="!fields.length"><td colspan="6" class="px-3 py-8 text-center text-[#86909C]">尚无规格字段，点「新增字段」开始定义</td></tr>
          </tbody>
        </table>
        <div class="border-t border-[#F2F3F5] px-4 py-2 text-[11px]">
          <span class="text-[#165DFF]">规格摘要样式预览：</span>
          <span class="text-[#4E5969]">{{ summaryPreview || '（添加字段后自动生成）' }}</span>
        </div>
      </div>

      <!-- 套餐 -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white">
        <div class="flex items-center justify-between border-b bg-[#F7F8FA] px-4 py-2">
          <div class="text-xs">
            <span class="font-semibold text-[#1D2129]">套餐</span>
            <span class="ml-2 text-[#86909C]">把客户常买的几种规格搭配事先打包、每个包定个价；客户下单选套餐即带出规格，算账逻辑由资源清单决定</span>
          </div>
          <UiButton size="sm" variant="outline" @click="openPlanEdit(null)">＋ 新增套餐</UiButton>
        </div>
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b text-left text-[#4E5969]">
              <th class="px-4 py-2">套餐名</th><th class="px-3 py-2">套餐价（元/月）</th><th class="px-3 py-2">规格预设</th>
              <th class="px-3 py-2">备注</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in plans" :key="p.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-4 py-2.5 font-medium text-[#1D2129]">{{ p.name }}</td>
              <td class="px-3 py-3 font-mono">{{ p.price != null ? Number(p.price).toLocaleString('zh-CN') : '—' }}</td>
              <td class="px-3 py-3 text-[#165DFF]">{{ planValuesText(p) }}</td>
              <td class="px-3 py-3 text-[#86909C]">{{ p.remark ?? '—' }}</td>
              <td class="px-3 py-3 text-right">
                <button class="mr-1.5 text-[11px] text-[#165DFF] hover:underline" @click="openPlanEdit(i)">编辑</button>
                <button class="text-[11px] text-[#F53F3F] hover:underline" @click="plans.splice(i, 1); save()">删除</button>
              </td>
            </tr>
            <tr v-if="!plans.length"><td colspan="5" class="px-3 py-6 text-center text-[#86909C]">无套餐（订单行手工选规格）</td></tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        说明：① 字段按列表顺序拼接规格摘要，用「▲▼」调整顺序；② 已有合同 / 核算单保存的是规格文本快照，本页改版不影响历史单据；③ 算账口径的唯一出处在成本条目库：条目按约定直接读订单行规格值（字段名 / key 同名即自动对应），开通核算时无需在字段上做任何绑定配置；④ 套餐只打包「规格预设 + 价格」，不改动算账逻辑——同一套餐与散卖的成本完全一致。
      </div>
    </template>

    <!-- 字段编辑弹窗 -->
    <CenterModal :model-value="fieldEditIdx !== null" :title="fieldEditIdx === -1 ? '新增字段' : '编辑字段'" :width="480" @update:model-value="fieldEditIdx = null">
      <div v-if="fieldForm" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">字段名称 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="fieldForm.label" placeholder="如 带宽" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">字段 key <span class="text-[#F53F3F]">*</span>（英文，取数锚点）</div>
            <UiInput v-model="fieldForm.key" placeholder="如 bw" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">类型</div>
            <select v-model="fieldForm.type" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="enum">选档位（枚举）</option><option value="number">填数字</option><option value="text">填文本</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">是否必填</div>
            <select v-model="fieldForm.required" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option :value="true">必填</option><option :value="false">选填</option>
            </select>
          </div>
        </div>
        <div v-if="fieldForm.type === 'enum'">
          <div class="mb-0.5 text-xs text-[#4E5969]">可选项（顿号分隔）</div>
          <UiInput v-model="fieldForm.optionsText" placeholder="如 50M、100M、200M、500M、1G、10G" />
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">单位 / 占位</div>
          <UiInput v-model="fieldForm.unit" placeholder="如 条 / 个 / M" />
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="fieldEditIdx = null">取消</UiButton>
          <UiButton size="sm" :disabled="!fieldForm.label || !fieldForm.key" @click="saveField">保存</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 套餐编辑弹窗 -->
    <CenterModal :model-value="planEditIdx !== null" :title="planEditIdx === -1 ? '新增套餐' : '编辑套餐'" sub="只打包「规格预设 + 价格」，不改动算账逻辑" :width="520" @update:model-value="planEditIdx = null">
      <div v-if="planForm" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">套餐名 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="planForm.name" placeholder="如 标准版" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">套餐价（元/月）<span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="planForm.priceText" type="number" />
          </div>
        </div>
        <div>
          <div class="mb-1 text-xs font-semibold text-[#4E5969]">规格预设（按字段填值）</div>
          <div v-for="f in fields" :key="f.key" class="mb-1.5 flex items-center gap-2">
            <span class="w-24 shrink-0 text-xs text-[#4E5969]">{{ f.label }}</span>
            <select v-if="f.type === 'enum' || f.type === 'select'" v-model="planForm.values[f.key]" class="h-8 flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs">
              <option value="">（不预设）</option>
              <option v-for="o in f.options ?? []" :key="o" :value="o">{{ o }}</option>
            </select>
            <UiInput v-else v-model="planForm.values[f.key]" class="flex-1" :placeholder="f.unit ?? '值'" />
          </div>
          <div v-if="!fields.length" class="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#86909C]">请先添加规格字段</div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
          <UiInput v-model="planForm.remark" placeholder="如 中小客户主推" />
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="planEditIdx = null">取消</UiButton>
          <UiButton size="sm" :disabled="!planForm.name || !planForm.priceText" @click="savePlan">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { http } from '../../api/request'
import { productTypeList } from '../../api/prd'
import type { ProductType } from '../../api/types'

interface SpecField { key: string; label: string; type: string; options?: string[]; unit?: string; required?: boolean }
interface Plan { id: string; name: string; price?: number; values?: Record<string, string>; remark?: string }

const TYPE_LABEL: Record<string, string> = { enum: '选档位', select: '选档位', number: '填数字', text: '填文本' }

const route = useRoute()
const typeId = Number(route.query.typeId)
const type = ref<ProductType | null>(null)
const cat = ref('')
const fields = ref<SpecField[]>([])
const plans = ref<Plan[]>([])

const fieldEditIdx = ref<number | null>(null)
const fieldForm = ref<{ key: string; label: string; type: string; optionsText: string; unit: string; required: boolean } | null>(null)
const planEditIdx = ref<number | null>(null)
const planForm = ref<{ id: string; name: string; priceText: string; values: Record<string, string>; remark: string } | null>(null)

const summaryPreview = computed(() =>
  fields.value.map((f) => `${f.label} ${f.type === 'enum' || f.type === 'select' ? (f.options?.[0] ?? '') : (f.unit ?? '')}`).join(' · '))

function planValuesText(p: Plan) {
  if (!p.values) return '—'
  return fields.value
    .filter((f) => p.values![f.key])
    .map((f) => `${f.label} ${p.values![f.key]}`)
    .join(' · ') || '—'
}

function move(i: number, dir: number) {
  const j = i + dir
  const arr = [...fields.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  fields.value = arr
  save()
}

function openFieldEdit(idx: number | null) {
  fieldEditIdx.value = idx === null ? -1 : idx
  const f = idx !== null && idx >= 0 ? fields.value[idx] : null
  fieldForm.value = f
    ? { key: f.key, label: f.label, type: f.type, optionsText: (f.options ?? []).join('、'), unit: f.unit ?? '', required: f.required ?? false }
    : { key: '', label: '', type: 'enum', optionsText: '', unit: '', required: true }
}

async function saveField() {
  const f = fieldForm.value
  if (!f) return
  const row: SpecField = {
    key: f.key.trim(), label: f.label.trim(), type: f.type,
    options: f.type === 'enum' ? f.optionsText.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) : undefined,
    unit: f.unit || undefined, required: f.required,
  }
  if (fieldEditIdx.value === -1) {
    if (fields.value.some((x) => x.key === row.key)) {
      Message.warning(`字段 key「${row.key}」已存在`)
      return
    }
    fields.value.push(row)
  } else if (fieldEditIdx.value !== null) {
    fields.value[fieldEditIdx.value] = row
  }
  fieldEditIdx.value = null
  await save()
}

function openPlanEdit(idx: number | null) {
  planEditIdx.value = idx === null ? -1 : idx
  const p = idx !== null && idx >= 0 ? plans.value[idx] : null
  planForm.value = p
    ? { id: p.id, name: p.name, priceText: String(p.price ?? ''), values: { ...(p.values ?? {}) }, remark: p.remark ?? '' }
    : { id: `p${Date.now() % 100000}`, name: '', priceText: '', values: {}, remark: '' }
}

async function savePlan() {
  const f = planForm.value
  if (!f) return
  const values = Object.fromEntries(Object.entries(f.values).filter(([, v]) => v))
  const row: Plan = { id: f.id, name: f.name, price: Number(f.priceText), values, remark: f.remark || undefined }
  if (planEditIdx.value === -1) {
    plans.value.push(row)
  } else if (planEditIdx.value !== null) {
    plans.value[planEditIdx.value] = row
  }
  planEditIdx.value = null
  await save()
}

async function save() {
  if (!type.value) return
  await http.put(`/product-types/${typeId}`, {
    cat: cat.value, name: type.value.name, status: type.value.status,
    remark: (type.value as unknown as { remark?: string }).remark,
    sla: (type.value as unknown as { sla?: string }).sla,
    billingCycle: (type.value as unknown as { billingCycle?: string }).billingCycle,
    specFieldsJson: JSON.stringify(fields.value),
    plansJson: JSON.stringify(plans.value),
  })
  Message.success('规格已保存')
}

onMounted(async () => {
  const list = await productTypeList()
  const t = list.find((x) => x.id === typeId) ?? null
  type.value = t
  if (!t) return
  cat.value = (t as unknown as { cat?: string }).cat ?? ''
  try {
    fields.value = JSON.parse((t as unknown as { specFieldsJson?: string }).specFieldsJson ?? '[]')
  } catch { fields.value = [] }
  try {
    plans.value = JSON.parse((t as unknown as { plansJson?: string }).plansJson ?? '[]')
  } catch { plans.value = [] }
})
</script>
