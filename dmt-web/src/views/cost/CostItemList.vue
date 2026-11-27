<template>
  <main class="space-y-4 p-6">
    <!-- 页签：成本条目 | 计价标准 -->
    <div class="flex gap-1 border-b border-[#E5E6EB]">
      <button
        v-for="t in [['items', '成本条目'], ['rates', '计价标准（工时费率）']] as const"
        :key="t[0]"
        class="-mb-px border-b-2 px-3 py-2 text-sm"
        :class="page === t[0] ? 'border-[#165DFF] font-medium text-[#165DFF]' : 'border-transparent text-[#4E5969] hover:text-[#1D2129]'"
        @click="page = t[0]"
      >{{ t[1] }}</button>
    </div>

    <!-- ============ 计价标准（工时费率） ============ -->
    <template v-if="page === 'rates'">
      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div>
          <span class="text-sm font-semibold text-[#1D2129]">计价标准</span>
          <span class="ml-2 text-[11px] text-[#86909C]">跨资源共用的计价规则：工时费率（开通实施 / 安装调测 / 运维投入共用一条费率线）。具体资源的价格（月租 / 单价 / 采购价）挂在 R1~R4 资源档案与采购合同上，不在此维护</span>
        </div>
        <UiButton size="sm" @click="openRate(null)">＋ 新增费率</UiButton>
      </div>
      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">岗位 / 级别</th><th class="px-3 py-2 text-right">费率（元/人天）</th>
              <th class="px-3 py-2">生效日期</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">备注</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rates" :key="r.id" class="border-b last:border-0 hover:bg-[#F7F8FA]" :class="r.status === '停用' ? 'opacity-55' : ''">
              <td class="px-3 py-3 font-medium text-[#1D2129]">{{ r.role }}</td>
              <td class="px-3 py-3 text-right font-mono font-semibold text-[#1D2129]">{{ r.rate.toLocaleString('zh-CN') }}</td>
              <td class="px-3 py-3 font-mono text-[#4E5969]">{{ r.effectAt ?? '—' }}</td>
              <td class="px-3 py-3"><span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="r.status === '启用' ? 'bg-[#E8F8F2] text-[#00B42A]' : 'bg-[#F2F3F5] text-[#4E5969]'">{{ r.status }}</span></td>
              <td class="max-w-56 truncate px-3 py-3 text-[#86909C]" :title="r.remark">{{ r.remark ?? '—' }}</td>
              <td class="px-3 py-3 text-right">
                <button class="text-[11px] text-[#165DFF] hover:underline" @click="openRate(r)">编辑</button>
              </td>
            </tr>
            <tr v-if="!rates.length"><td colspan="6" class="px-3 py-10 text-center text-[#86909C]">暂无费率</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ============ 成本条目 ============ -->
    <template v-else>
      <div class="rounded-[4px] border border-[#BEDAFF] bg-[#F0F5FF] px-4 py-2.5 text-xs leading-5 text-[#1D2129]">
        <span class="font-semibold">成本模型主线：</span>直接成本随单实时算，间接费用归集成本中心、月末按中心分法分到订单。本库是全系统算账口径的唯一出处：条目的「计算方式」由系统实现，核算单填报与试算走同一引擎，页面不写死算法。
        <router-link to="/product/bom" class="text-[#165DFF] hover:underline">前往资源清单 →</router-link>
      </div>

      <div class="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div class="flex flex-wrap items-center gap-3">
          <span class="shrink-0 whitespace-nowrap text-sm font-semibold text-[#1D2129]">成本条目库</span>
          <span class="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] text-[#4E5969]">共 {{ rows.length }} 项</span>
          <span class="rounded-[2px] bg-[#E8F8F2] px-2 py-0.5 text-[11px] text-[#00B42A]">生效 {{ activeCount }}</span>
          <span class="rounded-[2px] bg-[#E8F3FF] px-2 py-0.5 text-[11px] text-[#165DFF]">被装配 {{ assembledCount }}</span>
          <UiInput v-model="kw" class="w-48" placeholder="搜索名称 / 编码" />
        </div>
        <UiButton size="sm" @click="openEdit(null)">＋ 新建条目</UiButton>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <button
          v-for="d in DEPT_TABS"
          :key="d.value"
          class="rounded-[2px] border px-2.5 py-1"
          :class="deptTab === d.value ? 'border-[#165DFF] bg-[#E8F3FF] text-[#165DFF]' : 'border-[#E5E6EB] text-[#4E5969] hover:border-[#94BFFF]'"
          @click="deptTab = d.value"
        >{{ d.label }}</button>
        <span class="mx-1 h-4 w-px bg-[#E5E6EB]" />
        <button
          v-for="s in ['全部状态', '生效', '草稿', '停用']"
          :key="s"
          class="rounded-[2px] px-2 py-1"
          :class="statusTab === s ? 'bg-[#F2F3F5] font-medium text-[#1D2129]' : 'text-[#86909C] hover:text-[#4E5969]'"
          @click="statusTab = s"
        >{{ s }}</button>
      </div>

      <div class="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th class="px-3 py-2">编码</th><th class="px-3 py-2">条目名称</th><th class="px-3 py-2">类别</th>
              <th class="px-3 py-2">计算方式</th><th class="px-3 py-2">取数来源</th><th class="px-3 py-2">成本中心</th>
              <th class="px-3 py-2">被装配</th><th class="px-3 py-2">状态</th><th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in filtered" :key="it.id" class="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" :class="it.status === '停用' ? 'opacity-55' : ''" @click="detail = it">
              <td class="px-3 py-3 font-mono text-[#4E5969]">{{ it.itemKey }}</td>
              <td class="max-w-52 truncate px-3 py-3 font-medium text-[#1D2129]" :title="it.name">{{ it.name }}</td>
              <td class="px-3 py-3">
                <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="it.category === '资源驱动' ? 'bg-[#E8F3FF] text-[#165DFF]' : 'bg-[#FFF3E8] text-[#FF7D00]'">{{ it.category ?? '手工录入' }}</span>
                <span class="ml-1 rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]" :title="SETTLE_RULE[it.settleType ?? '直接']">{{ it.settleType ?? '直接' }}</span>
              </td>
              <td class="px-3 py-3 text-[#4E5969]">{{ it.calcKind ?? '—' }}</td>
              <td class="px-3 py-3 text-[#4E5969]">{{ it.category === '资源驱动' ? archiveName(it.sourceArchive) : '—' }}</td>
              <td class="px-3 py-3">
                <span v-if="it.settleType === '间接'" :class="it.costCenter ? 'text-[#4E5969]' : 'text-[#F53F3F]'">{{ it.costCenter ? centerName(it.costCenter) : '未选中心' }}</span>
                <span v-else class="text-[#C9CDD4]">随单直接成本</span>
              </td>
              <td class="px-3 py-3">
                <span v-if="it.refCount" class="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{{ it.refCount }} 个类型</span>
                <span v-else class="text-[#C9CDD4]">—</span>
              </td>
              <td class="px-3 py-3" @click.stop>
                <div class="flex items-center gap-2">
                  <span class="rounded-[2px] px-1.5 py-0.5 text-[10px]" :class="STATUS_CLS[it.status] ?? STATUS_CLS['草稿']">{{ it.status }}</span>
                  <button
                    v-if="it.status !== '生效'"
                    class="text-[11px] text-[#165DFF] hover:underline"
                    :title="missingOf(it).length ? `缺少：${missingOf(it).join('、')}` : '置为生效'"
                    @click="toActive(it)"
                  >生效</button>
                  <button v-if="it.status !== '停用'" class="text-[11px] text-[#F53F3F] hover:underline" title="停用" @click="toDisable(it)">停用</button>
                </div>
              </td>
              <td class="px-3 py-3 text-right" @click.stop>
                <button class="text-[11px] text-[#4E5969] hover:underline" @click="openEdit(it)">编辑</button>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="9" class="px-3 py-10 text-center text-[#86909C]">暂无条目</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 条目详情 -->
    <CenterModal :model-value="!!detail" :title="`条目详情 · ${detail?.name ?? ''}`" :width="560" @update:model-value="detail = null">
      <div v-if="detail" class="space-y-2 text-xs">
        <div v-for="[k, v] in detailRows(detail)" :key="k" class="flex justify-between border-b border-dashed border-[#F2F3F5] py-1.5">
          <span class="shrink-0 text-[#86909C]">{{ k }}</span>
          <span class="max-w-80 truncate text-right font-medium text-[#1D2129]" :title="v">{{ v }}</span>
        </div>
        <div class="rounded-[2px] bg-[#FFF7E8] px-2 py-1.5 leading-5 text-[#FF7D00]">{{ SETTLE_RULE[detail.settleType ?? '直接'] }}</div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="detail = null">关闭</UiButton>
          <UiButton size="sm" @click="openEdit(detail); detail = null">编辑该条目</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 费率编辑 -->
    <CenterModal :model-value="!!rateEditing" :title="rateEditing?.id ? '编辑费率' : '新增费率'" :width="440" @update:model-value="rateEditing = null">
      <div v-if="rateEditing" class="space-y-3">
        <div>
          <div class="mb-0.5 text-xs text-[#4E5969]">岗位 / 级别 <span class="text-[#F53F3F]">*</span></div>
          <UiInput v-model="rateEditing.role" placeholder="如 网络工程师（实施/运维）" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">费率（元/人天）<span class="text-[#F53F3F]">*</span></div>
            <UiInput v-model="rateEditing.rateText" type="number" />
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">生效日期</div>
            <UiInput v-model="rateEditing.effectAt" type="date" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">状态</div>
            <select v-model="rateEditing.status" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
              <option>启用</option><option>停用</option>
            </select>
          </div>
          <div>
            <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
            <UiInput v-model="rateEditing.remark" />
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <UiButton variant="outline" size="sm" @click="rateEditing = null">取消</UiButton>
          <UiButton size="sm" :disabled="!rateEditing.role || !rateEditing.rateText" @click="saveRate">保存</UiButton>
        </div>
      </div>
    </CenterModal>

    <!-- 条目编辑 -->
    <CenterModal :model-value="!!editing" :title="editing?.id ? `编辑条目 · ${editing.itemKey}` : '新建成本条目'" :width="640" @update:model-value="editing = null">
      <div v-if="editing" class="space-y-4">
        <div v-if="locked" class="rounded-[2px] border border-[#FFCF8B] bg-[#FFF3E8] px-2.5 py-1.5 text-[11px] leading-5 text-[#FF7D00]">
          该条目正被 {{ editing.refCount }} 个产品类型装配：取数来源 / 适用资源 / 计价方式 / 算账去向 / 归属成本中心 已锁定；如需修改，请先在对应产品类型中解除装配。
        </div>

        <!-- 口径摘要（大白话，实时联动） -->
        <div class="rounded-[4px] border border-[#BEDAFF] bg-[#F7FBFF] px-3 py-2">
          <span class="text-[11px] font-medium text-[#165DFF]">这笔账的口径（大白话）</span>
          <div class="text-[11px] leading-5 text-[#4E5969]">{{ summary }}</div>
        </div>

        <!-- ① 基本信息 -->
        <section>
          <div class="mb-1.5 text-xs font-semibold text-[#1D2129]">基本信息</div>
          <div class="space-y-2.5">
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <div class="mb-0.5 text-xs text-[#4E5969]">条目名称 <span class="text-[#F53F3F]">*</span></div>
                <UiInput v-model="editing.name" placeholder="如：出口带宽租用费" />
              </div>
              <div>
                <div class="mb-0.5 text-xs text-[#4E5969]">填报部门</div>
                <select v-model="editing.dept" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
                  <option value="支撑部">业务支撑部</option><option value="技术部">技术部</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <div class="mb-0.5 text-xs text-[#4E5969]">数从哪来？<span v-if="locked" class="text-[#C9CDD4]">（被装配锁定）</span></div>
                <select v-model="editing.category" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked" @change="onCategoryChange">
                  <option value="资源驱动">从档案里挑一条资源（自动带出价格）</option>
                  <option value="手工录入">填核算单时人工填数（没有现成档案）</option>
                </select>
              </div>
              <div>
                <div class="mb-0.5 text-xs text-[#4E5969]">这笔账算到哪？ <span class="text-[#F53F3F]">*</span><span v-if="locked" class="text-[#C9CDD4]">（锁定）</span></div>
                <select v-model="editing.settleType" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked">
                  <option value="直接">直接成本（这单专属，随单算）</option>
                  <option value="间接">间接费用（大家共用，成本中心月结分）</option>
                </select>
                <div class="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">{{ SETTLE_RULE[editing.settleType] }}</div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <div class="mb-0.5 text-xs text-[#4E5969]">费用类型</div>
                <select v-model="editing.costType" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
                  <option>周期性</option><option>一次性</option>
                </select>
              </div>
              <div>
                <div class="mb-0.5 text-xs text-[#4E5969]">计量单位</div>
                <UiInput v-model="editing.unit" list="ci-unit-opts" placeholder="如：元/月" />
                <datalist id="ci-unit-opts">
                  <option v-for="u in UNIT_OPTS" :key="u" :value="u" />
                </datalist>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <div class="mb-0.5 text-xs text-[#4E5969]">填报要求</div>
                <select v-model="editing.requiredFlag" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm">
                  <option value="按装配">默认填报（随模板带出，可删可补回）</option>
                  <option value="否">按需选配（默认不带出）</option>
                </select>
              </div>
              <div v-if="editing.settleType === '间接'">
                <div class="mb-0.5 text-xs text-[#4E5969]">归到哪个成本中心 <span class="text-[#F53F3F]">*</span><span v-if="locked" class="text-[#C9CDD4]">（锁定）</span></div>
                <select v-model="editing.costCenter" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked">
                  <option value="" disabled>请选择…</option>
                  <option v-for="c in centers" :key="c.code" :value="c.code">{{ c.name }}（{{ c.settleRule ?? '—' }}）</option>
                </select>
              </div>
            </div>
            <div>
              <div class="mb-0.5 text-xs text-[#4E5969]">可增补类别（受控增补范围）</div>
              <div class="flex flex-wrap items-center gap-2 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5">
                <label v-for="c in categoryOpts" :key="c" class="flex cursor-pointer items-center gap-1 text-xs text-[#4E5969]">
                  <input
                    type="checkbox"
                    class="accent-[#165DFF]"
                    :checked="editing.cats.includes(c)"
                    @change="toggleCat(c)"
                  >{{ c }}
                </label>
                <span v-if="!categoryOpts.length" class="text-[11px] text-[#C9CDD4]">产品类别加载中…</span>
              </div>
              <div class="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">
                核算单「增补条目」只能加与订单产品类别有绑定的条目（设计 §6.5 受控增补）；一个都不勾 = 只能被「按组成推导」自动带出，不能手工增补。
              </div>
            </div>
            <div v-if="editing.category === '资源驱动'">
              <div class="mb-0.5 text-xs text-[#4E5969]">从哪个档案挑？ <span class="text-[#F53F3F]">*</span><span v-if="locked" class="text-[#C9CDD4]">（锁定）</span></div>
              <select v-model="editing.sourceArchive" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked" @change="onArchiveChange">
                <option value="" disabled>请选择…</option>
                <option v-for="a in ARCHIVE_OPTS" :key="a.key" :value="a.key">{{ a.name }}</option>
              </select>
              <div class="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">
                核算填报时，填报人从这个档案里挑选资源；<strong class="text-[#86909C]">挑选列表自动按订单的产品类型过滤</strong>——只显示适用于该类型的资源。
              </div>
            </div>
            <div v-if="editing.settleType !== '间接'">
              <div class="mb-0.5 text-xs text-[#4E5969]">适用资源（这笔账对应哪个资源）<span v-if="editing.category !== '资源驱动' || !editing.sourceArchive" class="text-[#F53F3F]"> *</span><span v-if="locked" class="text-[#C9CDD4]">（锁定）</span></div>
              <div v-if="editing.category === '资源驱动'" class="flex h-9 items-center rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-2 text-sm text-[#4E5969]">
                {{ editing.appliesTo ? matName(editing.appliesTo) : '选完取数档案自动确定' }}
              </div>
              <select v-else v-model="editing.appliesTo" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked">
                <option value="" disabled>请选择…</option>
                <option v-for="m in materialDefs" :key="m.matKey" :value="m.matKey">{{ m.name }}</option>
              </select>
              <div class="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">
                {{ editing.category === '资源驱动' && editing.sourceArchive ? '已按取数档案自动确定，无需手选。' : '产品组成里有这个资源时，这笔账自动进入该产品的核算单（资源清单页的直接成本由组成推导）。' }}
              </div>
            </div>
          </div>
        </section>

        <!-- ② 计算规则（间接费用无自己的算式） -->
        <section v-if="editing.settleType === '间接'" class="rounded-[2px] border border-[#FFE58F] bg-[#FFFBE8] px-3 py-2 text-[11px] leading-5 text-[#D25F00]">
          这笔钱<strong>不用单独设算式</strong>：先归集到成本中心，月末由中心按它选的分法统一算出每单该摊多少。
          <template v-if="editing.costCenter">该中心当前的分法：<span class="text-[#4E5969]">{{ centers.find((c) => c.code === editing?.costCenter)?.settleRule ?? '—' }}</span></template>
          <router-link class="ml-1 text-[#165DFF] hover:underline" to="/cost-centers">改分法 → 成本中心</router-link>
        </section>
        <section v-else>
          <div class="mb-1.5 flex items-baseline gap-2">
            <span class="text-xs font-semibold text-[#1D2129]">钱怎么算？选一种计价方式<span v-if="locked" class="ml-1 text-[10px] font-normal text-[#C9CDD4]">（被装配锁定）</span></span>
            <span class="text-[10px] text-[#86909C]">计算方式由系统实现：算式自动派生，试算与核算单填报同一引擎</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5" :class="locked ? 'pointer-events-none opacity-60' : ''">
            <button
              v-for="md in METHODS"
              :key="md.key"
              class="rounded-[2px] border px-2.5 py-1.5 text-left transition-colors"
              :class="editing.calcMethod === md.key ? 'border-[#165DFF] bg-[#F0F5FF]' : 'border-[#E5E6EB] hover:border-[#94BFFF]'"
              @click="pickMethod(md.key)"
            >
              <div class="text-xs font-medium text-[#1D2129]">{{ md.name }}</div>
              <div class="mt-0.5 truncate text-[10px] text-[#86909C]" :title="md.desc">{{ md.desc }}</div>
            </button>
          </div>

          <template v-if="editing.calcMethod">
            <!-- 方式参数（结构化，存 calc_params） -->
            <div v-if="hasParams" class="mt-2 space-y-2.5 rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2.5">
              <template v-if="editing.calcMethod === 'QTY_PRICE'">
                <div class="grid grid-cols-2 gap-2.5">
                  <div>
                    <div class="mb-0.5 text-xs text-[#4E5969]">单价来源</div>
                    <select v-model="editing.params.priceSource" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked">
                      <option value="equipment">设备档案采购价</option>
                      <option value="param">固定单价（本条目维护）</option>
                      <option value="manual">填报时录入</option>
                    </select>
                  </div>
                  <div v-if="editing.params.priceSource === 'param'">
                    <div class="mb-0.5 text-xs text-[#4E5969]">固定单价（元）<span class="text-[#F53F3F]">*</span></div>
                    <UiInput v-model="editing.params.unitPrice" type="number" placeholder="如 39" :disabled="locked" />
                  </div>
                </div>
              </template>
              <template v-else-if="editing.calcMethod === 'POOL_SHARE'">
                <div>
                  <div class="mb-0.5 text-xs text-[#4E5969]">出口池</div>
                  <select v-model="editing.params.poolCode" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked">
                    <option value="">核算时按单选池</option>
                    <option v-for="p in pools" :key="p.code" :value="p.code">{{ p.code }} {{ p.name }}（月租 {{ p.rentMonth?.toLocaleString('zh-CN') }} 元 / 已售 {{ p.usedM }}M）</option>
                  </select>
                  <div class="mt-1 text-[10px] text-[#86909C]">口径 v1.1 两步法：池月成本 ÷（池已售 ＋ 本单带宽）× 本单带宽；池档案取资源中心实时水位</div>
                </div>
              </template>
              <template v-else-if="editing.calcMethod === 'BGP_UTIL'">
                <div class="grid grid-cols-2 gap-2.5">
                  <div>
                    <div class="mb-0.5 text-xs text-[#4E5969]">出口组</div>
                    <select v-model="editing.params.poolCode" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked">
                      <option value="">核算时按单选组</option>
                      <option v-for="p in pools" :key="p.code" :value="p.code">{{ p.code }} {{ p.name }}（容量 {{ p.capacityM }}M）</option>
                    </select>
                  </div>
                  <div>
                    <div class="mb-0.5 text-xs text-[#4E5969]">目标利用率 <span class="text-[#F53F3F]">*</span></div>
                    <UiInput v-model="editing.params.targetUtil" type="number" placeholder="0.8" :disabled="locked" />
                  </div>
                </div>
              </template>
              <template v-else-if="editing.calcMethod === 'MANDAY'">
                <div>
                  <div class="mb-0.5 text-xs text-[#4E5969]">费率岗位 <span class="text-[#F53F3F]">*</span></div>
                  <select v-model="editing.params.rateRole" class="h-9 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm disabled:bg-[#F2F3F5]" :disabled="locked">
                    <option value="" disabled>从「计价标准」选择</option>
                    <option v-for="r in rates.filter((x) => x.status === '启用')" :key="r.id" :value="r.role">{{ r.role }}（{{ r.rate.toLocaleString('zh-CN') }} 元/人天）</option>
                  </select>
                </div>
              </template>
              <template v-else-if="editing.calcMethod === 'PER_OBJECT'">
                <div class="grid grid-cols-2 gap-2.5">
                  <div>
                    <div class="mb-0.5 text-xs text-[#4E5969]">池月金额（元）</div>
                    <UiInput v-model="editing.params.monthlyAmount" type="number" placeholder="可空，试算/填报时录入" :disabled="locked" />
                  </div>
                  <div>
                    <div class="mb-0.5 text-xs text-[#4E5969]">服务对象数</div>
                    <UiInput v-model="editing.params.objectCount" type="number" placeholder="可空，试算/填报时录入" :disabled="locked" />
                  </div>
                </div>
              </template>
              <template v-else-if="editing.calcMethod === 'FIXED'">
                <div>
                  <div class="mb-0.5 text-xs text-[#4E5969]">金额（元）<span class="text-[#F53F3F]">*</span></div>
                  <UiInput v-model="editing.params.amount" type="number" placeholder="按合同或约定定额" :disabled="locked" />
                </div>
              </template>
              <div v-else-if="editing.calcMethod === 'RESALE'" class="text-[11px] text-[#86909C]">无参数：采购数量与采购价在核算单填报时按采购单录入，直接结转不加成。</div>
              <div v-else-if="editing.calcMethod === 'MANUAL'" class="text-[11px] text-[#86909C]">无算式：核算单填报时手工录入金额，全程留痕（手工填入兜底口径）。</div>
            </div>

            <!-- 算式预览（保存时服务端同口径派生） -->
            <div class="mt-2 flex items-center gap-2 rounded-[2px] bg-[#F2F3F5] px-3 py-1.5">
              <span class="shrink-0 text-[10px] text-[#86909C]">算式</span>
              <span class="font-mono text-[11px] text-[#1D2129]">{{ formulaPreview }}</span>
            </div>

            <!-- 试算：调 /cost-items/trial，与核算单填报同一引擎 -->
            <div v-if="editing.calcMethod !== 'MANUAL'" class="mt-2 rounded-[2px] border border-[#7BD9A8] bg-[#F0FBF5] px-3 py-2">
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="text-[11px] font-semibold text-[#00701A]">试算（改数值即时验算）</span>
                <template v-for="f in trialFields" :key="f.key">
                  <span class="text-[#4E5969]">{{ f.label }}</span>
                  <select v-if="f.kind === 'pool'" v-model="trialVals[f.key]" class="h-7 rounded-[2px] border border-[#E5E6EB] bg-white px-1.5 text-xs">
                    <option value="" disabled>选择</option>
                    <option v-for="p in pools" :key="p.code" :value="p.code">{{ p.code }}</option>
                  </select>
                  <select v-else-if="f.kind === 'equipment'" v-model="trialVals[f.key]" class="h-7 rounded-[2px] border border-[#E5E6EB] bg-white px-1.5 text-xs">
                    <option value="" disabled>选择</option>
                    <option v-for="q in equipment" :key="q.id" :value="String(q.id)">{{ q.name }}（{{ q.costPrice?.toLocaleString('zh-CN') }} 元）</option>
                  </select>
                  <input v-else v-model="trialVals[f.key]" type="number" class="h-7 w-24 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-right font-mono text-xs" />
                </template>
                <UiButton size="sm" :disabled="trialLoading" @click="runTrial">{{ trialLoading ? '计算中…' : '试算' }}</UiButton>
              </div>
              <div v-if="trialResult" class="mt-1.5 border-t border-[#7BD9A8] pt-1.5 font-mono text-[11px] leading-5">
                <span v-if="trialResult.amount != null" class="mr-2 font-semibold text-[#00701A]">= {{ trialResult.amount.toLocaleString('zh-CN') }} 元</span>
                <span class="text-[#4E5969]">{{ trialResult.calcText }}</span>
              </div>
            </div>
          </template>
        </section>

        <!-- ③ 补充信息 -->
        <section>
          <div class="mb-1.5 text-xs font-semibold text-[#1D2129]">补充信息<span class="ml-1.5 text-[10px] font-normal text-[#86909C]">均可空</span></div>
          <div class="space-y-2.5">
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <div class="mb-0.5 text-xs text-[#4E5969]">科目</div>
                <UiInput v-model="editing.subject" placeholder="如 带宽成本" />
              </div>
            </div>
            <div>
              <div class="mb-0.5 text-xs text-[#4E5969]">备注</div>
              <textarea v-model="editing.remark" class="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows="2" placeholder="口径说明、例外处理等" />
            </div>
          </div>
        </section>

        <div class="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          <div class="flex items-center gap-2 text-[10px]">
            <span v-if="!locked && missList.length" class="rounded-[2px] bg-[#FFF7E8] px-1.5 py-0.5 text-[#FF7D00]">距可生效还缺：{{ missList.join('、') }}</span>
            <span class="font-mono text-[#C9CDD4]">{{ editing.itemKey || '编码保存后自动生成' }}</span>
          </div>
          <div class="flex gap-2">
            <UiButton variant="outline" size="sm" @click="editing = null">取消</UiButton>
            <UiButton size="sm" :disabled="!editing.name" @click="doSave">{{ editing.id ? '保存变更（全程留痕）' : '保存为草稿' }}</UiButton>
          </div>
        </div>
      </div>
    </CenterModal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import UiButton from '../../components/ui/Button.vue'
import UiInput from '../../components/ui/Input.vue'
import CenterModal from '../../components/CenterModal.vue'
import { costItemList } from '../../api/prd'
import { materialList } from '../../api/material'
import type { Material } from '../../api/material'
import { http } from '../../api/request'
import type { CostItem } from '../../api/types'

interface Rate { id: number; dictKey: string; role: string; rate: number; effectAt?: string; status: string; remark?: string }
interface Center { id: number; code: string; name: string; settleType: string; settleRule?: string }
interface Pool { id: number; code: string; name: string; capacityM?: number; usedM?: number; rentMonth?: number; status?: string }
interface Equipment { id: number; name: string; category?: string; costPrice?: number; stock?: number }
type ItemX = CostItem & {
  settleType?: string; formula?: string; costCenter?: string; refCount?: number
  calcMethod?: string; calcParams?: string; category?: string; sourceArchive?: string
  requiredFlag?: string; remark?: string; cats?: string[]
}

interface CalcParams {
  priceSource: string; unitPrice: string; poolCode: string; targetUtil: string
  rateRole: string; monthlyAmount: string; objectCount: string; amount: string
}
function emptyParams(): CalcParams {
  return { priceSource: '', unitPrice: '', poolCode: '', targetUtil: '', rateRole: '', monthlyAmount: '', objectCount: '', amount: '' }
}
interface EditForm {
  id?: number; itemKey: string; name: string; dept: string; costType: string; settleType: string
  category: string; sourceArchive: string; appliesTo: string; costCenter: string
  requiredFlag: string; unit: string; subject: string; remark: string
  calcMethod: string; params: CalcParams; status: string
  cats: string[]
  refCount?: number
}

/** 计算方式（与后端 CostCalcService.METHOD_LABELS 一一对应；算法在服务端实现，此处只做选择与参数录入） */
const METHODS = [
  { key: 'QTY_PRICE', name: '按量计价', desc: '数量 × 单价：设备、物料、IP、端口等' },
  { key: 'POOL_SHARE', name: '池化分摊', desc: '池月成本 ÷（池已售＋本单带宽）× 本单带宽：出口共用（口径 v1.1）' },
  { key: 'BGP_UTIL', name: '目标利用率', desc: '带宽 × 组月成本 ÷ 规划容量 ÷ 目标利用率：BGP 出口组' },
  { key: 'MANDAY', name: '工时计价', desc: '人天 × 费率：实施 / 运维人工，费率取「计价标准」' },
  { key: 'PER_OBJECT', name: '按对象分摊', desc: '池月金额 ÷ 对象数：平台、监控、订阅服务' },
  { key: 'RESALE', name: '直接结转', desc: '采购数量 × 采购价，不加成：转售业务' },
  { key: 'FIXED', name: '固定金额', desc: '定额费用：按合同或约定填列' },
  { key: 'MANUAL', name: '手工填列', desc: '无系统算式，核算单填报时手工录入' },
] as const

/** 取数档案（与原型 ARCHIVE_OPTS 一致）；适用资源由档案自动推导（SOURCE_TO_MAT） */
const ARCHIVE_OPTS = [
  { key: 'r1', name: 'R1 出口线路档案' },
  { key: 'r2', name: 'R2 基础线路档案' },
  { key: 'r3', name: 'R3 IP 地址段' },
  { key: 'r4', name: 'R4 设备库存' },
  { key: 'resale', name: '采购合同（转售批发价）' },
] as const
const SOURCE_TO_MAT: Record<string, string> = { r1: 'mat_exit', r2: 'mat_base', r3: 'mat_ip', r4: 'mat_dev', resale: 'mat_resale' }
const SETTLE_RULE: Record<string, string> = {
  直接: '这单专属的成本：选档案带出单价随单算，或由填报部门按计价方式填报',
  间接: '分不清算哪单的共用费用：先归集到成本中心，月末按中心的分法分到各订单',
}
const UNIT_OPTS = ['元/月', '元', '人天', '台', '条', '个', 'M']
const DEPT_TABS = [
  { value: '全部', label: '全部' },
  { value: '支撑部', label: '业务支撑部' },
  { value: '技术部', label: '技术部' },
]
const STATUS_CLS: Record<string, string> = {
  草稿: 'bg-[#F2F3F5] text-[#4E5969]',
  生效: 'bg-[#E8F8F2] text-[#00B42A]',
  停用: 'bg-[#FFECE8] text-[#F53F3F]',
}

interface TrialField { key: string; label: string; kind: 'number' | 'pool' | 'equipment' }

const page = ref<'items' | 'rates'>('items')
const rows = ref<ItemX[]>([])
const rates = ref<Rate[]>([])
const centers = ref<Center[]>([])
const pools = ref<Pool[]>([])
const equipment = ref<Equipment[]>([])
const materialDefs = ref<Material[]>([])
const categoryOpts = ref<string[]>([])
const kw = ref('')
const deptTab = ref('全部')
const statusTab = ref('全部状态')
const detail = ref<ItemX | null>(null)
const editing = ref<EditForm | null>(null)
const trialVals = ref<Record<string, string>>({})
const trialResult = ref<{ amount: number | null; calcText: string } | null>(null)
const trialLoading = ref(false)
const rateEditing = ref<{ id?: number; role: string; rateText: string; effectAt: string; status: string; remark: string } | null>(null)

const activeCount = computed(() => rows.value.filter((i) => i.status === '生效').length)
const assembledCount = computed(() => rows.value.filter((i) => (i.refCount ?? 0) > 0).length)

const filtered = computed(() => rows.value.filter((i) => {
  if (kw.value && !i.name.includes(kw.value) && !i.itemKey.includes(kw.value)) return false
  if (deptTab.value !== '全部' && i.dept !== deptTab.value) return false
  if (statusTab.value !== '全部状态' && i.status !== statusTab.value) return false
  return true
}))

/** 被装配条目：关键字段锁定（取数来源/适用资源/计价方式/算账去向/归属成本中心） */
const locked = computed(() => (editing.value?.refCount ?? 0) > 0)

const hasParams = computed(() => {
  const m = editing.value?.calcMethod
  return m === 'QTY_PRICE' || m === 'POOL_SHARE' || m === 'BGP_UTIL' || m === 'MANDAY' || m === 'PER_OBJECT' || m === 'FIXED' || m === 'RESALE' || m === 'MANUAL'
})

/** 四要素校验（与后端 missingElements 同口径） */
function missingOf(it: { settleType?: string; category?: string; sourceArchive?: string; calcMethod?: string; appliesTo?: string; costCenter?: string }): string[] {
  const miss: string[] = []
  if (!it.settleType) miss.push('算账去向')
  if (it.category === '资源驱动' && !it.sourceArchive) miss.push('取数来源')
  if (it.settleType !== '间接' && !it.calcMethod) miss.push('计价方式')
  if (it.settleType !== '间接' && !it.appliesTo) miss.push('适用资源')
  if (it.settleType === '间接' && !it.costCenter) miss.push('归属成本中心')
  return miss
}
const missList = computed(() => (editing.value ? missingOf(editing.value) : []))

/** 试算输入项：参数里已定的不再重复问（与后端 calc 入参口径一致） */
const trialFields = computed<TrialField[]>(() => {
  const e = editing.value
  if (!e || e.settleType === '间接') return []
  const p = e.params
  switch (e.calcMethod) {
    case 'QTY_PRICE': {
      const f: TrialField[] = [{ key: 'qty', label: '数量', kind: 'number' }]
      if (p.priceSource === 'equipment') f.push({ key: 'equipmentId', label: '设备', kind: 'equipment' })
      if (!p.priceSource || p.priceSource === 'manual') f.push({ key: 'unitPrice', label: '单价（元）', kind: 'number' })
      return f
    }
    case 'POOL_SHARE':
      return p.poolCode
        ? [{ key: 'qty', label: '本单带宽（M）', kind: 'number' }]
        : [{ key: 'qty', label: '本单带宽（M）', kind: 'number' }, { key: 'poolCode', label: '出口池', kind: 'pool' }]
    case 'BGP_UTIL':
      return p.poolCode
        ? [{ key: 'qty', label: '本单带宽（M）', kind: 'number' }]
        : [{ key: 'qty', label: '本单带宽（M）', kind: 'number' }, { key: 'poolCode', label: '出口组', kind: 'pool' }]
    case 'MANDAY':
      return [{ key: 'qty', label: '人天', kind: 'number' }]
    case 'PER_OBJECT': {
      const f: TrialField[] = []
      if (!p.monthlyAmount) f.push({ key: 'monthlyAmount', label: '池月金额（元）', kind: 'number' })
      if (!p.objectCount) f.push({ key: 'objectCount', label: '服务对象数', kind: 'number' })
      return f
    }
    case 'RESALE':
      return [{ key: 'qty', label: '采购数量', kind: 'number' }, { key: 'unitPrice', label: '采购价（元）', kind: 'number' }]
    default:
      return []
  }
})

/** 算式预览：与服务端 formulaText 同口径的展示镜像（保存时以服务端派生为准） */
const formulaPreview = computed(() => {
  const e = editing.value
  if (!e) return ''
  const p = e.params
  switch (e.calcMethod) {
    case 'QTY_PRICE':
      if (p.priceSource === 'equipment') return '数量 × 设备档案采购价'
      if (p.priceSource === 'param') return `数量 × 单价 ${p.unitPrice || '?'} 元`
      return '数量 × 单价（填报时录入）'
    case 'POOL_SHARE':
      return `本单带宽 ÷（池已售 ＋ 本单带宽）× 池月成本（${p.poolCode || '核算时选池'}）`
    case 'BGP_UTIL':
      return `本单带宽 × 组月成本 ÷ 规划容量 ÷ 目标利用率 ${p.targetUtil || '0.8'}${p.poolCode ? `（${p.poolCode}）` : ''}`
    case 'MANDAY':
      return `人天 × 费率（${p.rateRole || '未选岗位'}，计价标准）`
    case 'PER_OBJECT':
      return '池月金额 ÷ 服务对象数'
    case 'RESALE':
      return '采购数量 × 采购价（直接结转，不加成）'
    case 'FIXED':
      return `固定金额 ${p.amount || '?'} 元`
    case 'MANUAL':
      return '手工填列（核算单填报时录入金额）'
    default:
      return ''
  }
})

/** 口径摘要（大白话，与原型 summary 同结构） */
const summary = computed(() => {
  const e = editing.value
  if (!e) return ''
  const calc = e.settleType === '间接'
    ? (e.costCenter ? `金额由成本中心统一算（${centers.value.find((c) => c.code === e.costCenter)?.settleRule ?? '按中心分法'}）` : '金额由成本中心的分法统一算')
    : `按「${formulaPreview.value || '未设置公式'}」计算`
  const tail = e.settleType === '间接'
    ? `归集到成本中心【${centerName(e.costCenter) || '未选成本中心'}】，月末按中心的分法分配。`
    : '随单实时算，计入本订单直接成本。'
  return e.category === '资源驱动'
    ? `从【${archiveName(e.sourceArchive) || '未选档案'}】取数（填报时按订单的产品类型自动过滤可选资源），${calc}，${tail}`
    : `${e.settleType === '间接' ? '共用费用，先归集后分配' : '核算时人工填报'}，${calc}，${tail}`
})

function matName(key: string) {
  return materialDefs.value.find((m) => m.matKey === key)?.name ?? key
}

function archiveName(key?: string) {
  if (!key) return ''
  return ARCHIVE_OPTS.find((a) => a.key === key)?.name ?? key
}

function centerName(code?: string) {
  if (!code) return ''
  return centers.value.find((c) => c.code === code)?.name ?? code
}

function detailRows(it: ItemX): [string, string][] {
  return [
    ['编码', it.itemKey],
    ['条目类别', it.category ?? '手工录入'],
    ['算账去向', it.settleType ?? '直接'],
    ['费用类型', it.costType ?? '—'],
    ['填报要求', it.requiredFlag === '否' ? '按需选配（默认不带出）' : '默认填报（随模板带出，可删可补回）'],
    ['可增补类别', it.cats?.length ? it.cats.join('、') : '—（仅按组成推导带出）'],
    ['计算方式', it.calcKind ?? '—'],
    ['算式', it.formula || '—'],
    ['取数来源', it.category === '资源驱动' ? archiveName(it.sourceArchive) : '—（人工填数）'],
    ['适用资源', it.settleType !== '间接' ? (it.appliesTo ? matName(it.appliesTo) : '—') : '—（间接费用不从组成推导）'],
    ['归集成本中心', it.settleType === '间接' ? (centerName(it.costCenter) || '未选') : '—（直接成本随单算）'],
    ['填报部门', it.dept === '支撑部' ? '业务支撑部' : (it.dept || '—')],
    ['单位 / 科目', `${it.unit ?? '—'} / ${it.subject ?? '—'}`],
    ['备注', it.remark || '—'],
    ['被装配', it.refCount ? `${it.refCount} 个产品类型` : '未被装配'],
    ['状态', it.status],
  ]
}

async function load() {
  rows.value = (await costItemList()) as ItemX[]
}

async function loadRates() {
  rates.value = await http.get<Rate[]>('/price-dicts', { dictKey: 'engineer_rate' })
}

/** 状态机：草稿 → 生效（四要素齐全）→ 停用（未被装配） */
async function toActive(it: ItemX) {
  const miss = missingOf(it)
  if (miss.length) {
    Message.warning(`四要素未齐全，无法生效：缺少 ${miss.join('、')}`)
    return
  }
  await http.put(`/cost-items/${it.id}`, { ...it, status: '生效' })
  Message.success(`「${it.name}」已生效`)
  load()
}

async function toDisable(it: ItemX) {
  if ((it.refCount ?? 0) > 0) {
    Message.warning(`该条目正被 ${it.refCount} 个产品类型装配/引用，请先解除装配关系再停用`)
    return
  }
  await http.put(`/cost-items/${it.id}`, { ...it, status: '停用' })
  Message.success(`「${it.name}」已停用`)
  load()
}

function pickMethod(key: string) {
  if (!editing.value || locked.value) return
  editing.value.calcMethod = key
  if (key === 'QTY_PRICE' && !editing.value.params.priceSource) editing.value.params.priceSource = 'equipment'
  if (key === 'BGP_UTIL' && !editing.value.params.targetUtil) editing.value.params.targetUtil = '0.8'
  trialVals.value = {}
  trialResult.value = null
}

function onCategoryChange() {
  const e = editing.value
  if (!e) return
  if (e.category === '手工录入') {
    e.sourceArchive = ''
  } else {
    e.appliesTo = SOURCE_TO_MAT[e.sourceArchive] ?? ''
  }
}

function onArchiveChange() {
  const e = editing.value
  if (!e) return
  e.appliesTo = SOURCE_TO_MAT[e.sourceArchive] ?? ''
}

function toggleCat(c: string) {
  const e = editing.value
  if (!e) return
  const i = e.cats.indexOf(c)
  if (i >= 0) {
    e.cats.splice(i, 1)
  } else {
    e.cats.push(c)
  }
}

function parseParams(json?: string): CalcParams {
  const out = emptyParams()
  if (!json) return out
  try {
    const raw = JSON.parse(json) as Record<string, unknown>
    for (const k of Object.keys(out)) {
      if (raw[k] !== null && raw[k] !== undefined) {
        ;(out as unknown as Record<string, string>)[k] = String(raw[k])
      }
    }
  } catch {
    // 非法 JSON 按空参数处理
  }
  return out
}

function openEdit(it: ItemX | null) {
  trialResult.value = null
  trialVals.value = {}
  editing.value = it
    ? {
        id: it.id, itemKey: it.itemKey, name: it.name, dept: it.dept || '支撑部',
        costType: it.costType ?? '周期性', settleType: it.settleType ?? '直接',
        category: it.category ?? (it.sourceArchive ? '资源驱动' : '手工录入'),
        sourceArchive: it.sourceArchive ?? '',
        appliesTo: it.appliesTo ?? '', costCenter: it.costCenter ?? '',
        requiredFlag: it.requiredFlag ?? '按装配',
        unit: it.unit ?? '', subject: it.subject ?? '', remark: it.remark ?? '',
        calcMethod: it.calcMethod ?? '', params: parseParams(it.calcParams),
        status: it.status, cats: [...(it.cats ?? [])], refCount: it.refCount,
      }
    : {
        itemKey: '', name: '', dept: '支撑部', costType: '周期性', settleType: '直接',
        category: '资源驱动', sourceArchive: '', appliesTo: '', costCenter: '',
        requiredFlag: '按装配', unit: '', subject: '', remark: '',
        calcMethod: '', params: emptyParams(), status: '草稿', cats: [],
      }
}

/** 结构化参数：按方式裁剪有效键，数字转型（与服务端 validate 口径一致） */
function cleanParams(e: EditForm): Record<string, unknown> {
  const p = e.params
  const num = (v?: string) => (v === undefined || v === '' ? undefined : Number(v))
  switch (e.calcMethod) {
    case 'QTY_PRICE':
      return p.priceSource === 'param'
        ? { priceSource: 'param', unitPrice: num(p.unitPrice) }
        : { priceSource: p.priceSource || 'manual' }
    case 'POOL_SHARE':
      return p.poolCode ? { poolCode: p.poolCode } : {}
    case 'BGP_UTIL':
      return { ...(p.poolCode ? { poolCode: p.poolCode } : {}), targetUtil: num(p.targetUtil) ?? 0.8 }
    case 'MANDAY':
      return { rateRole: p.rateRole }
    case 'PER_OBJECT': {
      const out: Record<string, unknown> = {}
      if (num(p.monthlyAmount) !== undefined) out.monthlyAmount = num(p.monthlyAmount)
      if (num(p.objectCount) !== undefined) out.objectCount = num(p.objectCount)
      return out
    }
    case 'FIXED':
      return { amount: num(p.amount) }
    default:
      return {}
  }
}

async function runTrial() {
  const e = editing.value
  if (!e) return
  const inputs: Record<string, unknown> = {}
  for (const f of trialFields.value) {
    const v = trialVals.value[f.key]
    if (v === undefined || v === '') {
      Message.warning(`试算请先填「${f.label}」`)
      return
    }
    inputs[f.key] = f.kind === 'number' ? Number(v) : v
  }
  trialLoading.value = true
  try {
    trialResult.value = await http.post<{ amount: number | null; calcText: string }>('/cost-items/trial', {
      calcMethod: e.calcMethod,
      calcParams: cleanParams(e),
      inputs,
    })
  } catch {
    trialResult.value = null
  } finally {
    trialLoading.value = false
  }
}

async function doSave() {
  const e = editing.value
  if (!e) return
  const body: Record<string, unknown> = {
    name: e.name, dept: e.dept, costType: e.costType, settleType: e.settleType,
    category: e.category, requiredFlag: e.requiredFlag, cats: e.cats,
    unit: e.unit || undefined, subject: e.subject || undefined, remark: e.remark || undefined,
    status: e.status,
  }
  if (e.category === '资源驱动') {
    body.sourceArchive = e.sourceArchive || undefined
  }
  if (e.settleType === '间接') {
    body.costCenter = e.costCenter || undefined
  } else {
    body.appliesTo = e.appliesTo || undefined
    if (e.calcMethod) {
      body.calcMethod = e.calcMethod
      body.calcParams = JSON.stringify(cleanParams(e))
    }
  }
  if (e.id) {
    body.itemKey = e.itemKey
    await http.put(`/cost-items/${e.id}`, body)
    Message.success('条目已保存（全程留痕）')
  } else {
    await http.post('/cost-items', body)
    Message.success('草稿已保存，四要素齐全后可在列表置为生效')
  }
  editing.value = null
  load()
}

function openRate(r: Rate | null) {
  rateEditing.value = r
    ? { id: r.id, role: r.role, rateText: String(r.rate), effectAt: r.effectAt ?? '', status: r.status, remark: r.remark ?? '' }
    : { role: '', rateText: '', effectAt: new Date().toISOString().slice(0, 10), status: '启用', remark: '' }
}

async function saveRate() {
  const r = rateEditing.value
  if (!r) return
  const body = { dictKey: 'engineer_rate', role: r.role, rate: Number(r.rateText), effectAt: r.effectAt || undefined, status: r.status, remark: r.remark || undefined }
  if (r.id) {
    await http.put(`/price-dicts/${r.id}`, body)
  } else {
    await http.post('/price-dicts', body)
  }
  Message.success('费率已保存')
  rateEditing.value = null
  loadRates()
}

onMounted(async () => {
  await load()
  loadRates()
  materialDefs.value = await materialList()
  centers.value = await http.get<Center[]>('/cost-centers')
  pools.value = await http.get<Pool[]>('/archives/pools')
  equipment.value = await http.get<Equipment[]>('/archives/equipment')
  const cats = await http.get<{ name: string }[]>('/product-categories')
  categoryOpts.value = cats.map((c) => c.name)
})
</script>
