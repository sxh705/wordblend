<script setup>
defineProps({ modelValue: Number, disabled: Boolean })
defineEmits(['update:modelValue'])

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
</script>

<template>
  <div class="grid grid-cols-10 gap-1">
    <button
      v-for="n in LEVELS"
      :key="n"
      type="button"
      class="h-7 rounded-md border font-mono text-[11px] leading-none transition-colors duration-100"
      :class="[
        n === modelValue
          ? 'border-mint/70 bg-mint/18 text-mintsoft'
          : 'border-white/10 bg-white/[0.04] text-[#9fb0aa] hover:bg-white/[0.09]',
        disabled ? 'opacity-40' : ''
      ]"
      @click="$emit('update:modelValue', n)"
    >
      {{ n }}
    </button>
  </div>
</template>
