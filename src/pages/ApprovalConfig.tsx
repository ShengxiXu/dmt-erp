// A2 审批流配置（/system/approval）—— 单层「审批流模板」：一个单据动作 = 一条流
// 交互原则：页内直编（不用弹窗）；兜底分支是"身份"不是"名字"（由有无条件决定，固定标签，不可改名）；
// 数据联动：审批人按来源切换候选（指定人→用户、角色→角色、部门负责人→部门主数据）；切单据动作重置条件字段
import { useEffect, useMemo, useState } from "react";
import {
  useApprovalFlow, getFlows, getInstances, FLOWS,
  saveFlow, toggleFlow, removeFlow, simulate, nodeLabel, condsText, nextBranchId,
  DOC_TYPES, FIELD_DEFS, COND_OPS, ENGINE_RULES, FLOW_LOGS,
  type ApprovalFlow, type FlowBranch, type ChainNode, type DocType, type Cond, type ApproverSource,
} from "@/data/approvalFlow";
import { ROLES, USERS, useUsers } from "@/data/users";
import { DEPTS, useDepartments } from "@/data/departments";
import { DEMO_TODAY } from "@/data/settings";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selCls = "rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1 text-xs";
const REJECT_OPTS = ["退回发起人修改后重报", "逐级退回"] as const;

// ---------- 结构化条件构建器（AND；op=非空 时值留空） ----------
function CondBuilder({ docType, conds, onChange }: { docType: DocType; conds: Cond[]; onChange: (c: Cond[]) => void }) {
  const fields = FIELD_DEFS[docType] ?? [];
  const patch = (i: number, p: Partial<Cond>) => onChange(conds.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div className="space-y-1">
      {conds.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-8 shrink-0 text-right text-[10px] text-[#C9CDD4]">{i === 0 ? "IF" : "AND"}</span>
          <select className={`${selCls} w-36`} value={c.field} onChange={(e) => patch(i, { field: e.target.value })}>
            {(fields.length ? fields : [{ key: c.field, label: c.field, kind: "text" as const }]).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select className={`${selCls} w-16`} value={c.op} onChange={(e) => patch(i, { op: e.target.value as Cond["op"] })}>
            {COND_OPS.map((o) => <option key={o}>{o}</option>)}
          </select>
          {c.op !== "非空" && (
            <Input className="h-7 w-28 text-xs" placeholder="比较值" value={c.value} onChange={(e) => patch(i, { value: e.target.value })} />
          )}
          <button className="ml-1 shrink-0 text-[#C9CDD4] hover:text-[#F53F3F]" title="移除条件" onClick={() => onChange(conds.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="flex items-center gap-2 pl-9">
        <button className="text-[11px] text-[#165DFF] hover:underline" onClick={() => onChange([...conds, { field: fields[0]?.key ?? "", op: ">=", value: "" }])}>＋ 加条件</button>
        <span className="text-[10px] text-[#C9CDD4]">{conds.length ? "组内 AND 求值" : "不设条件 = 兜底"}</span>
      </div>
    </div>
  );
}

// ---------- 审批人联动选择器：来源切换 → 候选切换 ----------
function ApproverPicker({ node, onChange }: { node: ChainNode; onChange: (n: ChainNode) => void }) {
  useUsers();
  useDepartments();
  const sourceOpts: ApproverSource[] = ["指定人", "角色", "部门负责人"];
  const candidates =
    node.approverSource === "指定人" ? USERS.filter((u) => u.status === "启用").map((u) => u.name)
    : node.approverSource === "角色" ? ROLES.map((r) => r.name)
    : DEPTS.filter((d) => d.status === "启用").map((d) => d.name);
  const orphan = node.approver && !candidates.includes(node.approver);
  return (
    <span className="flex items-center gap-1.5">
      <select className={`${selCls} w-20`} value={node.approverSource}
        onChange={(e) => {
          const src = e.target.value as ApproverSource;
          const list = src === "指定人" ? USERS.filter((u) => u.status === "启用").map((u) => u.name)
            : src === "角色" ? ROLES.map((r) => r.name)
            : DEPTS.filter((d) => d.status === "启用").map((d) => d.name);
          onChange({ ...node, approverSource: src, approver: list[0] ?? "" });
        }}>
        {sourceOpts.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select className={`${selCls} w-28`} value={node.approver} onChange={(e) => onChange({ ...node, approver: e.target.value })}>
        {orphan && <option value={node.approver}>{node.approver}（已失效）</option>}
        {candidates.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </span>
  );
}

// ---------- 分支节点编辑器 ----------
function NodeEditor({ nodes, onChange }: { nodes: ChainNode[]; onChange: (n: ChainNode[]) => void }) {
  const patch = (i: number, p: Partial<ChainNode>) => onChange(nodes.map((n, j) => (j === i ? { ...n, ...p } : n)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= nodes.length) return;
    const ns = [...nodes];
    [ns[i], ns[j]] = [ns[j], ns[i]];
    onChange(ns);
  };
  return (
    <div className="space-y-1.5">
      {nodes.map((n, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#165DFF] text-[11px] text-white">{i + 1}</span>
          <span className="flex shrink-0 flex-col">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="text-[9px] leading-3 text-[#165DFF] disabled:text-[#E5E6EB]">▲</button>
            <button type="button" disabled={i === nodes.length - 1} onClick={() => move(i, 1)} className="text-[9px] leading-3 text-[#165DFF] disabled:text-[#E5E6EB]">▼</button>
          </span>
          <ApproverPicker node={n} onChange={(x) => patch(i, x)} />
          <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
            {(["会签", "或签"] as const).map((m) => (
              <button key={m} type="button" onClick={() => patch(i, { mode: m })}
                className={`rounded-[2px] px-2 py-0.5 text-[11px] ${n.mode === m ? "bg-[#165DFF] text-white" : "text-[#4E5969]"}`}>{m}</button>
            ))}
          </div>
          <label className="flex shrink-0 items-center gap-1 text-[11px] text-[#4E5969]">
            时限 <Input className="h-6 w-12 text-xs" type="number" min={1} value={n.timeoutHours} onChange={(e) => patch(i, { timeoutHours: Number(e.target.value) || 24 })} /> 小时
          </label>
          <span className="text-[10px] text-[#00B42A]">→ {nodeLabel(n)}</span>
          {nodes.length > 1 && (
            <button className="ml-auto shrink-0 text-[11px] text-[#C9CDD4] hover:text-[#F53F3F]" onClick={() => onChange(nodes.filter((_, j) => j !== i))}>移除</button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 pl-7">
        <button className="text-[11px] text-[#165DFF] hover:underline" onClick={() => onChange([...nodes, { approverSource: "角色", approver: ROLES[0]?.name ?? "", mode: "会签", timeoutHours: 24 }])}>＋ 加一级</button>
        <span className="text-[10px] text-[#C9CDD4]">会签 = 全部通过；或签 = 一人通过即可</span>
      </div>
    </div>
  );
}

// ---------- 新建审批流 ----------
function NewFlowModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocType>("成本核算单 · 提交");
  const avail = DOC_TYPES.filter((d) => !FLOWS.some((f) => f.docType === d));
  const save = () => {
    if (!name.trim()) return alert("请填写审批流名称");
    const flow: ApprovalFlow = {
      id: `AF-new-${Date.now()}`, name: name.trim(), docType, enabled: true, conds: [],
      branches: [{ id: nextBranchId(), name: "兜底分支", conds: [], nodes: [{ approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 24 }], rejectPolicy: "退回发起人修改后重报", priority: 200, enabled: true }],
      updatedAt: "", updatedBy: "",
    };
    const err = saveFlow(flow);
    if (err) return alert(err);
    onClose();
  };
  return (
    <CenterModal title="新建审批流" sub="一个单据动作配置一条审批流：触发条件 + 分支" width={480} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">审批流名称 <span className="text-[#F53F3F]">*</span></div>
          <Input autoFocus placeholder="如「成本核算审批」「大额付款审批」" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">挂接单据动作 <span className="text-[#F53F3F]">*</span></div>
          <select className={`${selCls} w-full py-1.5`} value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
            {avail.map((d) => <option key={d}>{d}</option>)}
          </select>
          <div className="mt-0.5 text-[10px] text-[#C9CDD4]">{avail.length ? "仅列出尚未配置审批流的单据动作（一个动作一条流）" : "全部单据动作均已配置，可直接编辑既有流程"}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>创建</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 仿真试算 ----------
function SimPanel() {
  const [docType, setDocType] = useState<DocType>("成本核算单 · 提交");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof simulate> | null>(null);
  const fields = FIELD_DEFS[docType] ?? [];
  return (
    <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-[#1D2129]">仿真试算</span>
        <span className="text-[11px] text-[#86909C]">填一笔模拟单据，预览命中哪条流、走哪个分支、经过哪些节点——不产生数据</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select className={selCls} value={docType} onChange={(e) => { setDocType(e.target.value as DocType); setResult(null); setVals({}); }}>
          {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
        </select>
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-1 text-[#4E5969]">
            {f.label}
            <Input className="h-7 w-24 text-xs" type="number" value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
          </label>
        ))}
        {!fields.length && <span className="text-[#86909C]">该单据未定义试算字段（按无条件匹配）</span>}
        <Button size="sm" className="h-7" onClick={() => {
          const ctx: Record<string, unknown> = {};
          fields.forEach((f) => { if (vals[f.key] !== undefined && vals[f.key] !== "") ctx[f.key] = Number(vals[f.key]); });
          setResult(simulate(docType, ctx));
        }}>试算</Button>
      </div>
      {result && (
        <div className={`mt-3 rounded-[4px] border px-3 py-2.5 text-xs ${result.hit ? "border-[#BEDAFF] bg-[#F0F6FF]" : "border-[#FFD9C4] bg-[#FFF7F0]"}`}>
          {result.hit && result.flow && result.branch ? (
            <div className="space-y-1.5">
              <div>
                <span className="font-medium text-[#0E42D2]">「{result.flow.name}」→ 分支「{result.branch.name}」</span>
                <span className="ml-2 text-[#86909C]">{result.branch.conds.length ? `条件：${condsText(result.branch.conds)} · ` : "兜底分支 · "}驳回：{result.branch.rejectPolicy}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-0.5 text-[11px] text-[#00B42A]">提交</span>
                {result.branch.nodes.map((n, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-[#C9CDD4]">→</span>
                    <span className="rounded-[2px] border border-[#BEDAFF] bg-white px-2 py-0.5 text-[11px] text-[#0E42D2]">{i + 1}. {nodeLabel(n)} · {n.mode} · {n.timeoutHours}h</span>
                  </span>
                ))}
                <span className="text-[#C9CDD4]">→</span>
                <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-0.5 text-[11px] text-[#00B42A]">生效</span>
              </div>
            </div>
          ) : (
            <div className="text-[#D25F00]">不生成审批：{result.reason}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- 页面 ----------
const FLOW_BY_ID_SAFE = (id: string) => getFlows().find((f) => f.id === id);

export default function ApprovalConfig() {
  useApprovalFlow();
  useUsers();
  useDepartments();
  const flows = getFlows();
  const instances = getInstances();
  const [selId, setSelId] = useState(flows[0]?.id ?? "");
  const [kw, setKw] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const sel = flows.find((f) => f.id === selId) ?? flows[0];
  const [draft, setDraft] = useState<ApprovalFlow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(sel ? JSON.parse(JSON.stringify(sel)) : null);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, flows.length]);

  const dirty = useMemo(() => draft && sel ? JSON.stringify(draft) !== JSON.stringify(sel) : false, [draft, sel]);
  const shown = flows.filter((f) => !kw || f.name.includes(kw) || f.docType.includes(kw));
  const active = instances.filter((i) => i.status === "审批中").length;
  const doneToday = instances.filter((i) => i.status !== "审批中" && i.results.some((r) => r.time.startsWith(DEMO_TODAY))).length;

  const pick = (id: string) => {
    if (dirty && !confirm("当前流有未保存的修改，切换将丢弃，继续？")) return;
    setSelId(id);
  };
  const patchDraft = (p: Partial<ApprovalFlow>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchBranch = (idx: number, p: Partial<FlowBranch>) =>
    setDraft((d) => (d ? { ...d, branches: d.branches.map((b, j) => (j === idx ? { ...b, ...p } : b)) } : d));

  const save = () => {
    if (!draft) return;
    if (!confirm(`保存审批流「${draft.name}」？\n变更即时对后续提交的单据生效；在途单据仍按提交时的快照走完。`)) return;
    const e = saveFlow(draft);
    setErr(e);
    if (!e) setDraft(JSON.parse(JSON.stringify(FLOW_BY_ID_SAFE(draft.id))));
  };
  const stats: [string, string, string][] = [
    ["审批流", `${flows.filter((f) => f.enabled).length} 启用 / ${flows.length} 共`, "#165DFF"],
    ["分支", `${flows.reduce((s, f) => s + f.branches.length, 0)}`, "#0E42D2"],
    ["在途审批实例", `${active}`, "#FF7D00"],
    ["今日完成", `${doneToday}`, "#00B42A"],
  ];

  return (
    <ArcoShell breadcrumb="系统管理 / 审批流配置">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">审批流配置</span>
            <span className="text-[11px] text-[#86909C]">一个单据动作 = 一条审批流：先判「要不要审」，再按分支自上而下判「谁来审」</span>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>＋ 新建审批流</Button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {stats.map(([k, v, c]) => (
            <div key={k} className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
              <div className="text-[11px] text-[#86909C]">{k}</div>
              <div className="mt-0.5 text-xl font-semibold" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          {/* 左：审批流列表 */}
          <div className="w-64 shrink-0 rounded-[4px] border border-[#E5E6EB] bg-white">
            <div className="border-b border-[#F2F3F5] p-3">
              <Input placeholder="搜索审批流 / 单据动作" value={kw} onChange={(e) => setKw(e.target.value)} />
            </div>
            <div className="max-h-[680px] overflow-y-auto p-2">
              {shown.map((f) => (
                <button key={f.id} onClick={() => pick(f.id)}
                  className={`mb-1 w-full rounded-[4px] border px-3 py-2 text-left transition-colors ${sel?.id === f.id ? "border-[#165DFF] bg-[#F0F6FF]" : "border-transparent hover:bg-[#F7F8FA]"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[#1D2129]">{f.name}</span>
                    <span className={`ml-auto h-1.5 w-1.5 rounded-full ${f.enabled ? "bg-[#00B42A]" : "bg-[#C9CDD4]"}`} title={f.enabled ? "启用" : "停用"} />
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[#86909C]">{f.docType}</div>
                </button>
              ))}
              {!shown.length && <div className="py-10 text-center text-[11px] text-[#C9CDD4]">无匹配审批流</div>}
            </div>
          </div>

          {/* 右：流编辑器 */}
          {draft && (
            <div className="flex-1 space-y-3">
              {/* 基本信息 */}
              <div className={`rounded-[4px] border bg-white p-4 ${dirty ? "border-[#FFCF8B]" : "border-[#E5E6EB]"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-[#C9CDD4]">{sel?.id}</span>
                  <Input className="h-8 w-52 text-sm font-semibold" value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} />
                  <select className={`${selCls} py-1.5`} value={draft.docType}
                    onChange={(e) => {
                      const dt = e.target.value as DocType;
                      if (!confirm(`将该审批流挂到「${dt}」？原动作「${draft.docType}」将不再有审批流。`)) return;
                      const valid = new Set((FIELD_DEFS[dt] ?? []).map((f) => f.key));
                      patchDraft({ docType: dt, conds: draft.conds.filter((c) => valid.has(c.field)) });
                    }}>
                    {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-[#4E5969]">
                    <input type="checkbox" checked={draft.enabled} onChange={(e) => patchDraft({ enabled: e.target.checked })} />
                    启用
                  </label>
                  {sel?.isDefault && <span className="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#86909C]">出厂默认</span>}
                  {dirty && <span className="rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">有未保存修改</span>}
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`${draft.enabled ? "停用" : "启用"}审批流「${draft.name}」？变更即时生效并留痕。`)) toggleFlow(draft.id); }}>
                      {draft.enabled ? "停用" : "启用"}
                    </Button>
                    {!sel?.isDefault && (
                      <Button size="sm" variant="outline" className="text-[#F53F3F]"
                        onClick={() => { if (confirm(`删除审批流「${draft.name}」？该单据动作将不再走审批，变更留痕。`)) { const e = removeFlow(draft.id); if (e) alert(e); } }}>删除</Button>
                    )}
                  </span>
                </div>
                <div className="mt-3 border-t border-[#F7F8FA] pt-3">
                  <div className="mb-1 text-xs text-[#4E5969]">触发条件<span className="ml-1 text-[10px] text-[#C9CDD4]">——满足才走审批，不满足直接生效</span></div>
                  <CondBuilder docType={draft.docType} conds={draft.conds} onChange={(conds) => patchDraft({ conds })} />
                </div>
              </div>

              {/* 分支 */}
              <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-[13px] font-semibold text-[#1D2129]">审批分支</span>
                    <span className="ml-2 text-[11px] text-[#86909C]">自上而下匹配，取第一条命中的启用分支；都不命中走兜底分支</span>
                  </div>
                  <Button size="sm" onClick={() => setDraft((d) => d ? { ...d, branches: [...d.branches, { id: nextBranchId(), name: "", conds: [{ field: FIELD_DEFS[d.docType]?.[0]?.key ?? "", op: ">=", value: "" }], nodes: [{ approverSource: "角色", approver: ROLES[0]?.name ?? "", mode: "会签", timeoutHours: 24 }], rejectPolicy: "退回发起人修改后重报", priority: 100, enabled: true }] } : d)}>＋ 新建分支</Button>
                </div>
                <div className="space-y-3">
                  {[...draft.branches].sort((a, b) => a.priority - b.priority).map((b) => {
                    const idx = draft.branches.indexOf(b);
                    const isFallback = !b.conds.length;
                    return (
                      <div key={b.id} className={`rounded-[4px] border px-4 py-3 ${b.enabled ? "border-[#E5E6EB]" : "border-dashed border-[#E5E6EB] opacity-60"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${isFallback ? "bg-[#F7F8FA] text-[#4E5969]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>{isFallback ? "兜底分支" : "条件分支"}</span>
                          {isFallback ? (
                            <span className="text-xs text-[#4E5969]">未命中其他分支时走这里</span>
                          ) : (
                            <Input className="h-7 w-52 text-xs" placeholder="分支名称，如 大额加审管理层" value={b.name} onChange={(e) => patchBranch(idx, { name: e.target.value })} />
                          )}
                          <label className="ml-auto flex items-center gap-1.5 text-xs text-[#4E5969]">
                            <input type="checkbox" checked={b.enabled} onChange={(e) => patchBranch(idx, { enabled: e.target.checked })} /> 启用
                          </label>
                          {draft.branches.length > 1 && (
                            <button className="text-[11px] text-[#C9CDD4] hover:text-[#F53F3F]"
                              onClick={() => { if (!b.conds.length && !confirm("删除兜底分支后，未命中任何分支的单据将无链可走，确认？")) return; patchDraft({ branches: draft.branches.filter((x) => x.id !== b.id) }); }}>
                              删除
                            </button>
                          )}
                        </div>
                        {!isFallback && (
                          <div className="mt-2">{/* 分支条件 */}
                            <CondBuilder docType={draft.docType} conds={b.conds} onChange={(conds) => patchBranch(idx, { conds })} />
                          </div>
                        )}
                        <div className="mt-2">{/* 审批节点 */}
                          <NodeEditor nodes={b.nodes} onChange={(nodes) => patchBranch(idx, { nodes })} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-[#F7F8FA] pt-2 text-[11px] text-[#86909C]">
                          <label className="flex items-center gap-1">
                            匹配优先级 <Input className="h-6 w-12 text-xs" type="number" value={b.priority} onChange={(e) => patchBranch(idx, { priority: Number(e.target.value) || 200 })} />
                          </label>
                          <label className="flex items-center gap-1">
                            驳回策略
                            <select className={selCls} value={b.rejectPolicy} onChange={(e) => patchBranch(idx, { rejectPolicy: e.target.value as FlowBranch["rejectPolicy"] })}>
                              {REJECT_OPTS.map((r) => <option key={r}>{r}</option>)}
                            </select>
                          </label>
                          <span className="text-[10px] text-[#C9CDD4]">数字越小越先匹配；条件相同的分支，排在前面的先生效</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {err && <div className="rounded-[4px] border border-[#FBACA3] bg-[#FFECE8] px-3 py-2 text-xs text-[#F53F3F]">{err}</div>}
              <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
                <span className="text-[11px] text-[#C9CDD4]">最近变更 {sel?.updatedAt} · {sel?.updatedBy}　|　保存即时生效并留痕；在途单据按提交时快照走完</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!dirty} onClick={() => { setDraft(JSON.parse(JSON.stringify(sel))); setErr(null); }}>放弃修改</Button>
                  <Button size="sm" disabled={!dirty} onClick={save}>保存审批流</Button>
                </span>
              </div>
            </div>
          )}
        </div>

        <SimPanel />

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-[#1D2129]">在途与近期审批实例</span>
              <span className="text-[11px] text-[#86909C]">提交时对分支做快照：在途单不受配置变更影响</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] text-[#86909C]">
                  <th className="pb-1.5 font-normal">单据</th><th className="pb-1.5 font-normal">审批流 / 分支</th>
                  <th className="pb-1.5 font-normal">当前节点</th><th className="pb-1.5 font-normal">状态</th><th className="pb-1.5 font-normal">提交时间</th>
                </tr>
              </thead>
              <tbody>
                {instances.slice(0, 8).map((i) => (
                  <tr key={i.id} className="border-t border-[#F2F3F5]">
                    <td className="py-1.5">
                      <div className="font-medium text-[#1D2129]">{i.docId}</div>
                      <div className="text-[10px] text-[#86909C]">{i.summary}</div>
                    </td>
                    <td className="py-1.5 text-[#4E5969]">{i.flowName} / {i.branchName ?? "—"}</td>
                    <td className="py-1.5 text-[#4E5969]">{i.status === "审批中" ? nodeLabel(i.snapshot.nodes[i.curNodeIdx]) : "—"}</td>
                    <td className="py-1.5">
                      <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${i.status === "审批中" ? "bg-[#FFF3E8] text-[#FF7D00]" : i.status === "已通过" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#FFECE8] text-[#F53F3F]"}`}>{i.status}</span>
                    </td>
                    <td className="py-1.5 text-[#86909C]">{i.submitAt}</td>
                  </tr>
                ))}
                {!instances.length && <tr><td colSpan={5} className="py-6 text-center text-[#C9CDD4]">暂无审批实例</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-[#1D2129]">变更留痕</span>
              <span className="text-[11px] text-[#86909C]">配置调整与审批动作全程记录（近 10 条）</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {FLOW_LOGS.slice(0, 10).map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 text-[10px] text-[#86909C]">{l.at}</span>
                  <span className="text-[#4E5969]">{l.action}</span>
                </div>
              ))}
              {!FLOW_LOGS.length && <div className="py-6 text-center text-[#C9CDD4]">暂无变更记录</div>}
            </div>
          </div>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          <div className="mb-0.5 font-medium text-[#4E5969]">审批引擎运行逻辑</div>
          {ENGINE_RULES.map((r, i) => <div key={i}>{i + 1}. {r}</div>)}
        </div>
      </main>

      {newOpen && <NewFlowModal onClose={() => setNewOpen(false)} />}
    </ArcoShell>
  );
}
