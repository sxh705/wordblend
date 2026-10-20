<script setup>
defineProps({ modelValue: Boolean })
defineEmits(['update:modelValue'])
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150"
    :class="modelValue ? 'bg-mint/90' : 'bg-white/12'"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span
      class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-150"
      :class="modelValue ? 'left-[22px]' : 'left-0.5'"
    />
  </button>
</template>
