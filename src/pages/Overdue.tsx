// P04-3~9 欠费与坏账（/finance/overdue）：欠费账单（扫描/策略/停机触发）｜停机复机工单（执行）｜坏账申请（P10 审批）
import { useState } from "react";
import { Link } from "react-router";
import { useReceivables, getInvoices, getTickets, getBadDebtApps, createSuspendTicket, executeTicket, runOverdueScan, submitBadDebt, decideBadDebt, overdueDays, invBalance, getOverduePolicy, type SuspendTicket, type BadDebtApp } from "@/data/receivables";
import { useSettings, cfgNum, getCfg } from "@/data/settings";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------- 工单执行单（P04-7/8 表单） ----------
function TicketForm({ t, onClose }: { t: SuspendTicket; onClose: () => void }) {
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const actions = t.type === "停机" ? ["断网", "端口 shutdown", "整机下架"] : ["恢复网络", "端口 no shutdown", "整机上架"];
  return (
    <CenterModal title={`${t.type}工单执行单 · ${t.ticketNo}`} sub={`${t.customer} · ${t.sub} · ${t.debtSummary} · 原因：${t.reason}`} width={520} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">执行动作 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">请选择…</option>
              {actions.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">执行结果 <span className="text-[#F53F3F]">*</span></div>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["成功", "部分成功", "失败"] as const).map((r) => (
                <button key={r} onClick={() => setResult(r)}
                  className={`flex-1 rounded-[2px] px-2 py-1.5 ${result === r ? (r === "成功" ? "bg-[#00B42A] text-white" : "bg-[#FF7D00] text-white") : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        {result && result !== "成功" && (
          <div>
            <div className="mb-0.5 text-[#4E5969]">执行说明 <span className="text-[#F53F3F]">*</span>（结果非成功时必填，失败可重新执行）</div>
            <Input placeholder="如：现场断电无法操作，待物业配合" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        <div className="text-[10px] text-[#86909C]">
          {t.type === "停机" ? "提交成功 → 订阅状态=欠停，停机生效时间写 audit_log；工单超 SLA 未执行升级运维主管。" : "复机仅由收讫触发；提交成功 → 订阅恢复在网。"}
        </div>
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-2 py-1.5 text-[#F53F3F]">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => {
            const e = executeTicket(t.ticketNo, { action, result, note: note || undefined });
            if (e) return setErr(e);
            onClose();
          }}>提交执行结果</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 坏账申请（P04-9） ----------
function BadDebtForm({ onClose }: { onClose: () => void }) {
  const eligible = getInvoices().filter((i) => overdueDays(i) >= cfgNum("overdue.badDebtDays") || i.status === "逾期" || i.status === "欠停");
  const [invNos, setInvNos] = useState<string[]>([]);
  const [collectRecord, setCollectRecord] = useState("");
  const [reason, setReason] = useState<BadDebtApp["reason"]>("客户失联");
  const [reasonText, setReasonText] = useState("");
  const [handling, setHandling] = useState<BadDebtApp["handling"]>("核销坏账");
  const [err, setErr] = useState<string | null>(null);
  const total = invNos.reduce((s, no) => s + invBalance(getInvoices().find((i) => i.invNo === no)!), 0);
  const save = () => {
    const customer = invNos.length ? getInvoices().find((i) => i.invNo === invNos[0])!.customer : "";
    const e = submitBadDebt({ customer, invNos, total, collectRecord, reason, reasonText: reasonText || undefined, handling });
    if (e) return setErr(e);
    onClose();
  };
  return (
    <CenterModal title="坏账申请" sub={`仅逾期账单可选（当前门槛：逾期 ≥ ${cfgNum("overdue.badDebtDays")} 天，可在 A5 策略中心配置）；提交走 P10 审批（默认链：财务主管 + 管理层）`} width={560} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">逾期账单（可多选）<span className="text-[#F53F3F]"> *</span></div>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-[2px] border border-[#E5E6EB] p-2">
            {eligible.map((i) => (
              <label key={i.invNo} className="flex items-center gap-2">
                <input type="checkbox" checked={invNos.includes(i.invNo)}
                  onChange={(e) => setInvNos((s) => e.target.checked ? [...s, i.invNo] : s.filter((x) => x !== i.invNo))} />
                <span className="font-mono">{i.invNo}</span>
                <span>{i.customer}</span>
                <span className="text-[#FF7D00]">{invBalance(i).toLocaleString("zh-CN")} 元 · 逾期 {overdueDays(i)} 天</span>
              </label>
            ))}
            {!eligible.length && <div className="text-[#C9CDD4]">当前无逾期账单</div>}
          </div>
          {invNos.length > 0 && <div className="mt-1 text-[11px] text-[#4E5969]">选中 {invNos.length} 张 · 逾期金额合计 <strong className="text-[#1D2129]">{total.toLocaleString("zh-CN")} 元</strong></div>}
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">催收记录 <span className="text-[#F53F3F]">*</span>（≥ 10 字）</div>
          <Input placeholder="催收过程摘要；催收函等走附件" value={collectRecord} onChange={(e) => setCollectRecord(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">坏账原因 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={reason} onChange={(e) => setReason(e.target.value as BadDebtApp["reason"])}>
              {["客户失联", "破产", "拒付", "其他"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">拟处理方式 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={handling} onChange={(e) => setHandling(e.target.value as BadDebtApp["handling"])}>
              <option>核销坏账</option><option>继续挂账观察</option>
            </select>
          </div>
        </div>
        {reason === "其他" && (
          <div>
            <div className="mb-0.5 text-[#4E5969]">原因说明 <span className="text-[#F53F3F]">*</span></div>
            <Input value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
          </div>
        )}
        <div className="rounded-[2px] bg-[#FFF7E8] px-2 py-1.5 text-[10px] leading-4 text-[#4E5969]">
          审批通过 → 选中账单状态=坏账（挂账观察的保持逾期、暂停滞纳金与停机动作）；坏账确认后订阅强制进入 P06 退订流程（自动发起，退订原因=坏账）；后续收回款项可对该账单正常收款登记（坏账状态转回并留痕）。
        </div>
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-2 py-1.5 text-[#F53F3F]">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>提交审批</Button>
        </div>
      </div>
    </CenterModal>
  );
}

export default function Overdue() {
  useReceivables();
  useSettings();
  const [tab, setTab] = useState<"欠费账单" | "停机复机工单" | "坏账申请">("欠费账单");
  const [kw, setKw] = useState("");
  const [aging, setAging] = useState<"全部" | "30天内" | "30-90天" | "90天以上">("全部");
  const [execTicket, setExecTicket] = useState<SuspendTicket | null>(null);
  const [bdForm, setBdForm] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const overdueInvs = getInvoices().filter((i) => {
    if (i.status !== "逾期" && i.status !== "欠停") return false;
    const d = overdueDays(i);
    if (aging === "30天内" && d > 30) return false;
    if (aging === "30-90天" && (d <= 30 || d > 90)) return false;
    if (aging === "90天以上" && d <= 90) return false;
    return !kw || i.invNo.includes(kw) || i.customer.includes(kw);
  });
  const tickets = getTickets().filter((t) => !kw || t.ticketNo.includes(kw) || t.customer.includes(kw));
  const apps = getBadDebtApps().filter((a) => !kw || a.bdNo.includes(kw) || a.customer.includes(kw));
  const pendingTickets = tickets.filter((t) => t.status === "待执行").length;

  return (
    <ArcoShell breadcrumb="财务 / 欠费与坏账">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">欠费与坏账</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["欠费账单", "停机复机工单", "坏账申请"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${tab === t ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {t}{t === "停机复机工单" && pendingTickets > 0 ? `（${pendingTickets}）` : ""}
                </button>
              ))}
            </div>
            <Input className="w-52" placeholder="搜索单号 / 客户" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {tab === "欠费账单" && (
              <Button size="sm" variant="outline" onClick={() => {
                const n = runOverdueScan();
                setScanMsg(n ? `扫描完成：${n} 张账单转为逾期，已按策略生成提醒（客户联系人 + 归属销售 + 财务）` : "扫描完成：无新增逾期账单");
              }}>运行欠费扫描</Button>
            )}
            {tab === "坏账申请" && <Button size="sm" onClick={() => setBdForm(true)}>＋ 坏账申请</Button>}
          </div>
        </div>

        {scanMsg && <div className="rounded-[4px] border border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2 text-xs text-[#0E42D2]">{scanMsg}</div>}

        {tab === "欠费账单" && (
          <>
            <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
              <div className="mb-2 text-[13px] font-semibold text-[#1D2129]">欠费策略（A5 配置）</div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs md:grid-cols-4">
                {getOverduePolicy().map((p) => (
                  <div key={p.rule}>
                    <span className="text-[#4E5969]">{p.rule}：</span>
                    <span className="font-medium text-[#1D2129]">{p.value}</span>
                    <div className="text-[10px] text-[#86909C]">{p.note}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5 border-t border-[#F2F3F5] pt-2">
                <span className="text-[11px] text-[#86909C]">账龄筛选：</span>
                {(["全部", "30天内", "30-90天", "90天以上"] as const).map((a) => (
                  <button key={a} onClick={() => setAging(a)}
                    className={`rounded-[2px] px-2 py-0.5 text-[11px] ${aging === a ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{a}</button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-3 py-2">账单号</th><th className="px-3 py-2">客户</th><th className="px-3 py-2">逾期金额</th>
                    <th className="px-3 py-2">应收日</th><th className="px-3 py-2">逾期天数</th><th className="px-3 py-2">滞纳金估算</th>
                    <th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueInvs.map((i) => {
                    const d = overdueDays(i);
                    const lateRate = cfgNum("overdue.lateFeeRate");
                    const lateFee = Math.round(i.amount * (lateRate / 100) * d);
                    return (
                      <tr key={i.invNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{i.invNo}</td>
                        <td className="px-3 py-2.5 font-medium text-[#1D2129]">{i.customer}</td>
                        <td className="px-3 py-2.5 font-medium text-[#FF7D00]">{invBalance(i).toLocaleString("zh-CN")}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{i.dueDate}</td>
                        <td className="px-3 py-2.5 font-medium text-[#F53F3F]">{d} 天</td>
                        <td className="px-3 py-2.5 text-[#86909C]">{lateFee.toLocaleString("zh-CN")} 元<span className="text-[10px]">（{lateRate}%/日，入下期账单）</span></td>
                        <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${i.status === "欠停" ? "bg-[#FFECE8] text-[#F53F3F]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>{i.status}</span></td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="flex justify-end gap-2">
                            {i.status === "逾期" && (
                              <button className="text-[#F53F3F] hover:underline" onClick={() => { const e = createSuspendTicket(i.invNo); if (e) alert(e); }}>生成停机工单</button>
                            )}
                            <Link to="/finance?tab=pay" className="text-[#165DFF] hover:underline">去收款</Link>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!overdueInvs.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">无欠费账单</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "停机复机工单" && (
          <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2">工单号</th><th className="px-3 py-2">类型</th><th className="px-3 py-2">客户 / 订阅</th>
                  <th className="px-3 py-2">欠费摘要 / 原因</th><th className="px-3 py-2">执行信息</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.ticketNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{t.ticketNo}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${t.type === "停机" ? "bg-[#FFECE8] text-[#F53F3F]" : "bg-[#E8F8F2] text-[#00B42A]"}`}>{t.type}</span></td>
                    <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{t.customer}</div><div className="text-[10px] text-[#86909C]">{t.sub}</div></td>
                    <td className="max-w-[260px] px-3 py-2.5"><div className="text-[#1D2129]">{t.debtSummary}</div><div className="text-[10px] text-[#86909C]">{t.reason}{t.linkedTicket ? ` · 原工单 ${t.linkedTicket}` : ""}</div></td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{t.executedAt ? `${t.action} · ${t.result} · ${t.executedAt}` : "—"}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${t.status === "已完工" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>{t.status}</span></td>
                    <td className="px-3 py-2.5 text-right">
                      {t.status === "待执行" && <button className="text-[#165DFF] hover:underline" onClick={() => setExecTicket(t)}>执行</button>}
                    </td>
                  </tr>
                ))}
                {!tickets.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-[#C9CDD4]">暂无工单</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "坏账申请" && (
          <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2">申请单号</th><th className="px-3 py-2">客户</th><th className="px-3 py-2">账单</th>
                  <th className="px-3 py-2">金额合计</th><th className="px-3 py-2">原因 / 处理方式</th><th className="px-3 py-2">催收记录</th>
                  <th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.bdNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{a.bdNo}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1D2129]">{a.customer}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4E5969]">{a.invNos.join("、")}</td>
                    <td className="px-3 py-2.5">{a.total.toLocaleString("zh-CN")}</td>
                    <td className="px-3 py-2.5"><div className="text-[#1D2129]">{a.reason}{a.reason === "其他" && a.reasonText ? `（${a.reasonText}）` : ""}</div><div className="text-[10px] text-[#86909C]">{a.handling}</div></td>
                    <td className="max-w-[240px] truncate px-3 py-2.5 text-[#4E5969]" title={a.collectRecord}>{a.collectRecord}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${
                        a.status === "已通过" ? "bg-[#E8F8F2] text-[#00B42A]" : a.status === "已驳回" ? "bg-[#FFECE8] text-[#F53F3F]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>{a.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {a.status === "审批中" && (
                        <span className="flex justify-end gap-2">
                          <button className="text-[#00B42A] hover:underline" onClick={() => { if (confirm(`通过坏账申请 ${a.bdNo}？账单转为坏账，订阅强制进入退订流程（P06）。`)) decideBadDebt(a.bdNo, true); }}>通过</button>
                          <button className="text-[#F53F3F] hover:underline" onClick={() => { if (confirm(`驳回坏账申请 ${a.bdNo}？`)) decideBadDebt(a.bdNo, false); }}>驳回</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!apps.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">暂无坏账申请</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 欠费扫描每日定时执行：过应收日且逾期超过宽限期（{cfgNum("overdue.graceDays")} 天，A5 可配）→ 逾期 + 按策略判定（提醒 / 停机）；
          ② 停机条件：逾期 &gt; {cfgNum("overdue.suspendDays")} 天，停机执行后订阅=欠停，
          欠停期间周期费{getCfg("billing.billOnSuspend") === "yes" ? "照常计" : "暂停计"}（A5 可配）；③ 复机仅由足额收讫自动触发，不接受人工手工复机；
          ④ 滞纳金 {getCfg("overdue.lateFeeRate")}%/日按账期入下期账单；⑤ 坏账门槛：逾期 ≥ {cfgNum("overdue.badDebtDays")} 天，审批通过 → 账单=坏账 + 订阅强制退订（P06）；
          后续收回款项可正常收款登记、坏账状态转回留痕。所有参数在 A5 策略中心维护。
        </div>
      </main>
      {execTicket && <TicketForm t={execTicket} onClose={() => setExecTicket(null)} />}
      {bdForm && <BadDebtForm onClose={() => setBdForm(false)} />}
    </ArcoShell>
  );
}
