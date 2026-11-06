// P05 订阅变更 / P06 退订与资源回收（/lifecycle）
// 变更：申请 → 审批 → 生效（订阅行/月租更新，次账期按新价出账）；退订：申请 → 审批 → 生效（停止出账）→ 资源回收单执行
import { Fragment, useState } from "react";
import { Link } from "react-router";
import { useLifecycle, getChanges, getTerminates, getRecovers, submitChange, approveChange, rejectChange, submitTerminate, approveTerminate, rejectTerminate, executeRecover, penaltyReference, LIFECYCLE_RULES, type ChangeStatus, type ChangeType } from "@/data/lifecycle";
import { getSubscriptions, getBills, useBilling, type Subscription } from "@/data/billing";
import { getInvoices, useReceivables } from "@/data/receivables";
import { CONTRACTS } from "@/data/contracts";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { RegionCascader } from "@/components/RegionCascader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CH_CLS: Record<ChangeStatus, string> = { 审批中: "bg-[#FFF3E8] text-[#FF7D00]", 已生效: "bg-[#E8F8F2] text-[#00B42A]", 已驳回: "bg-[#FFECE8] text-[#F53F3F]" };
const TM_CLS: Record<string, string> = { 审批中: "bg-[#FFF3E8] text-[#FF7D00]", 退订生效: "bg-[#F2F3F5] text-[#86909C]", 已驳回: "bg-[#FFECE8] text-[#F53F3F]" };
const RC_CLS: Record<string, string> = { 待执行: "bg-[#E8F3FF] text-[#165DFF]", 已完工: "bg-[#E8F8F2] text-[#00B42A]" };

const SUB_CLS: Record<Subscription["status"], string> = {
  在网: "bg-[#E8F8F2] text-[#00B42A]", 欠停: "bg-[#FFECE8] text-[#F53F3F]", 退订: "bg-[#F2F3F5] text-[#86909C]",
};

export default function Lifecycle() {
  useLifecycle();
  useBilling();
  useReceivables();
  const [tab, setTab] = useState<"订阅变更" | "退订与回收">("订阅变更");
  const [kw, setKw] = useState("");
  const [chStatus, setChStatus] = useState<"全部" | ChangeStatus>("全部");
  const [showChange, setShowChange] = useState(false);
  const [showTerm, setShowTerm] = useState(false);
  const [reject, setReject] = useState<{ kind: "ch" | "tm"; no: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [recoverNote, setRecoverNote] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expand, setExpand] = useState<string | null>(null);
  const [approveTm, setApproveTm] = useState<string | null>(null);
  const [finalPenalty, setFinalPenalty] = useState("");

  const subs = getSubscriptions();
  const changes = getChanges().filter((o) => (chStatus === "全部" || o.status === chStatus) && (!kw || o.chNo.includes(kw) || o.customer.includes(kw) || o.subNo.includes(kw)));
  const terms = getTerminates().filter((o) => !kw || o.tmNo.includes(kw) || o.customer.includes(kw) || o.subNo.includes(kw));
  const recovers = getRecovers().filter((r) => !kw || r.rcNo.includes(kw) || r.customer.includes(kw));
  const pending = getChanges().filter((o) => o.status === "审批中").length + getTerminates().filter((o) => o.status === "审批中").length;

  return (
    <ArcoShell breadcrumb="客户生命周期 / 变更与退订">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">变更与退订</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["订阅变更", "退订与回收"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${tab === t ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {t}{pending > 0 ? `（待审 ${pending}）` : ""}
                </button>
              ))}
            </div>
            <Input className="w-52" placeholder="搜索单号 / 客户 / 订阅" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          {tab === "订阅变更"
            ? <Button size="sm" onClick={() => setShowChange(true)}>新建变更单</Button>
            : <Button size="sm" onClick={() => setShowTerm(true)}>新建退订单</Button>}
        </div>

        {/* 订阅现状速览（申请时的选择依据） */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white">
          <div className="border-b px-4 py-2 text-xs font-semibold text-[#1D2129]">订阅现状（仅「在网」可变更 / 退订）</div>
          <div className="flex flex-wrap gap-2 px-4 py-2.5">
            {subs.map((s) => (
              <span key={s.subNo} className="flex items-center gap-1.5 rounded-[2px] border border-[#E5E6EB] px-2 py-1 text-[11px] text-[#4E5969]">
                {s.customer} · {s.line}
                <span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${SUB_CLS[s.status]}`}>{s.status}</span>
              </span>
            ))}
          </div>
        </div>

        {tab === "订阅变更" && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#86909C]">状态筛选：</span>
              {(["全部", "审批中", "已生效", "已驳回"] as const).map((s) => (
                <button key={s} onClick={() => setChStatus(s)}
                  className={`rounded-[2px] px-2 py-0.5 text-[11px] ${chStatus === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{s}</button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-3 py-2">变更单号</th><th className="px-3 py-2">客户 / 订阅</th><th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">变更内容</th><th className="px-3 py-2 text-right">生效后月租</th><th className="px-3 py-2 text-right">月成本影响</th><th className="px-3 py-2">生效账期</th>
                    <th className="px-3 py-2">申请原因</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((o) => (
                    <Fragment key={o.chNo}>
                      <tr className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => setExpand(expand === o.chNo ? null : o.chNo)}>
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{expand === o.chNo ? "▾" : "▸"} {o.chNo}</td>
                        <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{o.customer}</div><div className="text-[10px] text-[#86909C]">{o.subNo}</div></td>
                        <td className="px-3 py-2.5 text-[#4E5969]">{o.type}</td>
                        <td className="px-3 py-2.5 text-[#4E5969]">{o.from} <span className="text-[#C9CDD4]">→</span> <span className="text-[#1D2129]">{o.to}</span></td>
                        <td className="px-3 py-2.5 text-right font-mono">{o.monthlyFeeAfter.toLocaleString("zh-CN")} 元/月</td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {o.costEst.deltaMonthly > 0 && <span className="text-[#F53F3F]">+{o.costEst.deltaMonthly.toLocaleString("zh-CN")} 元</span>}
                          {o.costEst.deltaMonthly < 0 && <span className="text-[#00B42A]">{o.costEst.deltaMonthly.toLocaleString("zh-CN")} 元</span>}
                          {o.costEst.deltaMonthly === 0 && o.costEst.onceOff > 0 && <span className="text-[#FF7D00]">一次性 {o.costEst.onceOff.toLocaleString("zh-CN")} 元</span>}
                          {o.costEst.deltaMonthly === 0 && o.costEst.onceOff === 0 && "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{o.effective}</td>
                        <td className="max-w-[180px] truncate px-3 py-2.5 text-[#86909C]" title={o.reason}>{o.reason}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${CH_CLS[o.status]}`}>{o.status}</span>
                          {o.reviewNote && <div className="mt-0.5 text-[10px] text-[#F53F3F]">{o.reviewNote}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {o.status === "审批中" && (
                            <span className="flex justify-end gap-2">
                              <button className="text-[#00B42A] hover:underline" onClick={(e) => { e.stopPropagation(); const e2 = approveChange(o.chNo); if (e2) alert(e2); }}>通过并生效</button>
                              <button className="text-[#F53F3F] hover:underline" onClick={(e) => { e.stopPropagation(); setReject({ kind: "ch", no: o.chNo }); setRejectNote(""); }}>驳回</button>
                            </span>
                          )}
                        </td>
                      </tr>
                      {expand === o.chNo && (
                        <tr>
                          <td colSpan={10} className="bg-[#FBFBFC] px-6 py-2.5">
                            <div className="space-y-0.5 text-[11px]">
                              <div className="mb-0.5 font-medium text-[#4E5969]">变更测算（增量成本，审批依据）</div>
                              {o.costEst.items.map((i, k) => (
                                <div key={k} className="flex gap-2">
                                  <span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${i.deltaMonthly > 0 ? "bg-[#FFECE8] text-[#F53F3F]" : i.deltaMonthly < 0 ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#4E5969]"}`}>
                                    {i.deltaMonthly > 0 ? `+${i.deltaMonthly.toLocaleString("zh-CN")}` : i.deltaMonthly < 0 ? i.deltaMonthly.toLocaleString("zh-CN") : `一次性 ${(i.onceOff ?? 0).toLocaleString("zh-CN")}`} 元
                                  </span>
                                  <span className="text-[#1D2129]">{i.name}</span>
                                </div>
                              ))}
                              <div className="pt-0.5 text-[10px] text-[#86909C]">{o.costEst.basis}；月结以实际账单为准</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {!changes.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#C9CDD4]">无匹配变更单</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "退订与回收" && (
          <>
            <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
              <div className="border-b px-4 py-2 text-xs font-semibold text-[#1D2129]">退订单</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-3 py-2">退订单号</th><th className="px-3 py-2">客户 / 订阅</th><th className="px-3 py-2">退订原因</th>
                    <th className="px-3 py-2">生效账期</th><th className="px-3 py-2 text-right">违约金</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">回收单</th><th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((o) => (
                    <tr key={o.tmNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{o.tmNo}</td>
                      <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{o.customer}</div><div className="text-[10px] text-[#86909C]">{o.subNo}</div></td>
                      <td className="px-3 py-2.5 text-[#4E5969]">{o.reason}{o.reasonText ? `（${o.reasonText}）` : ""}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{o.effectivePeriod} 起停止出账</td>
                      <td className="px-3 py-2.5 text-right font-mono" title={o.penaltyBasis}>
                        {o.penalty > 0
                          ? <span className="text-[#FF7D00]">{o.penalty.toLocaleString("zh-CN")} 元{o.penaltyInvNo ? <span className="ml-1 text-[10px] text-[#86909C]">{o.penaltyInvNo}</span> : ""}</span>
                          : <span className="text-[#C9CDD4]">—</span>}
                      </td>
                      <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${TM_CLS[o.status]}`}>{o.status}</span></td>
                      <td className="px-3 py-2.5 font-mono text-[#4E5969]">{o.recoverNo ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        {o.status === "审批中" && (
                          <span className="flex justify-end gap-2">
                            <button className="text-[#00B42A] hover:underline" onClick={() => { setApproveTm(o.tmNo); setFinalPenalty(String(o.penalty)); }}>通过并退订</button>
                            <button className="text-[#F53F3F] hover:underline" onClick={() => { setReject({ kind: "tm", no: o.tmNo }); setRejectNote(""); }}>驳回</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!terms.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">无匹配退订单</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
              <div className="border-b px-4 py-2 text-xs font-semibold text-[#1D2129]">资源回收单（退订生效自动生成）</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-3 py-2">回收单号</th><th className="px-3 py-2">客户 / 来源退订单</th><th className="px-3 py-2">回收项</th>
                    <th className="px-3 py-2">状态</th><th className="px-3 py-2">执行留痕</th><th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {recovers.map((r) => (
                    <tr key={r.rcNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{r.rcNo}</td>
                      <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{r.customer}</div><div className="text-[10px] text-[#86909C]">{r.tmNo} · {r.subNo}</div></td>
                      <td className="px-3 py-2.5">
                        {r.items.map((i, k) => (
                          <div key={k} className="flex items-center gap-1.5 text-[#4E5969]">
                            <span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${i.action === "库存回库" ? "bg-[#E8F3FF] text-[#165DFF]" : i.action === "地址释放" ? "bg-[#FFF3E8] text-[#FF7D00]" : "bg-[#F2F3F5] text-[#4E5969]"}`}>{i.action}</span>
                            {i.name}
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${RC_CLS[r.status]}`}>{r.status}</span></td>
                      <td className="px-3 py-2.5 text-[#86909C]">{r.executedAt ? `${r.executedAt}${r.note ? ` · ${r.note}` : ""}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        {r.status === "待执行" && <button className="text-[#165DFF] hover:underline" onClick={() => { setRecoverNote(r.rcNo); setNote(""); }}>执行回收</button>}
                      </td>
                    </tr>
                  ))}
                  {!recovers.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-[#C9CDD4]">暂无回收单</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          <div className="mb-0.5 font-medium text-[#4E5969]">变更与退订口径（P05 / P06）</div>
          {LIFECYCLE_RULES.map((r, i) => <div key={i}>{i + 1}. {r}</div>)}
          <div className="mt-1">退订生效后该订阅在 <Link to="/billing" className="text-[#165DFF] hover:underline">客户账单</Link> 的账期扫描中自动跳过；逾期与坏账处置见 <Link to="/finance/overdue" className="text-[#165DFF] hover:underline">欠费与坏账</Link>。</div>
        </div>
      </main>

      {showChange && <ChangeModal onClose={() => setShowChange(false)} />}
      {showTerm && <TermModal onClose={() => setShowTerm(false)} />}
      {reject && (
        <CenterModal title={`驳回${reject.kind === "ch" ? "变更单" : "退订单"} ${reject.no}`} width={420} onClose={() => setReject(null)}>
          <Input placeholder="驳回原因（必填）" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setReject(null)}>取消</Button>
            <Button size="sm" variant="destructive" onClick={() => {
              const e = reject.kind === "ch" ? rejectChange(reject.no, rejectNote) : rejectTerminate(reject.no, rejectNote);
              if (e) return alert(e);
              setReject(null);
            }}>确认驳回</Button>
          </div>
        </CenterModal>
      )}
      {approveTm && (
        <CenterModal title={`审批退订单 ${approveTm}`} sub="违约金一事一议：申请金额仅供参考，请审批确定最终金额（0 = 免收）；金额 > 0 时按此金额生成账单收取" width={460} onClose={() => setApproveTm(null)}>
          <div className="space-y-2 text-xs">
            <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[10px] leading-4 text-[#86909C]">
              {getTerminates().find((t) => t.tmNo === approveTm)?.penaltyBasis ?? ""}
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">审批确定违约金（元）</div>
              <Input value={finalPenalty} onChange={(e) => setFinalPenalty(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button size="sm" variant="outline" onClick={() => setApproveTm(null)}>取消</Button>
              <Button size="sm" onClick={() => {
                const e = approveTerminate(approveTm, Number(finalPenalty));
                if (e) return alert(e);
                setApproveTm(null);
              }}>确认通过 → 退订生效</Button>
            </div>
          </div>
        </CenterModal>
      )}
      {recoverNote && (
        <CenterModal title={`执行回收 ${recoverNote}`} sub="CPE 回库（R4 库存 +1）、地址释放、配置清除一并完成并留痕" width={420} onClose={() => setRecoverNote(null)}>
          <Input placeholder="执行说明（可选，如设备序列号、端口占用情况）" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setRecoverNote(null)}>取消</Button>
            <Button size="sm" onClick={() => { const e = executeRecover(recoverNote, note); if (e) alert(e); setRecoverNote(null); }}>确认执行</Button>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}

// ---------- 新建变更单 ----------
function ChangeModal({ onClose }: { onClose: () => void }) {
  const [subNo, setSubNo] = useState("");
  const [type, setType] = useState<ChangeType>("带宽升级");
  const [to, setTo] = useState("");
  const [fee, setFee] = useState("");
  const [effective, setEffective] = useState("2026-12");
  const [reason, setReason] = useState("");
  const sub = getSubscriptions().find((s) => s.subNo === subNo);
  const options = getSubscriptions().filter((s) => s.status === "在网");

  const submit = () => {
    if (!sub) return alert("请选择订阅（仅「在网」可选）");
    if (!to.trim()) return alert("请填写变更后的内容");
    const e = submitChange({
      subNo: sub.subNo, customer: sub.customer, contractNo: sub.contractNo, type,
      from: `${sub.line}（${sub.monthlyFee.toLocaleString("zh-CN")} 元/月）`, to,
      monthlyFeeAfter: Number(fee) || sub.monthlyFee, effective: effective.trim(), reason: reason || "（未填写）",
    });
    if (e) return alert(e);
    onClose();
  };

  return (
    <CenterModal title="新建变更单" sub="仅「在网」订阅可变更；审批通过后订阅行与月租即时更新，生效账期起按新价出账" width={520} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">订阅 <span className="text-[#F53F3F]">*</span><span className="ml-1 text-[10px] text-[#86909C]">（输入客户名 / 开通对象 / 单号搜索，仅「在网」可选）</span></div>
          <SearchSelect value={subNo} onChange={setSubNo} options={options} placeholder="搜索并选择订阅" badge="在网" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">变更类型 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={type} onChange={(e) => { setType(e.target.value as ChangeType); setTo(""); }}>
              {(["套餐变更", "带宽升级", "带宽降级", "增加 IP", "减少 IP", "地址迁移"] as const).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">生效账期 <span className="text-[#F53F3F]">*</span></div>
            <Input value={effective} onChange={(e) => setEffective(e.target.value)} placeholder="2026-12" />
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">变更后内容 <span className="text-[#F53F3F]">*</span></div>
          <ChangeToField type={type} sub={sub ?? null} to={to} setTo={setTo} />
          {sub && <div className="mt-0.5 text-[10px] text-[#86909C]">当前：{sub.line}（{sub.monthlyFee.toLocaleString("zh-CN")} 元/月）</div>}
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">生效后月租（元/月）<span className="text-[#F53F3F]"> *</span></div>
          <Input value={fee} onChange={(e) => setFee(e.target.value)} placeholder={sub ? String(sub.monthlyFee) : "如 68000"} />
          <div className="mt-0.5 text-[10px] text-[#86909C]">提交后系统按变更类型自动测算增量成本（审批依据，展开单号行可见明细与口径）</div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">申请原因</div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="客户诉求 / 业务背景" />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={submit}>提交（走审批）</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 新建退订单 ----------
function TermModal({ onClose }: { onClose: () => void }) {
  const [subNo, setSubNo] = useState("");
  const [reason, setReason] = useState<"客户申请" | "合同到期" | "欠费坏账" | "其他">("客户申请");
  const [reasonText, setReasonText] = useState("");
  const [effective, setEffective] = useState("2026-12");
  const [penalty, setPenalty] = useState("");
  const sub = getSubscriptions().find((s) => s.subNo === subNo);
  const options = getSubscriptions().filter((s) => s.status !== "退订");
  const ref = sub && effective ? penaltyReference(sub.subNo, reason, effective.trim()) : { penalty: 0, basis: "" };

  const submit = () => {
    if (!sub) return alert("请选择订阅");
    const e = submitTerminate({
      subNo: sub.subNo, customer: sub.customer, contractNo: sub.contractNo,
      reason, reasonText: reasonText || undefined, effectivePeriod: effective.trim(),
      penalty: penalty.trim() === "" ? ref.penalty : Number(penalty), penaltyBasis: ref.basis,
    });
    if (e) return alert(e);
    onClose();
  };

  return (
    <CenterModal title="新建退订单" sub="审批通过后订阅=退订，自生效账期起停止出账，并自动生成资源回收单" width={520} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">订阅 <span className="text-[#F53F3F]">*</span><span className="ml-1 text-[10px] text-[#86909C]">（输入客户名 / 开通对象 / 单号搜索）</span></div>
          <SearchSelect value={subNo} onChange={setSubNo} options={options} placeholder="搜索并选择订阅" />
        </div>
        {sub && <OrderContextPanel sub={sub} effective={effective.trim()} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">退订原因 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              {(["客户申请", "合同到期", "欠费坏账", "其他"] as const).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">生效账期 <span className="text-[#F53F3F]">*</span></div>
            <Input value={effective} onChange={(e) => setEffective(e.target.value)} placeholder="2026-12" />
          </div>
        </div>
        {reason === "其他" && (
          <div>
            <div className="mb-0.5 text-[#4E5969]">原因说明 <span className="text-[#F53F3F]">*</span></div>
            <Input value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
          </div>
        )}
        <div>
          <div className="mb-0.5 text-[#4E5969]">违约金申请金额（元）<span className="ml-1 text-[10px] text-[#86909C]">（一事一议，留空按参考值；最终金额由审批确定）</span></div>
          <Input value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder={ref.penalty > 0 ? `参考值 ${ref.penalty.toLocaleString("zh-CN")}` : "0（免收）"} />
        </div>
        {sub && (
          <div className={`rounded-[2px] px-3 py-2 text-[10px] leading-4 ${ref.penalty > 0 ? "bg-[#FFF3E8] text-[#B25E00]" : "bg-[#F7F8FA] text-[#86909C]"}`}>
            <div className="mt-0.5">{ref.basis}</div>
            <div className="mt-0.5">退订后：订阅状态=退订，{effective} 起账期扫描跳过出账；之前的欠费账单不受影响，照常催收。</div>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={submit}>提交（走审批）</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 可搜索订阅选择器（输入过滤 + 下拉点选） ----------
function SearchSelect({ value, onChange, options, placeholder, badge }: { value: string; onChange: (v: string) => void; options: Subscription[]; placeholder: string; badge?: string }) {
  const [kw, setKw] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((s) => s.subNo === value);
  const filtered = options.filter((s) => !kw || s.customer.includes(kw) || s.subNo.includes(kw) || s.line.includes(kw));

  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 rounded-[2px] border border-[#165DFF] bg-[#F7FAFF] px-2 py-1.5 text-sm">
        <span className="text-[#1D2129]">{selected.customer} · {selected.line}</span>
        <span className="text-[10px] text-[#86909C]">{selected.subNo} · {selected.monthlyFee.toLocaleString("zh-CN")} 元/月</span>
        <button className="ml-auto text-xs text-[#165DFF] hover:underline" onClick={() => { setOpen(true); setKw(""); }}>更换</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} onFocus={() => setOpen(true)} placeholder={placeholder} />
      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-[2px] border border-[#E5E6EB] bg-white shadow-md">
          {filtered.map((s) => (
            <button key={s.subNo} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[#F7FAFF]"
              onClick={() => { onChange(s.subNo); setOpen(false); setKw(""); }}>
              <span className="font-medium text-[#1D2129]">{s.customer}</span>
              <span className="text-[#4E5969]">{s.line}</span>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[#86909C]">
                {s.monthlyFee.toLocaleString("zh-CN")} 元/月{s.subNo}
                {badge && <span className="rounded-[2px] bg-[#E8F8F2] px-1 py-0.5 text-[#00B42A]">{badge}</span>}
              </span>
            </button>
          ))}
          {!filtered.length && <div className="px-2.5 py-3 text-center text-[11px] text-[#C9CDD4]">无匹配订阅</div>}
        </div>
      )}
    </div>
  );
}

// ---------- 变更后内容：按变更类型结构化填写（套餐 / 带宽 / IP / 地址） ----------
const PLAN_TYPES = ["BGP 三网互通", "国内精品网", "国际精品网", "OPON", "AI 专线", "D-MAN"];
const BANDWIDTHS = ["50M", "100M", "200M", "500M", "1G", "10G"];

function ChangeToField({ type, sub, to, setTo }: { type: ChangeType; sub: Subscription | null; to: string; setTo: (v: string) => void }) {
  const [plan, setPlan] = useState("");
  const [bw, setBw] = useState("");
  const [ipN, setIpN] = useState("");
  /** 当前开通对象的产品前缀（去带宽部分），如「单线 200M」→「单线」；识别不出则退回手工输入 */
  const base = sub ? sub.line.replace(/[\d.]+\s*G?M.*$/, "").trim() : "";

  if (type === "套餐变更") {
    return (
      <div className="flex gap-2">
        <select className="flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={plan}
          onChange={(e) => { setPlan(e.target.value); setTo([e.target.value, bw].filter(Boolean).join(" ")); }}>
          <option value="">目标产品类型</option>
          {PLAN_TYPES.filter((t) => t !== base).map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="w-28 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={bw}
          onChange={(e) => { setBw(e.target.value); setTo([plan, e.target.value].filter(Boolean).join(" ")); }}>
          <option value="">带宽</option>
          {BANDWIDTHS.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
    );
  }
  if (type === "带宽升级" || type === "带宽降级") {
    if (!base) {
      return <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="如：单线 500M（当前开通对象结构复杂，请手工填写）" />;
    }
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-1.5 text-sm text-[#4E5969]">{base}</span>
        <select className="flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={bw}
          onChange={(e) => { setBw(e.target.value); setTo(`${base} ${e.target.value}`); }}>
          <option value="">目标带宽</option>
          {BANDWIDTHS.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
    );
  }
  if (type === "增加 IP" || type === "减少 IP") {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-1.5 text-sm text-[#4E5969]">绑定 IP</span>
        <Input className="w-24" value={ipN} onChange={(e) => { setIpN(e.target.value); setTo(`绑定 IP ${e.target.value} 个`); }} placeholder="数量" />
        <span className="text-sm text-[#4E5969]">个</span>
        {ipN && <span className="text-[10px] text-[#86909C]">{type === "增加 IP" ? "新增" : "释放后保留"} {ipN} 个</span>}
      </div>
    );
  }
  // 地址迁移：省市区级联 + 机房/楼宇/房间
  return <RegionCascader withDetail detailPlaceholder="机房 / 楼宇 / 房间" value={to} onChange={setTo} />;
}

// ---------- 退订参考：该订阅相关数据（合同 / 账单 / 收款全貌，审批与申请共用） ----------
const CTX_INV_CLS: Record<string, string> = {
  已生成: "bg-[#F7F8FA] text-[#4E5969]", 审核中: "bg-[#FFF3E8] text-[#FF7D00]", 已发出: "bg-[#E8F3FF] text-[#165DFF]",
  已驳回: "bg-[#FFECE8] text-[#F53F3F]", 部分收款: "bg-[#FFF3E8] text-[#FF7D00]", 已收讫: "bg-[#E8F8F2] text-[#00B42A]",
  逾期: "bg-[#FFECE8] text-[#F53F3F]", 欠停: "bg-[#FFECE8] text-[#B3261E]", 坏账: "bg-[#F2F3F5] text-[#86909C]",
};

function OrderContextPanel({ sub, effective }: { sub: Subscription; effective: string }) {
  const contract = CONTRACTS.find((c) => c.id === sub.contractNo);
  // 账单与应收按合同号归集（订阅台账的合同号与主档对齐）
  const bills = getBills().filter((b) => b.contractNo === sub.contractNo);
  const invs = getInvoices().filter((r) => r.contract === sub.contractNo);
  const totalAmount = invs.reduce((s, r) => s + r.amount, 0) + bills.filter((b) => !invs.some((r) => r.invNo === b.invNo)).reduce((s, b) => s + b.amount, 0);
  const totalReceived = invs.reduce((s, r) => s + r.received, 0);
  const unpaid = invs.filter((r) => r.amount - r.received > 0);
  const unpaidTotal = unpaid.reduce((s, r) => s + (r.amount - r.received), 0);
  const overdue = unpaid.filter((r) => r.status === "逾期" || r.status === "欠停");

  return (
    <div className="rounded-[4px] border border-[#E5E6EB] bg-[#FBFBFC] text-xs">
      <div className="border-b px-3 py-1.5 font-medium text-[#4E5969]">该订阅相关数据（审批参考）</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 md:grid-cols-4">
        <div className="flex justify-between"><span className="text-[#86909C]">合同</span><span className="font-mono text-[#1D2129]">{sub.contractNo}</span></div>
        <div className="flex justify-between"><span className="text-[#86909C]">合同期限</span><span className="text-[#1D2129]">{contract ? `${contract.start.slice(0, 7)} ~ ${contract.end.slice(0, 7)}` : "未建档"}</span></div>
        <div className="flex justify-between"><span className="text-[#86909C]">月租</span><span className="text-[#1D2129]">{sub.monthlyFee.toLocaleString("zh-CN")} 元/月</span></div>
        <div className="flex justify-between"><span className="text-[#86909C]">付款方式</span><span className="text-[#1D2129]">{contract?.pay ?? "—"}</span></div>
        <div className="flex justify-between"><span className="text-[#86909C]">应收合计</span><span className="text-[#1D2129]">{totalAmount.toLocaleString("zh-CN")} 元</span></div>
        <div className="flex justify-between"><span className="text-[#86909C]">已收</span><span className="text-[#00B42A]">{totalReceived.toLocaleString("zh-CN")} 元</span></div>
        <div className="flex justify-between"><span className="text-[#86909C]">未收余额</span><span className={unpaidTotal > 0 ? "font-semibold text-[#FF7D00]" : "text-[#1D2129]"}>{unpaidTotal.toLocaleString("zh-CN")} 元</span></div>
        <div className="flex justify-between"><span className="text-[#86909C]">订阅状态</span><span className="text-[#1D2129]">{sub.status}</span></div>
      </div>
      {unpaid.length > 0 && (
        <div className="border-t px-3 py-2">
          <div className={`mb-1 text-[11px] ${overdue.length ? "font-medium text-[#F53F3F]" : "text-[#4E5969]"}`}>
            未结清账单 {unpaid.length} 张，合计 {unpaidTotal.toLocaleString("zh-CN")} 元{overdue.length > 0 ? `（其中逾期/欠停 ${overdue.length} 张）` : ""}
          </div>
          <div className="max-h-28 space-y-0.5 overflow-auto">
            {unpaid.map((r) => (
              <div key={r.invNo} className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-[#4E5969]">{r.invNo}</span>
                <span className="text-[#86909C]">{r.dueDate.slice(0, 7)}</span>
                <span className="text-[#1D2129]">余额 {(r.amount - r.received).toLocaleString("zh-CN")} 元</span>
                <span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${CTX_INV_CLS[r.status] ?? "bg-[#F2F3F5] text-[#4E5969]"}`}>{r.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-[#86909C]">退订后以上账单不受影响，照常催收；{effective} 起停止出账。</div>
        </div>
      )}
      {unpaid.length === 0 && <div className="border-t px-3 py-1.5 text-[10px] text-[#86909C]">账单已全部结清；{effective} 起停止出账。</div>}
    </div>
  );
}
