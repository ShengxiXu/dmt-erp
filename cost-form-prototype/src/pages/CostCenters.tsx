// 成本中心 · 独立主数据：间接费用的归集与分配单元
// 两步法（管理会计标准）：间接费用按「归属成本中心」归集（月费用来自供应商账单 / 摊销）
//   → 月末按「分配动因」算分配率切分到各订单；月结重算留痕，差异留中心滚动、不追溯订单。
// 与直接成本的分工：直接成本挂资源清单的资源随单实时算，不进成本中心。
// 注：财务月结（含出口池月结、中心月结重算）属于财务模块（未正式启动），入口暂不上本页；
// poolSettle / settleRun 数据层全部保留，立项后恢复。
import { useState } from "react";
import { Link } from "react-router";
import { useCenters, getCenters, saveCenter, addCenter, updateCenter, DRIVER_PRESETS, DRIVER_SENTENCE, type CostCenter } from "@/data/costCenters";
import { useBills, latestBillPeriod, centerPeriodTotal } from "@/data/bills";
import { getCostItems, useCostItems } from "@/data/costItems";
import { getCats, COST_ITEM_NAME } from "@/data/products";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** 被产品类型引用的成本中心："cat / type" 列表（资源清单勾选中心、或装配了中心归集的条目） */
function centerRefs(id: string): string[] {
  const keys = getCenters().find((c) => c.id === id)?.itemKeys ?? [];
  const out = new Set<string>();
  for (const c of getCats())
    for (const t of c.types)
      if (t.centers?.includes(id) || t.costItems.some((k) => keys.includes(k))) out.add(`${c.name} / ${t.name}`);
  return [...out];
}

// ---------- 成本中心编辑表单 ----------
function CenterForm({ initial, onClose }: { initial?: CostCenter; onClose: () => void }) {
  const [f, setF] = useState<Partial<CostCenter>>(() => ({ name: "", driver: "", formula: "", itemKeys: [], ...initial }));
  const indirectItems = getCostItems().filter((i) => i.settleType === "间接");
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const preset = DRIVER_PRESETS.find((p) => p.key === f.driverKey);
  const refs = initial ? centerRefs(initial.id) : [];

  const save = () => {
    if (!f.name?.trim()) return alert("请填写成本中心名称");
    if (!f.driver?.trim()) return alert("请选择这个中心的费用怎么分出去");
    const formula = preset ? preset.gen(f.name.trim()) : f.formula?.trim();
    if (!formula) return alert("请填写算式（中心当月费用怎么乘除本单的什么）");
    const patch = { name: f.name!, driverKey: f.driverKey || undefined, driver: f.driver!, formula, itemKeys: f.itemKeys ?? [] };
    if (initial) saveCenter({ ...initial, ...patch });
    else addCenter(patch);
    onClose();
  };
  const toggleStatus = () => {
    if (!initial) return;
    if (initial.status !== "停用" && refs.length) {
      if (!window.confirm(`该成本中心正被 ${refs.length} 个产品使用，停用后新的核算单不再分配这里的费用（历史已分配不受影响）。确定停用？`)) return;
    }
    updateCenter(initial.id, { status: initial.status === "停用" ? "启用" : "停用" });
    onClose();
  };

  return (
    <CenterModal title={initial ? `编辑成本中心 · ${initial.name}` : "新建成本中心"} sub="间接费用在这里归集，月末按动因分配到订单" onClose={onClose} width={520}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">中心编号</div>
            <Input value={initial?.id ?? "（保存后自动生成 CC-xx）"} disabled />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">中心名称 <span className="text-[#F53F3F]">*</span></div>
            <Input autoFocus placeholder="如：出口调度平台" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">归集的间接费用条目（成本条目库中算账去向 = 间接的条目）<span className="text-[#F53F3F]"> *</span></div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-[2px] border border-[#E5E6EB] p-2">
            {indirectItems.map((i) => {
              const on = (f.itemKeys ?? []).includes(i.key);
              const inOther = initial?.id
                ? getCenters().find((c) => c.id !== initial.id && c.itemKeys.includes(i.key))
                : getCenters().find((c) => c.itemKeys.includes(i.key));
              return (
                <label key={i.key} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 hover:bg-[#F7F8FA]" title={i.formula}>
                  <input type="checkbox" className="accent-[#165DFF]" checked={on} disabled={!!inOther && !on}
                    onChange={(e) => set("itemKeys", e.target.checked ? [...(f.itemKeys ?? []), i.key] : (f.itemKeys ?? []).filter((k) => k !== i.key))} />
                  <span className="text-[#1D2129]">{i.name}</span>
                  {inOther && <span className="ml-auto shrink-0 text-[10px] text-[#C9CDD4]">已归集到「{inOther.name}」</span>}
                </label>
              );
            })}
            {!indirectItems.length && <div className="px-1 py-2 text-[11px] text-[#C9CDD4]">成本条目库还没有间接费用条目，请先到 <Link className="text-[#165DFF] hover:underline" to="/cost-items">成本条目库</Link> 新建</div>}
          </div>
          <div className="mt-1 text-[10px] text-[#C9CDD4]">一笔间接费用只归集到一个成本中心（同制造业：制造费用科目挂成本中心）。</div>
        </div>
        <div>
          <div className="mb-1 text-[#4E5969]">这个中心的费用怎么分出去？选一种分法 <span className="text-[#F53F3F]">*</span></div>
          <div className="space-y-1.5">
            {DRIVER_PRESETS.map((p) => (
              <label key={p.key}
                className={`flex cursor-pointer items-start gap-2 rounded-[2px] border px-2.5 py-1.5 ${f.driverKey === p.key ? "border-[#165DFF] bg-[#F7FBFF]" : "border-[#E5E6EB] hover:bg-[#F7F8FA]"}`}>
                <input type="radio" name="driverKey" className="mt-1 accent-[#165DFF]"
                  checked={f.driverKey === p.key}
                  onChange={() => setF((x) => ({ ...x, driverKey: p.key, driver: p.name, formula: p.gen(x.name || "本中心") }))} />
                <span className="leading-5">
                  <span className="font-medium text-[#1D2129]">{p.name}</span>
                  <span className="ml-2 text-[#86909C]">{p.desc}</span>
                </span>
              </label>
            ))}
            <label className={`flex cursor-pointer items-center gap-2 rounded-[2px] border px-2.5 py-1.5 ${!f.driverKey ? "border-[#165DFF] bg-[#F7FBFF]" : "border-[#E5E6EB] hover:bg-[#F7F8FA]"}`}>
              <input type="radio" name="driverKey" className="accent-[#165DFF]" checked={!f.driverKey}
                onChange={() => set("driverKey", "")} />
              <span className="text-[#1D2129]">以上都不是，我自己写</span>
            </label>
          </div>
        </div>
        {f.driverKey ? (
          <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] leading-5 text-[#86909C]">
            算式（按所选分法自动生成，不用手填）：<span className="font-medium text-[#1D2129]">{preset?.gen(f.name || "本中心")}</span>
            <div className="mt-0.5">算个例子看看：{preset?.example}</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <div className="mb-0.5 text-[#4E5969]">分法名称 <span className="text-[#F53F3F]">*</span></div>
              <Input placeholder="如：按机柜数分" value={f.driver ?? ""} onChange={(e) => set("driver", e.target.value)} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">算式（用大白话写：中心当月费用 怎么乘除 本单的什么）<span className="text-[#F53F3F]"> *</span></div>
              <Input placeholder="如：中心当月费用 × 本单机柜数 ÷ 总机柜数" value={f.formula ?? ""} onChange={(e) => set("formula", e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          {initial && (
            <button className="text-[11px] text-[#F53F3F] hover:underline" onClick={toggleStatus}>
              {initial.status === "停用" ? "重新启用" : "停用该中心"}
            </button>
          )}
          <span className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={save}>保存中心</Button>
          </span>
        </div>
      </div>
    </CenterModal>
  );
}

export default function CostCenters() {
  useCenters();
  useBills(); // 账单入账/月结后「当月归集」金额实时刷新
  useCostItems();
  const [form, setForm] = useState<{ open: boolean; initial?: CostCenter }>({ open: false });
  const [kw, setKw] = useState("");
  const period = latestBillPeriod();
  const shown = getCenters().filter((c) => !kw || c.id.includes(kw) || c.name.includes(kw) || c.driver.includes(kw));

  return (
    <ArcoShell breadcrumb="成本中心">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div>
            <span className="text-sm font-semibold text-[#1D2129]">成本中心</span>
            <span className="ml-2 text-[11px] text-[#86909C]">间接费用的归集与分配单元：不归属单个订单的账（平台研发运维、维保、监控、SLA 冗余等）先归集到中心，月末按所选分法切分到各订单。直接成本挂资源清单的资源随单算，不进中心</span>
          </div>
          <div className="flex items-center gap-2">
            <Input className="w-52" placeholder="搜索编号 / 名称 / 分法" value={kw} onChange={(e) => setKw(e.target.value)} />
            <Button size="sm" onClick={() => setForm({ open: true })}>＋ 新建成本中心</Button>
          </div>
        </div>

        {/* 中心台账：行业标准列表视图——一行为一个中心，状态与归集关系一目了然 */}
        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">中心编号</th><th className="px-3 py-2">中心名称</th>
                <th className="px-3 py-2">归集条目</th><th className="px-3 py-2">分配动因（分法）</th>
                <th className="px-3 py-2 text-right">当月归集（{period}）</th>
                <th className="px-3 py-2 text-right">在用产品</th>
                <th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const disabled = c.status === "停用";
                const refs = centerRefs(c.id);
                const items = c.itemKeys.map((k) => getCostItems().find((i) => i.key === k)).filter(Boolean);
                return (
                  <tr key={c.id} className={`border-b align-top last:border-0 ${disabled ? "opacity-55" : ""}`}>
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{c.id}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1D2129]">{c.name}</td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      {items.length ? (
                        <div className="flex flex-wrap gap-1">
                          {items.map((i) => (
                            <span key={i!.key} className="rounded-[2px] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] text-[#4E5969]" title="金额由本中心按分法统一算">
                              {COST_ITEM_NAME(i!.key)}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-[#FF7D00]">未归集条目</span>}
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5">
                      <span className="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]" title={DRIVER_SENTENCE(c)}>{c.driver}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {(() => {
                        const { total, count } = centerPeriodTotal(c.id, period);
                        return total > 0 ? (
                          <Link to="/bills" className="font-mono text-[#1D2129] hover:text-[#165DFF]" title="来自供应商账单（已入账），点击前往账单页">
                            ¥ {total.toLocaleString("zh-CN")}<span className="ml-1 text-[10px] text-[#86909C]">{count} 张</span>
                          </Link>
                        ) : <span className="text-[#C9CDD4]">—</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#4E5969]" title={refs.join("\n")}>{refs.length || "—"}</td>
                    <td className="px-3 py-2.5">
                      {disabled
                        ? <span className="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">已停用</span>
                        : <span className="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">启用</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button className="text-[#165DFF] hover:underline" onClick={() => setForm({ open: true, initial: c })}>编辑</button>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">{kw ? "无匹配成本中心" : "暂无成本中心，点右上角「新建成本中心」创建"}</td></tr>}
            </tbody>
          </table>
          <div className="border-t border-dashed border-[#F2F3F5] px-4 py-2 text-[10px] leading-4 text-[#C9CDD4]">
            计价路径：核算按中心月费用<span className="text-[#86909C]">预估切分</span>（报价 / 审批依据）；真实账单入账后自动归集为「当月归集」水位，月结按同一动因重算、差异留中心滚动（
            <Link className="text-[#165DFF] hover:underline" to="/finance/settle">月结</Link>）。
          </div>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 成本中心只装<strong className="text-[#4E5969]">间接费用</strong>（分不清算哪单的共用账：平台运维、维保、监控等）；直接成本随单实时算，不进中心；
          ② 产品在「资源清单」勾选用到的中心，中心归集的条目即进核算单；③ 每笔记多少由中心的分法统一算，条目口径在
          <Link className="text-[#165DFF] hover:underline" to="/cost-items">成本条目库</Link> 维护。
        </div>
      </main>

      {form.open && <CenterForm initial={form.initial} onClose={() => setForm({ open: false })} />}
    </ArcoShell>
  );
}
