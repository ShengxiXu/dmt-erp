<template>
  <div ref="root" class="relative">
    <div v-if="current" class="flex items-center justify-between rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-2 py-1.5 text-sm">
      <span>
        <span class="font-medium text-[#1D2129]">{{ current.name }}</span>
        <span class="ml-2 text-xs text-[#86909C]">CU-{{ String(current.id).padStart(4, '0') }} · 归属 {{ current.salesName ?? '—' }}</span>
      </span>
      <button class="text-xs text-[#86909C] hover:text-[#F53F3F]" @click="clear">✕</button>
    </div>
    <div v-else>
      <UiInput
        v-model="kw"
        placeholder="搜索客户档案…（仅可选择，新客户请先到客户档案维护）"
        @focus="open = true"
        @update:model-value="open = true"
      />
      <template v-if="open">
        <div class="fixed inset-0 z-10" @click="open = false" />
        <div
          class="fixed z-20 max-h-52 overflow-y-auto rounded-[4px] border border-[#E5E6EB] bg-white shadow-lg"
          :style="{ top: pos.top + 'px', left: pos.left + 'px', width: pos.width + 'px' }"
        >
          <button
            v-for="c in list"
            :key="c.id"
            class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#F7F8FA]"
            @click="pick(c)"
          >
            <span>
              <span class="font-medium text-[#1D2129]">{{ c.name }}</span>
              <span class="ml-2 text-xs text-[#86909C]">{{ c.industry }} · {{ c.status }}</span>
            </span>
            <span class="font-mono text-[10px] text-[#C9CDD4]">CU-{{ String(c.id).padStart(4, '0') }}</span>
          </button>
          <div v-if="!list.length" class="px-3 py-3 text-xs text-[#86909C]">无匹配客户</div>
          <router-link to="/customer" class="block border-t px-3 py-2 text-xs text-[#165DFF] hover:bg-[#F7FAFF]" @click="open = false">＋ 到客户档案新建客户 →</router-link>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import UiInput from './ui/Input.vue'
import type { Customer } from '../api/types'

const props = defineProps<{
  modelValue?: number
  customers: Customer[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number | undefined] }>()

const kw = ref('')
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, left: 0, width: 0 })

const current = computed(() => props.customers.find((c) => c.id === props.modelValue))
const list = computed(() => props.customers.filter((c) => !kw.value || c.name.includes(kw.value)))

function place() {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  pos.value = { top: r.bottom + 4, left: r.left, width: r.width }
}

watch(open, (v) => {
  if (v) {
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
  } else {
    window.removeEventListener('scroll', place, true)
    window.removeEventListener('resize', place)
  }
})

function pick(c: Customer) {
  emit('update:modelValue', c.id)
  open.value = false
  kw.value = ''
}

function clear() {
  emit('update:modelValue', undefined)
  kw.value = ''
}

onMounted(place)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('resize', place)
})
</script>
