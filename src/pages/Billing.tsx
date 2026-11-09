// P03 客户账单（/billing）：订阅台账 ｜ 账期出账（扫描 → 生成 → 审核 → 发出 → 应收登记）
// 应收账单唯一出生点：审核通过 → 发出即写入收款管理（P03-6 应收登记 → P04）。
import { Fragment, useState } from "react";
import { Link } from "react-router";
import { useBilling, getSubscriptions, getBills, runBillingScan, approveBill, rejectBill, getBillingRules, periodText, type BillStatus, type SubStatus } from "@/data/billing";
import { useSettings } from "@/data/settings";
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BILL_CLS: Record<BillStatus, string> = {
  已生成: "bg-[#F7F8FA] text-[#4E5969]",
  审核中: "bg-[#FFF3E8] text-[#FF7D00]",
  已发出: "bg-[#E8F3FF] text-[#165DFF]",
  已驳回: "bg-[#FFECE8] text-[#F53F3F]",
};
const SUB_CLS: Record<SubStatus, string> = {
  在网: "bg-[#E8F8F2] text-[#00B42A]",
  欠停: "bg-[#FFECE8] text-[#F53F3F]",
  退订: "bg-[#F2F3F5] text-[#86909C]",
};

export default function Billing() {
  useBilling();
  useSettings();
  const [tab, setTab] = useState<"账期出账" | "订阅台账">("账期出账");
  const [kw, setKw] = useState("");
  const [today, setToday] = useState("2026-11-05");
  const [billStatus, setBillStatus] = useState<"全部" | BillStatus>("全部");
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [expand, setExpand] = useState<string | null>(null);
  const [rejectNo, setRejectNo] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const subs = getSubscriptions().filter((s) => !kw || s.subNo.includes(kw) || s.customer.includes(kw) || s.contractNo.includes(kw));
  const bills = getBills().filter((b) =>
    (billStatus === "全部" || b.status === billStatus) &&
    (!kw || b.invNo.includes(kw) || b.customer.includes(kw) || b.contractNo.includes(kw)));
  const pending = getBills().filter((b) => b.status === "审核中").length;

  return (
    <ArcoShell breadcrumb="财务 / 计费与出账">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">计费与出账</span>
            <span className="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">正常账单自动发出 · 例外进人工审核</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["账期出账", "订阅台账"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${tab === t ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {t}{t === "账期出账" && pending > 0 ? `（待审 ${pending}）` : ""}
                </button>
              ))}
            </div>
            <Input className="w-52" placeholder="搜索单号 / 客户 / 合同" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          {tab === "账期出账" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#4E5969]">扫描日</span>
              <Input className="w-32" value={today} onChange={(e) => setToday(e.target.value)} placeholder="2026-11-05" />
              <Button size="sm" onClick={() => {
                const r = runBillingScan(today.trim() || "2026-11-05");
                setScanMsg(`扫描完成：新出账 ${r.created} 张（自动发出 ${r.auto}、例外待审 ${r.review}），跳过 ${r.skipped} 个（未到期 / 已出账 / 已退订）`);
              }}>账期扫描出账</Button>
            </div>
          )}
        </div>

        {scanMsg && <div className="rounded-[4px] border border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2 text-xs text-[#0E42D2]">{scanMsg}</div>}

        {tab === "账期出账" && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#86909C]">状态筛选：</span>
              {(["全部", "审核中", "已发出", "已驳回"] as const).map((s) => (
                <button key={s} onClick={() => setBillStatus(s)}
                  className={`rounded-[2px] px-2 py-0.5 text-[11px] ${billStatus === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{s}</button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-3 py-2">账单号</th><th className="px-3 py-2">账期</th><th className="px-3 py-2">客户 / 合同</th>
                    <th className="px-3 py-2">明细</th><th className="px-3 py-2">金额（元）</th><th className="px-3 py-2">应收日期</th><th className="px-3 py-2">生成时间</th>
                    <th className="px-3 py-2">审核</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <Fragment key={b.invNo}>
                      <tr className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => setExpand(expand === b.invNo ? null : b.invNo)}>
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{expand === b.invNo ? "▾" : "▸"} {b.invNo}</td>
                        <td className="px-3 py-2.5 text-[#4E5969]">{b.period}</td>
                        <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{b.customer}</div><div className="text-[10px] text-[#86909C]">{b.contractNo}</div></td>
                        <td className="max-w-[220px] truncate px-3 py-2.5 text-[#4E5969]">{b.items.map((i) => i.name).join("；")}</td>
                        <td className="px-3 py-2.5 font-medium">{b.amount.toLocaleString("zh-CN")}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{b.dueDate}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{b.generatedAt}</td>
                        <td className="px-3 py-2.5 text-[#4E5969]">{b.reviewer ? `${b.reviewer}${b.reviewedAt ? ` · ${b.reviewedAt}` : ""}` : "—"}</td>
                        <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${BILL_CLS[b.status]}`}>{b.status}</span>{b.auto && <span className="ml-1 rounded-[2px] bg-[#E8F8F2] px-1 py-0.5 text-[10px] text-[#00B42A]">自动</span>}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="flex justify-end gap-2">
                            {b.status === "审核中" && (
                              <>
                                <button className="text-[#00B42A] hover:underline" onClick={(e) => { e.stopPropagation(); if (approveBill(b.invNo)) alert("失败"); else setScanMsg(`✓ ${b.invNo} 已发出并完成应收登记（应收日期 ${b.dueDate}）；开票标记已生成 → 财务中心 · 开票任务`); }}>通过并发出</button>
                                <button className="text-[#F53F3F] hover:underline" onClick={(e) => { e.stopPropagation(); setRejectNo(b.invNo); }}>驳回</button>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                      {expand === b.invNo && (
                        <tr>
                          <td colSpan={10} className="bg-[#FBFBFC] px-6 py-2.5">
                            <div className="space-y-0.5 text-[11px]">
                              {b.items.map((i, k) => (
                                <div key={k} className="flex gap-2">
                                  <span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${i.feeType === "滞纳金" ? "bg-[#FFF3E8] text-[#FF7D00]" : "bg-[#F2F3F5] text-[#4E5969]"}`}>{i.feeType}</span>
                                  <span className="text-[#1D2129]">{i.name}</span>
                                  <span className="text-[#4E5969]">{i.amount.toLocaleString("zh-CN")} 元</span>
                                </div>
                              ))}
                              {b.reviewReason && <div className="text-[#FF7D00]">例外审核原因：{b.reviewReason}</div>}
                              {b.rejectReason && <div className="text-[#F53F3F]">驳回原因：{b.rejectReason}</div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {!bills.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#C9CDD4]">{kw || billStatus !== "全部" ? "无匹配账单" : "暂无账单，点右上角「账期扫描出账」生成"}</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "订阅台账" && (
          <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2">订阅号</th><th className="px-3 py-2">客户 / 合同</th><th className="px-3 py-2">开通对象</th>
                  <th className="px-3 py-2">周期费（元/月）</th><th className="px-3 py-2">激活日（账期锚点）</th><th className="px-3 py-2">当前账期</th><th className="px-3 py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.subNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{s.subNo}</td>
                    <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{s.customer}</div><div className="text-[10px] text-[#86909C]">{s.contractNo}</div></td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{s.line}</td>
                    <td className="px-3 py-2.5">{s.monthlyFee.toLocaleString("zh-CN")}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{s.activatedAt}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{periodText(s, 0).split(" ~ ")[0].slice(5)} 日起按月滚动</td>
                    <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${SUB_CLS[s.status]}`}>{s.status}</span></td>
                  </tr>
                ))}
                {!subs.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-[#C9CDD4]">无匹配订阅</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          <div className="mb-0.5 font-medium text-[#4E5969]">账单从哪里来（P03 口径）</div>
          {getBillingRules().map((r, i) => <div key={i}>{i + 1}. {r}</div>)}
          <div className="mt-1">发出后的账单自动进入 <Link to="/finance?tab=ledger" className="text-[#165DFF] hover:underline">财务中心 · 应收台账</Link>，开票任务、收款核销、催收行动、对账看板均在财务中心完成。</div>
        </div>
      </main>

      {rejectNo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setRejectNo(null)}>
          <div className="w-[420px] rounded-[6px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm font-semibold">驳回账单 {rejectNo}</div>
            <Input placeholder="驳回原因（必填，退回重新计算）" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setRejectNo(null); setRejectReason(""); }}>取消</Button>
              <Button size="sm" variant="destructive" onClick={() => {
                const e = rejectBill(rejectNo, rejectReason);
                if (e) return alert(e);
                setRejectNo(null); setRejectReason("");
              }}>确认驳回</Button>
            </div>
          </div>
        </div>
      )}
    </ArcoShell>
  );
}
