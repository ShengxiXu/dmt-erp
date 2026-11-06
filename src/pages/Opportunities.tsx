// 商机管理（/opportunity）：全部商机的统一入口与维护页
// 链路：客户 → 商机 → 特批 → 合同；特批申请必须挂在具体商机上
// 支持 /opportunity?customer=CU-xxx 从客户档案带过滤进入
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useOpps, getOpps, addOpp, updateOpp, CUSTOMERS, OPP_STAGES, OPP_SOURCES, type Opportunity, type OppStage } from "@/data/customers";
import { useCatalog, CATS, PTYPES } from "@/data/products";
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

/** 商机新建 / 编辑表单：意向产品来自产品定义（类别 → 类型两级选择，不可自由输入） */
function OppForm({ initial, presetCustomer, onClose }: { initial?: Opportunity | null; presetCustomer?: string | null; onClose: () => void }) {
  useCatalog();
  const [customerName, setCustomerName] = useState(initial ? CUSTOMER_NAME(initial.customerId) : presetCustomer ? CUSTOMER_NAME(presetCustomer) : "");
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    cat: initial?.cat ?? (CATS()[0] ?? ""),
    ptype: initial?.ptype ?? "",
    expectAmount: initial ? String(initial.expectAmount) : "",
    expectedCloseAt: initial?.expectedCloseAt ?? "",
    stage: initial?.stage ?? "跟进中" as OppStage,
    source: initial?.source ?? OPP_SOURCES[0],
    sales: initial?.sales ?? CUSTOMERS.find((c) => c.name === (presetCustomer ? CUSTOMER_NAME(presetCustomer) : ""))?.sales ?? "张弛",
    remark: initial?.remark ?? "",
  });
  const customer = CUSTOMERS.find((c) => c.name === customerName);
  const types = PTYPES(form.cat, true); // 意向可选全部类型（含停用，仅作意向参考）
  const effPtype = types.includes(form.ptype) ? form.ptype : (types[0] ?? "");

  const save = () => {
    if (!customer) return alert("请选择归属客户");
    if (!form.name.trim()) return alert("请填写商机名称");
    if (!effPtype) return alert("请选择意向产品类型");
    const patch = {
      customerId: customer.id, name: form.name.trim(), cat: form.cat, ptype: effPtype,
      expectAmount: Number(form.expectAmount) || 0, expectedCloseAt: form.expectedCloseAt || undefined,
      stage: form.stage, source: form.source, sales: form.sales, remark: form.remark || undefined,
    };
    if (initial) updateOpp(initial.id, patch);
    else addOpp(patch);
    onClose();
  };

  return (
    <CenterModal title={initial ? `编辑商机 · ${initial.id}` : "新建商机"} sub="意向产品来自产品定义（类别 → 类型两级选择），不可自由输入" width={560} onClose={onClose}>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">意向产品类别</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={form.cat}
              onChange={(e) => setForm({ ...form, cat: e.target.value, ptype: "" })}>
              {CATS().map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">意向产品类型 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={effPtype}
              onChange={(e) => setForm({ ...form, ptype: e.target.value })}>
              {types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">预计月租（元/月）</div>
            <Input type="number" placeholder="如 88000" value={form.expectAmount} onChange={(e) => setForm({ ...form, expectAmount: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-xs text-[#4E5969]">预计成交日期</div>
            <Input type="date" value={form.expectedCloseAt} onChange={(e) => setForm({ ...form, expectedCloseAt: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
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

export default function Opportunities() {
  useOpps();
  const [sp] = useSearchParams();
  const customerFilter = sp.get("customer"); // 从客户档案带入
  const [stage, setStage] = useState<"全部" | OppStage>("全部");
  const [kw, setKw] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);

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
                <th className="px-3 py-2">意向产品（产品定义）</th><th className="px-3 py-2 text-right">预计月租</th><th className="px-3 py-2">预计成交</th>
                <th className="px-3 py-2">阶段</th><th className="px-3 py-2">来源</th><th className="px-3 py-2">负责销售</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2.5 font-mono text-[#86909C]">{d.id}</td>
                  <td className="px-3 py-2.5 font-medium text-[#1D2129]">{CUSTOMER_NAME(d.customerId)}</td>
                  <td className="px-3 py-2.5 text-[#1D2129]">{d.name}{d.remark && <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-[#86909C]" title={d.remark}>{d.remark}</div>}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.cat} · {d.ptype}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{d.expectAmount ? `${fmt(d.expectAmount)} 元` : "—"}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.expectedCloseAt ?? "—"}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STAGE_CLS[d.stage]}`}>{d.stage}</span></td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.source ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.sales}</td>
                  <td className="px-3 py-2.5 text-right"><button onClick={() => setEditing(d)} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#86909C]">暂无商机</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          要点：商机是客户之下的成交单元（客户 → 商机 → 特批 → 合同）。<strong>特批申请必须挂在具体商机上</strong>；商机的意向产品来自产品定义，赢单后由合同承接（合同生效自动关闭），输单保留作经营轨迹。
        </div>
      </main>

      {creating && <OppForm presetCustomer={customerFilter} onClose={() => setCreating(false)} />}
      {editing && <OppForm initial={editing} onClose={() => setEditing(null)} />}
    </ArcoShell>
  );
}
