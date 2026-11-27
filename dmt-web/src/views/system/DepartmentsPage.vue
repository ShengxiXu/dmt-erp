<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-[#1D2129]">部门管理</span>
        <span class="text-xs text-[#86909C]">部门主数据：用户档案、数据权限「本部门」、审批链「部门负责人」节点全部从这里取数</span>
      </div>
      <UiButton size="sm" @click="openCreate">＋ 新建部门</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">部门名称</th><th class="px-3 py-2">上级部门</th>
            <th class="px-3 py-2 text-right">成员数</th><th class="px-3 py-2">成员</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in rows" :key="d.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ d.name }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ parentName(d.parentId) }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ membersOf(d.id).length }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ membersOf(d.id).map((u) => u.name).join('、') || '—' }}</td>
            <td class="px-3 py-3 text-right">
              <button class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(d)">编辑</button>
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="doDelete(d)">删除</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="5" class="px-3 py-10 text-center text-[#86909C]">暂无部门</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      改名同步迁移所有成员档案；有成员的部门不可删除；「部门负责人」审批节点按部门成员解析。
    </div>

    <CenterModal :model-value="editorOpen" :title="form.id ? `编辑部门 · ${form.name}` : '新建部门'" :width="460" @update:model-value="editorOpen = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">部门名称 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.name" />
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">上级部门</div>
          <select v-model="form.parentId" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option :value="undefined">（无上级）</option>
            <option v-for="d in rows.filter((r) => r.id !== form.id)" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="editorOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.name" @click="doSave">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { createDept, deleteDept, deptList, updateDept } from '../../api/dept'
import type { Dept } from '../../api/dept'
import { userPage } from '../../api/prd'
import type { UserVo } from '../../api/types'

const rows = ref<Dept[]>([])
const users = ref<UserVo[]>([])
const editorOpen = ref(false)
const form = ref({ id: undefined as number | undefined, name: '', parentId: undefined as number | undefined })

function parentName(parentId?: number) {
  if (!parentId) return '—'
  return rows.value.find((d) => d.id === parentId)?.name ?? `#${parentId}`
}

function membersOf(deptId: number) {
  return users.value.filter((u) => u.deptId === deptId)
}

async function load() {
  rows.value = await deptList()
}

function openCreate() {
  form.value = { id: undefined, name: '', parentId: undefined }
  editorOpen.value = true
}

function openEdit(d: Dept) {
  form.value = { id: d.id, name: d.name, parentId: d.parentId }
  editorOpen.value = true
}

async function doSave() {
  const f = form.value
  if (f.id) {
    await updateDept(f.id, { name: f.name, parentId: f.parentId })
  } else {
    await createDept({ name: f.name, parentId: f.parentId })
  }
  Message.success('部门已保存')
  editorOpen.value = false
  load()
}

function doDelete(d: Dept) {
  Modal.warning({
    title: `删除部门「${d.name}」？`,
    content: membersOf(d.id).length ? '该部门仍有成员，删除将被服务端拦截。' : '删除后不可恢复。',
    onOk: async () => {
      await deleteDept(d.id)
      Message.success('已删除')
      load()
    },
  })
}

onMounted(async () => {
  await load()
  users.value = (await userPage({ pageNum: 1, pageSize: 200 })).records
})
</script>
