<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="$emit('update:modelValue', false)">
      <div class="flex max-h-[90vh] w-full flex-col rounded-[8px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]" :style="{ maxWidth: `${width}px` }">
        <div class="flex items-start justify-between border-b border-[#F2F3F5] px-5 py-3.5">
          <div>
            <div class="text-[15px] font-semibold text-[#1D2129]">{{ title }}</div>
            <div v-if="sub" class="mt-0.5 text-[12px] text-[#86909C]">{{ sub }}</div>
          </div>
          <button class="rounded-[2px] p-1 text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#1D2129]" @click="$emit('update:modelValue', false)">
            <X :size="16" />
          </button>
        </div>
        <div class="overflow-y-auto px-5 py-4">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'

withDefaults(defineProps<{ modelValue: boolean; title: string; sub?: string; width?: number }>(), {
  width: 560,
})

defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>
