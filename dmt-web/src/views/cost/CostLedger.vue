<template>
  <main class="space-y-4 p-6">
    <!-- 统计卡 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">审批中</div>
        <div class="mt-1"><span class="font-mono text-2xl font-semibold text-[#165DFF]">{{ statOf('审批中') }}</span> <span class="text-xs text-[#86909C]">单</span></div>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">待填写 / 待对方提交</div>
        <div class="mt-1"><span class="font-mono text-2xl font-semibold text-[#FF7D00]">{{ statOf('待填写') + statOf('待对方提交') }}</span> <span class="text-xs text-[#86909C]">单</span></div>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">本月已通过</div>
        <div class="mt-1"><span class="font-mono text-2xl font-semibold text-[#00B42A]">{{ monthPassed }}</span> <span class="text-xs text-[#86909C]">单</span></div>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
        <div class="text-[11px] text-[#86909C]">本月已驳回</div>
        <div class="mt-1"><span class="font-mono text-2xl font-semibold text-[#F53F3F]">{{ monthRejected }}</span> <span class="text-xs text-[#86909C]">单</span></div>
      </div>
    </div>

    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">核算单台账</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in TABS"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >{{ t }}</button>
        </div>
        <UiInput v-model="kw" class="w-48" placeholder="搜索核算单号 / 客户 / 合同" @keydown.enter="load(1)" />
        <button class="rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="exportCsv">⭳ 导出</button>
      </div>
      <span class="hidden text-[10px] text-[#86909C] xl:block">月成本 = 周期性条目合计；毛利 = 1 − 月成本 ÷ 合同月额（简化口径）</span>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">核算单号</th><th class="px-3 py-2">客户 / 合同</th>
            <th class="px-3 py-2 text-right">月成本（元）</th><th class="px-3 py-2 text-right">合同月额（元）</th><th class="px-3 py-2 text-right">毛利</th>
            <th class="px-3 py-2">两部门填报</th><th class="px-3 py-2">状态 / 当前节点</th><th class="px-3 py-2">更新时间</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in rows" :key="s.id" class="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" @click="openSheet(s)">
            <td class="px-3 py-3 font-mono text-[#165DFF]">{{ s.code }}</td>
            <td class="px-3 py-3">
              <div class="font-medium text-[#1D2129]">{{ s.customerName }}</div>
              <div class="font-mono text-[10px] text-[#86909C]">{{ s.contractCode }}</div>
            </td>
            <td class="px-3 py-3 text-right font-mono">{{ s.monthlyCost != null ? s.monthlyCost.toLocaleString('zh-CN') : '—' }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ (s as unknown as { contractValue?: number }).contractValue != null ? Number((s as unknown as { contractValue?: number }).contractValue).toLocaleString('zh-CN') : '—' }}</td>
            <td class="px-3 py-3 text-right font-mono font-semibold" :class="s.margin != null && s.margin < 45 ? 'text-[#F53F3F]' : 'text-[#00B42A]'">{{ s.margin != null ? `${s.margin}%` : '—' }}</td>
            <td class="px-3 py-3">
              <span class="text-[10px]" :class="(s as unknown as { opsDone?: number }).opsDone ? 'text-[#00B42A]' : 'text-[#C9CDD4]'">支撑部 {{ (s as unknown as { opsDone?: number }).opsDone ? '✓' : '…' }}</span>
              <span class="ml-1.5 text-[10px]" :class="(s as unknown as { techDone?: number }).techDone ? 'text-[#00B42A]' : 'text-[#C9CDD4]'">技术部 {{ (s as unknown as { techDone?: number }).techDone ? '✓' : '…' }}</span>
            </td>
            <td class="px-3 py-3">
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STATUS_CLS[s.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ s.status }}</span>
              <div v-if="s.curNode" class="mt-0.5 text-[10px] text-[#86909C]">当前节点：{{ s.curNode }}</div>
            </td>
            <td class="px-3 py-3 text-[#86909C]">{{ ((s as unknown as { updatedAt?: string }).updatedAt ?? '').slice(0, 16).replace('T', ' ') || '—' }}</td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">{{ ['待填写', '待对方提交', '已齐套', '已驳回'].includes(s.status) ? '去填报' : '查看' }}</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="9" class="px-3 py-10 text-center text-[#86909C]">暂无核算单（合同生效后自动建档）</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-end gap-3 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2 text-[12px] text-[#86909C]">
      <span>共 {{ total }} 条</span>
      <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 hover:border-[#165DFF] hover:text-[#165DFF]" :disabled="pageNum <= 1" @click="load(pageNum - 1)">上一页</button>
      <span class="tabular-nums">{{ pageNum }} / {{ Math.max(1, Math.ceil(total / pageSize)) }}</span>
      <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 hover:border-[#165DFF] hover:text-[#165DFF]" :disabled="pageNum >= Math.ceil(total / pageSize)" @click="load(pageNum + 1)">下一页</button>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      核算单由<strong>合同生效自动建档</strong>，支撑部 / 技术部<strong>双部门填报</strong>条目后发起审批；发起审批即生成<strong>签单快照</strong>（池水位 / 选用资源 / 条目金额），此后计价变更一律走变更流程，不允许静默改快照（契约 §4.4 红线）。
    </div>

    <!-- 核算单详情/填报抽屉 -->
    <div v-if="detail" class="fixed inset-0 z-50 flex justify-end bg-black/30" @click.self="detail = null">
      <div class="flex h-full w-[860px] max-w-[92vw] flex-col bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-[#F2F3F5] px-6 py-4">
          <div>
            <div class="flex items-center gap-3">
              <span class="font-mono text-[16px] font-semibold text-[#1D2129]">{{ detail.code }}</span>
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STATUS_CLS[detail.status]">{{ detail.status }}</span>
            </div>
            <div class="mt-1 text-[12px] text-[#86909C]">
              {{ detail.customerName }} · {{ detail.contractCode }} · 月成本 <span class="font-mono text-[#1D2129]">{{ detail.monthlyCost?.toLocaleString('zh-CN') ?? '—' }}</span> 元 · 毛利 <span class="font-mono" :class="(detail.margin ?? 100) < 45 ? 'text-[#F53F3F]' : 'text-[#00B42A]'">{{ detail.margin ?? '—' }}{{ detail.margin != null ? '%' : '' }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="canStartApproval" class="rounded-[2px] bg-[#165DFF] px-3 py-1.5 text-[12px] text-white hover:bg-[#4080FF]" @click="doStartApproval">发起审批（生成签单快照）</button>
            <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-1 text-[#86909C] hover:text-[#1D2129]" @click="detail = null">✕</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <!-- 双部门填报 -->
          <div class="flex gap-1 border-b border-[#E5E6EB]">
            <button
              v-for="d in ['支撑部', '技术部'] as const"
              :key="d"
              class="relative px-4 py-2 text-[13px]"
              :class="deptTab === d ? 'font-semibold text-[#165DFF]' : 'text-[#4E5969] hover:text-[#165DFF]'"
              @click="deptTab = d"
            >
              {{ d }}条目（{{ d === '支撑部' ? detail.opsLines?.length ?? 0 : detail.techLines?.length ?? 0 }}）
              <span v-if="(d === '支撑部' ? detail.opsDone : detail.techDone)" class="ml-1 rounded-[2px] bg-[#E8F8F2] px-1 py-0.5 text-[10px] text-[#00B42A]">已提交</span>
              <span v-if="deptTab === d" class="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[#165DFF]" />
            </button>
            <button
              class="relative px-4 py-2 text-[13px]"
              :class="deptTab === 'snapshot' ? 'font-semibold text-[#165DFF]' : 'text-[#4E5969] hover:text-[#165DFF]'"
              @click="deptTab = 'snapshot'; loadSnapshot()"
            >签单快照</button>
          </div>

          <div v-if="deptTab !== 'snapshot'" class="mt-4">
            <div v-if="editable">
              <!-- 条目骨架：按合同产品组成推导（装配落地） -->
              <div
                v-if="skeleton && (skeleton.lines.length || skeleton.optional.length) && !editingLines.some((l) => l.itemKey)"
                class="mb-3 flex items-center gap-2 rounded-[4px] border border-[#BEDAFF] bg-[#F0F5FF] px-3 py-2 text-xs text-[#1D2129]"
              >
                <span>
                  按合同产品组成（<strong>{{ skeleton.types.join('、') || '未挂类型' }}</strong>）可带出
                  <strong>{{ skeleton.lines.length }}</strong> 条骨架条目
                  <template v-if="skeleton.optional.length">＋ {{ skeleton.optional.length }} 条按需选配</template>
                  ，带出后可删、可在下方增补
                </span>
                <UiButton size="sm" class="ml-auto" @click="applySkeleton">按组成带出</UiButton>
              </div>
              <div
                v-else-if="skeleton && !skeleton.lines.length && !skeleton.optional.length"
                class="mb-3 rounded-[4px] border border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#86909C]"
              >
                本部门条目未命中合同产品组成（{{ skeleton.types.join('、') || '合同行未挂产品类型' }}），请从下方手工增补（增补范围 = 与本单类别绑定的条目，受控增补）。
              </div>
              <div v-for="(l, i) in editingLines" :key="i" class="mb-3 grid grid-cols-12 items-end gap-2 rounded-[4px] border border-[#E5E6EB] p-3">
                <div class="col-span-3">
                  <div class="mb-0.5 text-[11px] text-[#86909C]">成本条目</div>
                  <select v-model="l.itemKey" class="h-8 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs" @change="onPickItem(l)">
                    <option value="">选择条目</option>
                    <optgroup v-if="skelOptions().length" label="按组成推导">
                      <option v-for="o in skelOptions()" :key="o.itemKey" :value="o.itemKey">{{ o.name }}（{{ o.costType }}）{{ o.fromType ? `· 来自${o.fromType}` : '' }}</option>
                    </optgroup>
                    <optgroup v-if="boundOptions().length" label="按类别可增补（受控）">
                      <option v-for="o in boundOptions()" :key="o.itemKey" :value="o.itemKey">{{ o.name }}（{{ o.costType }}）</option>
                    </optgroup>
                  </select>
                </div>
                <div class="col-span-1">
                  <div class="mb-0.5 text-[11px] text-[#86909C]">数量</div>
                  <UiInput v-model="l.qtyText" type="number" />
                </div>
                <div class="col-span-2">
                  <div class="mb-0.5 text-[11px] text-[#86909C]">金额（元）</div>
                  <div class="flex gap-1">
                    <UiInput v-model="l.amountText" type="number" />
                    <button
                      v-if="calcMethodOf(l.itemKey)"
                      class="h-8 shrink-0 rounded-[2px] border border-[#165DFF] px-2 text-xs text-[#165DFF] hover:bg-[#F0F5FF] disabled:opacity-40"
                      :disabled="calcLoading === i"
                      title="按条目计算规则试算并回填（带宽类条目先在「选用资源」选池；需录入单价的条目请直接填金额）"
                      @click="calcLine(i)"
                    >{{ calcLoading === i ? '…' : '算' }}</button>
                  </div>
                </div>
                <div class="col-span-2">
                  <div class="mb-0.5 text-[11px] text-[#86909C]">选用资源</div>
                  <select
                    v-if="pickerFor(l)"
                    v-model="l.pickRef"
                    class="h-8 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs"
                    @change="onPickRes(l)"
                  >
                    <option value="">从档案选择…</option>
                    <option v-for="o in pickerFor(l)!.opts" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                  <UiInput v-else v-model="l.pickSpec" placeholder="如 PN-PON 池" />
                </div>
                <div class="col-span-2">
                  <div class="mb-0.5 text-[11px] text-[#86909C]">来源单号</div>
                  <UiInput v-model="l.sourceNo" placeholder="供应商账单号，可空" />
                </div>
                <div class="col-span-2">
                  <div class="mb-0.5 text-[11px] text-[#86909C]">演算说明</div>
                  <UiInput v-model="l.calcText" placeholder="计价过程" />
                </div>
                <div class="col-span-1 text-right">
                  <button class="text-[#86909C] hover:text-[#F53F3F] disabled:opacity-30" :disabled="editingLines.length <= 1" @click="editingLines.splice(i, 1)">✕</button>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <button class="rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#165DFF] hover:bg-[#F7FAFF]" @click="editingLines.push({ itemKey: '', qtyText: '', amountText: '', pickSpec: '', pickRef: '', calcText: '', sourceNo: '' })">＋ 添加条目</button>
                <div class="flex gap-2">
                  <UiButton variant="outline" size="sm" @click="saveLines(false)">保存</UiButton>
                  <UiButton size="sm" @click="saveLines(true)">保存并提交</UiButton>
                </div>
              </div>
            </div>
            <div v-else>
              <table class="w-full text-[13px]">
                <thead><tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th class="px-2 py-1.5">条目</th><th class="px-2 py-1.5 text-right">数量</th><th class="px-2 py-1.5 text-right">金额</th><th class="px-2 py-1.5">选用资源</th><th class="px-2 py-1.5">演算说明</th></tr></thead>
                <tbody>
                  <tr v-for="l in currentLines" :key="l.id" class="border-b last:border-0">
                    <td class="px-2 py-1.5 font-medium">{{ itemName(l.itemKey) }}</td>
                    <td class="px-2 py-1.5 text-right font-mono">{{ l.qty ?? '—' }}</td>
                    <td class="px-2 py-1.5 text-right font-mono">{{ l.amount?.toLocaleString('zh-CN') }}</td>
                    <td class="px-2 py-1.5 text-[#4E5969]">{{ l.pickSpec ?? '—' }}</td>
                    <td class="px-2 py-1.5 text-[#4E5969]">{{ l.calcText ?? '—' }}</td>
                  </tr>
                  <tr v-if="!currentLines.length"><td colspan="5" class="px-2 py-6 text-center text-[#86909C]">该部门尚未填报</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="mt-4">
            <div v-if="snapshot" class="space-y-4">
              <div class="rounded-[4px] border border-[#E5E6EB] p-3 text-xs leading-5">
                <div class="mb-1 font-semibold text-[#4E5969]">快照信息</div>
                锁定于 {{ snapshot.lockedAt.slice(0, 19) }} · 合同 {{ snap.contract?.code }} · 折扣 {{ snap.contract?.discount }} · 月成本 <span class="font-mono">{{ snap.monthlyCost }}</span> · 毛利 <span class="font-mono">{{ snap.margin }}%</span>
              </div>
              <div>
                <div class="mb-1.5 text-xs font-semibold text-[#4E5969]">出口池水位（签单时点）</div>
                <div v-for="p in snap.pools ?? []" :key="p.code" class="mb-2">
                  <div class="mb-0.5 flex justify-between text-[12px]">
                    <span class="text-[#4E5969]">{{ p.code }} · {{ p.name }}</span>
                    <span class="font-mono">{{ p.usedM }}/{{ p.capacityM }}M</span>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
                    <div class="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8]" :style="{ width: `${p.capacityM ? Math.min((p.usedM / p.capacityM) * 100, 100) : 0}%` }" />
                  </div>
                </div>
              </div>
              <div>
                <div class="mb-1.5 text-xs font-semibold text-[#4E5969]">条目金额</div>
                <table class="w-full text-[13px]">
                  <thead><tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th class="px-2 py-1.5">部门</th><th class="px-2 py-1.5">条目</th><th class="px-2 py-1.5 text-right">金额</th><th class="px-2 py-1.5">演算说明</th></tr></thead>
                  <tbody>
                    <tr v-for="(l, i) in snap.lines ?? []" :key="i" class="border-b last:border-0">
                      <td class="px-2 py-1.5"><span class="rounded-[2px] px-1 py-0.5 text-[10px]" :class="l.dept === '支撑部' ? 'bg-[#E8F3FF] text-[#165DFF]' : 'bg-[#E8F8F2] text-[#00B42A]'">{{ l.dept }}</span></td>
                      <td class="px-2 py-1.5 font-medium">{{ itemName(l.itemKey) }}</td>
                      <td class="px-2 py-1.5 text-right font-mono">{{ l.amount?.toLocaleString('zh-CN') }}</td>
                      <td class="px-2 py-1.5 text-[#4E5969]">{{ l.calcText ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else class="py-10 text-center text-[13px] text-[#86909C]">尚未生成签单快照（发起审批时自动生成）</div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import { sheetDetail, sheetPage, saveSheetLines, sheetSnapshot, startApproval, submitSheet } from '../../api/cost'
import { costItemList } from '../../api/prd'
import { http } from '../../api/request'
import { Message } from '@arco-design/web-vue'
import type { Sheet, Snapshot, SheetLine } from '../../api/cost'
import type { CostItem } from '../../api/types'

const STATUS_CLS: Record<string, string> = {
  待填写: 'bg-[#FFF3E8] text-[#FF7D00]',
  待对方提交: 'bg-[#E8F3FF] text-[#165DFF]',
  已齐套: 'bg-[#E8F3FF] text-[#165DFF]',
  审批中: 'bg-[#E8F3FF] text-[#165DFF]',
  已通过: 'bg-[#E8F8F2] text-[#00B42A]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
  变更中: 'bg-[#F5F3FF] text-[#7C3AED]',
}
const TABS = ['全部', '待填写', '待对方提交', '已齐套', '审批中', '已通过', '已驳回', '变更中']
const EDITABLE = ['待填写', '待对方提交', '已齐套', '已驳回']

const rows = ref<Sheet[]>([])
const statRows = ref<Sheet[]>([])

function statOf(status: string) {
  return statRows.value.filter((s) => s.status === status).length
}

const nowMonth = new Date().toISOString().slice(0, 7)
const monthPassed = computed(() => statRows.value.filter((s) => s.status === '已通过' && ((s as unknown as { updatedAt?: string }).updatedAt ?? '').startsWith(nowMonth)).length)
const monthRejected = computed(() => statRows.value.filter((s) => s.status === '已驳回' && ((s as unknown as { updatedAt?: string }).updatedAt ?? '').startsWith(nowMonth)).length)

function exportCsv() {
  const header = '核算单号,客户,合同,月成本,合同月额,毛利率,状态,当前节点'
  const lines = rows.value.map((s) =>
    [s.code, s.customerName ?? '', s.contractCode ?? '', s.monthlyCost ?? '', (s as unknown as { contractValue?: number }).contractValue ?? '', s.margin ?? '', s.status, s.curNode ?? '']
      .map((v) => String(v).replaceAll(',', '，')).join(','))
  const blob = new Blob(['﻿' + header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `核算单台账_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
const kw = ref('')
const tab = ref('全部')
const pageNum = ref(1)
const pageSize = 10
const total = ref(0)

const detail = ref<Sheet | null>(null)
const deptTab = ref<'支撑部' | '技术部' | 'snapshot'>('支撑部')
const snapshot = ref<Snapshot | null>(null)
const snap = ref<any>({})
const items = ref<CostItem[]>([])
interface EditLine { itemKey: string; qtyText: string; amountText: string; pickSpec: string; pickRef: string; calcText: string; sourceNo: string }
const editingLines = ref<EditLine[]>([])

/** 条目骨架（合同行 → 产品类型 → BOM 组成 → 本部门生效条目） */
interface SkelRow { itemKey: string; name: string; costType?: string; calcMethod?: string; sourceArchive?: string; fromType?: string; qty?: number }
interface Skel { lines: SkelRow[]; optional: SkelRow[]; bound?: SkelRow[]; eligible: string[]; types: string[]; cats?: string[] }
const skeleton = ref<Skel | null>(null)

/** 档案选择器数据（选用资源列：按条目计算方式/取数档案决定可选档案行） */
interface Pool { code: string; name: string; usedM?: number; rentMonth?: number }
interface Equip { id: number; name: string; costPrice?: number }
interface IpSeg { seg: string; count?: number }
interface BaseLine { code: string; name: string; price?: number }
interface ExitLine { code: string; name: string; carrier?: string }
interface PurContract { code: string; name: string; supplier?: string; unitPrice?: number; monthlyCost?: number; capacityM?: number; status?: string }
const arch = ref<{ pools: Pool[]; equipment: Equip[]; ipSegments: IpSeg[]; baseLines: BaseLine[]; exits: ExitLine[]; purContracts: PurContract[] }>({
  pools: [], equipment: [], ipSegments: [], baseLines: [], exits: [], purContracts: [],
})
let archLoaded = false

const editable = computed(() => !!detail.value && EDITABLE.includes(detail.value.status))
const canStartApproval = computed(() => !!detail.value && EDITABLE.includes(detail.value.status) && detail.value.opsDone === 1 && detail.value.techDone === 1)
const currentLines = computed<SheetLine[]>(() => {
  if (!detail.value) return []
  return deptTab.value === '支撑部' ? (detail.value.opsLines ?? []) : (detail.value.techLines ?? [])
})
const itemsOfDept = computed(() => items.value.filter((i) => i.dept === deptTab.value && i.status === '生效'))

function itemName(key: string) {
  return items.value.find((i) => i.itemKey === key)?.name ?? key
}

/** 行内试算：调 /cost-items/trial（与条目表单试算同一引擎），回填金额与演算说明；算不了的手工兜底 */
const calcLoading = ref(-1)

function itemOf(key: string) {
  return items.value.find((i) => i.itemKey === key) as (CostItem & { calcMethod?: string; calcParams?: string; sourceArchive?: string }) | undefined
}

function calcMethodOf(key: string) {
  const it = itemOf(key)
  return it?.calcMethod && it.calcMethod !== 'MANUAL' ? it.calcMethod : ''
}

// ---------- 档案选择器（选用资源列） ----------

interface ArchOpt { value: string; label: string; short: string }

/** 选用资源的档案来源：算钱要什么就选什么（池化/设备价 → 池/设备），其余按条目取数档案 */
function pickerFor(l: EditLine): { kind: string; opts: ArchOpt[] } | null {
  const it = itemOf(l.itemKey)
  if (!it) return null
  if (it.calcMethod === 'POOL_SHARE' || it.calcMethod === 'BGP_UTIL') {
    return {
      kind: 'pool',
      opts: arch.value.pools.map((p) => ({
        value: p.code,
        label: `${p.code} ${p.name}（已售 ${p.usedM ?? 0}M / 月租 ${p.rentMonth?.toLocaleString('zh-CN') ?? '—'} 元）`,
        short: p.code,
      })),
    }
  }
  let priceSource = ''
  try {
    priceSource = it.calcParams ? String(JSON.parse(it.calcParams).priceSource ?? '') : ''
  } catch { /* 忽略非法 JSON */ }
  if (it.calcMethod === 'RESALE' || it.sourceArchive === 'resale') {
    return {
      kind: 'resale',
      opts: arch.value.purContracts.map((c) => ({
        value: c.code,
        label: `${c.code} ${c.name}${c.supplier ? `（${c.supplier}）` : ''}`,
        short: c.code,
      })),
    }
  }
  if (it.calcMethod === 'QTY_PRICE' && priceSource === 'equipment') {
    return {
      kind: 'equipment',
      opts: arch.value.equipment.map((q) => ({
        value: String(q.id),
        label: `${q.name}（采购价 ${q.costPrice?.toLocaleString('zh-CN') ?? '—'} 元）`,
        short: q.name,
      })),
    }
  }
  switch (it.sourceArchive) {
    case 'r1':
      return { kind: 'exit', opts: arch.value.exits.map((x) => ({ value: x.code, label: `${x.code} ${x.name}${x.carrier ? `（${x.carrier}）` : ''}`, short: x.code })) }
    case 'r2':
      return { kind: 'baseline', opts: arch.value.baseLines.map((b) => ({ value: b.code, label: `${b.code} ${b.name}（${b.price?.toLocaleString('zh-CN') ?? '—'} 元/月）`, short: b.code })) }
    case 'r3':
      return { kind: 'ipseg', opts: arch.value.ipSegments.map((s) => ({ value: s.seg, label: `${s.seg}（共 ${s.count ?? '—'} 个）`, short: s.seg })) }
    case 'r4':
      return {
        kind: 'equipment',
        opts: arch.value.equipment.map((q) => ({ value: String(q.id), label: `${q.name}（采购价 ${q.costPrice?.toLocaleString('zh-CN') ?? '—'} 元）`, short: q.name })),
      }
    default:
      return null
  }
}

function onPickRes(l: EditLine) {
  const picker = pickerFor(l)
  const opt = picker?.opts.find((o) => o.value === l.pickRef)
  l.pickSpec = opt ? opt.short : ''
}

/** 已保存行重编辑时：按 pickSpec 反解档案行（pickRef 不落库，展示用） */
function resolvePickRef(l: EditLine) {
  const picker = pickerFor(l)
  if (!picker || !l.pickSpec) return
  const opt = picker.opts.find((o) => o.short === l.pickSpec || o.value === l.pickSpec)
  if (opt) l.pickRef = opt.value
}

// ---------- 条目骨架 ----------

async function loadSkeleton() {
  if (!detail.value || deptTab.value === 'snapshot' || !editable.value) {
    skeleton.value = null
    return
  }
  skeleton.value = await http.get<Skel>(`/sheets/${detail.value.id}/skeleton`, { dept: deptTab.value })
}

/** 骨架行 + 按需选配行（添加条目下拉「按组成推导」组） */
function skelOptions(): SkelRow[] {
  const sk = skeleton.value
  if (!sk) return []
  return [...sk.lines, ...sk.optional]
}

/** 按类别可增补（受控增补：与本单产品类别绑定的条目；骨架接口不可用时回退本部门生效条目） */
function boundOptions(): SkelRow[] {
  const sk = skeleton.value
  if (!sk) {
    return itemsOfDept.value.map((i) => ({ itemKey: i.itemKey, name: i.name, costType: i.costType }))
  }
  return sk.bound ?? []
}

function applySkeleton() {
  const sk = skeleton.value
  if (!sk) return
  const exist = new Set(editingLines.value.map((l) => l.itemKey))
  const rows: EditLine[] = sk.lines
    .filter((r) => !exist.has(r.itemKey))
    .map((r) => ({
      itemKey: r.itemKey,
      qtyText: r.qty != null ? String(r.qty) : '',
      amountText: '', pickSpec: '', pickRef: '', calcText: '', sourceNo: '',
    }))
  if (!rows.length) {
    Message.info('骨架条目已在列表中')
    return
  }
  editingLines.value = [...editingLines.value.filter((l) => l.itemKey), ...rows]
  rows.forEach((l) => resolvePickRef(l))
  Message.success(`已按产品组成带出 ${rows.length} 条骨架（来自：${sk.types.join('、') || '合同行'}）；选好资源后点「算」回填金额`)
}

/** 选了条目后：骨架行带数量提示；切换条目清空已选资源 */
function onPickItem(l: EditLine) {
  const sk = skelOptions().find((r) => r.itemKey === l.itemKey)
  if (sk?.qty != null && !l.qtyText) l.qtyText = String(sk.qty)
  l.pickRef = ''
  l.pickSpec = ''
}

async function calcLine(i: number) {
  const l = editingLines.value[i]
  if (!l || !l.itemKey) return
  const inputs: Record<string, unknown> = {}
  if (l.qtyText) inputs.qty = Number(l.qtyText)
  const method = calcMethodOf(l.itemKey)
  const picker = pickerFor(l)
  if (picker?.kind === 'pool' && l.pickRef) {
    inputs.poolCode = l.pickRef
  } else if (picker?.kind === 'equipment' && l.pickRef) {
    inputs.equipmentId = l.pickRef
  } else if (picker?.kind === 'resale' && l.pickRef) {
    // 转售：采购价取采购合同框架单价（unit_price 或 月租÷容量 折算）
    const c = arch.value.purContracts.find((x) => x.code === l.pickRef)
    const unitPrice = c?.unitPrice ?? (c?.monthlyCost != null && c?.capacityM ? c.monthlyCost / c.capacityM : undefined)
    if (unitPrice != null) inputs.unitPrice = Math.round(unitPrice * 100) / 100
  } else if ((method === 'POOL_SHARE' || method === 'BGP_UTIL') && l.pickSpec) {
    inputs.poolCode = l.pickSpec.trim().split(/\s+/)[0]
  }
  calcLoading.value = i
  try {
    const r = await http.post<{ amount: number | null; calcText: string }>('/cost-items/trial', { itemKey: l.itemKey, inputs })
    if (r.amount != null) l.amountText = String(r.amount)
    l.calcText = r.calcText
    Message.success('已按条目计算规则回填金额与演算说明')
  } catch {
    // 缺参数（如采购价/设备）由拦截器提示，金额手工填入兜底
  } finally {
    calcLoading.value = -1
  }
}

async function load(page?: number) {
  if (page) pageNum.value = page
  const params: Record<string, unknown> = { kw: kw.value || undefined, pageNum: pageNum.value, pageSize }
  if (tab.value !== '全部') params.status = tab.value
  const data = await sheetPage(params)
  rows.value = data.records
  total.value = data.total
  statRows.value = (await sheetPage({ pageNum: 1, pageSize: 100 })).records
}

async function openSheet(s: Sheet) {
  detail.value = await sheetDetail(s.id)
  deptTab.value = '支撑部'
  snapshot.value = null
  if (!archLoaded) {
    archLoaded = true
    const [pools, equipment, ipSegments, baseLines, exits, purContracts] = await Promise.all([
      http.get<Pool[]>('/archives/pools'),
      http.get<Equip[]>('/archives/equipment'),
      http.get<IpSeg[]>('/archives/ip-segments'),
      http.get<BaseLine[]>('/archives/base-lines'),
      http.get<ExitLine[]>('/archives/exits'),
      http.get<PurContract[]>('/purchase/contracts'),
    ])
    arch.value = { pools, equipment, ipSegments, baseLines, exits, purContracts }
  }
  await loadSkeleton()
  resetEditing()
}

function resetEditing() {
  const cur = deptTab.value === '支撑部' ? (detail.value?.opsLines ?? []) : (detail.value?.techLines ?? [])
  editingLines.value = cur.length
    ? cur.map((l) => {
        const line: EditLine = { itemKey: l.itemKey, qtyText: l.qty != null ? String(l.qty) : '', amountText: l.amount != null ? String(l.amount) : '', pickSpec: l.pickSpec ?? '', pickRef: '', calcText: l.calcText ?? '', sourceNo: l.sourceNo ?? '' }
        resolvePickRef(line)
        return line
      })
    : [{ itemKey: '', qtyText: '', amountText: '', pickSpec: '', pickRef: '', calcText: '', sourceNo: '' }]
}

watch(deptTab, async () => {
  if (deptTab.value !== 'snapshot') {
    snapshot.value = null
    await loadSkeleton()
    if (detail.value) resetEditing()
  }
})

async function reloadDetail() {
  if (!detail.value) return
  detail.value = await sheetDetail(detail.value.id)
}

async function saveLines(andSubmit: boolean) {
  if (!detail.value) return
  const lines = editingLines.value.filter((l) => l.itemKey).map((l) => ({
    itemKey: l.itemKey,
    qty: l.qtyText ? Number(l.qtyText) : undefined,
    amount: l.amountText ? Number(l.amountText) : undefined,
    pickSpec: l.pickSpec || undefined,
    calcText: l.calcText || undefined,
    sourceNo: l.sourceNo || undefined,
  }))
  if (!lines.length) return
  await saveSheetLines(detail.value.id, deptTab.value === 'snapshot' ? '支撑部' : deptTab.value, lines)
  if (andSubmit) {
    await submitSheet(detail.value.id, deptTab.value)
  }
  await reloadDetail()
  load()
}

async function doStartApproval() {
  if (!detail.value) return
  await startApproval(detail.value.id)
  await reloadDetail()
  load()
}

async function loadSnapshot() {
  if (!detail.value) return
  snapshot.value = await sheetSnapshot(detail.value.id)
  snap.value = snapshot.value ? JSON.parse(snapshot.value.snapshotJson) : {}
}

onMounted(async () => {
  items.value = await costItemList({})
  await load(1)
})
</script>
