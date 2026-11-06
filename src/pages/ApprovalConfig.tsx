// A2 审批点与审批链配置（/system/approval）—— 审批环节不写死在代码里
// 左侧：审批点列表（决定审批嵌入哪个业务环节）；右侧：选中审批点的详情 + 审批链（多级分支）编辑。
// 配置变更记版本 + 二次确认；引擎运行口径见底部说明与 P10。
import { useState } from "react";
import { useApprovalFlow, getPoints, savePoint, togglePoint, saveChain, toggleChain, removeChain, CHAINS_OF, DOC_TYPES, ENGINE_RULES, type ApprovalPoint, type ApprovalChain, type ChainNode, type DocType, type ScopeType, type MultiHit } from "@/data/approvalFlow";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SCOPE_OPTS: ScopeType[] = ["全局", "按产品类别", "按客户级别", "按部门"];
const MULTIHIT_OPTS: MultiHit[] = ["按优先级取第一条", "全部串行（命中几个走几个）", "并行会签"];

// ---------- 审批点编辑 ----------
function PointForm({ initial, onClose }: { initial?: ApprovalPoint; onClose: () => void }) {
  const [f, setF] = useState<ApprovalPoint>(() => initial ?? {
    id: "", name: "", docType: "成本核算单 · 提交", enabled: true,
    condition: { kind: "无条件", text: "" }, scope: "全局", multiHit: "按优先级取第一条",
    isDefault: false, updatedAt: "", updatedBy: "",
  });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name.trim()) return alert("请填写审批点名称");
    if (f.condition.kind !== "无条件" && !f.condition.text.trim()) return alert("已选触发条件类型，请填写条件内容（或改回「无条件」）");
    if (!confirm(`保存审批点「${f.name}」？\n配置变更将记版本并写入 audit_log，即时对后续提交的单据生效。`)) return;
    savePoint(f);
    onClose();
  };
  return (
    <CenterModal title={initial ? `编辑审批点 · ${initial.name}` : "新建审批点"} sub="第一层配置：决定审批嵌入哪个业务环节、什么条件下触发" width={560} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">审批点名称 <span className="text-[#F53F3F]">*</span></div>
          <Input autoFocus placeholder="如「大额收款审批」「核算变更审批」" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">挂接单据与触发动作 <span className="text-[#F53F3F]">*</span></div>
          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.docType} onChange={(e) => set("docType", e.target.value as DocType)}>
            {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
          </select>
          <div className="mt-0.5 text-[10px] text-[#86909C]">候选集 = 系统内置的全部可提交单据及提交动作；勾选启用即把审批嵌入该业务环节</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">触发条件</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.condition.kind} onChange={(e) => setF((x) => ({ ...x, condition: { kind: e.target.value as ApprovalPoint["condition"]["kind"], text: x.condition.text } }))}>
              {["无条件", "金额区间", "字段条件", "组织条件"].map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">条件内容（无条件留空）</div>
            <Input placeholder='如：单据总额 ≥ 100,000 / 变更类型 = 过户' value={f.condition.text} onChange={(e) => setF((x) => ({ ...x, condition: { ...x.condition, text: e.target.value } }))} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">适用范围</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.scope} onChange={(e) => set("scope", e.target.value)}>
              {SCOPE_OPTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">多命中处理</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.multiHit} onChange={(e) => set("multiHit", e.target.value)}>
              {MULTIHIT_OPTS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          <label className="flex items-center gap-2 text-[#4E5969]">
            <input type="checkbox" checked={f.enabled} onChange={(e) => setF((x) => ({ ...x, enabled: e.target.checked }))} />
            启用（停用后该环节提交直接生效，不再走审批）
          </label>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={save}>保存（二次确认）</Button>
          </span>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 审批链编辑 ----------
function ChainForm({ pointId, initial, onClose }: { pointId: string; initial?: ApprovalChain; onClose: () => void }) {
  const [f, setF] = useState<ApprovalChain>(() => initial ?? {
    id: "", pointId, branch: "", nodes: [{ approverSource: "角色", approver: "", mode: "会签", timeoutHours: 24 }],
    rejectPolicy: "退回发起人修改后重报", enabled: true, isDefault: false, updatedAt: "",
  });
  const patchNode = (i: number, patch: Partial<ChainNode>) => setF((x) => ({ ...x, nodes: x.nodes.map((n, j) => j === i ? { ...n, ...patch } : n) }));
  const save = () => {
    if (!f.nodes.length) return alert("审批链至少需要一个节点");
    if (f.nodes.some((n) => !n.approver.trim())) return alert("每个节点都要指定审批人（指定人 / 角色 / 部门负责人）");
    if (!confirm(`保存审批链「${f.branch || "单一链（兜底）"}」？\n配置变更将记版本并写入 audit_log。`)) return;
    saveChain(f);
    onClose();
  };
  return (
    <CenterModal title={initial ? `编辑审批链 · ${initial.id}` : "新建审批链"} sub="第二层配置：单据命中本审批点后，按分支条件取链，链内节点逐级审批" width={640} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">分支条件（留空 = 单一链兜底）</div>
            <Input placeholder='如：含税金额 ≥ 100,000 / 违约金 / 坏账' value={f.branch} onChange={(e) => setF((x) => ({ ...x, branch: e.target.value }))} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">驳回策略</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.rejectPolicy} onChange={(e) => setF((x) => ({ ...x, rejectPolicy: e.target.value as ApprovalChain["rejectPolicy"] }))}>
              <option>退回发起人修改后重报</option><option>逐级退回</option>
            </select>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[#4E5969]">链节点（有序，从上到下逐级审批）<span className="text-[#F53F3F]"> *</span></span>
            <Button size="sm" variant="outline" onClick={() => setF((x) => ({ ...x, nodes: [...x.nodes, { approverSource: "角色", approver: "", mode: "会签", timeoutHours: 24 }] }))}>＋ 加一级</Button>
          </div>
          <div className="space-y-2">
            {f.nodes.map((n, i) => (
              <div key={i} className="flex items-center gap-2 rounded-[4px] border border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#165DFF] text-[11px] text-white">{i + 1}</span>
                <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-1.5 py-1" value={n.approverSource} onChange={(e) => patchNode(i, { approverSource: e.target.value as ChainNode["approverSource"] })}>
                  <option>指定人</option><option>角色</option><option>部门负责人</option>
                </select>
                <Input className="w-32" placeholder={n.approverSource === "角色" ? "如 财务主管" : n.approverSource === "指定人" ? "如 王芳" : "如 财务部"} value={n.approver} onChange={(e) => patchNode(i, { approver: e.target.value })} />
                <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                  {(["会签", "或签"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => patchNode(i, { mode: m })}
                      className={`rounded-[2px] px-2 py-1 ${n.mode === m ? "bg-[#165DFF] text-white" : "text-[#4E5969]"}`}>{m}</button>
                  ))}
                </div>
                <label className="flex shrink-0 items-center gap-1 text-[#4E5969]">
                  时限 <Input className="w-14" type="number" min={1} value={n.timeoutHours} onChange={(e) => patchNode(i, { timeoutHours: Number(e.target.value) || 24 })} /> 小时
                </label>
                {f.nodes.length > 1 && (
                  <button className="ml-auto text-[#F53F3F] hover:underline" onClick={() => setF((x) => ({ ...x, nodes: x.nodes.filter((_, j) => j !== i) }))}>移除</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-[#86909C]">会签 = 该级全部通过才算过；或签 = 一人通过即可。超期未审自动催办并升级上级。</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>保存（二次确认）</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 页面 ----------
export default function ApprovalConfig() {
  useApprovalFlow();
  const points = getPoints();
  const [selId, setSelId] = useState(points[0]?.id ?? "");
  const [kw, setKw] = useState("");
  const [pointForm, setPointForm] = useState<{ open: boolean; initial?: ApprovalPoint }>({ open: false });
  const [chainForm, setChainForm] = useState<{ open: boolean; initial?: ApprovalChain }>({ open: false });
  const sel = points.find((p) => p.id === selId) ?? points[0];
  const shown = points.filter((p) => !kw || p.name.includes(kw) || p.docType.includes(kw));
  const chains = sel ? CHAINS_OF(sel.id) : [];

  return (
    <ArcoShell breadcrumb="系统管理 / 审批流配置">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">审批点与审批链配置</span>
            <span className="text-[11px] text-[#86909C]">审批环节不写死在代码里：自主决定哪个业务环节要审批、什么条件下审批、经过谁审批</span>
          </div>
          <Button size="sm" onClick={() => setPointForm({ open: true })}>＋ 新建审批点</Button>
        </div>

        <div className="flex gap-4">
          {/* 左：审批点列表 */}
          <div className="w-72 shrink-0 rounded-[4px] border border-[#E5E6EB] bg-white">
            <div className="border-b border-[#F2F3F5] p-3">
              <Input placeholder="搜索审批点 / 挂接单据" value={kw} onChange={(e) => setKw(e.target.value)} />
            </div>
            <div className="max-h-[560px] overflow-y-auto p-2">
              {shown.map((p) => (
                <button key={p.id} onClick={() => setSelId(p.id)}
                  className={`mb-1 w-full rounded-[4px] border px-3 py-2.5 text-left transition-colors ${sel?.id === p.id ? "border-[#165DFF] bg-[#F0F6FF]" : "border-transparent hover:bg-[#F7F8FA]"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[#1D2129]">{p.name}</span>
                    {p.isDefault && <span className="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#86909C]">出厂默认</span>}
                    <span className={`ml-auto rounded-[2px] px-1.5 py-0.5 text-[10px] ${p.enabled ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>{p.enabled ? "启用" : "停用"}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[#86909C]">{p.docType}</div>
                </button>
              ))}
              {!shown.length && <div className="py-10 text-center text-[11px] text-[#C9CDD4]">无匹配审批点</div>}
            </div>
          </div>

          {/* 右：详情 + 审批链 */}
          {sel && (
            <div className="flex-1 space-y-4">
              <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-[#1D2129]">{sel.name}</span>
                  <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${sel.enabled ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>{sel.enabled ? "启用中" : "已停用（该环节提交直接生效）"}</span>
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`${sel.enabled ? "停用" : "启用"}审批点「${sel.name}」？配置变更记版本并写入 audit_log。`)) togglePoint(sel.id); }}>
                      {sel.enabled ? "停用" : "启用"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPointForm({ open: true, initial: sel })}>编辑</Button>
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-3">
                  {[
                    ["挂接单据与触发动作", sel.docType],
                    ["触发条件", sel.condition.kind === "无条件" ? "无条件（留空）" : `${sel.condition.kind}：${sel.condition.text}`],
                    ["适用范围", sel.scope],
                    ["多命中处理", sel.multiHit],
                    ["最近变更", `${sel.updatedAt} · ${sel.updatedBy}`],
                    ["审批链", `${chains.filter((c) => c.enabled).length} 条启用 / 共 ${chains.length} 条`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10px] text-[#86909C]">{k}</div>
                      <div className="mt-0.5 text-[#1D2129]">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-semibold text-[#1D2129]">审批链</span>
                    <span className="ml-2 text-[11px] text-[#86909C]">分支条件从上到下匹配，取第一条命中的启用链；都不命中走无分支条件的兜底链</span>
                  </div>
                  <Button size="sm" onClick={() => setChainForm({ open: true })}>＋ 新建审批链</Button>
                </div>
                <div className="space-y-2">
                  {chains.map((c) => (
                    <div key={c.id} className={`rounded-[4px] border px-4 py-3 text-xs ${c.enabled ? "border-[#E5E6EB]" : "border-dashed border-[#E5E6EB] opacity-60"}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#86909C]">{c.id}</span>
                        <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${c.branch ? "bg-[#FFF3E8] text-[#FF7D00]" : "bg-[#F7F8FA] text-[#4E5969]"}`}>{c.branch || "单一链（兜底）"}</span>
                        {c.isDefault && <span className="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#86909C]">出厂默认</span>}
                        <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${c.enabled ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>{c.enabled ? "启用" : "停用"}</span>
                        <span className="ml-auto flex gap-2">
                          <button className="text-[#165DFF] hover:underline" onClick={() => setChainForm({ open: true, initial: c })}>编辑</button>
                          <button className="text-[#4E5969] hover:underline" onClick={() => { if (confirm(`${c.enabled ? "停用" : "启用"}审批链 ${c.id}？`)) toggleChain(c.id); }}>{c.enabled ? "停用" : "启用"}</button>
                          {!c.isDefault && <button className="text-[#F53F3F] hover:underline" onClick={() => { if (confirm(`删除审批链 ${c.id}？配置变更记版本并写入 audit_log。`)) removeChain(c.id); }}>删除</button>}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {c.nodes.map((n, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            <span className="rounded-[2px] border border-[#BEDAFF] bg-[#E8F3FF] px-2 py-1 text-[11px] text-[#0E42D2]">
                              {n.approverSource} · {n.approver} · {n.mode} · {n.timeoutHours}h
                            </span>
                            {i < c.nodes.length - 1 && <span className="text-[#C9CDD4]">→</span>}
                          </span>
                        ))}
                        <span className="ml-2 text-[10px] text-[#86909C]">驳回：{c.rejectPolicy}</span>
                      </div>
                    </div>
                  ))}
                  {!chains.length && <div className="py-6 text-center text-[11px] text-[#C9CDD4]">该审批点尚未配置审批链，命中后将无链可走——请立即新建</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          <div className="mb-0.5 font-medium text-[#4E5969]">审批引擎运行逻辑（P10）</div>
          {ENGINE_RULES.map((r, i) => <div key={i}>{i + 1}. {r}</div>)}
        </div>
      </main>

      {pointForm.open && <PointForm initial={pointForm.initial} onClose={() => setPointForm({ open: false })} />}
      {chainForm.open && sel && <ChainForm pointId={sel.id} initial={chainForm.initial} onClose={() => setChainForm({ open: false })} />}
    </ArcoShell>
  );
}
