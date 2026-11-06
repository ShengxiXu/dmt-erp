// P08 采购单详情（/purchase/orders/:poNo）—— 四步办理：① 采购审批（P08-2/3）② 下单与合同价（P08-4）③ 到货验收（P08-5）④ 资源入库建档（P08-6）
import { useState } from "react";
import { useParams } from "react-router";
import { usePurchaseFlow, PO_BY_NO, poTotalWithTax, submitPo, submitPoDirect, approvePo, rejectPo, savePoDraft, saveContractPrice, addReceiptBatch, completeInbound, setPoAttachments, fmtMoney, type POLine, type PurchaseOrder } from "@/data/purchaseFlow";
import { useApprovalFlow, POINT_BY_ID, CHAINS_OF } from "@/data/approvalFlow";
import { PURCHASE_CONTRACTS } from "@/data/purchase";
import { R1_ROWS } from "@/data/resources";
import { Link } from "react-router";
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STEPS = ["采购审批", "下单与合同价", "到货验收", "入库建档"];
const stepOf = (po: PurchaseOrder) =>
  po.inboundDone ? 4 : po.status === "验收完成" ? 3 : po.status === "部分到货" ? 2 : po.status === "已下单" ? 1 : 0;
const LINE_TYPE_CLS: Record<POLine["lineType"], string> = {
  带宽容量: "bg-[#E8F3FF] text-[#165DFF]",
  "IP 段": "bg-[#FEF0FF] text-[#722ED1]",
  设备: "bg-[#E8F8F2] text-[#00B42A]",
};

// ---------- ① 采购审批（草稿编辑 + 提交 + 批准/驳回） ----------
function ApprovalStep({ po }: { po: PurchaseOrder }) {
  useApprovalFlow();
  const locked = po.status !== "草稿";
  const [lines, setLines] = useState<POLine[]>(po.lines.map((l) => ({ ...l })));
  const [supplier, setSupplier] = useState(po.supplier);
  const [paymentTerms, setPaymentTerms] = useState(po.paymentTerms ?? "");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const totalWithTax = poTotalWithTax(po);
  const bigAmount = totalWithTax >= 100000;
  // 审批链来自「系统管理 → 审批流配置」（AP-02 采购审批）：按分支条件匹配启用链，不写死在页面
  const point = POINT_BY_ID("AP-02");
  const chains = CHAINS_OF("AP-02").filter((c) => c.enabled);
  const hitChain = (() => {
    for (const c of chains.filter((x) => x.branch)) {
      const m = c.branch.match(/([\d,]+)/);
      const th = m ? Number(m[1].replace(/,/g, "")) : null;
      if (th != null && totalWithTax >= th) return c;
    }
    return chains.find((c) => !c.branch);
  })();
  const approverText = hitChain
    ? hitChain.nodes.map((n) => `${n.approverSource === "指定人" ? "" : `${n.approverSource}·`}${n.approver}（${n.mode}）`).join(" → ")
    : "未配置（请到审批流配置补链）";

  const patch = (i: number, k: keyof POLine, v: string) =>
    setLines((ls) => ls.map((l, j) => j === i ? { ...l, [k]: k === "spec" || k === "lineType" ? v : Number(v) || 0 } : l));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-xs">
        <span className="text-[#4E5969]">供应商</span>
        {locked ? <span className="font-medium text-[#1D2129]">{po.supplier}</span> : (
          <Input className="w-56" list="po-suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        )}
        <datalist id="po-suppliers">{PURCHASE_CONTRACTS.map((c) => <option key={c.id} value={c.supplier} />)}</datalist>
        <span className="text-[#4E5969]">账期条款</span>
        {locked ? <span className="text-[#1D2129]">{po.paymentTerms || "—"}</span> : (
          <Input className="w-40" placeholder="如 月结 30 天" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
        )}
        <span className="ml-auto text-[#86909C]">税率 {Math.round(po.taxRate * 100)}% · 含税总额
          <strong className="ml-1 text-[#1D2129]">¥ {fmtMoney(poTotalWithTax(po))}</strong>
          {bigAmount && <span className="ml-2 rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">≥ 10 万：自动加签管理层</span>}
        </span>
      </div>

      <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th className="px-3 py-2">明细类型</th><th className="px-3 py-2">规格</th><th className="px-3 py-2">单价（元）</th>
              <th className="px-3 py-2">数量</th><th className="px-3 py-2">金额（元）</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-3 py-2">
                  {locked ? <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${LINE_TYPE_CLS[l.lineType]}`}>{l.lineType}</span> : (
                    <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-1.5 py-1" value={l.lineType} onChange={(e) => patch(i, "lineType", e.target.value)}>
                      {["带宽容量", "IP 段", "设备"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  )}
                </td>
                <td className="max-w-[280px] px-3 py-2">
                  {locked ? <span className="text-[#1D2129]">{l.spec}</span> : <Input value={l.spec} onChange={(e) => patch(i, "spec", e.target.value)} />}
                </td>
                <td className="px-3 py-2">{locked ? fmtMoney(l.unitPrice) : <Input className="w-24" type="number" min={0} value={l.unitPrice || ""} onChange={(e) => patch(i, "unitPrice", e.target.value)} />}</td>
                <td className="px-3 py-2">{locked ? l.quantity : <Input className="w-20" type="number" min={1} value={l.quantity || ""} onChange={(e) => patch(i, "quantity", e.target.value)} />}</td>
                <td className="px-3 py-2 font-medium text-[#1D2129]">{fmtMoney(l.unitPrice * l.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!locked && (
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <span className="text-[11px] text-[#86909C]">草稿态可编辑；提交后锁定进入审批，驳回可修改后重新提交（版本 +1，留痕）</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => savePoDraft(po.poNo, { supplier, paymentTerms, lines })}>保存草稿</Button>
            <Button size="sm" onClick={() => {
              savePoDraft(po.poNo, { supplier, paymentTerms, lines });
              if (point && !point.enabled) submitPoDirect(po.poNo); // 审批点已停用：提交直接生效（A2 配置驱动）
              else submitPo(po.poNo);
            }}>{point && !point.enabled ? "提交（审批点已停用，直接生效）" : "提交审批（锁定）"}</Button>
          </span>
        </div>
      )}
      {po.status === "待审批" && (
        <div className="space-y-2 rounded-[4px] border border-[#FF7D00]/30 bg-[#FFF7E8] px-4 py-3 text-xs">
          <div className="font-medium text-[#1D2129]">
            待审批：{approverText}
            {bigAmount && hitChain && <span className="ml-2 rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">命中大额分支链</span>}
            <Link to="/system/approval" className="ml-2 font-normal text-[#165DFF] hover:underline">审批链来源：审批流配置（AP-02）</Link>
          </div>
          {po.rejectReason && <div className="text-[#F53F3F]">上次驳回原因（v{po.version - 1}）：{po.rejectReason}</div>}
          <div className="flex gap-2">
            <Button size="sm" className="bg-[#00B42A] hover:bg-[#00B42A]/90" onClick={() => approvePo(po.poNo)}>批准（→ 已下单）</Button>
            <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>驳回（{hitChain?.rejectPolicy ?? "退回发起人"}）</Button>
          </div>
          {rejectOpen && (
            <div className="flex items-center gap-2 border-t border-[#FFE8C8] pt-2">
              <Input className="flex-1" placeholder="驳回原因（留痕，必填）" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(false)}>取消</Button>
              <Button size="sm" variant="destructive" disabled={!rejectReason.trim()} onClick={() => rejectPo(po.poNo, rejectReason.trim())}>确认驳回</Button>
            </div>
          )}
        </div>
      )}
      {locked && po.status !== "待审批" && (
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] text-[#86909C]">
          已提交锁定（v{po.version}）{po.rejectReason ? ` · 驳回记录：${po.rejectReason}` : ""} · 本环节审批链：{approverText}
        </div>
      )}
    </div>
  );
}

// ---------- ② 下单与合同价录入（P08-4） ----------
function ContractPriceStep({ po }: { po: PurchaseOrder }) {
  const [contractNo, setContractNo] = useState(po.contractNo ?? po.contractId ?? "");
  const [signedAt, setSignedAt] = useState(po.contractSignedAt ?? "");
  const [effectAt, setEffectAt] = useState(po.contractEffectAt ?? "");
  const [lines, setLines] = useState(po.contractLines?.map((l) => ({ ...l })) ?? po.lines.map((l) => ({ spec: l.spec, price: l.unitPrice })));
  const [err, setErr] = useState<string | null>(null);
  const saved = !!po.contractNo;

  return (
    <div className="space-y-3">
      <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-xs">
        <div className="mb-3 text-[13px] font-semibold text-[#1D2129]">采购合同价录入单</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">采购合同编号 <span className="text-[#F53F3F]">*</span></div>
            <Input placeholder="如 CT-2026-0xx（查重）" value={contractNo} onChange={(e) => setContractNo(e.target.value)} disabled={saved} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">签订日期 <span className="text-[#F53F3F]">*</span></div>
            <Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} disabled={saved} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">生效日期 <span className="text-[#F53F3F]">*</span></div>
            <Input type="date" value={effectAt} onChange={(e) => setEffectAt(e.target.value)} disabled={saved} />
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 text-[#4E5969]">合同价明细（与 P09 供应商账单自动核对的基准；合同价变更须走修订流程，旧版本保留备查；录入后自动生成采购合同档案，与框架合同同库）</div>
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-2 py-1.5">规格</th><th className="px-2 py-1.5">合同价（元）</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-2 py-1.5 text-[#1D2129]">{l.spec}</td>
                  <td className="px-2 py-1.5">
                    {saved ? <span className="font-medium">{fmtMoney(l.price)}</span> : (
                      <Input className="w-32" type="number" min={0} value={l.price || ""} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, price: Number(e.target.value) || 0 } : x))} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!saved ? (
          <div className="mt-3 flex items-center gap-3 border-t border-[#F2F3F5] pt-3">
            {err && <span className="text-[#F53F3F]">{err}</span>}
            <Button size="sm" className="ml-auto" onClick={() => {
              if (!contractNo.trim() || !signedAt || !effectAt) return setErr("请填写合同编号与日期");
              const e = saveContractPrice(po.poNo, { contractNo: contractNo.trim(), signedAt, effectAt: effectAt || signedAt, lines });
              setErr(e);
            }}>保存合同价</Button>
          </div>
        ) : (
          <div className="mt-3 border-t border-[#F2F3F5] pt-3 text-[#00B42A]">✓ 已录入：合同价已入库作为对账基准，采购合同档案已生成（采购合同页可查）</div>
        )}
      </div>
    </div>
  );
}

// ---------- ③ 到货验收（P08-5，分批） ----------
function ReceiptStep({ po }: { po: PurchaseOrder }) {
  const [items, setItems] = useState<{ arrived: string; result: "合格" | "不合格"; rejectReason: string }[]>(
    po.lines.map((l) => ({ arrived: String(l.quantity - l.receivedQty), result: "合格", rejectReason: "" })),
  );
  const patch = (i: number, k: string, v: string) => setItems((s) => s.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const submit = () => {
    const payload = po.lines.map((_, i) => ({ lineIdx: i, arrived: Number(items[i].arrived) || 0, result: items[i].result, ...(items[i].result === "不合格" ? { rejectReason: items[i].rejectReason } : {}) }));
    if (payload.every((p) => !p.arrived)) return alert("请填写本次到货数量");
    if (payload.some((p) => p.result === "不合格" && !p.rejectReason)) return alert("不合格明细必须填写差异原因（差异登记）");
    addReceiptBatch(po.poNo, payload);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-xs">
        <div className="mb-1 text-[13px] font-semibold text-[#1D2129]">到货验收单 · 第 {po.batches.length + 1} 批</div>
        <div className="mb-3 text-[#86909C]">每行：本次到货数量 ≤ 剩余未到货量；不合格差异登记（原因必填），合格部分先行验收</div>
        <table className="w-full">
          <thead>
            <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th className="px-2 py-1.5">明细</th><th className="px-2 py-1.5">采购数量</th><th className="px-2 py-1.5">剩余未到货</th>
              <th className="px-2 py-1.5">本次到货数量</th><th className="px-2 py-1.5">验收结果</th><th className="px-2 py-1.5">不合格原因</th>
              <th className="px-2 py-1.5">验收进度</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l, i) => {
              const remaining = l.quantity - l.receivedQty;
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-2 py-2"><span className={`mr-1 rounded-[2px] px-1.5 py-0.5 text-[10px] ${LINE_TYPE_CLS[l.lineType]}`}>{l.lineType}</span>{l.spec}</td>
                  <td className="px-2 py-2">{l.quantity}</td>
                  <td className="px-2 py-2">{remaining}</td>
                  <td className="px-2 py-2"><Input className="w-20" type="number" min={0} max={remaining} value={items[i].arrived} onChange={(e) => patch(i, "arrived", e.target.value)} /></td>
                  <td className="px-2 py-2">
                    <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                      {(["合格", "不合格"] as const).map((r) => (
                        <button key={r} onClick={() => patch(i, "result", r)}
                          className={`rounded-[2px] px-2 py-1 ${items[i].result === r ? (r === "合格" ? "bg-[#00B42A] text-white" : "bg-[#F53F3F] text-white") : "text-[#4E5969]"}`}>{r}</button>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2"><Input placeholder={items[i].result === "不合格" ? "差异原因（必填）" : "—"} value={items[i].rejectReason} onChange={(e) => patch(i, "rejectReason", e.target.value)} /></td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#F2F3F5]">
                        <div className="h-full bg-[#00B42A]" style={{ width: `${Math.round((l.receivedQty / l.quantity) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-[#86909C]">{l.receivedQty}/{l.quantity}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 flex justify-end border-t border-[#F2F3F5] pt-3">
          <Button size="sm" onClick={submit}>提交本批验收</Button>
        </div>
      </div>

      {po.batches.length > 0 && (
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-xs">
          <div className="mb-2 text-[13px] font-semibold text-[#1D2129]">验收批次记录</div>
          {po.batches.map((b) => (
            <div key={b.batchNo} className="border-b border-[#F2F3F5] py-2 last:border-0">
              <div className="text-[#4E5969]">第 {b.batchNo} 批 · {b.at} · {b.operator}</div>
              {b.items.filter((i) => i.arrived > 0).map((i, k) => {
                const l = po.lines[i.lineIdx];
                return (
                  <div key={k} className={i.result === "合格" ? "text-[#1D2129]" : "text-[#F53F3F]"}>
                    {l?.spec}：到货 {i.arrived} · {i.result}{i.rejectReason ? `（${i.rejectReason}，退回供应商线下处理）` : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- ④ 资源入库建档（P08-6） ----------
function InboundStep({ po }: { po: PurchaseOrder }) {
  const devLine = po.lines.find((x) => x.lineType === "设备");
  const bwLine = po.lines.find((l) => l.lineType === "带宽容量");
  const ipLine = po.lines.find((l) => l.lineType === "IP 段");
  const [tab, setTab] = useState<"设备" | "带宽" | "IP">(devLine ? "设备" : bwLine ? "带宽" : "IP");
  const [devices, setDevices] = useState<{ sn: string; brand: string; model: string; warrantyEnd: string }[]>(
    devLine ? Array.from({ length: devLine.acceptedQty }, (_, i) => ({ sn: `SN-AR6121-01${String(i + 10).padStart(2, "0")}`, brand: "华为", model: "AR6121 CPE", warrantyEnd: "2028-10-31" })) : [],
  );
  const [bw, setBw] = useState({ poolId: "I-102", addM: bwLine?.acceptedQty ?? 0, monthlyCost: 0 });
  const [ip, setIp] = useState({ segment: ipLine ? "58.46.0.0/24" : "", room: "上海漕河泾", unitPrice: 39 });
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const e = completeInbound(po.poNo, {
      ...(devLine ? { devices } : {}),
      ...(bwLine ? { bw: { poolId: bw.poolId, addM: Number(bw.addM) || 0, monthlyCost: Number(bw.monthlyCost) || 0 } } : {}),
      ...(ipLine ? { ip: { segment: ip.segment, room: ip.room, unitPrice: Number(ip.unitPrice) || 0 } } : {}),
    });
    setErr(e);
  };

  const tabs = [devLine && "设备", bwLine && "带宽", ipLine && "IP"].filter(Boolean) as ("设备" | "带宽" | "IP")[];

  return (
    <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-xs">
      <div className="mb-1 text-[13px] font-semibold text-[#1D2129]">入库建档单</div>
      <div className="mb-3 text-[#86909C]">按明细类型分页签，均从验收合格明细带入；提交后资源正式可售（带宽池余量 / 空闲 IP 段 / 在库设备），并联动恢复挂起工单</div>
      <div className="mb-3 flex gap-1 border-b border-[#F2F3F5] pb-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-[2px] px-3 py-1.5 ${tab === t ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{t}页签</button>
        ))}
      </div>

      {tab === "设备" && devLine && (
        <div>
          <div className="mb-2 text-[#4E5969]">逐台建档（一行一台，SN 全局唯一查重）· 验收合格 {devLine.acceptedQty} 台</div>
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-2 py-1.5">资产编号</th><th className="px-2 py-1.5">SN <span className="text-[#F53F3F]">*</span></th>
                <th className="px-2 py-1.5">品牌</th><th className="px-2 py-1.5">型号</th><th className="px-2 py-1.5">保修到期 <span className="text-[#F53F3F]">*</span></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-mono text-[#86909C]">系统生成</td>
                  <td className="px-2 py-1.5"><Input value={d.sn} onChange={(e) => setDevices((s) => s.map((x, j) => j === i ? { ...x, sn: e.target.value } : x))} /></td>
                  <td className="px-2 py-1.5"><Input value={d.brand} onChange={(e) => setDevices((s) => s.map((x, j) => j === i ? { ...x, brand: e.target.value } : x))} /></td>
                  <td className="px-2 py-1.5"><Input value={d.model} onChange={(e) => setDevices((s) => s.map((x, j) => j === i ? { ...x, model: e.target.value } : x))} /></td>
                  <td className="px-2 py-1.5"><Input type="date" value={d.warrantyEnd} onChange={(e) => setDevices((s) => s.map((x, j) => j === i ? { ...x, warrantyEnd: e.target.value } : x))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[#86909C]">入库后状态=在库、位置=中心仓（可移库）；保修到期前 30 天提醒</div>
        </div>
      )}

      {tab === "带宽" && bwLine && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">目标带宽池 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={bw.poolId} onChange={(e) => setBw((x) => ({ ...x, poolId: e.target.value }))}>
              {R1_ROWS.map((r) => <option key={r.id} value={r.id}>{r.name}（现 {r.capacityM}M）</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">扩容容量（M）<span className="text-[#F53F3F]"> *</span></div>
            <Input type="number" min={1} value={bw.addM || ""} onChange={(e) => setBw((x) => ({ ...x, addM: Number(e.target.value) }))} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">新增月租（元/月）<span className="text-[#F53F3F]"> *</span></div>
            <Input type="number" min={0} value={bw.monthlyCost || ""} onChange={(e) => setBw((x) => ({ ...x, monthlyCost: Number(e.target.value) }))} />
          </div>
        </div>
      )}

      {tab === "IP" && ipLine && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">父段 CIDR <span className="text-[#F53F3F]">*</span></div>
            <Input placeholder="如 58.46.0.0/24" value={ip.segment} onChange={(e) => setIp((x) => ({ ...x, segment: e.target.value }))} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">目标机房 <span className="text-[#F53F3F]">*</span></div>
            <Input value={ip.room} onChange={(e) => setIp((x) => ({ ...x, room: e.target.value }))} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">月租单价（元/个）</div>
            <Input type="number" min={0} value={ip.unitPrice} onChange={(e) => setIp((x) => ({ ...x, unitPrice: Number(e.target.value) }))} />
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 border-t border-[#F2F3F5] pt-3">
        {err && <span className="text-[#F53F3F]">{err}</span>}
        <Button size="sm" className="ml-auto" onClick={submit}>提交入库（资源正式可售）</Button>
      </div>
    </div>
  );
}

// ---------- 页面 ----------
export default function PurchaseOrderDetail() {
  usePurchaseFlow();
  const { poNo } = useParams();
  const po = PO_BY_NO(poNo ?? "");
  if (!po) return (
    <ArcoShell breadcrumb="采购管理 / 采购单">
      <main className="p-6 text-sm text-[#86909C]">采购单 {poNo} 不存在。<Link to="/purchase/orders" className="text-[#165DFF] hover:underline">返回列表</Link></main>
    </ArcoShell>
  );
  const cur = stepOf(po);
  const contractDef = PURCHASE_CONTRACTS.find((c) => c.id === (po.contractId ?? po.contractNo));

  return (
    <ArcoShell breadcrumb={`采购管理 / 采购单 / ${po.poNo}`}>
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-[#1D2129]">{po.poNo}</span>
            <span className="text-xs text-[#86909C]">供应商 {po.supplier} · 引用需求 {po.reqNos.join("、") || "—"} · 含税总额 ¥ {fmtMoney(poTotalWithTax(po))}</span>
            {po.contractId ? (
              <Link to="/purchase/contracts" className="rounded-[2px] bg-[#E8F3FF] px-2 py-0.5 text-[11px] text-[#165DFF] hover:underline" title="已关联采购合同档案（创建时选择，自动带价）">
                合同 {po.contractId}{contractDef ? ` · ${contractDef.name}` : ""}
              </Link>
            ) : po.contractNo ? (
              <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] text-[#4E5969]" title="未关联合同档案（P08-4 事后录入的合同编号）">合同 {po.contractNo}（未关联档案）</span>
            ) : (
              <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] text-[#86909C]">未关联采购合同</span>
            )}
            {po.resumedWo && (
              <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-0.5 text-[11px] text-[#00B42A]">
                ✓ 已联动恢复挂起工单 <Link to="/delivery" className="font-mono underline">{po.resumedWo}</Link>
              </span>
            )}
          </div>
          <Link to="/purchase/orders" className="text-xs text-[#165DFF] hover:underline">返回列表</Link>
        </div>

        <div className="flex items-center gap-2 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2 text-xs">
          <span className="text-[#4E5969]">附件</span>
          {(po.attachments ?? []).map((f) => (
            <span key={f} className="flex items-center gap-1 rounded-[2px] bg-[#F7F8FA] px-2 py-0.5 text-[11px] text-[#1D2129]">
              📎 {f}
              <button className="text-[#86909C] hover:text-[#F53F3F]" title="删除附件"
                onClick={() => setPoAttachments(po.poNo, (po.attachments ?? []).filter((x) => x !== f))}>×</button>
            </span>
          ))}
          <button onClick={() => setPoAttachments(po.poNo, [...(po.attachments ?? []), `${po.poNo}-附件${(po.attachments ?? []).length + 1}.pdf`])}
            className="rounded-[2px] border border-dashed border-[#C9CDD4] px-2 py-0.5 text-[11px] text-[#86909C] hover:border-[#165DFF] hover:text-[#165DFF]">
            ＋ 上传附件（mock）
          </button>
          <span className="ml-auto text-[10px] text-[#C9CDD4]">合同扫描件 / 到货单 / 验收单；正式环境走对象存储并留痕</span>
        </div>

        <div className="flex items-center gap-0 rounded-[4px] border border-[#E5E6EB] bg-white px-6 py-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  i < cur ? "bg-[#00B42A] text-white" : i === cur ? "bg-[#165DFF] text-white" : "bg-[#F2F3F5] text-[#86909C]"}`}>
                  {i < cur ? "✓" : i + 1}
                </span>
                <span className={`text-xs ${i === cur ? "font-medium text-[#1D2129]" : "text-[#86909C]"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-3 h-px flex-1 ${i < cur ? "bg-[#00B42A]" : "bg-[#E5E6EB]"}`} />}
            </div>
          ))}
        </div>

        <ApprovalStep po={po} />
        {cur >= 1 && <ContractPriceStep po={po} />}
        {(po.status === "已下单" || po.status === "部分到货") && <ReceiptStep po={po} />}
        {cur >= 3 && !po.inboundDone && <InboundStep po={po} />}
        {po.inboundDone && (
          <div className="rounded-[4px] border border-[#00B42A]/30 bg-[#E8F8F2] px-4 py-3 text-xs text-[#00B42A]">
            ✓ 入库完成（{po.inboundAt}）：资源已正式可售，采购流程闭环。{po.resumedWo ? `挂起工单 ${po.resumedWo} 已反向通知恢复开通（P02）。` : ""}
          </div>
        )}
      </main>
    </ArcoShell>
  );
}
