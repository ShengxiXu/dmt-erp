<template>
  <main v-if="c" class="space-y-4 p-6">
    <!-- 签署流程：仅签署阶段渲染，双链路四步 -->
    <div v-if="signing" class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-[#1D2129]">签署流程</span>
        <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="c.seal === 'online' ? 'bg-[#E8F3FF] text-[#165DFF]' : 'bg-[#FFF3E8] text-[#FF7D00]'">
          {{ c.seal === 'online' ? '线上 · 契约锁' : '线下 · 实物章' }}
        </span>
        <span v-if="c.status === '已生效'" class="ml-auto text-xs text-[#00B42A]">✓ 签署完成，双方签署版已归档</span>
        <span v-else class="ml-auto text-xs text-[#4E5969]">当前步骤：<strong class="text-[#165DFF]">{{ steps[Math.min(c.step ?? 0, 3)] }}</strong>（{{ Math.min((c.step ?? 0), 3) + 1 }}/4）</span>
      </div>
      <div class="rounded-[4px] border p-4" :class="c.status === '已生效' ? 'border-[#00B42A]/40 bg-[#F7FEF9]' : 'border-[#165DFF] bg-[#F7FAFF]'">
        <div class="mb-3 flex items-center gap-2 text-xs font-semibold" :style="{ color: c.status === '已生效' ? '#00B42A' : '#165DFF' }">
          <span class="h-2 w-2 rounded-full" :style="{ background: c.seal === 'online' ? '#165DFF' : '#FF7D00' }" />
          {{ c.seal === 'online' ? '线上链路（契约锁）' : '线下链路（实物章）' }}
          <span v-if="c.status !== '已生效'" class="rounded-[2px] bg-[#BEDAFF] px-1.5 py-0.5 text-[10px]">当前链路</span>
        </div>
        <div class="flex items-center">
          <template v-for="(s, i) in steps" :key="s">
            <div class="flex flex-1 items-center last:flex-none">
              <div class="text-center">
                <div class="mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px]"
                  :class="c.status === '已生效' || i < (c.step ?? 0) ? 'bg-[#00B42A] text-white' : i === (c.step ?? 0) ? 'bg-[#165DFF] text-white' : 'border border-[#E5E6EB] bg-white text-[#C9CDD4]'">
                  {{ c.status === '已生效' || i < (c.step ?? 0) ? '✓' : i + 1 }}
                </div>
                <div class="mt-1 w-16 text-[10px] leading-3" :class="i === (c.step ?? 0) && c.status !== '已生效' ? 'font-medium text-[#165DFF]' : 'text-[#4E5969]'">{{ s }}</div>
              </div>
              <div v-if="i < steps.length - 1" class="mx-1 mb-4 h-px flex-1" :class="c.status === '已生效' || i < (c.step ?? 0) ? 'bg-[#00B42A]' : 'bg-[#E5E6EB]'" />
            </div>
          </template>
        </div>
      </div>
      <div v-if="c.status !== '已生效'" class="mt-3 flex flex-wrap items-center gap-3 border-t border-[#F2F3F5] pt-3">
        <UiButton size="sm" @click="doAdvance">{{ (c.step ?? 0) >= 3 ? '签署完成 → 合同已生效' : actionLabel }}</UiButton>
        <span class="ml-auto text-[10px] text-[#86909C]">契约锁/实物章为演示链路：按钮推进状态</span>
      </div>
    </div>

    <!-- 头部信息带 -->
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-5 py-4">
      <div class="flex flex-wrap items-center gap-3">
        <span class="font-mono text-lg font-semibold text-[#1D2129]">{{ c.code }}</span>
        <span class="rounded-[2px] px-2 py-0.5 text-xs" :class="STATUS_CLS[c.status]">{{ c.status }}</span>
        <span class="text-sm text-[#4E5969]">{{ c.customerName }}</span>
        <span v-if="c.status === '已生效' && daysLeft !== null" class="rounded-[2px] px-2 py-0.5 text-xs"
          :class="daysLeft <= 30 ? 'bg-[#FFECE8] text-[#F53F3F]' : daysLeft <= 90 ? 'bg-[#FFF3E8] text-[#FF7D00]' : 'bg-[#E8F8F2] text-[#00701A]'">
          {{ daysLeft <= 30 ? `⚠ 将于 ${c.endDate} 到期（剩 ${daysLeft} 天），需立即启动续签谈判` : daysLeft <= 90 ? `将于 ${c.endDate} 到期（剩 ${daysLeft} 天），可启动续签谈判` : `到期还有 ${daysLeft} 天 · 回收倒计时已启动` }}
        </span>
        <div class="ml-auto flex gap-2">
          <template v-if="c.status === '待用章' || c.status === '签署中'">
            <UiButton size="sm" variant="outline" @click="reviseOpen = true">条款修改</UiButton>
            <UiButton size="sm" variant="outline" @click="doTerminate">客户拒签</UiButton>
          </template>
          <UiButton size="sm" variant="outline" @click="$router.push('/contract')">返回列表</UiButton>
        </div>
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs md:grid-cols-4">
        <div v-for="[k, v] in infoItems" :key="k" class="flex justify-between border-b border-dashed border-[#F2F3F5] py-1">
          <dt class="shrink-0 text-[#86909C]">{{ k }}</dt>
          <dd class="truncate font-medium text-[#1D2129]">{{ v }}</dd>
        </div>
      </dl>
      <div class="mt-3 flex flex-wrap items-center gap-2 rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#4E5969]">
        <span class="text-[#86909C]">合同抬头：</span><span class="font-medium text-[#1D2129]">{{ entity?.fullName ?? '—' }}</span>
        <span class="mx-1 text-[#C9CDD4]">|</span>
        <span class="text-[#86909C]">用印：</span><span>{{ c.seal === 'online' ? '契约锁企业电子章' : '实物章（按主体在册印章）' }}</span>
        <span class="mx-1 text-[#C9CDD4]">|</span>
        <span class="text-[#86909C]">销方税号：</span><span class="font-mono">{{ entity?.taxNo ?? '—' }}</span>
      </div>
    </div>

    <!-- 订单行 -->
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div class="mb-2 text-sm font-semibold text-[#1D2129]">订单行（合同生效即订单生效）</div>
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-1.5">类别 / 产品类型</th><th class="px-3 py-1.5">规格（产品基础数据）</th><th class="px-3 py-1.5 text-right">月租</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in c.lines ?? []" :key="l.id" class="border-b last:border-0">
            <td class="px-3 py-1.5"><div class="font-medium">{{ l.ptype ?? '—' }}</div><div class="text-[10px] text-[#86909C]">{{ l.cat }}</div></td>
            <td class="px-3 py-1.5 font-mono text-[#4E5969]">{{ l.spec || '—' }}</td>
            <td class="px-3 py-1.5 text-right font-mono">{{ l.price != null ? l.price.toLocaleString('zh-CN') : '—' }}</td>
          </tr>
          <tr class="font-semibold">
            <td colspan="2" class="px-3 py-1.5 text-right">月租合计</td>
            <td class="px-3 py-1.5 text-right font-mono">{{ (c.amount ?? 0).toLocaleString('zh-CN') }} 元/月</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 合同申请审批 -->
    <div v-if="c.status === '审批中' || c.status === '已驳回'" class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <template v-if="c.status === '审批中'">
        <div class="mb-2 text-xs font-semibold text-[#165DFF]">合同申请审批中（审批通过 = 转「待出合同」，由业务支撑部出具正式合同）</div>
        <div v-if="instance" class="space-y-2">
          <div v-for="n in instance.nodes" :key="n.seq" class="rounded-[4px] border p-3 text-xs"
            :class="n.result === '驳回' ? 'border-[#F53F3F]' : n.result === '通过' ? 'border-[#E5E6EB]' : n.current ? 'border-[#165DFF] bg-[#F7FAFF]' : 'border-dashed border-[#E5E6EB] opacity-60'">
            <div class="flex items-center justify-between">
              <span class="font-medium text-[#1D2129]">第{{ n.seq }}级 · {{ n.name }}<span class="ml-1 text-[10px] text-[#86909C]">{{ n.approverLabel }}</span></span>
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="n.result === '通过' ? 'bg-[#E8F8F2] text-[#00B42A]' : n.result === '驳回' ? 'bg-[#FFECE8] text-[#F53F3F]' : n.current ? 'bg-[#BEDAFF] text-[#165DFF]' : 'bg-[#F2F3F5] text-[#86909C]'">
                {{ n.result ?? (n.current ? '待审批' : '未开始') }}
              </span>
            </div>
            <div v-if="n.actor" class="mt-1 text-[#86909C]">{{ n.actor }} · {{ (n.actedAt ?? '').slice(0, 16).replace('T', ' ') }}</div>
            <div v-if="n.comment" class="mt-1 leading-5 text-[#4E5969]">意见：{{ n.comment }}</div>
          </div>
          <div class="flex items-center justify-between rounded-[2px] bg-[#F7FAFF] px-3 py-2 text-[11px] text-[#165DFF]">
            <span>审批动作在「审批中心」按节点审批人执行（引擎写回单据状态）</span>
            <router-link to="/approval" class="text-[#165DFF] hover:underline">去审批中心 →</router-link>
          </div>
        </div>
        <div v-else class="rounded-[2px] bg-[#FFF7E8] px-3 py-2 text-[11px] text-[#FF7D00]">未命中已启用的合同审批流，请管理员在「审批流配置」挂接「销售合同 · 提交」</div>
      </template>
      <template v-else>
        <div class="mb-2 text-xs font-semibold text-[#F53F3F]">合同申请被驳回</div>
        <div class="mb-3 rounded-[2px] bg-[#FFECE8] px-3 py-2 text-[11px] leading-5 text-[#B3261E]">
          修改合同要素或订单行后重新提交（生成新审批实例，旧实例留痕）。驳回原因与历史见下方版本历史。
        </div>
        <UiButton size="sm" @click="doResubmit">修改后重新提交审批</UiButton>
      </template>
    </div>
    <div v-else-if="c.status === '待出合同'" class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <span class="text-xs text-[#00701A]">✓ 合同申请审批已通过，业务支撑部出具正式合同并上传后进入「待用章」。审批留痕见下方版本历史。</span>
    </div>
    <div v-else-if="c.status === '待修订'" class="rounded-[4px] border border-[#FFE1B3] bg-[#FFFDF5] p-4">
      <div class="mb-1 text-xs font-semibold text-[#B25E00]">合同待修订</div>
      <div class="mb-3 text-[11px] leading-5 text-[#86909C]">条款修改已登记版本留痕。请修订合同内容后重新提交审批。</div>
      <div class="flex gap-2">
        <UiButton size="sm" @click="doResubmit">重新提交审批</UiButton>
        <UiButton size="sm" variant="outline" @click="$router.push(`/contract/edit?customer=${c.customerId}&deal=${c.opportunityId}`)">去修订合同内容</UiButton>
      </div>
    </div>
    <div v-else-if="c.status === '已生效'" class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div class="flex items-center justify-between">
        <span class="text-xs text-[#00701A]">✓ 合同已生效，核算单已自动建档；交付工单随核算审批生成。</span>
        <router-link to="/cost"><UiButton size="sm">进入成本核算 →</UiButton></router-link>
      </div>
    </div>

    <!-- 应收账单（M5 占位） -->
    <div class="rounded-[4px] border border-dashed border-[#E5E6EB] bg-white p-4">
      <div class="mb-1 text-sm font-semibold text-[#1D2129]">应收账单</div>
      <div class="text-[11px] leading-5 text-[#86909C]">按订阅开通日滚动展开账期（已出账 / 待出账 / 逾期催收）——随财务域（M5）接入，本页将展示完整账单计划。</div>
    </div>

    <!-- 版本历史 -->
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div class="mb-3 text-sm font-semibold text-[#1D2129]">版本历史（{{ (c.versions ?? []).length }}）</div>
      <div v-if="(c.versions ?? []).length" class="relative pl-5">
        <span class="absolute bottom-1 left-[7px] top-1 w-px bg-[#E5E6EB]" />
        <div v-for="v in [...(c.versions ?? [])].reverse()" :key="v.v" class="relative pb-4 last:pb-0">
          <span class="absolute -left-5 top-1 h-3 w-3 rounded-full border-2 border-white shadow" :style="{ background: v.v === (c.versions ?? []).length ? '#165DFF' : '#C9CDD4' }" />
          <div class="text-[10px] text-[#86909C]">v{{ v.v }} · {{ v.at }}</div>
          <div class="mt-0.5 text-[12px] text-[#4E5969]">{{ v.note }}</div>
        </div>
      </div>
      <div v-else class="py-4 text-center text-[12px] text-[#86909C]">暂无版本记录</div>
    </div>

    <!-- 条款修改弹窗 -->
    <CenterModal :model-value="reviseOpen" title="条款修改" sub="修订将登记版本留痕，合同转「待修订」后需重新提交审批" :width="460" @update:model-value="reviseOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">修订类型 <span class="text-[#F53F3F]">*</span></div>
          <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
            <button v-for="t in ['笔误', '非标']" :key="t" class="flex-1 rounded-[2px] px-2 py-1.5 text-xs" :class="reviseType === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'" @click="reviseType = t">{{ t }}</button>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">修订说明</div>
          <textarea v-model="reviseNote" class="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows="2" placeholder="如：带宽 500M 修正为 300M" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="reviseOpen = false">取消</UiButton>
          <UiButton size="sm" @click="doRevise">确认修订</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
  <main v-else class="p-6">
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">
      合同不存在 <router-link class="ml-2 text-[#165DFF] hover:underline" to="/contract">返回列表</router-link>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import CenterModal from '../../components/CenterModal.vue'
import { activeInstance } from '../../api/approval'
import { contractDetail, contractEffect, contractStep, contractTerminate, contractUpdate, entityList, submitContractApproval } from '../../api/mdm'
import type { Instance } from '../../api/approval'
import type { Contract } from '../../api/types'
import type { Entity } from '../../api/mdm'

const ONLINE_STEPS = ['推送契约锁', '我方签署', '客户签署', '回传归档']
const OFFLINE_STEPS = ['用章申请', '盖印上传', '客户回签', '扫描质检']

const STATUS_CLS: Record<string, string> = {
  审批中: 'bg-[#E8F3FF] text-[#165DFF]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
  待出合同: 'bg-[#E8F8F2] text-[#00701A]',
  待用章: 'bg-[#F2F3F5] text-[#4E5969]',
  签署中: 'bg-[#E8F3FF] text-[#165DFF]',
  已生效: 'bg-[#E8F8F2] text-[#00B42A]',
  待修订: 'bg-[#FFF3E8] text-[#FF7D00]',
  已终止: 'bg-[#FFECE8] text-[#F53F3F]',
}

const route = useRoute()
const c = ref<Contract | null>(null)
const entities = ref<Entity[]>([])
const instance = ref<Instance | null>(null)
const reviseOpen = ref(false)
const reviseType = ref<'笔误' | '非标'>('笔误')
const reviseNote = ref('')

const steps = computed(() => (c.value?.seal === 'offline' ? OFFLINE_STEPS : ONLINE_STEPS))
const signing = computed(() => ['待用章', '签署中', '已生效'].includes(c.value?.status ?? ''))
const actionLabel = computed(() => {
  const step = Math.min(c.value?.step ?? 0, 3)
  const seal = c.value?.seal ?? 'online'
  const labels: Record<string, string> = {
    '0-online': '推送至契约锁',
    '1-online': '完成我方签署（企业电子章）',
    '2-online': '客户签署完成并回传',
    '3-online': '确认双方签署版归档',
    '0-offline': '用章申请通过（印章管理员受理）',
    '1-offline': '上传「我方已盖章」附件',
    '2-offline': '客户已签字盖章，标记回签',
    '3-offline': '上传双方签署扫描件（质检通过）',
  }
  return labels[`${step}-${seal}`]
})

const daysLeft = computed(() => {
  if (!c.value?.endDate) return null
  return Math.ceil((new Date(c.value.endDate).getTime() - Date.now()) / 86400000)
})

const entity = computed(() => entities.value.find((e) => e.id === c.value?.entityId))

const infoItems = computed<[string, string][]>(() => {
  if (!c.value) return []
  const v = c.value
  return [
    ['月租合计', `${(v.amount ?? 0).toLocaleString('zh-CN')} 元/月`],
    ['付款方式', v.payCycle ?? '—'],
    ['签约主体', entity.value ? `${entity.value.shortName}（${entity.value.nature}）` : '—'],
    ['折扣', v.discount ? `${v.discount}` : '标准'],
    ['用章方式', v.seal === 'offline' ? '线下 · 实物章' : '线上 · 契约锁'],
    ['合同期限', `${v.startDate ?? '—'} ~ ${v.endDate ?? '—'}`],
    ['关联商机', v.opportunityName ? `${v.opportunityName}` : '—'],
    ['关联特批单', (v as any).specialId ?? '无（标准合同）'],
  ]
})

async function reload() {
  const id = Number(route.query.id)
  if (!id) return
  c.value = await contractDetail(id)
  instance.value = c.value.status === '审批中' ? await activeInstance('销售合同', id) : null
}

async function doAdvance() {
  if (!c.value) return
  if ((c.value.step ?? 0) >= 3) {
    await contractEffect(c.value.id)
    Message.success('合同已生效，核算单自动建档')
  } else {
    await contractStep(c.value.id)
  }
  reload()
}

async function doTerminate() {
  if (!c.value) return
  Modal.warning({
    title: '确认客户拒签？',
    content: '合同将置为「已终止」并留痕，如需重签请重新发起。',
    onOk: async () => {
      await contractTerminate(c.value!.id)
      Message.success('已终止')
      reload()
    },
  })
}

async function doRevise() {
  if (!c.value) return
  await contractUpdate(c.value.id, {
    status: '待修订',
    reviseNote: `版本修订（${reviseType.value}）：${reviseNote.value || '（无说明）'}`,
  })
  Message.success('已登记修订，合同转「待修订」')
  reviseOpen.value = false
  reviseNote.value = ''
  reload()
}

async function doResubmit() {
  if (!c.value) return
  await submitContractApproval(c.value.id)
  Message.success('已重新提交审批（新实例）')
  reload()
}

onMounted(async () => {
  entities.value = await entityList()
  await reload()
})
</script>
