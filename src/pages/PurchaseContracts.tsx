// 采购合同 · 一等主数据（/purchase/contracts）
// 采购侧价格事实的唯一出处：R1 出口 / R2 基础线路选合同带出商务参数；采购单（P08）挂合同带出采购单价；
// 供应商账单按口径关联（周期性 → 合同，一次性 → 采购单）。
// 两级模型：采购合同（约定）→ 采购订单（合同下按单执行，见采购管理 /purchase/orders）。
import { useState } from "react";
import { Link } from "react-router";
import { usePurchase, getContracts, saveContract, removeContract, setContractAttachments, type PurchaseContract, type PurchaseBilling } from "@/data/purchase";
import { ENTITIES, ENTITY_NAME } from "@/data/entities";
import { usePurchaseFlow, POS_OF_CONTRACT, poTotal } from "@/data/purchaseFlow";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PO_STATUS_CLS: Record<string, string> = {
  草稿: "bg-[#F2F3F5] text-[#4E5969]", 待审批: "bg-[#FFF3E8] text-[#FF7D00]", 已下单: "bg-[#E8F3FF] text-[#165DFF]",
  部分到货: "bg-[#FEF0FF] text-[#722ED1]", 验收完成: "bg-[#E8F8F2] text-[#00B42A]",
};

// 合同详情：名下采购单（按单计价类合同的执行全貌）+ 附件
function ContractDetailModal({ contract, onClose }: { contract: PurchaseContract; onClose: () => void }) {
  usePurchaseFlow();
  const pos = POS_OF_CONTRACT(contract.id);
  const totalExec = pos.reduce((s, p) => s + poTotal(p), 0);
  return (
    <CenterModal title={`采购合同 · ${contract.id}`} sub={`${contract.name}｜${contract.supplier}`} width={640} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-3 gap-2 rounded-[2px] bg-[#F7F8FA] p-2.5 text-[#4E5969]">
          <span>标的：{contract.subject || "—"}</span>
          <span>计费：{contract.billing}</span>
          <span>条款:{termSummary(contract)}</span>
          <span>生效：{contract.effect}</span>
          <span>到期：{contract.end ?? "—"}</span>
          <span>状态:{contract.status ?? "履行中"}</span>
        </div>
        <div>
          <div className="mb-1 font-semibold text-[#1D2129]">名下采购单（{pos.length} 张{pos.length ? ` · 累计未税 ¥ ${totalExec.toLocaleString("zh-CN")}` : ""}）</div>
          {pos.length ? (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-2 py-1.5">采购单号</th><th className="px-2 py-1.5">明细</th><th className="px-2 py-1.5">未税总额</th><th className="px-2 py-1.5">状态</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.poNo} className="border-b last:border-0">
                    <td className="px-2 py-1.5"><Link to={`/purchase/orders/${p.poNo}`} className="font-mono text-[#165DFF] hover:underline" onClick={onClose}>{p.poNo}</Link></td>
                    <td className="max-w-[220px] truncate px-2 py-1.5" title={p.lines.map((l) => `${l.spec} × ${l.quantity}`).join("；")}>{p.lines.map((l) => `${l.spec} × ${l.quantity}`).join("；")}</td>
                    <td className="px-2 py-1.5">¥ {poTotal(p).toLocaleString("zh-CN")}</td>
                    <td className="px-2 py-1.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${PO_STATUS_CLS[p.status] ?? "bg-[#F2F3F5] text-[#4E5969]"}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-[2px] border border-dashed border-[#E5E6EB] p-3 text-center text-[#C9CDD4]">
              暂无关联采购单{contract.billing === "按单计价" ? "（设备类采购在「转采购单」时挂本合同）" : "（周期性月租类合同由 R1/R2 档案与供应商账单直接引用）"}
            </div>
          )}
        </div>
        <div>
          <div className="mb-1 font-semibold text-[#1D2129]">附件</div>
          <div className="flex flex-wrap items-center gap-2">
            {(contract.attachments ?? []).map((f) => (
              <span key={f} className="flex items-center gap-1 rounded-[2px] bg-[#F7F8FA] px-2 py-0.5 text-[11px] text-[#1D2129]">
                📎 {f}
                <button className="text-[#86909C] hover:text-[#F53F3F]" title="删除附件"
                  onClick={() => setContractAttachments(contract.id, (contract.attachments ?? []).filter((x) => x !== f))}>×</button>
              </span>
            ))}
            <button onClick={() => setContractAttachments(contract.id, [...(contract.attachments ?? []), `${contract.id}-附件${(contract.attachments ?? []).length + 1}.pdf`])}
              className="rounded-[2px] border border-dashed border-[#C9CDD4] px-2 py-0.5 text-[11px] text-[#86909C] hover:border-[#165DFF] hover:text-[#165DFF]">
              ＋ 上传附件（mock）
            </button>
          </div>
        </div>
      </div>
    </CenterModal>
  );
}

const BILLING_LABEL: Record<PurchaseBilling, string> = { 周期性月租: "周期性月租", 按单计价: "按单计价" };
const STATUS_CLS: Record<NonNullable<PurchaseContract["status"]>, string> = {
  履行中: "bg-[#E8F8F2] text-[#00B42A]",
  已到期: "bg-[#FFF3E8] text-[#FF7D00]",
  已终止: "bg-[#FFECE8] text-[#F53F3F]",
};

/** 计价条款摘要：按计费方式显示对应参数 */
const termSummary = (c: PurchaseContract): string => {
  if (c.billing === "周期性月租" && c.capacityM != null) return `容量 ${c.capacityM}M · 月租 ${c.monthlyCost?.toLocaleString("zh-CN")} 元/月`;
  if (c.billing === "周期性月租" && c.bwM != null) return `带宽 ${c.bwM}M · 整线月租 ${c.linePrice?.toLocaleString("zh-CN")} 元/月`;
  if (c.billing === "按单计价") return `采购单价 ${c.unitPrice?.toLocaleString("zh-CN") ?? "—"} 元（按单带出）`;
  return "—";
};

function ContractForm({ initial, onClose }: { initial?: PurchaseContract; onClose: () => void }) {
  const [f, setF] = useState<PurchaseContract>(() => ({
    id: "", name: "", supplier: "", subject: "", billing: "周期性月租", buyerId: "ENT-HQ",
    effect: "", status: "履行中", ...initial,
  }));
  const set = (k: keyof PurchaseContract, v: string) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? undefined : Number(v));

  const save = () => {
    if (!f.id.trim()) return alert("请填写合同号（如 CT-2026-xxx）");
    if (!f.name.trim() || !f.supplier.trim()) return alert("请填写合同名称与供应商");
    if (f.billing === "周期性月租" && f.capacityM == null && f.bwM == null) return alert("周期性月租类合同请填容量或带宽参数");
    if (f.billing === "按单计价" && f.unitPrice == null) return alert("按单计价类合同请填采购单价");
    saveContract({ ...f, id: f.id.trim() });
    onClose();
  };

  return (
    <CenterModal title={initial ? `编辑采购合同 · ${initial.id}` : "新建采购合同"} sub="采购侧价格事实的唯一出处：资源档案与采购单选合同后自动带出商务参数" width={560} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">合同号 <span className="text-[#F53F3F]">*</span></div>
            <Input autoFocus={!initial} disabled={!!initial} placeholder="如 CT-2026-018" value={f.id} onChange={(e) => set("id", e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">供应商 <span className="text-[#F53F3F]">*</span></div>
            <Input placeholder="如 上海电信" value={f.supplier} onChange={(e) => set("supplier", e.target.value)} />
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">合同名称 <span className="text-[#F53F3F]">*</span></div>
          <Input placeholder="如 电信 BGP 出口采购合同（1G）" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">采购主体（我方哪个分子公司签）<span className="text-[#F53F3F]">*</span></div>
          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.buyerId ?? "ENT-HQ"} onChange={(e) => set("buyerId", e.target.value)}>
            {ENTITIES.filter((e) => e.status === "启用").map((e) => <option key={e.id} value={e.id}>{e.shortName} · {e.fullName}</option>)}
          </select>
          <div className="mt-0.5 text-[10px] text-[#C9CDD4]">抬头与用印按采购主体区分（主体与印章页维护）</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">标的类别</div>
            <Input list="pc-subjects" placeholder="如：出口带宽 / 基础线路 / OTN 波道 / 设备框架" value={f.subject} onChange={(e) => set("subject", e.target.value)} />
            <datalist id="pc-subjects">
              {["出口带宽", "基础线路", "OTN 波道", "设备框架"].map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">计费方式 <span className="text-[#F53F3F]">*</span></div>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(Object.keys(BILLING_LABEL) as PurchaseBilling[]).map((b) => (
                <button key={b} type="button" onClick={() => setF((x) => ({ ...x, billing: b }))}
                  className={`flex-1 rounded-[2px] px-2 py-1.5 ${f.billing === b ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{BILLING_LABEL[b]}</button>
              ))}
            </div>
          </div>
        </div>
        {f.billing === "周期性月租" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-0.5 text-[#4E5969]">出口池容量（M，可空）</div>
              <Input type="number" placeholder="池化出口填容量" value={f.capacityM ?? ""} onChange={(e) => setF((x) => ({ ...x, capacityM: num(e.target.value), bwM: e.target.value ? undefined : x.bwM }))} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">月租（元/月）</div>
              <Input type="number" value={f.monthlyCost ?? ""} onChange={(e) => setF((x) => ({ ...x, monthlyCost: num(e.target.value) }))} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">整线带宽（M，可空）</div>
              <Input type="number" placeholder="基础线路 / 波道填带宽" value={f.bwM ?? ""} onChange={(e) => setF((x) => ({ ...x, bwM: num(e.target.value), capacityM: e.target.value ? undefined : x.capacityM }))} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">整线月租（元/月）</div>
              <Input type="number" value={f.linePrice ?? ""} onChange={(e) => setF((x) => ({ ...x, linePrice: num(e.target.value) }))} />
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-0.5 text-[#4E5969]">采购单价（元）<span className="text-[#F53F3F]"> *</span></div>
            <Input type="number" placeholder="合同框架单价，采购单选合同后自动带出" value={f.unitPrice ?? ""} onChange={(e) => setF((x) => ({ ...x, unitPrice: num(e.target.value) }))} />
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">生效日期</div>
            <Input type="date" value={f.effect} onChange={(e) => set("effect", e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">到期日期（可空）</div>
            <Input type="date" value={f.end ?? ""} onChange={(e) => set("end", e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">状态</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.status ?? "履行中"} onChange={(e) => set("status", e.target.value as NonNullable<PurchaseContract["status"]>)}>
              <option>履行中</option><option>已到期</option><option>已终止</option>
            </select>
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">备注（可空）</div>
          <Input placeholder="计价条款说明、框架范围等" value={f.remark ?? ""} onChange={(e) => set("remark", e.target.value)} />
        </div>
        <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          {initial && (
            <button className="text-[11px] text-[#F53F3F] hover:underline" onClick={() => {
              if (!confirm(`删除采购合同「${initial.id}」？已被 R1/R2 档案或采购单引用的编号将显示为未知，建议改为「已终止」留档。确定删除？`)) return;
              removeContract(initial.id);
              onClose();
            }}>删除</button>
          )}
          <span className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={save}>保存合同</Button>
          </span>
        </div>
      </div>
    </CenterModal>
  );
}

export default function PurchaseContracts() {
  usePurchase();
  const [kw, setKw] = useState("");
  const [billing, setBilling] = useState<"全部" | PurchaseBilling>("全部");
  const [form, setForm] = useState<{ open: boolean; initial?: PurchaseContract }>({ open: false });
  const [detailId, setDetailId] = useState<string | null>(null);
  const shown = getContracts().filter((c) =>
    (billing === "全部" || c.billing === billing) &&
    (!kw || c.id.includes(kw) || c.name.includes(kw) || c.supplier.includes(kw) || c.subject.includes(kw)));

  return (
    <ArcoShell breadcrumb="采购合同">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">采购合同</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["全部", "周期性月租", "按单计价"] as const).map((b) => (
                <button key={b} onClick={() => setBilling(b)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${billing === b ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{b}</button>
              ))}
            </div>
            <Input className="w-56" placeholder="搜索合同号 / 名称 / 供应商 / 标的" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => setForm({ open: true })}>＋ 新建采购合同</Button>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">合同号</th><th className="px-3 py-2">合同名称</th><th className="px-3 py-2">供应商</th>
                <th className="px-3 py-2">标的 / 计费</th><th className="px-3 py-2">计价条款</th><th className="px-3 py-2">采购主体</th>
                <th className="px-3 py-2">生效 ~ 到期</th><th className="px-3 py-2">名下采购单</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const pos = POS_OF_CONTRACT(c.id);
                return (
                <tr key={c.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => setDetailId(c.id)}>
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{c.id}
                    {(c.attachments?.length ?? 0) > 0 && <span className="ml-1 text-[10px] text-[#86909C]" title="附件">📎{c.attachments!.length}</span>}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2.5 font-medium text-[#1D2129]" title={c.name}>{c.name}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{c.supplier}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-[2px] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{c.subject || "—"}</span>
                    <span className={`ml-1 rounded-[2px] px-1.5 py-0.5 text-[10px] ${c.billing === "周期性月租" ? "bg-[#E8F3FF] text-[#165DFF]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>{c.billing}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{termSummary(c)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{ENTITY_NAME(c.buyerId)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{c.effect}{c.end ? ` ~ ${c.end}` : " ~"}</td>
                  <td className="px-3 py-2.5">
                    {c.billing === "按单计价" ? (
                      pos.length ? <span className="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{pos.length} 张 · ¥ {pos.reduce((s, p) => s + poTotal(p), 0).toLocaleString("zh-CN")}</span> : <span className="text-[10px] text-[#C9CDD4]">无</span>
                    ) : <span className="text-[10px] text-[#86909C]" title="周期性类由 R1/R2 档案与供应商账单直接引用">R1/R2 引用</span>}
                  </td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[c.status ?? "履行中"]}`}>{c.status ?? "履行中"}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="text-[#165DFF] hover:underline" onClick={(e) => { e.stopPropagation(); setForm({ open: true, initial: c }); }}>编辑</button>
                  </td>
                </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#C9CDD4]">{kw || billing !== "全部" ? "无匹配合同" : "暂无采购合同，点右上角「新建采购合同」创建"}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 采购合同是采购侧<strong className="text-[#4E5969]">价格事实的唯一出处</strong>：R1 出口 / R2 基础线路档案、采购单选合同后自动带出商务参数（可修改留痕）；
          ② 点行看合同详情：<strong className="text-[#4E5969]">名下采购单</strong>（按单计价类）/ R1·R2 引用情况（周期性类）与合同附件；
          ③ 供应商账单按口径关联：周期性费用挂合同、一次性费用挂采购单；④ 采购订单（PO）在<Link className="text-[#165DFF] hover:underline" to="/purchase/orders">采购管理</Link>维护，是合同下的按单执行。
        </div>
      </main>

      {form.open && <ContractForm initial={form.initial} onClose={() => setForm({ open: false })} />}
      {detailId && (() => { const c = getContracts().find((x) => x.id === detailId); return c ? <ContractDetailModal contract={c} onClose={() => setDetailId(null)} /> : null; })()}
    </ArcoShell>
  );
}
