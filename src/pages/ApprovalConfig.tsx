// A2 审批流配置（/system/approval）—— 可视化流程编排器
// 交互原则（友好优先）：
//   · 分支 = 横向节点链路：提交 → 审批节点卡 → 生效，一眼看懂单据怎么走
//   · 点节点卡就地展开编辑（不换页、不弹窗），点空白或「完成」收起
//   · 条件 = 芯片（chips）：点击 × 删除，点「+ 添加条件」原地出现一行编辑器
//   · 分支顺序即匹配顺序：↑↓ 调整，不再暴露"优先级数字"这种工程概念；兜底分支固定在末尾、身份标签不可编辑
// 数据联动：审批人来源切换候选（指定人→用户、角色→角色、部门负责人→部门主数据）；切单据动作自动清掉失效条件字段
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
import { Plus, Settings2 } from "lucide-react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selCls = "rounded-[4px] border border-[#E5E6EB] bg-white px-2 py-1 text-xs";
const REJECT_OPTS = ["退回发起人修改后重报", "逐级退回"] as const;
const fieldLabel = (docType: DocType, key: string) => FIELD_DEFS[docType]?.find((f) => f.key === key)?.label ?? key;
const condChipText = (docType: DocType, c: Cond) => `${fieldLabel(docType, c.field)} ${c.op} ${c.op === "非空" ? "" : c.value}`.trim();

// ---------- 条件芯片组：chips + 原地新增 ----------
function CondChips({ docType, conds, onChange, emptyHint }: { docType: DocType; conds: Cond[]; onChange: (c: Cond[]) => void; emptyHint: string }) {
  const fields = FIELD_DEFS[docType] ?? [];
  const [adding, setAdding] = useState(false);
  const [field, setField] = useState(fields[0]?.key ?? "");
  const [op, setOp] = useState<Cond["op"]>(">=");
  const [value, setValue] = useState("");
  const add = () => {
    if (op !== "非空" && !value.trim()) return;
    onChange([...conds, { field, op, value }]);
    setAdding(false); setValue("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {conds.map((c, i) => (
        <span key={i} className="group flex items-center gap-1 rounded-full border border-[#BEDAFF] bg-[#F0F6FF] px-2.5 py-1 text-[11px] text-[#0E42D2]">
          {i > 0 && <span className="text-[#86909C]">且</span>}
          {condChipText(docType, c)}
          <button className="text-[#86909C] hover:text-[#F53F3F]" onClick={() => onChange(conds.filter((_, j) => j !== i))}>✕</button>
        </span>
      ))}
      {adding ? (
        <span className="flex items-center gap-1 rounded-full border border-[#165DFF] bg-white px-2 py-1">
          <select className="border-0 bg-transparent text-[11px] focus:outline-none" value={field} onChange={(e) => setField(e.target.value)}>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select className="border-0 bg-transparent text-[11px] focus:outline-none" value={op} onChange={(e) => setOp(e.target.value as Cond["op"])}>
            {COND_OPS.map((o) => <option key={o}>{o}</option>)}
          </select>
          {op !== "非空" && (
            <Input autoFocus className="h-5 w-20 border-0 p-0 text-[11px] focus-visible:ring-0" placeholder="值" value={value}
              onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          )}
          <button className="text-[11px] text-[#165DFF] hover:underline" onClick={add}>确定</button>
          <button className="text-[11px] text-[#86909C] hover:underline" onClick={() => setAdding(false)}>取消</button>
        </span>
      ) : (
        <button className="flex items-center gap-0.5 rounded-full border border-dashed border-[#C9CDD4] px-2.5 py-1 text-[11px] text-[#86909C] hover:border-[#165DFF] hover:text-[#165DFF]"
          onClick={() => { setField(fields[0]?.key ?? ""); setAdding(true); }}>
          <Plus size={11} /> {conds.length ? "且" : emptyHint}
        </button>
      )}
      {!conds.length && !adding && <span className="text-[10px] text-[#C9CDD4]">{emptyHint}</span>}
    </div>
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
    <span className="flex items-center gap-1.5">
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
      <select className={`${selCls} w-32`} value={node.approver} onChange={(e) => onChange({ ...node, approver: e.target.value })}>
        {orphan && <option value={node.approver}>{node.approver}（已失效）</option>}
        {candidates.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </span>
  );
}

// ---------- 审批节点卡：收起=摘要，点开=就地编辑 ----------
function NodeCard({ node, open, onToggle, onChange, onMove, onRemove, canRemove }: {
  node: ChainNode; open: boolean;
  onToggle: () => void; onChange: (n: ChainNode) => void;
  onMove: (dir: -1 | 1) => void; onRemove: () => void; canRemove: boolean;
}) {
  if (!open) {
    return (
      <button onClick={onToggle}
        className={`group flex items-center gap-2 rounded-[6px] border bg-white px-3 py-2 text-left transition-colors ${node.approver ? "border-[#E5E6EB] hover:border-[#165DFF]" : "border-[#FBACA3]"}`}>
        <span className="text-[10px] text-[#86909C]">{node.approverSource}</span>
        <span className="text-xs font-medium text-[#1D2129]">{node.approver || "（未指定）"}</span>
        <span className="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#4E5969]">{node.mode}</span>
        <span className="text-[10px] text-[#C9CDD4]">{node.timeoutHours}h</span>
      </button>
    );
  }
  return (
    <div className="rounded-[6px] border border-[#165DFF] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ApproverPicker node={node} onChange={onChange} />
        <div className="flex rounded-[4px] border border-[#E5E6EB] p-0.5">
          {(["会签", "或签"] as const).map((m) => (
            <button key={m} type="button" onClick={() => onChange({ ...node, mode: m })}
              className={`rounded-[3px] px-2 py-0.5 text-[11px] ${node.mode === m ? "bg-[#165DFF] text-white" : "text-[#4E5969]"}`}>{m}</button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-[11px] text-[#4E5969]">
          时限 <Input className="h-6 w-12 text-xs" type="number" min={1} value={node.timeoutHours} onChange={(e) => onChange({ ...node, timeoutHours: Number(e.target.value) || 24 })} /> 小时
        </label>
        <span className="ml-auto flex gap-1">
          <button className="rounded-[3px] border border-[#E5E6EB] px-1.5 text-[10px] text-[#4E5969] hover:border-[#165DFF]" onClick={() => onMove(-1)} title="前移">←</button>
          <button className="rounded-[3px] border border-[#E5E6EB] px-1.5 text-[10px] text-[#4E5969] hover:border-[#165DFF]" onClick={() => onMove(1)} title="后移">→</button>
          {canRemove && <button className="rounded-[3px] border border-[#E5E6EB] px-1.5 text-[10px] text-[#F53F3F] hover:border-[#F53F3F]" onClick={onRemove}>移除</button>}
          <button className="rounded-[3px] bg-[#165DFF] px-2 py-0.5 text-[10px] text-white" onClick={onToggle}>完成</button>
        </span>
      </div>
      <div className="mt-1.5 text-[10px] text-[#00B42A]">→ {nodeLabel(node)}</div>
    </div>
  );
}

// ---------- 分支卡：横向链路 + 头部操作 ----------
function BranchCard({ branch, docType, first, last, onChange, onRemove, openNode, setOpenNode }: {
  branch: FlowBranch; docType: DocType; first: boolean; last: boolean;
  onChange: (b: FlowBranch) => void; onRemove: () => void;
  openNode: string | null; setOpenNode: (k: string | null) => void;
}) {
  const isFallback = !branch.conds.length;
  const key = (i: number) => `${branch.id}:${i}`;
  const patchNode = (i: number, p: Partial<ChainNode>) => onChange({ ...branch, nodes: branch.nodes.map((n, j) => (j === i ? { ...n, ...p } : n)) });
  const moveNode = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= branch.nodes.length) return;
    const ns = [...branch.nodes];
    [ns[i], ns[j]] = [ns[j], ns[i]];
    onChange({ ...branch, nodes: ns });
    setOpenNode(key(j));
  };
  return (
    <div className={`rounded-[6px] border bg-white ${branch.enabled ? "border-[#E5E6EB]" : "border-dashed border-[#E5E6EB] opacity-60"}`}>
      {/* 头部：身份 + 名称 + 操作 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#F7F8FA] px-4 py-2.5">
        <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${isFallback ? "bg-[#F7F8FA] text-[#4E5969]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>
          {isFallback ? "兜底分支" : "条件分支"}
        </span>
        {isFallback ? (
          <span className="text-xs text-[#4E5969]">未命中其他分支时走这里</span>
        ) : (
          <Input className="h-6 w-48 border-transparent px-1 text-xs font-medium hover:border-[#E5E6EB]" value={branch.name}
            placeholder="分支名称，如 大额加审管理层" onChange={(e) => onChange({ ...branch, name: e.target.value })} />
        )}
        {!first && (
          <button className="rounded-[3px] border border-[#E5E6EB] px-1.5 text-[10px] text-[#4E5969] hover:border-[#165DFF]" title="先匹配"
            onClick={() => onChange({ ...branch, priority: branch.priority - 150 })}>↑ 先匹配</button>
        )}
        {!last && (
          <button className="rounded-[3px] border border-[#E5E6EB] px-1.5 text-[10px] text-[#4E5969] hover:border-[#165DFF]" title="后匹配"
            onClick={() => onChange({ ...branch, priority: branch.priority + 150 })}>↓ 后匹配</button>
        )}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-[#86909C]">
          <Settings2 size={12} className="text-[#C9CDD4]" />
          驳回
          <select className={selCls} value={branch.rejectPolicy} onChange={(e) => onChange({ ...branch, rejectPolicy: e.target.value as FlowBranch["rejectPolicy"] })}>
            {REJECT_OPTS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[#4E5969]">
            <input type="checkbox" checked={branch.enabled} onChange={(e) => onChange({ ...branch, enabled: e.target.checked })} /> 启用
          </label>
          <button className="text-[#C9CDD4] hover:text-[#F53F3F]" title="删除分支" onClick={onRemove}>✕</button>
        </span>
      </div>
      {/* 条件芯片 */}
      {!isFallback && (
        <div className="border-b border-[#F7F8FA] px-4 py-2.5">
          <CondChips docType={docType} conds={branch.conds} onChange={(conds) => onChange({ ...branch, conds })}
            emptyHint="设置分支条件（不设 = 兜底）" />
        </div>
      )}
      {/* 节点链路 */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
        <span className="rounded-[6px] bg-[#E8F8F2] px-2.5 py-1.5 text-[11px] font-medium text-[#00B42A]">提交</span>
        {branch.nodes.map((n, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-[#C9CDD4]">→</span>
            <NodeCard node={n} open={openNode === key(i)}
              onToggle={() => setOpenNode(openNode === key(i) ? null : key(i))}
              onChange={(x) => patchNode(i, x)} onMove={(d) => moveNode(i, d)}
              onRemove={() => onChange({ ...branch, nodes: branch.nodes.filter((_, j) => j !== i) })}
              canRemove={branch.nodes.length > 1} />
          </span>
        ))}
        <span className="text-[#C9CDD4]">→</span>
        <button className="flex items-center gap-0.5 rounded-[6px] border border-dashed border-[#C9CDD4] px-2.5 py-1.5 text-[11px] text-[#86909C] hover:border-[#165DFF] hover:text-[#165DFF]"
          onClick={() => {
            onChange({ ...branch, nodes: [...branch.nodes, { approverSource: "角色", approver: ROLES[0]?.name ?? "", mode: "会签", timeoutHours: 24 }] });
            setOpenNode(key(branch.nodes.length));
          }}>
          <Plus size={11} /> 节点
        </button>
        <span className="text-[#C9CDD4]">→</span>
        <span className="rounded-[6px] bg-[#E8F8F2] px-2.5 py-1.5 text-[11px] font-medium text-[#00B42A]">生效</span>
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
  const [docType, setDocType] = useState<DocType>("成本核算单 · 提交");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof simulate> | null>(null);
  const fields = FIELD_DEFS[docType] ?? [];
  return (
    <div className="rounded-[6px] border border-[#E5E6EB] bg-white p-4">
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
        <Button size="sm" className="h-7" onClick={() => {
          const ctx: Record<string, unknown> = {};
          fields.forEach((f) => { if (vals[f.key] !== undefined && vals[f.key] !== "") ctx[f.key] = Number(vals[f.key]); });
          setResult(simulate(docType, ctx));
        }}>试算</Button>
      </div>
      {result && (
        <div className={`mt-3 rounded-[6px] border px-3 py-2.5 text-xs ${result.hit ? "border-[#BEDAFF] bg-[#F0F6FF]" : "border-[#FFD9C4] bg-[#FFF7F0]"}`}>
          {result.hit && result.flow && result.branch ? (
            <div className="space-y-1.5">
              <div>
                <span className="font-medium text-[#0E42D2]">「{result.flow.name}」→ 分支「{result.branch.name}」</span>
                <span className="ml-2 text-[#86909C]">{result.branch.conds.length ? `条件：${condsText(result.branch.conds)} · ` : "兜底分支 · "}驳回：{result.branch.rejectPolicy}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-[6px] bg-[#E8F8F2] px-2 py-0.5 text-[11px] text-[#00B42A]">提交</span>
                {result.branch.nodes.map((n, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-[#C9CDD4]">→</span>
                    <span className="rounded-[6px] border border-[#BEDAFF] bg-white px-2 py-0.5 text-[11px] text-[#0E42D2]">{i + 1}. {nodeLabel(n)} · {n.mode} · {n.timeoutHours}h</span>
                  </span>
                ))}
                <span className="text-[#C9CDD4]">→</span>
                <span className="rounded-[6px] bg-[#E8F8F2] px-2 py-0.5 text-[11px] text-[#00B42A]">生效</span>
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
  const [openNode, setOpenNode] = useState<string | null>(null);

  useEffect(() => {
    setDraft(sel ? JSON.parse(JSON.stringify(sel)) : null);
    setErr(null); setOpenNode(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, flows.length]);

  const dirty = useMemo(() => draft && sel ? JSON.stringify(draft) !== JSON.stringify(sel) : false, [draft, sel]);
  const shown = flows.filter((f) => !kw || f.name.includes(kw) || f.docType.includes(kw));
  const active = instances.filter((i) => i.status === "审批中").length;
  const doneToday = instances.filter((i) => i.status !== "审批中" && i.results.some((r) => r.time.startsWith(DEMO_TODAY))).length;

  // 分支按 priority 排序展示；兜底强制排最后
  const sortedBranches = draft ? [...draft.branches].sort((a, b) => {
    const fa = a.conds.length ? 0 : 1, fb = b.conds.length ? 0 : 1;
    return fa !== fb ? fa - fb : a.priority - b.priority;
  }) : [];

  const pick = (id: string) => {
    if (dirty && !confirm("当前流有未保存的修改，切换将丢弃，继续？")) return;
    setSelId(id);
  };
  const patchDraft = (p: Partial<ApprovalFlow>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const replaceBranch = (b: FlowBranch) => setDraft((d) => (d ? { ...d, branches: d.branches.map((x) => (x.id === b.id ? b : x)) } : d));

  // 「先匹配/后匹配」通过临时增减 priority 实现，保存时统一重排为 100/200/...
  const normalize = (f: ApprovalFlow): ApprovalFlow => ({
    ...f,
    branches: [...f.branches].sort((a, b) => {
      const fa = a.conds.length ? 0 : 1, fb = b.conds.length ? 0 : 1;
      return fa !== fb ? fa - fb : a.priority - b.priority;
    }).map((b, i) => ({ ...b, priority: (i + 1) * 100 })),
  });

  const save = () => {
    if (!draft) return;
    const normalized = normalize(draft);
    if (!confirm(`保存审批流「${normalized.name}」？\n变更即时对后续提交的单据生效；在途单据仍按提交时的快照走完。`)) return;
    const e = saveFlow(normalized);
    setErr(e);
    if (!e) setDraft(JSON.parse(JSON.stringify(FLOW_BY_ID_SAFE(normalized.id))));
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
        <div className="flex items-center justify-between rounded-[6px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">审批流配置</span>
            <span className="text-[11px] text-[#86909C]">一个单据动作 = 一条审批流：先判「要不要审」，再按分支自上而下判「谁来审」</span>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>＋ 新建审批流</Button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {stats.map(([k, v, c]) => (
            <div key={k} className="rounded-[6px] border border-[#E5E6EB] bg-white px-4 py-3">
              <div className="text-[11px] text-[#86909C]">{k}</div>
              <div className="mt-0.5 text-xl font-semibold" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          {/* 左：审批流列表 */}
          <div className="w-64 shrink-0 rounded-[6px] border border-[#E5E6EB] bg-white">
            <div className="border-b border-[#F2F3F5] p-3">
              <Input placeholder="搜索审批流 / 单据动作" value={kw} onChange={(e) => setKw(e.target.value)} />
            </div>
            <div className="max-h-[720px] overflow-y-auto p-2">
              {shown.map((f) => (
                <button key={f.id} onClick={() => pick(f.id)}
                  className={`mb-1 w-full rounded-[6px] border px-3 py-2 text-left transition-colors ${sel?.id === f.id ? "border-[#165DFF] bg-[#F0F6FF]" : "border-transparent hover:bg-[#F7F8FA]"}`}>
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

          {/* 右：编排器 */}
          {draft && (
            <div className="flex-1 space-y-3">
              {/* 基本信息 + 触发条件 */}
              <div className={`rounded-[6px] border bg-white p-4 ${dirty ? "border-[#FFCF8B]" : "border-[#E5E6EB]"}`}>
                <div className="flex flex-wrap items-center gap-2">
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
                    <input type="checkbox" checked={draft.enabled} onChange={(e) => patchDraft({ enabled: e.target.checked })} /> 启用
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
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F7F8FA] pt-3">
                  <span className="text-xs text-[#4E5969]">触发条件</span>
                  <CondChips docType={draft.docType} conds={draft.conds} onChange={(conds) => patchDraft({ conds })} emptyHint="全部单据都触发" />
                </div>
              </div>

              {/* 分支链路 */}
              <div className="rounded-[6px] border border-[#E5E6EB] bg-[#FBFBFC] p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-[13px] font-semibold text-[#1D2129]">审批分支</span>
                    <span className="ml-2 text-[11px] text-[#86909C]">自上而下依次匹配，命中即走；兜底分支永远排在最后</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDraft((d) => d ? { ...d, branches: [...d.branches, { id: nextBranchId(), name: "", conds: [{ field: FIELD_DEFS[d.docType]?.[0]?.key ?? "", op: ">=", value: "" }], nodes: [{ approverSource: "角色", approver: ROLES[0]?.name ?? "", mode: "会签", timeoutHours: 24 }], rejectPolicy: "退回发起人修改后重报", priority: 150, enabled: true }] } : d)}>＋ 新建分支</Button>
                </div>
                <div className="space-y-3">
                  {sortedBranches.map((b, i) => (
                    <BranchCard key={b.id} branch={b} docType={draft.docType}
                      first={i === 0} last={i === sortedBranches.length - 1}
                      onChange={replaceBranch} openNode={openNode} setOpenNode={setOpenNode}
                      onRemove={() => {
                        if (!b.conds.length && !confirm("删除兜底分支后，未命中任何分支的单据将无链可走，确认？")) return;
                        patchDraft({ branches: draft.branches.filter((x) => x.id !== b.id) });
                      }} />
                  ))}
                </div>
              </div>

              {err && <div className="rounded-[6px] border border-[#FBACA3] bg-[#FFECE8] px-3 py-2 text-xs text-[#F53F3F]">{err}</div>}
              <div className="flex items-center justify-between rounded-[6px] border border-[#E5E6EB] bg-white px-4 py-2.5">
                <span className="text-[11px] text-[#C9CDD4]">最近变更 {sel?.updatedAt} · {sel?.updatedBy}　|　保存即时生效并留痕；在途单据按提交时快照走完</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!dirty} onClick={() => { setDraft(JSON.parse(JSON.stringify(sel))); setErr(null); setOpenNode(null); }}>放弃修改</Button>
                  <Button size="sm" disabled={!dirty} onClick={save}>保存审批流</Button>
                </span>
              </div>
            </div>
          )}
        </div>

        <SimPanel />

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[6px] border border-[#E5E6EB] bg-white p-4">
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
          <div className="rounded-[6px] border border-[#E5E6EB] bg-white p-4">
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

        <div className="rounded-[6px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          <div className="mb-0.5 font-medium text-[#4E5969]">审批引擎运行逻辑</div>
          {ENGINE_RULES.map((r, i) => <div key={i}>{i + 1}. {r}</div>)}
        </div>
      </main>

      {newOpen && <NewFlowModal onClose={() => setNewOpen(false)} />}
    </ArcoShell>
  );
}
