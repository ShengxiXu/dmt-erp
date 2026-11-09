// 商机管理（/opportunity）：全部商机的统一入口与维护页
// 链路：客户 → 商机 → 特批 → 合同；特批申请必须挂在具体商机上
// 支持 /opportunity?customer=CU-xxx 从客户档案带过滤进入
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useOpps, getOpps, addOpp, updateOpp, CUSTOMERS, OPP_STAGES, OPP_SOURCES, type Opportunity, type OppProduct, type OppStage } from "@/data/customers";
import { CONTRACTS } from "@/data/contracts";
import { useCatalog, CATS, PTYPES } from "@/data/products";
import { DEMO_TODAY } from "@/data/settings";
import { bomMonthlyCost } from "@/data/bomEstimate";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import CustomerSelect from "@/components/CustomerSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STAGE_CLS: Record<OppStage, string> = {
  跟进中: "bg-[#FFF3E8] text-[#FF7D00]",
  已报价: "bg-[#E8F3FF] text-[#165DFF]",
  赢单: "bg-[#E8F8F2] text-[#00B42A]",
  输单: "bg-[#F2F3F5] text-[#86909C]",
};

const CUSTOMER_NAME = (id: string) => CUSTOMERS.find((c) => c.id === id)?.name ?? id;
const fmt = (n: number) => n.toLocaleString("zh-CN");

/** 商机新建 / 编辑表单：意向产品来自产品定义（类别 → 类型两级选择，可关联多个，不可自由输入） */
function OppForm({ initial, presetCustomer, onClose }: { initial?: Opportunity | null; presetCustomer?: string | null; onClose: () => void }) {
  useCatalog();
  const [customerName, setCustomerName] = useState(initial ? CUSTOMER_NAME(initial.customerId) : presetCustomer ? CUSTOMER_NAME(presetCustomer) : "");
  const [products, setProducts] = useState<OppProduct[]>(initial?.products?.length ? initial.products.map((p) => ({ ...p })) : [{ cat: CATS()[0] ?? "", ptype: "" }]);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    expectAmount: initial ? String(initial.expectAmount) : "",
    expectMonths: initial?.expectMonths ? String(initial.expectMonths) : "",
    expectedCloseAt: initial?.expectedCloseAt ?? "",
    stage: initial?.stage ?? "跟进中" as OppStage,
    source: initial?.source ?? OPP_SOURCES[0],
    sales: initial?.sales ?? CUSTOMERS.find((c) => c.name === (presetCustomer ? CUSTOMER_NAME(presetCustomer) : ""))?.sales ?? "张弛",
    remark: initial?.remark ?? "",
  });
  const customer = CUSTOMERS.find((c) => c.name === customerName);
  /** 意向可选全部类型（含停用，仅作意向参考）；类别切换后类型自动校正到该类别第一个 */
  const effProducts = products.map((p) => {
    const types = PTYPES(p.cat, true);
    return { cat: p.cat, ptype: types.includes(p.ptype) ? p.ptype : (types[0] ?? "") };
  });
  const patchProduct = (i: number, patch: Partial<OppProduct>) =>
    setProducts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const save = () => {
    if (!customer) return alert("请选择归属客户");
    if (!form.name.trim()) return alert("请填写商机名称");
    if (!effProducts.length || effProducts.some((p) => !p.ptype)) return alert("请至少选择一个意向产品类型");
    const dup = effProducts.some((p, i) => effProducts.findIndex((q) => q.cat === p.cat && q.ptype === p.ptype) !== i);
    if (dup) return alert("意向产品存在重复（同类别同类型），请去重");
    const months = Number(form.expectMonths) || 0;
    if (form.expectAmount && months <= 0) return alert("请填写预计合同期（月），用于推算月均合同额");
    const patch = {
      customerId: customer.id, name: form.name.trim(), products: effProducts,
      expectAmount: Number(form.expectAmount) || 0, expectMonths: months || undefined, expectedCloseAt: form.expectedCloseAt || undefined,
      stage: form.stage, source: form.source, sales: form.sales, remark: form.remark || undefined,
    };
    if (initial) updateOpp(initial.id, patch);
    else addOpp(patch);
    onClose();
  };

  return (
    <CenterModal title={initial ? `编辑商机 · ${initial.id}` : "新建商机"} sub="意向产品来自产品定义（类别 → 类型两级选择），一个商机可关联多个产品" width={560} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <div className="mb-0.5 text-xs text-[#4E5969]">归属客户 <span className="text-[#F53F3F]">*</span></div>
          <CustomerSelect value={customerName} onChange={(n) => {
            const c = CUSTOMERS.find((x) => x.name === n);
            setCustomerName(n);
            if (c) setForm({ ...form, sales: c.sales });
          }} />
        </div>
        <div>
          <div className="mb-0.5 text-xs text-[#4E5969]">商机名称 <span className="text-[#F53F3F]">*</span></div>
          <Input autoFocus placeholder="如：二期算力扩容 · BGP 三网互通" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-xs text-[#4E5969]">意向产品 <span className="text-[#F53F3F]">*</span><span className="ml-1 text-[#86909C]">（可多个，赢单后由合同订单行承接）</span></div>
            <button onClick={() => setProducts((ps) => [...ps, { cat: CATS()[0] ?? "", ptype: "" }])}
              className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F7FAFF]">＋ 添加产品</button>
          </div>
          <div className="space-y-2">
            {effProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <select className="w-[42%] rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={p.cat}
                  onChange={(e) => patchProduct(i, { cat: e.target.value, ptype: "" })}>
                  {CATS().map((c) => <option key={c}>{c}</option>)}
                </select>
                <select className="flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={p.ptype}
                  onChange={(e) => patchProduct(i, { ptype: e.target.value })}>
                  {PTYPES(p.cat, true).map((t) => <option key={t}>{t}</option>)}
                </select>
                <button onClick={() => setProducts((ps) => ps.filter((_, j) => j !== i))} disabled={effProducts.length <= 1}
                  className="rounded-[2px] px-1.5 py-1 text-[#86909C] hover:text-[#F53F3F] disabled:opacity-30" title={effProducts.length <= 1 ? "至少保留一个意向产品" : "删除"}>✕</button>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">预计合同金额（元）</div>
            <Input type="number" placeholder="如 2112000" value={form.expectAmount} onChange={(e) => setForm({ ...form, expectAmount: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">预计合同期（月）<span className="text-[#F53F3F]"> *</span></div>
            <Input type="number" placeholder="如 24" value={form.expectMonths} onChange={(e) => setForm({ ...form, expectMonths: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">月均合同额（自动）</div>
            <div className="rounded-[2px] border border-[#F2F3F5] bg-[#F7F8FA] px-2 py-1.5 text-sm tabular-nums text-[#4E5969]">
              {Number(form.expectAmount) > 0 && Number(form.expectMonths) > 0 ? `${fmt(Math.round(Number(form.expectAmount) / Number(form.expectMonths)))} 元/月` : "—"}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">商机阶段</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as OppStage })}>
              {OPP_STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">来源渠道</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {OPP_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">预计成交日期</div>
            <Input type="date" value={form.expectedCloseAt} onChange={(e) => setForm({ ...form, expectedCloseAt: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-xs text-[#4E5969]">负责销售</div>
          <Input value={form.sales} onChange={(e) => setForm({ ...form, sales: e.target.value })} />
        </div>
        <div>
          <div className="mb-0.5 text-xs text-[#4E5969]">备注</div>
          <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={2} placeholder="竞争情况、关键需求、风险提示等" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>保存</Button>
        </div>
      </div>
    </CenterModal>
  );
}

/** 成本预估（签约前粗估，与合同后的成本核算不同场景）：
    录入时手动触发——填各意向产品的带宽 / IP 数，点「按产品组成测算」后系统推导月成本并展示预估逻辑；
    推导复用 bomEstimate 同一实现（与合同后核算同源）；合计可手工调整；推导依据随 est 留痕可追溯 */
interface CalcResult { ptype: string; lines: { key: string; name: string; monthly: number; note: string }[]; total: number; resolved: boolean }
function EstimateModal({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const [specs, setSpecs] = useState(opp.products.map(() => ({ bw: "", ip: "" })));
  const [cost, setCost] = useState(opp.est ? String(opp.est.monthlyCost) : "");
  const [oneOff, setOneOff] = useState(opp.est ? String(opp.est.oneOff) : "");
  const [calc, setCalc] = useState<CalcResult[] | null>(null); // 手动测算结果（未测算为 null）
  const months = opp.expectMonths ?? 0;
  const rent = months > 0 ? Math.round(opp.expectAmount / months) : 0; // 预计月租 = 月均合同额
  const autoMonthly = calc ? calc.reduce((s, d) => s + d.total, 0) : 0;
  const mc = cost !== "" ? Number(cost) || 0 : autoMonthly;
  const oo = Number(oneOff) || 0;
  const margin = rent > 0 ? ((rent - mc) / rent) * 100 : null;
  const gross = months > 0 ? opp.expectAmount - mc * months - oo : null;
  const costAdjusted = calc !== null && autoMonthly > 0 && cost !== "" && Number(cost) !== autoMonthly;

  const runCalc = () => {
    if (specs.every((s) => !(Number(s.bw) > 0) && !(Number(s.ip) > 0))) return alert("请先在各意向产品录入带宽或 IP 数，再测算");
    setCalc(opp.products.map((p, i) => {
      const bw = Number(specs[i]?.bw) || 0;
      const ip = Number(specs[i]?.ip) || 0;
      const bom = bomMonthlyCost(p.ptype, bw, ip);
      return { ptype: p.ptype, lines: bom.lines, total: bom.total, resolved: bom.resolved };
    }));
  };

  const save = () => {
    if (!(rent > 0)) return alert("请先完善商机的预计合同金额与预计合同期");
    if (!(mc > 0)) return alert("预估月成本为空：请先「按产品组成测算」，或手工填写预估月成本");
    const parts = (calc ?? []).filter((d) => d.total > 0).map((d) => `${d.ptype} ${fmt(d.total)}`);
    const basis = costAdjusted
      ? `产品组成测算 ${fmt(autoMonthly)} 元/月，手工调整为 ${fmt(mc)} 元/月`
      : calc !== null ? (autoMonthly > 0 ? `产品组成自动测算（${parts.join(" + ")}）` : "产品组成未测算出条目，手工录入") : "手工录入（未走产品组成测算）";
    updateOpp(opp.id, { est: { monthlyCost: mc, oneOff: oo, marginPct: Math.round(margin! * 10) / 10, at: DEMO_TODAY, basis } });
    onClose();
  };

  return (
    <CenterModal title={`成本预估 · ${opp.id}`} sub="签约前粗估，用于报价与毛利把关；赢单后的正式成本以合同核算单为准（两部门填报 + 审批流）" width={640} onClose={onClose}>
      <div className="space-y-3">
        {/* 第一步：录规格（录入时手动触发测算，不自动算） */}
        <div className="space-y-2">
          {opp.products.map((p, i) => (
            <div key={i} className="rounded-[2px] border border-[#E5E6EB] p-2.5">
              <div className="text-[12px] font-medium text-[#1D2129]">{p.cat} · {p.ptype}</div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <Input type="number" min={0} placeholder="带宽（M），如 200" value={specs[i]?.bw ?? ""} onChange={(e) => { setSpecs(specs.map((s, j) => j === i ? { ...s, bw: e.target.value } : s)); setCalc(null); }} />
                <Input type="number" min={0} placeholder="绑定 IP 数，如 8" value={specs[i]?.ip ?? ""} onChange={(e) => { setSpecs(specs.map((s, j) => j === i ? { ...s, ip: e.target.value } : s)); setCalc(null); }} />
              </div>
            </div>
          ))}
          <Button size="sm" className="w-full" onClick={runCalc}>按产品组成测算</Button>
        </div>

        {/* 第二步：测算结果 + 预估逻辑（测算后展示） */}
        {calc !== null && (
          <div className="rounded-[2px] border border-[#BEDAFF] bg-[#F0F5FF] p-3">
            <div className="mb-1.5 text-[11px] font-semibold text-[#1D2129]">测算结果（与合同后核算同一套条目与档案）</div>
            <div className="space-y-1.5">
              {calc.map((d, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#1D2129]">{d.ptype}</span>
                    <span className="font-mono font-semibold text-[#165DFF]">{d.total > 0 ? `${fmt(d.total)} 元/月` : <span className="font-normal text-[#FF7D00]">未测算出月成本</span>}</span>
                  </div>
                  {d.lines.map((l) => (
                    <div key={l.key} className="mt-0.5 flex items-center justify-between gap-3 pl-3 text-[10px] leading-4 text-[#86909C]">
                      <span className="truncate" title={l.note}>{l.name} — {l.note}</span>
                      <span className="shrink-0 font-mono text-[#4E5969]">{fmt(l.monthly)} 元/月</span>
                    </div>
                  ))}
                  {!d.resolved && <div className="pl-3 text-[10px] text-[#FF7D00]">该产品类型未装配成本条目</div>}
                </div>
              ))}
            </div>
            {/* 预估逻辑说明 */}
            <div className="mt-2 border-t border-dashed border-[#BEDAFF] pt-2 text-[10px] leading-5 text-[#4E5969]">
              <div className="font-semibold text-[#1D2129]">预估逻辑（测算口径）</div>
              ① 只取产品组成中「直接·周期性」条目，一次性条目（设备/安装调测）与间接费用（成本中心月结分）不进月成本，一次性投入在下方单独手填；<br />
              ② 出口带宽按边际计价：池月租 ÷（已售带宽 + 本单带宽）× 本单带宽；查不到归属出口池时按 A5 策略中心兜底单价（元/M/月）× 带宽；<br />
              ③ 基础线路 = 档案月租均值 × 该产品类型的运营商数；IP = 地址段档案单价 × 个数；机柜托管 = 机柜档案整柜月租；<br />
              ④ 档案与 A5 参数实时读取，测算值会随后续档案变化而变动；本表为签约前粗估（反复测算、无审批），正式成本以合同核算单为准。
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs text-[#4E5969]">
              <span>预估月成本合计（元/月）<span className="text-[#F53F3F]"> *</span></span>
              {calc !== null && autoMonthly > 0 && cost === "" && <span className="text-[10px] text-[#165DFF]">已带测算值</span>}
            </div>
            <Input type="number" placeholder={calc !== null ? (autoMonthly > 0 ? `测算值 ${fmt(autoMonthly)}，可采用或改填` : "测算无结果，请手工填写") : "先测算，或手工粗估填写"} value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">预估一次性投入（元）</div>
            <Input type="number" placeholder="设备 / 施工等首投" value={oneOff} onChange={(e) => setOneOff(e.target.value)} />
          </div>
        </div>
        {calc !== null && autoMonthly > 0 && (
          <div className="flex items-center justify-between rounded-[2px] bg-[#F0F5FF] px-3 py-1.5 text-[11px] text-[#4E5969]">
            <span>测算合计 <strong className="font-mono text-[#165DFF]">{fmt(autoMonthly)} 元/月</strong>{costAdjusted ? `（当前已手工调整为 ${fmt(mc)}）` : ""}</span>
            {cost !== String(autoMonthly) && <button onClick={() => setCost(String(autoMonthly))} className="text-[#165DFF] hover:underline">采用测算值</button>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-[2px] border border-[#E5E6EB] p-3">
          <div>
            <div className="text-[11px] text-[#86909C]">预估毛利率（对月租 {rent ? `${fmt(rent)} 元` : "—"}）</div>
            <div className={`mt-0.5 text-[18px] font-semibold tabular-nums ${margin === null ? "text-[#C9CDD4]" : margin >= 40 ? "text-[#00B42A]" : margin >= 20 ? "text-[#FF7D00]" : "text-[#F53F3F]"}`}>
              {margin === null ? "—" : `${margin.toFixed(1)}%`}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#86909C]">预估合同毛利额（合同期全额）</div>
            <div className={`mt-0.5 text-[18px] font-semibold tabular-nums ${gross === null ? "text-[#C9CDD4]" : gross >= 0 ? "text-[#1D2129]" : "text-[#F53F3F]"}`}>
              {gross === null ? "—" : `${fmt(gross)} 元`}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>保存预估</Button>
        </div>
      </div>
    </CenterModal>
  );
}

export default function Opportunities() {
  useOpps();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const customerFilter = sp.get("customer"); // 从客户档案带入
  const [stage, setStage] = useState<"全部" | OppStage>("全部");
  const [kw, setKw] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [estimating, setEstimating] = useState<Opportunity | null>(null);

  const all = getOpps().filter((d) => !customerFilter || d.customerId === customerFilter);
  const shown = all.filter((d) =>
    (stage === "全部" || d.stage === stage) &&
    (!kw || d.name.includes(kw) || d.id.includes(kw) || CUSTOMER_NAME(d.customerId).includes(kw))
  );
  const counts = Object.fromEntries(OPP_STAGES.map((s) => [s, all.filter((d) => d.stage === s).length]));

  return (
    <ArcoShell breadcrumb="商机管理">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">商机管理</span>
            {customerFilter && (
              <span className="rounded-[2px] bg-[#F7FAFF] px-2 py-0.5 text-[11px] text-[#165DFF]">客户：{CUSTOMER_NAME(customerFilter)}</span>
            )}
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["全部", ...OPP_STAGES] as const).map((s) => (
                <button key={s} onClick={() => setStage(s)} className={`rounded-[2px] px-2.5 py-1 text-xs ${stage === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {s}{s !== "全部" && <span className="ml-0.5 text-[10px] opacity-70">{counts[s]}</span>}
                </button>
              ))}
            </div>
            <Input className="w-56" placeholder="搜索商机编号 / 名称 / 客户" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>＋ 新建商机</Button>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">商机编号</th><th className="px-3 py-2">客户</th><th className="px-3 py-2">商机名称</th>
                <th className="px-3 py-2">意向产品（产品定义）</th><th className="px-3 py-2 text-right">预计合同额</th><th className="px-3 py-2">预计成交</th>
                <th className="px-3 py-2">阶段</th><th className="px-3 py-2">来源</th><th className="px-3 py-2">负责销售</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2.5 font-mono text-[#86909C]">{d.id}</td>
                  <td className="px-3 py-2.5 font-medium text-[#1D2129]">{CUSTOMER_NAME(d.customerId)}</td>
                  <td className="px-3 py-2.5 text-[#1D2129]">{d.name}{d.remark && <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-[#86909C]" title={d.remark}>{d.remark}</div>}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">
                    {d.products.map((p, i) => (
                      <span key={i} className="mr-1 inline-block whitespace-nowrap rounded-[2px] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px]">{p.cat} · {p.ptype}</span>
                    ))}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono">{d.expectAmount ? `${fmt(d.expectAmount)} 元` : "—"}</div>
                    {d.expectMonths ? <div className="mt-0.5 text-[10px] text-[#86909C]">{d.expectMonths} 个月 · 月均 {fmt(Math.round(d.expectAmount / d.expectMonths))}</div> : null}
                    {d.est && <div className={`mt-0.5 inline-block rounded-[2px] px-1 py-0.5 text-[10px] ${d.est.marginPct >= 40 ? "bg-[#E8F8F2] text-[#00B42A]" : d.est.marginPct >= 20 ? "bg-[#FFF3E8] text-[#FF7D00]" : "bg-[#FFECE8] text-[#F53F3F]"}`} title={d.est.basis ? `推导依据：${d.est.basis}（${d.est.at}）` : `预估时间 ${d.est.at}`}>预估毛利 {d.est.marginPct}%</div>}
                  </td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.expectedCloseAt ?? "—"}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STAGE_CLS[d.stage]}`}>{d.stage}</span></td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.source ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.sales}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => setEstimating(d)} disabled={d.stage === "输单"}
                      className="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#0D9488] hover:text-[#0D9488] disabled:opacity-30">{d.est ? "调整预估" : "成本预估"}</button>
                    {d.stage === "赢单" && !CONTRACTS.some((c) => c.dealId === d.id) && (
                      <button onClick={() => navigate(`/contract/edit?customer=${encodeURIComponent(CUSTOMER_NAME(d.customerId))}&deal=${d.id}`)}
                        className="mr-1 rounded-[2px] bg-[#165DFF] px-2 py-0.5 text-[11px] text-white hover:bg-[#4080FF]">去签约 →</button>
                    )}
                    <button onClick={() => setEditing(d)} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#86909C]">暂无商机</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          要点：商机是客户之下的成交单元（客户 → 商机 → 特批 → 合同）。<strong>特批申请必须挂在具体商机上</strong>；商机可关联多个意向产品（来自产品定义），金额为<strong>预计合同额</strong>（含预计合同期，推算月均）；「成本预估」是签约前的粗估——按意向产品填带宽 / IP，系统从产品组成自动推导月成本（与合同后核算同一套条目与档案，推导明细可逐条核对、合计可手工调整），反复测算、无审批，推导依据随预估留痕；与合同生效后的正式成本核算（两部门填报 + 审批流）分属两个场景。赢单后由合同订单行承接（合同生效自动关闭），输单保留作经营轨迹。
        </div>
      </main>

      {creating && <OppForm presetCustomer={customerFilter} onClose={() => setCreating(false)} />}
      {editing && <OppForm initial={editing} onClose={() => setEditing(null)} />}
      {estimating && <EstimateModal opp={estimating} onClose={() => setEstimating(null)} />}
    </ArcoShell>
  );
}
