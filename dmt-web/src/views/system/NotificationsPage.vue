<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-[#1D2129]">通知中心</span>
        <div class="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          <button
            v-for="t in ['全部', '未读']"
            :key="t"
            class="rounded-[2px] px-2.5 py-1 text-xs"
            :class="tab === t ? 'bg-[#165DFF] text-white' : 'text-[#4E5969] hover:bg-[#F2F3F5]'"
            @click="tab = t; load(1)"
          >{{ t }}</button>
        </div>
      </div>
      <UiButton size="sm" variant="outline" @click="readAll">全部已读</UiButton>
    </div>

    <div class="overflow-hidden rounded-[4px] border border-[#E5E6EB] bg-white">
      <div
        v-for="n in rows"
        :key="n.id"
        class="flex items-start gap-3 border-b px-4 py-3 last:border-0 hover:bg-[#F7F8FA]"
        :class="n.isRead ? '' : 'bg-[#F7FAFF]'"
      >
        <span class="mt-1 h-2 w-2 shrink-0 rounded-full" :class="n.isRead ? 'bg-[#E5E6EB]' : 'bg-[#165DFF]'" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium" :class="n.isRead ? 'text-[#4E5969]' : 'text-[#1D2129]'">{{ n.title }}</span>
            <span v-if="n.type" class="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#86909C]">{{ n.type }}</span>
          </div>
          <div v-if="n.content" class="mt-0.5 text-[11px] leading-4 text-[#86909C]">{{ n.content }}</div>
        </div>
        <span class="shrink-0 text-[10px] text-[#C9CDD4]">{{ (n.createdAt ?? '').slice(0, 16).replace('T', ' ') }}</span>
        <button v-if="!n.isRead" class="shrink-0 text-[11px] text-[#165DFF] hover:underline" @click="readOne(n.id)">标为已读</button>
      </div>
      <div v-if="!rows.length" class="px-4 py-10 text-center text-xs text-[#86909C]">暂无通知</div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import { markNotificationsRead, notificationPage } from '../../api/sys'
import type { Notification } from '../../api/sys'

const tab = ref('全部')
const rows = ref<Notification[]>([])

async function load(page?: number) {
  const params: Record<string, unknown> = { pageNum: page ?? 1, pageSize: 50 }
  if (tab.value === '未读') params.unread = 1
  rows.value = (await notificationPage(params)).records
}

async function readOne(id: number) {
  await markNotificationsRead([id])
  load()
}

async function readAll() {
  await markNotificationsRead(null, true)
  Message.success('已全部标为已读')
  load()
}

onMounted(() => load(1))
</script>
