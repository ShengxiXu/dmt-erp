// P04-0 开票管理（旧版页面 /finance/invoices，保留用于新旧对比）：
// 数据已并入应收账单，本页为应收台账的开票视角；新设计请见财务中心 /finance（开票任务页签）。
// 开票操作组件与财务中心共用（@/components/InvoiceOps），行为一致。
import { useState } from "react";
import ArcoShell from "@/components/ArcoShell";
import { Input } from "@/components/ui/input";
import { useInvoiceApps, getInvoiceApps, startInvoicing, redFlushInvoice, type InvoiceApp, type InvAppStatus } from "@/data/invoiceApps";
import { ENTITY_BY_ID, ENTITY_NAME } from "@/data/entities";
import { InvoiceEditForm as EditForm, InvoiceFillForm as FillForm, InvoicePrintSheet as PrintSheet,
  INV_MARK_CLS as STATUS_CLS, sellerOf } from "@/components/InvoiceOps";

export default function InvoiceApps() {
  useInvoiceApps();
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState<"全部" | InvAppStatus>("全部");
  const [editing, setEditing] = useState<InvoiceApp | null>(null);
  const [filling, setFilling] = useState<InvoiceApp | null>(null);
  const [printing, setPrinting] = useState<InvoiceApp | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const apps = getInvoiceApps().filter((a) =>
    (status === "全部" || a.status === status) &&
    (!kw || a.apNo.includes(kw) || a.invNo.includes(kw) || a.customer.includes(kw) || (a.invoiceNo ?? "").includes(kw)));
  const counts = (["待开票", "开票中", "已开票", "已红冲"] as const).map((s) => ({ s, n: getInvoiceApps().filter((a) => a.status === s).length }));

  return (
    <ArcoShell breadcrumb="财务 / 开票管理（旧版）">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">开票管理</span>
            <span className="rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">旧版 · 数据已并入应收账单</span>
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
        </div>

        {msg && <div className="rounded-[4px] border border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2 text-xs text-[#0E42D2]">{msg}</div>}

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">申请单号</th><th className="px-3 py-2">关联账单</th><th className="px-3 py-2">客户 / 合同</th>
                <th className="px-3 py-2">销方主体</th><th className="px-3 py-2">开票账期</th><th className="px-3 py-2">开票金额</th><th className="px-3 py-2">发票类别 / 业务类别</th>
                <th className="px-3 py-2">发票号 / 开票日期</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.apNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{a.apNo}</td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{a.invNo}</td>
                  <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{a.customer}</div><div className="text-[10px] text-[#86909C]">{a.contractNo}</div></td>
                  <td className="px-3 py-2.5 text-[#4E5969]" title={ENTITY_BY_ID(sellerOf(a.contractNo)).fullName}>{ENTITY_NAME(sellerOf(a.contractNo))}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{a.periodText}</td>
                  <td className="px-3 py-2.5 font-medium">{a.amount.toLocaleString("zh-CN")}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]"><div>{a.invType}</div><div className="text-[10px] text-[#86909C]">{a.bizCat} · {a.format}</div></td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{a.invoiceNo ? <div>{a.invoiceNo}<div className="text-[10px] text-[#86909C]">{a.invoicedAt}</div></div> : "—"}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[a.status]}`}>{a.status}</span></td>
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
              {!apps.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#C9CDD4]">无匹配开票申请（账单「通过并发出」后自动生成）</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 应收账单「通过并发出」时自动生成开票标记（待开票），挂在账单行内，不再有独立单据；开票抬头 / 税号取自客户主数据（客户档案维护）；
          ② 业务支撑「登记开票」后照「登记单」录入金蝶，财务在金蝶开票；<strong className="text-[#4E5969]">金蝶不做接口</strong>；
          ③ 开完票在系统回填发票号码 → 已开票，客户凭票付款，收款核销在收款管理；
          ④ 红冲 / 作废在金蝶完成，此处仅状态标记；<strong className="text-[#4E5969]">账单已发生收款的，不允许红冲发票</strong>，先走收款红冲审批（AP-04）；
          ⑤ 月末按「发票号 + 金额 + 客户」与财务对账。提成比例 / 积分不属本系统。
        </div>
      </main>
      {editing && <EditForm a={editing} onClose={() => setEditing(null)} />}
      {filling && <FillForm a={filling} onClose={() => setFilling(null)} />}
      {printing && <PrintSheet a={printing} onClose={() => setPrinting(null)} />}
    </ArcoShell>
  );
}
