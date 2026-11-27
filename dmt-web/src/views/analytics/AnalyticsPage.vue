<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div>
        <span class="text-sm font-semibold text-[#1D2129]">经营分析</span>
        <span class="ml-2 text-[11px] text-[#86909C]">面向管理层的经营一页式视图 · 数据实时取自各业务台账（应收 / 商机 / 合同 / 出口资源池 / 月结批次）</span>
      </div>
      <span class="rounded-[2px] bg-[#F7F8FA] px-2 py-0.5 text-[11px] text-[#86909C]">账龄基准日 {{ today }} · 与财务中心同口径</span>
    </div>

    <!-- 顶部 KPI -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">生效合同月租（元/月）</div>
        <div class="mt-1 font-mono text-xl font-semibold text-[#165DFF]">{{ fmt(d?.monthlyRevenue) }}</div>
        <div class="mt-1 text-[10px] text-[#86909C]">{{ d?.activeContractCount ?? 0 }} 份生效合同</div>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">出口池月成本（元/月）</div>
        <div class="mt-1 font-mono text-xl font-semibold text-[#0D9488]">{{ fmt(d?.monthlyExitCost) }}</div>
        <div class="mt-1 text-[10px] text-[#86909C]">{{ d?.exitLineCount ?? 0 }} 条出口线路（带宽成本）</div>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">带宽毛利（元/月）</div>
        <div class="mt-1 font-mono text-xl font-semibold" :class="(d?.grossMargin ?? 0) >= 0 ? 'text-[#00B42A]' : 'text-[#F53F3F]'">{{ fmt(d?.grossMargin) }}</div>
        <div class="mt-1 text-[10px] text-[#86909C]">毛利率 {{ d?.marginRate ?? 0 }}%（合同额 vs 出口带宽成本，未含线路/机房等）</div>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">应收 / 回款率</div>
        <div class="mt-1 font-mono text-xl font-semibold text-[#FF7D00]">{{ fmt(d?.receivableTotal) }}</div>
        <div class="mt-1 text-[10px] text-[#86909C]">已收 {{ fmt(d?.receivedTotal) }} 元 · 回款率 {{ d?.receiveRate ?? 0 }}% · 逾期率 {{ d?.overdueRate ?? 0 }}%</div>
      </div>
    </div>

    <!-- 合同到期看板 -->
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div class="mb-3 flex items-center justify-between">
        <span class="text-sm font-semibold text-[#1D2129]">合同到期看板（未来 90 天 · 基准日 {{ today }}）</span>
        <router-link to="/contract" class="text-[11px] text-[#165DFF] hover:underline">合同管理 →</router-link>
      </div>
      <div class="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <div v-for="b in expBuckets" :key="b.label" class="flex items-center gap-3 rounded-[4px] px-3 py-3" :style="{ background: b.bg }">
          <span class="font-mono text-lg font-semibold" :style="{ color: b.color }">{{ b.rows.length }}</span>
          <div class="text-[11px] leading-4">
            <div class="font-medium text-[#1D2129]">{{ b.label }}到期</div>
            <div class="text-[#86909C]">月租 {{ fmt(b.sum) }} 元 · {{ b.hint }}</div>
          </div>
        </div>
      </div>
      <div v-if="d?.expiring?.length" class="overflow-x-auto">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-1.5">合同号</th><th class="px-3 py-1.5">客户</th><th class="px-3 py-1.5">到期日</th>
              <th class="px-3 py-1.5 text-right">剩余</th><th class="px-3 py-1.5 text-right">月租（元/月）</th><th class="px-3 py-1.5">续签状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in d.expiring" :key="c.contractId" class="border-b last:border-0 hover:bg-[#F7FAFF]">
              <td class="px-3 py-2 font-mono"><router-link :to="`/contract/detail?id=${c.contractId}`" class="text-[#165DFF] hover:underline">{{ c.code }}</router-link></td>
              <td class="px-3 py-2 font-medium text-[#1D2129]">{{ c.customer }}</td>
              <td class="px-3 py-2 text-[#4E5969]">{{ c.endDate }}</td>
              <td class="px-3 py-2 text-right font-mono font-semibold" :class="c.daysLeft <= 30 ? 'text-[#F53F3F]' : c.daysLeft <= 60 ? 'text-[#FF7D00]' : 'text-[#165DFF]'">{{ c.daysLeft }} 天</td>
              <td class="px-3 py-2 text-right font-mono">{{ fmt(c.monthlyFee) }}</td>
              <td class="px-3 py-2"><span class="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">待发起续签</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="rounded-[2px] bg-[#F7F8FA] px-3 py-4 text-center text-[11px] text-[#86909C]">未来 90 天内无到期合同，续签压力可控。</div>
      <div class="mt-2 text-[11px] text-[#86909C]">到期前 90 天可发起续签（合同详情页「发起续签」）；续签单生效时源合同自动终止并停止出账，防双算。</div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- 月度应收趋势（竖向双柱） -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-semibold text-[#1D2129]">月度应收趋势</span>
          <router-link to="/billing" class="text-[11px] text-[#165DFF] hover:underline">收款管理 →</router-link>
        </div>
        <div v-if="d?.revenueTrend?.length" class="flex h-48 items-end gap-6 px-2">
          <div v-for="t in d.revenueTrend" :key="t.month" class="flex flex-1 flex-col items-center gap-1">
            <div class="flex h-36 w-full items-end justify-center gap-1.5">
              <div class="w-7 rounded-t-[2px] bg-[#165DFF]" :style="{ height: `${Math.max((t.amount / maxTrend) * 100, 2)}%` }" :title="`账单金额 ${fmt(t.amount)}`" />
              <div class="w-7 rounded-t-[2px] bg-[#94BFFF]" :style="{ height: `${Math.max((t.received / maxTrend) * 100, 2)}%` }" :title="`已收金额 ${fmt(t.received)}`" />
            </div>
            <span class="font-mono text-[10px] text-[#86909C]">{{ t.month }}</span>
          </div>
        </div>
        <div v-else class="rounded-[2px] bg-[#F7F8FA] px-3 py-4 text-center text-[11px] text-[#86909C]">暂无账单数据</div>
        <div class="mt-2 flex justify-center gap-4 text-[10px] text-[#86909C]">
          <span class="flex items-center gap-1"><i class="inline-block h-2 w-2 rounded-[1px] bg-[#165DFF]" />账单金额</span>
          <span class="flex items-center gap-1"><i class="inline-block h-2 w-2 rounded-[1px] bg-[#94BFFF]" />已收金额</span>
        </div>
      </div>

      <!-- 商机 Pipeline -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-semibold text-[#1D2129]">商机 Pipeline（按阶段 · 预计合同额）</span>
          <router-link to="/opportunity" class="text-[11px] text-[#165DFF] hover:underline">商机管理 →</router-link>
        </div>
        <div class="space-y-2.5">
          <div v-for="p in d?.pipeline ?? []" :key="p.stage">
            <div class="mb-1 flex justify-between text-xs">
              <span class="text-[#4E5969]">{{ p.stage }}（{{ p.count }} 个）</span>
              <span class="font-mono text-[#1D2129]">{{ fmt(p.amount) }} 元</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
              <div class="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]" :style="{ width: `${Math.max((p.amount / maxPipe) * 100, p.count ? 3 : 0)}%` }" />
            </div>
          </div>
        </div>
        <div class="mt-3 border-t border-[#F2F3F5] pt-2 text-[11px] text-[#86909C]">
          进行中商机合计预计合同额 <span class="font-mono font-semibold text-[#1D2129]">{{ fmt(d?.pipelineFollowingSum) }}</span> 元；赢单未签约 {{ d?.wonUnsigned ?? 0 }} 个
        </div>
      </div>

      <!-- 出口水位 -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-semibold text-[#1D2129]">
            出口水位
            <span class="ml-1 text-[10px] font-normal text-[#86909C]">出口=直挂＋全部池分摊 ｜ 出口池=池订单</span>
          </span>
          <router-link to="/resources/r0" class="text-[11px] text-[#165DFF] hover:underline">R0 出口池 →</router-link>
        </div>
        <div class="space-y-3">
          <div v-for="e in d?.exitWater ?? []" :key="e.label">
            <div class="mb-1 flex justify-between text-xs">
              <span class="truncate text-[#4E5969]">
                <span v-if="e.pool" class="mr-1 rounded-[2px] bg-[#E8F3FF] px-1 py-0.5 text-[10px] text-[#165DFF]">出口池</span>{{ e.label }}
              </span>
              <span class="ml-2 shrink-0 font-mono" :class="e.pct >= 80 ? 'text-[#FF7D00]' : 'text-[#1D2129]'">
                {{ e.soldM }}M / {{ e.capM }}M · <span :class="e.pct >= 80 ? 'text-[#FF7D00]' : 'text-[#00B42A]'">{{ e.pct }}%</span>
              </span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
              <div class="h-full rounded-full" :class="e.pct >= 80 ? 'bg-[#FF7D00]' : 'bg-[#00B42A]'" :style="{ width: `${Math.max(e.pct, 2)}%` }" />
            </div>
          </div>
          <div v-if="!d?.exitWater?.length" class="text-[11px] text-[#86909C]">暂无出口线路</div>
        </div>
        <div class="mt-3 text-[10px] leading-4 text-[#86909C]">≥80% 提示扩容评估，60-80% 关注增长；闲置容量 = 空转成本，见「成本怎么算」</div>
      </div>

      <!-- 应收账龄 -->
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-semibold text-[#1D2129]">应收账龄（余额 {{ fmt(agingTotal) }} 元）</span>
          <router-link to="/finance/overdue" class="text-[11px] text-[#165DFF] hover:underline">欠费与坏账 →</router-link>
        </div>
        <div class="space-y-2.5">
          <div v-for="a in d?.aging5 ?? []" :key="a.bucket">
            <div class="mb-1 flex justify-between text-xs">
              <span class="text-[#4E5969]">{{ a.bucket }}（{{ a.count }} 笔）</span>
              <span class="font-mono text-[#1D2129]">{{ fmt(a.amount) }} 元</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
              <div
                class="h-full rounded-full"
                :class="a.bucket === '未到期' ? 'bg-[#165DFF]' : a.bucket === '宽限期内' ? 'bg-[#FF7D00]' : 'bg-[#F53F3F]'"
                :style="{ width: `${Math.max((a.amount / maxAging) * 100, a.count ? 3 : 0)}%` }"
              />
            </div>
          </div>
        </div>
        <div class="mt-3 border-t border-[#F2F3F5] pt-2 text-[11px] leading-4 text-[#86909C]">
          未结清账单 {{ d?.outstandingCount ?? 0 }} 笔 · DSO（平均回款延迟）<span class="font-mono font-semibold text-[#1D2129]">{{ d?.dso ?? 0 }}</span> 天 · 坏账候选余额 <span class="font-mono font-semibold" :class="(d?.badCandidate ?? 0) > 0 ? 'text-[#F53F3F]' : 'text-[#1D2129]'">{{ fmt(d?.badCandidate) }}</span> 元；逾期 &gt; 90 天建议按坏账流程发起处理（停机 / 催收 / 核销）
        </div>
      </div>
    </div>

    <!-- 月结毛利 -->
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div class="mb-3 flex items-center justify-between">
        <span class="text-sm font-semibold text-[#1D2129]">月结毛利（按客户，取自已归档月结批次）</span>
        <router-link to="/finance/settle" class="text-[11px] text-[#165DFF] hover:underline">月结 →</router-link>
      </div>
      <div v-if="d?.batches?.length" class="space-y-1.5">
        <div v-for="b in d.batches" :key="b.batchNo" class="flex items-center justify-between rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-xs">
          <span class="font-mono text-[#165DFF]">{{ b.batchNo }}</span>
          <span class="text-[#4E5969]">账期 {{ b.period }}</span>
          <span class="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">已归档</span>
        </div>
      </div>
      <div v-else class="rounded-[2px] bg-[#F7F8FA] px-3 py-4 text-center text-[11px] leading-5 text-[#86909C]">
        暂无已归档的月结批次。到「月结」页选择账期跑月结后，这里自动展示按客户的收入 / 直接成本 / 间接分摊 / 毛利明细。<br />
        上方「带宽毛利」卡片为简化口径（生效合同月租 − 出口池月成本），正式毛利以月结批次为准（含全部成本条目与间接分摊）。
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { analyticsOverview } from '../../api/analytics'
import type { AnalyticsOverview } from '../../api/analytics'

const d = ref<AnalyticsOverview | null>(null)
const today = new Date().toISOString().slice(0, 10)

function fmt(n?: number) {
  return (n ?? 0).toLocaleString('zh-CN')
}

const maxTrend = computed(() => Math.max(...(d.value?.revenueTrend ?? []).flatMap((t) => [t.amount, t.received]), 1))
const maxPipe = computed(() => Math.max(...(d.value?.pipeline ?? []).map((p) => p.amount), 1))
const maxAging = computed(() => Math.max(...(d.value?.aging5 ?? []).map((a) => a.amount), 1))
const agingTotal = computed(() => (d.value?.aging5 ?? []).reduce((s, a) => s + a.amount, 0))

const expBuckets = computed(() => {
  const list = d.value?.expiring ?? []
  const mk = (label: string, hint: string, color: string, bg: string, test: (x: number) => boolean) => {
    const rows = list.filter((c) => test(c.daysLeft))
    return { label, hint, color, bg, rows, sum: rows.reduce((s, c) => s + c.monthlyFee, 0) }
  }
  return [
    mk('30 天内', '需立即启动续签谈判', '#F53F3F', '#FFECE8', (x) => x <= 30),
    mk('31–60 天', '可启动续签谈判', '#FF7D00', '#FFF3E8', (x) => x > 30 && x <= 60),
    mk('61–90 天', '纳入续签计划', '#165DFF', '#E8F3FF', (x) => x > 60 && x <= 90),
  ]
})

onMounted(async () => {
  d.value = await analyticsOverview()
})
</script>
