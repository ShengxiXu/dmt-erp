<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">审批中心</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in [['todo', `待我审批（${todoTotal}）`], ['done', '我已办']] as const"
            :key="t[0]"
            class="rounded-[2px] px-3 py-1 text-xs"
            :class="tab === t[0] ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t[0]; load(1)"
          >{{ t[1] }}</button>
        </div>
        <UiInput v-model="kw" class="w-52" placeholder="搜索单据号 / 摘要 / 审批流" />
        <span class="text-[11px] text-[#86909C]">共 {{ filteredRows.length }} 条审批实例 · 覆盖核算单 / 采购单 / 合同 / 坏账申请等全部接入单据</span>
      </div>
      <router-link to="/system/approval" class="shrink-0 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">审批流配置</router-link>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">单据号</th><th class="px-3 py-2">单据类型</th><th class="px-3 py-2">摘要</th>
            <th class="px-3 py-2">审批流 / 分支</th><th class="px-3 py-2">当前节点</th>
            <th class="px-3 py-2">提交人 / 时间</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in filteredRows" :key="i.id" class="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" @click="open(i)">
            <td class="px-3 py-3 font-mono text-[#165DFF]">{{ i.docSummary }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{{ i.docType }}</span></td>
            <td class="max-w-52 truncate px-3 py-3 text-[#4E5969]" :title="i.docSummary">{{ i.docSummary }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ i.flowName }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ currentNodeName(i) }}</td>
            <td class="px-3 py-3">
              <div class="text-[#4E5969]">{{ i.submitter }}</div>
              <div class="text-[10px] text-[#86909C]">{{ ((i as unknown as { createdAt?: string }).createdAt ?? '').slice(0, 16).replace('T', ' ') }}</div>
            </td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STATUS_CLS[i.status]">{{ i.status }}</span></td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">{{ i.status === '审批中' ? '去审批' : '查看' }}</button>
            </td>
          </tr>
          <tr v-if="!filteredRows.length">
            <td colspan="8" class="px-3 py-10 text-center text-[#86909C]">{{ tab === 'todo' ? '当前没有待你审批的单据' : '暂无记录' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 实例详情 -->
    <CenterModal :model-value="!!detail" :title="`${detail?.docSummary ?? ''} · 审批实例`" :sub="detail ? `${detail.docType} · 流程「${detail.flowName}」 · 发起人 ${detail.submitter}` : ''" :width="560" @update:model-value="detail = null">
      <template v-if="detail">
        <div class="space-y-4">
          <div class="space-y-2">
            <div
              v-for="n in detail.nodes"
              :key="n.seq"
              class="rounded-[4px] border p-3 text-xs"
              :class="n.result === '驳回' ? 'border-[#F53F3F]' : n.result === '通过' ? 'border-[#E5E6EB]' : n.current ? 'border-[#165DFF] bg-[#F7FAFF]' : 'border-dashed border-[#E5E6EB] opacity-60'"
            >
              <div class="flex items-center justify-between">
                <span class="font-medium text-[#1D2129]">第{{ n.seq }}级 · {{ n.name }}<span class="ml-1 text-[10px] text-[#86909C]">{{ n.approverLabel }}</span></span>
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="n.result === '通过' ? 'bg-[#E8F8F2] text-[#00B42A]' : n.result === '驳回' ? 'bg-[#FFECE8] text-[#F53F3F]' : n.current ? 'bg-[#BEDAFF] text-[#165DFF]' : 'bg-[#F2F3F5] text-[#86909C]'">
                  {{ n.result ?? (n.current ? '待审批' : '未开始') }}
                </span>
              </div>
              <div class="mt-1 text-[#86909C]">{{ n.actor ? `${n.actor} · ${(n.actedAt ?? '').slice(0, 16).replace('T', ' ')}` : ' ' }}</div>
              <div v-if="n.comment" class="mt-1 leading-5 text-[#4E5969]">意见：{{ n.comment }}</div>
            </div>
          </div>

          <div v-if="canAct" class="rounded-[4px] border border-[#BEDAFF] bg-[#F7FAFF] p-3">
            <div class="mb-1.5 text-xs font-semibold text-[#165DFF]">当前节点待你审批</div>
            <UiInput v-model="comment" placeholder="审批意见（驳回时必填）" />
            <div class="mt-2 flex gap-2">
              <UiButton size="sm" @click="doAct(true)">通过</UiButton>
              <UiButton size="sm" variant="outline" @click="doAct(false)">驳回</UiButton>
            </div>
          </div>

          <div v-if="detail.status === '已驳回'" class="rounded-[4px] border border-[#FFE1B3] bg-[#FFF7E8] p-3 text-[11px] leading-5 text-[#B25E00]">
            驳回后单据回到可编辑态；修改后可在原单据重新提交生成新实例（旧实例留痕）。
          </div>
        </div>
      </template>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { actInstance, donePage, instanceDetail, todoPage } from '../../api/approval'
import type { Instance } from '../../api/approval'

const STATUS_CLS: Record<string, string> = {
  审批中: 'bg-[#FFF3E8] text-[#FF7D00]',
  已通过: 'bg-[#E8F8F2] text-[#00B42A]',
  已驳回: 'bg-[#FFECE8] text-[#F53F3F]',
}

const tab = ref<'todo' | 'done'>('todo')
const rows = ref<Instance[]>([])
const kw = ref('')
const filteredRows = computed(() => rows.value.filter((i) =>
  !kw.value || i.docSummary.includes(kw.value) || i.flowName.includes(kw.value) || i.docType.includes(kw.value)))
const todoTotal = ref(0)
const pageNum = ref(1)
const pageSize = 10
const detail = ref<Instance | null>(null)
const comment = ref('')

const canAct = computed(() => {
  if (!detail.value || detail.value.status !== '审批中') return false
  const cur = detail.value.nodes.find((n) => n.current)
  return !!cur
})

function currentNodeName(i: Instance) {
  const cur = i.nodes.find((n) => n.current)
  return cur ? `${cur.name}（${cur.approverLabel}）` : '—'
}

async function load(page?: number) {
  if (page) pageNum.value = page
  const fn = tab.value === 'todo' ? todoPage : donePage
  const data = await fn({ pageNum: pageNum.value, pageSize })
  rows.value = data.records
  if (tab.value === 'todo') {
    const first = await todoPage({ pageNum: 1, pageSize: 1 })
    todoTotal.value = data.total
    void first
  }
}

async function open(i: Instance) {
  detail.value = await instanceDetail(i.id)
  comment.value = ''
}

async function doAct(approve: boolean) {
  if (!detail.value) return
  await actInstance(detail.value.id, approve, comment.value || undefined)
  detail.value = await instanceDetail(detail.value.id)
  load()
}

onMounted(() => load(1))
</script>
