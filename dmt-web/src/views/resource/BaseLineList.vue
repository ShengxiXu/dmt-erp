<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">R2 基础线路</span>
        <UiInput v-model="kw" class="w-52" placeholder="搜索编码 / 名称" @keydown.enter="load" />
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '生效', '草稿', '停用']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load()"
          >{{ t }}</button>
        </div>
      </div>
      <UiButton size="sm" @click="openCreate">＋ 新建线路</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">编码</th><th class="px-3 py-2">线路名称</th><th class="px-3 py-2">运营商</th>
            <th class="px-3 py-2 text-right">带宽</th><th class="px-3 py-2">计费方式</th><th class="px-3 py-2 text-right">价格</th>
            <th class="px-3 py-2">采购合同</th><th class="px-3 py-2">可共用</th><th class="px-3 py-2">生效</th>
            <th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in rows" :key="l.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#86909C]">{{ l.code }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ l.name }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ l.carrier ?? '—' }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ l.bwM != null ? `${l.bwM.toLocaleString('zh-CN')}M` : '—' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ l.billing ?? '—' }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ l.price != null ? `${l.price.toLocaleString('zh-CN')}${l.billing === '一次性买断' ? '' : '/月'}` : '—' }}</td>
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ l.contractNo ?? '—' }}</td>
            <td class="px-3 py-3">
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="l.shareable === '是' ? 'bg-[#E8F3FF] text-[#165DFF]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ l.shareable ?? '否' }}</span>
            </td>
            <td class="px-3 py-3 text-[#86909C]">{{ l.effect ?? '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="l.status === '生效' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ l.status }}</span></td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(l)">编辑</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="11" class="px-3 py-10 text-center text-[#86909C]">暂无基础线路</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      基础线路＝向运营商租的整条接入线路（一条一单），计价看整条月租而非带宽单价；标记「可共用」的线路跨产品类型共用时不重复计成本。
    </div>

    <CenterModal :model-value="editorOpen" :title="form.id ? `编辑线路 ${form.code}` : '新建基础线路'" :width="560" @update:model-value="editorOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">线路编码 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.code" placeholder="如 B-004" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">运营商</div>
            <select v-model="form.carrier" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="c in ['电信', '联通', '移动', '三方']" :key="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">线路名称 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.name" placeholder="运营商-路由-带宽，如 电信-上海↔北京-OTN波道10G" />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">带宽（M）</div>
            <UiInput v-model="form.bwMText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">计费方式</div>
            <select v-model="form.billing" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>周期性（月）</option><option>一次性买断</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">{{ form.billing === '一次性买断' ? '买断价（元）' : '整条月租（元）' }}</div>
            <UiInput v-model="form.priceText" type="number" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">采购合同</div>
            <select v-model="form.contractNo" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="">无（手工留痕）</option>
              <option v-for="c in contracts" :key="c.id" :value="c.code">{{ c.code }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">可共用标记</div>
            <select v-model="form.shareable" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>是</option><option>否</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">生效日期</div>
            <UiInput v-model="form.effect" type="date" />
          </div>
        </div>
        <div v-if="form.id">
          <div class="mb-0.5 text-xs text-[#4E5969]">状态</div>
          <select v-model="form.status" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option>草稿</option><option>生效</option><option>停用</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="editorOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.code || !form.name" @click="doSave">保存</UiButton>
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
import { baseLineList, createBaseLine, updateBaseLine } from '../../api/prd'
import type { BaseLine } from '../../api/prd'
import { purContractList } from '../../api/pur'
import type { PurContract } from '../../api/pur'

const rows = ref<BaseLine[]>([])
const contracts = ref<PurContract[]>([])
const kw = ref('')
const tab = ref('全部')
const editorOpen = ref(false)
const form = ref({
  id: undefined as number | undefined, code: '', name: '', carrier: '电信',
  bwMText: '', billing: '周期性（月）', priceText: '', contractNo: '', shareable: '否',
  effect: '', status: '生效',
})

async function load() {
  const params: Record<string, unknown> = {}
  if (kw.value) params.kw = kw.value
  if (tab.value !== '全部') params.status = tab.value
  rows.value = await baseLineList(params)
}

function openCreate() {
  form.value = { id: undefined, code: '', name: '', carrier: '电信', bwMText: '', billing: '周期性（月）', priceText: '', contractNo: '', shareable: '否', effect: '', status: '生效' }
  editorOpen.value = true
}

function openEdit(l: BaseLine) {
  form.value = {
    id: l.id, code: l.code, name: l.name, carrier: l.carrier ?? '电信',
    bwMText: l.bwM != null ? String(l.bwM) : '', billing: l.billing ?? '周期性（月）',
    priceText: l.price != null ? String(l.price) : '', contractNo: l.contractNo ?? '',
    shareable: l.shareable ?? '否', effect: l.effect ?? '', status: l.status,
  }
  editorOpen.value = true
}

async function doSave() {
  const f = form.value
  const data = {
    code: f.code, name: f.name, carrier: f.carrier,
    bwM: f.bwMText ? Number(f.bwMText) : undefined,
    billing: f.billing,
    price: f.priceText ? Number(f.priceText) : undefined,
    contractNo: f.contractNo || undefined,
    shareable: f.shareable,
    effect: f.effect || undefined,
    status: f.status,
  }
  if (f.id) {
    await updateBaseLine(f.id, data)
  } else {
    await createBaseLine(data)
  }
  Message.success('基础线路已保存')
  editorOpen.value = false
  load()
}

onMounted(async () => {
  await load()
  contracts.value = await purContractList()
})
</script>
