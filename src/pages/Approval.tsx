// A2 审批中心（/approval）—— 消费统一审批引擎：全单据类型审批实例列表；
// 核算单实例 → 专属详情（两部门填报汇总）；其他单据（采购单 / 坏账申请等）→ 通用实例处理视图。
// 通过 / 驳回统一走引擎 approveInstance / rejectInstance，结果经写回注册表真实写回业务单据。
import { useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SHEETS, SHEET_ENTRIES, fmt } from "@/data/sheets";
import { useApprovalFlow, getInstances, approveInstance, rejectInstance, nodeLabel, FIELD_DEFS, type ApprovalInstance } from "@/data/approvalFlow";
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

/** 审批链时间线 + 审批操作 + 流转记录（核算单专属详情与通用实例详情共用） */
function InstancePanel({ inst, doneText }: { inst: ApprovalInstance; doneText?: ReactNode }) {
  const [comment, setComment] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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
            <div className="w-full rounded-[2px] bg-[#FFECE8] px-3 py-2 text-center text-xs text-[#F53F3F]">已驳回 · 单据按「{inst.snapshot.rejectPolicy}」退回发起人</div>
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
    (!kw || i.docId.includes(kw) || i.summary.includes(kw) || i.flowName.includes(kw) || i.docType.includes(kw)));

  const open = (id: string) => setSelId(id);
  const back = () => setSelId(null);

  const monthlyCost = SHEET_ENTRIES.reduce((s, e) => s + e.amount, 0);
  const opsSum = SHEET_ENTRIES.filter((e) => e.dept === "业务支撑部").reduce((s, e) => s + e.amount, 0);
  const techSum = SHEET_ENTRIES.filter((e) => e.dept === "技术部").reduce((s, e) => s + e.amount, 0);

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
                  <th className="px-3 py-2">实例号</th><th className="px-3 py-2">单据类型</th>
                  <th className="px-3 py-2">单据号 / 摘要</th><th className="px-3 py-2">审批流 / 分支</th>
                  <th className="px-3 py-2">当前节点</th><th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">提交人 / 时间</th><th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => open(i.id)}>
                    <td className="px-3 py-2.5 font-mono text-[#86909C]">{i.id}</td>
                    <td className="px-3 py-2.5"><Badge className={`${DOC_COLOR[i.docType] ?? "bg-[#F2F3F5] text-[#4E5969]"} hover:bg-inherit`}>{i.docType.replace(" · 提交", "")}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-medium text-[#165DFF]">{i.docId}</div>
                      <div className="text-[#86909C]">{i.summary}</div>
                    </td>
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
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#86909C]">无匹配审批实例</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {inst && sheet && (
        <>
          <div className="flex items-center gap-6 border-b border-[#E5E6EB] bg-white px-6">
            <button onClick={back} className="py-3 text-[13px] text-[#86909C] hover:text-[#165DFF]">← 返回列表</button>
            <span className="py-3 font-mono text-[14px] text-[#1D2129]">{inst.docId}</span>
            <Badge className={INST_COLOR[inst.status] + " hover:bg-inherit"}>{inst.status}</Badge>
            <span className="py-3 text-xs text-[#86909C]">审批实例 {inst.id} · 流「{inst.flowName}」分支「{inst.branchName ?? "—"}」（{inst.snapshot.branch}）· 提交人 {inst.submitter} {inst.submitAt}</span>
          </div>

          <main className="space-y-4 p-6">
            <section className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-sm ">
              <div className="grid gap-x-8 gap-y-2 md:grid-cols-5">
                <div><div className="text-xs text-[#86909C]">客户</div><div className="font-medium">{sheet.customer}</div></div>
                <div><div className="text-xs text-[#86909C]">合同号 / 期限</div><div className="font-medium">{sheet.contract}</div></div>
                <div><div className="text-xs text-[#86909C]">月成本 / 合同月额</div><div className="font-mono font-medium">{fmt(sheet.monthlyCost)} / {fmt(sheet.contractValue)} 元</div></div>
                <div><div className="text-xs text-[#86909C]">毛利参考</div><div className={`font-semibold ${sheet.margin >= 40 ? "text-[#00B42A]" : "text-[#FF7D00]"}`}>{sheet.margin}%</div></div>
                <div><div className="text-xs text-[#86909C]">两部门填报</div><div className="font-medium">支撑部 ✓ · 技术部 ✓</div></div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
              <section className="space-y-3 lg:col-span-2">
                <div className="rounded-[4px] border border-[#E5E6EB] bg-white ">
                  <div className="border-b px-4 py-2.5 text-sm font-semibold">两部门填报汇总（只读快照，进入审批即锁定不可改）</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                        <th className="px-3 py-2">填报部门</th><th className="px-3 py-2">订单行</th><th className="px-3 py-2">成本条目</th>
                        <th className="px-3 py-2 text-right">金额(元)</th><th className="px-3 py-2">演算说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SHEET_ENTRIES.map((e, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2"><Badge className="bg-[#E8F3FF] text-[#165DFF] hover:bg-sky-100">{e.dept}</Badge></td>
                          <td className="px-3 py-2 text-[#4E5969]">{e.line}</td>
                          <td className="px-3 py-2 font-medium text-[#1D2129]">
                            {e.item}
                            {e.pendingLink && <Badge className="ml-1.5 border border-[#FFCF8B] bg-[#FFF7E8] text-[10px] font-normal text-[#FF7D00] hover:bg-[#FFF7E8]">待补关联</Badge>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(e.amount)}</td>
                          <td className="px-3 py-2 text-[#86909C]">{e.note}</td>
                        </tr>
                      ))}
                      {SHEET_ENTRIES.some((e) => e.pendingLink) && (
                        <tr className="border-b bg-[#FFF7E8] last:border-0">
                          <td className="px-3 py-2 text-xs leading-5 text-[#D25F00]" colSpan={5}>
                            ⚠ 本单含 {SHEET_ENTRIES.filter((e) => e.pendingLink).length} 条手工填入「待补关联」（档案尚未录入的兜底口径，不拦截审批）：签订采购合同 / 资源建档后由填报人补关联真实档案并留痕；实际单价与手工价不一致时触发核算变更复核（P01-8）。
                          </td>
                        </tr>
                      )}
                      <tr className="bg-[#F7F8FA] font-semibold">
                        <td className="px-3 py-2" colSpan={2}>合计（含一次性条目演示口径）</td>
                        <td className="px-3 py-2 text-[#4E5969]">支撑部 {fmt(opsSum)} ＋ 技术部 {fmt(techSum)}</td>
                        <td className="px-3 py-2 text-right font-mono text-[#165DFF]">{fmt(monthlyCost)}</td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    </tbody>
                  </table>
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
