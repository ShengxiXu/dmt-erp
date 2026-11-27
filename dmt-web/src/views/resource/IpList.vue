<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">R3 IP 地址段</span>
        <UiInput v-model="kw" class="w-52" placeholder="搜索地址段" @keydown.enter="load" />
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '可用', '停用']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load()"
          >{{ t }}</button>
        </div>
      </div>
      <UiButton size="sm" @click="openCreate">＋ 新建 IP 段</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">IP 编码</th><th class="px-3 py-2">地址段 CIDR</th>
            <th class="px-3 py-2 text-right">地址总数</th><th class="px-3 py-2 text-right">可用</th>
            <th class="px-3 py-2">关联出口</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in rows" :key="s.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#86909C]">IP-{{ s.seg.split('/')[0].split('.').slice(0, 2).join('.') }}.0</td>
            <td class="px-3 py-3 font-mono font-medium text-[#1D2129]">{{ s.seg }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ s.count }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ Math.max(s.count - 2, 0) }}<span class="ml-1 text-[10px] text-[#C9CDD4]">(预留 2)</span></td>
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ s.exitId ? `R1-${String(s.exitId).padStart(3, '0')}` : '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="s.status === '可用' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ s.status }}</span></td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(s)">编辑</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="7" class="px-3 py-10 text-center text-[#86909C]">暂无 IP 地址段</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      地址总数按掩码自动计算；可用 = 总数 − 预留（网关/广播默认 2）。IP 段可随采购入库登记（采购单「入库」同步建档），此处维护归属与启停。
    </div>

    <CenterModal :model-value="editorOpen" :title="form.id ? `编辑 IP 段 ${form.seg}` : '新建 IP 地址段'" :width="480" @update:model-value="editorOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">地址段 CIDR <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.seg" placeholder="如 103.86.41.0/24" @update:model-value="onSegInput" />
          <div v-if="cidrError" class="mt-0.5 text-[11px] text-[#F53F3F]">{{ cidrError }}</div>
          <div v-else-if="form.count" class="mt-0.5 text-[11px] text-[#86909C]">按掩码计算地址总数：{{ form.count }}</div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">关联出口线路</div>
            <select v-model="form.exitId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option :value="undefined">不关联</option>
              <option v-for="e in exits" :key="e.id" :value="e.id">{{ e.code }} · {{ e.name }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">状态</div>
            <select v-model="form.status" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>可用</option><option>停用</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="editorOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.seg || !!cidrError" @click="doSave">保存</UiButton>
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
import { createIpSegment, exitList, ipSegmentList, updateIpSegment } from '../../api/prd'
import type { IpSegment } from '../../api/prd'
import type { ExitLine } from '../../api/types'

const rows = ref<IpSegment[]>([])
const exits = ref<ExitLine[]>([])
const kw = ref('')
const tab = ref('全部')
const editorOpen = ref(false)
const cidrError = ref('')
const form = ref({ id: undefined as number | undefined, seg: '', count: 0, exitId: undefined as number | undefined, status: '可用' })

function cidrCount(cidr: string): number | null {
  const m = cidr.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/)
  if (!m) return null
  const parts = m.slice(1, 5).map(Number)
  if (parts.some((p) => p > 255)) return null
  const prefix = Number(m[5])
  if (prefix < 8 || prefix > 32) return null
  return 2 ** (32 - prefix)
}

function onSegInput() {
  cidrError.value = ''
  if (!form.value.seg) {
    form.value.count = 0
    return
  }
  const c = cidrCount(form.value.seg)
  if (c == null) {
    cidrError.value = 'CIDR 格式不正确（如 103.86.41.0/24，掩码 8~32）'
    form.value.count = 0
    return
  }
  form.value.count = c
}

async function load() {
  const params: Record<string, unknown> = {}
  if (kw.value) params.kw = kw.value
  if (tab.value !== '全部') params.status = tab.value
  rows.value = await ipSegmentList(params)
}

function openCreate() {
  form.value = { id: undefined, seg: '', count: 0, exitId: undefined, status: '可用' }
  cidrError.value = ''
  editorOpen.value = true
}

function openEdit(s: IpSegment) {
  form.value = { id: s.id, seg: s.seg, count: s.count, exitId: s.exitId, status: s.status }
  cidrError.value = ''
  editorOpen.value = true
}

async function doSave() {
  const f = form.value
  const data = { seg: f.seg, count: f.count, exitId: f.exitId, status: f.status }
  if (f.id) {
    await updateIpSegment(f.id, data)
  } else {
    await createIpSegment(data)
  }
  Message.success('IP 段已保存')
  editorOpen.value = false
  load()
}

onMounted(async () => {
  await load()
  exits.value = await exitList()
})
</script>
