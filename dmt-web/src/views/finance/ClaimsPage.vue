<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">回款认领</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '未认领', '部分认领', '已核销', '已红冲']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >{{ t }}</button>
        </div>
      </div>
      <UiButton size="sm" @click="createOpen = true">＋ 录入流水</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">流水号</th><th class="px-3 py-2">付款方</th><th class="px-3 py-2 text-right">金额</th>
            <th class="px-3 py-2">到账时间</th><th class="px-3 py-2 text-right">已认领</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in rows" :key="f.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ f.flowNo }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ f.payer }}</td>
            <td class="px-3 py-3 text-right font-mono" :class="f.amount < 0 ? 'text-[#F53F3F]' : ''">{{ f.amount.toLocaleString('zh-CN') }}</td>
            <td class="px-3 py-3 text-[#86909C]">{{ (f.arrivedAt ?? '').slice(0, 16).replace('T', ' ') }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ (f.claimedAmt ?? 0).toLocaleString('zh-CN') }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="CLS[f.status]">{{ f.status }}</span></td>
            <td class="px-3 py-3 text-right">
              <button v-if="!['已核销', '已红冲'].includes(f.status)" class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openClaim(f)">认领</button>
              <button v-if="f.status !== '已红冲'" class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="doRedFlush(f)">红冲</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="7" class="px-3 py-10 text-center text-[#86909C]">暂无流水</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 认领弹窗 -->
    <CenterModal :model-value="!!claiming" :title="`认领 · ${claiming?.flowNo ?? ''}`" :sub="claiming ? `${claiming.payer} · ${claiming.amount.toLocaleString('zh-CN')} 元` : ''" :width="640" @update:model-value="claiming = null">
      <div v-if="claiming" class="space-y-3">
        <div class="rounded-[4px] border border-[#E5E6EB] p-3 text-xs">
          <div class="mb-2 font-semibold text-[#4E5969]">自动认领建议（付款方 ≈ 客户名，未收讫账单）</div>
          <div v-if="matchData?.suggestions?.length" class="space-y-1.5">
            <div v-for="s in matchData.suggestions" :key="s.billId" class="flex items-center gap-3">
              <span class="font-mono text-[#165DFF]">{{ s.billNo }}</span>
              <span class="text-[#86909C]">{{ s.period ?? '—' }} · 余额 <span class="font-mono text-[#1D2129]">{{ s.balance.toLocaleString('zh-CN') }}</span></span>
              <button class="ml-auto rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]" @click="addAlloc(s)">＋ 加入认领</button>
            </div>
          </div>
          <div v-else class="text-[#86909C]">无匹配账单（付款方未匹配到客户或无未收讫账单）</div>
        </div>
        <div>
          <div class="mb-1 text-xs font-semibold text-[#4E5969]">认领分配（合计 {{ allocTotal.toLocaleString('zh-CN') }} / 剩余可认领 {{ (claiming.amount - (claiming.claimedAmt ?? 0)).toLocaleString('zh-CN') }} 元）</div>
          <div v-for="(a, i) in allocs" :key="i" class="mb-1.5 flex items-center gap-2">
            <span class="w-36 truncate font-mono text-[11px] text-[#4E5969]">{{ billNoOf(a.billId) }}</span>
            <UiInput v-model="a.amountText" type="number" class="flex-1" />
            <button class="text-[#86909C] hover:text-[#F53F3F]" @click="allocs.splice(i, 1)">✕</button>
          </div>
          <div v-if="!allocs.length" class="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#86909C]">点击上方「加入认领」或手动填写账单 ID</div>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="claiming = null">取消</UiButton>
          <UiButton size="sm" :disabled="!allocs.length" @click="doClaim">确认认领并核销</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 录入流水 -->
    <CenterModal :model-value="createOpen" title="录入银行流水" :width="460" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">付款方 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="newFlow.payer" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">金额（元）<span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="newFlow.amountText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">方式</div>
            <select v-model="newFlow.method" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="m in ['银行转账', '承兑汇票', '现金', '其他']" :key="m">{{ m }}</option>
            </select>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">银行流水号</div>
          <UiInput v-model="newFlow.referenceNo" />
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" @click="doCreate">保存</UiButton>
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
import { claimFlow, createFlow, flowMatch, flowPage, redFlushFlow } from '../../api/fin'
import type { BankFlow } from '../../api/fin'

const CLS: Record<string, string> = {
  未认领: 'bg-[#FFF3E8] text-[#FF7D00]',
  部分认领: 'bg-[#E8F3FF] text-[#165DFF]',
  已核销: 'bg-[#E8F8F2] text-[#00B42A]',
  已红冲: 'bg-[#FFECE8] text-[#F53F3F]',
}

const tab = ref('全部')
const rows = ref<BankFlow[]>([])
const pageNum = ref(1)
const pageSize = 20
const claiming = ref<BankFlow | null>(null)
const matchData = ref<{ suggestions: { billId: number; billNo: string; period?: string; balance: number }[] } | null>(null)
const allocs = ref<{ billId: number; amountText: string }[]>([])
const createOpen = ref(false)
const newFlow = ref({ payer: '', amountText: '', method: '银行转账', referenceNo: '' })

const allocTotal = computed(() => allocs.value.reduce((s, a) => s + (Number(a.amountText) || 0), 0))

function billNoOf(billId: number) {
  return matchData.value?.suggestions?.find((s) => s.billId === billId)?.billNo ?? `账单 #${billId}`
}

async function load(page?: number) {
  if (page) pageNum.value = page
  const params: Record<string, unknown> = { pageNum: pageNum.value, pageSize }
  if (tab.value !== '全部') params.status = tab.value
  rows.value = (await flowPage(params)).records
}

async function openClaim(f: BankFlow) {
  claiming.value = f
  allocs.value = []
  matchData.value = await flowMatch(f.id)
}

function addAlloc(s: { billId: number; balance: number }) {
  if (!allocs.value.some((a) => a.billId === s.billId)) {
    allocs.value.push({ billId: s.billId, amountText: String(s.balance) })
  }
}

async function doClaim() {
  if (!claiming.value) return
  const payload = allocs.value.filter((a) => Number(a.amountText) > 0).map((a) => ({ billId: a.billId, amount: Number(a.amountText) }))
  await claimFlow(claiming.value.id, payload)
  Message.success('认领完成：收款登记已生成，账单已核销')
  claiming.value = null
  load()
}

function doRedFlush(f: BankFlow) {
  Modal.warning({
    title: `红冲流水 ${f.flowNo}？`,
    content: '将生成反向流水；已认领部分自动反核销，原流水留痕不删除。',
    onOk: async () => {
      await redFlushFlow(f.id)
      Message.success('已红冲')
      load()
    },
  })
}

async function doCreate() {
  if (!newFlow.value.payer || !newFlow.value.amountText) return
  await createFlow({
    payer: newFlow.value.payer,
    amount: Number(newFlow.value.amountText),
    method: newFlow.value.method,
    referenceNo: newFlow.value.referenceNo || undefined,
  })
  Message.success('流水已录入')
  createOpen.value = false
  newFlow.value = { payer: '', amountText: '', method: '银行转账', referenceNo: '' }
  load()
}

onMounted(() => load(1))
</script>
