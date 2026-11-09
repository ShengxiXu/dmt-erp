// P04-1/2 收款管理（旧版页面 /finance/payments，保留用于新旧对比）：收款登记 + 自动核销 + 应收账单核销视图
// 口径：一笔收款对应一张账单；同一张发票允许多笔收款（部分收款）逐笔核销；登记错误走红冲审批（原单留痕不可删）。
// 新设计请见财务中心 /finance（收款核销页签）；登记表单与财务中心共用（@/components/PayOps）。
import { Fragment, useState } from "react";
import { useReceivables, getPayments, getInvoices, redFlushPayment, invBalance, overdueDays, type Receivable, type InvStatus } from "@/data/receivables";
import { CONTRACTS } from "@/data/contracts";
import { ENTITY_BY_ID, ENTITY_NAME } from "@/data/entities";
import { PayForm } from "@/components/PayOps";

/** 收款主体：账单 → 销售合同 → 签约主体（钱进哪个分子公司的账户） */
const sellerOf = (invNo: string) => {
  const inv = getInvoices().find((r) => r.invNo === invNo);
  return CONTRACTS.find((c) => c.id === inv?.contract)?.entityId;
};
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const INV_STATUS_CLS: Record<InvStatus, string> = {
  已发出: "bg-[#E8F3FF] text-[#165DFF]",
  部分收款: "bg-[#FEF0FF] text-[#722ED1]",
  已收讫: "bg-[#E8F8F2] text-[#00B42A]",
  逾期: "bg-[#FFF3E8] text-[#FF7D00]",
  欠停: "bg-[#FFECE8] text-[#F53F3F]",
  坏账: "bg-[#F2F3F5] text-[#86909C]",
};

// ---------- 账单核销时间线 ----------
function InvTimeline({ inv }: { inv: Receivable }) {
  const pays = getPayments().filter((p) => p.invNo === inv.invNo);
  return (
    <tr>
      <td colSpan={8} className="bg-[#FBFBFC] px-6 py-2.5">
        <div className="text-[11px] text-[#4E5969]">核销流水（audit_log）：账单金额 {inv.amount.toLocaleString("zh-CN")} → 累计已收 {inv.received.toLocaleString("zh-CN")} → 未收余额 {invBalance(inv).toLocaleString("zh-CN")} 元</div>
        <div className="mt-1 space-y-0.5">
          {pays.map((p) => (
            <div key={p.payNo} className="flex items-center gap-2 text-[11px]">
              <span className="font-mono text-[#165DFF]">{p.payNo}</span>
              <span className="text-[#1D2129]">{p.amount.toLocaleString("zh-CN")} 元</span>
              <span className="text-[#86909C]">{p.method}{p.referenceNo ? ` · ${p.referenceNo}` : ""} · {p.paidAt}</span>
              {p.status === "已红冲" && <span className="rounded-[2px] bg-[#FFECE8] px-1 py-0.5 text-[10px] text-[#F53F3F]">已红冲</span>}
            </div>
          ))}
          {!pays.length && <div className="text-[11px] text-[#C9CDD4]">暂无收款记录</div>}
        </div>
      </td>
    </tr>
  );
}

export default function Payments() {
  useReceivables();
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState<"全部" | InvStatus>("全部");
  const [openForm, setOpenForm] = useState(false);
  const [expand, setExpand] = useState<string | null>(null);
  const invs = getInvoices().filter((i) => (status === "全部" || i.status === status) && (!kw || i.invNo.includes(kw) || i.customer.includes(kw)));
  const pays = getPayments().filter((p) => !kw || p.payNo.includes(kw) || p.customer.includes(kw) || p.invNo.includes(kw));

  return (
    <ArcoShell breadcrumb="财务 / 收款管理">
      <main className="space-y-4 p-6">
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
                <th className="px-3 py-2">收款主体 / 账户</th><th className="px-3 py-2">金额（元）</th><th className="px-3 py-2">方式 / 流水号</th><th className="px-3 py-2">收款时间</th>
                <th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {pays.map((p) => (
                <tr key={p.payNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{p.payNo}</td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{p.invNo}</td>
                  <td className="px-3 py-2.5 text-[#1D2129]">{p.customer}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]"><div>{ENTITY_NAME(sellerOf(p.invNo))}</div><div className="text-[10px] text-[#86909C]">{ENTITY_BY_ID(sellerOf(p.invNo)).bank}</div></td>
                  <td className="px-3 py-2.5 font-medium">{p.amount.toLocaleString("zh-CN")}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{p.method}{p.referenceNo ? ` · ${p.referenceNo}` : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{p.paidAt}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${p.status === "已红冲" ? "bg-[#FFECE8] text-[#F53F3F]" : "bg-[#E8F8F2] text-[#00B42A]"}`}>{p.status}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    {p.status === "已登记" && (
                      <button className="text-[#F53F3F] hover:underline" onClick={() => {
                        if (!confirm(`红冲收款 ${p.payNo}（${p.amount.toLocaleString("zh-CN")} 元）？\n正式环境须走「退款/红冲审批」（AP-04）通过后冲正；原型直接演示冲正结果，原单保留「已红冲」痕迹不可删除。`)) return;
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

        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">应收账单（核销视图）</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["全部", "已发出", "部分收款", "逾期", "欠停", "坏账", "已收讫"] as const).map((s) => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${status === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">账单号</th><th className="px-3 py-2">客户 / 合同</th><th className="px-3 py-2">账单金额</th>
                <th className="px-3 py-2">已收</th><th className="px-3 py-2">未收余额</th><th className="px-3 py-2">应收日</th>
                <th className="px-3 py-2">逾期天数</th><th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i) => (
                <Fragment key={i.invNo}>
                  <tr className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => setExpand(expand === i.invNo ? null : i.invNo)}>
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{expand === i.invNo ? "▾" : "▸"} {i.invNo}</td>
                    <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{i.customer}</div><div className="text-[10px] text-[#86909C]">{i.contract}</div></td>
                    <td className="px-3 py-2.5">{i.amount.toLocaleString("zh-CN")}</td>
                    <td className="px-3 py-2.5">{i.received.toLocaleString("zh-CN")}</td>
                    <td className={`px-3 py-2.5 ${invBalance(i) > 0 ? "font-medium text-[#FF7D00]" : "text-[#00B42A]"}`}>{invBalance(i).toLocaleString("zh-CN")}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{i.dueDate}</td>
                    <td className="px-3 py-2.5">{overdueDays(i) > 0 ? <span className="font-medium text-[#F53F3F]">{overdueDays(i)} 天</span> : "—"}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${INV_STATUS_CLS[i.status]}`}>{i.status}</span></td>
                  </tr>
                  {expand === i.invNo && <InvTimeline inv={i} />}
                </Fragment>
              ))}
              {!invs.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">无匹配账单</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 收款提交即自动核销：累计已收 = Σ 收款（未冲正），≥ 账单金额 → 已收讫；② 同一张发票允许多笔部分收款，逐笔核销，流水写 audit_log；
          ③ 欠停账单<strong className="text-[#4E5969]">足额收讫自动生成复机工单</strong>（见欠费与坏账页）；④ 登记错误走红冲审批，原单保留「已红冲」痕迹，不可物理删除。
        </div>
      </main>
      {openForm && <PayForm onClose={() => setOpenForm(false)} />}
    </ArcoShell>
  );
}
