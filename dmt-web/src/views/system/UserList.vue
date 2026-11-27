<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">系统用户</span>
        <UiInput v-model="kw" class="w-56" placeholder="搜索用户名 / 姓名" @keydown.enter="load(1)" />
      </div>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">用户名</th><th class="px-3 py-2">姓名</th><th class="px-3 py-2">手机号</th>
            <th class="px-3 py-2">部门</th><th class="px-3 py-2">角色</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">数据范围</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in rows" :key="u.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#1D2129]">{{ u.username }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ u.name }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ u.mobile ?? '—' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ u.deptName ?? '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] bg-[#F0F5FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{{ u.roleNames?.join('、') || '—' }}</span></td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="u.status === '启用' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#FFECE8] text-[#F53F3F]'">{{ u.status }}</span></td>
            <td class="px-3 py-3 text-[#86909C]">{{ roleScope(u.roleIds) }}</td>
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
      用户与角色维护（建号 / 角色分配 / 启停 / 改密）在原型「权限矩阵」中配置；本页为只读总览。角色数据范围：ALL 全部 / DEPT 本部门 / SELF 仅本人。
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UiInput from '../../components/ui/Input.vue'
import { userPage } from '../../api/prd'
import type { UserVo } from '../../api/types'

const rows = ref<UserVo[]>([])
const kw = ref('')
const pageNum = ref(1)
const pageSize = 10
const total = ref(0)

function roleScope(roleIds: number[]) {
  if (roleIds.includes(1) || roleIds.includes(6)) return 'ALL'
  if (roleIds.includes(2) || roleIds.includes(3) || roleIds.includes(5)) return 'DEPT'
  return 'SELF'
}

async function load(page?: number) {
  if (page) pageNum.value = page
  const data = await userPage({ kw: kw.value || undefined, pageNum: pageNum.value, pageSize })
  rows.value = data.records
  total.value = data.total
}

onMounted(() => load(1))
</script>
