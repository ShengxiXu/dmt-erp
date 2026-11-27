<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-[#1D2129]">月结管理</span>
        <span class="text-xs text-[#86909C]">按月归档应收应付快照，已归档批次不重算</span>
      </div>
      <UiButton size="sm" @click="runOpen = true">▶ 运行月结</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">批次号</th><th class="px-3 py-2">账期</th><th class="px-3 py-2">归档时间</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="b in batches" :key="b.id">
            <tr class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-mono text-[#165DFF]">{{ b.batchNo }}</td>
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ b.period }}</td>
              <td class="px-3 py-3 text-[#86909C]">{{ (b as unknown as { createdAt?: string }).createdAt?.slice(0, 16).replace('T', ' ') ?? '—' }}</td>
              <td class="px-3 py-3 text-right">
                <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="toggle(b.id)">{{ expanded === b.id ? '收起' : '查看快照' }}</button>
              </td>
            </tr>
            <tr v-if="expanded === b.id" class="border-b bg-[#F7F8FA] last:border-0">
              <td colspan="4" class="px-3 py-3">
                <pre class="max-h-64 overflow-auto rounded-[2px] border border-[#E5E6EB] bg-white p-3 font-mono text-[11px] leading-5 text-[#4E5969]">{{ pretty(b.snapshotJson) }}</pre>
              </td>
            </tr>
          </template>
          <tr v-if="!batches.length"><td colspan="4" class="px-3 py-10 text-center text-[#86909C]">暂无月结批次</td></tr>
        </tbody>
      </table>
    </div>

    <CenterModal :model-value="runOpen" title="运行月结" :width="420" @update:model-value="runOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">账期（YYYY-MM）<span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="period" placeholder="2026-12" />
          <div class="mt-1 text-[11px] text-[#86909C]">同一账期只能归档一次，重复运行会被拦截</div>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="runOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!period" :loading="running" @click="doRun">运行</UiButton>
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
import { runSettle, settleBatches } from '../../api/fin'

interface Batch { id: number; batchNo: string; period: string; snapshotJson: string; createdAt?: string }

const batches = ref<Batch[]>([])
const expanded = ref<number | null>(null)
const runOpen = ref(false)
const period = ref('')
const running = ref(false)

async function load() {
  batches.value = (await settleBatches()).records as Batch[]
}

function toggle(id: number) {
  expanded.value = expanded.value === id ? null : id
}

function pretty(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

async function doRun() {
  running.value = true
  try {
    const r = await runSettle(period.value)
    Message.success(`月结完成：${r.batchNo}`)
    runOpen.value = false
    period.value = ''
    await load()
  } finally {
    running.value = false
  }
}

onMounted(load)
</script>
