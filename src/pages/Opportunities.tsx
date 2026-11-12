// 商机管理（/opportunity）：全部商机的统一入口与维护页
// 链路：客户 → 商机 → 特批 → 合同；特批申请必须挂在具体商机上
// 支持 /opportunity?customer=CU-xxx 从客户档案带过滤进入
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Download } from "lucide-react";
import { useOpps, getOpps, addOpp, updateOpp, CUSTOMERS, OPP_STAGES, OPP_SOURCES, type Opportunity, type OppProduct, type OppStage } from "@/data/customers";
import { useFollowups, pendingFollowups, confirmWithOpp, closeWithoutOpp, type ExpireFollowup } from "@/data/followups";
import { CONTRACTS } from "@/data/contracts";
import { inDataScope, scopeBanner, currentUser } from "@/data/users";
import { useCatalog, CATS, PTYPES } from "@/data/products";
import { DEMO_TODAY } from "@/data/settings";
import { exportCsv } from "@/utils/exportCsv";
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

/** 商机新建 / 编辑表单：意向产品来自产品定义（类别 → 类型两级选择，可关联多个，不可自由输入）
 *  preset：外部带入预填（到期拆机确认等场景：客户 + 来源 + 建议名称）；onSaved：新建成功后回执商机编号 */
function OppForm({ initial, presetCustomer, preset, onSaved, onClose }: {
  initial?: Opportunity | null; presetCustomer?: string | null;
  preset?: { customerId?: string; source?: string; name?: string };
  onSaved?: (id: string) => void;
  onClose: () => void;
}) {
  useCatalog();
  const [customerName, setCustomerName] = useState(initial ? CUSTOMER_NAME(initial.customerId) : preset?.customerId ? CUSTOMER_NAME(preset.customerId) : presetCustomer ? CUSTOMER_NAME(presetCustomer) : "");
  const [products, setProducts] = useState<OppProduct[]>(initial?.products?.length ? initial.products.map((p) => ({ ...p })) : [{ cat: CATS()[0] ?? "", ptype: "" }]);
  const [form, setForm] = useState({
    name: initial?.name ?? preset?.name ?? "",
    expectAmount: initial ? String(initial.expectAmount) : "",
    expectMonths: initial?.expectMonths ? String(initial.expectMonths) : "",
    expectedCloseAt: initial?.expectedCloseAt ?? "",
    stage: initial?.stage ?? "跟进中" as OppStage,
    source: initial?.source ?? preset?.source ?? OPP_SOURCES[0],
    sales: initial?.sales ?? CUSTOMERS.find((c) => c.id === preset?.customerId)?.sales ?? CUSTOMERS.find((c) => c.name === (presetCustomer ? CUSTOMER_NAME(presetCustomer) : ""))?.sales ?? currentUser()?.name ?? "张弛",
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
    else { const newId = addOpp(patch); onSaved?.(newId); }
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

export default function Opportunities() {
  useOpps();
  useFollowups();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const customerFilter = sp.get("customer"); // 从客户档案带入
  const [stage, setStage] = useState<"全部" | OppStage>("全部");
  const [kw, setKw] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  // 到期拆机商机确认：拆机完工自动生成的待办，销售在此一条动作完成「录商机 / 登记无后续」
  const [followOpp, setFollowOpp] = useState<ExpireFollowup | null>(null); // 录商机：打开表单预填
  const [noFollow, setNoFollow] = useState<ExpireFollowup | null>(null);   // 无后续：原因登记
  const [noReason, setNoReason] = useState("");
  const [noNote, setNoNote] = useState("");
  const pendFu = pendingFollowups();

  const all = getOpps().filter((d) => !customerFilter || d.customerId === customerFilter);
  const scoped = all.filter((d) => inDataScope(d.sales));
  const shown = scoped.filter((d) =>
    (stage === "全部" || d.stage === stage) &&
    (!kw || d.name.includes(kw) || d.id.includes(kw) || CUSTOMER_NAME(d.customerId).includes(kw))
  );
  const counts = Object.fromEntries(OPP_STAGES.map((s) => [s, scoped.filter((d) => d.stage === s).length]));
  const banner = scopeBanner(all.length - scoped.length);

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
            <button onClick={() => exportCsv(`商机台账_${DEMO_TODAY}`, ["商机编号", "客户", "商机名称", "意向产品", "预计合同额(元)", "预计成交", "阶段", "来源", "负责销售"],
              shown.map((d) => [d.id, CUSTOMER_NAME(d.customerId), d.name, d.products.map((p) => p.ptype).join("+"), d.expectAmount, d.expectedCloseAt ?? "", d.stage, d.source ?? "", d.sales]))}
              className="flex items-center gap-1 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">
              <Download size={12} /> 导出
            </button>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>＋ 新建商机</Button>
        </div>

        {banner && (
          <div className="rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5] px-4 py-2 text-[11px] text-[#F53F3F]">🔒 {banner}</div>
        )}

        {/* 到期拆机商机确认：合同到期拆机完工 → 自动生成的销售待办（lifecycle.executeRecover 触发） */}
        {!!pendFu.length && (
          <section className="rounded-[4px] border border-[#FF7D00]/40 bg-[#FFFDF5]">
            <div className="flex items-center gap-2 border-b border-[#FFE8C8] px-4 py-2.5">
              <span className="text-sm font-semibold text-[#1D2129]">到期拆机 · 商机确认</span>
              <span className="rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">{pendFu.length} 家待确认</span>
              <span className="text-[11px] text-[#86909C]">客户合同到期拆机后，请确认是否有后续合作商机：录商机（自动关联本任务）或登记无后续原因（留痕）</span>
            </div>
            {pendFu.map((fu) => (
              <div key={fu.fuNo} className="flex flex-wrap items-center gap-3 border-b border-[#FFF3E8] px-4 py-2.5 text-xs last:border-0">
                <span className="font-medium text-[#1D2129]">{fu.customer}</span>
                <span className="text-[#86909C]">{fu.contractNo}（原 {fu.originLine}）</span>
                <span className="text-[#86909C]">拆机 {fu.rcNo} 已完工 · {fu.createdAt.slice(5, 10)}</span>
                <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">归属销售 {fu.sales}</span>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => setFollowOpp(fu)}>有后续 · 录商机</Button>
                  <Button size="sm" variant="outline" onClick={() => { setNoFollow(fu); setNoReason(""); setNoNote(""); }}>无后续 · 登记原因</Button>
                </span>
              </div>
            ))}
          </section>
        )}

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
                  </td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.expectedCloseAt ?? "—"}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STAGE_CLS[d.stage]}`}>{d.stage}</span></td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.source ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{d.sales}</td>
                  <td className="px-3 py-2.5 text-right">
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
          要点：商机是客户之下的成交单元（客户 → 商机 → 特批 → 合同）。<strong>特批申请必须挂在具体商机上</strong>；商机可关联多个意向产品（来自产品定义），金额为<strong>预计合同额</strong>（含预计合同期，推算月均）；商机阶段不做成本预估——意向规格未定，报价毛利靠销售经验与特批审批把关（低价特批时审批人参考合同价与折扣），正式成本一律以合同生效后的核算单为准（两部门填报 + 审批流锁定）。赢单后由合同订单行承接（合同生效自动关闭），输单保留作经营轨迹。
        </div>
      </main>

      {creating && <OppForm presetCustomer={customerFilter} onClose={() => setCreating(false)} />}
      {editing && <OppForm initial={editing} onClose={() => setEditing(null)} />}
      {followOpp && (
        <OppForm
          preset={{ customerId: followOpp.customerId, source: "到期拆机延续", name: `${followOpp.customer} · 到期后续合作` }}
          onSaved={(oppId) => confirmWithOpp(followOpp.fuNo, oppId)}
          onClose={() => setFollowOpp(null)}
        />
      )}
      {noFollow && (
        <CenterModal title={`无后续登记 · ${noFollow.customer}`} sub={`${noFollow.contractNo}（原 ${noFollow.originLine}）到期拆机后无后续合作，原因留痕关闭确认任务`} width={460} onClose={() => setNoFollow(null)}>
          <div className="space-y-3">
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">原因分类 <span className="text-[#F53F3F]">*</span></div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={noReason} onChange={(e) => setNoReason(e.target.value)}>
                <option value="">选择客户流失原因</option>
                {["客户搬迁/退出本地", "转向竞争对手", "预算收缩/业务收缩", "改用其他方案（自建/云）", "其他"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">补充说明（可空）</div>
              <Input placeholder="如：客户总部统一迁到深圳机房" value={noNote} onChange={(e) => setNoNote(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNoFollow(null)}>取消</Button>
              <Button size="sm" variant="destructive" disabled={!noReason} onClick={() => {
                const err = closeWithoutOpp(noFollow.fuNo, noReason, noNote);
                if (err) return alert(err);
                setNoFollow(null);
              }}>确认无后续（留痕）</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
