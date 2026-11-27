<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">变更与退订</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['订阅变更', '退订与回收']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t"
          >{{ t }}{{ pendingOf(t) ? `（待审 ${pendingOf(t)}）` : '' }}</button>
        </div>
        <UiInput v-model="kw" class="w-48" placeholder="搜索单号 / 客户 / 订阅" @keydown.enter="load" />
      </div>
      <UiButton v-if="tab === '订阅变更'" size="sm" @click="openChange">新建变更单</UiButton>
      <UiButton v-else size="sm" @click="openTerminate">发起退订</UiButton>
    </div>

    <!-- 订阅现状 -->
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div class="mb-3 text-sm font-semibold text-[#1D2129]">订阅现状（仅「在网」可变更 / 退订）</div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="s in subs"
          :key="s.subNo"
          class="flex items-center gap-1.5 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs"
        >
          <span class="text-[#1D2129]">{{ s.customer }} · {{ s.product ?? s.spec ?? s.subNo }}</span>
          <span class="rounded-[2px] px-1 py-0.5 text-[10px]" :class="SUB_CLS[s.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ s.status }}</span>
        </span>
        <span v-if="!subs.length" class="text-xs text-[#86909C]">暂无订阅（合同生效后自动生成）</span>
      </div>
    </div>

    <!-- 订阅变更 -->
    <template v-if="tab === '订阅变更'">
      <div class="flex items-center gap-2 text-xs">
        <span class="text-[#86909C]">状态筛选：</span>
        <button
          v-for="t in ['全部', '审批中', '已生效', '已驳回']"
          :key="t"
          class="rounded-[2px] px-2 py-0.5"
          :class="chStatus === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
          @click="chStatus = t; load()"
        >{{ t }}</button>
      </div>
      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">变更单号</th><th class="px-3 py-2">客户 / 订阅</th><th class="px-3 py-2">类型</th>
              <th class="px-3 py-2">变更内容</th><th class="px-3 py-2 text-right">生效后月租</th>
              <th class="px-3 py-2 text-right">月成本影响</th><th class="px-3 py-2">生效账期</th>
              <th class="px-3 py-2">申请原因</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="c in changes" :key="c.id">
              <tr class="border-b last:border-0 hover:bg-[#F7F8FA]">
                <td class="px-3 py-3 font-mono">
                  <button class="text-[#165DFF] hover:underline" @click="expandCh = expandCh === c.id ? null : c.id">{{ expandCh === c.id ? '▾' : '▸' }} {{ c.chNo }}</button>
                </td>
                <td class="px-3 py-3">
                  <div class="font-medium text-[#1D2129]">{{ c.customer }}</div>
                  <div class="font-mono text-[10px] text-[#86909C]">SUB-{{ c.contractId }}-{{ c.lineId }}</div>
                </td>
                <td class="px-3 py-3"><span class="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{{ c.type }}</span></td>
                <td class="px-3 py-3 text-[#4E5969]">{{ c.fromVal ?? '—' }} → <span class="font-medium text-[#1D2129]">{{ c.toVal ?? '—' }}</span></td>
                <td class="px-3 py-3 text-right font-mono">{{ c.monthlyFeeAfter != null ? `${c.monthlyFeeAfter.toLocaleString('zh-CN')} 元/月` : '—' }}</td>
                <td class="px-3 py-3 text-right font-mono" :class="(c.costDelta ?? 0) > 0 ? 'text-[#F53F3F]' : (c.costDelta ?? 0) < 0 ? 'text-[#00B42A]' : 'text-[#86909C]'">
                  {{ c.costDelta != null ? `${c.costDelta > 0 ? '+' : ''}${c.costDelta.toLocaleString('zh-CN')} 元` : '—' }}
                </td>
                <td class="px-3 py-3 text-[#86909C]">{{ c.effective ?? '—' }}</td>
                <td class="max-w-40 truncate px-3 py-3 text-[#86909C]" :title="c.reason">{{ c.reason ?? '—' }}</td>
                <td class="px-3 py-3">
                  <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CH_CLS[c.status]">{{ c.status }}</span>
                  <div v-if="c.rejectNote" class="mt-0.5 text-[10px] text-[#F53F3F]">{{ c.rejectNote }}</div>
                </td>
                <td class="px-3 py-3 text-right">
                  <template v-if="c.status === '审批中'">
                    <button class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#00B42A] hover:border-[#00B42A]" @click="quickAct('订阅变更', c.id, true)">通过并生效</button>
                    <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="quickAct('订阅变更', c.id, false)">驳回</button>
                  </template>
                  <span v-else class="text-[#C9CDD4]">—</span>
                </td>
              </tr>
              <tr v-if="expandCh === c.id" class="border-b bg-[#F7F8FA] last:border-0">
                <td colspan="10" class="px-4 py-2.5 text-[11px] leading-5 text-[#4E5969]">
                  <span class="font-semibold">变更测算（增量成本，审批依据）：</span>{{ c.costBasis ?? '未测算' }}。月结仍以实际账单为准，测算差异留待差异比对。
                </td>
              </tr>
            </template>
            <tr v-if="!changes.length"><td colspan="10" class="px-3 py-10 text-center text-[#86909C]">暂无变更单</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 退订与回收 -->
    <template v-else>
      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">退订单号</th><th class="px-3 py-2">客户 / 订阅</th><th class="px-3 py-2">退订原因</th>
              <th class="px-3 py-2">生效账期</th><th class="px-3 py-2 text-right">违约金</th>
              <th class="px-3 py-2">状态</th><th class="px-3 py-2">资源回收</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="t in terminates" :key="t.id">
              <tr class="border-b last:border-0 hover:bg-[#F7F8FA]">
                <td class="px-3 py-3 font-mono">
                  <button class="text-[#165DFF] hover:underline" @click="expandTm = expandTm === t.id ? null : t.id">{{ expandTm === t.id ? '▾' : '▸' }} {{ t.tmNo }}</button>
                </td>
                <td class="px-3 py-3">
                  <div class="font-medium text-[#1D2129]">{{ t.customer }}</div>
                  <div class="font-mono text-[10px] text-[#86909C]">SUB-{{ t.contractId }}-{{ t.lineId }}</div>
                </td>
                <td class="px-3 py-3 text-[#4E5969]">{{ t.reason }}<span v-if="t.reasonText" class="text-[#86909C]">（{{ t.reasonText }}）</span></td>
                <td class="px-3 py-3 text-[#86909C]">{{ t.effectivePeriod ?? '—' }}</td>
                <td class="px-3 py-3 text-right font-mono">{{ t.penalty != null ? t.penalty.toLocaleString('zh-CN') : '—' }}</td>
                <td class="px-3 py-3">
                  <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="TM_CLS[t.status]">{{ t.status }}</span>
                  <div v-if="t.rejectNote" class="mt-0.5 text-[10px] text-[#F53F3F]">{{ t.rejectNote }}</div>
                </td>
                <td class="px-3 py-3">
                  <span v-if="t.recoverStatus" class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="t.recoverStatus === '已完工' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#E8F3FF] text-[#165DFF]'">{{ t.recoverStatus }}</span>
                  <span v-else class="text-[#C9CDD4]">—</span>
                </td>
                <td class="px-3 py-3 text-right">
                  <template v-if="t.status === '审批中'">
                    <button class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#00B42A] hover:border-[#00B42A]" @click="quickAct('退订申请', t.id, true)">通过并生效</button>
                    <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="quickAct('退订申请', t.id, false)">驳回</button>
                  </template>
                  <button v-else-if="t.recoverStatus === '待执行'" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#00B42A] hover:border-[#00B42A]" @click="openRecover(t)">执行回收</button>
                  <span v-else-if="t.recoverStatus === '已完工'" class="text-[10px] text-[#86909C]">{{ (t.executedAt ?? '').slice(0, 16).replace('T', ' ') }}</span>
                  <span v-else class="text-[#C9CDD4]">—</span>
                </td>
              </tr>
              <tr v-if="expandTm === t.id" class="border-b bg-[#F7F8FA] last:border-0">
                <td colspan="8" class="px-4 py-2.5 text-[11px] leading-5 text-[#4E5969]">
                  <div v-if="t.penaltyBasis"><span class="font-semibold">违约金口径：</span>{{ t.penaltyBasis }}</div>
                  <div><span class="font-semibold">资源回收：</span>CPE 回库（R4 库存 +1）· IP 地址释放回地址池 · 出口带宽切分与端口配置清除{{ t.recoverNote ? ` · 执行留痕：${t.recoverNote}` : '' }}</div>
                </td>
              </tr>
            </template>
            <tr v-if="!terminates.length"><td colspan="8" class="px-3 py-10 text-center text-[#86909C]">暂无退订单</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      <div class="mb-1 font-semibold text-[#4E5969]">变更与退订口径（P05 / P06）</div>
      <div>1. 变更：仅「在网」订阅可发起；欠停须先复机（收款足额核销自动触发）；审批通过后订阅行与月租即时更新，生效账期起按新价出账，当期仍按原价</div>
      <div>2. 变更测算：提交时按变更类型自动推导增量成本——带宽升降 = 带宽差 × 出口带宽成本单价；IP 增减 = 数量差 × IP 单价；套餐变更 = 月租差 × 成本率兜底；地址迁移 = 安装调测费（一次性）。单价均在策略中心维护；月结仍以实际账单为准</div>
      <div>3. 退订：审批通过后订阅=退订，自生效账期起账期扫描跳过出账；生效账期之前的欠费账单不受影响，照常催收</div>
      <div>4. 退订违约金：一事一议，系统仅给参考试算（剩余未履行账期月租合计 × 参考比例，策略中心可配）；最终金额由退订审批确定</div>
      <div>5. 资源回收：退订生效自动生成回收任务（CPE 回库 → R4 库存 +1；IP 地址释放回地址池；出口带宽切分与端口配置清除，网络侧执行留痕）</div>
    </div>

    <!-- 发起变更 -->
    <CenterModal :model-value="changeOpen" title="新建变更单" :width="560" @update:model-value="changeOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">选择订阅（仅在网）<span class="text-[#F53F3F]">*</span></div>
          <select v-model="changeForm.subKey" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option value="" disabled>请选择</option>
            <option v-for="s in activeSubs" :key="s.subNo" :value="s.subNo">{{ s.subNo }} · {{ s.customer }} · {{ s.product ?? s.spec ?? '' }}</option>
          </select>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">变更类型 <span class="text-[#F53F3F]">*</span></div>
            <select v-model="changeForm.type" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="t in ['套餐变更', '带宽升级', '带宽降级', '增加 IP', '减少 IP', '地址迁移']" :key="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">变更前</div>
            <UiInput v-model="changeForm.fromVal" placeholder="如 单线 200M" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">变更后 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="changeForm.toVal" placeholder="如 单线 500M" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">生效后月租（元）</div>
            <UiInput v-model="changeForm.feeText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">生效账期（YYYY-MM）</div>
            <UiInput v-model="changeForm.effective" placeholder="2026-12" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">变更原因</div>
          <UiInput v-model="changeForm.reason" />
        </div>
        <div class="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] leading-4 text-[#86909C]">
          提交时系统按变更类型自动测算增量成本（月成本影响），作为审批依据；口径见页底说明第 2 条。
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="changeOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!changeForm.subKey || !changeForm.toVal" @click="doChange">提交审批</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 发起退订 -->
    <CenterModal :model-value="termOpen" title="发起退订" :width="560" @update:model-value="termOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">选择订阅（仅在网）<span class="text-[#F53F3F]">*</span></div>
          <select v-model="termForm.subKey" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm" @change="refreshPenalty">
            <option value="" disabled>请选择</option>
            <option v-for="s in activeSubs" :key="s.subNo" :value="s.subNo">{{ s.subNo }} · {{ s.customer }} · {{ s.product ?? s.spec ?? '' }}</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">退订原因 <span class="text-[#F53F3F]">*</span></div>
            <select v-model="termForm.reason" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm" @change="refreshPenalty">
              <option v-for="r in ['合同到期', '客户主动', '欠费坏账', '其他']" :key="r">{{ r }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">生效账期（YYYY-MM）<span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="termForm.effectivePeriod" placeholder="2026-12" @update:model-value="refreshPenalty" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">违约金申请金额（元，一事一议）</div>
          <UiInput v-model="termForm.penaltyText" type="number" />
          <div v-if="penaltyBasis" class="mt-1 rounded-[2px] bg-[#F7F8FA] px-2 py-1.5 text-[11px] leading-4 text-[#86909C]">{{ penaltyBasis }}</div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">补充说明</div>
          <UiInput v-model="termForm.reasonText" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="termOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!termForm.subKey || !termForm.effectivePeriod" @click="doTerminate">提交审批</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 执行回收 -->
    <CenterModal :model-value="!!recovering" :title="`执行资源回收 · ${recovering?.tmNo ?? ''}`" :width="460" @update:model-value="recovering = null">
      <div v-if="recovering" class="space-y-3">
        <div class="rounded-[4px] border border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2 text-xs text-[#4E5969]">
          回收动作：CPE 回库（R4 库存 +1）· IP 地址释放回地址池 · 出口带宽切分与端口配置清除
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">执行留痕说明</div>
          <UiInput v-model="recoverNote" placeholder="如：CPE SN9A001 已回库，IP 段已释放" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="recovering = null">取消</UiButton>
          <UiButton size="sm" @click="doRecover">确认完工</UiButton>
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
import {
  changeList, executeRecover, penaltyRef, submitChange, submitTerminate,
  subscriptionList, terminateList,
} from '../../api/lifecycle'
import type { LcChange, LcTerminate, Subscription } from '../../api/lifecycle'
import { http } from '../../api/request'

const CH_CLS: Record<string, string> = {
  审批中: 'bg-[#FFF3E8] text-[#FF7D00]',
  已生效: 'bg-[#E8F8F2] text-[#00B42A]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
}
const TM_CLS: Record<string, string> = {
  审批中: 'bg-[#FFF3E8] text-[#FF7D00]',
  退订生效: 'bg-[#F2F3F5] text-[#86909C]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
}
const SUB_CLS: Record<string, string> = {
  在网: 'bg-[#E8F8F2] text-[#00B42A]',
  欠停: 'bg-[#FFECE8] text-[#F53F3F]',
  退订: 'bg-[#F2F3F5] text-[#86909C]',
}

const tab = ref('订阅变更')
const kw = ref('')
const chStatus = ref('全部')
const subs = ref<Subscription[]>([])
const changes = ref<LcChange[]>([])
const terminates = ref<LcTerminate[]>([])
const expandCh = ref<number | null>(null)
const expandTm = ref<number | null>(null)
const changeOpen = ref(false)
const termOpen = ref(false)
const recovering = ref<LcTerminate | null>(null)
const recoverNote = ref('')
const penaltyBasis = ref('')

const changeForm = ref({ subKey: '', type: '带宽升级', fromVal: '', toVal: '', feeText: '', effective: '', reason: '' })
const termForm = ref({ subKey: '', reason: '客户主动', effectivePeriod: '', penaltyText: '', reasonText: '' })

const activeSubs = computed(() => subs.value.filter((s) => s.status === '在网'))

function pendingOf(t: string) {
  return t === '订阅变更'
    ? changes.value.filter((c) => c.status === '审批中').length
    : terminates.value.filter((x) => x.status === '审批中').length
}

function subOf(key: string) {
  return subs.value.find((s) => s.subNo === key)
}

async function load() {
  const params: Record<string, unknown> = {}
  if (kw.value) params.kw = kw.value
  if (chStatus.value !== '全部') params.status = chStatus.value
  const [c, t] = await Promise.all([changeList(params), terminateList(kw.value ? { kw: kw.value } : undefined)])
  changes.value = c
  terminates.value = t
}

/** 页内快捷审批：取在途实例 → act（与审批中心同一引擎） */
async function quickAct(docType: string, docId: number, pass: boolean) {
  const inst = await http.get<{ id: number } | null>('/approvals/active', { docType, docId })
  if (!inst) {
    Message.warning('未找到在途审批实例，请到审批中心查看')
    return
  }
  Modal.warning({
    title: pass ? '通过并生效？' : '驳回该申请？',
    content: pass ? '通过后写回立即生效（订阅行/退订状态更新）。' : '驳回必须填写意见（默认：不符合变更条件）。',
    onOk: async () => {
      await http.post(`/approvals/instances/${inst.id}/act`, { approve: pass, comment: pass ? '页内快捷审批通过' : '不符合条件，驳回' })
      Message.success(pass ? '已通过并生效' : '已驳回')
      load()
    },
  })
}

function openChange() {
  changeForm.value = { subKey: '', type: '带宽升级', fromVal: '', toVal: '', feeText: '', effective: '', reason: '' }
  changeOpen.value = true
}

async function doChange() {
  const s = subOf(changeForm.value.subKey)
  if (!s) return
  await submitChange({
    contractId: s.contractId,
    lineId: s.lineId,
    type: changeForm.value.type,
    fromVal: changeForm.value.fromVal || undefined,
    toVal: changeForm.value.toVal,
    monthlyFeeAfter: changeForm.value.feeText ? Number(changeForm.value.feeText) : undefined,
    effective: changeForm.value.effective || undefined,
    reason: changeForm.value.reason || undefined,
  })
  Message.success('变更申请已提交（含增量成本测算，待审批）')
  changeOpen.value = false
  load()
}

function openTerminate() {
  termForm.value = { subKey: '', reason: '客户主动', effectivePeriod: '', penaltyText: '', reasonText: '' }
  penaltyBasis.value = ''
  termOpen.value = true
}

async function refreshPenalty() {
  const s = subOf(termForm.value.subKey)
  if (!s || !termForm.value.effectivePeriod || termForm.value.reason === '合同到期') {
    if (termForm.value.reason === '合同到期') {
      penaltyBasis.value = '合同正常到期退订，通常无违约金（仍可按实际约定填写）'
    }
    return
  }
  const r = await penaltyRef(s.contractId, s.lineId, termForm.value.effectivePeriod)
  penaltyBasis.value = r.basis
  if (!termForm.value.penaltyText) {
    termForm.value.penaltyText = String(r.penalty)
  }
}

async function doTerminate() {
  const s = subOf(termForm.value.subKey)
  if (!s) return
  await submitTerminate({
    contractId: s.contractId,
    lineId: s.lineId,
    reason: termForm.value.reason,
    reasonText: termForm.value.reasonText || undefined,
    effectivePeriod: termForm.value.effectivePeriod,
    penalty: termForm.value.penaltyText ? Number(termForm.value.penaltyText) : undefined,
    penaltyBasis: penaltyBasis.value || undefined,
  })
  Message.success('退订申请已提交审批')
  termOpen.value = false
  load()
}

function openRecover(t: LcTerminate) {
  recovering.value = t
  recoverNote.value = ''
}

async function doRecover() {
  if (!recovering.value) return
  await executeRecover(recovering.value.id, recoverNote.value || undefined)
  Message.success('资源回收已完工')
  recovering.value = null
  load()
}

onMounted(async () => {
  subs.value = await subscriptionList()
  await load()
})
</script>
