import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { SHEETS, SHEET_ENTRIES, DEFAULT_FLOWS, EMBED_POINTS, fmt, type ApprovalNode, type SheetStatus } from "@/data/sheets";
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
  const [sp] = useSearchParams();
  const [selId, setSelId] = useState<string | null>(sp.get("id"));
  const sheet = selId ? SHEETS.find((s) => s.id === selId) : undefined;
  const [tab, setTab] = useState<"list" | "handle" | "config">(sheet ? "handle" : "list");
  const [st, setSt] = useState<"全部" | SheetStatus>("全部");
  const [kw, setKw] = useState("");
  // 演示进度：审批中的单停在财务主管（n3）；已通过的单全部节点完成；已驳回的单保留流转记录
  const [nodeIdx, setNodeIdx] = useState(() => (sheet?.status === "已通过" ? 99 : 2));
  const [records, setRecords] = useState<{ node: string; action: string; by: string; time: string; comment: string }[]>([
    { node: "业务支撑部负责人复核", action: "通过", by: "许晟熙（业务支撑部负责人）", time: "2026-10-22 09:15", comment: "条目与合同核对无误" },
    { node: "技术部负责人复核", action: "通过", by: "赵鹏（技术部负责人）", time: "2026-10-22 10:02", comment: "IP/线路绑定关系确认，资源参数取值正确" },
  ]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  // 列表视图（默认）：全部核算单，状态筛选 + 关键字搜索；点开进入审批处理
  const listRows = SHEETS.filter((s) =>
    (st === "全部" || s.status === st) && (!kw || s.id.includes(kw) || s.customer.includes(kw) || s.contract.includes(kw)));
  const openSheet = (id: string) => {
    setSelId(id);
    setTab("handle");
    setNodeIdx(SHEETS.find((s) => s.id === id)?.status === "已通过" ? 99 : 2);
    setComment("");
    setRejectOpen(false);
  };

  const flows = useMemo(() => JSON.parse(JSON.stringify(DEFAULT_FLOWS)) as typeof DEFAULT_FLOWS, []);
  const [flow, setFlow] = useState(flows["成本核算审批"]);
  const nodes = flow.nodes;
  const activeNodes = nodes.filter((n) => n.enabled);
  const monthlyCost = SHEET_ENTRIES.reduce((s, e) => s + e.amount, 0);
  const opsSum = SHEET_ENTRIES.filter((e) => e.dept === "业务支撑部").reduce((s, e) => s + e.amount, 0);
  const techSum = SHEET_ENTRIES.filter((e) => e.dept === "技术部").reduce((s, e) => s + e.amount, 0);

  const pass = () => {
    const cur = activeNodes[nodeIdx];
    if (!cur) return;
    setRecords((r) => [...r, { node: cur.name, action: "通过", by: "当前登录人", time: "刚刚", comment: comment || "—" }]);
    setComment("");
    setNodeIdx((i) => i + 1);
  };
  const reject = () => {
    const cur = activeNodes[nodeIdx];
    if (!cur) return;
    setRecords((r) => [...r, { node: cur.name, action: "驳回", by: "当前登录人", time: "刚刚", comment }]);
    setComment("");
    setRejectOpen(false);
  };
  const finished = nodeIdx >= activeNodes.length;

  const patchNode = (key: string, patch: Partial<ApprovalNode>) =>
    setFlow((f) => ({ ...f, nodes: f.nodes.map((n) => (n.key === key ? { ...n, ...patch } : n)) }));

  return (
    <ArcoShell breadcrumb="审批中心">
      {/* 默认列表视图：全部核算单，状态筛选 + 搜索；点开进入审批处理 */}
      {tab === "list" && (
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
            <Button size="sm" variant="outline" onClick={() => setTab("config")}>审批流配置</Button>
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
                {listRows.map((s) => (
                  <tr key={s.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => openSheet(s.id)}>
                    <td className="px-3 py-2.5 font-mono font-medium text-[#165DFF]">{s.id}</td>
                    <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{s.customer}</div><div className="text-[#86909C]">{s.contract}</div></td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(s.monthlyCost)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(s.contractValue)}</td>
                    <td className={`px-3 py-2.5 font-mono font-semibold ${s.margin >= 40 ? "text-[#00B42A]" : s.margin >= 20 ? "text-[#FF7D00]" : "text-[#F53F3F]"}`}>{s.margin}%</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{s.opsDone ? "支撑部 ✓" : "支撑部 填"} · {s.techDone ? "技术部 ✓" : "技术部 填"}</td>
                    <td className="px-3 py-2.5">
                      <Badge className={`${STATUS_COLOR[s.status]} hover:bg-inherit`}>{s.status}</Badge>
                      {s.curNode && <div className="mt-0.5 text-[10px] text-[#165DFF]">当前节点：{s.curNode}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-[#86909C]">{s.updated}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openSheet(s.id); }}>
                        {s.status === "审批中" ? "去审批" : "查看"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!listRows.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-[#86909C]">无匹配核算单</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* 页签条（详情视图：返回列表 + 单据号 + 状态 + 页签） */}
      {tab !== "list" && sheet && (
      <div className="flex items-center gap-6 border-b border-[#E5E6EB] bg-white px-6">
        <button onClick={() => setTab("list")} className="py-3 text-[13px] text-[#86909C] hover:text-[#165DFF]">← 返回列表</button>
        <span className="py-3 font-mono text-[14px] text-[#1D2129]">{sheet.id}</span>
        <Badge className={sheet.status === "已通过" ? "bg-[#E8F8F2] text-[#00B42A] hover:bg-[#E8F8F2]" : sheet.status === "已驳回" ? "bg-[#FFECE8] text-[#F53F3F] hover:bg-[#FFECE8]" : "bg-[#E8F3FF] text-[#165DFF] hover:bg-[#E8F3FF]"}>{sheet.status}</Badge>
        <div className="ml-6 flex gap-1">
          {([["handle", "审批处理"], ["config", "审批流配置"]] as const).map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative h-12 px-4 text-[14px] ${tab === k ? "font-medium text-[#165DFF]" : "text-[#4E5969] hover:text-[#1D2129]"}`}>
              {t}
              {tab === k && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-[#165DFF]" />}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* 从列表直接进配置（无选中单据）时的页签条 */}
      {tab === "config" && !sheet && (
        <div className="flex items-center gap-6 border-b border-[#E5E6EB] bg-white px-6">
          <button onClick={() => setTab("list")} className="py-3 text-[13px] text-[#86909C] hover:text-[#165DFF]">← 返回列表</button>
          <span className="py-3 text-[14px] font-medium text-[#1D2129]">审批流配置</span>
        </div>
      )}

      {tab === "handle" && sheet && (
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
                        <td className="px-3 py-2"><Badge className={e.dept === "业务支撑部" ? "bg-[#E8F3FF] text-[#165DFF] hover:bg-sky-100" : "bg-[#E8F3FF] text-[#165DFF] hover:bg-indigo-100"}>{e.dept}</Badge></td>
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
                <div className="mb-3 text-sm font-semibold">审批链（{finished ? "已完成" : sheet.status === "已驳回" ? <span className="text-[#F53F3F]">已驳回 · 流程终止</span> : `当前：${activeNodes[nodeIdx]?.name}`}）</div>
                <ol className="space-y-0">
                  {activeNodes.map((n, i) => {
                    const state = i < nodeIdx ? "done" : i === nodeIdx ? "cur" : "wait";
                    return (
                      <li key={n.key} className="flex gap-2">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${state === "done" ? "bg-[#00B42A] text-white" : state === "cur" ? "bg-[#165DFF] text-white" : "bg-[#E5E6EB] text-[#4E5969]"}`}>
                            {state === "done" ? "✓" : i + 1}
                          </span>
                          {i < activeNodes.length - 1 && <span className={`h-5 w-px ${state === "done" ? "bg-[#00B42A]" : "bg-[#E5E6EB]"}`} />}
                        </div>
                        <div className="pb-3">
                          <div className={`text-xs font-medium ${state === "cur" ? "text-[#165DFF]" : "text-[#4E5969]"}`}>{n.name}</div>
                          <div className="text-[10px] text-[#86909C]">{n.approver} · 条件：{n.condition}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-2 rounded-[2px] bg-[#E8F3FF] px-2 py-1.5 text-[11px] leading-4 text-[#165DFF]">
                  审批通过 = 资源占用生效（②层数据开始累计）；驳回 = 解锁退回填报方，消息通知。
                </div>
              </div>

              <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                <div className="mb-2 text-sm font-semibold">审批意见</div>
                <Input placeholder="审批意见（驳回时必填）" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  {sheet.status === "审批中" && !finished ? (
                    <>
                      <Button size="sm" className="flex-1" onClick={pass}>通过</Button>
                      <Button size="sm" variant="outline" className="flex-1 text-[#F53F3F]" onClick={() => setRejectOpen(true)}>驳回</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => alert("原型演示：转交给其他审批人（正式环境弹出人员选择器，留痕）")}>转交</Button>
                    </>
                  ) : finished ? (
                    <div className="w-full rounded-[2px] bg-[#E8F8F2] px-3 py-2 text-center text-xs text-[#00B42A]">
                      审批完成 · 系统自动生成开通工单（P02）
                      <a href="/delivery" className="ml-2 text-[#165DFF] underline">查看工单 →</a>
                    </div>
                  ) : sheet.status === "已驳回" ? (
                    <div className="w-full rounded-[2px] bg-[#FFECE8] px-3 py-2 text-center text-xs text-[#F53F3F]">该单已驳回 · 填报内容已解锁退回，待修改后重新提交</div>
                  ) : (
                    <div className="w-full rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-center text-xs text-[#4E5969]">当前状态不可审批</div>
                  )}
                </div>
                {rejectOpen && (
                  <div className="mt-2 rounded-[2px] border border-[#FBACA3] bg-[#FFECE8] p-2 text-xs text-[#F53F3F]">
                    确认驳回该核算单？填报内容将解锁退回，需重新提交。
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="destructive" disabled={!comment.trim()} onClick={reject}>确认驳回</Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectOpen(false)}>取消</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                <div className="mb-2 text-sm font-semibold">流转记录</div>
                <ol className="space-y-2 text-[11px]">
                  {records.map((r, i) => (
                    <li key={i} className="border-l-2 border-[#E5E6EB] pl-2">
                      <span className={`font-medium ${r.action === "通过" ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>{r.action}</span>
                      <span className="text-[#4E5969]"> · {r.node} · {r.by}</span>
                      <div className="text-[#86909C]">{r.time}{r.comment && r.comment !== "—" ? ` · ${r.comment}` : ""}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        </main>
      )}
      {tab === "config" && (
        <main className="mx-auto max-w-5xl space-y-4 p-6">
          <section className="rounded-[4px] border border-[#FFCF8B] bg-[#FFF7E8] p-4 text-xs leading-5 text-[#D25F00] ">
            <span className="font-semibold">设计目标：</span>审批流由业务管理员自行配置——自主决定嵌入哪个业务环节、每个节点谁审、什么条件才需要审。一期预置"成本核算审批"模板，二期开放配置到任意环节（下方嵌入环节选项已列出）。
          </section>
          <section className="rounded-[4px] border border-[#E5E6EB] bg-white ">
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
              <span className="text-sm font-semibold">成本核算审批流</span>
              <label className="flex items-center gap-1.5 text-xs text-[#4E5969]">嵌入环节：
                <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1 text-xs" value={flow.embedPoint}
                  onChange={(e) => setFlow((f) => ({ ...f, embedPoint: e.target.value }))}>
                  {EMBED_POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <span className="ml-auto text-xs text-[#86909C]">节点按顺序执行；条件不满足自动跳过</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2">顺序</th><th className="px-3 py-2">节点名称</th><th className="px-3 py-2">审批人规则</th>
                  <th className="px-3 py-2">生效条件</th><th className="px-3 py-2">启用</th><th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n, i) => (
                  <tr key={n.key} className={`border-b last:border-0 ${n.enabled ? "" : "opacity-50"}`}>
                    <td className="px-3 py-2 font-mono">{i + 1}</td>
                    <td className="px-3 py-2"><Input className="h-7 text-xs" value={n.name} onChange={(e) => patchNode(n.key, { name: e.target.value })} /></td>
                    <td className="px-3 py-2"><Input className="h-7 text-xs" value={n.approver} onChange={(e) => patchNode(n.key, { approver: e.target.value })} /></td>
                    <td className="px-3 py-2"><Input className="h-7 text-xs" value={n.condition} onChange={(e) => patchNode(n.key, { condition: e.target.value })} /></td>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={n.enabled} onChange={(e) => patchNode(n.key, { enabled: e.target.checked })} />
                    </td>
                    <td className="px-3 py-2 text-[#C9CDD4]">拖拽排序（二期）</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2 px-4 py-2.5">
              <Button size="sm" variant="outline" onClick={() => setFlow((f) => ({ ...f, nodes: [...f.nodes, { key: `n${Date.now()}`, name: "新节点", approver: "选择角色/人员", condition: "总是", enabled: true }] }))}>
                ＋ 添加节点
              </Button>
              <Button size="sm" onClick={() => alert("已保存（原型演示）：配置写入审批流字典，对之后提交的核算单生效，存量单据按提交时版本执行")}>保存配置</Button>
            </div>
          </section>
        </main>
      )}
      {/* list 视图时两个 main 均不渲染，避免落空 */}
    </ArcoShell>
  );
}
