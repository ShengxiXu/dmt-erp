<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-[#1D2129]">策略中心</span>
        <span class="text-[11px] text-[#86909C]">计费/欠费/测算/违约金/月结的运行参数——业务页面实时读取，改即生效（危险项请谨慎）</span>
      </div>
    </div>

    <div v-for="g in groups" :key="g.name" class="rounded-[4px] border border-[#E5E6EB] bg-white">
      <div class="border-b bg-[#F7F8FA] px-4 py-2 text-xs font-semibold text-[#4E5969]">{{ g.name }}</div>
      <div class="divide-y">
        <div v-for="c in g.items" :key="c.cfgKey" class="flex items-center gap-3 px-4 py-2.5">
          <div class="min-w-0 flex-1">
            <div class="text-xs font-medium text-[#1D2129]">{{ labelOf(c.cfgKey) }}</div>
            <div class="mt-0.5 text-[11px] text-[#86909C]">{{ c.remark ?? c.cfgKey }}</div>
          </div>
          <span class="w-24 shrink-0 font-mono text-[10px] text-[#C9CDD4]">{{ c.cfgKey }}</span>
          <UiInput v-model="edits[c.cfgKey]" class="w-32" />
          <UiButton
            size="sm"
            variant="outline"
            :disabled="edits[c.cfgKey] === (c.cfgValue ?? '')"
            @click="save(c)"
          >保存</UiButton>
        </div>
      </div>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      已接入的运行参数：违约金参考比例（退订试算实时读取）。其余参数为业务口径备案，随对应功能上线逐步接入。
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import { configList, upsertConfig } from '../../api/sys'
import type { SysConfig } from '../../api/sys'

const LABELS: Record<string, string> = {
  'billing.payTiming': '付款时点',
  'billing.dueDays': '付款期',
  'billing.diffPct': '出账环比审核阈值',
  'overdue.graceDays': '宽限期',
  'overdue.remindDays': '提醒频率',
  'overdue.suspendDays': '停机条件（逾期 > N 天）',
  'overdue.lateFeeRate': '滞纳金比例',
  'overdue.badDebtDays': '坏账门槛',
  'cost.exitPerM': '出口带宽成本单价',
  'cost.ipUnit': 'IP 地址成本单价',
  'cost.planRatio': '套餐变更成本率（兜底）',
  'cost.installFee': '安装调测费（一次性）',
  'penalty.refRate': '违约金参考比例',
  'settle.closeDay': '月结日',
  'settle.diffYellow': '差异预警（黄）',
  'settle.diffRed': '差异预警（红）',
}
const GROUP_ORDER: [string, string][] = [
  ['billing', '计费与出账'],
  ['overdue', '欠费与停机'],
  ['cost', '成本测算单价'],
  ['penalty', '违约金'],
  ['settle', '月结'],
]

const rows = ref<SysConfig[]>([])
const edits = reactive<Record<string, string>>({})

const groups = computed(() =>
  GROUP_ORDER.map(([prefix, name]) => ({
    name,
    items: rows.value.filter((c) => c.cfgKey.startsWith(prefix + '.')),
  })).filter((g) => g.items.length),
)

function labelOf(key: string) {
  return LABELS[key] ?? key
}

async function load() {
  rows.value = await configList()
  for (const c of rows.value) {
    edits[c.cfgKey] = c.cfgValue ?? ''
  }
}

async function save(c: SysConfig) {
  await upsertConfig(c.cfgKey, edits[c.cfgKey] ?? '', c.remark)
  Message.success(`「${labelOf(c.cfgKey)}」已更新，即时生效`)
  load()
}

onMounted(load)
</script>
