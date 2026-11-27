<template>
  <span
    :class="[
      'inline-flex items-center rounded-[2px] px-1.5 py-0.5 text-[11px] leading-4',
      tone === 'blue' && 'bg-[#E8F3FF] text-[#165DFF]',
      tone === 'green' && 'bg-[#E8F8F2] text-[#00B42A]',
      tone === 'red' && 'bg-[#FFECE8] text-[#F53F3F]',
      tone === 'orange' && 'bg-[#FFF3E8] text-[#FF7D00]',
      tone === 'gray' && 'bg-[#F2F3F5] text-[#4E5969]',
    ]"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'blue' | 'green' | 'red' | 'orange' | 'gray' }>(), { tone: 'gray' })
</script>
