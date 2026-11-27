// 供应商账单详情页：状态时间线 + 金额/归类/归属 + 差异留痕 + 来源邮件回溯 + 被引用核算单 + 操作出口
// 与列表页弹窗的关系：弹窗是「快速查看」，本页是「完整详情」——争议对账、差异回溯等重操作引导到本页完成。
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import ArcoShell from "@/components/ArcoShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bills, useBills, setBillStatus, billCenter, type SupplierBill } from "@/data/bills";
import { BILL_EMAILS, useBillEmails } from "@/data/billEmails";
import { getCostItems } from "@/data/costItems";
import { fmt } from "@/data/sheets";
import { STATUS_COLOR, TAG_COLOR, billRefs } from "@/pages/Bills";

const STEPS = ["待入账", "已入账", "已月结"] as const;

export default function BillDetail() {
  useBills();
  useBillEmails();
  const [sp] = useSearchParams();
  const id = sp.get("id") ?? "";
  const bill = bills.find((b) => b.id === id);
  if (!bill) return (
    <ArcoShell breadcrumb="供应商账单 / 详情">
      <main className="p-6 text-sm text-[#86909C]">
        账单 {id || "—"} 不存在。<Link to="/bills" className="text-[#165DFF] hover:underline">返回账单台账</Link>
      </main>
    </ArcoShell>
  );
  return <DetailBody key={bill.id + bill.status + (bill.tag ?? "")} bill={bill} />;
}

function DetailBody({ bill }: { bill: SupplierBill }) {
  const item = getCostItems().find((i) => i.key === bill.costItemKey);
  const refs = useMemo(() => billRefs(bill), [bill.id]);
  const email = bill.emailId ? BILL_EMAILS.find((e) => e.id === bill.emailId) : null;
  const emailRow = email?.rows.find((r) => r.result?.billId === bill.id);
  const stepIdx = bill.status === "已作废" ? -1 : STEPS.indexOf(bill.status as (typeof STEPS)[number]);
  const cc = billCenter(bill.costItemKey);

  const doPost = (next: "已入账" | "已作废", tip: string) => {
    if (!confirm(tip)) return;
    setBillStatus(bill.id, next);
  };

  return (
    <ArcoShell breadcrumb="供应商账单 / 账单详情">
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        {/* 头部：编号 + 状态 + 返回 */}
        <div className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[#E5E6EB] bg-white px-5 py-4">
          <Link to="/bills" className="text-xs text-[#86909C] hover:text-[#165DFF]">‹ 账单台账</Link>
          <span className="font-mono text-lg font-semibold text-[#1D2129]">{bill.id}</span>
          <Badge className={`${STATUS_COLOR[bill.status]} hover:bg-inherit`}>{bill.status}</Badge>
          {bill.tag && <Badge className={`${TAG_COLOR[bill.tag]} hover:bg-inherit`}>{bill.tag}</Badge>}
          {bill.source === "邮件导入" && <span className="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">邮件导入</span>}
          <span className="ml-auto text-xs text-[#86909C]">{bill.supplier} · 账期 <span className="font-mono">{bill.period}</span></span>
        </div>

        {/* 状态时间线（作废账单不走进度，单独横幅说明） */}
        {bill.status === "已作废" ? (
          <div className="rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5] px-5 py-3 text-xs leading-5 text-[#4E5969]">
            <span className="font-medium text-[#F53F3F]">本账单已作废（运营商红冲 / 账单作废）。</span>
            不参与任何费用归集与月结；对应行如在后续账单中重新开具，会作为新账单入台账。
          </div>
        ) : (
          <div className="flex items-center rounded-[4px] border border-[#E5E6EB] bg-white px-8 py-4">
            {STEPS.map((s, i) => {
              const done = i < stepIdx, cur = i === stepIdx;
              return (
                <div key={s} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${done ? "bg-[#00B42A] text-white" : cur ? "bg-[#165DFF] text-white" : "border border-[#C9CDD4] text-[#86909C]"}`}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={`mt-1 text-[11px] ${cur ? "font-medium text-[#165DFF]" : done ? "text-[#00B42A]" : "text-[#86909C]"}`}>{s}</span>
                    {i === 0 && <span className="mt-0.5 font-mono text-[10px] text-[#C9CDD4]">{bill.createdAt}</span>}
                  </div>
                  {i < STEPS.length - 1 && <div className={`mx-3 mb-4 h-px flex-1 ${i < stepIdx ? "bg-[#00B42A]" : "bg-[#E5E6EB]"}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* 核心数字 */}
        <section className="grid gap-3 md:grid-cols-4">
          {[
            { t: "账单金额", v: `¥${fmt(bill.amount)}`, c: "text-[#1D2129]" },
            { t: "费用归类", v: item?.name ?? bill.costItemKey, c: "text-[#1D2129] text-base" },
            { t: "记到哪", v: cc, c: "text-[#165DFF] text-base" },
            { t: "费用口径", v: item?.settleType === "间接" ? "间接费用（按收入占比分配）" : "直接成本（随单算）", c: "text-[#4E5969] text-base" },
          ].map((k) => (
            <div key={k.t} className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
              <div className="text-xs text-[#86909C]">{k.t}</div>
              <div className={`mt-1 font-semibold ${k.c} ${k.t === "账单金额" ? "text-2xl font-mono" : ""}`}>{k.v}</div>
            </div>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* 左列：基础信息 + 差异留痕 + 来源邮件 */}
          <div className="space-y-4 lg:col-span-3">
            <section className="rounded-[4px] border border-[#E5E6EB] bg-white">
              <div className="border-b px-4 py-2.5 text-sm font-semibold">基础信息</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-xs text-[#4E5969]">
                <span>供应商：<b className="text-[#1D2129]">{bill.supplier}</b></span>
                <span>账期：<b className="font-mono text-[#1D2129]">{bill.period}</b></span>
                <span>来源：<b className="text-[#1D2129]">{bill.source}</b></span>
                <span>录入时间：<b className="font-mono text-[#1D2129]">{bill.createdAt}</b></span>
                {bill.poNo && <span>采购单号：<b className="font-mono text-[#1D2129]">{bill.poNo}</b></span>}
                {bill.contractNo && <span>采购合同：<b className="font-mono text-[#1D2129]">{bill.contractNo}</b></span>}
                {bill.resRef && <span>关联资源：<b className="font-mono text-[#1D2129]">{bill.resRef}</b></span>}
                {bill.note && <span className="col-span-2">备注：<b className="text-[#1D2129]">{bill.note}</b></span>}
              </div>
            </section>

            {bill.diff && (
              <section className="rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5]">
                <div className="border-b border-[#FFECE8] px-4 py-2.5 text-sm font-semibold text-[#F53F3F]">核对差异留痕</div>
                <div className="space-y-1.5 px-4 py-3 text-xs leading-5 text-[#4E5969]">
                  <div>处理方式：<b className="text-[#1D2129]">{bill.diff.handle}</b>{bill.tag && <Badge className={`ml-2 ${TAG_COLOR[bill.tag]} hover:bg-inherit`}>{bill.tag}</Badge>}</div>
                  <div>合同基准 <span className="font-mono">¥{fmt(bill.diff.expected)}</span> → 账单 <span className="font-mono">¥{fmt(bill.amount)}</span>，差异 <span className={`font-mono font-medium ${bill.diff.diff > 0 ? "text-[#F53F3F]" : "text-[#165DFF]"}`}>{bill.diff.diff > 0 ? "+" : ""}¥{fmt(bill.diff.diff)}</span></div>
                  {bill.diff.reason && <div>原因：<span className="text-[#1D2129]">{bill.diff.reason}</span></div>}
                  {bill.tag === "争议" && bill.status === "待入账" && <div className="text-[#F53F3F]">争议未决：暂不计入费用，与运营商对账后在右侧操作区「转正入账」或「作废」。</div>}
                  {bill.tag === "差异" && <div className="text-[#86909C]">已按实入账：差异金额留痕备查，月结对比时可见。</div>}
                </div>
              </section>
            )}

            {email && (
              <section className="rounded-[4px] border border-[#E5E6EB] bg-white">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <span className="text-sm font-semibold">来源邮件回溯</span>
                  <Link to="/bills?tab=emails" className="text-[11px] text-[#165DFF] hover:underline">去邮件导入页 ›</Link>
                </div>
                <div className="space-y-1.5 px-4 py-3 text-xs leading-5 text-[#4E5969]">
                  <div>主题：<span className="text-[#1D2129]">{email.subject}</span></div>
                  <div>发件人：<span className="font-mono">{email.from}</span> · 收件时间 <span className="font-mono">{email.receivedAt}</span></div>
                  <div>附件：<span className="font-mono text-[10px]">{email.attachName}</span></div>
                  {emailRow && (
                    <div className="rounded-[2px] bg-[#F7F8FA] px-2.5 py-1.5">
                      本账单对应附件第 {emailRow.lineNo} 行：{emailRow.itemName} · 账单金额 <span className="font-mono">¥{fmt(emailRow.amount)}</span>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* 右列：被引用 + 操作 */}
          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-[4px] border border-[#E5E6EB] bg-white">
              <div className="border-b px-4 py-2.5 text-sm font-semibold">被哪些核算单引用</div>
              <div className="space-y-2 px-4 py-3">
                {refs.length === 0 && <div className="text-xs leading-5 text-[#86909C]">暂未被引用。账单入账后，核算单填报按归属切分时即可选择本账单。</div>}
                {refs.map((r, i) => (
                  <div key={i} className="rounded-[2px] border border-[#E5E6EB] px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#165DFF]">{r.sheetId}</span>
                      <span className="text-[#1D2129]">{r.customer}</span>
                      <span className="ml-auto text-[#86909C]">{r.contract}</span>
                    </div>
                    <div className="mt-0.5 text-[#86909C]">核算行：{r.item} · <span className="font-mono">{fmt(r.amount)} 元</span></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[4px] border border-[#E5E6EB] bg-white">
              <div className="border-b px-4 py-2.5 text-sm font-semibold">操作</div>
              <div className="space-y-2.5 px-4 py-3 text-xs">
                {bill.status === "待入账" && bill.tag === "争议" && (<>
                  <div className="leading-5 text-[#86909C]">争议账单暂不计入费用。与运营商对账后：金额无误则转正入账；运营商红冲/账单作废则作废。</div>
                  <Button className="w-full" onClick={() => doPost("已入账", `对账完成，转正入账？\n\n账单 ${bill.id}（¥ ${fmt(bill.amount)}）将归集至：${cc}\n计入该中心 ${bill.period} 真实费用。`)}>对账完成，转正入账</Button>
                  <Button variant="outline" className="w-full" onClick={() => doPost("已作废", `确认作废账单 ${bill.id}？\n\n作废后账单退出台账，不计入任何费用（适用于运营商红冲/账单作废的场景）。`)}>作废（运营商红冲）</Button>
                </>)}
                {bill.status === "待入账" && bill.tag !== "争议" && (<>
                  <div className="leading-5 text-[#86909C]">入账后归集至 <span className="font-medium text-[#165DFF]">{cc}</span>，计入该中心 {bill.period} 真实费用（月结对比预估切分）。</div>
                  <Button className="w-full" onClick={() => doPost("已入账", `确认入账？\n\n账单 ${bill.id}（¥ ${fmt(bill.amount)}）将归集至：${cc}\n月结时计入该中心 ${bill.period} 真实费用。`)}>确认入账</Button>
                </>)}
                {bill.status === "已入账" && <div className="leading-5 text-[#86909C]">已入账，计入「{cc}」{bill.period} 真实费用。月结转结后状态自动变为「已月结」，账期锁账。</div>}
                {bill.status === "已月结" && <div className="leading-5 text-[#86909C]">账期已锁账，本账单为只读快照的一部分；如有改动只能红冲。</div>}
                {bill.status === "已作废" && <div className="leading-5 text-[#86909C]">已作废，不参与费用归集。操作留痕保留供审计。</div>}
              </div>
            </section>
          </div>
        </div>
      </main>
    </ArcoShell>
  );
}
