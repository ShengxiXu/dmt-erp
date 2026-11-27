<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-[18px] font-semibold">
          <span class="h-5 w-1 rounded-full bg-gradient-to-b from-[#165DFF] to-[#4080FF]" />主体与印章
        </h1>
        <p class="mt-1 text-[13px] text-[#86909C]">
          分子公司法人主体档案：合同 / 开票抬头、税号、收款账户、在册印章。销售合同与采购合同签约时必须选择主体，抬头与用印由主体决定。
        </p>
      </div>
      <button class="flex h-9 items-center gap-1.5 rounded-[2px] bg-[#165DFF] px-4 text-[14px] text-white hover:bg-[#0E4FDB]" @click="openEdit(null)">
        <Plus :size="15" /> 新增主体
      </button>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <section v-for="e in rows" :key="e.id" class="rounded-[6px] border border-[#E5E6EB] bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(22,93,255,0.10)]">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2.5">
            <span class="flex h-10 w-10 items-center justify-center rounded-[6px] bg-gradient-to-br from-[#165DFF] to-[#4080FF] text-white">
              <Landmark :size="19" :stroke-width="1.8" />
            </span>
            <div>
              <div class="text-[15px] font-semibold text-[#1D2129]">{{ e.shortName }}</div>
              <div class="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#86909C]">
                <span class="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5">{{ e.nature }}</span>
                <span :class="e.status === '启用' ? 'text-[#00B42A]' : 'text-[#86909C]'">{{ e.status }}</span>
              </div>
            </div>
          </div>
          <button class="flex h-7 items-center gap-1 rounded-[2px] border border-[#E5E6EB] px-2.5 text-[12px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(e)">
            <PencilLine :size="13" /> 编辑
          </button>
        </div>

        <dl class="mt-4 space-y-1.5 text-[13px] leading-5">
          <div class="flex justify-between gap-3"><dt class="shrink-0 text-[#86909C]">抬头全称</dt><dd class="text-right font-medium text-[#1D2129]">{{ e.fullName }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="shrink-0 text-[#86909C]">税号</dt><dd class="font-mono text-[12px] text-[#4E5969]">{{ e.taxNo ?? '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="shrink-0 text-[#86909C]">收款账户</dt><dd class="text-right text-[#4E5969]">{{ e.bank ?? '—' }} · {{ e.account ?? '—' }}</dd></div>
        </dl>

        <div class="mt-4 border-t border-[#F2F3F5] pt-3.5">
          <div class="mb-2 flex items-center gap-1.5 text-[12px] text-[#86909C]">
            <ShieldCheck :size="13" /> 在册印章（{{ e.seals.length }} 枚）
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="s in e.seals"
              :key="s.id"
              :title="s.name"
              class="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] p-[3px] text-[10px] font-semibold leading-tight"
              :class="SEAL_STYLE[s.type] ?? 'border-[#86909C] text-[#86909C]'"
            >
              <span class="flex h-full w-full items-center justify-center rounded-full border border-current text-center">{{ s.type }}</span>
            </span>
            <span v-if="!e.seals.length" class="text-[11px] text-[#C9CDD4]">无在册印章</span>
          </div>
        </div>
      </section>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[12px] leading-5 text-[#86909C]">
      口径：一份销售合同 / 采购合同只能落一个主体；主体决定合同抬头、用印（线上契约锁按主体开通企业章，线下按主体加盖实物章）、开票销方税号与收款账户。被合同引用的主体不能删除，只能停用。
    </div>

    <CenterModal :model-value="!!editing" :title="editing?.id ? '编辑主体' : '新增主体'" sub="抬头 / 税号 / 收款账户 / 印章" :width="560" @update:model-value="editing = null">
      <div v-if="editing" class="space-y-3 text-[13px]">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-[#4E5969]">简称 <b class="text-[#F53F3F]">*</b></span>
            <UiInput v-model="editing.shortName" placeholder="如：地面通信息（上海总部）" />
          </label>
          <label class="block">
            <span class="mb-1 block text-[#4E5969]">主体性质</span>
            <select v-model="editing.nature" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2">
              <option>法人公司</option><option>分公司</option>
            </select>
          </label>
        </div>
        <label class="block">
          <span class="mb-1 block text-[#4E5969]">抬头全称（合同 / 开票）<b class="text-[#F53F3F]">*</b></span>
          <UiInput v-model="editing.fullName" placeholder="工商注册全称" />
        </label>
        <label class="block">
          <span class="mb-1 block text-[#4E5969]">统一社会信用代码（销方税号）</span>
          <UiInput v-model="editing.taxNo" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-[#4E5969]">收款开户行</span>
            <UiInput v-model="editing.bank" />
          </label>
          <label class="block">
            <span class="mb-1 block text-[#4E5969]">收款账号</span>
            <UiInput v-model="editing.account" />
          </label>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between">
            <span class="text-[#4E5969]">在册印章</span>
            <button type="button" class="text-[12px] text-[#165DFF] hover:underline" @click="editing.seals.push({ name: '', type: '合同专用章' })">+ 加一枚</button>
          </div>
          <div class="space-y-2">
            <div v-for="(s, i) in editing.seals" :key="i" class="flex gap-2">
              <UiInput v-model="s.name" class="flex-1" :placeholder="`${editing.fullName || '主体全称'}××章`" />
              <select v-model="s.type" class="h-9 w-32 rounded-[2px] border border-[#E5E6EB] bg-white px-2">
                <option v-for="t in ['公章', '合同专用章', '财务专用章', '发票专用章']" :key="t">{{ t }}</option>
              </select>
              <button v-if="editing.seals.length > 1" type="button" class="text-[#86909C] hover:text-[#F53F3F]" @click="editing.seals.splice(i, 1)">✕</button>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <UiButton variant="outline" size="sm" @click="editing = null">取消</UiButton>
          <UiButton size="sm" :disabled="!editing.shortName || !editing.fullName" @click="save">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Landmark, PencilLine, Plus, ShieldCheck } from 'lucide-vue-next'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { createEntity, entityList, updateEntity } from '../../api/mdm'
import type { Entity } from '../../api/mdm'

const SEAL_STYLE: Record<string, string> = {
  公章: 'border-[#F53F3F] text-[#F53F3F]',
  合同专用章: 'border-[#165DFF] text-[#165DFF]',
  财务专用章: 'border-[#FF7D00] text-[#FF7D00]',
  发票专用章: 'border-[#722ED1] text-[#722ED1]',
}

interface Editing {
  id?: number
  shortName: string
  fullName: string
  nature: string
  taxNo: string
  bank: string
  account: string
  status: string
  seals: { name: string; type: string }[]
}

const rows = ref<Entity[]>([])
const editing = ref<Editing | null>(null)

async function load() {
  rows.value = await entityList()
}

function openEdit(e: Entity | null) {
  editing.value = e
    ? {
        id: e.id, shortName: e.shortName, fullName: e.fullName, nature: e.nature, taxNo: e.taxNo ?? '',
        bank: e.bank ?? '', account: e.account ?? '', status: e.status,
        seals: e.seals.length ? e.seals.map((s) => ({ name: s.name, type: s.type })) : [{ name: '', type: '公章' }],
      }
    : { shortName: '', fullName: '', nature: '法人公司', taxNo: '', bank: '', account: '', status: '启用', seals: [{ name: '', type: '公章' }] }
}

async function save() {
  const e = editing.value
  if (!e) return
  const body = {
    shortName: e.shortName, fullName: e.fullName, nature: e.nature, taxNo: e.taxNo || undefined,
    bank: e.bank || undefined, account: e.account || undefined, status: e.status,
    seals: e.seals.filter((s) => s.name),
  }
  if (e.id) {
    await updateEntity(e.id, body)
  } else {
    await createEntity(body)
  }
  editing.value = null
  load()
}

onMounted(load)
</script>
