<template>
  <main class="space-y-4 p-6">
    <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">客户档案</span>
        <UiInput v-model="kw" class="w-56" placeholder="搜索客户 / 联系人 / 信用代码" @keydown.enter="load(1)" />
        <button class="flex items-center gap-1 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="load(1)">
          <Search :size="12" /> 查询
        </button>
        <button class="flex items-center gap-1 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="exportCsv">⭳ 导出</button>
      </div>
      <UiButton size="sm" @click="openEdit(null)">＋ 新建客户</UiButton>
    </div>

    <div v-if="isSelf" class="rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5] px-4 py-2 text-[11px] text-[#F53F3F]">
      🔒 数据范围「仅本人数据」：列表仅显示本人名下的客户
    </div>

    <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            <th class="px-3 py-2">客户编码</th><th class="px-3 py-2">客户名称</th><th class="px-3 py-2">等级</th>
            <th class="px-3 py-2">联系人 / 电话</th><th class="px-3 py-2">行业</th><th class="px-3 py-2">归属销售</th>
            <th class="px-3 py-2">商机</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">合同到期</th><th class="px-3 py-2">建档时间</th><th class="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
            <td class="px-3 py-3 font-mono text-[#86909C]">CU-{{ String(c.id).padStart(4, '0') }}</td>
            <td class="px-3 py-3">
              <button class="text-left font-medium text-[#1D2129] hover:text-[#165DFF]" title="打开 360° 视图" @click="openView(c)">{{ c.name }}</button>
            </td>
            <td class="px-3 py-3">
              <span v-if="c.level" class="rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold" :class="LEVEL_CLS[c.level] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ c.level }} 级</span>
              <span v-else>—</span>
            </td>
            <td class="px-3 py-3 text-[#4E5969]">{{ c.contact || '—' }} · {{ c.contactPhone || '—' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ c.industry || '—' }}</td>
            <td class="px-3 py-3 text-[#4E5969]">{{ c.salesName || '—' }}</td>
            <td class="px-3 py-3">
              <router-link :to="`/opportunity?customer=${c.id}`" class="rounded-[2px] bg-[#F7FAFF] px-1.5 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#BEDAFF]">
                {{ oppCount(c.id) }} 个商机
              </router-link>
            </td>
            <td class="px-3 py-3">
              <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="c.status === '合作中' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ c.status }}</span>
            </td>
            <td class="whitespace-nowrap px-3 py-3 text-[#86909C]">{{ nearestEnd(c.name) ?? '—' }}</td>
            <td class="whitespace-nowrap px-3 py-3 text-[#86909C]">{{ ((c as unknown as { createdAt?: string }).createdAt ?? '').slice(0, 10) || '—' }}</td>
            <td class="px-3 py-3 text-right">
              <button class="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#0D9488] hover:text-[#0D9488]" @click="openView(c)">360° 视图</button>
              <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]" @click="openEdit(c)">编辑</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="11" class="px-3 py-10 text-center text-[#86909C]">暂无客户数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-end gap-3 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2 text-[12px] text-[#86909C]">
      <span>共 {{ total }} 条</span>
      <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 hover:border-[#165DFF] hover:text-[#165DFF]" :disabled="pageNum <= 1" @click="load(pageNum - 1)">上一页</button>
      <span class="tabular-nums">{{ pageNum }} / {{ Math.max(1, Math.ceil(total / pageSize)) }}</span>
      <button class="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 hover:border-[#165DFF] hover:text-[#165DFF]" :disabled="pageNum >= Math.ceil(total / pageSize)" @click="load(pageNum + 1)">下一页</button>
    </div>

    <div class="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
      客户为主数据：在此统一建档维护；特批申请与合同起草时<strong>只能搜索选择</strong>客户，不允许手动录入，保证客户口径唯一。点击客户名称或「360° 视图」打开客户驾驶舱（商机 / 合同一页汇总，应收与资源视图随财务域 M5 补齐）。
    </div>

    <!-- 360° 视图 -->
    <CenterModal :model-value="!!viewing" :title="`客户 360° 视图 · ${viewing?.name ?? ''}`" :sub="viewing ? `CU-${String(viewing.id).padStart(4, '0')} · ${viewing.level ?? 'C'} 级 · ${viewing.industry ?? '—'} · 归属销售 ${viewing.salesName ?? '—'}` : ''" :width="880" @update:model-value="closeView">
      <template v-if="viewing">
        <!-- KPI 条 -->
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="t in viewTabs"
            :key="t.key"
            class="rounded-[4px] border px-3 py-2 text-left transition-all"
            :class="viewTab === t.key ? 'border-[#165DFF] bg-[#F0F5FF] shadow-sm' : 'border-[#E5E6EB] bg-white hover:border-[#BEDAFF]'"
            @click="viewTab = t.key"
          >
            <div class="flex items-center justify-between"><span class="text-[10px] text-[#86909C]">{{ t.label }}</span><span class="text-[10px]" :style="{ color: t.color }">●</span></div>
            <div class="mt-0.5 font-mono text-sm font-semibold text-[#1D2129]">{{ t.value }}</div>
            <div class="mt-0.5 truncate text-[10px] text-[#86909C]">{{ t.sub }}</div>
          </button>
        </div>

        <!-- 页签内容 -->
        <div class="mt-3 text-xs">
          <div v-if="viewTab === 'opps'">
            <div v-if="customerOpps.length" class="overflow-x-auto rounded-[4px] border border-[#E5E6EB]">
              <table class="w-full">
                <thead><tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th class="px-2 py-1.5">编号 / 名称</th><th class="px-2 py-1.5 text-right">预计合同额</th><th class="px-2 py-1.5">阶段</th></tr></thead>
                <tbody>
                  <tr v-for="o in customerOpps" :key="o.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td class="px-2 py-1.5"><span class="font-mono text-[#86909C]">{{ o.code }}</span> · {{ o.name }}</td>
                    <td class="px-2 py-1.5 text-right font-mono">{{ o.expectAmount ? `${money(o.expectAmount)} 元` : '—' }}</td>
                    <td class="px-2 py-1.5"><span class="rounded-[2px] px-1 py-0.5 text-[10px]" :class="STAGE_CLS[o.stage] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ o.stage }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="rounded-[4px] bg-[#F7F8FA] px-3 py-6 text-center text-[#86909C]">暂无商机，到商机管理创建</div>
          </div>
          <div v-else-if="viewTab === 'contracts'">
            <div v-if="customerContracts.length" class="overflow-x-auto rounded-[4px] border border-[#E5E6EB]">
              <table class="w-full">
                <thead><tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th class="px-2 py-1.5">合同号 / 主体</th><th class="px-2 py-1.5 text-right">金额</th><th class="px-2 py-1.5">状态</th></tr></thead>
                <tbody>
                  <tr v-for="c in customerContracts" :key="c.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td class="px-2 py-1.5"><span class="font-mono text-[#165DFF]">{{ c.code }}</span><span class="ml-1 text-[#4E5969]">{{ c.entityName ?? '' }}</span></td>
                    <td class="px-2 py-1.5 text-right font-mono">{{ money(c.amount) }} 元</td>
                    <td class="px-2 py-1.5"><span class="rounded-[2px] px-1 py-0.5 text-[10px]" :class="CONTRACT_CLS[c.status] ?? 'bg-[#F2F3F5] text-[#4E5969]'">{{ c.status }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="rounded-[4px] bg-[#F7F8FA] px-3 py-6 text-center text-[#86909C]">暂无合同</div>
          </div>
          <div v-else-if="viewTab === 'finance'">
            <div v-if="customerBills.length" class="overflow-x-auto rounded-[4px] border border-[#E5E6EB]">
              <table class="w-full">
                <thead><tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th class="px-2 py-1.5">账单号 / 账期</th><th class="px-2 py-1.5 text-right">应收 / 已收</th><th class="px-2 py-1.5">到期日</th><th class="px-2 py-1.5">状态</th></tr></thead>
                <tbody>
                  <tr v-for="b in customerBills" :key="b.id" class="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td class="px-2 py-1.5"><span class="font-mono text-[#165DFF]">{{ b.billNo }}</span><span class="ml-1 text-[#86909C]">{{ b.period ?? '' }}</span></td>
                    <td class="px-2 py-1.5 text-right font-mono">{{ money(b.amount) }} / <span :class="b.receivedAmt >= b.amount ? 'text-[#00B42A]' : 'text-[#FF7D00]'">{{ money(b.receivedAmt) }}</span></td>
                    <td class="px-2 py-1.5 text-[#86909C]">{{ b.dueDate ?? '—' }}</td>
                    <td class="px-2 py-1.5"><span class="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#4E5969]">{{ b.status }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="rounded-[4px] bg-[#F7F8FA] px-3 py-6 text-center text-[#86909C]">暂无账单（账期扫描或手工账单生成）</div>
          </div>
          <div v-else-if="viewTab === 'delivery'">
            <div class="space-y-2">
              <div class="rounded-[4px] border border-[#E5E6EB] p-3">
                <div class="mb-2 font-semibold text-[#1D2129]">订阅（{{ customerSubs.length }}）</div>
                <div v-for="s in customerSubs" :key="s.subNo" class="flex items-center justify-between border-b border-dashed border-[#F2F3F5] py-1 last:border-0">
                  <span class="font-mono text-[#4E5969]">{{ s.subNo }} · {{ s.product ?? s.spec ?? '' }}</span>
                  <span class="rounded-[2px] px-1 py-0.5 text-[10px]" :class="s.status === '在网' ? 'bg-[#E8F8F2] text-[#00B42A]' : s.status === '欠停' ? 'bg-[#FFECE8] text-[#F53F3F]' : 'bg-[#F2F3F5] text-[#86909C]'">{{ s.status }}</span>
                </div>
                <div v-if="!customerSubs.length" class="text-[#86909C]">暂无订阅</div>
              </div>
              <div class="rounded-[4px] border border-[#E5E6EB] p-3">
                <div class="mb-2 font-semibold text-[#1D2129]">开通工单（{{ customerWos.length }}）</div>
                <div v-for="w in customerWos" :key="w.id" class="flex items-center justify-between border-b border-dashed border-[#F2F3F5] py-1 last:border-0">
                  <router-link :to="`/delivery?id=${w.id}`" class="font-mono text-[#165DFF] hover:underline">{{ w.code }}</router-link>
                  <span class="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#4E5969]">{{ w.status }}</span>
                </div>
                <div v-if="!customerWos.length" class="text-[#86909C]">暂无工单</div>
              </div>
            </div>
          </div>
          <div v-else class="grid grid-cols-2 gap-3">
            <div class="rounded-[4px] border border-[#E5E6EB] p-3">
              <div class="mb-2 font-semibold text-[#1D2129]">基本信息</div>
              <div v-for="[k, val] in overviewItems" :key="k" class="flex justify-between border-b border-dashed border-[#F2F3F5] py-1 last:border-0">
                <span class="text-[#86909C]">{{ k }}</span>
                <span class="max-w-[260px] truncate font-medium text-[#1D2129]" :title="val">{{ val }}</span>
              </div>
            </div>
            <div class="rounded-[4px] border border-[#E5E6EB] p-3">
              <div class="mb-2 font-semibold text-[#1D2129]">模块视图</div>
              <div class="space-y-1.5 text-[#86909C]">
                <button class="block w-full rounded-[2px] bg-[#F7F8FA] px-2 py-1.5 text-left text-[11px] hover:bg-[#F0F5FF]" @click="viewTab = 'finance'">
                  应收：{{ customerBills.length }} 张账单 · 未收 {{ money(customerBills.reduce((s, b) => s + (b.amount - b.receivedAmt), 0)) }} 元 →
                </button>
                <button class="block w-full rounded-[2px] bg-[#F7F8FA] px-2 py-1.5 text-left text-[11px] hover:bg-[#F0F5FF]" @click="viewTab = 'delivery'">
                  交付：{{ customerSubs.filter((s) => s.status === '在网').length }} 条在网订阅 · {{ customerWos.length }} 个工单 →
                </button>
                <div class="rounded-[2px] bg-[#F7F8FA] px-2 py-1.5 text-[11px]">变更 / 退订 / 停机动态见「变更与退订」「欠费与坏账」页</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </CenterModal>

    <!-- 新建/编辑客户：与原型 Customer.tsx 表单同构（主数据全字段 + 开票信息块 + 三级地区联动） -->
    <CenterModal :model-value="!!editing" :title="editing?.id ? `编辑客户 · CU-${String(editing.id).padStart(4, '0')}` : '新建客户'" sub="客户主数据：带 * 为关键字段" :width="560" @update:model-value="editing = null">
      <div v-if="editing" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">客户名称 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="editing.name" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">统一社会信用代码</div>
            <UiInput v-model="editing.creditCode" placeholder="18 位，合同主体核验用" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">客户等级</div>
            <select v-model="editing.level" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="A">A（战略/大客户）</option><option value="B">B（成长客户）</option><option value="C">C（普通客户）</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">所属行业 <span class="text-[#F53F3F]">*</span></div>
            <select v-model="editing.industry" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="">请选择行业</option>
              <option v-for="i in INDUSTRIES" :key="i" :value="i">{{ i }}</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">客户来源</div>
            <select v-model="editing.source" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option value="">未选择</option>
              <option v-for="s in ['老客户续扩', '转介绍', '市场活动', '招标', '陌拜', '其他']" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">办公地址（省 / 市 / 区 + 详细地址）</div>
          <RegionCascader v-model="editing.address" with-detail />
        </div>
        <div class="rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] p-3">
          <div class="mb-2 text-[11px] font-semibold text-[#4E5969]">开票信息（客户主数据自维护；开票申请自动带出，专票必须维护税号）</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="mb-0.5 text-xs text-[#4E5969]">开票抬头</div>
              <UiInput v-model="editing.invoiceTitle" placeholder="默认同客户名称" />
            </div>
            <div>
              <div class="mb-0.5 text-xs text-[#4E5969]">开票税号</div>
              <UiInput v-model="editing.taxNo" placeholder="统一社会信用代码" />
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">联系人 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="editing.contact" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">联系人职务</div>
            <UiInput v-model="editing.contactTitle" placeholder="如 IT 部负责人" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">联系电话 <span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="editing.contactPhone" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">邮箱</div>
            <UiInput v-model="editing.email" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">归属销售 <span class="text-[#F53F3F]">*</span></div>
            <input class="h-9 w-full cursor-not-allowed rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-2 text-sm text-[#86909C]" :value="auth.profileData?.user?.name ?? ''" disabled title="新建客户自动归属当前登录人" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">客户状态</div>
            <select v-model="editing.status" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>潜在</option><option>合作中</option><option>正常</option>
            </select>
          </div>
        </div>
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
          <textarea v-model="editing.remark" class="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows="2" placeholder="经营要点、敏感点（如账期要求）、关键决策人等" />
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="editing = null">取消</UiButton>
          <UiButton size="sm" @click="save">保存</UiButton>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Search } from 'lucide-vue-next'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import RegionCascader from '../../components/RegionCascader.vue'
import { INDUSTRIES } from '../../data/industries'
import { createCustomer, customerPage, opportunityPage, updateCustomer } from '../../api/mdm'
import { contractPage } from '../../api/mdm'
import { billPage } from '../../api/fin'
import type { Bill } from '../../api/fin'
import { subscriptionList } from '../../api/lifecycle'
import type { Subscription } from '../../api/lifecycle'
import { woPage } from '../../api/wo'
import { useAuthStore } from '../../stores/auth'
import type { Contract, Customer, Opportunity } from '../../api/types'

const LEVEL_CLS: Record<string, string> = { A: 'bg-[#FFECE8] text-[#F53F3F]', B: 'bg-[#FFF3E8] text-[#FF7D00]', C: 'bg-[#F2F3F5] text-[#4E5969]' }
const STAGE_CLS: Record<string, string> = { 赢单: 'bg-[#E8F8F2] text-[#00B42A]', 输单: 'bg-[#F2F3F5] text-[#86909C]', 跟进中: 'bg-[#E8F3FF] text-[#165DFF]', 已报价: 'bg-[#FFF3E8] text-[#FF7D00]' }
const CONTRACT_CLS: Record<string, string> = { 已生效: 'bg-[#E8F8F2] text-[#00B42A]', 审批中: 'bg-[#FFF3E8] text-[#FF7D00]', 签署中: 'bg-[#E8F3FF] text-[#165DFF]' }

const route = useRoute()
const auth = useAuthStore()

const rows = ref<Customer[]>([])
const allOpps = ref<Opportunity[]>([])
const allContracts = ref<Contract[]>([])
const allBills = ref<{ bill: Bill }[]>([])
const allSubs = ref<Subscription[]>([])
const allWos = ref<{ id: number; code: string; status: string }[]>([])
const kw = ref('')
const pageNum = ref(1)
const pageSize = 10
const total = ref(0)
interface Editing {
  id?: number
  name: string
  creditCode: string
  level: string
  industry: string
  source: string
  address: string
  invoiceTitle: string
  taxNo: string
  contact: string
  contactPhone: string
  contactTitle: string
  email: string
  remark: string
  status: string
}
const editing = ref<Editing | null>(null)
const viewing = ref<Customer | null>(null)
const viewTab = ref<'overview' | 'opps' | 'contracts' | 'finance' | 'delivery'>('overview')

const isSelf = computed(() => (auth.profileData?.roles ?? []).includes('SALES'))

function money(n?: number) {
  return n == null ? '—' : n.toLocaleString('zh-CN')
}

async function load(page?: number) {
  if (page) pageNum.value = page
  const data = await customerPage({ kw: kw.value || undefined, pageNum: pageNum.value, pageSize })
  rows.value = data.records
  total.value = data.total
}

function oppCount(customerId: number) {
  return allOpps.value.filter((o) => o.customerId === customerId).length
}

function exportCsv() {
  const header = '客户编码,客户名称,等级,联系人,电话,行业,归属销售,状态'
  const lines = rows.value.map((c) =>
    [`CU-${String(c.id).padStart(4, '0')}`, c.name, c.level ?? '', c.contact ?? '', c.contactPhone ?? '', c.industry ?? '', c.salesName ?? '', c.status]
      .map((v) => String(v).replaceAll(',', '，')).join(','))
  const blob = new Blob(['﻿' + header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `客户档案_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function nearestEnd(customerName: string) {
  const list = allContracts.value.filter((c) => c.customerName === customerName && c.endDate)
  if (!list.length) return null
  return list.map((c) => c.endDate!).sort()[0]
}

const customerOpps = computed(() => (viewing.value ? allOpps.value.filter((o) => o.customerId === viewing.value!.id) : []))
const customerContracts = computed(() => (viewing.value ? allContracts.value.filter((c) => c.customerId === viewing.value!.id) : []))

const overviewItems = computed<[string, string][]>(() => {
  if (!viewing.value) return []
  const v = viewing.value
  return [
    ['客户编码', `CU-${String(v.id).padStart(4, '0')}`],
    ['统一社会信用代码', v.creditCode || '—'],
    ['等级', `${v.level ?? 'C'} 级`],
    ['行业 / 来源', `${v.industry || '—'} / ${v.source || '—'}`],
    ['联系人', `${v.contact || '—'} · ${v.contactPhone || '—'}`],
    ['归属销售', v.salesName || '—'],
    ['状态', v.status],
  ]
})

const viewTabs = computed(() => [
  { key: 'overview' as const, label: '总览', value: '基本信息', sub: '主数据与模块视图', color: '#165DFF' },
  { key: 'opps' as const, label: `商机 ${customerOpps.value.length}`, value: `${customerOpps.value.filter((o) => !['赢单', '输单'].includes(o.stage)).length} 个进行中`, sub: `赢单 ${customerOpps.value.filter((o) => o.stage === '赢单').length} · 输单 ${customerOpps.value.filter((o) => o.stage === '输单').length}`, color: '#7B61FF' },
  { key: 'contracts' as const, label: `合同 ${customerContracts.value.length}`, value: `${customerContracts.value.filter((c) => c.status === '已生效').length} 份生效`, sub: `在途 ${customerContracts.value.filter((c) => c.status !== '已生效').length} 份`, color: '#0D9488' },
  { key: 'finance' as const, label: `应收 ${customerBills.value.length}`, value: `${money(customerBills.value.reduce((s, b) => s + (b.amount - b.receivedAmt), 0))} 元`, sub: '未收余额合计', color: '#FF7D00' },
  { key: 'delivery' as const, label: `交付 ${customerSubs.value.length + customerWos.value.length}`, value: `${customerSubs.value.filter((s) => s.status === '在网').length} 条在网`, sub: `工单 ${customerWos.value.length} 个`, color: '#00B42A' },
])

const customerBills = computed(() => {
  if (!viewing.value) return []
  const cid = viewing.value.id
  return allBills.value.filter((r) => r.bill.customerId === cid).map((r) => r.bill)
})
const customerSubs = computed(() => (viewing.value ? allSubs.value.filter((s) => s.customer === viewing.value!.name) : []))
const customerWos = computed(() => {
  if (!viewing.value) return []
  const codes = new Set(customerContracts.value.map((c) => c.id))
  return allWos.value.filter((w) => (w as unknown as { contractId?: number }).contractId != null && codes.has((w as unknown as { contractId?: number }).contractId!))
})

function openView(c: Customer) {
  viewing.value = c
  viewTab.value = 'overview'
}

function closeView() {
  viewing.value = null
}

function openEdit(c: Customer | null) {
  editing.value = c
    ? {
        id: c.id, name: c.name, creditCode: c.creditCode ?? '', level: c.level ?? 'C', industry: c.industry ?? '',
        source: c.source ?? '', address: (c as any).address ?? '', invoiceTitle: (c as any).invoiceTitle ?? '',
        taxNo: (c as any).taxNo ?? '', contact: c.contact ?? '', contactPhone: c.contactPhone ?? '',
        contactTitle: (c as any).contactTitle ?? '', email: (c as any).email ?? '', remark: (c as any).remark ?? '',
        status: c.status,
      }
    : {
        name: '', creditCode: '', level: 'C', industry: '', source: '', address: '', invoiceTitle: '', taxNo: '',
        contact: '', contactPhone: '', contactTitle: '', email: '', remark: '', status: '潜在',
      }
}

async function save() {
  if (!editing.value?.name) return
  const e = editing.value
  const body = {
    name: e.name, creditCode: e.creditCode || undefined, level: e.level, industry: e.industry || undefined,
    source: e.source || undefined, address: e.address || undefined, invoiceTitle: e.invoiceTitle || undefined,
    taxNo: e.taxNo || undefined, contact: e.contact || undefined, contactPhone: e.contactPhone || undefined,
    contactTitle: e.contactTitle || undefined, email: e.email || undefined, remark: e.remark || undefined,
    status: e.status,
  }
  if (e.id) {
    await updateCustomer(e.id, body)
  } else {
    await createCustomer(body)
  }
  editing.value = null
  load()
}

onMounted(async () => {
  const customerId = route.query.customer
  if (customerId) {
    // 深链：从商机页带客户过滤（商机页自身支持 customer 过滤）
  }
  await Promise.all([load(1), opportunityPage({ pageNum: 1, pageSize: 200 }).then((d) => (allOpps.value = d.records))])
  allContracts.value = (await contractPage({ pageNum: 1, pageSize: 200 })).records
  billPage({ pageNum: 1, pageSize: 100 }).then((d) => (allBills.value = d.records)).catch(() => {})
  subscriptionList().then((d) => (allSubs.value = d)).catch(() => {})
  woPage({ pageNum: 1, pageSize: 100 }).then((d) => (allWos.value = d.records as unknown as { id: number; code: string; status: string }[])).catch(() => {})
})
</script>
