// 付款申请（/pay-requests）—— 应付侧唯一付款入口：申请 → 统一审批引擎 → 待付款 → 财务执行付款
// 与供应商账单的关系：账单 = 应付凭证（确认欠多少），付款申请 = 出钱动作（走流程后才可付款）
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAY_REQUESTS, usePayRequests, submitPayRequest, resubmitPayRequest, markPayRequestPaid, inFlightAmount, fmtMoney, type PayRequest, type PayReqStatus } from "@/data/payRequests";
import { useApprovalFlow, FLOW_BY_DOC, resolveBranch, INSTANCE_OF_DOC } from "@/data/approvalFlow";
import { bills, useBills } from "@/data/bills";
import { PURCHASE_ORDERS } from "@/data/purchaseFlow";
import { PURCHASE_CONTRACTS } from "@/data/purchase";
import { ENTITIES, ENTITY_NAME } from "@/data/entities";
import { currentUser } from "@/data/users";

const STATUS_COLOR: Record<PayReqStatus, string> = {
  待审批: "bg-[#E8F3FF] text-[#165DFF]",
  待付款: "bg-[#FFF3E8] text-[#FF7D00]",
  已付款: "bg-[#E8F8F2] text-[#00B42A]",
  已驳回: "bg-[#FFECE8] text-[#F53F3F]",
};
const FILTERS: ("全部" | PayReqStatus)[] = ["全部", "待审批", "待付款", "已付款", "已驳回"];
const TYPE_COLOR: Record<PayRequest["payType"], string> = {
  采购货款: "bg-[#E8F3FF] text-[#165DFF]",
  账期月结: "bg-[#FEF0FF] text-[#722ED1]",
  预付款: "bg-[#FFF3E8] text-[#FF7D00]",
  "押金/保证金": "bg-[#F2F3F5] text-[#4E5969]",
  其他: "bg-[#F2F3F5] text-[#4E5969]",
};

export default function PayRequests() {
  usePayRequests();
  useBills();
  useApprovalFlow();
  const [sp] = useSearchParams();
  const [f, setF] = useState<(typeof FILTERS)[number]>("全部");
  const [kw, setKw] = useState(sp.get("kw") ?? ""); // 支持 ?kw= 深链（如从采购合同付款进度跳入）
  const [showAdd, setShowAdd] = useState(false);

  // 审批流来自「系统管理 → 审批流配置」（付款申请单 · 提交）：分支按金额匹配，大额自动加审管理层
  const flow = FLOW_BY_DOC("付款申请单 · 提交");
  const rows = useMemo(() => PAY_REQUESTS.filter((p) =>
    (f === "全部" || p.status === f) &&
    (!kw || p.prNo.includes(kw) || p.supplier.includes(kw) || (p.poNo ?? "").includes(kw) || (p.sourceBillNos ?? []).some((b) => b.includes(kw)))), [f, kw]);
  const stats = useMemo(() => ({
    approving: PAY_REQUESTS.filter((p) => p.status === "待审批").reduce((s, p) => s + p.amount, 0),
    toPay: PAY_REQUESTS.filter((p) => p.status === "待付款").reduce((s, p) => s + p.amount, 0),
    paid: PAY_REQUESTS.filter((p) => p.status === "已付款").length,
  }), []);

  return (
    <ArcoShell breadcrumb="采购管理 / 付款申请">
      <main className="space-y-4 p-6">
        {/* 流程说明 */}
        <section className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[#BEDAFF] bg-[#F2F7FF] px-4 py-2.5 text-xs text-[#4E5969]">
          <span className="font-medium text-[#165DFF]">付款怎么流转：</span>
          <span>提交付款申请（锁额）</span><span className="text-[#C9CDD4]">→</span>
          <span>统一审批引擎「付款申请单 · 提交」：≥ 10 万自动双审（财务 + 管理层），其余单审</span><span className="text-[#C9CDD4]">→</span>
          <span>审批通过 = 待付款，财务执行付款 = 已付款</span><span className="text-[#C9CDD4]">→</span>
          <span>未命中审批流则申请直接生效</span>
          <Link to="/system/approval" className="ml-auto text-[#165DFF] hover:underline">审批流配置 →</Link>
        </section>

        {/* 统计 */}
        <section className="grid gap-3 md:grid-cols-3">
          {[
            { t: "审批中金额", v: `¥ ${fmtMoney(stats.approving)}`, c: "text-[#165DFF]" },
            { t: "待付款金额", v: `¥ ${fmtMoney(stats.toPay)}`, c: "text-[#FF7D00]" },
            { t: "本月已付笔数", v: stats.paid, c: "text-[#00B42A]" },
          ].map((k) => (
            <div key={k.t} className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
              <div className="text-xs text-[#86909C]">{k.t}</div>
              <div className={`mt-1 text-2xl font-bold ${k.c}`}>{k.v}</div>
            </div>
          ))}
        </section>

        {/* 台账 */}
        <section className="rounded-[4px] border border-[#E5E6EB] bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">付款申请单</span>
            <div className="ml-4 flex gap-1">
              {FILTERS.map((x) => (
                <button key={x} onClick={() => setF(x)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${f === x ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {x}
                </button>
              ))}
            </div>
            <Input className="ml-2 w-48" placeholder="搜索申请单号 / 供应商 / 采购单" value={kw} onChange={(e) => setKw(e.target.value)} />
            <span className="text-[11px] text-[#86909C]">在途占款合计 ¥ {fmtMoney(inFlightAmount())}（审批中 + 待付款）</span>
            <Button size="sm" className="ml-auto" onClick={() => setShowAdd(true)}>＋ 新建付款申请</Button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">申请单号</th><th className="px-3 py-2">供应商 / 付款事由</th>
                <th className="px-3 py-2">类型</th><th className="px-3 py-2">付款主体</th>
                <th className="px-3 py-2 text-right">金额（元）</th><th className="px-3 py-2">关联来源</th>
                <th className="px-3 py-2">期望付款日</th><th className="px-3 py-2">申请人</th>
                <th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const inst = INSTANCE_OF_DOC(p.prNo);
                const bigAmount = p.amount >= 100000;
                const hitBranch = resolveBranch(flow?.id ?? "", { amount: p.amount });
                return (
                  <tr key={p.prNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{p.prNo}{p.version > 1 && <span className="ml-1 rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[9px] text-[#86909C]">v{p.version}</span>}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[#1D2129]">{p.supplier}</div>
                      <div className="max-w-[260px] truncate text-[10px] text-[#86909C]" title={p.reason}>{p.reason}</div>
                      {p.rejectReason && <div className="text-[10px] text-[#F53F3F]">驳回：{p.rejectReason}</div>}
                    </td>
                    <td className="px-3 py-2.5"><Badge className={`${TYPE_COLOR[p.payType]} hover:bg-inherit`}>{p.payType}</Badge></td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{ENTITY_NAME(p.payerEntity)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${bigAmount ? "text-[#FF7D00]" : "text-[#1D2129]"}`}>
                      {fmtMoney(p.amount)}{bigAmount && <div className="text-[9px] font-normal text-[#FF7D00]">≥ 10 万 · 双审</div>}
                    </td>
                    <td className="px-3 py-2.5 text-[#4E5969]">
                      {(p.sourceBillNos ?? []).map((b) => <div key={b} className="font-mono text-[10px]">账单 <Link to={`/bills/detail?id=${b}`} className="text-[#165DFF] hover:underline" onClick={(e) => e.stopPropagation()}>{b}</Link></div>)}
                      {p.poNo && <div className="font-mono text-[10px]">采购单 <Link to={`/purchase/orders/${p.poNo}`} className="text-[#165DFF] hover:underline" onClick={(e) => e.stopPropagation()}>{p.poNo}</Link></div>}
                      {p.contractNo && <div className="font-mono text-[10px]">合同 <Link to={`/purchase/contracts?id=${p.contractNo}`} className="text-[#165DFF] hover:underline" onClick={(e) => e.stopPropagation()}>{p.contractNo}</Link></div>}
                      {!p.sourceBillNos?.length && !p.poNo && !p.contractNo && <span className="text-[#C9CDD4]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[#4E5969]">{p.expectPayDate}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{p.applicant}<div className="text-[10px] text-[#86909C]">{p.dept}</div></td>
                    <td className="px-3 py-2.5">
                      <Badge className={`${STATUS_COLOR[p.status]} hover:bg-inherit`}>{p.status}</Badge>
                      {p.status === "待审批" && inst && <div className="mt-0.5 text-[10px] text-[#165DFF]">审批实例 {inst.id} · 当前 {inst.curNodeIdx + 1}/{inst.snapshot.nodes.length} 级</div>}
                      {p.status === "待审批" && !inst && <div className="mt-0.5 text-[10px] text-[#86909C]">分支：{hitBranch?.name ?? "未配置"}</div>}
                      {p.status === "已付款" && p.paidAt && <div className="mt-0.5 text-[10px] text-[#86909C]">{p.paidAt} · {p.payer}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {p.status === "待付款" && (
                        <Button size="sm" className="bg-[#00B42A] hover:bg-[#00B42A]/90" onClick={() => {
                          if (!confirm(`确认执行付款？\n\n${p.prNo}（${p.supplier}）\n金额 ¥ ${fmtMoney(p.amount)}，付款主体：${ENTITY_NAME(p.payerEntity)}\n收款户名 ${p.accountName} · ${p.accountNo}\n\n确认后状态 = 已付款（原型 mock，真实环境对接网银/银企直联）。`)) return;
                          markPayRequestPaid(p.prNo);
                        }}>执行付款</Button>
                      )}
                      {p.status === "待审批" && (
                        <Link to={`/approval?id=${inst?.id ?? ""}`}><Button size="sm" variant="outline">去审批</Button></Link>
                      )}
                      {p.status === "已驳回" && (
                        <Button size="sm" variant="outline" onClick={() => {
                          if (!confirm(`重新提交付款申请 ${p.prNo}？\n按最新审批流配置重新匹配（版本 v${p.version + 1}）。`)) return;
                          resubmitPayRequest(p.prNo);
                        }}>修改后重报</Button>
                      )}
                      {p.status === "已付款" && <span className="text-[11px] text-[#C9CDD4]">完成</span>}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#86909C]">无匹配付款申请</td></tr>}
            </tbody>
          </table>
        </section>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 付款申请是出钱的唯一入口：先申请、审批通过后才能执行付款；② ≥ 10 万自动双审（财务 + 管理层），金额分支可在审批流配置调整；
          ③ 同一供应商账单在途（审批中 / 待付款）期间不可重复申请，防止重复付款；④ 付款主体决定用哪个分子公司账户出钱（主体与印章主数据维护账户）。
        </div>
      </main>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </ArcoShell>
  );
}

// ---------- 新建付款申请 ----------
function AddModal({ onClose }: { onClose: () => void }) {
  const me = currentUser();
  const [f, setF] = useState({
    supplier: "", amount: "", payType: "采购货款" as PayRequest["payType"], payMethod: "银行转账" as PayRequest["payMethod"],
    payerEntity: "ENT-HQ", accountName: "", accountNo: "", bankName: "",
    billNo: "", poNo: "", expectPayDate: "", reason: "",
  });
  const [err, setErr] = useState<string | null>(null);
  // 可关联的账单：已入账/已月结，且无在途付款申请
  const billOptions = bills.filter((b) => (b.status === "已入账" || b.status === "已月结"));
  const poOptions = PURCHASE_ORDERS.filter((p) => p.status !== "草稿");
  const total = Number(f.amount) || 0;
  const flow = FLOW_BY_DOC("付款申请单 · 提交");
  const hitBranch = resolveBranch(flow?.id ?? "", { amount: total });

  const save = () => {
    const e = submitPayRequest({
      supplier: f.supplier.trim(),
      amount: total,
      payType: f.payType,
      payMethod: f.payMethod,
      payerEntity: f.payerEntity,
      accountName: f.accountName.trim(),
      accountNo: f.accountNo.trim(),
      bankName: f.bankName.trim() || undefined,
      sourceBillNos: f.billNo ? [f.billNo] : undefined,
      poNo: f.poNo || undefined,
      contractNo: f.billNo ? bills.find((b) => b.id === f.billNo)?.contractNo : undefined,
      expectPayDate: f.expectPayDate,
      reason: f.reason.trim(),
      applicant: me?.name ?? "演示用户",
      dept: me?.dept ?? "业务支撑部",
    });
    if (e) { setErr(e); return; }
    onClose();
  };

  return (
    <CenterModal title="新建付款申请" sub="提交即锁额并进入统一审批流；审批通过 = 待付款，财务才可执行付款" width={640} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">收款供应商 <span className="text-[#F53F3F]">*</span></div>
            <Input list="pr-suppliers" placeholder="如：上海电信" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
            <datalist id="pr-suppliers">
              {[...new Set([...bills.map((b) => b.supplier), ...PURCHASE_CONTRACTS.map((c) => c.supplier)])].map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">申请金额（元）<span className="text-[#F53F3F]">*</span></div>
            <Input type="number" placeholder="0.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">付款类型 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.payType} onChange={(e) => setF({ ...f, payType: e.target.value as PayRequest["payType"] })}>
              {(["采购货款", "账期月结", "预付款", "押金/保证金", "其他"] as const).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">付款方式 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.payMethod} onChange={(e) => setF({ ...f, payMethod: e.target.value as PayRequest["payMethod"] })}>
              {(["银行转账", "承兑汇票", "其他"] as const).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-0.5 text-[#4E5969]">付款主体（用哪个分子公司账户出钱）<span className="text-[#F53F3F]">*</span></div>
          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.payerEntity} onChange={(e) => setF({ ...f, payerEntity: e.target.value })}>
            {ENTITIES.filter((x) => x.status === "启用").map((x) => <option key={x.id} value={x.id}>{x.shortName} · {x.bank} {x.account}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">收款户名 <span className="text-[#F53F3F]">*</span></div>
            <Input placeholder="供应商开户名" value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">收款账号 <span className="text-[#F53F3F]">*</span></div>
            <Input placeholder="银行账号" value={f.accountNo} onChange={(e) => setF({ ...f, accountNo: e.target.value })} />
          </div>
          <div className="col-span-2">
            <div className="mb-0.5 text-[#4E5969]">开户行（选填）</div>
            <Input placeholder="如：工商银行上海分行" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">关联供应商账单（月结类，选填）</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.billNo} onChange={(e) => setF({ ...f, billNo: e.target.value })}>
              <option value="">不关联（如预付款）</option>
              {billOptions.map((b) => <option key={b.id} value={b.id}>{b.id} · {b.supplier} · ¥{fmtMoney(b.amount)}（{b.period}）</option>)}
            </select>
            {f.billNo && (() => { const b = bills.find((x) => x.id === f.billNo); return b ? (
              <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] text-[#4E5969]">
                <input type="checkbox" className="accent-[#165DFF]" checked={f.amount === String(b.amount)} onChange={() => setF({ ...f, amount: String(b.amount), supplier: b.supplier })} />
                按账单金额填充（¥ {fmtMoney(b.amount)}）并带出供应商
              </label>
            ) : null; })()}
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">关联采购单（货款类，选填）</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.poNo} onChange={(e) => setF({ ...f, poNo: e.target.value })}>
              <option value="">不关联</option>
              {poOptions.map((p) => <option key={p.poNo} value={p.poNo}>{p.poNo} · {p.supplier} · {p.status}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">期望付款日 <span className="text-[#F53F3F]">*</span></div>
            <Input type="date" value={f.expectPayDate} onChange={(e) => setF({ ...f, expectPayDate: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">申请人</div>
            <Input value={`${me?.name ?? "演示用户"}（${me?.dept ?? "业务支撑部"}）`} disabled />
          </div>
        </div>

        <div>
          <div className="mb-0.5 text-[#4E5969]">付款事由 <span className="text-[#F53F3F]">*</span></div>
          <Input placeholder="如：BGP 电信出口月租（2026-10 账期）" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </div>

        {total > 0 && (
          <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] leading-5 text-[#4E5969]">
            审批路径预览：<span className="font-medium text-[#165DFF]">{flow ? `流「${flow.name}」· 分支「${hitBranch?.name ?? "未命中"}」` : "未配置（提交直接生效待付款）"}</span>
            {hitBranch && <span> · {hitBranch.nodes.map((n) => `${n.approverSource === "指定人" ? "" : `${n.approverSource}·`}${n.approver}`).join(" → ")}</span>}
            {total >= 100000 && <span className="ml-1 rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">≥ 10 万：大额双审</span>}
          </div>
        )}
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-3 py-2 text-[11px] text-[#F53F3F]">{err}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={save}>提交申请（进入审批）</Button>
        </div>
      </div>
    </CenterModal>
  );
}
