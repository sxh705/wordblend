<script setup>
import { computed } from 'vue'
import { BANKS } from '../store.js'

const props = defineProps({ modelValue: Array, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])

const TIERS = [
  { id: 1, name: '基础' },
  { id: 2, name: '进阶' },
  { id: 3, name: '专业' },
  { id: 4, name: '垂直' }
]

const groups = computed(() =>
  TIERS.map((t) => ({ ...t, list: BANKS.filter((b) => b.tier === t.id) })).filter((g) => g.list.length)
)

function toggle(id) {
  const cur = props.modelValue || []
  const has = cur.includes(id)
  if (has && cur.length === 1) return
  const next = has ? cur.filter((x) => x !== id) : [...cur, id]
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="g in groups" :key="g.id">
      <div class="mb-1 font-mono text-[10px] uppercase tracking-wide text-dim">{{ g.name }}</div>
      <div class="grid grid-cols-2 gap-1">
        <button
          v-for="b in g.list"
          :key="b.id"
          type="button"
          class="flex items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-left transition-colors duration-100"
          :class="[
            (modelValue || []).includes(b.id)
              ? 'border-mint/55 bg-mint/12 text-mintsoft'
              : 'border-white/10 bg-white/[0.03] text-[#9fb0aa] hover:bg-white/[0.07]',
            disabled ? 'opacity-40' : ''
          ]"
          @click="toggle(b.id)"
        >
          <span class="truncate text-[11.5px]">{{ b.name }}</span>
          <span class="shrink-0 font-mono text-[9.5px] opacity-55">{{ b.count > 999 ? Math.round(b.count / 100) / 10 + 'k' : b.count }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
