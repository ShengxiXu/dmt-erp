<template>
  <div class="space-y-1.5">
    <div class="flex gap-1.5">
      <select
        class="h-9 w-32 shrink-0 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        :value="parts.prov"
        :disabled="disabled"
        @change="set({ prov: ($event.target as HTMLSelectElement).value, city: '', dist: '' })"
      >
        <option value="">省份</option>
        <option v-for="p in REGIONS" :key="p[0]" :value="p[0]">{{ p[0] }}</option>
      </select>
      <select
        class="h-9 flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        :value="parts.city"
        :disabled="disabled || !parts.prov"
        @change="set({ city: ($event.target as HTMLSelectElement).value, dist: '' })"
      >
        <option value="">城市</option>
        <option v-for="c in cities" :key="c[0]" :value="c[0]">{{ c[0] }}</option>
      </select>
      <select
        class="h-9 flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        :value="parts.dist"
        :disabled="disabled || !parts.city"
        @change="set({ dist: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">区/县</option>
        <option v-for="d in districts" :key="d" :value="d">{{ d }}</option>
      </select>
    </div>
    <UiInput
      v-if="withDetail"
      :model-value="parts.detail"
      :placeholder="detailPlaceholder ?? '详细地址（路名、门牌号、楼层房间等）'"
      :disabled="disabled"
      @update:model-value="set({ detail: $event })"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiInput from './ui/Input.vue'
import { REGIONS } from '../data/regions'

interface RegionParts {
  prov: string
  city: string
  dist: string
  detail: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    withDetail?: boolean
    detailPlaceholder?: string
    disabled?: boolean
  }>(),
  { withDetail: false, detailPlaceholder: '', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function shorts(name: string): string[] {
  const s = name.replace(/(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|自治州|省|市|地区|盟|州)$/, '')
  return s !== name ? [name, s] : [name]
}

function matchPrefix(rest: string, names: string[]): [string, string] | null {
  const sorted = [...names].sort((a, b) => b.length - a.length)
  for (const n of sorted) {
    for (const s of shorts(n)) {
      if (s && rest.startsWith(s)) return [n, rest.slice(s.length)]
    }
  }
  return null
}

function isMunicipality(prov: string) {
  const node = REGIONS.find((p) => p[0] === prov)
  return !!node && node[1].length === 1 && node[1][0][0] === prov
}

function joinRegion(r: RegionParts) {
  const citySeg = r.city && r.city !== r.prov ? r.city : ''
  return `${r.prov}${citySeg}${r.dist}${r.detail ?? ''}`.trim()
}

function parseRegion(value: string): RegionParts {
  let rest = (value ?? '').trim()
  let prov = ''
  let city = ''
  let dist = ''
  const pm = matchPrefix(rest, REGIONS.map((p) => p[0]))
  if (pm) {
    ;[prov, rest] = pm
    const cities = REGIONS.find((p) => p[0] === prov)?.[1] ?? []
    if (isMunicipality(prov)) {
      city = cities[0][0]
    } else {
      const cm = matchPrefix(rest, cities.map((c) => c[0]))
      if (cm) {
        ;[city, rest] = cm
        const dm = matchPrefix(rest, cities.find((c) => c[0] === city)?.[1] ?? [])
        if (dm) [dist, rest] = dm
      }
    }
    if (city && !dist) {
      const dm = matchPrefix(rest, cities.find((c) => c[0] === city)?.[1] ?? [])
      if (dm) [dist, rest] = dm
    }
  }
  return { prov, city, dist, detail: rest }
}

const parts = computed(() => parseRegion(props.modelValue))
const cities = computed(() => REGIONS.find((p) => p[0] === parts.value.prov)?.[1] ?? [])
const districts = computed(() => cities.value.find((c) => c[0] === parts.value.city)?.[1] ?? [])

function set(patch: Partial<RegionParts>) {
  emit('update:modelValue', joinRegion({ ...parts.value, ...patch }))
}
</script>
