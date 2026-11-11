// A2 审批中心（/approval）—— 消费统一审批引擎：实例持久化，通过/驳回真实写回核算单
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SHEETS, SHEET_ENTRIES, fmt, type SheetStatus } from "@/data/sheets";
import { useApprovalFlow, INSTANCE_OF_DOC, approveInstance, rejectInstance, nodeLabel, type ApprovalInstance } from "@/data/approvalFlow";
import { currentUser } from "@/data/users";
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const STATUS_COLOR: Record<SheetStatus, string> = {
  待填写: "bg-[#F2F3F5] text-[#4E5969]",
  待对方提交: "bg-[#FFF3E8] text-[#FF7D00]",
  审批中: "bg-[#E8F3FF] text-[#165DFF]",
  已通过: "bg-[#E8F8F2] text-[#00B42A]",
  已驳回: "bg-[#FFECE8] text-[#F53F3F]",
  变更中: "bg-[#FEF0FF] text-[#CB26FF]",
};
const LIST_FILTERS: ("全部" | SheetStatus)[] = ["全部", "待填写", "待对方提交", "审批中", "已通过", "已驳回", "变更中"];

export default function Approval() {
  useApprovalFlow();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [selId, setSelId] = useState<string | null>(sp.get("id"));
  const sheet = selId ? SHEETS.find((s) => s.id === selId) : undefined;
  const inst: ApprovalInstance | undefined = sheet ? INSTANCE_OF_DOC(sheet.id) : undefined;
  const [comment, setComment] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [st, setSt] = useState<"全部" | SheetStatus>("全部");
  const [kw, setKw] = useState("");

  const listRows = SHEETS.filter((s) =>
    (st === "全部" || s.status === st) && (!kw || s.id.includes(kw) || s.customer.includes(kw) || s.contract.includes(kw)));
  const openSheet = (id: string) => {
    setSelId(id);
    setComment("");
    setRejectOpen(false);
    setMsg(null);
  };
  const back = () => { setSelId(null); setMsg(null); };

  const monthlyCost = SHEET_ENTRIES.reduce((s, e) => s + e.amount, 0);
  const opsSum = SHEET_ENTRIES.filter((e) => e.dept === "业务支撑部").reduce((s, e) => s + e.amount, 0);
  const techSum = SHEET_ENTRIES.filter((e) => e.dept === "技术部").reduce((s, e) => s + e.amount, 0);

  const act = (fn: (id: string, by: string, comment: string) => string | null, cmt: string) => {
    if (!inst) return;
    const err = fn(inst.id, currentUser()?.name ?? "当前登录人", cmt);
    setMsg(err);
    if (!err) { setComment(""); setRejectOpen(false); }
  };
  const pass = () => act(approveInstance, comment);
  const reject = () => act(rejectInstance, comment);

  return (
    <ArcoShell breadcrumb="审批中心">
      {!sheet && (
        <main className="space-y-4 p-6">
          <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[#1D2129]">审批中心</span>
              <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                {LIST_FILTERS.map((x) => (
                  <button key={x} onClick={() => setSt(x)}
                    className={`rounded-[2px] px-2.5 py-1 text-xs ${st === x ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                    {x}
                  </button>
                ))}
              </div>
              <Input className="w-52" placeholder="搜索核算单号 / 客户 / 合同" value={kw} onChange={(e) => setKw(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/system/approval")}>审批流配置</Button>
          </div>

          <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2">核算单号</th><th className="px-3 py-2">客户 / 合同</th>
                  <th className="px-3 py-2 text-right">月成本(元)</th><th className="px-3 py-2 text-right">合同月额(元)</th>
                  <th className="px-3 py-2">毛利</th><th className="px-3 py-2">两部门填报</th>
                  <th className="px-3 py-2">状态 / 当前节点</th><th className="px-3 py-2">更新时间</th><th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map((s) => {
                  const i = INSTANCE_OF_DOC(s.id);
                  return (
                    <tr key={s.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => openSheet(s.id)}>
                      <td className="px-3 py-2.5 font-mono font-medium text-[#165DFF]">{s.id}</td>
                      <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{s.customer}</div><div className="text-[#86909C]">{s.contract}</div></td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmt(s.monthlyCost)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmt(s.contractValue)}</td>
                      <td className={`px-3 py-2.5 font-mono font-semibold ${s.margin >= 40 ? "text-[#00B42A]" : s.margin >= 20 ? "text-[#FF7D00]" : "text-[#F53F3F]"}`}>{s.margin}%</td>
                      <td className="px-3 py-2.5 text-[#4E5969]">{s.opsDone ? "支撑部 ✓" : "支撑部 填"} · {s.techDone ? "技术部 ✓" : "技术部 填"}</td>
                      <td className="px-3 py-2.5">
                        <Badge className={`${STATUS_COLOR[s.status]} hover:bg-inherit`}>{s.status}</Badge>
                        {i?.status === "审批中" && <div className="mt-0.5 text-[10px] text-[#165DFF]">当前节点：{nodeLabel(i.snapshot.nodes[i.curNodeIdx])}</div>}
                        {i && i.status !== "审批中" && <div className="mt-0.5 text-[10px] text-[#86909C]">{i.chainName ?? i.chainId} · {i.results.length} 级已审</div>}
                      </td>
                      <td className="px-3 py-2.5 text-[#86909C]">{s.updated}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openSheet(s.id); }}>
                          {s.status === "审批中" ? "去审批" : "查看"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!listRows.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-[#86909C]">无匹配核算单</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {sheet && (
        <>
          <div className="flex items-center gap-6 border-b border-[#E5E6EB] bg-white px-6">
            <button onClick={back} className="py-3 text-[13px] text-[#86909C] hover:text-[#165DFF]">← 返回列表</button>
            <span className="py-3 font-mono text-[14px] text-[#1D2129]">{sheet.id}</span>
            <Badge className={sheet.status === "已通过" ? "bg-[#E8F8F2] text-[#00B42A] hover:bg-[#E8F8F2]" : sheet.status === "已驳回" ? "bg-[#FFECE8] text-[#F53F3F] hover:bg-[#FFECE8]" : "bg-[#E8F3FF] text-[#165DFF] hover:bg-[#E8F3FF]"}>{sheet.status}</Badge>
            {inst && <span className="py-3 text-xs text-[#86909C]">审批实例 {inst.id} · 链「{inst.chainName ?? inst.chainId}」（{inst.snapshot.branch}）· 提交人 {inst.submitter} {inst.submitAt}</span>}
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

              <section className="space-y-3">
                <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                  <div className="mb-3 text-sm font-semibold">
                    审批链（
                    {inst?.status === "已通过" ? "已完成" :
                     inst?.status === "已驳回" ? <span className="text-[#F53F3F]">已驳回 · 流程终止</span> :
                     inst ? `当前：${nodeLabel(inst.snapshot.nodes[inst.curNodeIdx])}` : sheet.status}
                    ）
                  </div>
                  {!inst && <div className="py-4 text-center text-[11px] text-[#86909C]">该单未进入审批（{sheet.status}），暂无审批链</div>}
                  {inst && (
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
                  )}
                  <div className="mt-2 rounded-[2px] bg-[#E8F3FF] px-2 py-1.5 text-[11px] leading-4 text-[#165DFF]">
                    审批通过 = 资源占用生效（②层数据开始累计）；驳回 = 按链的「{inst?.snapshot.rejectPolicy ?? "退回发起人修改后重报"}」策略退回，消息通知。
                  </div>
                </div>

                <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                  <div className="mb-2 text-sm font-semibold">审批意见</div>
                  <Input placeholder="审批意见（驳回时必填）" value={comment} onChange={(e) => setComment(e.target.value)} />
                  {msg && <div className="mt-2 rounded-[2px] bg-[#FFECE8] px-2 py-1 text-[11px] text-[#F53F3F]">{msg}</div>}
                  <div className="mt-2 flex gap-2">
                    {inst?.status === "审批中" ? (
                      <>
                        <Button size="sm" className="flex-1" onClick={pass}>通过</Button>
                        <Button size="sm" variant="outline" className="flex-1 text-[#F53F3F]" onClick={() => setRejectOpen(true)}>驳回</Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => alert("原型演示：转交给其他审批人（正式环境弹出人员选择器，留痕）")}>转交</Button>
                      </>
                    ) : inst?.status === "已通过" ? (
                      <div className="w-full rounded-[2px] bg-[#E8F8F2] px-3 py-2 text-center text-xs text-[#00B42A]">
                        审批完成 · 系统自动生成开通工单（P02）
                        <a href="/delivery" className="ml-2 text-[#165DFF] underline">查看工单 →</a>
                      </div>
                    ) : inst?.status === "已驳回" ? (
                      <div className="w-full rounded-[2px] bg-[#FFECE8] px-3 py-2 text-center text-xs text-[#F53F3F]">该单已驳回 · 填报内容已解锁退回，待修改后重新提交</div>
                    ) : (
                      <div className="w-full rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-center text-xs text-[#4E5969]">当前状态不可审批</div>
                    )}
                  </div>
                  {rejectOpen && (
                    <div className="mt-2 rounded-[2px] border border-[#FBACA3] bg-[#FFECE8] p-2 text-xs text-[#F53F3F]">
                      确认驳回该核算单？按「{inst?.snapshot.rejectPolicy ?? "退回发起人修改后重报"}」退回，需重新提交。
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="destructive" disabled={!comment.trim()} onClick={reject}>确认驳回</Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectOpen(false)}>取消</Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                  <div className="mb-2 text-sm font-semibold">流转记录</div>
                  {!inst?.results.length && <div className="py-3 text-center text-[11px] text-[#C9CDD4]">暂无流转记录</div>}
                  <ol className="space-y-2 text-[11px]">
                    {(inst?.results ?? []).map((r, i) => (
                      <li key={i} className={`border-l-2 pl-2 ${r.action === "通过" ? "border-[#00B42A]" : "border-[#F53F3F]"}`}>
                        <span className={`font-medium ${r.action === "通过" ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>{r.action}</span>
                        <span className="text-[#4E5969]"> · {r.nodeLabel} · {r.by}</span>
                        <div className="text-[#86909C]">{r.time}{r.comment && r.comment !== "—" ? ` · ${r.comment}` : ""}</div>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            </div>
          </main>
        </>
      )}
    </ArcoShell>
  );
}
