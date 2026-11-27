<template>
  <div ref="root" class="relative w-80">
    <div class="flex h-9 items-center gap-2 rounded-[4px] border border-[#E5E6EB] bg-[#F7F8FA] px-3">
      <Search :size="14" class="shrink-0 text-[#86909C]" />
      <input
        v-model="kw"
        class="w-full bg-transparent text-[13px] outline-none placeholder:text-[#C9CDD4]"
        placeholder="搜索客户 / 合同 / 核算单 / 工单"
        @focus="open = true"
        @input="onInput"
        @keydown.esc="open = false"
      />
      <kbd class="shrink-0 rounded-[2px] border border-[#E5E6EB] bg-white px-1 text-[10px] text-[#86909C]">Ctrl K</kbd>
    </div>
    <template v-if="open && kw">
      <div class="fixed inset-0 z-40" @click="open = false" />
      <div class="absolute left-0 right-0 top-10 z-50 max-h-96 overflow-y-auto rounded-[4px] border border-[#E5E6EB] bg-white py-1 shadow-lg">
        <template v-for="g in groups" :key="g.label">
          <div v-if="g.items.length" class="px-3 pb-0.5 pt-2 text-[10px] font-semibold text-[#86909C]">{{ g.label }}</div>
          <button
            v-for="it in g.items"
            :key="g.label + it.id"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-[#F7F8FA]"
            @click="go(it.to)"
          >
            <span class="font-mono text-[#165DFF]">{{ it.code }}</span>
            <span class="min-w-0 flex-1 truncate text-[#1D2129]">{{ it.name }}</span>
            <span class="shrink-0 text-[10px] text-[#86909C]">{{ it.extra }}</span>
          </button>
        </template>
        <div v-if="!groups.some((g) => g.items.length)" class="px-3 py-4 text-center text-xs text-[#86909C]">
          {{ loading ? '搜索中…' : '无匹配结果' }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { customerPage, contractPage } from '../api/mdm'
import { sheetPage } from '../api/cost'
import { woPage } from '../api/wo'

interface Hit { id: number; code: string; name: string; extra?: string; to: string }

const router = useRouter()
const root = ref<HTMLElement | null>(null)
const kw = ref('')
const open = ref(false)
const loading = ref(false)
const customers = ref<Hit[]>([])
const contracts = ref<Hit[]>([])
const sheets = ref<Hit[]>([])
const wos = ref<Hit[]>([])

const groups = ref<{ label: string; items: Hit[] }[]>([])
let timer: ReturnType<typeof setTimeout> | null = null

function rebuild() {
  groups.value = [
    { label: '客户', items: customers.value },
    { label: '合同', items: contracts.value },
    { label: '核算单', items: sheets.value },
    { label: '开通工单', items: wos.value },
  ]
}

function onInput() {
  if (timer) clearTimeout(timer)
  if (!kw.value.trim()) {
    customers.value = contracts.value = sheets.value = wos.value = []
    rebuild()
    return
  }
  timer = setTimeout(search, 250)
}

async function search() {
  const q = kw.value.trim()
  if (!q) return
  loading.value = true
  try {
    const [c, ct, s, w] = await Promise.allSettled([
      customerPage({ kw: q, pageNum: 1, pageSize: 5 }),
      contractPage({ kw: q, pageNum: 1, pageSize: 5 }),
      sheetPage({ kw: q, pageNum: 1, pageSize: 5 }),
      woPage({ pageNum: 1, pageSize: 100 }),
    ])
    customers.value = c.status === 'fulfilled'
      ? c.value.records.map((x) => ({ id: x.id, code: `CU-${String(x.id).padStart(4, '0')}`, name: x.name, extra: (x as { industry?: string }).industry ?? '', to: '/customer' }))
      : []
    contracts.value = ct.status === 'fulfilled'
      ? ct.value.records.map((x) => ({ id: x.id, code: (x as { code?: string }).code ?? `#${x.id}`, name: (x as { customerName?: string }).customerName ?? '', extra: (x as { status?: string }).status ?? '', to: `/contract/detail?id=${x.id}` }))
      : []
    sheets.value = s.status === 'fulfilled'
      ? s.value.records.map((x) => { const r = x as unknown as { id: number; code?: string; customerName?: string; status?: string }; return { id: r.id, code: r.code ?? `#${r.id}`, name: r.customerName ?? '', extra: r.status ?? '', to: '/cost' } })
      : []
    wos.value = w.status === 'fulfilled'
      ? w.value.records
          .map((x) => x as unknown as { id: number; code?: string; customerName?: string; status?: string })
          .filter((r) => (r.code ?? '').includes(q) || (r.customerName ?? '').includes(q))
          .slice(0, 5)
          .map((r) => ({ id: r.id, code: r.code ?? `#${r.id}`, name: r.customerName ?? '', extra: r.status ?? '', to: `/delivery?id=${r.id}` }))
      : []
    rebuild()
  } finally {
    loading.value = false
  }
}

function go(to: string) {
  open.value = false
  kw.value = ''
  rebuild()
  router.push(to)
}

function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    const input = root.value?.querySelector('input')
    input?.focus()
    open.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
