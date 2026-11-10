// 回款认领与核销（/finance/claims）：银行流水池 → 自动认领 → 拆分核销
// 与「收款管理」的区别：那边是「知道对应哪笔账单，按账单登记」；这边是「钱先到账，反查账单」，
// 是真实财务的主路径；确认认领后逐笔走 addPayment 核销，状态/复机/通知全链路复用。
import { useMemo, useState } from "react";
import { Banknote, Landmark, ScanSearch, ChevronDown, ChevronRight } from "lucide-react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BANK_FLOWS, CLAIM_ALLOCS, addBankFlow, allocsOf, autoMatch, claimFlow, useClaims,
  type BankFlow,
} from "@/data/claims";

const fmt = (n: number) => n.toLocaleString("zh-CN");
const FLOW_STATUS: Record<BankFlow["status"], string> = {
  未认领: "bg-[#FFF3E8] text-[#FF7D00]",
  部分认领: "bg-[#E8F3FF] text-[#165DFF]",
  已核销: "bg-[#E8F8F2] text-[#00B42A]",
};

export default function Claims() {
  const cv = useClaims();
  const [adding, setAdding] = useState<Partial<BankFlow> | null>(null);
  const [claiming, setClaiming] = useState<BankFlow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const kpis = useMemo(() => {
    const un = BANK_FLOWS.filter((f) => f.status !== "已核销");
    return {
      unCount: un.length,
      unAmt: un.reduce((s, f) => s + (f.amount - f.claimed), 0),
      doneAmt: BANK_FLOWS.filter((f) => f.status === "已核销").reduce((s, f) => s + f.amount, 0),
      allocCount: CLAIM_ALLOCS.length,
    };
  }, [cv]);

  const saveFlow = () => {
    if (!adding?.payer || !(adding.amount! > 0)) return;
    addBankFlow({ at: adding.at ?? new Date().toISOString().slice(0, 16).replace("T", " "), payer: adding.payer, amount: Number(adding.amount), method: adding.method ?? "银行转账", referenceNo: adding.referenceNo, note: adding.note });
    setAdding(null);
  };

  return (
    <ArcoShell breadcrumb="回款认领">
      <main className="space-y-4 p-6">
        {/* KPI */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "待认领流水", v: `${kpis.unCount} 笔`, sub: `剩余可认领 ¥${fmt(kpis.unAmt)}`, color: "#FF7D00", icon: Landmark },
            { k: "累计已核销", v: `¥${fmt(kpis.doneAmt)}`, sub: "认领金额与流水等额即核销完成", color: "#00B42A", icon: Banknote },
            { k: "认领分配", v: `${kpis.allocCount} 笔`, sub: "一笔流水可拆多笔账单，逐笔留痕", color: "#165DFF", icon: ScanSearch },
          ].map((c) => (
            <div key={c.k} className="flex items-center gap-3 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[6px]" style={{ background: `${c.color}14`, color: c.color }}><c.icon size={17} /></span>
              <div>
                <div className="text-[11px] text-[#86909C]">{c.k}</div>
                <div className="font-mono text-[16px] font-semibold text-[#1D2129]">{c.v}</div>
                <div className="text-[10px] text-[#C9CDD4]">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">银行流水池</span>
            <span className="text-[11px] text-[#86909C]">按到账时间倒序 · 点击行展开认领明细</span>
          </div>
          <Button size="sm" onClick={() => { setErr(null); setAdding({ payer: "", amount: 0, method: "银行转账", referenceNo: "", at: "", note: "" }); }}>
            <Banknote size={13} className="mr-1" /> 登记流水
          </Button>
        </div>

        {/* 流水表 */}
        <div className="overflow-hidden rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2 w-8" />
                <th className="px-3 py-2">流水号</th><th className="px-3 py-2">到账时间</th><th className="px-3 py-2">付款方</th>
                <th className="px-3 py-2 text-right">金额</th><th className="px-3 py-2 text-right">已认领</th>
                <th className="px-3 py-2">方式 / 银行流水号</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {BANK_FLOWS.map((f) => {
                const open = expanded === f.id;
                const allocs = allocsOf(f.id);
                return [
                  <tr key={f.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-3 py-2.5">
                      <button onClick={() => setExpanded(open ? null : f.id)} className="text-[#86909C] hover:text-[#165DFF]">
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[#86909C]">{f.id}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4E5969]">{f.at}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1D2129]">{f.payer}{f.note ? <span className="ml-1 text-[10px] text-[#86909C]">（{f.note}）</span> : null}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">¥{fmt(f.amount)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#4E5969]">¥{fmt(f.claimed)}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{f.method}{f.referenceNo ? ` · ${f.referenceNo}` : ""}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${FLOW_STATUS[f.status]}`}>{f.status}</span></td>
                    <td className="px-3 py-2.5 text-right">
                      {f.status !== "已核销" && (
                        <button onClick={() => { setErr(null); setClaiming(f); }} className="rounded-[2px] bg-[#165DFF] px-2 py-0.5 text-[11px] text-white hover:bg-[#4080FF]">认领 →</button>
                      )}
                    </td>
                  </tr>,
                  open && (
                    <tr key={`${f.id}-detail`} className="border-b bg-[#FAFBFC] last:border-0">
                      <td colSpan={9} className="px-8 py-3">
                        {allocs.length ? (
                          <div>
                            <div className="mb-1.5 text-[11px] font-semibold text-[#4E5969]">认领明细（{allocs.length} 笔）</div>
                            <table className="w-full">
                              <thead><tr className="text-left text-[10px] text-[#86909C]"><th className="py-1 pr-4">分配单号</th><th className="py-1 pr-4">账单</th><th className="py-1 pr-4">客户</th><th className="py-1 pr-4 text-right">认领金额</th><th className="py-1 pr-4">收款登记单</th><th className="py-1">认领时间</th></tr></thead>
                              <tbody>
                                {allocs.map((a) => (
                                  <tr key={a.id} className="border-t border-[#F2F3F5] text-[11px] text-[#4E5969]">
                                    <td className="py-1.5 pr-4 font-mono">{a.id}</td>
                                    <td className="py-1.5 pr-4 font-mono">{a.invNo}</td>
                                    <td className="py-1.5 pr-4">{a.customer}</td>
                                    <td className="py-1.5 pr-4 text-right font-mono">¥{fmt(a.amount)}</td>
                                    <td className="py-1.5 pr-4 font-mono">{a.payNo}</td>
                                    <td className="py-1.5 font-mono">{a.at}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#86909C]">暂无认领记录{f.status === "未认领" ? "，点击右侧「认领 →」选择账单核销" : ""}</div>
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          流程：登记流水（网银到账）→ 认领（系统按付款方模糊匹配客户、列出未收讫账单，可拆分/部分认领）→ 逐笔核销
          （复用收款登记链路：账单状态流转、足额自动生成复机工单、消息通知）。「收款管理」页仍保留按账单直接登记的能力，两条路径殊途同归。
        </div>
      </main>

      {/* 登记流水 */}
      {adding && (
        <CenterModal title="登记银行流水" sub="出纳网银到账后录入；登记后即可发起认领" width={520} onClose={() => setAdding(null)}>
          <div className="space-y-3">
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">付款方（账户户名）<span className="text-[#F53F3F]"> *</span></div>
              <Input autoFocus placeholder="如：云启数据科技有限公司" value={adding.payer ?? ""} onChange={(e) => setAdding({ ...adding, payer: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">金额（元）<span className="text-[#F53F3F]"> *</span></div>
                <Input type="number" value={adding.amount || ""} onChange={(e) => setAdding({ ...adding, amount: Number(e.target.value) })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">到账方式</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={adding.method ?? "银行转账"} onChange={(e) => setAdding({ ...adding, method: e.target.value as BankFlow["method"] })}>
                  {["银行转账", "承兑汇票", "现金", "其他"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">银行流水号</div>
                <Input placeholder="网银流水 / 回单号" value={adding.referenceNo ?? ""} onChange={(e) => setAdding({ ...adding, referenceNo: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">到账时间</div>
                <Input placeholder="留空 = 当前时间" value={adding.at ?? ""} onChange={(e) => setAdding({ ...adding, at: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">备注</div>
              <Input placeholder="附言 / 账期说明" value={adding.note ?? ""} onChange={(e) => setAdding({ ...adding, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setAdding(null)}>取消</Button>
              <Button size="sm" onClick={saveFlow}>登记</Button>
            </div>
          </div>
        </CenterModal>
      )}

      {/* 认领弹窗 */}
      {claiming && <ClaimModal flow={claiming} onErr={setErr} err={err} onClose={() => setClaiming(null)} />}
    </ArcoShell>
  );
}

function ClaimModal({ flow, err, onErr, onClose }: { flow: BankFlow; err: string | null; onErr: (e: string | null) => void; onClose: () => void }) {
  const [rows, setRows] = useState<{ invNo: string; customer: string; balance: number; dueDate: string; amount: number; checked: boolean }[]>([]);
  const remain = flow.amount - flow.claimed;

  const doMatch = () => {
    const hits = autoMatch(flow.id);
    onErr(hits.length ? null : "没有匹配到客户：付款方与客户名称差异较大时可到「收款管理」按账单直接登记");
    setRows(hits.map((h) => ({ ...h, amount: h.balance, checked: false })));
  };

  const total = rows.filter((r) => r.checked).reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const submit = () => {
    const allocs = rows.filter((r) => r.checked && Number(r.amount) > 0).map((r) => ({ invNo: r.invNo, amount: Number(r.amount) }));
    const e2 = claimFlow(flow.id, allocs);
    if (e2) { onErr(e2); return; }
    onClose();
  };

  return (
    <CenterModal title={`认领流水 · ${flow.id}`} sub={`${flow.payer} · ¥${fmt(flow.amount)} · 剩余可认领 ¥${fmt(remain)}`} width={720} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={doMatch}><ScanSearch size={13} className="mr-1" /> 自动匹配账单</Button>
          <span className="text-[11px] text-[#86909C]">按付款方匹配客户，列出其未收讫账单（金额可改 = 拆分/部分认领）</span>
        </div>
        {rows.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-[4px] border border-[#E5E6EB]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2 w-8" /><th className="px-3 py-2">账单号</th><th className="px-3 py-2">客户</th>
                  <th className="px-3 py-2">应收日期</th><th className="px-3 py-2 text-right">未收余额</th><th className="px-3 py-2 text-right">认领金额</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.invNo} className={`border-b last:border-0 ${r.checked ? "bg-[#F0F5FF]" : ""}`}>
                    <td className="px-3 py-2"><input type="checkbox" className="accent-[#165DFF]" checked={r.checked} onChange={(e) => setRows((rs) => rs.map((x) => (x.invNo === r.invNo ? { ...x, checked: e.target.checked } : x)))} /></td>
                    <td className="px-3 py-2 font-mono">{r.invNo}</td>
                    <td className="px-3 py-2">{r.customer}</td>
                    <td className="px-3 py-2 font-mono text-[#4E5969]">{r.dueDate}</td>
                    <td className="px-3 py-2 text-right font-mono">¥{fmt(r.balance)}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" disabled={!r.checked} value={r.amount || ""} onChange={(e) => setRows((rs) => rs.map((x) => (x.invNo === r.invNo ? { ...x, amount: Number(e.target.value) } : x)))}
                        className="w-28 rounded-[2px] border border-[#E5E6EB] px-2 py-1 text-right font-mono disabled:bg-[#F7F8FA]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-3 py-2 text-[11px] text-[#F53F3F]">{err}</div>}
        <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          <span className="text-[12px] text-[#4E5969]">已选认领合计 <span className={`font-mono font-semibold ${total > remain ? "text-[#F53F3F]" : "text-[#165DFF]"}`}>¥{fmt(total)}</span>
            <span className="text-[#86909C]"> / 剩余 ¥{fmt(remain)}</span></span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" disabled={!total || total > remain} onClick={submit}>确认认领并核销</Button>
          </div>
        </div>
      </div>
    </CenterModal>
  );
}
