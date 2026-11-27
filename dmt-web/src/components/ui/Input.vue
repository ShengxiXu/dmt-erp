<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    class="h-9 w-full min-w-0 rounded-[2px] border border-[#E5E6EB] bg-transparent px-3 text-sm text-[#1D2129] shadow-xs outline-none transition-[color,box-shadow] placeholder:text-[#C9CDD4] disabled:cursor-not-allowed disabled:opacity-50 focus:border-[#165DFF] focus:ring-[2px] focus:ring-[#165DFF]/20"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @keydown="$emit('keydown', $event)"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  type?: string
  placeholder?: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
  keydown: [event: KeyboardEvent]
}>()
</script>
