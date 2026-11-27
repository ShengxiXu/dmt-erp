<template>
  <main class="space-y-4 p-6">
    <!-- 第一级：产品类别 -->
    <template v-if="!activeCat">
      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div class="flex items-center gap-3">
          <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">产品类别</span>
          <UiInput v-model="kw" class="w-52" placeholder="搜索类别" />
        </div>
        <UiButton size="sm" @click="openCatCreate">＋ 新增类别</UiButton>
      </div>

      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">产品类别</th><th class="px-3 py-2">产品类型数</th><th class="px-3 py-2">产品类型</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in catGroups" :key="g.cat" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ g.cat }}</td>
              <td class="px-3 py-3 font-mono">{{ g.items.length }}</td>
              <td class="px-3 py-3 text-[#4E5969]">{{ g.items.map((t) => t.name).join('、') }}</td>
              <td class="px-3 py-3 text-right">
                <button class="mr-1.5 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="activeCat = g.cat">查看类型</button>
                <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]" @click="deleteCat(g)">删除</button>
              </td>
            </tr>
            <tr v-if="!catGroups.length"><td colspan="4" class="px-3 py-10 text-center text-[#86909C]">暂无产品类别</td></tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        产品定义分三级维护：产品类别 → 产品类型 → 规格字段。点击类别行进入该产品类型的列表；规格字段挂在产品类型上，合同订单行按「类别 + 类型」实时读取对应模板，规格摘要只由结构化选项拼接、不允许自由输入。
      </div>
    </template>

    <!-- 第二级：类别下的产品类型 -->
    <template v-else>
      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-semibold text-[#1D2129]">产品类型</span>
          <span class="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{{ activeCat }}</span>
          <span class="text-[11px] text-[#86909C]">{{ CAT_HINT[activeCat] ?? '类型级商务属性：SLA / 计费周期；价格不在类型上维护（订单行议价、套餐定价）' }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <UiInput v-model="typeKw" class="w-40" placeholder="搜索类型" />
          <UiButton size="sm" variant="outline" @click="activeCat = ''">返回类别</UiButton>
          <UiButton size="sm" @click="openWizard">＋ 新增产品类型</UiButton>
        </div>
      </div>

      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">产品类型</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">SLA</th>
              <th class="px-3 py-2">计费周期</th><th class="px-3 py-2">资源清单</th><th class="px-3 py-2">规格字段</th>
              <th class="px-3 py-2">更新</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in typesOfCat" :key="t.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ t.name }}</td>
              <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="t.status === '启用' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ t.status }}</span></td>
              <td class="px-3 py-3 font-mono text-[#4E5969]">{{ (t as unknown as { sla?: string }).sla ?? '—' }}</td>
              <td class="px-3 py-3 text-[#4E5969]">{{ (t as unknown as { billingCycle?: string }).billingCycle ?? '—' }}</td>
              <td class="px-3 py-3">
                <router-link to="/product/bom" class="text-[#165DFF] hover:underline">{{ bomCount(t.id) }} 项组成</router-link>
              </td>
              <td class="px-3 py-3 font-mono">{{ specCount(t) }}</td>
              <td class="px-3 py-3 text-[#86909C]">{{ ((t as unknown as { updatedAt?: string }).updatedAt ?? '').slice(0, 10) || '—' }}</td>
              <td class="px-3 py-3 text-right">
                <router-link :to="`/product/specs?typeId=${t.id}`" class="mr-1.5 text-[11px] text-[#165DFF] hover:underline">规格</router-link>
                <button class="mr-1.5 text-[11px] text-[#4E5969] hover:text-[#165DFF]" @click="openEdit(t)">编辑</button>
                <button class="mr-1.5 text-[11px] text-[#4E5969] hover:text-[#165DFF]" @click="doCopy(t)">复制</button>
                <button class="text-[11px] text-[#F53F3F] hover:underline" @click="doDelete(t)">删除</button>
              </td>
            </tr>
            <tr v-if="!typesOfCat.length"><td colspan="8" class="px-3 py-10 text-center text-[#86909C]">该类别下暂无类型</td></tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        「状态」切换上/下架：停用后不出现在合同起草的选项中（历史合同不受影响）；「复制」以「停用」状态创建副本，确认无误后再启用。算哪些账不在本页维护——到「资源清单」配产品组成（直接成本自动推导）并勾选成本中心；SLA / 计费周期 / 税率 / 交付周期为类型级商务属性（价格不在类型上维护：订单行议价、套餐定价）。
      </div>
    </template>

    <!-- 新增类别（单字段，创建后引导添加类型） -->
    <CenterModal :model-value="catCreating" title="新增产品类别" :width="420" @update:model-value="catCreating = false">
      <div class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">类别名称 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="catName" placeholder="如：ISP 互联网接入" @keydown.enter="submitCat" />
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="catCreating = false">取消</UiButton>
          <UiButton size="sm" :disabled="!catName.trim()" @click="submitCat">创建并添加类型</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 新增产品类型：两步向导 -->
    <CenterModal :model-value="wizardOpen" :title="`新增产品 · ${activeCat}`" sub="回答三个问题就完成：这是什么 → 客户选什么 → 算哪几笔账" :width="680" @update:model-value="wizardOpen = false">
      <div class="space-y-4 text-xs">
        <!-- 步骤条 -->
        <div class="flex items-center gap-2">
          <span
            v-for="(t, i) in ['① 这是什么', '② 客户下单选什么']"
            :key="t"
            class="rounded-[2px] px-2 py-1 text-[11px]"
            :class="i === wizardStep ? 'bg-[#165DFF] text-white' : i < wizardStep ? 'text-[#00B42A]' : 'bg-[#F2F3F5] text-[#86909C]'"
          >{{ i < wizardStep ? '✓ ' : '' }}{{ t }}</span>
        </div>

        <!-- 第 1 步 -->
        <div v-if="wizardStep === 0" class="space-y-3">
          <div class="text-[#86909C]">客户看到的这件商品长什么样：</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="mb-0.5 text-[#4E5969]">产品名称 <span class="text-[#F53F3F]">*</span></div>
              <UiInput v-model="wiz.name" placeholder="如：AI 专线 / OTN / 机柜托管" />
            </div>
            <div>
              <div class="mb-0.5 text-[#4E5969]">属于哪一类</div>
              <UiInput :model-value="activeCat" disabled />
            </div>
            <div>
              <div class="mb-0.5 text-[#4E5969]">SLA 等级</div>
              <UiInput v-model="wiz.sla" placeholder="如 99.9%，可空" />
            </div>
          </div>
          <div class="mt-1 text-[10px] leading-4 text-[#C9CDD4]">价格不在产品类型上定：订单行议价、套餐定价（第 2 步可加套餐），类型只定义「卖什么」。算哪些账不在本页配——创建后到「资源清单」配产品组成（直接成本自动推导）并勾选成本中心。</div>
        </div>

        <!-- 第 2 步 -->
        <div v-else class="space-y-3">
          <div class="text-[#86909C]">客户买它的时候要逐项选什么？绝大多数产品至少让客户选「带宽」——点下面的常用规格一键带入，也可以新建自己的。</div>

          <div class="space-y-1.5">
            <div v-for="(s, i) in wiz.specs" :key="i" class="flex items-center gap-2 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5">
              <span class="shrink-0 font-medium text-[#1D2129]">{{ s.label || '（未命名）' }}</span>
              <span class="shrink-0 rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{{ KIND_LABEL[s.kind] }}</span>
              <span v-if="s.required" class="shrink-0 rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">必填</span>
              <span class="truncate font-mono text-[10px] text-[#C9CDD4]">{{ s.kind === 'select' ? optsPreview(s.optionsText) : (s.optionsText || '—') }}</span>
              <button class="ml-auto shrink-0 text-[11px] text-[#165DFF] hover:underline" @click="wizSpecEdit = { ...s, idx: i }">编辑</button>
              <button class="shrink-0 text-[11px] text-[#F53F3F] hover:underline" @click="wiz.specs.splice(i, 1)">删除</button>
            </div>
            <div v-if="!wiz.specs.length" class="rounded-[2px] bg-[#F7F8FA] px-3 py-2.5 text-[11px] text-[#86909C]">还没有规格。建议至少加一个「带宽」，否则客户下单没什么可选的。</div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-[11px] text-[#86909C]">常用规格：</span>
            <button
              v-for="p in SPEC_PRESETS"
              :key="p.label"
              :disabled="wiz.specs.some((s) => s.label === p.label)"
              :title="p.options.split('\n').join(' / ')"
              class="rounded-[2px] border border-[#BEDAFF] px-2 py-1 text-[11px] text-[#165DFF] transition-colors hover:bg-[#F7FBFF] disabled:cursor-not-allowed disabled:border-[#F2F3F5] disabled:text-[#C9CDD4]"
              @click="wiz.specs.push({ label: p.label, kind: p.kind, optionsText: p.options, required: false })"
            >＋ {{ p.label }}</button>
            <button class="rounded-[2px] border border-dashed border-[#C9CDD4] px-2 py-1 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="wizSpecEdit = { label: '', kind: 'select', optionsText: '', required: false, idx: -1 }">＋ 新建规格</button>
          </div>

          <!-- 套餐草稿 -->
          <div class="rounded-[4px] border border-dashed border-[#BEDAFF] bg-[#F7FBFF] p-3">
            <div class="mb-2 leading-5 text-[#4E5969]">套餐（可选）：把客户常买的搭配定死、定个价——客户下单选这个包，规格自动带出，不用逐项选。</div>
            <div v-for="(p, i) in wiz.plans" :key="i" class="mb-1.5 flex items-center gap-2 rounded-[2px] border border-[#E5E6EB] bg-white px-2.5 py-1.5">
              <span class="shrink-0 font-medium text-[#1D2129]">{{ p.name }}</span>
              <span class="shrink-0 text-[#4E5969]">{{ p.price ? `${Number(p.price).toLocaleString('zh-CN')} 元/月` : '未定价' }}</span>
              <span class="truncate font-mono text-[10px] text-[#86909C]">{{ planDraftText(p) }}</span>
              <button class="ml-auto shrink-0 text-[11px] text-[#165DFF] hover:underline" @click="wizPlanEdit = { name: p.name, price: p.price ?? '', values: { ...p.values }, idx: i }">编辑</button>
              <button class="shrink-0 text-[11px] text-[#F53F3F] hover:underline" @click="wiz.plans.splice(i, 1)">删除</button>
            </div>
            <div v-if="!wiz.plans.length" class="mb-1.5 rounded-[2px] bg-white/70 px-2.5 py-1.5 text-[11px] text-[#86909C]">还没套餐：客户只能逐项自由组合规格（建好产品后也可随时补）</div>
            <UiButton size="sm" variant="outline" @click="wizPlanEdit = { name: '', price: '', values: {}, idx: -1 }">＋ 添加套餐</UiButton>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="wizardOpen = false">取消</UiButton>
          <div class="flex gap-2">
            <UiButton v-if="wizardStep > 0" variant="outline" size="sm" @click="wizardStep = 0">上一步</UiButton>
            <UiButton v-if="wizardStep === 0" size="sm" @click="wizNext">下一步</UiButton>
            <UiButton v-else size="sm" :loading="wizSaving" @click="wizFinish">完成创建</UiButton>
          </div>
        </div>
      </div>

      <!-- 向导内：规格编辑小弹窗 -->
      <div v-if="wizSpecEdit" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" @click.self="wizSpecEdit = null">
        <div class="w-[440px] rounded-[6px] bg-white p-4 shadow-xl">
          <div class="mb-3 text-sm font-semibold text-[#1D2129]">{{ wizSpecEdit.idx === -1 ? '新建规格' : '编辑规格' }}</div>
          <div class="space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <div class="mb-0.5 text-[#4E5969]">规格名称 <span class="text-[#F53F3F]">*</span></div>
                <UiInput v-model="wizSpecEdit.label" placeholder="如：带宽" />
              </div>
              <div>
                <div class="mb-0.5 text-[#4E5969]">类型</div>
                <select v-model="wizSpecEdit.kind" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
                  <option value="select">选档位</option><option value="number">填数字</option><option value="text">填文字</option>
                </select>
              </div>
            </div>
            <div v-if="wizSpecEdit.kind === 'select'">
              <div class="mb-0.5 text-[#4E5969]">档位（每行一个）<span class="text-[#F53F3F]">*</span></div>
              <textarea v-model="wizSpecEdit.optionsText" rows="4" class="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" placeholder="50M&#10;100M&#10;200M" />
            </div>
            <div v-else>
              <div class="mb-0.5 text-[#4E5969]">占位提示</div>
              <UiInput v-model="wizSpecEdit.optionsText" placeholder="如 条 / 个" />
            </div>
            <label class="flex items-center gap-2 text-[#4E5969]"><input v-model="wizSpecEdit.required" type="checkbox" class="accent-[#165DFF]" />必填（下单必须选 / 填）</label>
            <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <UiButton variant="outline" size="sm" @click="wizSpecEdit = null">取消</UiButton>
              <UiButton size="sm" @click="saveWizSpec">保存</UiButton>
            </div>
          </div>
        </div>
      </div>

      <!-- 向导内：套餐编辑小弹窗 -->
      <div v-if="wizPlanEdit" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" @click.self="wizPlanEdit = null">
        <div class="w-[460px] rounded-[6px] bg-white p-4 shadow-xl">
          <div class="mb-3 text-sm font-semibold text-[#1D2129]">{{ wizPlanEdit.idx === -1 ? '添加套餐' : '编辑套餐' }}</div>
          <div class="space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <div class="mb-0.5 text-[#4E5969]">套餐名 <span class="text-[#F53F3F]">*</span></div>
                <UiInput v-model="wizPlanEdit.name" placeholder="如 标准版" />
              </div>
              <div>
                <div class="mb-0.5 text-[#4E5969]">套餐价（元/月）</div>
                <UiInput :model-value="String(wizPlanEdit.price ?? '')" type="number" @update:model-value="wizPlanEdit!.price = $event" />
              </div>
            </div>
            <div>
              <div class="mb-1 text-[#4E5969]">定死哪些规格（至少一项）</div>
              <div v-for="(s, i) in wiz.specs" :key="i" class="mb-1.5 flex items-center gap-2">
                <span class="w-20 shrink-0 text-[#4E5969]">{{ s.label }}</span>
                <select v-if="s.kind === 'select'" v-model="wizPlanEdit.values[i]" class="h-8 flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs">
                  <option value="">（不定死）</option>
                  <option v-for="o in s.optionsText.split('\n').map((x) => x.trim()).filter(Boolean)" :key="o" :value="o">{{ o }}</option>
                </select>
                <UiInput v-else v-model="wizPlanEdit.values[i]" class="flex-1" placeholder="值" />
              </div>
              <div v-if="!wiz.specs.length" class="rounded-[2px] bg-[#F7F8FA] px-2 py-1.5 text-[11px] text-[#86909C]">先回上一步添加规格</div>
            </div>
            <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <UiButton variant="outline" size="sm" @click="wizPlanEdit = null">取消</UiButton>
              <UiButton size="sm" @click="saveWizPlan">保存</UiButton>
            </div>
          </div>
        </div>
      </div>
    </CenterModal>

    <!-- 编辑类型（商务属性） -->
    <CenterModal :model-value="!!editing" :title="`编辑产品类型 · ${editing?.name ?? ''}`" :width="520" @update:model-value="editing = null">
      <div v-if="editing" class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-[#4E5969]">状态</div>
            <select v-model="editing.status" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>启用</option><option>停用</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-[#4E5969]">SLA 等级</div>
            <UiInput v-model="editing.sla" placeholder="如 99.9%，可空" />
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-[#4E5969]">计费周期</div>
          <select v-model="editing.billingCycle" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
            <option value="">未设置</option><option>月付</option><option>季付</option><option>半年付</option><option>年付</option><option>一次性</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-[#4E5969]">税率（%）</div>
            <UiInput v-model="editing.taxRate" placeholder="如 6 / 9 / 13，可空" />
          </div>
          <div>
            <div class="mb-0.5 text-[#4E5969]">标准交付周期（个工作日）</div>
            <UiInput v-model="editing.leadTime" type="number" placeholder="可空" />
          </div>
        </div>
        <div class="rounded-[2px] bg-[#F7F8FA] px-2.5 py-2 text-[11px] leading-5 text-[#86909C]">
          「核算装配」（卖一单算哪几笔账）已与商务属性剥离，在资源清单独立维护（产品组成推导直接成本 + 勾选成本中心）：
          <router-link to="/product/bom" class="ml-1 text-[#165DFF] hover:underline">前往资源清单 →</router-link>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="editing = null">取消</UiButton>
          <UiButton size="sm" @click="doSave">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { http } from '../../api/request'
import { productTypeList, typeMaterials } from '../../api/prd'
import type { ProductType } from '../../api/types'

interface EditForm {
  id: number; cat: string; name: string; status: string; remark: string
  sla: string; billingCycle: string; taxRate: string; leadTime: string
}
interface WizSpec { label: string; kind: string; optionsText: string; required: boolean }
interface WizPlan { name: string; price?: string | number; values: Record<number, string> }

const router = useRouter()

const CAT_HINT: Record<string, string> = {
  'ISP 互联网接入': '共享出口：不同出口归属不同产品类型，AI 专线 / D-MAN 可共享 BGP 三网出口；一对一运营商线路仅存在于转售业务',
  数据专线: '点对点上联：OTN 波道 / SD-WAN 组网，基础线路档案随单锁定',
  IDC: '机柜托管与电力，按柜计费',
}
const SPEC_PRESETS = [
  { label: '带宽', kind: 'select', options: '50M\n100M\n200M\n500M\n1G\n10G' },
  { label: 'IP', kind: 'select', options: '1 个\n4 个\n8 个\n16 个\n32 个\n64 个\n128 个\n256 个（一个 C）' },
  { label: '基础线路', kind: 'select', options: '1 条\n2 条（冗余）' },
  { label: '机柜', kind: 'select', options: '10U\n20U\n半柜\n整柜 42U' },
  { label: '电力', kind: 'select', options: '3kW\n5kW\n10kW\n16kW' },
]
const KIND_LABEL: Record<string, string> = { select: '选档位', number: '填数字', text: '填文字' }

const types = ref<ProductType[]>([])
const kw = ref('')
const typeKw = ref('')
const activeCat = ref('')
const editing = ref<EditForm | null>(null)
const bomCounts = ref<Record<number, number>>({})
const catCreating = ref(false)
const catName = ref('')
const categories = ref<{ id: number; name: string; typeCount: number }[]>([])

// 向导状态
const wizardOpen = ref(false)
const wizardStep = ref(0)
const wizSaving = ref(false)
const wiz = ref<{ name: string; sla: string; specs: WizSpec[]; plans: WizPlan[] }>({ name: '', sla: '', specs: [], plans: [] })
const wizSpecEdit = ref<(WizSpec & { idx: number }) | null>(null)
const wizPlanEdit = ref<{ name: string; price: string | number; values: Record<number, string>; idx: number } | null>(null)

const catGroups = computed(() => {
  return categories.value
    .filter((c) => !kw.value || c.name.includes(kw.value))
    .map((c) => ({
      id: c.id,
      cat: c.name,
      items: types.value.filter((t) => ((t as unknown as { cat?: string }).cat ?? '未分类') === c.name),
    }))
})

const typesOfCat = computed(() =>
  types.value.filter((t) => ((t as unknown as { cat?: string }).cat ?? '未分类') === activeCat.value
    && (!typeKw.value || t.name.includes(typeKw.value))))

function specCount(t: ProductType) {
  try {
    const raw = (t as unknown as { specFieldsJson?: string }).specFieldsJson
    return raw ? (JSON.parse(raw) as unknown[]).length : 0
  } catch {
    return 0
  }
}

function bomCount(id: number) {
  return bomCounts.value[id] ?? 0
}

function optsPreview(text: string) {
  const opts = text.split('\n').map((x) => x.trim()).filter(Boolean)
  return opts.length > 4 ? `${opts.slice(0, 4).join(' / ')} …共 ${opts.length} 档` : opts.join(' / ')
}

function planDraftText(p: WizPlan) {
  return Object.entries(p.values)
    .map(([i, v]) => `${wiz.value.specs[Number(i)]?.label ?? i} ${v}`)
    .join(' · ')
}

// ---------- 类别 ----------
function openCatCreate() {
  catName.value = ''
  catCreating.value = true
}

/** 类别独立主数据：创建即落库（空类别可存在），随后引导新增第一个类型 */
async function submitCat() {
  const n = catName.value.trim()
  if (!n) return
  await http.post('/product-categories', { name: n })
  catCreating.value = false
  await reload()
  activeCat.value = n
  openWizard()
}

// ---------- 新增向导 ----------
function openWizard() {
  wiz.value = { name: '', sla: '', specs: [], plans: [] }
  wizardStep.value = 0
  wizardOpen.value = true
}

function wizNext() {
  if (!wiz.value.name.trim()) {
    Message.warning('先给产品起个名字')
    return
  }
  wizardStep.value = 1
}

function saveWizSpec() {
  const e = wizSpecEdit.value
  if (!e) return
  if (!e.label.trim()) {
    Message.warning('先给规格起个名字，如：带宽')
    return
  }
  if (e.kind === 'select' && !e.optionsText.split('\n').some((x) => x.trim())) {
    Message.warning('选档位的规格至少要填一个档位，每行一个')
    return
  }
  const clean: WizSpec = { label: e.label.trim(), kind: e.kind, optionsText: e.optionsText, required: e.required }
  if (e.idx === -1) {
    wiz.value.specs.push(clean)
  } else {
    wiz.value.specs[e.idx] = clean
  }
  wizSpecEdit.value = null
}

function saveWizPlan() {
  const e = wizPlanEdit.value
  if (!e) return
  if (!e.name.trim()) {
    Message.warning('先填套餐名')
    return
  }
  const values = Object.fromEntries(Object.entries(e.values).filter(([, v]) => v))
  if (!Object.keys(values).length) {
    Message.warning('这个套餐一个规格都没定死，等于没建——至少给某个规格选一个档位')
    return
  }
  const row: WizPlan = { name: e.name.trim(), price: e.price ? Number(e.price) : undefined, values }
  if (e.idx === -1) {
    wiz.value.plans.push(row)
  } else {
    wiz.value.plans[e.idx] = row
  }
  wizPlanEdit.value = null
}

async function wizFinish() {
  const n = wiz.value.name.trim()
  if (types.value.some((t) => ((t as unknown as { cat?: string }).cat ?? '') === activeCat.value && t.name === n)) {
    Message.warning('该产品类型已存在')
    return
  }
  wizSaving.value = true
  try {
    const specFields = wiz.value.specs.filter((s) => s.label.trim()).map((s, i) => ({
      key: `f${Date.now() % 100000}_${i}`,
      label: s.label.trim(),
      type: s.kind === 'select' ? 'enum' : s.kind,
      options: s.kind === 'select' ? s.optionsText.split('\n').map((x) => x.trim()).filter(Boolean) : undefined,
      required: s.required,
    }))
    const idToKey: Record<number, string> = {}
    wiz.value.specs.filter((s) => s.label.trim()).forEach((_s, i) => {
      if (specFields[i]) idToKey[i] = specFields[i].key
    })
    const plans = wiz.value.plans.map((p, i) => ({
      id: `plan_${Date.now() % 100000}_${i}`,
      name: p.name,
      price: p.price ? Number(p.price) : undefined,
      values: Object.fromEntries(Object.entries(p.values).map(([sid, v]) => [idToKey[Number(sid)] ?? sid, v])),
    }))
    await http.post('/product-types', {
      cat: activeCat.value, name: n, status: '启用', sla: wiz.value.sla || undefined,
      specFieldsJson: JSON.stringify(specFields), plansJson: JSON.stringify(plans),
    })
    Message.success('产品类型已创建，去配规格与套餐')
    wizardOpen.value = false
    await reload()
    const created = types.value.find((t) => ((t as unknown as { cat?: string }).cat ?? '') === activeCat.value && t.name === n)
    if (created) {
      router.push(`/product/specs?typeId=${created.id}`)
    }
  } finally {
    wizSaving.value = false
  }
}

// ---------- 编辑 / 复制 / 删除 ----------
function openEdit(t: ProductType) {
  const x = t as unknown as { cat?: string; remark?: string; sla?: string; billingCycle?: string; taxRate?: string; leadTime?: string }
  editing.value = {
    id: t.id, cat: x.cat ?? '', name: t.name, status: t.status ?? '启用', remark: x.remark ?? '',
    sla: x.sla ?? '', billingCycle: x.billingCycle ?? '', taxRate: x.taxRate ?? '', leadTime: x.leadTime ?? '',
  }
}

async function doSave() {
  const e = editing.value
  if (!e) return
  await http.put(`/product-types/${e.id}`, {
    cat: e.cat, name: e.name, status: e.status, remark: e.remark || undefined,
    sla: e.sla || undefined, billingCycle: e.billingCycle || undefined,
    taxRate: e.taxRate || undefined, leadTime: e.leadTime || undefined,
  })
  Message.success('产品类型已保存')
  editing.value = null
  await reload()
}

async function doCopy(t: ProductType) {
  const src = t as unknown as { cat?: string; sla?: string; billingCycle?: string; taxRate?: string; leadTime?: string; remark?: string; specFieldsJson?: string; plansJson?: string }
  await http.post('/product-types', {
    cat: src.cat, name: `${t.name}（副本）`, status: '停用',
    remark: src.remark, sla: src.sla, billingCycle: src.billingCycle, taxRate: src.taxRate, leadTime: src.leadTime,
    specFieldsJson: src.specFieldsJson, plansJson: src.plansJson,
  })
  Message.success('已创建停用副本，确认无误后再启用')
  await reload()
}

function doDelete(t: ProductType) {
  Modal.warning({
    title: `删除产品类型「${t.name}」？`,
    content: '已被合同订单行引用的类型会被服务端拦截（可停用下架）；删除同时清理资源清单组成。',
    onOk: async () => {
      await http.delete(`/product-types/${t.id}`)
      Message.success('已删除')
      await reload()
    },
  })
}

function deleteCat(g: { id: number; cat: string; items: ProductType[] }) {
  Modal.warning({
    title: `删除类别「${g.cat}」${g.items.length ? `及其下 ${g.items.length} 个类型` : ''}？`,
    content: '任一类型被合同订单行引用即整体回滚；建议先逐个停用确认。',
    onOk: async () => {
      await http.delete(`/product-categories/${g.id}`)
      Message.success('类别已删除')
      await reload()
    },
  })
}

async function reload() {
  types.value = await productTypeList()
  categories.value = await http.get('/product-categories')
  const entries = await Promise.all(types.value.map(async (t) => [t.id, (await typeMaterials(t.id)).length] as const))
  bomCounts.value = Object.fromEntries(entries)
}

onMounted(reload)
</script>
