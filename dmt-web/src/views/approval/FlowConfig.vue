<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">审批流配置</span>
        <span class="text-[11px] text-[#86909C]">挂接「单据类型 + 触发动作」，条件表达式用 SpEL 路由分支（如 margin &lt; 45）</span>
      </div>
      <UiButton size="sm" @click="openEdit(null)">＋ 新建审批流</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">流程名称</th><th class="px-3 py-2">单据类型</th><th class="px-3 py-2">触发动作</th>
            <th class="px-3 py-2">分支条件</th><th class="px-3 py-2">节点</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in rows" :key="f.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ f.name }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ f.docType }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ f.triggerAction }}</td>
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ f.conditionExpr ?? '—（恒命中）' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ nodesOf(f.id) }}</td>
            <td class="px-3 py-3">
              <button
                class="rounded-[2px] px-1.5 py-0.5 text-[10px]"
                :class="f.enabled ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#86909C]'"
                @click="toggle(f)"
              >{{ f.enabled ? '启用' : '停用' }}</button>
            </td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(f)">编辑</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      提交时按 id 顺序找第一条「单据类型 + 触发动作」匹配且条件命中的已启用流；全部通过 → 触发写回钩子（核算单/特批/合同状态由引擎 monopoly 写回）；驳回 → 终止并写回「已驳回」。
    </div>

    <CenterModal :model-value="!!editing" :title="editing?.id ? '编辑审批流' : '新建审批流'" :width="640" @update:model-value="editing = null">
      <div v-if="editing" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">流程名称 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="editing.name" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">分支条件（SpEL，可空）</div>
            <UiInput v-model="editing.conditionExpr" placeholder="如 margin < 45" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">单据类型 <span class="text-[#F53F3F]">*</span></div>
            <select v-model="editing.docType" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="t in DOC_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">触发动作</div>
            <select v-model="editing.triggerAction" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>提交</option>
            </select>
          </div>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs text-[#4E5969]">审批节点（按顺序）</span>
            <button class="text-[12px] text-[#165DFF] hover:underline" @click="editing.nodes.push({ seq: editing.nodes.length + 1, name: '', approverType: 'ROLE', approverRef: 'FIN' })">+ 加节点</button>
          </div>
          <div class="space-y-2">
            <div v-for="(n, i) in editing.nodes" :key="i" class="flex items-center gap-2">
              <span class="w-5 text-center font-mono text-[12px] text-[#86909C]">{{ i + 1 }}</span>
              <UiInput v-model="n.name" class="flex-1" placeholder="节点名称" />
              <select v-model="n.approverType" class="h-9 w-28 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
                <option value="ROLE">角色</option>
                <option value="USER">指定人</option>
                <option value="DEPT_LEADER">部门负责人</option>
              </select>
              <select v-if="n.approverType === 'ROLE'" v-model="n.approverRef" class="h-9 w-32 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
                <option value="OPS">支撑部专员</option>
                <option value="TECH">技术部专员</option>
                <option value="FIN">财务专员</option>
                <option value="MANAGER">管理层</option>
              </select>
              <UiInput v-else-if="n.approverType === 'USER'" v-model="n.approverRef" class="w-32" placeholder="用户ID" />
              <span v-else class="w-32 text-[11px] text-[#86909C]">发起人同部门</span>
              <button class="text-[#86909C] hover:text-[#F53F3F]" @click="editing.nodes.splice(i, 1)">✕</button>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="editing = null">取消</UiButton>
          <UiButton size="sm" @click="save">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { flowList, flowNodes, saveFlow, toggleFlow } from '../../api/approval'
import type { FlowDef, FlowNode } from '../../api/approval'

const DOC_TYPES = ['成本核算单', '特批申请单', '销售合同', '资源分配']

const rows = ref<FlowDef[]>([])
const nodeMap = ref<Map<number, FlowNode[]>>(new Map())
interface Editing {
  id?: number
  name: string
  docType: string
  triggerAction: string
  conditionExpr: string
  enabled: number
  nodes: { seq: number; name: string; approverType: string; approverRef: string }[]
}
const editing = ref<Editing | null>(null)

function nodesOf(flowId: number) {
  const list = nodeMap.value.get(flowId) ?? []
  return list.map((n) => n.name).join(' → ')
}

async function load() {
  rows.value = await flowList()
  const map = new Map<number, FlowNode[]>()
  for (const f of rows.value) {
    map.set(f.id, await flowNodes(f.id))
  }
  nodeMap.value = map
}

function openEdit(f: FlowDef | null) {
  if (!f) {
    editing.value = { name: '', docType: '成本核算单', triggerAction: '提交', conditionExpr: '', enabled: 1, nodes: [{ seq: 1, name: '', approverType: 'ROLE', approverRef: 'FIN' }] }
    return
  }
  const nodes = (nodeMap.value.get(f.id) ?? []).map((n) => ({ seq: n.seq, name: n.name, approverType: n.approverType, approverRef: n.approverRef ?? '' }))
  editing.value = { id: f.id, name: f.name, docType: f.docType, triggerAction: f.triggerAction, conditionExpr: f.conditionExpr ?? '', enabled: f.enabled, nodes }
}

async function save() {
  const e = editing.value
  if (!e?.name) return
  await saveFlow(
    {
      name: e.name, docType: e.docType, triggerAction: e.triggerAction,
      conditionExpr: e.conditionExpr || undefined, enabled: e.enabled,
      nodes: e.nodes.filter((n) => n.name).map((n) => ({ seq: n.seq, name: n.name, approverType: n.approverType, approverRef: n.approverRef || undefined })),
    },
    e.id,
  )
  editing.value = null
  load()
}

async function toggle(f: FlowDef) {
  await toggleFlow(f.id, f.enabled ? 0 : 1)
  load()
}

onMounted(load)
</script>
