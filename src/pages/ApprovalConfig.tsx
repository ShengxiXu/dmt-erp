// A2 审批流配置（/system/approval）—— 一套模型、一个引擎，审批环节不写死在代码里
// 三层模型：审批点（嵌入哪个业务环节 + 结构化条件）→ 审批链（分支取链 + 有序节点）→ 审批实例（提交时快照，持久化）
// 本页：配置维护（点/链编辑、条件构建器、节点排序）+ 仿真试算 + 在途实例观测 + 变更留痕
import { useState } from "react";
import {
  useApprovalFlow, getPoints, getChains, getInstances, savePoint, togglePoint, saveChain, toggleChain, removeChain,
  CHAINS_OF, DOC_TYPES, FIELD_DEFS, COND_OPS, ENGINE_RULES, FLOW_LOGS, simulate, resolveApprover, condsText, nodeLabel,
  type ApprovalPoint, type ApprovalChain, type ChainNode, type DocType, type ScopeType, type MultiHit, type Cond,
} from "@/data/approvalFlow";
import { DEMO_TODAY } from "@/data/settings";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SCOPE_OPTS: ScopeType[] = ["全局", "按产品类别", "按客户级别", "按部门"];
const MULTIHIT_OPTS: MultiHit[] = ["按优先级取第一条", "全部串行（命中几个走几个）", "并行会签"];
const selCls = "rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm";

// ---------- 结构化条件构建器（条件组内 AND；op=非空 时值留空） ----------
function CondBuilder({ docType, conds, onChange, hint }: { docType: DocType | string; conds: Cond[]; onChange: (c: Cond[]) => void; hint?: string }) {
  const fields = FIELD_DEFS[docType] ?? [];
  const patch = (i: number, p: Partial<Cond>) => onChange(conds.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div className="space-y-1.5">
      {conds.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-8 shrink-0 text-right text-[10px] text-[#86909C]">{i === 0 ? "IF" : "AND"}</span>
          <select className={`${selCls} w-40`} value={c.field} onChange={(e) => patch(i, { field: e.target.value })}>
            {(fields.length ? fields : [{ key: c.field, label: c.field, kind: "text" as const }]).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select className={`${selCls} w-20`} value={c.op} onChange={(e) => patch(i, { op: e.target.value as Cond["op"] })}>
            {COND_OPS.map((o) => <option key={o}>{o}</option>)}
          </select>
          {c.op !== "非空" && (
            <Input className="w-32" placeholder="比较值" value={c.value} onChange={(e) => patch(i, { value: e.target.value })} />
          )}
          <button className="ml-auto shrink-0 text-[#F53F3F] hover:underline" onClick={() => onChange(conds.filter((_, j) => j !== i))}>移除</button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onChange([...conds, { field: fields[0]?.key ?? "", op: ">=", value: "" }])}>＋ 加条件</Button>
        {hint && <span className="text-[10px] text-[#86909C]">{hint}</span>}
        {!conds.length && <span className="text-[10px] text-[#86909C]">未设条件 = 全部命中</span>}
      </div>
    </div>
  );
}

// ---------- 审批点编辑 ----------
function PointForm({ initial, onClose }: { initial?: ApprovalPoint; onClose: () => void }) {
  const [f, setF] = useState<ApprovalPoint>(() => initial ?? {
    id: "", name: "", docType: "成本核算单 · 提交", enabled: true,
    conds: [], scope: "全局", multiHit: "按优先级取第一条", priority: 100,
    isDefault: false, updatedAt: "", updatedBy: "",
  });
  const set = (k: string, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name.trim()) return alert("请填写审批点名称");
    if (f.scope !== "全局" && !f.scopeValue?.trim()) return alert("已选适用范围，请填写取值（如 部门 = 销售部）");
    if (!confirm(`保存审批点「${f.name}」？\n变更即时对后续提交的单据生效；在途单据仍按提交时的配置走完。`)) return;
    savePoint(f);
    onClose();
  };
  return (
    <CenterModal title={initial ? `编辑审批点 · ${initial.name}` : "新建审批点"} sub="第一层配置：决定审批嵌入哪个业务环节、什么条件下触发" width={600} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">审批点名称 <span className="text-[#F53F3F]">*</span></div>
            <Input autoFocus placeholder="如「大额核算审批」「核算变更审批」" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">挂接单据与触发动作 <span className="text-[#F53F3F]">*</span></div>
            <select className={`${selCls} w-full`} value={f.docType} onChange={(e) => setF((x) => ({ ...x, docType: e.target.value as DocType, conds: [] }))}>
              {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[#4E5969]">触发条件（结构化，组内 AND 求值）</div>
          <CondBuilder docType={f.docType} conds={f.conds} onChange={(conds) => setF((x) => ({ ...x, conds }))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">适用范围</div>
            <select className={`${selCls} w-full`} value={f.scope} onChange={(e) => set("scope", e.target.value)}>
              {SCOPE_OPTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          {f.scope !== "全局" && (
            <div>
              <div className="mb-0.5 text-[#4E5969]">取值 <span className="text-[#F53F3F]">*</span></div>
              <Input placeholder={f.scope === "按部门" ? "如 销售部" : "如 BGP专线 / A级"} value={f.scopeValue ?? ""} onChange={(e) => setF((x) => ({ ...x, scopeValue: e.target.value }))} />
            </div>
          )}
          <div>
            <div className="mb-0.5 text-[#4E5969]">多命中处理</div>
            <select className={`${selCls} w-full`} value={f.multiHit} onChange={(e) => set("multiHit", e.target.value)}>
              {MULTIHIT_OPTS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">优先级（小者优先）</div>
            <Input type="number" value={f.priority} onChange={(e) => set("priority", Number(e.target.value) || 100)} />
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
function ChainForm({ pointId, docType, initial, onClose }: { pointId: string; docType: DocType; initial?: ApprovalChain; onClose: () => void }) {
  const [f, setF] = useState<ApprovalChain>(() => initial ?? {
    id: "", pointId, name: "", branchConds: [],
    nodes: [{ approverSource: "角色", approver: "", mode: "会签", timeoutHours: 24 }],
    rejectPolicy: "退回发起人修改后重报", enabled: true, priority: 200, isDefault: false, updatedAt: "",
  });
  const patchNode = (i: number, patch: Partial<ChainNode>) => setF((x) => ({ ...x, nodes: x.nodes.map((n, j) => j === i ? { ...n, ...patch } : n) }));
  const moveNode = (i: number, dir: -1 | 1) => setF((x) => {
    const j = i + dir;
    if (j < 0 || j >= x.nodes.length) return x;
    const nodes = [...x.nodes];
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    return { ...x, nodes };
  });
  const save = () => {
    if (!f.nodes.length) return alert("审批链至少需要一个节点");
    if (f.nodes.some((n) => !n.approver.trim())) return alert("每个节点都要指定审批人（指定人 / 角色 / 部门负责人）");
    if (!confirm(`保存审批链「${f.name || "未命名链"}」？\n变更即时对后续提交的单据生效；在途单据仍按提交时的快照走完。`)) return;
    saveChain(f);
    onClose();
  };
  const isFallback = !f.branchConds.length;
  return (
    <CenterModal title={initial ? `编辑审批链 · ${initial.id}` : "新建审批链"} sub="第二层配置：单据命中本审批点后，按分支条件自上而下取第一条命中的启用链" width={680} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">链名称</div>
            <Input placeholder="如「标准三级复核」「大额加审管理层」" value={f.name ?? ""} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">匹配优先级（小者先匹配）</div>
            <Input type="number" value={f.priority} onChange={(e) => setF((x) => ({ ...x, priority: Number(e.target.value) || 200 }))} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">驳回策略</div>
            <select className={`${selCls} w-full`} value={f.rejectPolicy} onChange={(e) => setF((x) => ({ ...x, rejectPolicy: e.target.value as ApprovalChain["rejectPolicy"] }))}>
              <option>退回发起人修改后重报</option><option>逐级退回</option>
            </select>
          </div>
        </div>
        <div className="rounded-[4px] border border-[#E5E6EB] bg-[#F7F8FA] p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[#4E5969]">分支条件（不设 = 兜底链，所有未命中分支的单据走这里）</span>
            <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${isFallback ? "bg-[#F7F8FA] text-[#4E5969]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>{isFallback ? "兜底链" : "分支链"}</span>
          </div>
          <CondBuilder docType={docType} conds={f.branchConds} onChange={(branchConds) => setF((x) => ({ ...x, branchConds }))} />
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
                <span className="flex shrink-0 flex-col">
                  <button type="button" disabled={i === 0} onClick={() => moveNode(i, -1)} className="text-[#165DFF] disabled:text-[#C9CDD4]">▲</button>
                  <button type="button" disabled={i === f.nodes.length - 1} onClick={() => moveNode(i, 1)} className="text-[#165DFF] disabled:text-[#C9CDD4]">▼</button>
                </span>
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
                <span className="ml-auto shrink-0 text-[10px] text-[#86909C]">→ {resolveApprover(n)}</span>
                {f.nodes.length > 1 && (
                  <button className="shrink-0 text-[#F53F3F] hover:underline" onClick={() => setF((x) => ({ ...x, nodes: x.nodes.filter((_, j) => j !== i) }))}>移除</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-[#86909C]">会签 = 该级全部通过才算过；或签 = 一人通过即可。超期未审自动催办并升级上级。</div>
        </div>
        <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          <label className="flex items-center gap-2 text-[#4E5969]">
            <input type="checkbox" checked={f.enabled} onChange={(e) => setF((x) => ({ ...x, enabled: e.target.checked }))} />
            启用
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

// ---------- 仿真试算面板 ----------
function SimPanel() {
  const [docType, setDocType] = useState<DocType>("成本核算单 · 提交");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof simulate> | null>(null);
  const fields = FIELD_DEFS[docType] ?? [];
  const run = () => {
    const ctx: Record<string, unknown> = {};
    fields.forEach((f) => { if (vals[f.key] !== undefined && vals[f.key] !== "") ctx[f.key] = Number(vals[f.key]); });
    setResult(simulate(docType, ctx));
  };
  return (
    <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-[#1D2129]">仿真试算</span>
        <span className="text-[11px] text-[#86909C]">填入一笔模拟单据的字段，实时预览将命中哪个审批点、走哪条链、经过哪些节点——不产生任何数据</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select className={selCls} value={docType} onChange={(e) => { setDocType(e.target.value as DocType); setResult(null); setVals({}); }}>
          {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
        </select>
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-1 text-[#4E5969]">
            {f.label}
            <Input className="w-24" type="number" value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
          </label>
        ))}
        {!fields.length && <span className="text-[#86909C]">该单据类型未定义试算字段（按无条件匹配）</span>}
        <Button size="sm" onClick={run}>试算</Button>
      </div>
      {result && (
        <div className={`mt-3 rounded-[4px] border px-3 py-2.5 text-xs ${result.hit ? "border-[#BEDAFF] bg-[#F0F6FF]" : "border-[#FFD9C4] bg-[#FFF7F0]"}`}>
          {result.hit && result.point && result.chain ? (
            <div className="space-y-1.5">
              <div>
                <span className="text-[#0E42D2]">命中审批点「{result.point.name}」</span>
                <span className="ml-2 text-[#86909C]">选用链「{result.chain.name ?? result.chain.id}」（{result.chain.branchConds.length ? `分支：${condsText(result.chain.branchConds)}` : "兜底链"} · 驳回：{result.chain.rejectPolicy}）</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-1 text-[11px] text-[#00B42A]">提交（{result.hit ? "进入审批" : ""}）</span>
                {result.chain.nodes.map((n, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-[#C9CDD4]">→</span>
                    <span className="rounded-[2px] border border-[#BEDAFF] bg-[#E8F3FF] px-2 py-1 text-[11px] text-[#0E42D2]">{i + 1}. {nodeLabel(n)} · {n.mode} · {n.timeoutHours}h</span>
                  </span>
                ))}
                <span className="text-[#C9CDD4]">→</span>
                <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-1 text-[11px] text-[#00B42A]">生效</span>
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
export default function ApprovalConfig() {
  useApprovalFlow();
  const points = getPoints();
  const instances = getInstances();
  const [selId, setSelId] = useState(points[0]?.id ?? "");
  const [kw, setKw] = useState("");
  const [pointForm, setPointForm] = useState<{ open: boolean; initial?: ApprovalPoint }>({ open: false });
  const [chainForm, setChainForm] = useState<{ open: boolean; initial?: ApprovalChain }>({ open: false });
  const sel = points.find((p) => p.id === selId) ?? points[0];
  const shown = points.filter((p) => !kw || p.name.includes(kw) || p.docType.includes(kw));
  const chains = sel ? CHAINS_OF(sel.id) : [];
  const active = instances.filter((i) => i.status === "审批中").length;
  const doneToday = instances.filter((i) => i.status !== "审批中" && i.results.some((r) => r.time.startsWith(DEMO_TODAY))).length;

  const stats: [string, string, string][] = [
    ["审批点", `${points.filter((p) => p.enabled).length} 启用 / ${points.length} 共`, "#165DFF"],
    ["审批链", `${getChains().filter((c) => c.enabled).length} 启用 / ${getChains().length} 共`, "#0E42D2"],
    ["在途审批实例", `${active}`, "#FF7D00"],
    ["今日完成", `${doneToday}`, "#00B42A"],
  ];

  return (
    <ArcoShell breadcrumb="系统管理 / 审批流配置">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">审批流配置</span>
            <span className="text-[11px] text-[#86909C]">一套模型、一个引擎：自主决定审批嵌入哪个业务环节、什么条件下触发、经过谁审批</span>
          </div>
          <Button size="sm" onClick={() => setPointForm({ open: true })}>＋ 新建审批点</Button>
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
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`${sel.enabled ? "停用" : "启用"}审批点「${sel.name}」？变更即时生效并留痕。`)) togglePoint(sel.id); }}>
                      {sel.enabled ? "停用" : "启用"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPointForm({ open: true, initial: sel })}>编辑</Button>
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-3">
                  {[
                    ["挂接单据与触发动作", sel.docType],
                    ["触发条件", sel.conds.length ? condsText(sel.conds) : (sel.legacyCondition ? `（旧配置）${sel.legacyCondition}` : "无条件（全部命中）")],
                    ["适用范围", sel.scope !== "全局" && sel.scopeValue ? `${sel.scope} = ${sel.scopeValue}` : sel.scope],
                    ["多命中处理", sel.multiHit],
                    ["优先级", `${sel.priority}（小者优先）`],
                    ["审批链", `${chains.filter((c) => c.enabled).length} 条启用 / 共 ${chains.length} 条`],
                    ["最近变更", `${sel.updatedAt} · ${sel.updatedBy}`],
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
                    <span className="ml-2 text-[11px] text-[#86909C]">按匹配优先级自上而下，取第一条命中的启用链；都不命中走兜底链</span>
                  </div>
                  <Button size="sm" onClick={() => setChainForm({ open: true })}>＋ 新建审批链</Button>
                </div>
                <div className="space-y-2">
                  {chains.map((c) => (
                    <div key={c.id} className={`rounded-[4px] border px-4 py-3 text-xs ${c.enabled ? "border-[#E5E6EB]" : "border-dashed border-[#E5E6EB] opacity-60"}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#86909C]">{c.id}</span>
                        <span className="font-medium text-[#1D2129]">{c.name ?? "未命名链"}</span>
                        <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${c.branchConds.length ? "bg-[#FFF3E8] text-[#FF7D00]" : "bg-[#F7F8FA] text-[#4E5969]"}`}>
                          {c.branchConds.length ? `分支：${condsText(c.branchConds)}` : (c.legacyBranch ? `（旧）${c.legacyBranch}` : "兜底链")}
                        </span>
                        <span className="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#86909C]">优先级 {c.priority}</span>
                        {c.isDefault && <span className="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#86909C]">出厂默认</span>}
                        <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${c.enabled ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>{c.enabled ? "启用" : "停用"}</span>
                        <span className="ml-auto flex gap-2">
                          <button className="text-[#165DFF] hover:underline" onClick={() => setChainForm({ open: true, initial: c })}>编辑</button>
                          <button className="text-[#4E5969] hover:underline" onClick={() => { if (confirm(`${c.enabled ? "停用" : "启用"}审批链 ${c.id}？`)) toggleChain(c.id); }}>{c.enabled ? "停用" : "启用"}</button>
                          {!c.isDefault && <button className="text-[#F53F3F] hover:underline" onClick={() => { if (confirm(`删除审批链 ${c.id}？变更留痕。`)) removeChain(c.id); }}>删除</button>}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {c.nodes.map((n, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            <span className="rounded-[2px] border border-[#BEDAFF] bg-[#E8F3FF] px-2 py-1 text-[11px] text-[#0E42D2]">
                              {i + 1}. {n.approverSource} · {n.approver} · {n.mode} · {n.timeoutHours}h
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

        <SimPanel />

        <div className="grid grid-cols-2 gap-4">
          {/* 在途与近期实例 */}
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#1D2129]">在途与近期审批实例</span>
              <span className="text-[11px] text-[#86909C]">提交时对链做快照：在途单不受配置变更影响</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] text-[#86909C]">
                  <th className="pb-1.5 font-normal">单据</th><th className="pb-1.5 font-normal">审批点 / 链</th>
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
                    <td className="py-1.5 text-[#4E5969]">{i.pointName} / {i.chainName ?? i.chainId}</td>
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
          {/* 变更留痕 */}
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#1D2129]">变更留痕</span>
              <span className="text-[11px] text-[#86909C]">配置调整与审批动作全程记录（近 10 条）</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {FLOW_LOGS_PREVIEW().map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 text-[10px] text-[#86909C]">{l.at}</span>
                  <span className="text-[#4E5969]">{l.action}</span>
                </div>
              ))}
              {!FLOW_LOGS_PREVIEW().length && <div className="py-6 text-center text-[#C9CDD4]">暂无变更记录</div>}
            </div>
          </div>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          <div className="mb-0.5 font-medium text-[#4E5969]">审批引擎运行逻辑</div>
          {ENGINE_RULES.map((r, i) => <div key={i}>{i + 1}. {r}</div>)}
        </div>
      </main>

      {pointForm.open && <PointForm initial={pointForm.initial} onClose={() => setPointForm({ open: false })} />}
      {chainForm.open && sel && <ChainForm pointId={sel.id} docType={sel.docType} initial={chainForm.initial} onClose={() => setChainForm({ open: false })} />}
    </ArcoShell>
  );
}

const FLOW_LOGS_PREVIEW = () => FLOW_LOGS.slice(0, 10);
