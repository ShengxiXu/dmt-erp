<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">资源目录</span>
        <span class="text-[11px] text-[#86909C]">资源的通用定义：产品由哪些实体 / 服务组成。资源清单从这里选用资源、再挂各自的成本条目</span>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UiInput v-model="kw" class="w-52" placeholder="搜索资源名称 / 分类 / 编码" />
        <UiButton size="sm" @click="openCreate">＋ 新增资源</UiButton>
      </div>
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">资源名称</th><th class="px-3 py-2">形态</th><th class="px-3 py-2">分类</th>
            <th class="px-3 py-2">状态</th><th class="px-3 py-2">实例档案</th><th class="px-3 py-2">备注</th>
            <th class="px-3 py-2">被引用</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in filtered" :key="m.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3">
              <span class="font-medium text-[#1D2129]">{{ m.name }}</span>
              <span class="ml-1.5 font-mono text-[10px] text-[#C9CDD4]">{{ m.matKey }}</span>
            </td>
            <td class="px-3 py-3">
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="FORM_STYLE[m.form] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ m.form }}</span>
            </td>
            <td class="px-3 py-3 text-[#4E5969]">{{ m.groupName ?? '—' }}</td>
            <td class="px-3 py-3">
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="m.status === '启用' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ m.status }}</span>
            </td>
            <td class="px-3 py-3">
              <router-link v-if="rLink(m)" :to="rLink(m)!" class="font-mono text-[#165DFF] hover:underline">{{ rCode(m) }}</router-link>
              <span v-else class="text-[#C9CDD4]">—</span>
            </td>
            <td class="max-w-56 truncate px-3 py-3 text-[#86909C]" :title="m.remark">{{ m.remark ?? '—' }}</td>
            <td class="px-3 py-3">
              <span v-if="m.refCount" class="text-[#1D2129]">{{ m.refCount }} 个产品类型</span>
              <span v-else class="text-[#C9CDD4]">未引用</span>
            </td>
            <td class="px-3 py-3 text-right">
              <button class="mr-1.5 text-[11px] text-[#165DFF] hover:underline" @click="openEdit(m)">编辑</button>
              <button class="mr-1.5 text-[11px] text-[#165DFF] hover:underline" @click="openAttrs(m)">属性模板{{ attrCount(m) ? `(${attrCount(m)})` : '' }}</button>
              <button class="mr-1.5 text-[11px] hover:underline" :class="m.status === '启用' ? 'text-[#FF7D00]' : 'text-[#00B42A]'" @click="toggleStatus(m)">{{ m.status === '启用' ? '停用' : '启用' }}</button>
              <button class="text-[11px] text-[#F53F3F] hover:underline" @click="doDelete(m)">删除</button>
            </td>
          </tr>
          <tr v-if="!filtered.length"><td colspan="8" class="px-3 py-10 text-center text-[#86909C]">暂无资源</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      资源 = 产品由什么组成（类定义）；资源中心的 R0-R4 档案是这些类的<strong>实例</strong>（人工维护、变更留痕）；属性模板（类定义字段）驱动档案页表单渲染。被产品组成引用的资源不可删除，可停用（停用后资源清单不再可选）。
    </div>

    <!-- 新增/编辑资源 -->
    <CenterModal :model-value="editorOpen" :title="form.id ? `编辑资源 · ${form.name}` : '新增资源'" sub="类定义：资源清单引用它组成产品；实例档案按属性模板渲染、按采购口径联动采购" :width="560" @update:model-value="editorOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">资源名称 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="form.name" placeholder="见名知意，如 OTN 波道" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">资源 key</div>
            <div class="flex h-9 items-center rounded-[2px] border border-[#F2F3F5] bg-[#F7F8FA] px-2 font-mono text-sm text-[#86909C]">
              {{ form.matKey || '保存后系统自动生成（mat_N）' }}
            </div>
            <div class="mt-0.5 text-[10px] text-[#C9CDD4]">引用锚点（产品组成 / 成本条目「适用资源」挂接用），无需手工维护</div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">形态</div>
            <select v-model="form.form" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>实物</option><option>服务化资源</option><option>人工服务</option>
            </select>
            <div class="mt-0.5 text-[10px] text-[#C9CDD4]">实物入库结转；服务化按月计；人工按工时</div>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">分类</div>
            <select v-model="form.groupName" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option v-for="g in GROUPS" :key="g">{{ g }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">状态</div>
            <select v-model="form.status" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>启用</option><option>停用</option>
            </select>
            <div class="mt-0.5 text-[10px] text-[#C9CDD4]">停用后资源清单不可再选用</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">采购口径</div>
            <select v-model="form.purchaseKind" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="">无（不采购）</option>
              <option value="带宽扩容">带宽扩容（对原采购合同扩带宽）</option>
              <option value="采购入库">采购入库（买实物 / 服务入库）</option>
            </select>
            <div class="mt-0.5 text-[10px] text-[#C9CDD4]">资源不足联动采购需求时的默认处理方式</div>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">计量单位</div>
            <UiInput v-model="form.purchaseUnit" placeholder="如 台 / M / 段 / 条" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
          <UiInput v-model="form.remark" placeholder="这类资源是什么、怎么计费的口径说明" />
        </div>
        <div class="rounded-[2px] bg-[#F7F8FA] px-2.5 py-2 text-[11px] leading-4 text-[#86909C]">
          属性模板（实例档案的表单字段）在列表行「属性模板」单独维护；算账条目在成本条目库设「适用资源 = 本资源」后自动进入产品核算。
          「实例档案」（R0-R4）是系统内置功能模块（独立页面与库存 / 校验逻辑），由系统预置绑定，新建资源类默认为「无档案」——只做组成与算账挂接。
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="editorOpen = false">取消</UiButton>
          <UiButton size="sm" :disabled="!form.name" @click="doSave">保存</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 属性模板 -->
    <CenterModal :model-value="!!attrEditing" :title="`属性模板 · ${attrEditing?.name ?? ''}`" sub="类定义字段，资源中心档案页表单按此渲染；② = 业务过程实时值（只读）" :width="680" @update:model-value="attrEditing = null">
      <div v-if="attrEditing" class="space-y-3">
        <div class="flex items-center justify-between text-xs">
          <span class="text-[#86909C]">共 {{ attrs.length }} 个字段</span>
          <button class="text-[#165DFF] hover:underline" @click="attrs.push({ key: '', label: '', method: 'text', placeholder: '' })">＋ 新增字段</button>
        </div>
        <div class="max-h-80 space-y-1.5 overflow-y-auto">
          <div v-for="(a, i) in attrs" :key="i" class="flex items-center gap-2 rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-xs">
            <UiInput v-model="a.label" class="w-32" placeholder="字段名称" />
            <UiInput v-model="a.key" class="w-28" placeholder="key" />
            <select v-model="a.method" class="h-8 w-24 rounded-[2px] border border-[#E5E6EB] bg-white px-1 text-xs">
              <option v-for="(l, k) in METHOD_LABEL" :key="k" :value="k">{{ l }}</option>
            </select>
            <UiInput v-model="a.placeholder" class="flex-1" placeholder="说明 / 占位" />
            <label class="flex shrink-0 items-center gap-0.5 text-[10px] text-[#86909C]"><input v-model="a.dynamic" type="checkbox" />②</label>
            <button class="shrink-0 text-[#86909C] hover:text-[#F53F3F]" @click="attrs.splice(i, 1)">✕</button>
          </div>
          <div v-if="!attrs.length" class="rounded-[2px] bg-[#F7F8FA] px-3 py-3 text-center text-[11px] text-[#86909C]">尚无字段，点「新增字段」开始定义</div>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="attrEditing = null">取消</UiButton>
          <UiButton size="sm" @click="saveAttrs">保存模板</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { http } from '../../api/request'
import { createMaterial, materialList, updateMaterial } from '../../api/material'
import type { Material, MaterialAttr } from '../../api/material'

const METHOD_LABEL: Record<string, string> = {
  text: '文本', enum: '枚举', search: '关联搜索', calc: '计算值', readonly: '系统只读',
}
const FORM_STYLE: Record<string, string> = {
  实物: 'bg-[#FFF3E8] text-[#FF7D00]',
  服务化资源: 'bg-[#E8F3FF] text-[#165DFF]',
  人工服务: 'bg-[#F2F3F5] text-[#4E5969]',
}
const GROUPS = ['线路资源', 'IP 资源', '设备与备件', '机房设施', '平台与外购服务', '交付服务']
const R_LINK: Record<string, string> = {
  R0: '/resources/r0', R1: '/resources/r1', R2: '/resources/r2', R3: '/resources/r3', R4: '/resources/r4',
}

type MaterialX = Material & { refCount?: number }

const rows = ref<MaterialX[]>([])
const kw = ref('')
const editorOpen = ref(false)
const form = ref({ id: undefined as number | undefined, matKey: '', name: '', form: '服务化资源', groupName: '线路资源', archiveKey: '', status: '启用', remark: '', purchaseKind: '', purchaseUnit: '' })
const attrEditing = ref<Material | null>(null)
type AttrRow = MaterialAttr & { placeholder: string }
const attrs = ref<AttrRow[]>([])

const filtered = computed(() => rows.value.filter((m) =>
  !kw.value || m.name.includes(kw.value) || m.matKey.includes(kw.value) || (m.groupName ?? '').includes(kw.value)))

function rCode(m: Material) {
  return m.archiveKey ?? ''
}

function rLink(m: Material) {
  return m.archiveKey ? R_LINK[m.archiveKey] : undefined
}

function attrCount(m: Material) {
  try {
    return m.attrsJson ? (JSON.parse(m.attrsJson) as unknown[]).length : 0
  } catch {
    return 0
  }
}

async function load() {
  rows.value = await materialList() as MaterialX[]
}

function openCreate() {
  form.value = { id: undefined, matKey: '', name: '', form: '服务化资源', groupName: '线路资源', archiveKey: '', status: '启用', remark: '', purchaseKind: '', purchaseUnit: '' }
  editorOpen.value = true
}

function openEdit(m: Material) {
  form.value = {
    id: m.id, matKey: m.matKey, name: m.name, form: m.form, groupName: m.groupName ?? '线路资源',
    archiveKey: m.archiveKey ?? '', status: m.status ?? '启用',
    remark: m.remark ?? '', purchaseKind: m.purchaseKind ?? '', purchaseUnit: m.purchaseUnit ?? '',
  }
  editorOpen.value = true
}

async function doSave() {
  const f = form.value
  const data = {
    matKey: f.matKey || undefined, name: f.name, form: f.form, groupName: f.groupName,
    status: f.status,
    remark: f.remark || undefined,
    purchaseKind: f.purchaseKind || undefined, purchaseUnit: f.purchaseUnit || undefined,
  }
  if (f.id) {
    await updateMaterial(f.id, data)
  } else {
    await createMaterial(data)
  }
  Message.success('资源已保存')
  editorOpen.value = false
  load()
}

async function toggleStatus(m: MaterialX) {
  const next = m.status === '启用' ? '停用' : '启用'
  await updateMaterial(m.id, { status: next })
  Message.success(`「${m.name}」已${next}`)
  load()
}

function doDelete(m: MaterialX) {
  Modal.warning({
    title: `删除资源「${m.name}」？`,
    content: m.refCount ? `已被 ${m.refCount} 个产品类型引用，删除会被服务端拦截（可停用）。` : '删除后不可恢复。',
    onOk: async () => {
      await http.delete(`/materials/${m.id}`)
      Message.success('已删除')
      load()
    },
  })
}

function openAttrs(m: Material) {
  attrEditing.value = m
  try {
    const parsed = m.attrsJson ? (JSON.parse(m.attrsJson) as MaterialAttr[]) : []
    attrs.value = parsed.map((a) => ({ ...a, placeholder: a.placeholder ?? '' }))
  } catch {
    attrs.value = []
  }
}

async function saveAttrs() {
  if (!attrEditing.value) return
  const clean = attrs.value.filter((a) => a.key && a.label)
  await updateMaterial(attrEditing.value.id, { attrsJson: JSON.stringify(clean) })
  Message.success('属性模板已保存')
  attrEditing.value = null
  load()
}

onMounted(load)
</script>
