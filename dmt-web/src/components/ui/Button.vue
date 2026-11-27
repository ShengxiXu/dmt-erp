<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[2px] px-4 text-sm font-medium transition-all outline-none',
      'disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
      variant === 'default' && 'bg-[#165DFF] text-white hover:bg-[#4080FF]',
      variant === 'outline' && 'border border-[#E5E6EB] bg-white text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]',
      variant === 'danger' && 'bg-[#F53F3F] text-white hover:bg-[#FF6B4D]',
      variant === 'ghost' && 'text-[#4E5969] hover:bg-[#F2F3F5]',
      size === 'sm' && 'h-8 px-3 text-[13px]',
      size === 'lg' && 'h-10 px-6',
    ]"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'outline' | 'danger' | 'ghost'
    size?: 'default' | 'sm' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  { variant: 'default', size: 'default', type: 'button', disabled: false },
)
</script>
