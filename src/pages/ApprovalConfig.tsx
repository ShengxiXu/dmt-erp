// A2 审批流配置（/system/approval）—— 单流画布式编排器
// 呈现隐喻：一条审批流 = 一张纵向画纸
//   · 入口句：「当 成本核算单提交 时 · 条件芯片」—— 读一句话就懂触发逻辑
//   · 分支 = 顶部页签（带迷你路径剪影，兜底页签永远最右且样式收敛）
//   · 当前分支 = 纵向时间线：起点圆点 → 审批步（头像/来源/方式）→ 终点；悬停浮现操作，点开就地展开
// 交互原则：一次只呈现一条路径，消灭并排堆叠；所有编辑就地完成（无弹窗无跳转）；微过渡 150-200ms
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
import { Plus, ArrowUp, ArrowDown, Check, Trash2, Zap } from "lucide-react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selCls = "rounded-[4px] border border-[#E5E6EB] bg-white px-2 py-1 text-xs transition-colors hover:border-[#165DFF] focus:border-[#165DFF]";
const REJECT_OPTS = ["退回发起人修改后重报", "逐级退回"] as const;
const fieldLabel = (docType: DocType, key: string) => FIELD_DEFS[docType]?.find((f) => f.key === key)?.label ?? key;

const branchType = (b: FlowBranch) => (!b.conds.length ? "fallback" : "cond");

// ---------- 条件芯片组 ----------
function CondChips({ docType, conds, onChange, emptyHint }: { docType: DocType; conds: Cond[]; onChange: (c: Cond[]) => void; emptyHint: string }) {
  const fields = FIELD_DEFS[docType] ?? [];
  const [adding, setAdding] = useState(false);
  const [field, setField] = useState(fields[0]?.key ?? "");
  const [op, setOp] = useState(">=" as Cond["op"]);
  const [value, setValue] = useState("");
  const add = () => {
    if (op !== "非空" && !value.trim()) return;
    onChange([...conds, { field, op, value }]);
    setAdding(false); setValue("");
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {conds.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E6EB] bg-white px-2.5 py-1 text-[11px] text-[#1D2129] transition-colors hover:border-[#165DFF]/50">
          {i > 0 && <span className="text-[10px] text-[#C9CDD4]">且</span>}
          <span className="font-mono text-[#0E42D2]">{fieldLabel(docType, c.field)}</span>
          <span className="text-[#86909C]">{c.op}</span>
          {c.op !== "非空" && <span className="font-mono">{c.value}</span>}
          <button className="ml-0.5 text-[#C9CDD4] transition-colors hover:text-[#F53F3F]" onClick={() => onChange(conds.filter((_, j) => j !== i))}>✕</button>
        </span>
      ))}
      {adding ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#165DFF] bg-white py-1 pl-2.5 pr-1.5 shadow-sm">
          <select className="border-0 bg-transparent text-[11px] focus:outline-none" value={field} onChange={(e) => setField(e.target.value)}>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select className="border-0 bg-transparent text-[11px] focus:outline-none" value={op} onChange={(e) => setOp(e.target.value as Cond["op"])}>
            {COND_OPS.map((o) => <option key={o}>{o}</option>)}
          </select>
          {op !== "非空" && (
            <input autoFocus className="w-16 border-0 bg-transparent text-[11px] focus:outline-none" placeholder="值" value={value}
              onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          )}
          <button className="rounded-full bg-[#165DFF] px-2 py-0.5 text-[10px] text-white" onClick={add}>加</button>
          <button className="px-1 text-[11px] text-[#86909C]" onClick={() => setAdding(false)}>✕</button>
        </span>
      ) : (
        <button className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-[#C9CDD4] px-2.5 py-1 text-[11px] text-[#86909C] transition-colors hover:border-[#165DFF] hover:text-[#165DFF]"
          onClick={() => { setField(fields[0]?.key ?? ""); setAdding(true); }}>
          <Plus size={11} /> {conds.length ? "且" : emptyHint}
        </button>
      )}
    </span>
  );
}

// ---------- 审批人联动选择器 ----------
function ApproverPicker({ node, onChange }: { node: ChainNode; onChange: (n: ChainNode) => void }) {
  useUsers();
  useDepartments();
  const candidates =
    node.approverSource === "指定人" ? USERS.filter((u) => u.status === "启用").map((u) => u.name)
    : node.approverSource === "角色" ? ROLES.map((r) => r.name)
    : DEPTS.filter((d) => d.status === "启用").map((d) => d.name);
  const orphan = node.approver && !candidates.includes(node.approver);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select className={selCls} value={node.approverSource}
        onChange={(e) => {
          const src = e.target.value as ApproverSource;
          const list = src === "指定人" ? USERS.filter((u) => u.status === "启用").map((u) => u.name)
            : src === "角色" ? ROLES.map((r) => r.name)
            : DEPTS.filter((d) => d.status === "启用").map((d) => d.name);
          onChange({ ...node, approverSource: src, approver: list[0] ?? "" });
        }}>
        {(["指定人", "角色", "部门负责人"] as const).map((s) => <option key={s}>{s}</option>)}
      </select>
      <select className={`${selCls} min-w-32`} value={node.approver} onChange={(e) => onChange({ ...node, approver: e.target.value })}>
        {orphan && <option value={node.approver}>{node.approver}（已失效）</option>}
        {candidates.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </span>
  );
}

// ---------- 审批步（时间线节点） ----------
function Step({ node, index, total, open, onToggle, onChange, onMove, onRemove }: {
  node: ChainNode; index: number; total: number; open: boolean;
  onToggle: () => void; onChange: (n: ChainNode) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  const initial = (node.approver || "?").slice(0, 1);
  const broken = !node.approver;
  return (
    <li className="relative pl-9">
      {/* 连接线 */}
      {index < total && <span className="absolute left-[11px] top-8 h-[calc(100%-16px)] w-px bg-[#E5E6EB]" />}
      {/* 圆点头像 */}
      <span className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium text-white ${broken ? "bg-[#F53F3F]" : "bg-[#1D2129]"}`}>{initial}</span>
      {open ? (
        <div className="rounded-[8px] border border-[#165DFF] bg-white p-3 shadow-[0_4px_16px_rgba(22,93,255,0.08)]">
          <div className="flex flex-wrap items-center gap-2">
            <ApproverPicker node={node} onChange={onChange} />
            <div className="flex rounded-[6px] border border-[#E5E6EB] p-0.5">
              {(["会签", "或签"] as const).map((m) => (
                <button key={m} type="button" onClick={() => onChange({ ...node, mode: m })}
                  className={`rounded-[4px] px-2.5 py-1 text-[11px] transition-colors ${node.mode === m ? "bg-[#1D2129] text-white" : "text-[#4E5969] hover:text-[#1D2129]"}`}>{m}</button>
              ))}
            </div>
            <label className="flex items-center gap-1 text-[11px] text-[#4E5969]">
              时限
              <input className="w-12 rounded-[4px] border border-[#E5E6EB] px-1.5 py-1 text-center text-[11px] focus:border-[#165DFF]" type="number" min={1}
                value={node.timeoutHours} onChange={(e) => onChange({ ...node, timeoutHours: Number(e.target.value) || 24 })} />
              小时
            </label>
            <span className="ml-auto flex items-center gap-1">
              <button className="rounded-[4px] p-1 text-[#86909C] transition-colors hover:bg-[#F2F3F5] hover:text-[#1D2129] disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} title="上移"><ArrowUp size={13} /></button>
              <button className="rounded-[4px] p-1 text-[#86909C] transition-colors hover:bg-[#F2F3F5] hover:text-[#1D2129] disabled:opacity-30" disabled={index === total - 1} onClick={() => onMove(1)} title="下移"><ArrowDown size={13} /></button>
              {total > 1 && <button className="rounded-[4px] p-1 text-[#86909C] transition-colors hover:bg-[#FFECE8] hover:text-[#F53F3F]" onClick={onRemove} title="移除"><Trash2 size={13} /></button>}
              <button className="ml-1 flex items-center gap-1 rounded-[6px] bg-[#165DFF] px-2.5 py-1 text-[11px] text-white transition-colors hover:bg-[#0E42D2]" onClick={onToggle}><Check size={12} />完成</button>
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#00B42A]"><Zap size={11} /> 实际审批人：{nodeLabel(node)}</div>
        </div>
      ) : (
        <button onClick={onToggle}
          className={`group flex w-full items-center gap-3 rounded-[8px] border bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(29,33,41,0.06)] ${broken ? "border-[#FBACA3]" : "border-[#E5E6EB] hover:border-[#165DFF]/40"}`}>
          <span className="text-[13px] font-medium text-[#1D2129]">{node.approver || "（未指定）"}</span>
          <span className="rounded-[3px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{node.approverSource}</span>
          <span className="text-[11px] text-[#86909C]">{node.mode} · {node.timeoutHours}h</span>
          <span className="ml-auto text-[11px] text-[#C9CDD4] opacity-0 transition-opacity group-hover:opacity-100">点击编辑 →</span>
        </button>
      )}
    </li>
  );
}

// ---------- 新建审批流 ----------
function NewFlowModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [docType, setDocType] = useState("成本核算单 · 提交" as DocType);
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
    <CenterModal title="新建审批流" sub="一个单据动作配置一条审批流" width={480} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">审批流名称 <span className="text-[#F53F3F]">*</span></div>
          <Input autoFocus placeholder="如「成本核算审批」" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">挂接单据动作 <span className="text-[#F53F3F]">*</span></div>
          <select className={`${selCls} w-full py-1.5`} value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
            {avail.map((d) => <option key={d}>{d}</option>)}
          </select>
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
  const [docType, setDocType] = useState("成本核算单 · 提交" as DocType);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof simulate> | null>(null);
  const fields = FIELD_DEFS[docType] ?? [];
  return (
    <div className="rounded-[8px] border border-[#E5E6EB] bg-white p-4">
      <div className="mb-2.5 flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-[#1D2129]">仿真试算</span>
        <span className="text-[11px] text-[#86909C]">填一笔模拟单据，预览命中哪条流、走哪个分支、经过哪些节点——不产生数据</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select className={selCls} value={docType} onChange={(e) => { setDocType(e.target.value as DocType); setResult(null); setVals({}); }}>
          {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
        </select>
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-1.5 text-[#4E5969]">
            {f.label}
            <input className="w-24 rounded-[4px] border border-[#E5E6EB] px-2 py-1 text-xs focus:border-[#165DFF]" type="number"
              value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
          </label>
        ))}
        <Button size="sm" className="h-7" onClick={() => {
          const ctx: Record<string, unknown> = {};
          fields.forEach((f) => { if (vals[f.key] !== undefined && vals[f.key] !== "") ctx[f.key] = Number(vals[f.key]); });
          setResult(simulate(docType, ctx));
        }}>试算</Button>
      </div>
      {result && (
        <div className={`mt-3 rounded-[8px] border px-3 py-2.5 text-xs ${result.hit ? "border-[#BEDAFF] bg-[#F7FAFF]" : "border-[#FFD9C4] bg-[#FFFBF7]"}`}>
          {result.hit && result.flow && result.branch ? (
            <div className="space-y-1.5">
              <div>
                <span className="font-medium text-[#0E42D2]">「{result.flow.name}」→ 分支「{result.branch.name}」</span>
                <span className="ml-2 text-[#86909C]">{result.branch.conds.length ? `条件 ${condsText(result.branch.conds)} · ` : "兜底 · "}驳回：{result.branch.rejectPolicy}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[#E8F8F2] px-2.5 py-1 text-[11px] text-[#00B42A]">提交</span>
                {result.branch.nodes.map((n, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-[#C9CDD4]">→</span>
                    <span className="rounded-full border border-[#BEDAFF] bg-white px-2.5 py-1 text-[11px] text-[#0E42D2]">{nodeLabel(n)} · {n.mode} · {n.timeoutHours}h</span>
                  </span>
                ))}
                <span className="text-[#C9CDD4]">→</span>
                <span className="rounded-full bg-[#E8F8F2] px-2.5 py-1 text-[11px] text-[#00B42A]">生效</span>
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
const sortBranches = (bs: FlowBranch[]) => [...bs].sort((a, b) => {
  const fa = branchType(a) === "fallback" ? 1 : 0, fb = branchType(b) === "fallback" ? 1 : 0;
  return fa !== fb ? fa - fb : a.priority - b.priority;
});

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
  const [openNode, setOpenNode] = useState<number | null>(null);
  const [activeBranch, setActiveBranch] = useState<string | null>(null);

  useEffect(() => {
    setDraft(sel ? JSON.parse(JSON.stringify(sel)) : null);
    setErr(null); setOpenNode(null); setActiveBranch(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, flows.length]);

  const dirty = useMemo(() => draft && sel ? JSON.stringify(draft) !== JSON.stringify(sel) : false, [draft, sel]);
  const shown = flows.filter((f) => !kw || f.name.includes(kw) || f.docType.includes(kw));
  const active = instances.filter((i) => i.status === "审批中").length;
  const doneToday = instances.filter((i) => i.status !== "审批中" && i.results.some((r) => r.time.startsWith(DEMO_TODAY))).length;
  const sorted = draft ? sortBranches(draft.branches) : [];
  const curBranch = sorted.find((b) => b.id === activeBranch) ?? sorted[0];

  const pick = (id: string) => {
    if (dirty && !confirm("当前流有未保存的修改，切换将丢弃，继续？")) return;
    setSelId(id);
  };
  const patchDraft = (p: Partial<ApprovalFlow>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const replaceBranch = (b: FlowBranch) => setDraft((d) => (d ? { ...d, branches: d.branches.map((x) => (x.id === b.id ? b : x)) } : d));
  const normalize = (f: ApprovalFlow): ApprovalFlow => ({
    ...f,
    branches: sortBranches(f.branches).map((b, i) => ({ ...b, priority: (i + 1) * 100 })),
  });
  const save = () => {
    if (!draft) return;
    const normalized = normalize(draft);
    if (!confirm(`保存审批流「${normalized.name}」？\n变更即时对后续提交的单据生效；在途单据仍按提交时的快照走完。`)) return;
    const e = saveFlow(normalized);
    setErr(e);
    if (!e) setDraft(JSON.parse(JSON.stringify(FLOW_BY_ID_SAFE(normalized.id))));
  };

  return (
    <ArcoShell breadcrumb="系统管理 / 审批流配置">
      <main className="space-y-4 p-6">
        {/* 页头：标题 + 统计 + 新建 */}
        <div className="flex items-center justify-between rounded-[8px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">审批流配置</span>
            <span className="text-[11px] text-[#86909C]">
              审批流 {flows.filter((f) => f.enabled).length}/{flows.length} 启用 · 在途 {active} · 今日完成 {doneToday}
            </span>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>＋ 新建审批流</Button>
        </div>

        <div className="flex gap-4">
          {/* 左：审批流列表 */}
          <div className="w-60 shrink-0 self-start rounded-[8px] border border-[#E5E6EB] bg-white">
            <div className="border-b border-[#F2F3F5] p-3">
              <Input placeholder="搜索审批流 / 单据动作" value={kw} onChange={(e) => setKw(e.target.value)} />
            </div>
            <div className="max-h-[720px] overflow-y-auto p-2">
              {shown.map((f) => (
                <button key={f.id} onClick={() => pick(f.id)}
                  className={`mb-1 w-full rounded-[8px] border px-3 py-2.5 text-left transition-all ${sel?.id === f.id ? "border-[#165DFF] bg-[#F7FAFF]" : "border-transparent hover:bg-[#F7F8FA]"}`}>
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

          {/* 右：单流画布 */}
          {draft && curBranch && (
            <div className="flex-1">
              <div className={`rounded-[12px] border bg-white ${dirty ? "border-[#FFCF8B]" : "border-[#E5E6EB]"}`}>
                {/* 画布工具条 */}
                <div className="flex flex-wrap items-center gap-2 border-b border-[#F2F3F5] px-5 py-3">
                  <Input className="h-8 w-48 border-transparent text-[15px] font-semibold hover:border-[#E5E6EB]" value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} />
                  <select className={`${selCls} py-1.5`} value={draft.docType}
                    onChange={(e) => {
                      const dt = e.target.value as DocType;
                      if (!confirm(`将该审批流挂到「${dt}」？原动作「${draft.docType}」将不再有审批流。`)) return;
                      const valid = new Set((FIELD_DEFS[dt] ?? []).map((f) => f.key));
                      patchDraft({ docType: dt, conds: draft.conds.filter((c) => valid.has(c.field)) });
                    }}>
                    {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#4E5969]">
                    <input type="checkbox" className="accent-[#165DFF]" checked={draft.enabled} onChange={(e) => patchDraft({ enabled: e.target.checked })} /> 启用
                  </label>
                  {dirty && <span className="rounded-full bg-[#FFF3E8] px-2 py-0.5 text-[10px] text-[#FF7D00]">未保存</span>}
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" disabled={!dirty} onClick={() => { setDraft(JSON.parse(JSON.stringify(sel))); setErr(null); setOpenNode(null); }}>放弃</Button>
                    <Button size="sm" disabled={!dirty} onClick={save}>保存</Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`${draft.enabled ? "停用" : "启用"}审批流「${draft.name}」？变更即时生效并留痕。`)) toggleFlow(draft.id); }}>
                      {draft.enabled ? "停用" : "启用"}
                    </Button>
                    {!sel?.isDefault && (
                      <Button size="sm" variant="outline" className="text-[#F53F3F]"
                        onClick={() => { if (confirm(`删除审批流「${draft.name}」？该单据动作将不再走审批，变更留痕。`)) { const e = removeFlow(draft.id); if (e) alert(e); } }}>删除</Button>
                    )}
                  </span>
                </div>

                <div className="mx-auto max-w-2xl px-6 py-6">
                  {/* 入口句 */}
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#1D2129]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#00B42A]" />
                      <span className="font-medium">当</span>
                      <span className="rounded-[6px] bg-[#F2F3F5] px-2 py-0.5 text-xs font-medium">{draft.docType}</span>
                      <span className="font-medium">时</span>
                    </span>
                    <CondChips docType={draft.docType} conds={draft.conds} onChange={(conds) => patchDraft({ conds })} emptyHint="全部单据都触发" />
                  </div>

                  {/* 分支页签 */}
                  <div className="mt-6 flex items-center gap-1 border-b border-[#F2F3F5]">
                    {sorted.map((b, i) => {
                      const isFallback = branchType(b) === "fallback";
                      const activeTab = curBranch.id === b.id;
                      return (
                        <button key={b.id} onClick={() => { setActiveBranch(b.id); setOpenNode(null); }}
                          className={`relative flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${activeTab ? "font-medium text-[#165DFF]" : isFallback ? "text-[#86909C] hover:text-[#4E5969]" : "text-[#4E5969] hover:text-[#1D2129]"}`}>
                          {isFallback ? "兜底" : b.name || `分支 ${i + 1}`}
                          {!b.enabled && <span className="h-1 w-1 rounded-full bg-[#C9CDD4]" title="已停用" />}
                          {activeTab && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#165DFF]" />}
                        </button>
                      );
                    })}
                    <button className="flex items-center gap-0.5 px-2 py-2 text-xs text-[#86909C] transition-colors hover:text-[#165DFF]"
                      onClick={() => {
                        setDraft((d) => d ? { ...d, branches: [...d.branches, { id: nextBranchId(), name: "", conds: [{ field: FIELD_DEFS[d.docType]?.[0]?.key ?? "", op: ">=", value: "" }], nodes: [{ approverSource: "角色", approver: ROLES[0]?.name ?? "", mode: "会签", timeoutHours: 24 }], rejectPolicy: "退回发起人修改后重报", priority: 150, enabled: true }] } : d);
                      }}>
                      <Plus size={12} /> 分支
                    </button>
                  </div>

                  {/* 当前分支：纵向时间线 */}
                  <div className="mt-5">
                    <ol className="space-y-2.5">
                      {/* 起点 */}
                      <li className="relative pl-9">
                        {curBranch.nodes.length >= 0 && <span className="absolute left-[11px] top-7 h-4 w-px bg-[#E5E6EB]" />}
                        <span className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#00B42A] text-white"><Plus size={12} /></span>
                        <div className="px-3 py-2 text-[13px] text-[#4E5969]">提交单据<span className="ml-2 text-[11px] text-[#C9CDD4]">{branchType(curBranch) === "fallback" ? "兜底分支 · 未命中其他分支时走这里" : `条件分支 · ${curBranch.conds.length ? condsText(curBranch.conds) : "未设条件"}`}</span></div>
                      </li>
                      {curBranch.nodes.map((n, i) => (
                        <Step key={i} node={n} index={i} total={curBranch.nodes.length}
                          open={openNode === i}
                          onToggle={() => setOpenNode(openNode === i ? null : i)}
                          onChange={(x) => replaceBranch({ ...curBranch, nodes: curBranch.nodes.map((m, j) => (j === i ? { ...m, ...x } : m)) })}
                          onMove={(d) => {
                            const j = i + d;
                            if (j < 0 || j >= curBranch.nodes.length) return;
                            const ns = [...curBranch.nodes];
                            [ns[i], ns[j]] = [ns[j], ns[i]];
                            replaceBranch({ ...curBranch, nodes: ns });
                            setOpenNode(j);
                          }}
                          onRemove={() => replaceBranch({ ...curBranch, nodes: curBranch.nodes.filter((_, j) => j !== i) })} />
                      ))}
                      {/* 加节点 */}
                      <li className="relative pl-9">
                        <button className="flex w-full items-center gap-2 rounded-[8px] border border-dashed border-[#E5E6EB] px-3 py-2 text-xs text-[#86909C] transition-all hover:border-[#165DFF] hover:text-[#165DFF]"
                          onClick={() => {
                            replaceBranch({ ...curBranch, nodes: [...curBranch.nodes, { approverSource: "角色", approver: ROLES[0]?.name ?? "", mode: "会签", timeoutHours: 24 }] });
                            setOpenNode(curBranch.nodes.length);
                          }}>
                          <Plus size={12} /> 添加审批节点
                        </button>
                      </li>
                      {/* 终点 */}
                      <li className="relative pl-9">
                        <span className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#E5E6EB] text-[#4E5969]"><Check size={12} /></span>
                        <div className="px-3 py-2 text-[13px] text-[#4E5969]">审批通过，单据生效</div>
                      </li>
                    </ol>

                    {/* 分支设置 */}
                    <div className="ml-9 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#F2F3F5] pt-3 text-[11px] text-[#86909C]">
                      <label className="flex items-center gap-1.5">
                        驳回后
                        <select className={selCls} value={curBranch.rejectPolicy} onChange={(e) => replaceBranch({ ...curBranch, rejectPolicy: e.target.value as FlowBranch["rejectPolicy"] })}>
                          {REJECT_OPTS.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" className="accent-[#165DFF]" checked={curBranch.enabled} onChange={(e) => replaceBranch({ ...curBranch, enabled: e.target.checked })} /> 启用本分支
                      </label>
                      {sorted.length > 1 && (
                        <span className="ml-auto flex items-center gap-1">
                          {sorted.findIndex((b) => b.id === curBranch.id) > 0 && (
                            <button className="rounded-[4px] border border-[#E5E6EB] px-2 py-1 transition-colors hover:border-[#165DFF] hover:text-[#165DFF]"
                              onClick={() => replaceBranch({ ...curBranch, priority: curBranch.priority - 150 })}>↑ 先匹配</button>
                          )}
                          {sorted.findIndex((b) => b.id === curBranch.id) < sorted.length - 1 && (
                            <button className="rounded-[4px] border border-[#E5E6EB] px-2 py-1 transition-colors hover:border-[#165DFF] hover:text-[#165DFF]"
                              onClick={() => replaceBranch({ ...curBranch, priority: curBranch.priority + 150 })}>↓ 后匹配</button>
                          )}
                          <button className="rounded-[4px] px-2 py-1 text-[#C9CDD4] transition-colors hover:bg-[#FFECE8] hover:text-[#F53F3F]"
                            onClick={() => {
                              if (branchType(curBranch) === "fallback" && !confirm("删除兜底分支后，未命中任何分支的单据将无链可走，确认？")) return;
                              patchDraft({ branches: draft.branches.filter((x) => x.id !== curBranch.id) });
                              setActiveBranch(null);
                            }}>删除分支</button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#F2F3F5] px-5 py-2 text-right text-[10px] text-[#C9CDD4]">
                  {sel?.id} · 最近变更 {sel?.updatedAt} · {sel?.updatedBy} · 保存即时生效并留痕；在途单据按提交时快照走完
                </div>
              </div>
              {err && <div className="mt-3 rounded-[8px] border border-[#FBACA3] bg-[#FFECE8] px-3 py-2 text-xs text-[#F53F3F]">{err}</div>}
            </div>
          )}
        </div>

        <SimPanel />

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[8px] border border-[#E5E6EB] bg-white p-4">
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
          <div className="rounded-[8px] border border-[#E5E6EB] bg-white p-4">
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

        <div className="rounded-[8px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          <div className="mb-0.5 font-medium text-[#4E5969]">审批引擎运行逻辑</div>
          {ENGINE_RULES.map((r, i) => <div key={i}>{i + 1}. {r}</div>)}
        </div>
      </main>

      {newOpen && <NewFlowModal onClose={() => setNewOpen(false)} />}
    </ArcoShell>
  );
}
