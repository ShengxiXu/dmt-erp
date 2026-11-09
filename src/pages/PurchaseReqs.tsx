// P08-1 采购需求（/purchase/reqs）
// 需求来源三类：手工提报 / 资源不足联动（P02/P05 挂起单自动生成，携带工单链接，采购完成后反向通知恢复）/ 业务规划。
// 列表默认视图 + 条件搜索；待处理需求可「转采购单」（多选汇总 → P08-2 草稿）或关闭。
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePurchaseFlow, getReqs, addReq, closeReq, createPoFromReqs, reqToContractChange, type PurchaseReq, type ReqSource, type ReqType } from "@/data/purchaseFlow";
import { getContracts } from "@/data/purchase";
import { SUPPLIERS, R1_ROWS } from "@/data/resources";
import { DEMO_TODAY } from "@/data/settings";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SOURCE_CLS: Record<ReqSource, string> = {
  手工提报: "bg-[#F7F8FA] text-[#4E5969]",
  资源不足联动: "bg-[#FFF3E8] text-[#FF7D00]",
  业务规划: "bg-[#E8F3FF] text-[#165DFF]",
};
const STATUS_CLS: Record<PurchaseReq["status"], string> = {
  待处理: "bg-[#E8F3FF] text-[#165DFF]",
  已转采购单: "bg-[#E8F8F2] text-[#00B42A]",
  已转合同变更: "bg-[#E8F8F2] text-[#00B42A]",
  已关闭: "bg-[#F2F3F5] text-[#86909C]",
};

// 转采购单：供应商 + 框架合同选择（按单计价类，选中自动带采购单价）
function ToPoModal({ reqNos, onClose, onDone }: { reqNos: string[]; onClose: () => void; onDone: (poNo: string) => void }) {
  const [supplier, setSupplier] = useState("华为渠道-上海XX");
  const [contractId, setContractId] = useState("");
  const contracts = getContracts().filter((c) => c.billing === "按单计价");
  const contract = contracts.find((c) => c.id === contractId);
  const confirm = () => {
    if (!supplier.trim()) return alert("请填写供应商");
    const poNo = createPoFromReqs(reqNos, supplier.trim(), contractId || undefined);
    if (!poNo) return alert("所选需求单均不可转（仅「待处理」状态的设备 / IP 段类可转采购单）");
    onDone(poNo);
  };
  return (
    <CenterModal title={`转采购单（${reqNos.length} 张需求汇总）`} sub="生成 P08-2 草稿；关联框架合同后自动带出采购单价，也可不关联（零星采购事后补录合同价）" width={520} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">供应商 <span className="text-[#F53F3F]">*</span></div>
          <Input list="topo-suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <datalist id="topo-suppliers">{SUPPLIERS.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">关联采购合同（可空）</div>
          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={contractId}
            onChange={(e) => { setContractId(e.target.value); const c = contracts.find((x) => x.id === e.target.value); if (c) setSupplier(c.supplier); }}>
            <option value="">不关联（零星采购，事后补录合同价）</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.name}（框架价 {c.unitPrice?.toLocaleString("zh-CN")} 元）</option>)}
          </select>
          {contract && <div className="mt-1 rounded-[2px] bg-[#E8F3FF] px-2 py-1 text-[10px] text-[#165DFF]">✓ 选中后设备明细行自动带框架价 {contract.unitPrice?.toLocaleString("zh-CN")} 元/台（提交前仍可修改，留痕）</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={confirm}>生成采购单草稿</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// 带宽类需求 → 原采购合同变更（补充协议）：选目标出口池，填新增容量与月租，预览后生效
function ContractChangeModal({ req, onClose }: { req: PurchaseReq; onClose: () => void }) {
  const [lineId, setLineId] = useState(R1_ROWS.find((r) => req.spec.includes(r.carrier))?.id ?? R1_ROWS[0]?.id ?? "");
  const [addM, setAddM] = useState(String(req.qty));
  const [addMonthly, setAddMonthly] = useState("");
  const row = R1_ROWS.find((r) => r.id === lineId);
  const m = Number(addM), c = Number(addMonthly);
  const save = () => {
    const err = reqToContractChange(req.reqNo, lineId, m, c);
    if (err) return alert(err);
    onClose();
  };
  return (
    <CenterModal title={`转合同变更 · ${req.reqNo}`} sub="带宽扩容不走新采购单：原采购合同补充协议，出口池月租口径连续（审批通过后生效）" width={560} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">目标出口池 <span className="text-[#F53F3F]">*</span></div>
          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={lineId} onChange={(e) => setLineId(e.target.value)}>
            {R1_ROWS.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}（现 {r.capacityM}M / {r.monthlyCost.toLocaleString("zh-CN")} 元·月 · 合同 {r.contractNo}）</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">新增容量 <span className="text-[#F53F3F]">*</span></div>
            <Input type="number" min={1} value={addM} onChange={(e) => setAddM(e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">新增月租（元/月） <span className="text-[#F53F3F]">*</span></div>
            <Input type="number" min={1} placeholder="按补充协议约定填写" value={addMonthly} onChange={(e) => setAddMonthly(e.target.value)} />
          </div>
        </div>
        {row && m > 0 && c > 0 && (
          <div className="rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] p-2.5 leading-5 text-[#4E5969]">
            变更预览：<span className="font-mono">{row.id}</span> 出口池 {row.capacityM}M / {row.monthlyCost.toLocaleString("zh-CN")} 元·月 →{" "}
            <span className="font-semibold text-[#1D2129]">{row.capacityM + m}M / {(row.monthlyCost + c).toLocaleString("zh-CN")} 元·月</span>
            （+{m}M、+{c.toLocaleString("zh-CN")} 元·月）<br />
            <span className="text-[#86909C]">不生成采购单；原合同 {row.contractNo} 走补充协议，池维度成本归集口径不变</span>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" disabled={!(m > 0 && c > 0 && lineId)} onClick={save}>确认转合同变更</Button>
        </div>
      </div>
    </CenterModal>
  );
}

function ReqForm({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState<{ source: ReqSource; type: ReqType; spec: string; qty: string; unit: string; room: string; expectDate: string; note: string }>({
    source: "手工提报", type: "设备", spec: "", qty: "", unit: "台", room: "上海漕河泾", expectDate: "", note: "",
  });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.spec.trim()) return alert("请填写规格与数量说明");
    if (!(Number(f.qty) > 0)) return alert("请填写数量（> 0）");
    if ((f.type === "带宽" || f.type === "IP 段") && !f.room.trim()) return alert("带宽 / IP 类需求必须填写目标机房");
    if (!f.expectDate) return alert("请填写期望到货日");
    if (f.expectDate <= DEMO_TODAY) return alert("期望到货日须晚于当日");
    addReq({ source: f.source, type: f.type, spec: f.spec.trim(), qty: Number(f.qty), unit: f.unit, room: f.room, expectDate: f.expectDate, note: f.note || undefined });
    onClose();
  };
  return (
    <CenterModal title="新建采购需求" sub="需求来源为「资源不足联动」时由系统自动生成（工单挂起触发），此处仅手工提报与业务规划" width={560} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">需求来源 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.source} onChange={(e) => set("source", e.target.value)}>
              <option>手工提报</option><option>业务规划</option>
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">需求类型 <span className="text-[#F53F3F]">*</span></div>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["带宽", "IP 段", "设备"] as ReqType[]).map((t) => (
                <button key={t} type="button" onClick={() => setF((x) => ({ ...x, type: t, unit: t === "带宽" ? "M" : t === "IP 段" ? "段" : "台" }))}
                  className={`flex-1 rounded-[2px] px-2 py-1.5 ${f.type === t ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">规格与数量 <span className="text-[#F53F3F]">*</span></div>
          <Input placeholder={f.type === "带宽" ? "如：联通 169 BGP 出口池扩容" : f.type === "IP 段" ? "如：漕河泾 /24 段 ×1" : "如：华为 AR6121 CPE"} value={f.spec} onChange={(e) => set("spec", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">数量 <span className="text-[#F53F3F]">*</span></div>
            <Input type="number" min={1} value={f.qty} onChange={(e) => set("qty", e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">单位</div>
            <Input value={f.unit} onChange={(e) => set("unit", e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">目标机房 {f.type !== "设备" && <span className="text-[#F53F3F]">*</span>}</div>
            <Input list="req-rooms" value={f.room} onChange={(e) => set("room", e.target.value)} />
            <datalist id="req-rooms">{["上海漕河泾", "临港智算中心", "北京亦庄"].map((r) => <option key={r} value={r} />)}</datalist>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">期望到货日 <span className="text-[#F53F3F]">*</span></div>
            <Input type="date" value={f.expectDate} onChange={(e) => set("expectDate", e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">提报人</div>
            <Input defaultValue="孙工（运维）" disabled />
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">需求说明（可空）</div>
          <Input placeholder="用途、紧迫程度等" value={f.note} onChange={(e) => set("note", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>提交需求</Button>
        </div>
      </div>
    </CenterModal>
  );
}

export default function PurchaseReqs() {
  usePurchaseFlow();
  const nav = useNavigate();
  const [kw, setKw] = useState("");
  const [source, setSource] = useState<"全部" | ReqSource>("全部");
  const [type, setType] = useState<"全部" | ReqType>("全部");
  const [openForm, setOpenForm] = useState(false);
  const [ccReq, setCcReq] = useState<PurchaseReq | null>(null);
  const [toPoNos, setToPoNos] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const shown = getReqs().filter((r) =>
    (source === "全部" || r.source === source) &&
    (type === "全部" || r.type === type) &&
    (!kw || r.reqNo.includes(kw) || r.spec.includes(kw) || (r.note ?? "").includes(kw) || (r.linkedWo ?? "").includes(kw)));
  const pending = getReqs().filter((r) => r.status === "待处理");

  const toPo = (reqNos?: string[]) => {
    const nos = reqNos ?? checked;
    if (!nos.length) return alert("请先勾选待处理的需求单");
    const bw = nos.filter((n) => getReqs().find((r) => r.reqNo === n)?.type === "带宽");
    if (bw.length) return alert(`带宽类需求（${bw.join("、")}）不走采购单：出口池扩容请用行内「转合同变更」（原合同补充协议，成本口径连续）`);
    setToPoNos(nos);
  };

  return (
    <ArcoShell breadcrumb="采购管理 / 采购需求">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">采购需求</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["全部", "手工提报", "资源不足联动", "业务规划"] as const).map((s) => (
                <button key={s} onClick={() => setSource(s)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${source === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{s}</button>
              ))}
            </div>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["全部", "带宽", "IP 段", "设备"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${type === t ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{t}</button>
              ))}
            </div>
            <Input className="w-56" placeholder="搜索需求单号 / 规格 / 工单号" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {checked.length > 0 && <Button size="sm" variant="outline" onClick={() => toPo()}>转采购单（{checked.length}）</Button>}
            <Button size="sm" onClick={() => setOpenForm(true)}>＋ 新建需求</Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2">需求单号</th><th className="px-3 py-2">来源</th><th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">规格与数量</th><th className="px-3 py-2">目标机房</th><th className="px-3 py-2">期望到货</th>
                <th className="px-3 py-2">关联工单</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.reqNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2.5">
                    {r.status === "待处理" && (
                      <input type="checkbox" checked={checked.includes(r.reqNo)}
                        onChange={(e) => setChecked((s) => e.target.checked ? [...s, r.reqNo] : s.filter((x) => x !== r.reqNo))} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{r.reqNo}
                    {r.status === "待处理" && <span className="ml-1 rounded-[2px] bg-[#FFF3E8] px-1 py-0.5 text-[10px] text-[#FF7D00]">待处理</span>}
                  </td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${SOURCE_CLS[r.source]}`}>{r.source}</span></td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{r.type}</td>
                  <td className="max-w-[260px] px-3 py-2.5">
                    <div className="truncate font-medium text-[#1D2129]" title={r.spec}>{r.spec}</div>
                    <div className="text-[10px] text-[#86909C]">{r.qty} {r.unit}{r.note ? ` · ${r.note}` : ""}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{r.room}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{r.expectDate}</td>
                  <td className="px-3 py-2.5">
                    {r.linkedWo ? <Link to="/delivery" className="font-mono text-[#FF7D00] hover:underline">{r.linkedWo}</Link> : <span className="text-[#C9CDD4]">—</span>}
                  </td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[r.status]}`}>{r.status}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    {r.status === "待处理" ? (
                      <span className="flex justify-end gap-2">
                        {r.type === "带宽"
                          ? <button className="text-[#165DFF] hover:underline" onClick={() => setCcReq(r)}>转合同变更</button>
                          : <button className="text-[#165DFF] hover:underline" onClick={() => toPo([r.reqNo])}>转采购单</button>}
                        <button className="text-[#86909C] hover:underline" onClick={() => confirm(`关闭需求单 ${r.reqNo}？`) && closeReq(r.reqNo)}>关闭</button>
                      </span>
                    ) : r.poNo ? (
                      <Link to={`/purchase/orders/${r.poNo}`} className="text-[#165DFF] hover:underline">{r.poNo}</Link>
                    ) : r.contractNo ? (
                      <Link to="/purchase/contracts" className="text-[#00B42A] hover:underline" title="已转原采购合同变更（补充协议）">{r.contractNo}</Link>
                    ) : <span className="text-[#C9CDD4]">—</span>}
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#C9CDD4]">{kw || source !== "全部" || type !== "全部" ? "无匹配需求单" : "暂无采购需求"}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 需求来源三类：<strong className="text-[#4E5969]">资源不足联动</strong>（P02/P05 工单挂起或按单采购自动生成，携带工单链接）、手工提报、业务规划；
          ② 待处理需求按类型分流：<strong className="text-[#4E5969]">设备 / IP 段</strong>勾选汇总转采购单（生成 P08-2 草稿，补单价后提交审批）；<strong className="text-[#4E5969]">带宽扩容</strong>转原采购合同变更（补充协议，出口池月租口径连续，不新建采购单）；
          ③ 联动生成的需求单在采购入库完成后<strong className="text-[#4E5969]">反向通知挂起工单恢复开通</strong>；④ 当前待处理 {pending.length} 张。
        </div>
      </main>
      {openForm && <ReqForm onClose={() => setOpenForm(false)} />}
      {ccReq && <ContractChangeModal req={getReqs().find((r) => r.reqNo === ccReq.reqNo) ?? ccReq} onClose={() => setCcReq(null)} />}
      {toPoNos && <ToPoModal reqNos={toPoNos} onClose={() => setToPoNos(null)} onDone={(poNo) => { setChecked([]); setToPoNos(null); nav(`/purchase/orders/${poNo}`); }} />}
    </ArcoShell>
  );
}
