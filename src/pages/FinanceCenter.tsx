// 财务中心 /finance（2026-11-09 财务中心 v2 · 第一步：应收台账 + 开票任务）
// 设计：以应收账单为唯一主干（AR Ledger），开票是账单行内从属标记，不再拥有独立状态机；
//       所有 KPI / 账龄 / 催收行动由 @/data/finance 统一派生，页面不重算。
// 页签规划：ledger 应收台账 ✅ / invoice 开票任务 ✅ / pay 收款核销（第 3 步）/ collect 催收行动（第 3 步）/ dash 对账看板（第 4 步）。
// 旧版页面保留：/billing、/finance/invoices、/finance/payments、/finance/overdue（顶部有入口提示）。
import { useState, Fragment } from "react";
import { useSearchParams, Link } from "react-router";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { demoNow } from "@/data/settings";
import { getInvoices, getPayments, getCollectRecords, addCollectRecord, invBalance, redFlushPayment, createSuspendTicket, runOverdueScan, type Receivable, type InvStatus, type CollectRecord } from "@/data/receivables";
import { financeKPIs, agingDays, collectStage, collectActions, allCollectItems, salesOf, promiseBroken, promiseOverDays,
  dsoDays, agingBuckets, paidUninvoiced, badDebtRisk, type CollectStage } from "@/data/finance";
import { useInvoiceApps, getInvoiceApps, startInvoicing, redFlushInvoice, type InvoiceApp } from "@/data/invoiceApps";
import { InvoiceEditForm, InvoiceFillForm, InvoicePrintSheet, INV_MARK_CLS, sellerOf } from "@/components/InvoiceOps";
import { PayForm } from "@/components/PayOps";
import { CONTRACTS } from "@/data/contracts";
import { ENTITY_NAME } from "@/data/entities";
import { ChevronDown, ChevronRight } from "lucide-react";

const TABS = [
  { key: "ledger", label: "应收台账" },
  { key: "invoice", label: "开票任务" },
  { key: "pay", label: "收款核销" },
  { key: "collect", label: "催收行动" },
  { key: "dash", label: "对账看板" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_CLS: Record<InvStatus, string> = {
  已发出: "bg-[#E8F3FF] text-[#165DFF]",
  部分收款: "bg-[#FFF3E8] text-[#FF7D00]",
  已收讫: "bg-[#E8F8F2] text-[#00B42A]",
  逾期: "bg-[#FFECE8] text-[#F53F3F]",
  欠停: "bg-[#FFECE8] text-[#F77234]",
  坏账: "bg-[#F2F3F5] text-[#86909C]",
};
const STAGE_CLS: Record<CollectStage, string> = {
  正常: "bg-[#E8F8F2] text-[#00B42A]",
  宽限提醒: "bg-[#FFF3E8] text-[#FF7D00]",
  催收跟进: "bg-[#FFF3E8] text-[#F77234]",
  停机预警: "bg-[#FFECE8] text-[#F53F3F]",
  坏账候选: "bg-[#F2F3F5] text-[#4E5969]",
};
const fmt = (n: number) => n.toLocaleString("zh-CN");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ---------- 行内展开：账单全貌（明细 + 开票 + 收款 + 催收行动） ----------
function InvDetail({ inv }: { inv: Receivable }) {
  const pays = getPayments().filter((p) => p.invNo === inv.invNo);
  const actions = collectActions(inv);
  return (
    <div className="grid grid-cols-2 gap-4 bg-[#F7F8FA] px-4 py-3">
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[10px] font-semibold text-[#86909C]">账单明细</div>
          <div className="rounded-[2px] border border-[#E5E6EB] bg-white text-xs">
            {inv.items.map((it) => (
              <div key={it.name} className="flex justify-between border-b border-[#F2F3F5] px-3 py-1.5 last:border-0">
                <span className="text-[#4E5969]">{it.name}</span><span className="font-medium text-[#1D2129]">{fmt(it.amount)} 元</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold text-[#86909C]">收款记录（{pays.length}）</div>
          <div className="rounded-[2px] border border-[#E5E6EB] bg-white text-xs">
            {!pays.length && <div className="px-3 py-2 text-[#C9CDD4]">暂无收款</div>}
            {pays.map((p) => (
              <div key={p.payNo} className="flex items-center justify-between border-b border-[#F2F3F5] px-3 py-1.5 last:border-0">
                <span className="font-mono text-[#4E5969]">{p.payNo}</span>
                <span className="text-[#86909C]">{p.paidAt} · {p.method}</span>
                <span className="font-medium">{fmt(p.amount)} 元</span>
                <span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${p.status === "已红冲" ? "bg-[#F2F3F5] text-[#86909C]" : "bg-[#E8F8F2] text-[#00B42A]"}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[10px] font-semibold text-[#86909C]">开票标记</div>
          <div className="rounded-[2px] border border-[#E5E6EB] bg-white px-3 py-2 text-xs text-[#4E5969]">
            {!inv.invoice && <span className="text-[#C9CDD4]">未生成开票申请（账单「通过并发出」后自动生成）</span>}
            {inv.invoice && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${INV_MARK_CLS[inv.invoice.status]}`}>{inv.invoice.status}</span>
                  <span className="font-mono font-semibold text-[#165DFF]">{inv.invoice.apNo}</span>
                  <span>{inv.invoice.invType} · {inv.invoice.bizCat} · {inv.invoice.format}</span>
                </div>
                <div>账期 {inv.invoice.periodText}{inv.invoice.invoiceNo ? ` · 发票号 ${inv.invoice.invoiceNo}（${inv.invoice.invoicedAt}）` : ""}</div>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold text-[#86909C]">
            催收行动清单
            <span className={`rounded-[2px] px-1 py-0.5 text-[10px] font-normal ${STAGE_CLS[collectStage(inv)]}`}>{collectStage(inv)}</span>
            {agingDays(inv) > 0 && <span className="font-normal text-[#F53F3F]">逾期 {agingDays(inv)} 天</span>}
            {inv.promiseDate && (
              <span className={`font-normal ${promiseBroken(inv) ? "text-[#F53F3F]" : "text-[#165DFF]"}`}>
                承诺付款日 {inv.promiseDate}{promiseBroken(inv) ? `（已破约 ${promiseOverDays(inv)} 天）` : ""}
              </span>
            )}
          </div>
          <div className="rounded-[2px] border border-[#E5E6EB] bg-white px-3 py-2 text-xs">
            {!actions.length && <span className="text-[#C9CDD4]">暂无待办动作</span>}
            {actions.map((a) => (
              <div key={a.action} className="flex gap-2 border-b border-[#F2F3F5] py-1 last:border-0">
                <span className="w-28 shrink-0 text-[#165DFF]">{a.owner}</span>
                <span className="text-[#4E5969]">{a.action}</span>
              </div>
            ))}
          </div>
          {(() => {
            const records = getCollectRecords().filter((c) => c.invNo === inv.invNo);
            if (!records.length) return null;
            return (
              <div className="mt-2 rounded-[2px] border border-[#E5E6EB] bg-white px-3 py-2 text-xs">
                <div className="mb-1 text-[10px] font-semibold text-[#86909C]">催收跟进留痕（{records.length}）</div>
                {records.slice(0, 3).map((c) => (
                  <div key={c.crNo} className="border-b border-[#F2F3F5] py-1 last:border-0">
                    <div className="flex gap-2 text-[11px]">
                      <span className="font-mono text-[#86909C]">{c.at}</span>
                      <span className="text-[#165DFF]">{c.by}（{c.role}）</span>
                      <span className="text-[#86909C]">{c.channel}</span>
                      {c.promiseDate && <span className="text-[#FF7D00]">承诺 {c.promiseDate}</span>}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-4 text-[#4E5969]">{c.content}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ---------- 开票任务页签（应收台账的开票视角：行内操作，无独立单据） ----------
function InvoiceTab() {
  useInvoiceApps();
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState<"全部" | InvoiceApp["status"]>("全部");
  const [editing, setEditing] = useState<InvoiceApp | null>(null);
  const [filling, setFilling] = useState<InvoiceApp | null>(null);
  const [printing, setPrinting] = useState<InvoiceApp | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const apps = getInvoiceApps().filter((a) =>
    (status === "全部" || a.status === status) &&
    (!kw || a.apNo.includes(kw) || a.invNo.includes(kw) || a.customer.includes(kw) || (a.invoiceNo ?? "").includes(kw)));
  const counts = (["待开票", "开票中", "已开票", "已红冲"] as const).map((s) => ({ s, n: getInvoiceApps().filter((a) => a.status === s).length }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          {(["全部", "待开票", "开票中", "已开票", "已红冲"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-[2px] px-2.5 py-1 text-xs ${status === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
              {s}{s !== "全部" && counts.find((c) => c.s === s)!.n ? `（${counts.find((c) => c.s === s)!.n}）` : ""}
            </button>
          ))}
        </div>
        <Input className="w-56" placeholder="搜索申请单号 / 账单号 / 客户 / 发票号" value={kw} onChange={(e) => setKw(e.target.value)} />
      </div>
      {msg && <div className="rounded-[4px] border border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2 text-xs text-[#0E42D2]">{msg}</div>}
      <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th className="px-3 py-2">账单 / 申请单号</th><th className="px-3 py-2">客户 / 合同</th><th className="px-3 py-2">销方主体</th>
              <th className="px-3 py-2">开票账期</th><th className="px-3 py-2">开票金额</th><th className="px-3 py-2">发票类别 / 业务类别</th>
              <th className="px-3 py-2">发票号 / 开票日期</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.apNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                <td className="px-3 py-2.5"><div className="font-mono font-semibold text-[#165DFF]">{a.apNo}</div><div className="font-mono text-[10px] text-[#86909C]">{a.invNo}</div></td>
                <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{a.customer}</div><div className="text-[10px] text-[#86909C]">{a.contractNo}</div></td>
                <td className="px-3 py-2.5 text-[#4E5969]">{ENTITY_NAME(sellerOf(a.contractNo))}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{a.periodText}</td>
                <td className="px-3 py-2.5 font-medium">{fmt(a.amount)}</td>
                <td className="px-3 py-2.5 text-[#4E5969]"><div>{a.invType}</div><div className="text-[10px] text-[#86909C]">{a.bizCat} · {a.format}</div></td>
                <td className="px-3 py-2.5 font-mono text-[#4E5969]">{a.invoiceNo ? <div>{a.invoiceNo}<div className="text-[10px] text-[#86909C]">{a.invoicedAt}</div></div> : "—"}</td>
                <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${INV_MARK_CLS[a.status]}`}>{a.status}</span></td>
                <td className="px-3 py-2.5 text-right">
                  <span className="flex justify-end gap-2">
                    {(a.status === "待开票" || a.status === "开票中") && (
                      <button className="text-[#165DFF] hover:underline" onClick={() => setPrinting(a)}>登记单</button>
                    )}
                    {a.status === "待开票" && (
                      <>
                        <button className="text-[#165DFF] hover:underline" onClick={() => setEditing(a)}>编辑要素</button>
                        <button className="text-[#00B42A] hover:underline" onClick={() => {
                          const e = startInvoicing(a.apNo);
                          setMsg(e ? `✗ ${e}` : `✓ ${a.apNo} 已登记开票（开票中），业务支撑照「登记单」录金蝶，开完票后回填发票号`);
                        }}>登记开票</button>
                      </>
                    )}
                    {a.status === "开票中" && (
                      <button className="text-[#00B42A] hover:underline" onClick={() => setFilling(a)}>回填发票号</button>
                    )}
                    {a.status === "已开票" && (
                      <button className="text-[#F53F3F] hover:underline" onClick={() => {
                        if (confirm(`标记发票红冲（${a.invoiceNo}）？红冲/作废在金蝶完成，此处仅状态标记；已收款的账单需先走收款红冲审批。`)) {
                          const e = redFlushInvoice(a.apNo);
                          setMsg(e ? `✗ ${e}` : `✓ ${a.apNo} 已标记红冲`);
                        }
                      }}>红冲</button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {!apps.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-[#C9CDD4]">无匹配开票任务（账单「通过并发出」后自动生成开票标记）</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <InvoiceEditForm a={editing} onClose={() => setEditing(null)} />}
      {filling && <InvoiceFillForm a={filling} onClose={() => setFilling(null)} />}
      {printing && <InvoicePrintSheet a={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}

// ---------- 收款核销页签（P04-1/2：登记 → 自动核销 → 红冲留痕） ----------
function PayTab() {
  const [kw, setKw] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const pays = getPayments().filter((p) => !kw || p.payNo.includes(kw) || p.customer.includes(kw) || p.invNo.includes(kw));
  const invOf = (invNo: string) => getInvoices().find((r) => r.invNo === invNo);
  const sellerOfInv = (invNo: string) => {
    const c = CONTRACTS.find((x) => x.id === invOf(invNo)?.contract);
    return c?.entityId ? ENTITY_NAME(c.entityId) : "—";
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-[#1D2129]">收款记录</span>
          <Input className="w-56" placeholder="搜索收款单号 / 账单号 / 客户" value={kw} onChange={(e) => setKw(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => setOpenForm(true)}>＋ 收款登记</Button>
      </div>
      <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th className="px-3 py-2">收款单号</th><th className="px-3 py-2">账单</th><th className="px-3 py-2">客户</th>
              <th className="px-3 py-2">收款主体</th><th className="px-3 py-2">金额（元）</th><th className="px-3 py-2">方式 / 流水号</th>
              <th className="px-3 py-2">收款时间</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {pays.map((p) => (
              <tr key={p.payNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{p.payNo}</td>
                <td className="px-3 py-2.5 font-mono text-[#4E5969]">{p.invNo}</td>
                <td className="px-3 py-2.5 text-[#1D2129]">{p.customer}</td>
                <td className="px-3 py-2.5 text-[#4E5969]">{sellerOfInv(p.invNo)}</td>
                <td className="px-3 py-2.5 font-medium">{fmt(p.amount)}</td>
                <td className="px-3 py-2.5 text-[#4E5969]">{p.method}{p.referenceNo ? ` · ${p.referenceNo}` : ""}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{p.paidAt}</td>
                <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${p.status === "已红冲" ? "bg-[#FFECE8] text-[#F53F3F]" : "bg-[#E8F8F2] text-[#00B42A]"}`}>{p.status}</span></td>
                <td className="px-3 py-2.5 text-right">
                  {p.status === "已登记" && (
                    <button className="text-[#F53F3F] hover:underline" onClick={() => {
                      if (!confirm(`红冲收款 ${p.payNo}（${fmt(p.amount)} 元）？\n正式环境须走「退款/红冲审批」（AP-04）通过后冲正；原型直接演示冲正结果，原单保留「已红冲」痕迹不可删除。`)) return;
                      redFlushPayment(p.payNo);
                    }}>红冲</button>
                  )}
                </td>
              </tr>
            ))}
            {!pays.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-[#C9CDD4]">{kw ? "无匹配收款记录" : "暂无收款记录"}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        ① 收款提交即自动核销：累计已收 = Σ 收款（未冲正），≥ 账单金额 → 已收讫；② 同一张发票允许多笔部分收款，逐笔核销；
        ③ 欠停账单<strong className="text-[#4E5969]">足额收讫自动生成复机工单</strong>；④ 登记错误走红冲审批（AP-04），原单保留「已红冲」痕迹，不可物理删除。
      </div>
      {openForm && <PayForm onClose={() => setOpenForm(false)} />}
    </div>
  );
}

// ---------- 催收行动页签：行内只留关键信息，行动清单与留痕收进展开区 ----------

/** 展开区：左行动清单、右跟进留痕，底部快捷操作 */
function CollectDetail({ inv, onGoPay }: { inv: Receivable; onGoPay: () => void }) {
  const actions = collectActions(inv);
  const records = getCollectRecords().filter((c) => c.invNo === inv.invNo);
  return (
    <div className="bg-[#F7F8FA] px-4 py-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-[10px] font-semibold text-[#86909C]">行动清单（责任人 + 下一步动作）</div>
          <div className="rounded-[2px] border border-[#E5E6EB] bg-white px-3 py-2">
            {!actions.length && <div className="text-xs text-[#C9CDD4]">暂无待办动作</div>}
            {actions.map((a) => (
              <div key={a.action} className="flex gap-2 border-b border-[#F2F3F5] py-1.5 text-xs last:border-0">
                <span className="w-28 shrink-0 font-medium text-[#165DFF]">{a.owner}</span>
                <span className="leading-4 text-[#4E5969]">{a.action}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold text-[#86909C]">跟进留痕（{records.length}）</div>
          <div className="rounded-[2px] border border-[#E5E6EB] bg-white px-3 py-2">
            {!records.length && <div className="text-xs text-[#C9CDD4]">暂无跟进记录，点击「登记跟进」开始留痕</div>}
            {records.map((c) => (
              <div key={c.crNo} className="border-b border-[#F2F3F5] py-1.5 last:border-0">
                <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
                  <span className="font-mono text-[#86909C]">{c.at}</span>
                  <span className="font-medium text-[#165DFF]">{c.by}（{c.role}）</span>
                  <span className="text-[#86909C]">{c.channel}</span>
                  {c.promiseDate && <span className="text-[#FF7D00]">承诺 {c.promiseDate}</span>}
                  {c.nextFollowAt && <span className="text-[#4E5969]">下次跟进 {c.nextFollowAt}</span>}
                </div>
                <div className="mt-0.5 text-[11px] leading-4 text-[#4E5969]">{c.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-xs">
        <span className="text-[10px] font-semibold text-[#86909C]">快捷操作</span>
        <button className="text-[#00B42A] hover:underline" onClick={onGoPay}>去收款</button>
        {inv.status === "逾期" && (
          <button className="text-[#F53F3F] hover:underline" onClick={() => { const e = createSuspendTicket(inv.invNo); if (e) alert(e); }}>生成停机工单</button>
        )}
        <Link to="/finance/overdue" className="text-[#4E5969] hover:underline">欠费与坏账（停机/复机工单、坏账审批）</Link>
      </div>
    </div>
  );
}

// ---------- 登记催收跟进（留痕闭环：约定承诺付款日写回账单，下次跟进日进入待办派生） ----------
/** 表单控件统一样式（对齐基础） */
const CTL = "h-8 w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-xs";
const LBL = "mb-1 text-[11px] text-[#4E5969]";
const REQ = <span className="text-[#F53F3F]"> *</span>;

function CollectRecordForm({ inv, onClose }: { inv: Receivable; onClose: () => void }) {
  const last = getCollectRecords().find((c) => c.invNo === inv.invNo);
  const [by, setBy] = useState("许晟熙");
  const [role, setRole] = useState<CollectRecord["role"]>("业务支撑");
  const [channel, setChannel] = useState<CollectRecord["channel"]>("电话");
  const [content, setContent] = useState("");
  const [promiseDate, setPromiseDate] = useState(inv.promiseDate ?? "");
  const [nextFollowAt, setNextFollowAt] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <CenterModal title={`登记催收跟进 · ${inv.invNo}`} sub={`${inv.customer} · 逾期余额 ${fmt(invBalance(inv))} 元 · 归属销售 ${salesOf(inv.customer)}`} width={600} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] leading-4 text-[#4E5969]">
          上次跟进：{last ? `${last.at} · ${last.by}（${last.role}）· ${last.channel} · ${last.content}${last.promiseDate ? ` · 承诺 ${last.promiseDate}` : ""}` : "暂无跟进记录"}
          {inv.promiseDate && <span className={promiseBroken(inv) ? "text-[#F53F3F]" : "text-[#165DFF]"}>　当前承诺付款日：{inv.promiseDate}{promiseBroken(inv) ? `（已破约 ${promiseOverDays(inv)} 天）` : ""}</span>}
        </div>
        <div className="grid grid-cols-3 gap-x-3">
          <div>
            <div className={LBL}>跟进人{REQ}</div>
            <input className={CTL} value={by} onChange={(e) => setBy(e.target.value)} />
          </div>
          <div>
            <div className={LBL}>身份{REQ}</div>
            <select className={CTL} value={role} onChange={(e) => setRole(e.target.value as CollectRecord["role"])}>
              {["业务支撑", "归属销售", "财务", "技术部"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div className={LBL}>方式{REQ}</div>
            <select className={CTL} value={channel} onChange={(e) => setChannel(e.target.value as CollectRecord["channel"])}>
              {["电话", "微信", "邮件", "上门", "催款函"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className={LBL}>跟进内容{REQ}（客户反馈 / 约定，≥ 5 字）</div>
          <input className={CTL} placeholder="如：客户财务说下周三付款，承诺 11-08 前到账" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <div>
            <div className={LBL}>承诺付款日（可选，写回账单行；破约自动升级催收）</div>
            <input type="date" className={CTL} value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
          </div>
          <div>
            <div className={LBL}>下次跟进日（可选，到期进通知 / 工作台待办）</div>
            <input type="date" className={CTL} value={nextFollowAt} onChange={(e) => setNextFollowAt(e.target.value)} />
          </div>
        </div>
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-2 py-1.5 text-[#F53F3F]">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => {
            const e = addCollectRecord({ invNo: inv.invNo, customer: inv.customer, at: demoNow(), by: by.trim(), role, channel, content, promiseDate: promiseDate || undefined, nextFollowAt: nextFollowAt || undefined });
            if (e) return setErr(e);
            onClose();
          }}>保存跟进</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 催收行动页签：行内只留关键信息，行动清单与留痕收进展开区 ----------
function CollectTab({ onGoPay }: { onGoPay: () => void }) {
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [recording, setRecording] = useState<Receivable | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const items = allCollectItems();
  const byStage = (s: CollectStage) => items.filter((it) => it.stage === s);
  const STAGE_ORDER: CollectStage[] = ["坏账候选", "停机预警", "催收跟进", "宽限提醒"];

  return (
    <div className="space-y-3">
      {/* 页头：阶段总览 + 扫描 */}
      <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-sm font-semibold text-[#1D2129]">催收行动清单</span>
          {STAGE_ORDER.filter((s) => byStage(s).length).map((s) => (
            <span key={s} className={`rounded-[2px] px-2 py-1 text-[11px] ${STAGE_CLS[s]}`}>{s} {byStage(s).length}</span>
          ))}
          {!items.length && <span className="text-[#C9CDD4]">当前无逾期账单</span>}
        </div>
        <Button size="sm" variant="outline" onClick={() => {
          const n = runOverdueScan();
          setScanMsg(n ? `扫描完成：${n} 张账单转为逾期，已按策略生成提醒（客户联系人 + 归属销售 + 财务）` : "扫描完成：无新增逾期账单");
        }}>运行欠费扫描</Button>
      </div>
      {scanMsg && <div className="rounded-[4px] border border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2 text-xs text-[#0E42D2]">{scanMsg}</div>}

      {/* 主表：行内只放关键信息 */}
      <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2">账单号</th>
              <th className="px-3 py-2">客户 / 归属销售</th>
              <th className="px-3 py-2">逾期余额</th>
              <th className="px-3 py-2">应收日 · 逾期</th>
              <th className="px-3 py-2">承诺付款日</th>
              <th className="px-3 py-2">催收阶段</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ inv, stage, days, records }) => (
              <Fragment key={inv.invNo}>
                <tr onClick={() => setExpanded(expanded === inv.invNo ? null : inv.invNo)}
                  className={`cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA] ${expanded === inv.invNo ? "bg-[#F7F8FA]" : ""}`}>
                  <td className="px-2 py-2.5 text-[#86909C]">
                    {expanded === inv.invNo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{inv.invNo}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[#1D2129]">{inv.customer}</div>
                    <div className="text-[10px] text-[#86909C]">{salesOf(inv.customer)} · 已跟进 {records.length} 次</div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[#FF7D00]">{fmt(invBalance(inv))}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{inv.dueDate} · <span className="font-medium text-[#F53F3F]">{days} 天</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {inv.promiseDate ? (
                      <span className={promiseBroken(inv) ? "font-medium text-[#F53F3F]" : "text-[#165DFF]"}>
                        {inv.promiseDate}{promiseBroken(inv) ? `（破约 ${promiseOverDays(inv)} 天）` : ""}
                      </span>
                    ) : <span className="text-[#C9CDD4]">未约定</span>}
                  </td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STAGE_CLS[stage]}`}>{stage}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="text-[#165DFF] hover:underline" onClick={(e) => { e.stopPropagation(); setRecording(inv); }}>登记跟进</button>
                  </td>
                </tr>
                {expanded === inv.invNo && (
                  <tr className="border-b last:border-0">
                    <td colSpan={8} className="p-0">
                      <CollectDetail inv={inv} onGoPay={onGoPay} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!items.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">当前无逾期账单，无需催收</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        行动清单由账龄 + A5 策略中心实时派生，责任人取客户主数据「归属销售」真名；「登记跟进」把催收过程留痕，
        约定的承诺付款日写回账单行——<strong className="text-[#4E5969]">破约自动升级催收阶段</strong>；下次跟进日到期进入通知铃铛与工作台待办。点击行展开行动清单与跟进留痕。
      </div>
      {recording && <CollectRecordForm inv={recording} onClose={() => setRecording(null)} />}
    </div>
  );
}

// ---------- 对账看板页签（五大指标 + 账龄结构 + 月末对账视图） ----------
function DashTab() {
  const kpi = financeKPIs();
  const buckets = agingBuckets().filter((b) => b.n > 0);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.amount));
  const invoiced = getInvoices().filter((r) => r.invoice?.status === "已开票");
  const uninvoiced = paidUninvoiced();
  const risk = badDebtRisk();
  const metrics = [
    { label: "DSO · 平均回款延迟", val: `${dsoDays()} 天`, sub: "已收讫账单的最后一笔实收日 − 应收日，均值", tone: "text-[#1D2129]" },
    { label: "回款率", val: pct(kpi.回款率), sub: `已收 ${fmt(kpi.已收金额)} / 应收 ${fmt(kpi.应收总额)} 元`, tone: "text-[#1D2129]" },
    { label: "逾期率", val: pct(kpi.逾期率), sub: `逾期余额 ${fmt(kpi.逾期金额)} 元`, tone: kpi.逾期率 > 0.1 ? "text-[#F53F3F]" : "text-[#1D2129]" },
    { label: "开票及时率", val: pct(kpi.开票及时率), sub: "已开票 ÷（已开票 + 已收讫未开票）", tone: "text-[#1D2129]" },
    { label: "坏账风险", val: `${fmt(risk)} 元`, sub: "坏账候选阶段余额（欠费与坏账页发起审批）", tone: risk > 0 ? "text-[#F53F3F]" : "text-[#1D2129]" },
  ];
  return (
    <div className="space-y-3">
      {/* 五大指标 */}
      <div className="grid grid-cols-5 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
            <div className="text-[11px] text-[#86909C]">{m.label}</div>
            <div className={`mt-1 text-xl font-semibold ${m.tone}`}>{m.val}</div>
            <div className="mt-0.5 text-[10px] leading-3.5 text-[#C9CDD4]">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 账龄结构 */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
          <div className="mb-3 text-[13px] font-semibold text-[#1D2129]">账龄结构（未收讫账单）</div>
          <div className="space-y-2">
            {buckets.map((b, i) => (
              <div key={b.label} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 text-[#4E5969]">{b.label}</span>
                <div className="h-4 flex-1 rounded-[2px] bg-[#F2F3F5] overflow-hidden">
                  <div className="h-full rounded-[2px]" style={{ width: `${(b.amount / maxBucket) * 100}%`, background: ["#165DFF", "#722ED1", "#FF7D00", "#F77234", "#F53F3F"][i] }} />
                </div>
                <span className="w-24 text-right font-medium">{fmt(b.amount)} 元</span>
                <span className="w-10 text-right text-[#86909C]">{b.n} 笔</span>
              </div>
            ))}
            {!buckets.length && <div className="py-6 text-center text-xs text-[#C9CDD4]">暂无未收讫账单</div>}
          </div>
          <div className="mt-3 border-t border-[#F2F3F5] pt-2 text-[10px] leading-4 text-[#86909C]">
            趋势图待月结多账期数据积累后提供（当前演示数据为单一账期，不虚构趋势）。
          </div>
        </div>

        {/* 月末对账：已开票清单 + 已收讫未开票 */}
        <div className="space-y-3">
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-2 text-[13px] font-semibold text-[#1D2129]">已开票清单（月末按「发票号 + 金额 + 客户」对账）</div>
            <div className="space-y-1">
              {invoiced.map((r) => (
                <div key={r.invNo} className="flex items-center gap-2 rounded-[2px] bg-[#F7F8FA] px-2.5 py-1.5 text-[11px]">
                  <span className="font-mono text-[#1D2129]">{r.invoice!.invoiceNo}</span>
                  <span className="text-[#4E5969]">{r.customer}</span>
                  <span className="ml-auto font-medium">{fmt(r.amount)} 元</span>
                  <span className="text-[#86909C]">{r.invoice!.invoicedAt}</span>
                </div>
              ))}
              {!invoiced.length && <div className="py-4 text-center text-xs text-[#C9CDD4]">暂无已开票记录</div>}
            </div>
          </div>
          <div className={`rounded-[4px] border p-4 ${uninvoiced.length ? "border-[#FFE3C2] bg-[#FFFDF8]" : "border-[#E5E6EB] bg-white"}`}>
            <div className="mb-2 text-[13px] font-semibold text-[#1D2129]">已收讫未开票（影响开票及时率）</div>
            {uninvoiced.map((r) => (
              <div key={r.invNo} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]">
                <span className="font-mono text-[#165DFF]">{r.invNo}</span>
                <span className="text-[#4E5969]">{r.customer}</span>
                <span className="text-[#86909C]">{r.invoice!.status}</span>
                <span className="ml-auto font-medium">{fmt(r.amount)} 元</span>
                <Link to="/finance?tab=invoice" className="text-[#165DFF] hover:underline">去处理</Link>
              </div>
            ))}
            {!uninvoiced.length && <div className="py-2 text-center text-xs text-[#C9CDD4]">无，开票全部及时</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FinanceCenter() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabKey) || "ledger";
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState<"全部" | InvStatus>("全部");
  const [expanded, setExpanded] = useState<string | null>(null);
  const kpi = financeKPIs();
  const collectN = allCollectItems().length;

  const rows = getInvoices().filter((r) =>
    (status === "全部" || r.status === status) &&
    (!kw || r.invNo.includes(kw) || r.customer.includes(kw) || r.contract.includes(kw)));
  const statusCount = (s: InvStatus) => getInvoices().filter((r) => r.status === s).length;

  return (
    <ArcoShell breadcrumb="财务中心">
      <main className="space-y-4 p-6">
        {/* KPI 页头：全部口径来自 @/data/finance，禁止页面重算 */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "应收总额", val: `${fmt(kpi.应收总额)} 元`, sub: `应收余额 ${fmt(kpi.应收余额)} 元` },
            { label: "回款率", val: pct(kpi.回款率), sub: `已收 ${fmt(kpi.已收金额)} 元` },
            { label: "逾期金额", val: `${fmt(kpi.逾期金额)} 元`, sub: `逾期率 ${pct(kpi.逾期率)}` },
            { label: "开票任务", val: `${kpi.待开票笔数 + kpi.开票中笔数} 笔`, sub: `待开票 ${kpi.待开票笔数} · 开票中 ${kpi.开票中笔数}` },
            { label: "按时回款率", val: pct(kpi.收讫笔数 ? kpi.按时收讫笔数 / kpi.收讫笔数 : 1), sub: `${kpi.按时收讫笔数}/${kpi.收讫笔数} 笔在应收日内收讫` },
          ].map((c) => (
            <div key={c.label} className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
              <div className="text-[11px] text-[#86909C]">{c.label}</div>
              <div className="mt-1 text-xl font-semibold text-[#1D2129]">{c.val}</div>
              <div className="mt-0.5 text-[10px] text-[#C9CDD4]">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* 页签 */}
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setParams({ tab: t.key })}
                className={`rounded-[2px] px-3 py-1.5 text-xs ${tab === t.key ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                {t.label}
                {t.key === "invoice" && kpi.待开票笔数 + kpi.开票中笔数 > 0 && <span className="ml-1">{kpi.待开票笔数 + kpi.开票中笔数}</span>}
                {t.key === "collect" && collectN > 0 && <span className="ml-1">{collectN}</span>}
              </button>
            ))}
          </div>
          <Link to="/finance/invoices" className="text-[11px] text-[#86909C] hover:text-[#165DFF] hover:underline">旧版页面入口（对比用）→</Link>
        </div>

        {tab === "ledger" && (
          <>
            <div className="flex items-center gap-2.5 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
              <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                {(["全部", "已发出", "部分收款", "已收讫", "逾期", "欠停", "坏账"] as const).map((s) => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`rounded-[2px] px-2.5 py-1 text-xs ${status === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                    {s}{s !== "全部" && statusCount(s as InvStatus) ? `（${statusCount(s as InvStatus)}）` : ""}
                  </button>
                ))}
              </div>
              <Input className="w-56" placeholder="搜索账单号 / 客户 / 合同号" value={kw} onChange={(e) => setKw(e.target.value)} />
              <span className="ml-auto text-[11px] text-[#86909C]">点击行展开账单全貌：明细 / 开票标记 / 收款记录 / 催收行动</span>
            </div>
            <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="w-6 px-2 py-2"></th><th className="px-3 py-2">账单号</th><th className="px-3 py-2">客户 / 合同</th>
                    <th className="px-3 py-2">应收日期</th><th className="px-3 py-2">金额 / 已收 / 余额</th>
                    <th className="px-3 py-2">开票标记</th><th className="px-3 py-2">催收阶段</th><th className="px-3 py-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Fragment key={r.invNo}>
                      <tr onClick={() => setExpanded(expanded === r.invNo ? null : r.invNo)}
                        className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]">
                        <td className="px-2 py-2.5 text-[#86909C]">
                          {expanded === r.invNo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{r.invNo}</td>
                        <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{r.customer}</div><div className="text-[10px] text-[#86909C]">{r.contract}</div></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{r.dueDate}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className="font-medium">{fmt(r.amount)}</span>
                          <span className="text-[#86909C]"> / {fmt(r.received)}</span>
                          {invBalance(r) > 0 && <span className="text-[#F53F3F]"> / 余 {fmt(invBalance(r))}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.invoice
                            ? <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${INV_MARK_CLS[r.invoice.status]}`}>{r.invoice.status}</span>
                            : <span className="text-[#C9CDD4]">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {collectStage(r) !== "正常"
                            ? <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STAGE_CLS[collectStage(r)]}`}>{collectStage(r)} · {agingDays(r)} 天</span>
                            : <span className="text-[#C9CDD4]">—</span>}
                        </td>
                        <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[r.status]}`}>{r.status}</span></td>
                      </tr>
                      {expanded === r.invNo && (
                        <tr className="border-b last:border-0">
                          <td colSpan={8} className="p-0"><InvDetail inv={r} /></td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {!rows.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">无匹配账单（账单由计费模块「通过并发出」后登记至此）</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "invoice" && <InvoiceTab />}

        {tab === "pay" && <PayTab />}

        {tab === "collect" && <CollectTab onGoPay={() => setParams({ tab: "pay" })} />}

        {tab === "dash" && <DashTab />}
      </main>
    </ArcoShell>
  );
}
