<template>
  <main class="space-y-4 p-6">
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
      <div class="text-sm font-semibold text-[#1D2129]">产品的成本是怎么算出来的？</div>
      <div class="mt-1 text-xs leading-5 text-[#86909C]">
        每卖出 1 件产品，系统按产品组成（BOM 物料）× 成本条目账本一笔一笔算账：从哪个资源里挑、按什么口径算、归到哪本账。
        全部配好的产品打绿色勾勾；没配好的写明缺什么，点卡片右上角去补。
      </div>
      <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <span class="text-[#4E5969]">在卖 <strong class="font-mono">{{ rows.length }}</strong> 个产品</span>
        <span class="text-[#4E5969]">成本条目库 <strong class="font-mono">{{ activeItems.length }}</strong> 笔生效账</span>
        <span v-if="todoCount" class="text-[#F53F3F]"><strong class="font-mono">{{ todoCount }}</strong> 个产品有配置待办</span>
        <span v-else class="text-[#00B42A]">✓ 全部配好了</span>
        <label class="ml-auto flex cursor-pointer items-center gap-1.5 text-[#4E5969]">
          <input v-model="onlyTodo" type="checkbox" class="accent-[#165DFF]" />只看没配好的
        </label>
      </div>
    </div>

    <div v-for="g in shownGroups" :key="g.cat">
      <div class="mb-2 text-xs font-semibold text-[#4E5969]">{{ g.cat }} · {{ g.items.length }} 个产品</div>
      <div class="grid gap-3 xl:grid-cols-2">
        <div v-for="r in g.items" :key="r.type.id" class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
          <div class="mb-2 flex items-center gap-2 border-b border-[#F2F3F5] pb-2">
            <router-link class="text-[13px] font-medium text-[#1D2129] hover:text-[#165DFF]" to="/product">{{ r.type.name }}</router-link>
            <span v-if="r.type.status === '停用'" class="rounded-[2px] bg-[#F2F3F5] px-1 text-[10px] text-[#86909C]">已下架</span>
            <span v-if="r.problems.length" class="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">{{ r.problems.length }} 件事待办</span>
            <span v-else class="text-[10px] text-[#00B42A]">✓ 算账配置齐全</span>
            <span class="ml-auto text-[10px] text-[#C9CDD4]">{{ r.mats.length }} 项组成</span>
          </div>

          <div v-if="r.problems.length" class="mb-2 space-y-1">
            <div v-for="(p, i) in r.problems" :key="i" class="flex items-start gap-1.5 rounded-[2px] bg-[#FFF7F5] px-2 py-1.5 text-[11px] leading-4 text-[#F53F3F]">
              <span class="mt-0.5 shrink-0">⚠</span>{{ p }}
            </div>
          </div>

          <div class="text-[11px]">
            <div class="mb-1 font-semibold text-[#4E5969]">① 产品组成（从资源目录选用）</div>
            <div v-if="r.mats.length" class="mb-2 flex flex-wrap gap-1.5">
              <span v-for="m in r.mats" :key="m.materialKey" class="rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-2 py-0.5 text-[#4E5969]">
                {{ matName(m.materialKey) }}
              </span>
            </div>
            <div v-else class="mb-2 text-[#C9CDD4]">（未配置组成）</div>

            <div class="mb-1 font-semibold text-[#4E5969]">② 算账账本（成本条目 × 算法 × 科目）</div>
            <table class="w-full">
              <tbody>
                <tr v-for="it in activeItems" :key="it.id" class="border-b border-[#F7F8FA] last:border-0">
                  <td class="py-1 pr-2 text-[#1D2129]">{{ it.name }}</td>
                  <td class="py-1 pr-2"><span class="rounded-[2px] px-1 py-0.5 text-[10px]" :class="it.costType === '周期性' ? 'bg-[#E8F3FF] text-[#165DFF]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ it.costType }}</span></td>
                  <td class="py-1 pr-2 text-[#86909C]">{{ it.calcKind ?? '—' }}</td>
                  <td class="py-1 text-right text-[#86909C]">{{ it.subject ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!shownGroups.length" class="rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">
      {{ onlyTodo ? '全部配好了，没有待办 ✅' : '暂无产品类型' }}
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { http } from '../../api/request'
import { costItemList, productTypeList } from '../../api/prd'
import { materialList } from '../../api/material'
import type { Material } from '../../api/material'
import type { CostItem, ProductType } from '../../api/types'

interface TypeMaterial { typeId: number; materialKey: string; qty?: number }
interface Row { type: ProductType; mats: TypeMaterial[]; problems: string[] }

const types = ref<ProductType[]>([])
const matsByType = ref<Record<number, TypeMaterial[]>>({})
const materials = ref<Material[]>([])
const items = ref<CostItem[]>([])
const onlyTodo = ref(false)

const activeItems = computed(() => items.value.filter((i) => i.status !== '停用'))

const rows = computed<Row[]>(() =>
  types.value.map((t) => {
    const mats = matsByType.value[t.id] ?? []
    const problems: string[] = []
    if (!mats.length) problems.push('还没配置产品组成（BOM）：到「产品定义」给这个产品选用资源')
    for (const m of mats) {
      const def = materials.value.find((d) => d.matKey === m.materialKey)
      if (!def) problems.push(`组成里的物料「${m.materialKey}」在资源目录中不存在，请调整`)
      else if (def.status === '停用') problems.push(`组成里的「${def.name}」已在资源目录停用，请更换`)
    }
    if (!activeItems.value.length) problems.push('成本条目库没有生效条目：到「成本条目库」补账')
    return { type: t, mats, problems }
  }),
)

const todoCount = computed(() => rows.value.filter((r) => r.problems.length).length)

const shownGroups = computed(() => {
  const shown = onlyTodo.value ? rows.value.filter((r) => r.problems.length) : rows.value
  const map = new Map<string, Row[]>()
  for (const r of shown) {
    const cat = (r.type as unknown as { cat?: string }).cat ?? '未分类'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(r)
  }
  return [...map.entries()].map(([cat, items2]) => ({ cat, items: items2 }))
})

function matName(key: string) {
  return materials.value.find((m) => m.matKey === key)?.name ?? key
}

onMounted(async () => {
  const [t, m, i] = await Promise.all([productTypeList(), materialList(), costItemList()])
  types.value = t
  materials.value = m
  items.value = i
  const entries = await Promise.all(
    t.map(async (pt) => [pt.id, await http.get<TypeMaterial[]>(`/product-types/${pt.id}/materials`)] as const),
  )
  matsByType.value = Object.fromEntries(entries)
})
</script>
