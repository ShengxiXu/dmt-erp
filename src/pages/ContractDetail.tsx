// 合同详情（/contract/detail?id=HT-xxxx）
// 签署状态机 mock：线上契约锁 / 线下实物章 双链路四步，异常出口（待修订/已终止），版本历史
import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import { CONTRACTS, ONLINE_STEPS, OFFLINE_STEPS, fmtMoney, checkDiscount, SPECIALS, daysToEnd, type Contract } from "@/data/contracts";
import { GET_OPP, updateOpp } from "@/data/customers";
import { ENTITY_BY_ID } from "@/data/entities";
import { useBilling, getBills, getSubscriptions, updateSubscription, periodOf, dueDateOf, fmtD } from "@/data/billing";
import { useReceivables, getInvoices } from "@/data/receivables";
import { useSettings } from "@/data/settings";
import { DEMO_TODAY } from "@/data/settings";
import { customerFinance } from "@/data/finance";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_CLS } from "./ContractList";

const Lane = ({ title, steps, active, step, color }: { title: string; steps: string[]; active: boolean; step: number; color: string }) => (
  <div className={`rounded-[4px] border p-4 ${active ? "border-[#165DFF] bg-[#F7FAFF]" : "border-[#E5E6EB] opacity-55"}`}>
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold" style={{ color: active ? "#165DFF" : "#86909C" }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {title}{active && (step >= 0
        ? <span className="rounded-[2px] bg-[#BEDAFF] px-1.5 py-0.5 text-[10px]">当前链路</span>
        : <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] font-normal text-[#86909C]">未开始</span>)}
    </div>
    <div className="flex items-center">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center last:flex-none">
          <div className="text-center">
            <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${i < step ? "bg-[#00B42A] text-white" : i === step ? "bg-[#165DFF] text-white" : "border border-[#E5E6EB] bg-white text-[#C9CDD4]"}`}>
              {i < step ? "✓" : i + 1}
            </div>
            <div className={`mt-1 w-16 text-[10px] leading-3 ${i === step && active ? "font-medium text-[#165DFF]" : "text-[#4E5969]"}`}>{s}</div>
          </div>
          {i < steps.length - 1 && <div className={`mx-1 mb-4 h-px flex-1 ${i < step ? "bg-[#00B42A]" : "bg-[#E5E6EB]"}`} />}
        </div>
      ))}
    </div>
  </div>
);

export default function ContractDetail() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const src = CONTRACTS.find((c) => c.id === sp.get("id"));
  const [c, setC] = useState<Contract | null>(src ? { ...src } : null);
  const entity = ENTITY_BY_ID(c?.entityId);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseType, setReviseType] = useState<"笔误" | "非标">("笔误");
  const [reviseNote, setReviseNote] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [apprComment, setApprComment] = useState("");
  useBilling();
  useReceivables();
  useSettings();

  if (!c) {
    return (
      <ArcoShell breadcrumb="合同管理 / 详情">
        <main className="p-6"><div className="rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">
          合同不存在（{sp.get("id")}）<Link className="ml-2 text-[#165DFF] hover:underline" to="/contract">返回列表</Link>
        </div></main>
      </ArcoShell>
    );
  }

  // 变更同步回数据源，保证列表页状态一致
  const update = (patch: Partial<Contract>) => {
    setC((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      Object.assign(src!, next);
      return next;
    });
  };

  const steps = c.seal === "online" ? ONLINE_STEPS : OFFLINE_STEPS;
  const daysLeft = daysToEnd(c);
  /** 签署进度：只有进入「待用章 / 签署中 / 已生效」才推进签署链路；审批中 / 待出合同等前置阶段双链路均未开始（-1 = 无当前节点） */
  const signing = c.status === "待用章" || c.status === "签署中" || c.status === "已生效";
  const signStep = signing ? (c.step >= 4 ? 4 : c.step) : -1;

  const advance = () => {
    if (c.step >= 3) {
      update({ status: "已生效", step: 4 });
      // 合同生效 → 关联商机自动「赢单」关闭（客户 → 商机 → 特批 → 合同 链路闭环）
      if (c.dealId) updateOpp(c.dealId, { stage: "赢单" });
      // 续签衔接：续签合同生效时，源合同自动「已终止」+ 版本留痕，其订阅置「退订」停止出账（防新旧合同双算）
      if (c.renewOf) {
        const srcContract = CONTRACTS.find((x) => x.id === c.renewOf);
        if (srcContract && srcContract.status === "已生效") {
          srcContract.status = "已终止";
          srcContract.terminateReason = `到期续签由 ${c.id} 承接（自动终止，停止出账）`;
          srcContract.versions.push({ v: srcContract.versions.length + 1, note: `合同到期续签：由新合同 ${c.id} 承接，本合同自动终止并停止订阅出账`, at: DEMO_TODAY });
          getSubscriptions().filter((s) => s.contractNo === srcContract.id).forEach((s) => updateSubscription(s.subNo, { status: "退订" }));
        }
      }
    } else if (c.step === 0) {
      update({ status: "签署中", step: 1 });
    } else {
      update({ step: c.step + 1 });
    }
  };

  const ACTION_LABEL: Record<string, string> = {
    "0-online": "推送至契约锁",
    "1-online": "完成我方签署（企业电子章）",
    "2-online": "客户签署完成并回传",
    "3-online": "确认双方签署版归档",
    "0-offline": "用章申请通过（印章管理员受理）",
    "1-offline": "上传「我方已盖章」附件",
    "2-offline": "客户已签字盖章，标记回签",
    "3-offline": "上传双方签署扫描件（质检通过）",
  };

  const terminate = () => {
    if (window.confirm("确认客户拒签？合同将置为「已终止」并通知销售。")) update({ status: "已终止", terminateReason: "客户拒签（原型模拟）" });
  };

  const submitRevise = () => {
    const v = c.versions.length + 1;
    update({
      status: "待用章", step: 0,
      versions: [...c.versions, { v, note: `版本 ${v}：${reviseType}修订 — ${reviseNote || "（无说明）"}`, at: DEMO_TODAY }],
    });
    setReviseOpen(false);
    setReviseNote("");
  };

  const discountErr = c.discount > 0 ? checkDiscount(c.discount, c.specialId) : null;

  // 应收账单 = 账单计划：按各订阅开通日滚动展开账期（1 年月付 = 12 期），已出账期关联真实账单，未出账期显示「待出账」
  const INV_CLS: Record<string, string> = {
    已生成: "bg-[#F7F8FA] text-[#4E5969]", 审核中: "bg-[#FFF3E8] text-[#FF7D00]", 已驳回: "bg-[#FFECE8] text-[#F53F3F]",
    已发出: "bg-[#E8F3FF] text-[#165DFF]", 部分收款: "bg-[#FFF3E8] text-[#FF7D00]", 已收讫: "bg-[#E8F8F2] text-[#00B42A]",
    逾期: "bg-[#FFECE8] text-[#F53F3F]", 欠停: "bg-[#FFECE8] text-[#B3261E]", 坏账: "bg-[#F2F3F5] text-[#86909C]",
    待出账: "bg-[#F7F8FA] text-[#86909C]", 未出账: "bg-[#FFF3E8] text-[#FF7D00]",
  };
  const CUR_MONTH = DEMO_TODAY.slice(0, 7);
  const CUR_DAY = DEMO_TODAY;
  const PAY_STEP: Record<string, number> = { 月付: 1, 季度付: 3, 半年付: 6, 年付: 12 };
  const step = PAY_STEP[c.pay] ?? 1;
  interface InvRow { invNo: string; period: string; detail: string; amount: number; received: number; dueDate: string; status: string; expected: boolean }
  const invRows = (() => {
    // 实际账单：在审/已驳回（billing）+ 已登记应收（receivables），按账单号合并
    const actual = new Map<string, InvRow & { ps?: string }>();
    getBills().filter((b) => b.contractNo === c.id).forEach((b) => actual.set(b.invNo, {
      invNo: b.invNo, period: b.period, detail: b.items.map((i) => i.name).join("；"),
      amount: b.amount, received: 0, dueDate: b.dueDate, status: b.status, expected: false, ps: b.periodStart,
    }));
    getInvoices().filter((r) => r.contract === c.id).forEach((r) => {
      const ex = actual.get(r.invNo);
      actual.set(r.invNo, {
        invNo: r.invNo, period: ex?.period ?? r.dueDate.slice(0, 7), detail: ex?.detail ?? r.items.map((i) => i.name).join("；"),
        amount: r.amount, received: r.received, dueDate: r.dueDate, status: r.status, expected: false, ps: ex?.ps,
      });
    });
    const rows: InvRow[] = [];
    const matched = new Set<string>();
    const subs = getSubscriptions().filter((s) => s.contractNo === c.id);
    if (subs.length) {
      // 主路径：按订阅开通日滚动展开账期（与自然月无关，月中开通首月整月收）
      subs.forEach((sub) => {
        for (let idx = 0; idx < 120; idx++) {
          const { start, end } = periodOf(sub, idx);
          const ps = fmtD(start), pe = fmtD(end);
          if (ps > c.end) break;
          const label = `${ps} ~ ${pe}`;
          const hit = [...actual.values()].filter((r) => !matched.has(r.invNo) && r.ps === ps);
          if (hit.length) {
            hit.forEach((r) => { matched.add(r.invNo); rows.push({ ...r, period: label }); });
          } else {
            rows.push({
              invNo: "", period: label, detail: `周期费（预计，${sub.line}）`, amount: sub.monthlyFee, received: 0,
              dueDate: dueDateOf(start, end), status: pe < CUR_DAY ? "未出账" : "待出账", expected: true,
            });
          }
        }
      });
    } else {
      // 兜底：合同暂无订阅时按付款周期展开（月历口径）
      let y = +c.start.slice(0, 4), m = +c.start.slice(5, 7);
      const ey = +c.end.slice(0, 4), em = +c.end.slice(5, 7);
      while (y < ey || (y === ey && m <= em)) {
        const ps = `${y}-${String(m).padStart(2, "0")}`;
        const endD = new Date(y, m - 1 + step, 0);
        const pe = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}`;
        const label = step === 1 ? ps : `${ps} ~ ${pe}`;
        const hit = [...actual.values()].filter((r) => !matched.has(r.invNo) && r.period >= ps && r.period <= pe);
        if (hit.length) {
          hit.forEach((r) => { matched.add(r.invNo); rows.push({ ...r, period: label }); });
        } else {
          rows.push({
            invNo: "", period: label, detail: `周期费（预计，${c.pay}）`, amount: c.amount * step, received: 0,
            dueDate: dueDateOf(new Date(y, m - 1, 1), endD), status: ps <= CUR_MONTH ? "未出账" : "待出账", expected: true,
          });
        }
        const nd = new Date(y, m - 1 + step, 1);
        y = nd.getFullYear(); m = nd.getMonth() + 1;
      }
    }
    // 落在计划外（变更/补录）的实际账单，追加在末尾
    [...actual.values()].filter((r) => !matched.has(r.invNo)).forEach((r) => rows.push(r));
    return rows.sort((a, b) => a.period.localeCompare(b.period));
  })();
  const contractTotal = invRows.reduce((s, r) => s + r.amount, 0);
  const occurred = invRows.filter((r) => r.period.slice(0, 7) <= CUR_MONTH);
  const totalReceived = invRows.reduce((s, r) => s + r.received, 0);
  const totalOutstanding = occurred.reduce((s, r) => s + Math.max(0, r.amount - r.received), 0);
  const billedCount = invRows.filter((r) => !r.expected).length;
  // 催收阶段取 finance.ts 共享口径（与客户 360 / 财务中心严格一致），合同维度只做过滤不做重算
  const COLLECT_CLS: Record<string, string> = { 正常: "bg-[#F2F3F5] text-[#4E5969]", 宽限提醒: "bg-[#FFF3E8] text-[#FF7D00]", 催收跟进: "bg-[#FFECE8] text-[#F53F3F]", 停机预警: "bg-[#F53F3F] text-white", 坏账候选: "bg-[#722ED1] text-white" };
  const cf = customerFinance(c.customer);
  const contractInvNos = new Set(invRows.map((r) => r.invNo).filter(Boolean));
  const contractCollect = cf.collect.filter((x) => contractInvNos.has(x.inv.invNo));
  const contractCollectAmt = contractCollect.reduce((s, x) => s + (x.inv.amount - x.inv.received), 0);

  const submitUpload = () => {
    update({ status: "待用章", step: 0 });
    setUploadOpen(false);
  };

  // 合同申请审批（审批中 / 已驳回 / 留痕展示）
  const approvals = c.approvals ?? [];
  const approvalStep = c.approvalStep ?? 1;
  const pendingApproval = c.status === "审批中" ? approvals[approvalStep - 1] : null;
  const approvePass = () => {
    const cur = approvals[approvalStep - 1];
    const flows = approvals.map((f) => (f.level === cur.level ? { ...f, result: "通过" as const, comment: apprComment || "—", time: "2026-10-27 10:30" } : f));
    setApprComment("");
    if (approvalStep >= approvals.length) {
      update({ status: "待出合同", approvals: flows, approvalStep: approvals.length + 1, versions: [...c.versions, { v: c.versions.length + 1, note: "合同申请审批通过，转业务支撑部出具正式合同", at: "2026-10-27" }] });
    } else {
      update({ approvals: flows, approvalStep: approvalStep + 1 });
    }
  };
  const approveReject = () => {
    const cur = approvals[approvalStep - 1];
    const flows = approvals.map((f) => (f.level === cur.level ? { ...f, result: "驳回" as const, comment: apprComment, time: "2026-10-27 10:30" } : f));
    setApprComment("");
    update({ status: "已驳回", approvals: flows, terminateReason: `合同申请被${cur.role}驳回：${apprComment}` });
  };

  return (
    <ArcoShell breadcrumb={`合同管理 / ${c.id}`}>
      <main className="space-y-4 p-6">
        {/* 头部信息带 */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-lg font-semibold text-[#1D2129]">{c.id}</span>
            <span className={`rounded-[2px] px-2 py-0.5 text-xs ${STATUS_CLS[c.status]}`}>{c.status}</span>
            <span className="text-sm text-[#4E5969]">{c.customer}</span>
            {c.status === "已生效" && (daysLeft <= 30
              ? <span className="rounded-[2px] bg-[#FFECE8] px-2 py-0.5 text-xs text-[#F53F3F]">⚠ 将于 {c.end} 到期（剩 {daysLeft} 天），需立即启动续签谈判</span>
              : daysLeft <= 90
                ? <span className="rounded-[2px] bg-[#FFF3E8] px-2 py-0.5 text-xs text-[#FF7D00]">将于 {c.end} 到期（剩 {daysLeft} 天），可启动续签谈判</span>
                : <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-0.5 text-xs text-[#00701A]">到期还有 {daysLeft} 天 · 回收倒计时已启动</span>)}
            {c.terminateReason && <span className="text-xs text-[#B3261E]">{c.terminateReason}</span>}
            <div className="ml-auto flex gap-2">
              {c.status === "已生效" && daysLeft <= 90 && (
                <Button size="sm" onClick={() => navigate(`/contract/edit?renew=${c.id}`)}>发起续签</Button>
              )}
              {(c.status === "待用章" || c.status === "签署中") && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setReviseOpen(true)}>条款修改</Button>
                  <Button size="sm" variant="outline" className="text-[#F53F3F]" onClick={terminate}>客户拒签</Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => navigate("/contract")}>返回列表</Button>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs md:grid-cols-4">
            {[
              ["月租合计", `${fmtMoney(c.amount)} 元/月`], ["付款方式", c.pay],
              ["签约主体", ""],
              ["折扣", c.discount ? `${c.discount}%` : "标准"], ["用章方式", c.seal === "online" ? "线上 · 契约锁" : "线下 · 实物章"],
              ["合同期限", `${c.start} ~ ${c.end}`],
              ["关联商机", ""],
              ["关联特批单", c.specialId ? "" : "无（标准合同）"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-dashed border-[#F2F3F5] py-1"><dt className="text-[#86909C]">{k}</dt><dd className="font-medium text-[#1D2129]">
                {v}
                {k === "签约主体" && (
                  <span title={`${entity.fullName} · 税号 ${entity.taxNo} · 收款 ${entity.bank} ${entity.account}`}>
                    <Link to="/system/entities" className="text-[#165DFF] hover:underline">{entity.shortName}</Link>
                    <span className="ml-1 text-[10px] font-normal text-[#86909C]">{entity.nature}</span>
                  </span>
                )}
                {k === "关联商机" && (c.dealId ? (
                  <><Link to="/opportunity" className="font-mono text-[#165DFF] hover:underline">{c.dealId}</Link><span className="ml-1 text-[10px] font-normal text-[#86909C]">{GET_OPP(c.dealId)?.name ?? ""}</span></>
                ) : "—")}
                {k === "关联特批单" && c.specialId && <Link to="/special" className="font-mono text-[#165DFF] hover:underline">{c.specialId}</Link>}
                {k === "关联特批单" && c.specialId && <span className="ml-1 text-[10px] font-normal text-[#86909C]">{(() => { const sp = SPECIALS.find((s) => s.id === c.specialId); const d = sp ? GET_OPP(sp.dealId) : null; return d ? `· ${d.name}` : ""; })()}</span>}
              </dd></div>
            ))}
          </dl>
          {/* 主体抬头与用印 */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#4E5969]">
            <span className="text-[#86909C]">合同抬头：</span><span className="font-medium text-[#1D2129]">{entity.fullName}</span>
            <span className="mx-1 text-[#C9CDD4]">|</span>
            <span className="text-[#86909C]">税号：</span><span className="font-mono">{entity.taxNo}</span>
            <span className="mx-1 text-[#C9CDD4]">|</span>
            <span className="text-[#86909C]">{c.seal === "online" ? "电子章" : "实物章"}：</span>
            <span className="rounded-[2px] border border-[#165DFF] px-1.5 py-0.5 text-[#165DFF]">
              {entity.seals.find((s) => s.type === "合同专用章")?.name ?? entity.seals[0]?.name}
            </span>
          </div>
        </div>

        {/* 签署双链路 */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Lane title="线上链路（契约锁）" steps={ONLINE_STEPS} active={c.seal === "online"} step={c.seal === "online" ? signStep : -1} color="#165DFF" />
          <Lane title="线下链路（实物章）" steps={OFFLINE_STEPS} active={c.seal === "offline"} step={c.seal === "offline" ? signStep : -1} color="#FF7D00" />
        </div>

        {/* 合同申请审批：提交后先走审批流，通过后才进入待出合同 */}
        {c.status === "审批中" && (
          <div className="rounded-[4px] border border-[#BEDAFF] bg-[#F7FAFF] px-4 py-3">
            <div className="mb-2 text-xs font-semibold text-[#165DFF]">合同申请审批中（审批通过 = 转「待出合同」，由业务支撑部出具正式合同）</div>
            <div className="flex flex-wrap items-center gap-2">
              {approvals.map((n, i) => (
                <div key={n.level} className="flex items-center gap-2">
                  <span className={`rounded-[2px] px-2 py-1 text-[11px] ${
                    n.result === "通过" ? "bg-[#E8F8F2] text-[#00B42A]" :
                    n.result === "驳回" ? "bg-[#FFECE8] text-[#F53F3F]" :
                    i === approvalStep - 1 ? "bg-[#165DFF] text-white" : "bg-[#F2F3F5] text-[#86909C]"
                  }`}>
                    {n.result === "通过" ? "✓ " : ""}{n.level}. {n.name}
                  </span>
                  {i < approvals.length - 1 && <span className="text-[#C9CDD4]">→</span>}
                </div>
              ))}
            </div>
            {pendingApproval && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#BEDAFF] pt-3">
                <span className="text-xs text-[#4E5969]">当前待审：<strong>{pendingApproval.name}</strong>（条件：{pendingApproval.role === "财务负责人" ? "非标合同（折扣 > 0）" : "总是"}）</span>
                <Input className="w-64" placeholder="审批意见（驳回时必填）" value={apprComment} onChange={(e) => setApprComment(e.target.value)} />
                <Button size="sm" onClick={approvePass}>通过</Button>
                <Button size="sm" variant="outline" className="text-[#F53F3F]"
                  onClick={() => apprComment.trim() ? approveReject() : alert("驳回必须填写审批意见")}>驳回</Button>
              </div>
            )}
          </div>
        )}

        {/* 已驳回：可修改后重新发起 */}
        {c.status === "已驳回" && (
          <div className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[#FBACA3] bg-[#FFECE8] px-4 py-3">
            <span className="text-xs text-[#B3261E]">合同申请被驳回：{c.terminateReason?.replace("合同申请被", "").split("：")[1] ?? "—"}（驳回留痕保留在审批链中）</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/contract/edit")}>修改后重新发起</Button>
          </div>
        )}

        {/* 待出合同：业务支撑部出具正式合同并上传 */}
        {c.status === "待出合同" && (
          <div className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[#7BD9A8] bg-[#E8F8F2] px-4 py-3">
            <span className="text-xs text-[#00701A]">合同申请审批已通过（{c.id}），业务支撑部出具正式合同并上传后进入「待用章」。审批留痕见下方版本历史。</span>
            <Button size="sm" onClick={() => setUploadOpen(true)}>上传正式合同附件（业务支撑部）</Button>
          </div>
        )}

        {/* 当前步骤动作 */}
        {(c.status === "待用章" || c.status === "签署中") && (
          <div className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[#BEDAFF] bg-[#F7FAFF] px-4 py-3">
            <span className="text-xs text-[#4E5969]">当前步骤：<span className="font-semibold text-[#165DFF]">{steps[Math.min(c.step, 3)]}</span>（{c.step + 1}/4）</span>
            <Button size="sm" onClick={advance}>{c.step >= 3 ? "签署完成 → 合同已生效" : ACTION_LABEL[`${c.step}-${c.seal}`]}</Button>
            {c.seal === "online" && c.step === 0 && (
              <button className="text-xs text-[#F53F3F] hover:underline" onClick={() => alert("模拟：契约锁接口失败 → 合同状态本地保留，进入接口异常队列，可手动标记已完成")}>模拟接口异常</button>
            )}
            {c.seal === "online" && c.step === 2 && (
              <button className="text-xs text-[#86909C] hover:underline" onClick={() => alert("已发送催签短信/邮件给客户（mock）")}>催签</button>
            )}
            {c.seal === "offline" && c.step === 3 && (
              <button className="text-xs text-[#F53F3F] hover:underline" onClick={() => alert("模拟：扫描件质检不合格 → 驳回重传，仍停留本步骤")}>模拟质检不合格</button>
            )}
            <span className="ml-auto text-[10px] text-[#86909C]">契约锁为 mock：按钮推进状态，接口联调留待正式开发</span>
          </div>
        )}

        {/* 待修订指引 */}
        {c.status === "待修订" && (
          <div className="rounded-[4px] border border-[#FFCF8B] bg-[#FFF7E8] px-4 py-3 text-xs leading-5 text-[#B25E00]">
            合同处于「待修订」：纯笔误由业务支撑部门直接修订；涉及折扣率 / 特殊条款变化（非标）必须重新发起特批。
            <button className="ml-2 text-[#165DFF] hover:underline" onClick={() => setReviseOpen(true)}>去修订 →</button>
            <Link className="ml-2 text-[#165DFF] hover:underline" to="/special">去发起特批 →</Link>
          </div>
        )}

        {/* 已生效后续动作 */}
        {c.status === "已生效" && (
          <div className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[#7BD9A8] bg-[#E8F8F2] px-4 py-3">
            <span className="text-xs text-[#00701A]">合同已生效：订单同步生效，可进入成本核算与开通交付。</span>
            <Link to={`/?contract=${c.id}`}><Button size="sm">进入成本核算（带入订单行）</Button></Link>
            <Link to="/delivery"><Button size="sm" variant="outline">查看开通工单</Button></Link>
            <Link to="/lifecycle"><Button size="sm" variant="outline">变更 / 退订</Button></Link>
          </div>
        )}

        {/* 订单行 + 版本历史 */}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white">
            <div className="border-b px-4 py-2.5 text-sm font-semibold text-[#1D2129]">订单行（合同生效即订单生效）</div>
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th className="px-3 py-1.5">类别 / 产品类型</th><th className="px-3 py-1.5">规格</th><th className="px-3 py-1.5 text-right">月租</th></tr></thead>
              <tbody>
                {c.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2"><div className="font-medium text-[#1D2129]">{l.ptype}</div><div className="text-[10px] text-[#86909C]">{l.cat}</div></td>
                    <td className="px-3 py-2 text-[#4E5969]">{l.spec}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(l.price)}</td>
                  </tr>
                ))}
                <tr className="font-semibold"><td colSpan={2} className="px-3 py-2 text-right">合计</td><td className="px-3 py-2 text-right font-mono">{fmtMoney(c.amount)} 元/月</td></tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-[#1D2129]">版本历史</div>
            <div className="space-y-2">
              {[...c.versions].reverse().map((v) => (
                <div key={v.v} className="flex items-start gap-2 text-xs">
                  <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 font-mono text-[10px] text-[#4E5969]">v{v.v}</span>
                  <div><div className="text-[#1D2129]">{v.note}</div><div className="text-[10px] text-[#86909C]">{v.at}</div></div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-[#F2F3F5] pt-2 text-[10px] leading-4 text-[#86909C]">
              特殊条款{ c.terms ? <span className="text-[#4E5969]">：{c.terms}</span> : "：标准合同，无特殊条款"}<br />
              双方签署版文件自动存档；每次修订重新上传、重新用章。
            </div>
          </div>
        </div>

        {/* 应收账单：按账期聚合本合同全部账单（在审 + 已登记应收），收款进度一屏看完 */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white">
          <div className="flex items-center gap-3 border-b px-4 py-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">应收账单</span>
            <span className="text-[11px] text-[#86909C]">账单计划：按{c.pay}展开共 {invRows.length} 期，已出账 {billedCount} 张</span>
            <span className="ml-auto flex gap-4 text-[11px]">
              <span className="text-[#86909C]">合同总额<strong className="ml-1 text-[#1D2129]">{fmtMoney(contractTotal)} 元</strong></span>
              <span className="text-[#86909C]">已收<strong className="ml-1 text-[#00B42A]">{fmtMoney(totalReceived)} 元</strong></span>
              <span className="text-[#86909C]">已发生未收<strong className="ml-1 text-[#FF7D00]">{fmtMoney(totalOutstanding)} 元</strong></span>
              {contractCollect.length > 0 && (
                <Link to="/finance?tab=collect" className="rounded-[2px] bg-[#FFECE8] px-2 py-0.5 text-[#F53F3F] hover:underline">
                  催收中 {contractCollect.length} 笔 · 余额 {fmtMoney(contractCollectAmt)} 元
                </Link>
              )}
              <Link to="/finance?tab=ledger" className="text-[#165DFF] hover:underline">客户账单 →</Link>
              <Link to="/finance?tab=pay" className="text-[#165DFF] hover:underline">收款管理 →</Link>
            </span>
          </div>
          {invRows.length ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-1.5">账期</th><th className="px-3 py-1.5">账单号</th><th className="px-3 py-1.5">明细</th>
                  <th className="px-3 py-1.5 text-right">应收金额</th><th className="px-3 py-1.5 text-right">已收</th>
                  <th className="px-3 py-1.5 text-right">未收余额</th><th className="px-3 py-1.5">应收日</th><th className="px-3 py-1.5">状态</th><th className="px-3 py-1.5">催收阶段</th>
                </tr>
              </thead>
              <tbody>
                {invRows.map((r, i) => (
                  <tr key={r.invNo || `exp-${i}`} className={`border-b last:border-0 hover:bg-[#F7F8FA] ${r.expected ? "text-[#86909C]" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2 text-[#4E5969]">{r.period}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-[#165DFF]">{r.invNo || "—"}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-[#4E5969]" title={r.detail}>{r.detail}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.amount)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#00B42A]">{r.received ? fmtMoney(r.received) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#FF7D00]">{!r.expected && r.amount - r.received > 0 ? fmtMoney(r.amount - r.received) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[#86909C]">{r.dueDate}</td>
                    <td className="px-3 py-2"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${INV_CLS[r.status] ?? "bg-[#F2F3F5] text-[#4E5969]"}`}>{r.status}</span></td>
                    <td className="px-3 py-2">{(() => { const col = contractCollect.find((x) => x.inv.invNo === r.invNo); return col ? <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${COLLECT_CLS[col.stage]}`}>{col.stage} · {col.days} 天{col.broken ? " · 破约" : ""}</span> : <span className="text-[10px] text-[#C9CDD4]">—</span>; })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center text-xs text-[#86909C]">
              本合同暂无账单计划。账单由计费模块按账期扫描生成（财务 → 客户账单 → 账期出账），审核通过并发出后自动登记到此。
            </div>
          )}
        </div>
      </main>

      {/* 上传正式合同弹窗（业务支撑部） */}
      {uploadOpen && (
        <CenterModal title={`上传正式合同（${c.id}）`} onClose={() => setUploadOpen(false)} width={480}>
          <div className="space-y-3 text-xs">
            <div className="rounded-[4px] bg-[#F7FAFF] px-3 py-2 leading-5 text-[#4E5969]">
              销售已提交合同申请。请业务支撑部核对订单行与特批结果，出具正式合同文本并上传；上传登记后合同进入「待用章」。
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">折扣校验</div>
              <div className={`rounded-[2px] border px-3 py-2 ${discountErr ? "border-[#F53F3F] bg-[#FFECE8] text-[#B3261E]" : "border-[#7BD9A8] bg-[#E8F8F2] text-[#00701A]"}`}>
                {discountErr ? discountErr : (c.discount > 0 ? `校验通过：关联特批单 ${c.specialId}（折扣 ${c.discount}%）` : "标准合同（折扣率 0%），无需特批")}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">正式合同附件</div>
              <button onClick={() => setUploaded(true)} className={`w-full rounded-[2px] border border-dashed px-3 py-4 text-center ${uploaded ? "border-[#165DFF] bg-[#F7FAFF] text-[#165DFF]" : "border-[#C9CDD4] text-[#86909C] hover:border-[#165DFF]"}`}>
                {uploaded ? `✓ HT-2026-024-正式合同.pdf 已上传（mock，点击可更换）` : "点击上传双方确认版合同（mock）"}
              </button>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setUploadOpen(false)}>取消</Button>
              <Button size="sm" disabled={!!discountErr || !uploaded} onClick={submitUpload}>完成登记 → 进入待用章</Button>
            </div>
            {discountErr && <div className="text-center text-[10px] text-[#86909C]">折扣校验未通过时禁止登记，请先处理特批或修正折扣率</div>}
          </div>
        </CenterModal>
      )}

      {/* 修订弹窗 */}
      {reviseOpen && (
        <CenterModal title={`修订合同（${c.id}）`} onClose={() => setReviseOpen(false)} width={480}>
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-1.5 font-semibold text-[#4E5969]">修订类型</div>
              {(["笔误", "非标"] as const).map((t) => (
                <label key={t} className={`mb-1.5 flex cursor-pointer items-start gap-2 rounded-[4px] border p-2.5 ${reviseType === t ? "border-[#165DFF] bg-[#F7FAFF]" : "border-[#E5E6EB]"}`}>
                  <input type="radio" className="mt-0.5 accent-[#165DFF]" checked={reviseType === t} onChange={() => setReviseType(t)} />
                  <span>
                    <span className="font-medium text-[#1D2129]">{t === "笔误" ? "纯笔误" : "涉及非标内容（折扣率 / 特殊条款变化）"}</span><br />
                    <span className="text-[#86909C]">{t === "笔误" ? "业务支撑部门直接修订，不走特批" : "必须重新发起特批，通过后才能重新生成合同"}</span>
                  </span>
                </label>
              ))}
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">修订说明（留痕）</div>
              <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={3} value={reviseNote} onChange={(e) => setReviseNote(e.target.value)} />
            </div>
            {reviseType === "非标" && <div className="rounded-[2px] bg-[#FFF3E8] px-3 py-2 text-[#B25E00]">修订提交后合同回到「待用章」前需先完成新特批。<Link className="text-[#165DFF] hover:underline" to="/special">现在去发起特批 →</Link></div>}
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setReviseOpen(false)}>取消</Button>
              <Button size="sm" onClick={submitRevise}>提交修订（重新上传、重新用章，版本 +1）</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
