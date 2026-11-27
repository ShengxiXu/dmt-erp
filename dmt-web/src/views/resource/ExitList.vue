<template>
  <main class="space-y-4 p-6">
    <!-- 数据模型说明 -->
    <div class="rounded-[4px] border border-[#BEDAFF] bg-[#F0F5FF] px-4 py-2.5 text-xs leading-5 text-[#1D2129]">
      <span class="font-semibold">数据模型：</span>资源目录（类，<router-link to="/materials" class="text-[#165DFF] hover:underline">资源目录</router-link>）→ 本页实例档案（人工维护、变更留痕）→ 业务过程（负载 / 占用 / 锁定，只读）→ 月末快照（冻结）。占用在核算审批通过时生效，退订归档时释放。
    </div>

    <!-- 资源总览统计卡 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <router-link to="/resources/r0" class="rounded-[4px] border border-[#E5E6EB] bg-white p-3.5 hover:border-[#BEDAFF]">
        <div class="text-[11px] text-[#86909C]">出口池</div>
        <div class="mt-1 font-mono text-xl font-semibold text-[#FF7D00]">{{ stats.pools }} 个</div>
      </router-link>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white p-3.5">
        <div class="text-[11px] text-[#86909C]">出口线路</div>
        <div class="mt-1 font-mono text-xl font-semibold text-[#00B42A]">{{ rows.length }} 条</div>
        <div class="text-[10px] text-[#86909C]">平均商用水位 {{ stats.avgPct }}%</div>
      </div>
      <router-link to="/resources/r3" class="rounded-[4px] border border-[#E5E6EB] bg-white p-3.5 hover:border-[#BEDAFF]">
        <div class="text-[11px] text-[#86909C]">IP 地址</div>
        <div class="mt-1 font-mono text-xl font-semibold text-[#00B42A]">{{ stats.ipTotal }}</div>
        <div class="text-[10px] text-[#86909C]">可用地址合计</div>
      </router-link>
      <router-link to="/resources/r2" class="rounded-[4px] border border-[#E5E6EB] bg-white p-3.5 hover:border-[#BEDAFF]">
        <div class="text-[11px] text-[#86909C]">基础线路</div>
        <div class="mt-1 font-mono text-xl font-semibold text-[#165DFF]">{{ stats.baseLines }} 条</div>
        <div class="text-[10px] text-[#86909C]">接入段 / 长途段</div>
      </router-link>
      <router-link to="/resources/r4" class="rounded-[4px] border bg-white p-3.5" :class="stats.lowStock ? 'border-[#F53F3F]' : 'border-[#E5E6EB]'">
        <div class="text-[11px] text-[#86909C]">库存预警</div>
        <div class="mt-1 font-mono text-xl font-semibold" :class="stats.lowStock ? 'text-[#F53F3F]' : 'text-[#1D2129]'">{{ stats.lowStock }} 项</div>
        <div class="truncate text-[10px] text-[#86909C]">{{ stats.lowStockNames || '库存充足' }}</div>
      </router-link>
    </div>

    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">R1 · 出口线路档案</span>
        <span class="text-[10px] text-[#86909C]">归属资源：出口线路 · 成本口径：随单直接成本；两步法（出口租金按各类型占用占比切分）</span>
        <UiInput v-model="kw" class="w-48" placeholder="搜索档案（编码 / 名称）" @keydown.enter="load" />
      </div>
      <UiButton size="sm" @click="openCreate">＋ 新建档案</UiButton>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">资源编码</th><th class="px-3 py-2">线路名称</th><th class="px-3 py-2">运营商</th>
            <th class="px-3 py-2 text-right">带宽容量(M)</th><th class="px-3 py-2 text-right">已售带宽(M) <span class="rounded-[2px] bg-[#E8F3FF] px-1 text-[9px] text-[#165DFF]">②层</span></th>
            <th class="px-3 py-2 text-right">水位</th><th class="px-3 py-2 text-right">月成本</th>
            <th class="px-3 py-2">IP 段</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in rows" :key="e.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#86909C]">{{ e.code }}</td>
            <td class="px-3 py-3 font-medium text-[#1D2129]">{{ e.name }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ e.carrier ?? '—' }}</td>
            <td class="px-3 py-3 text-right font-mono">{{ e.bandwidthM.toLocaleString('zh-CN') }} M<span class="text-[10px] text-[#C9CDD4]">（商用参考）</span></td>
            <td class="px-3 py-3 text-right font-mono text-[#165DFF]">{{ soldOf(e) }} M<span class="text-[10px] text-[#86909C]">（直挂＋全部池分摊）</span></td>
            <td class="px-3 py-3 text-right font-mono" :class="pctOf(e) > 85 ? 'text-[#F53F3F]' : pctOf(e) > 60 ? 'text-[#FF7D00]' : 'text-[#00B42A]'">{{ pctOf(e) }}%</td>
            <td class="px-3 py-3 text-right font-mono">{{ e.costMonth != null ? e.costMonth.toLocaleString('zh-CN') : '—' }}</td>
            <td class="px-3 py-3 font-mono text-[#4E5969]">{{ e.ipSegment ?? '—' }}</td>
            <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="e.status === '启用' || e.status === '生效' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ e.status }}</span></td>
            <td class="px-3 py-3 text-right">
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openLoad(e)">实测录入</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="10" class="px-3 py-10 text-center text-[#86909C]">暂无出口线路</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      出口负载由工程师<strong>人工实测录入（只增）</strong>，系统不做流量预测；已售带宽＝直挂＋全部池分摊（②层实时聚合），签单锁定快照、月结按签单快照归档不重算。
    </div>

    <CenterModal :model-value="loadVisible" title="负载实测录入" sub="记录立即生效并进入水位计算" :width="420" @update:model-value="loadVisible = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">实测占用（Mbps）<span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="usedMText" type="number" />
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="loadVisible = false">取消</UiButton>
          <UiButton size="sm" @click="saveLoad">保存</UiButton>
        </div>
      </div>
    </CenterModal>

    <CenterModal :model-value="createOpen" title="新建出口线路档案" sub="实例档案人工维护、变更留痕；编码唯一" :width="520" @update:model-value="createOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">资源编码 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.code" placeholder="如 B-004" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">运营商</div>
            <select v-model="form.carrier" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>电信</option><option>联通</option><option>移动</option><option>境外运营商</option><option>三方</option>
            </select>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">线路名称 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="form.name" placeholder="运营商-地域-带宽，见名知意" />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">带宽容量（M）</div>
            <UiInput v-model="form.bandwidthText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">月成本（元）</div>
            <UiInput v-model="form.costText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">IP 段</div>
            <UiInput v-model="form.ipSegment" placeholder="如 101.92.8.0/24" />
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="outline" size="sm" @click="createOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.code || !form.name" @click="doCreate">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import UiInput from '../../components/ui/Input.vue'
import UiButton from '../../components/ui/Button.vue'
import CenterModal from '../../components/CenterModal.vue'
import { addLoadRecord, baseLineList, equipmentList, exitList, ipSegmentList, poolList } from '../../api/prd'
import { http } from '../../api/request'
import type { ExitLine } from '../../api/types'

type ExitRow = ExitLine & { soldM?: number }

const rows = ref<ExitRow[]>([])
const kw = ref('')
const loadVisible = ref(false)
const usedMText = ref('')
const current = ref<ExitLine | null>(null)
const createOpen = ref(false)
const form = ref({ code: '', name: '', carrier: '电信', bandwidthText: '', costText: '', ipSegment: '' })
const stats = ref({ pools: 0, ipTotal: 0, baseLines: 0, lowStock: 0, lowStockNames: '', avgPct: 0 })

function soldOf(e: ExitRow) {
  return Number(e.soldM ?? 0).toLocaleString('zh-CN')
}

function pctOf(e: ExitRow) {
  return e.bandwidthM > 0 ? Math.round((Number(e.soldM ?? 0) / e.bandwidthM) * 100) : 0
}

async function load() {
  rows.value = (await exitList(kw.value ? { kw: kw.value } : undefined)) as ExitRow[]
  const pcts = rows.value.map(pctOf)
  stats.value.avgPct = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : 0
}

function openLoad(e: ExitLine) {
  current.value = e
  usedMText.value = ''
  loadVisible.value = true
}

async function saveLoad() {
  if (!current.value || !usedMText.value) return
  await addLoadRecord(current.value.id, Number(usedMText.value))
  Message.success('实测记录已保存')
  loadVisible.value = false
}

function openCreate() {
  form.value = { code: '', name: '', carrier: '电信', bandwidthText: '', costText: '', ipSegment: '' }
  createOpen.value = true
}

async function doCreate() {
  const f = form.value
  await http.post('/archives/exits', {
    code: f.code, name: f.name, carrier: f.carrier,
    bandwidthM: f.bandwidthText ? Number(f.bandwidthText) : undefined,
    costMonth: f.costText ? Number(f.costText) : undefined,
    ipSegment: f.ipSegment || undefined,
  })
  Message.success('出口线路档案已创建')
  createOpen.value = false
  load()
}

onMounted(async () => {
  await load()
  const [pools, segs, base, equips] = await Promise.all([
    poolList().catch(() => []),
    ipSegmentList().catch(() => []),
    baseLineList().catch(() => []),
    equipmentList().catch(() => []),
  ])
  const low = (equips as { name: string; stock: number; locked: number }[]).filter((e) => e.stock - e.locked <= 1)
  stats.value = {
    ...stats.value,
    pools: (pools as unknown[]).length,
    ipTotal: (segs as { count: number }[]).reduce((s, x) => s + (x.count ?? 0), 0),
    baseLines: (base as unknown[]).length,
    lowStock: low.length,
    lowStockNames: low.slice(0, 2).map((e) => e.name).join('、'),
  }
})
</script>
