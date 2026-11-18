// A2 审批中心（/approval）—— 消费统一审批引擎：全单据类型审批实例列表；
// 核算单实例 → 专属详情（两部门填报汇总）；其他单据（采购单 / 坏账申请等）→ 通用实例处理视图。
// 通过 / 驳回统一走引擎 approveInstance / rejectInstance，结果经写回注册表真实写回业务单据。
import { useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SHEETS, SHEET_ENTRIES, entriesOfSheet, fmt } from "@/data/sheets";
import { CONTRACTS, SPECIALS } from "@/data/contracts";
import { GET_OPP } from "@/data/customers";
import { useApprovalFlow, getInstances, approveInstance, rejectInstance, submitForApproval, nodeLabel, FIELD_DEFS, type ApprovalInstance } from "@/data/approvalFlow";
import { currentUser } from "@/data/users";
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const INST_COLOR: Record<ApprovalInstance["status"], string> = {
  审批中: "bg-[#E8F3FF] text-[#165DFF]",
  已通过: "bg-[#E8F8F2] text-[#00B42A]",
  已驳回: "bg-[#FFECE8] text-[#F53F3F]",
};
const FILTERS: ("全部" | ApprovalInstance["status"])[] = ["全部", "审批中", "已通过", "已驳回"];
const DOC_COLOR: Record<string, string> = {
  "成本核算单 · 提交": "bg-[#E8F3FF] text-[#165DFF]",
  "采购单 · 提交": "bg-[#E8F8F2] text-[#00B42A]",
  "坏账申请单 · 提交": "bg-[#FFECE8] text-[#F53F3F]",
  "付款申请单 · 提交": "bg-[#FEF0FF] text-[#722ED1]",
};

/** 列表业务字段：核算单走「核算单 → 合同 → 商机」链路取数（老合同无 dealId 时经关联特批单回溯商机）；
 *  坏账取摘要中的客户；采购/付款为供应商侧业务，无客户商机 */
function bizOf(i: ApprovalInstance): { customer: string; opp: string; contractNo: string } {
  if (i.docType.includes("核算单")) {
    const sheet = SHEETS.find((s) => s.id === i.docId);
    const contract = sheet ? CONTRACTS.find((c) => sheet.contract.includes(c.id)) : undefined;
    const dealId = contract?.dealId
      ?? (contract?.specialId ? SPECIALS.find((s) => s.id === contract.specialId)?.dealId : undefined);
    const opp = dealId ? GET_OPP(dealId) : undefined;
    return {
      customer: sheet?.customer ?? "—",
      opp: opp?.name ?? "—",
      contractNo: contract?.id ?? (sheet?.contract.match(/HT-\d+-\d+/)?.[0] ?? "—"),
    };
  }
  if (i.docType.includes("坏账")) return { customer: i.summary.split(" · ")[0], opp: "—", contractNo: "—" };
  return { customer: "—", opp: "—", contractNo: "—" };
}

/** 列表「摘要」（业务内容）：核算单 → 订单行产品构成（不带客户名）；其他单据 → 摘要原文 */
function contentOf(i: ApprovalInstance): string {
  if (!i.docType.includes("核算单")) return i.summary;
  const sheet = SHEETS.find((s) => s.id === i.docId);
  let t = titleOf(i);
  if (sheet?.customer && t.startsWith(sheet.customer)) t = t.slice(sheet.customer.length).replace(/^\s*·\s*/, "");
  return t.replace(/\s*·\s*成本核算(单)?$/, "") || i.summary;
}

/** 列表「名称」：优先实例自带标题（提交时写入，对应正式库表 subject 字段）；存量无标题实例按单据类型兼容推导 */
function titleOf(i: ApprovalInstance): string {
  if (i.title) return i.title;
  if (!i.docType.includes("核算单")) return i.summary;
  const sheet = SHEETS.find((s) => s.id === i.docId);
  const recs = entriesOfSheet(i.docId) ?? (i.docId === "CE-2026-1008" ? SHEET_ENTRIES : null);
  const lines = [...new Set((recs ?? []).map((e) => e.line)
    .filter((l) => l.includes(" · "))  // 跳过「L1」「L1+L2」这类汇总行，只取真实订单行
    .map((l) => l.replace(/^L\w+ · /, "").replace(/（[^（）]*）$/, "").trim()))];
  return lines.length ? `${sheet?.customer ?? ""} · ${lines.join("；")} · 成本核算` : i.summary;
}

/** 选用资源串 → 逐项列表（顿号/分号分隔的多资源摊平，结构化逐条展示） */
const splitRes = (s: string) => s.split(/[、；;]/).map((x) => x.trim()).filter(Boolean);
/** 演算说明 → 逐项公式（按全角 ＋ 拆分行项，与选用列表同构对照） */
const splitCalc = (s: string) => s.split(/＋/).map((x) => x.trim()).filter(Boolean);

/** 审批链时间线 + 审批操作 + 流转记录（核算单专属详情与通用实例详情共用） */
function InstancePanel({ inst, doneText }: { inst: ApprovalInstance; doneText?: ReactNode }) {
  const [comment, setComment] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reMsg, setReMsg] = useState<string | null>(null);
  const act = (fn: (id: string, by: string, cmt: string) => string | null, cmt: string) => {
    const err = fn(inst.id, currentUser()?.name ?? "当前登录人", cmt);
    setMsg(err);
    if (!err) { setComment(""); setRejectOpen(false); }
  };
  return (
    <section className="space-y-3">
      <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
        <div className="mb-3 text-sm font-semibold">
          审批链（
          {inst.status === "已通过" ? "已完成" :
           inst.status === "已驳回" ? <span className="text-[#F53F3F]">已驳回 · 流程终止</span> :
           `当前：${nodeLabel(inst.snapshot.nodes[inst.curNodeIdx])}`}
          ）
        </div>
        <ol className="space-y-0">
          {inst.snapshot.nodes.map((n, i) => {
            const state = inst.status === "已通过" || i < inst.curNodeIdx ? "done" : inst.status === "已驳回" && i === inst.curNodeIdx ? "reject" : i === inst.curNodeIdx ? "cur" : "wait";
            return (
              <li key={i} className="flex gap-2">
                <div className="flex flex-col items-center">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    state === "done" ? "bg-[#00B42A] text-white" : state === "cur" ? "bg-[#165DFF] text-white" : state === "reject" ? "bg-[#F53F3F] text-white" : "bg-[#E5E6EB] text-[#4E5969]"}`}>
                    {state === "done" ? "✓" : state === "reject" ? "✕" : i + 1}
                  </span>
                  {i < inst.snapshot.nodes.length - 1 && <span className={`h-5 w-px ${state === "done" ? "bg-[#00B42A]" : "bg-[#E5E6EB]"}`} />}
                </div>
                <div className="pb-3">
                  <div className={`text-xs font-medium ${state === "cur" ? "text-[#165DFF]" : state === "reject" ? "text-[#F53F3F]" : "text-[#4E5969]"}`}>{nodeLabel(n)}</div>
                  <div className="text-[10px] text-[#86909C]">{n.approverSource} · {n.mode} · 时限 {n.timeoutHours}h</div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 rounded-[2px] bg-[#E8F3FF] px-2 py-1.5 text-[11px] leading-4 text-[#165DFF]">
          审批通过 = 单据生效（结果自动写回业务单据）；驳回 = 按分支「{inst.snapshot.rejectPolicy}」退回，意见必填并通知发起人。
        </div>
      </div>

      <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
        <div className="mb-2 text-sm font-semibold">审批意见</div>
        <Input placeholder="审批意见（驳回时必填）" value={comment} onChange={(e) => setComment(e.target.value)} />
        {msg && <div className="mt-2 rounded-[2px] bg-[#FFECE8] px-2 py-1 text-[11px] text-[#F53F3F]">{msg}</div>}
        <div className="mt-2 flex gap-2">
          {inst.status === "审批中" ? (
            <>
              <Button size="sm" className="flex-1" onClick={() => act(approveInstance, comment)}>通过</Button>
              <Button size="sm" variant="outline" className="flex-1 text-[#F53F3F]" onClick={() => setRejectOpen(true)}>驳回</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => alert("原型演示：转交给其他审批人（正式环境弹出人员选择器，留痕）")}>转交</Button>
            </>
          ) : inst.status === "已通过" ? (
            <div className="w-full rounded-[2px] bg-[#E8F8F2] px-3 py-2 text-center text-xs text-[#00B42A]">{doneText ?? "审批完成 · 结果已写回业务单据"}</div>
          ) : inst.status === "已驳回" ? (
            <div className="w-full space-y-2">
              <div className="w-full rounded-[2px] bg-[#FFECE8] px-3 py-2 text-center text-xs text-[#F53F3F]">已驳回 · 单据按「{inst.snapshot.rejectPolicy}」退回发起人</div>
              <Button size="sm" className="w-full" onClick={() => {
                // 原样重报：按本实例的快照上下文发起新审批实例（引擎幂等——在途实例不重复建；原驳回实例保留留痕）
                const r = submitForApproval(inst.docType, inst.docId, inst.summary, inst.ctx, currentUser()?.name ?? inst.submitter, inst.title);
                if (r.hit && r.instance) setReMsg(`已重新提交 → 新审批实例 ${r.instance.id}（原实例 ${inst.id} 保留留痕；如需修改填报内容，请回业务单据页调整后提交）`);
                else setReMsg(r.reason ?? "未命中审批流，请检查审批流配置");
              }}>重新提交（原样重报）</Button>
              {reMsg && <div className="rounded-[2px] bg-[#E8F8F2] px-2 py-1.5 text-[11px] leading-4 text-[#00701A]">{reMsg}</div>}
            </div>
          ) : (
            <div className="w-full rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-center text-xs text-[#4E5969]">当前状态不可审批</div>
          )}
        </div>
        {rejectOpen && (
          <div className="mt-2 rounded-[2px] border border-[#FBACA3] bg-[#FFECE8] p-2 text-xs text-[#F53F3F]">
            确认驳回该单据？按「{inst.snapshot.rejectPolicy}」退回，需重新提交。
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="destructive" disabled={!comment.trim()} onClick={() => act(rejectInstance, comment)}>确认驳回</Button>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(false)}>取消</Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
        <div className="mb-2 text-sm font-semibold">流转记录</div>
        {!inst.results.length && <div className="py-3 text-center text-[11px] text-[#C9CDD4]">暂无流转记录</div>}
        <ol className="space-y-2 text-[11px]">
          {inst.results.map((r, i) => (
            <li key={i} className={`border-l-2 pl-2 ${r.action === "通过" ? "border-[#00B42A]" : "border-[#F53F3F]"}`}>
              <span className={`font-medium ${r.action === "通过" ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>{r.action}</span>
              <span className="text-[#4E5969]"> · {r.nodeLabel} · {r.by}</span>
              <div className="text-[#86909C]">{r.time}{r.comment && r.comment !== "—" ? ` · ${r.comment}` : ""}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function Approval() {
  useApprovalFlow();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [selId, setSelId] = useState<string | null>(sp.get("id"));
  const inst: ApprovalInstance | undefined = getInstances().find((i) => i.id === selId);
  const sheet = inst ? SHEETS.find((s) => s.id === inst.docId) : undefined;

  const [st, setSt] = useState<"全部" | ApprovalInstance["status"]>("全部");
  const [kw, setKw] = useState("");
  const rows = getInstances().filter((i) =>
    (st === "全部" || i.status === st) &&
    (!kw || i.docId.includes(kw) || i.summary.includes(kw) || titleOf(i).includes(kw) || i.flowName.includes(kw) || i.docType.includes(kw)
      || bizOf(i).customer.includes(kw) || bizOf(i).opp.includes(kw) || bizOf(i).contractNo.includes(kw)));

  const open = (id: string) => setSelId(id);
  const back = () => setSelId(null);

  /** 条目快照：优先该核算单提交时留存的填报数据；无快照的存量单（如演示单 CE-2026-1008）回退共享演示数据 */
  const recEntries = inst && sheet ? entriesOfSheet(sheet.id) : null;
  const viewEntries: { dept: string; line: string; item: string; amount: number; note: string; pendingLink?: boolean; spec?: string; costType?: string }[] =
    recEntries ?? (sheet?.id === "CE-2026-1008" ? SHEET_ENTRIES : []);
  const monthlyCost = viewEntries.reduce((s, e) => s + e.amount, 0);
  const opsSum = viewEntries.filter((e) => e.dept === "业务支撑部").reduce((s, e) => s + e.amount, 0);
  const techSum = viewEntries.filter((e) => e.dept === "技术部").reduce((s, e) => s + e.amount, 0);

  /** 合同期财务测算（全周期口径）：期限优先取合同档案起止日期，其次回退核算单「· N 个月」文本 */
  const contractOfSheet = sheet ? CONTRACTS.find((c) => sheet.contract.includes(c.id)) : undefined;
  const oneTimeCost = viewEntries.filter((e) => e.costType === "一次性").reduce((s, e) => s + e.amount, 0);
  const recurringCost = monthlyCost - oneTimeCost;
  const termParsed = sheet?.contract.match(/(\d+)\s*个月/);
  const termMonths = contractOfSheet
    ? Math.max(1, Math.round((new Date(contractOfSheet.end).getTime() - new Date(contractOfSheet.start).getTime()) / (30.44 * 86400000)))
    : termParsed ? Number(termParsed[1]) : null;
  const monthlyProfit = sheet ? sheet.contractValue - recurringCost : 0;
  const totalCost = termMonths != null ? recurringCost * termMonths + oneTimeCost : null;
  const totalRevenue = sheet && termMonths != null ? sheet.contractValue * termMonths : null;
  const totalProfit = totalCost != null && totalRevenue != null ? totalRevenue - totalCost : null;
  const totalMarginPct = totalRevenue ? (totalProfit! / totalRevenue) * 100 : null;
  const paybackMonths = oneTimeCost > 0 && monthlyProfit > 0 ? oneTimeCost / monthlyProfit : null;

  return (
    <ArcoShell breadcrumb="审批中心">
      {!inst && (
        <main className="space-y-4 p-6">
          <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[#1D2129]">审批中心</span>
              <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                {FILTERS.map((x) => (
                  <button key={x} onClick={() => setSt(x)}
                    className={`rounded-[2px] px-2.5 py-1 text-xs ${st === x ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                    {x}
                  </button>
                ))}
              </div>
              <Input className="w-56" placeholder="搜索单据号 / 摘要 / 审批流" value={kw} onChange={(e) => setKw(e.target.value)} />
              <span className="text-[11px] text-[#86909C]">共 {rows.length} 条审批实例 · 覆盖核算单 / 采购单 / 坏账申请等全部接入单据</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/system/approval")}>审批流配置</Button>
          </div>

          <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2">单据号</th>
                  <th className="px-3 py-2">单据类型</th>
                  <th className="px-3 py-2">客户</th><th className="px-3 py-2">商机</th><th className="px-3 py-2">合同编号</th>
                  <th className="px-3 py-2">摘要</th>
                  <th className="px-3 py-2">审批流 / 分支</th>
                  <th className="px-3 py-2">当前节点</th><th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">提交人 / 时间</th><th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => open(i.id)}>
                    <td className="px-3 py-2.5 font-mono font-medium text-[#165DFF]">{i.docId}</td>
                    <td className="px-3 py-2.5"><Badge className={`${DOC_COLOR[i.docType] ?? "bg-[#F2F3F5] text-[#4E5969]"} hover:bg-inherit`}>{i.docType.replace(" · 提交", "")}</Badge></td>
                    <td className="px-3 py-2.5 font-medium text-[#1D2129]">{bizOf(i).customer}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{bizOf(i).opp}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4E5969]">{bizOf(i).contractNo}</td>
                    <td className="max-w-56 truncate px-3 py-2.5 text-[#86909C]" title={contentOf(i)}>{contentOf(i)}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{i.flowName}<div className="text-[10px] text-[#86909C]">{i.branchName ?? "—"}（{i.snapshot.branch}）</div></td>
                    <td className="px-3 py-2.5 text-[#4E5969]">
                      {i.status === "审批中" ? <span className="text-[#165DFF]">{nodeLabel(i.snapshot.nodes[i.curNodeIdx])}</span> : `${i.results.length} 级已审`}
                    </td>
                    <td className="px-3 py-2.5"><Badge className={`${INST_COLOR[i.status]} hover:bg-inherit`}>{i.status}</Badge></td>
                    <td className="px-3 py-2.5 text-[#86909C]">{i.submitter}<div className="text-[10px]">{i.submitAt}</div></td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); open(i.id); }}>
                        {i.status === "审批中" ? "去审批" : "查看"}
                      </Button>
                      {i.status === "已驳回" && (
                        <Button size="sm" className="ml-1.5" onClick={(e) => {
                          e.stopPropagation();
                          // 快捷重报：按该实例快照上下文原样重新提交，成功后直接打开新审批实例（原实例保留留痕）
                          const r = submitForApproval(i.docType, i.docId, i.summary, i.ctx, currentUser()?.name ?? i.submitter, i.title);
                          if (r.hit && r.instance) open(r.instance.id);
                          else alert(r.reason ?? "未命中审批流，请检查审批流配置");
                        }}>重新提交</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={11} className="px-3 py-10 text-center text-[#86909C]">无匹配审批实例</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {inst && sheet && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-[#E5E6EB] bg-white px-6">
            <button onClick={back} className="py-3 text-[13px] text-[#86909C] hover:text-[#165DFF]">← 返回列表</button>
            <span className="py-3 font-mono text-[14px] text-[#1D2129]">{inst.docId}</span>
            <Badge className={INST_COLOR[inst.status] + " hover:bg-inherit"}>{inst.status}</Badge>
            <span className="min-w-0 py-3 text-xs text-[#86909C]">审批实例 {inst.id} · 流「{inst.flowName}」分支「{inst.branchName ?? "—"}」（{inst.snapshot.branch}）· 提交人 {inst.submitter} {inst.submitAt}</span>
          </div>

          <main className="space-y-4 p-6">
            {/* ① 客户与合同：先于订单行展示——审单先确认「谁的单、哪份合同」 */}
            <section className="rounded-[4px] border border-[#E5E6EB] bg-white px-2 py-3">
              <div className="flex flex-wrap">
                {[
                  { label: "客户", node: <span className="text-sm font-semibold text-[#1D2129]">{sheet.customer}</span> },
                  { label: "合同编号 / 期限", node: (
                      <span className="font-medium">
                        <span className="font-mono text-[13px] text-[#1D2129]">{contractOfSheet?.id ?? sheet.contract.match(/HT-\d+-\d+/)?.[0] ?? sheet.contract}</span>
                        {contractOfSheet && <span className="ml-1 text-[11px] text-[#86909C]">{contractOfSheet.start} ~ {contractOfSheet.end}</span>}
                      </span>
                    ) },
                  { label: "商机", node: <span className="text-sm font-medium">{bizOf(inst).opp}</span> },
                  { label: "提交人 / 时间", node: <span className="text-sm font-medium">{inst.submitter}<span className="ml-1 text-[11px] font-normal text-[#86909C]">{inst.submitAt}</span></span> },
                ].map((c, i) => (
                  <div key={c.label} className={`min-w-0 flex-1 px-4 py-1 ${i > 0 ? "border-l border-[#F2F3F5]" : ""}`}>
                    <div className="text-xs text-[#86909C]">{c.label}</div>
                    <div className="mt-1">{c.node}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ② 订单行：本单核心信息——订单内容随客户合同之后呈现 */}
            {(() => {
              const contract = contractOfSheet;
              const special = contract?.specialId ? SPECIALS.find((s) => s.id === contract.specialId) : undefined;
              const linesOf: { key: string; ptype: string; cat?: string; spec: string; price?: number }[] =
                contract?.lines?.length
                  ? contract.lines.map((l, i) => ({ key: `${i}`, ptype: l.ptype, cat: l.cat, spec: l.spec, price: l.price }))
                  : contentOf(inst).split("；").filter(Boolean).map((t, i) => {
                      const [head, ...rest] = t.split(" · ");
                      return { key: `${i}`, ptype: head ?? t, spec: rest.length ? rest.join(" · ") : t };
                    });
              const totalPrice = linesOf.reduce((s, l) => s + (l.price ?? 0), 0);
              return (
                <section className="overflow-hidden rounded-[4px] border border-[#E5E6EB] bg-white">
                  <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
                    <span className="text-sm font-semibold text-[#1D2129]">订单行</span>
                    <span className="text-[11px] text-[#86909C]">本单交付内容 · 合同生效数据带入，只读</span>
                    <span className="ml-auto text-xs text-[#4E5969]">
                      共 {linesOf.length} 行{totalPrice > 0 && <> · 月租合计 <span className="font-mono font-semibold text-[#165DFF]">¥ {fmt(totalPrice)}</span></>}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-[#F7F8FA] text-left text-xs text-[#86909C]">
                        <th className="w-40 px-4 py-2 font-normal">产品类型</th>
                        <th className="w-36 px-4 py-2 font-normal">类别</th>
                        <th className="px-4 py-2 font-normal">规格</th>
                        <th className="w-32 px-4 py-2 text-right font-normal">月租（元/月）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linesOf.map((l) => (
                        <tr key={l.key} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-medium text-[#1D2129]">{l.ptype}</td>
                          <td className="px-4 py-2.5 text-xs text-[#86909C]">{l.cat ?? "—"}</td>
                          <td className="px-4 py-2.5 text-[13px] text-[#4E5969]">{l.spec}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#1D2129]">{l.price != null ? fmt(l.price) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {special && (
                    <div className="border-t border-[#FFE1BA] bg-[#FFF7E8] px-4 py-2 text-xs leading-5 text-[#B25E00]">
                      关联特批 <span className="font-mono">{special.id}</span>（{special.status}）· 折扣 <span className="font-mono">{special.discount}%</span>
                      {special.terms && <> · {special.terms}</>}
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ③ 审批概览：一行关键指标（客户合同见上方①；无线格盒子，竖向细分隔） */}
            <section className="rounded-[4px] border border-[#E5E6EB] bg-white px-2 py-3">
              <div className="flex flex-wrap">
                {[
                  { label: "月成本（本单核算）", node: (
                    <>
                      <div className="font-mono text-lg font-semibold text-[#1D2129]">¥ {fmt(sheet.monthlyCost)}</div>
                      <div className="mt-0.5 text-[11px] text-[#86909C]">两部门填报：支撑部 ✓ · 技术部 ✓</div>
                    </>
                  ) },
                  { label: "合同月额", node: (
                    <>
                      <div className="font-mono text-lg font-semibold text-[#1D2129]">¥ {fmt(sheet.contractValue)}</div>
                      <div className="mt-0.5 text-[11px] text-[#86909C]">月租合计（合同约定价）</div>
                    </>
                  ) },
                  { label: "月毛利（经常性）", node: (
                    <>
                      <div className={`font-mono text-lg font-semibold ${monthlyProfit >= 0 ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>
                        {monthlyProfit >= 0 ? "+" : "-"}¥ {fmt(Math.abs(monthlyProfit))}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#86909C]">毛利率 {sheet.margin}%</div>
                    </>
                  ) },
                  { label: "一次性投入", node: (
                    <>
                      <div className="font-mono text-lg font-semibold text-[#1D2129]">¥ {fmt(oneTimeCost)}</div>
                      <div className="mt-0.5 text-[11px] text-[#86909C]">
                        {paybackMonths != null ? `静态回收期 ${paybackMonths.toFixed(1)} 个月` : oneTimeCost > 0 ? "CPE / 安装调测等，首月发生" : "本单无一次性投入"}
                      </div>
                    </>
                  ) },
                  { label: "合同期总毛利", node: (
                    <>
                      <div className={`font-mono text-lg font-semibold ${(totalProfit ?? 0) >= 0 ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>
                        {totalProfit != null ? `${totalProfit >= 0 ? "+" : "-"}¥ ${fmt(Math.abs(totalProfit))}` : "—"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#86909C]">
                        {termMonths != null ? `${termMonths} 个月 · 总毛利率 ${totalMarginPct?.toFixed(1)}%` : "合同期限未登记，无法折算"}
                      </div>
                    </>
                  ) },
                ].map((c, i) => (
                  <div key={c.label} className={`min-w-0 flex-1 px-4 py-1 ${i > 0 ? "border-l border-[#F2F3F5]" : ""}`}>
                    <div className="text-xs text-[#86909C]">{c.label}</div>
                    <div className="mt-1">{c.node}</div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
              <section className="space-y-3 lg:col-span-2">
                <div className="rounded-[4px] border border-[#E5E6EB] bg-white ">
                  <div className="border-b px-4 py-2.5 text-sm font-semibold">两部门填报汇总（只读快照，进入审批即锁定不可改）</div>
                  {!viewEntries.length && (
                    <div className="px-4 py-8 text-center text-xs text-[#C9CDD4]">
                      本单无填报条目快照（存量历史单据）：条目明细以核算录入页重新提交后留存的快照为准
                    </div>
                  )}
                  {viewEntries.length > 0 && (
                    <div className="divide-y divide-[#F2F3F5]">
                      {(["业务支撑部", "技术部"] as const).map((dept) => {
                        const list = viewEntries.filter((e) => e.dept === dept);
                        if (!list.length) return null;
                        const deptSum = list.reduce((s, e) => s + e.amount, 0);
                        return (
                          <div key={dept}>
                            <div className="flex flex-wrap items-center gap-2 bg-[#F7F8FA] px-4 py-2">
                              <Badge className={`${dept === "业务支撑部" ? "bg-[#FFF7E8] text-[#FF7D00]" : "bg-[#E8FFFB] text-[#0FC6C2]"} hover:bg-inherit`}>{dept}</Badge>
                              <span className="text-xs text-[#86909C]">{list.length} 个条目</span>
                              <span className="ml-auto font-mono text-sm font-semibold text-[#1D2129]">¥ {fmt(deptSum)}</span>
                            </div>
                            <div className="divide-y divide-[#F7F8FA]">
                              {list.map((e, i) => (
                                <div key={i} className="px-4 py-2.5">
                                  <div className="flex flex-wrap items-baseline gap-2">
                                    <span className="shrink-0 rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 font-mono text-[10px] text-[#86909C]">{e.line.split(" · ")[0]}</span>
                                    <span className="text-sm font-medium text-[#1D2129]">{e.item}</span>
                                    {e.costType === "一次性" && (
                                      <span className="rounded-[2px] border border-[#E5E6EB] px-1.5 py-0.5 text-[10px] text-[#86909C]">一次性</span>
                                    )}
                                    {e.pendingLink && (
                                      <span className="rounded-[2px] border border-[#FFCF8B] bg-[#FFF7E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">待补关联</span>
                                    )}
                                    <span className="ml-auto shrink-0 font-mono text-sm font-semibold text-[#1D2129]">{fmt(e.amount)} 元</span>
                                  </div>
                                  {e.spec && (
                                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-[#4E5969]">
                                      <span className="mt-px shrink-0 rounded-[2px] bg-[#E8F3FF] px-1 py-px text-[10px] text-[#165DFF]">选用</span>
                                      <ul className="min-w-0 flex-1 list-none space-y-0.5 p-0">
                                        {splitRes(e.spec).map((s, j, arr) => (
                                          <li key={j} className="flex gap-1.5">
                                            <span className="shrink-0 text-[#C9CDD4]">{arr.length > 1 ? (j === arr.length - 1 ? "└" : "├") : "·"}</span>
                                            <span className="min-w-0 break-words">{s}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {e.note && (
                                    <div className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-[#86909C]">
                                      <span className="mt-px shrink-0 rounded-[2px] bg-[#F2F3F5] px-1 py-px text-[10px] text-[#86909C]">演算</span>
                                      <ul className="min-w-0 flex-1 list-none space-y-0.5 p-0">
                                        {splitCalc(e.note).map((s, j, arr) => (
                                          <li key={j} className="flex gap-1.5">
                                            <span className="shrink-0 text-[#C9CDD4]">{arr.length > 1 ? (j === arr.length - 1 ? "└" : "├") : "·"}</span>
                                            <span className="min-w-0 break-words">{s}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {viewEntries.some((e) => e.pendingLink) && (
                    <div className="border-t bg-[#FFF7E8] px-4 py-2 text-xs leading-5 text-[#D25F00]">
                      ⚠ 本单含 {viewEntries.filter((e) => e.pendingLink).length} 条手工填入「待补关联」（档案尚未录入的兜底口径，不拦截审批）：签订采购合同 / 资源建档后由填报人补关联真实档案并留痕；实际单价与手工价不一致时触发核算变更复核（P01-8）。
                    </div>
                  )}
                  {viewEntries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t bg-[#F7F8FA] px-4 py-2.5 text-xs">
                      {viewEntries.some((e) => e.costType) ? (
                        <>
                          <span className="text-[#4E5969]">周期性月成本 <span className="font-mono font-semibold text-[#165DFF]">¥ {fmt(viewEntries.filter((e) => e.costType !== "一次性").reduce((s, e) => s + e.amount, 0))}</span></span>
                          <span className="text-[#4E5969]">一次性投入 <span className="font-mono font-semibold text-[#1D2129]">¥ {fmt(viewEntries.filter((e) => e.costType === "一次性").reduce((s, e) => s + e.amount, 0))}</span></span>
                        </>
                      ) : (
                        <span className="text-[#4E5969]">支撑部 ¥ {fmt(opsSum)} ＋ 技术部 ¥ {fmt(techSum)}</span>
                      )}
                      <span className="ml-auto text-[#4E5969]">合计 <span className="font-mono text-sm font-semibold text-[#165DFF]">¥ {fmt(monthlyCost)}</span></span>
                    </div>
                  )}
                </div>
              </section>

              <InstancePanel inst={inst} doneText={<>审批完成 · 系统自动生成开通工单（P02）<a href="/delivery" className="ml-2 text-[#165DFF] underline">查看工单 →</a></>} />
            </div>
          </main>
        </>
      )}

      {inst && !sheet && (
        <>
          <div className="flex items-center gap-6 border-b border-[#E5E6EB] bg-white px-6">
            <button onClick={back} className="py-3 text-[13px] text-[#86909C] hover:text-[#165DFF]">← 返回列表</button>
            <Badge className={`${DOC_COLOR[inst.docType] ?? "bg-[#F2F3F5] text-[#4E5969]"} hover:bg-inherit`}>{inst.docType.replace(" · 提交", "")}</Badge>
            <span className="py-3 font-mono text-[14px] text-[#1D2129]">{inst.docId}</span>
            <span className="py-3 text-[14px] font-medium text-[#1D2129]">{titleOf(inst)}</span>
            <Badge className={INST_COLOR[inst.status] + " hover:bg-inherit"}>{inst.status}</Badge>
            <span className="py-3 text-xs text-[#86909C]">审批实例 {inst.id} · 流「{inst.flowName}」分支「{inst.branchName ?? "—"}」（{inst.snapshot.branch}）· 提交人 {inst.submitter} {inst.submitAt}</span>
          </div>

          <main className="space-y-4 p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="space-y-3 lg:col-span-2">
                <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-sm">
                  <div className="mb-3 text-sm font-semibold">单据信息（提交时快照）</div>
                  <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                    <div><div className="text-xs text-[#86909C]">单据号</div><div className="font-mono font-medium">{inst.docId}</div></div>
                    <div><div className="text-xs text-[#86909C]">单据类型</div><div className="font-medium">{inst.docType}</div></div>
                    <div className="md:col-span-2"><div className="text-xs text-[#86909C]">摘要</div><div className="font-medium">{inst.summary}</div></div>
                    {Object.entries(inst.ctx).map(([k, v]) => {
                      const def = FIELD_DEFS[inst.docType]?.find((f) => f.key === k);
                      return (
                        <div key={k}>
                          <div className="text-xs text-[#86909C]">{def?.label ?? k}</div>
                          <div className="font-mono font-medium">{typeof v === "number" ? v.toLocaleString("zh-CN") : String(v ?? "—")}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] leading-4 text-[#86909C]">
                    审批结果自动写回业务单据：通过 → 单据生效；驳回 → 按分支驳回策略退回发起人修改后重新提交，全程留痕。
                  </div>
                </div>
              </section>

              <InstancePanel inst={inst} />
            </div>
          </main>
        </>
      )}
    </ArcoShell>
  );
}
