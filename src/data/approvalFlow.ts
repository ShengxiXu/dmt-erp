// A2 审批流引擎 v3 —— 单层「审批流模板」模型：一个单据动作 = 一条审批流
// 流 = 触发条件（要不要审）+ 分支链列表（谁来审：分支条件自上而下取第一条命中的启用链，空条件兜底）
// 提交那一刻对链做快照：审批实例持久化，在途单据不受配置变更影响；审批动作真实写回业务单据。
// v2 → v3 迁移：旧的「审批点 + 审批链」两层快照自动合并为单层流；旧审批实例字段自动改名。
import { useSyncExternalStore } from "react";
import { persistable, hasSnapshot } from "@/data/persist";
import { notify } from "@/data/notices";
import { demoNow } from "@/data/settings";
import { SHEETS } from "@/data/sheets";
import { USERS } from "@/data/users";
import { resolveDeptLeader } from "@/data/departments";

// ---------- 挂接单据候选集 ----------
export const DOC_TYPES = [
  "成本核算单 · 提交", "采购单 · 提交", "采购需求单 · 关闭", "到货验收单 · 提交", "资源分配申请 · 提交",
  "核算变更单 · 提交", "变更申请单 · 提交", "退订申请单 · 提交", "退订审核单 · 提交",
  "收款红冲 · 提交", "坏账申请单 · 提交", "付款申请单 · 提交", "合同/订单建档 · 提交",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

// ---------- 结构化条件（条件组内 AND；空组 = 无条件） ----------
export type CondOp = ">=" | "<=" | ">" | "<" | "=" | "!=" | "包含" | "非空";
export interface Cond { field: string; op: CondOp; value: string }
export const COND_OPS: CondOp[] = [">=", "<=", ">", "<", "=", "!=", "包含", "非空"];

/** 各单据可用于条件的字段（触发条件与分支条件、仿真试算共用） */
export const FIELD_DEFS: Record<string, { key: string; label: string; kind: "number" | "text" }[]> = {
  "成本核算单 · 提交": [
    { key: "monthlyCost", label: "月成本(元)", kind: "number" },
    { key: "contractValue", label: "合同月额(元)", kind: "number" },
    { key: "margin", label: "毛利(%)", kind: "number" },
    { key: "lines", label: "订单行数", kind: "number" },
  ],
  "采购单 · 提交": [{ key: "amount", label: "采购金额(元)", kind: "number" }],
  "合同/订单建档 · 提交": [
    { key: "amount", label: "合同月租合计(元)", kind: "number" },
    { key: "discount", label: "折扣率(%)", kind: "number" },
  ],
};

export function evalConds(conds: Cond[] | undefined, ctx: Record<string, unknown>): boolean {
  if (!conds?.length) return true;
  return conds.every((c) => {
    const v = ctx[c.field];
    if (c.op === "非空") return v !== undefined && v !== null && v !== "";
    if (c.op === "包含") return String(v ?? "").includes(c.value);
    const cur = Number(v);
    const num = Number(c.value);
    const bothNum = !Number.isNaN(cur) && !Number.isNaN(num) && c.value.trim() !== "";
    switch (c.op) {
      case ">=": return bothNum && cur >= num;
      case "<=": return bothNum && cur <= num;
      case ">": return bothNum && cur > num;
      case "<": return bothNum && cur < num;
      case "=": return bothNum ? cur === num : String(v ?? "") === c.value;
      case "!=": return bothNum ? cur !== num : String(v ?? "") !== c.value;
      default: return false;
    }
  });
}

export function condsText(conds: Cond[] | undefined): string {
  if (!conds?.length) return "";
  return conds.map((c) => `${c.field} ${c.op} ${c.op === "非空" ? "" : c.value}`.trim()).join(" 且 ");
}

// ---------- 审批节点 ----------
export type ApproverSource = "指定人" | "角色" | "部门负责人";
export interface ChainNode {
  approverSource: ApproverSource;
  approver: string;             // 人名 / 角色名 / 部门名（来源自主数据：用户 / 角色 / 部门）
  mode: "会签" | "或签";
  timeoutHours: number;
}

/** 审批人解析（展示用；演示环境不强制校验审批人身份） */
export function resolveApprover(node: ChainNode): string {
  if (node.approverSource === "指定人") return node.approver || "（未指定）";
  if (node.approverSource === "角色") {
    const u = USERS.find((x) => x.role === node.approver && x.status === "启用");
    return u ? `${u.name}（${node.approver}）` : `${node.approver}（该角色无启用账号）`;
  }
  const leader = resolveDeptLeader(node.approver);
  return leader ? `${leader.name}（${node.approver}·负责人${leader.from === "兜底" ? "·兜底" : ""}）` : `${node.approver}（未指定负责人）`;
}
export const nodeLabel = (node: ChainNode) => `${resolveApprover(node)} 审批`;

// ---------- 单层模型：审批流（一个单据动作一条流） ----------
export type RejectPolicy = "退回发起人修改后重报" | "逐级退回";
export interface FlowBranch {
  id: string;                   // BR-xx
  name: string;
  conds: Cond[];                // 分支条件（AND；空 = 兜底分支）
  nodes: ChainNode[];
  rejectPolicy: RejectPolicy;
  priority: number;             // 匹配顺序，小者优先；兜底分支建议大值
  enabled: boolean;
  isDefault?: boolean;
}
export interface ApprovalFlow {
  id: string;                   // AF-xx
  name: string;
  docType: DocType;
  enabled: boolean;
  conds: Cond[];                // 触发条件（AND；空 = 该动作全部单据触发）
  branches: FlowBranch[];
  updatedAt: string; updatedBy: string;
  isDefault?: boolean;
}

// ---------- 旧两层模型（v2）读取：有旧快照读快照，没有读出厂种子，仅用于迁移 ----------
interface LegacyPoint { id: string; name: string; docType: DocType; enabled: boolean; conds: Cond[]; condition?: { kind: string; text: string }; legacyCondition?: string; updatedAt: string; updatedBy: string; isDefault?: boolean; priority?: number }
interface LegacyChain { id: string; pointId: string; name?: string; branchConds: Cond[]; branch?: string; legacyBranch?: string; nodes: ChainNode[]; rejectPolicy: RejectPolicy; priority?: number; enabled: boolean; isDefault?: boolean; updatedAt: string }
const LEGACY_POINTS: LegacyPoint[] = persistable("approvalPoints", () => [
  { id: "AP-01", name: "成本核算审批", docType: "成本核算单 · 提交", enabled: true, conds: [], updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂", isDefault: true },
  { id: "AP-02", name: "采购审批", docType: "采购单 · 提交", enabled: true, conds: [], updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂", isDefault: true },
  { id: "AP-03", name: "资源分配审批", docType: "资源分配申请 · 提交", enabled: true, conds: [], updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂", isDefault: true },
  { id: "AP-04", name: "退款/红冲审批", docType: "收款红冲 · 提交", enabled: true, conds: [], updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂", isDefault: true },
  { id: "AP-05", name: "付款审批", docType: "付款申请单 · 提交", enabled: true, conds: [], updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂", isDefault: true },
]);
const LEGACY_CHAINS: LegacyChain[] = persistable("approvalChains", () => [
  { id: "AC-01", pointId: "AP-01", name: "标准三级复核", branchConds: [], nodes: [
    { approverSource: "角色", approver: "业务支撑部", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "技术部", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "财务", mode: "会签", timeoutHours: 24 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, priority: 200, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-02", pointId: "AP-01", name: "大额加审管理层", branchConds: [{ field: "monthlyCost", op: ">=", value: "50000" }], nodes: [
    { approverSource: "角色", approver: "业务支撑部", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "技术部", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "财务", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "逐级退回", enabled: true, priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-03", pointId: "AP-02", name: "标准采购审批", branchConds: [], nodes: [
    { approverSource: "角色", approver: "业务支撑部", mode: "会签", timeoutHours: 24 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, priority: 200, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-04", pointId: "AP-02", name: "大额采购双审", branchConds: [{ field: "amount", op: ">=", value: "100000" }], nodes: [
    { approverSource: "角色", approver: "业务支撑部", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-05", pointId: "AP-03", name: "资源分配审批", branchConds: [], nodes: [
    { approverSource: "角色", approver: "技术部", mode: "会签", timeoutHours: 24 },
  ], rejectPolicy: "逐级退回", enabled: true, priority: 200, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-06", pointId: "AP-04", name: "红冲/坏账双审", branchConds: [], nodes: [
    { approverSource: "角色", approver: "财务", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, priority: 200, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-07", pointId: "AP-05", name: "大额付款双审", branchConds: [{ field: "amount", op: ">=", value: "100000" }], nodes: [
    { approverSource: "角色", approver: "财务", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "逐级退回", enabled: true, priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00" },
]);
// 旧快照字段迁移（v1 无条件文本 → v2 结构化）
LEGACY_POINTS.forEach((p) => {
  if (!p.conds) {
    const legacy = p.condition;
    p.conds = [];
    p.legacyCondition = p.legacyCondition ?? (legacy && legacy.kind !== "无条件" ? `${legacy.kind}：${legacy.text}` : undefined);
    delete p.condition;
  }
});
LEGACY_CHAINS.forEach((c) => {
  if (!c.branchConds) {
    c.branchConds = [];
    c.legacyBranch = c.legacyBranch ?? (c.branch || undefined);
    delete c.branch;
  }
  if (c.priority === undefined) c.priority = c.branchConds?.length ? 100 : 200;
});

// ---------- 审批流台账（迁移填充；新用户由出厂种子经迁移生成） ----------
export const FLOWS: ApprovalFlow[] = persistable("approvalFlows", () => []);
const flowsFromSnapshot = hasSnapshot("approvalFlows") && FLOWS.length > 0;
if (!flowsFromSnapshot) {
  let brSeq = 0;
  LEGACY_POINTS.forEach((p) => {
    FLOWS.push({
      id: p.id.replace("AP-", "AF-"),
      name: p.name,
      docType: p.docType,
      enabled: p.enabled,
      conds: p.conds ?? [],
      branches: LEGACY_CHAINS.filter((c) => c.pointId === p.id).sort((a, b) => (a.priority ?? 200) - (b.priority ?? 200)).map((c) => ({
        id: `BR-${String(++brSeq).padStart(2, "0")}`,
        name: c.name ?? (c.branchConds?.length ? "分支链" : "兜底链"),
        conds: c.branchConds ?? [],
        nodes: c.nodes,
        rejectPolicy: c.rejectPolicy,
        priority: c.priority ?? (c.branchConds?.length ? 100 : 200),
        enabled: c.enabled,
        isDefault: c.isDefault,
      })),
      updatedAt: p.updatedAt,
      updatedBy: p.updatedBy,
      isDefault: p.isDefault,
    });
  });
}
// 兜底保障：任何流至少有一条兜底分支（无条件的启用分支）
let brCounter = 0;
FLOWS.forEach((f) => {
  if (!f.branches.some((b) => b.enabled && !b.conds.length)) {
    f.branches.push({
      id: `BR-${String(++brCounter).padStart(2, "0")}`,
      name: "标准审批", conds: [],
      nodes: [{ approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 24 }],
      rejectPolicy: "退回发起人修改后重报", priority: 200, enabled: true,
    });
  }
});
brCounter = FLOWS.reduce((m, f) => Math.max(m, ...f.branches.map((b) => Number(b.id.replace("BR-", "")) || 0), 0), brCounter);
export const nextBranchId = () => `BR-${String(++brCounter).padStart(2, "0")}`;

// ---------- 审批实例（引擎产物，持久化；v2 字段自动迁移） ----------
export interface NodeResult { nodeIdx: number; nodeLabel: string; action: "通过" | "驳回"; by: string; time: string; comment: string }
export interface ApprovalInstance {
  id: string;                    // AV-xxx
  docType: DocType;
  docId: string;
  summary: string;
  flowId: string; flowName: string;
  branchId?: string; branchName?: string;
  snapshot: { nodes: ChainNode[]; rejectPolicy: RejectPolicy; branch: string };
  status: "审批中" | "已通过" | "已驳回";
  curNodeIdx: number;
  results: NodeResult[];
  submitter: string; submitAt: string;
  ctx: Record<string, unknown>;
  // v2 遗留字段（迁移用，读取处不再使用）
  pointId?: string; pointName?: string; chainId?: string; chainName?: string;
}
export const INSTANCES: ApprovalInstance[] = persistable("approvalInstances", () => []);
INSTANCES.forEach((i) => {
  if (!i.flowId) {
    i.flowId = (i.pointId ?? "").replace("AP-", "AF-");
    i.flowName = i.pointName ?? "";
    i.branchId = i.chainId;
    i.branchName = i.chainName;
    delete i.pointId; delete i.pointName; delete i.chainId; delete i.chainName;
  }
});

// ---------- store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function useApprovalFlow(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getFlows = () => FLOWS;
export const getInstances = () => INSTANCES;
export const FLOW_BY_ID = (id: string) => FLOWS.find((f) => f.id === id);
export const FLOW_BY_DOC = (docType: DocType) => FLOWS.find((f) => f.docType === docType);
export const INSTANCE_OF_DOC = (docId: string) => INSTANCES.find((i) => i.docId === docId);

// ---------- 引擎：匹配 ----------
/** 分支匹配：按优先级自上而下取第一条命中的启用分支；空条件分支 = 兜底 */
export function resolveBranch(flowId: string, ctx: Record<string, unknown>): FlowBranch | null {
  const flow = FLOW_BY_ID(flowId);
  if (!flow) return null;
  const branches = [...flow.branches].filter((b) => b.enabled).sort((a, b) => a.priority - b.priority);
  return branches.find((b) => evalConds(b.conds, ctx)) ?? null;
}

/** 仿真试算：返回将走的完整路径（配置页预览用，不产生数据） */
export function simulate(docType: DocType, ctx: Record<string, unknown>): {
  hit: boolean; reason?: string; flow?: ApprovalFlow; branch?: FlowBranch | null;
} {
  const flows = FLOWS.filter((f) => f.enabled && f.docType === docType && evalConds(f.conds, ctx));
  if (!flows.length) return { hit: false, reason: "未命中任何启用审批流 → 单据直接生效，不生成审批" };
  const flow = flows[0];
  const branch = resolveBranch(flow.id, ctx);
  if (!branch) return { hit: false, reason: `命中审批流「${flow.name}」但该流没有可用分支（请配置兜底分支）`, flow };
  return { hit: true, flow, branch };
}

// ---------- 引擎：提交 / 审批 ----------
export interface SubmitResult { hit: boolean; instance?: ApprovalInstance; reason?: string }

export function submitForApproval(docType: DocType, docId: string, summary: string, ctx: Record<string, unknown>, submitter: string): SubmitResult {
  const existing = INSTANCE_OF_DOC(docId);
  if (existing && existing.status === "审批中") return { hit: true, instance: existing, reason: "已有在途审批实例" };
  const { hit, reason, flow, branch } = simulate(docType, ctx);
  if (!hit || !flow || !branch) {
    logFlow(`提交 ${docId}：${reason ?? "未命中审批流，直接生效"}`);
    return { hit: false, reason };
  }
  const instance: ApprovalInstance = {
    id: `AV-${String(INSTANCES.length + 1).padStart(3, "0")}`,
    docType, docId, summary,
    flowId: flow.id, flowName: flow.name,
    branchId: branch.id, branchName: branch.name,
    snapshot: { nodes: branch.nodes.map((n) => ({ ...n })), rejectPolicy: branch.rejectPolicy, branch: branch.conds.length ? condsText(branch.conds) : "兜底分支" },
    status: "审批中", curNodeIdx: 0, results: [],
    submitter, submitAt: demoNow(), ctx: { ...ctx },
  };
  INSTANCES.unshift(instance);
  syncSheet(instance);
  const cur = branch.nodes[0];
  notify({ level: "orange", group: "审批", title: `待审批：${docId}`, text: `${summary} · 当前节点：${nodeLabel(cur)}（${flow.name}）`, to: "/approval", roles: [notifyRoleOf(cur)] });
  logFlow(`提交 ${docId} → 流「${flow.name}」/ 分支「${branch.name}」（${branch.conds.length ? "条件" : "兜底"}），进入 ${nodeLabel(cur)}`);
  bump();
  return { hit: true, instance };
}

/** 节点通知角色：角色节点 → 该角色；指定人/部门负责人 → 系统管理员代达 */
function notifyRoleOf(node: ChainNode): string {
  if (node.approverSource === "角色") return node.approver;
  if (node.approverSource === "部门负责人") {
    const leader = resolveDeptLeader(node.approver);
    const u = USERS.find((x) => x.name === leader?.name && x.status === "启用");
    if (u) return u.role;
  }
  return "系统管理员";
}

export function approveInstance(id: string, by: string, comment: string): string | null {
  const inst = INSTANCES.find((i) => i.id === id);
  if (!inst || inst.status !== "审批中") return "该审批不在进行中";
  const cur = inst.snapshot.nodes[inst.curNodeIdx];
  if (!cur) return "节点已越界";
  inst.results.push({ nodeIdx: inst.curNodeIdx, nodeLabel: nodeLabel(cur), action: "通过", by, time: demoNow(), comment: comment || "—" });
  inst.curNodeIdx += 1;
  if (inst.curNodeIdx >= inst.snapshot.nodes.length) {
    inst.status = "已通过";
    finishSheet(inst, "已通过");
    notify({ level: "green", group: "审批", title: `审批通过：${inst.docId}`, text: `${inst.summary} · 全链路 ${inst.results.length} 级审批完成`, to: "/approval" });
    logFlow(`${inst.docId} 审批通过（${inst.results.length} 级）`);
  } else {
    const next = inst.snapshot.nodes[inst.curNodeIdx];
    syncSheet(inst);
    notify({ level: "orange", group: "审批", title: `待审批：${inst.docId}`, text: `${inst.summary} · 流转至 ${nodeLabel(next)}`, to: "/approval", roles: [notifyRoleOf(next)] });
    logFlow(`${inst.docId}：${nodeLabel(cur)} 通过 → 流转至 ${nodeLabel(next)}（by ${by}）`);
  }
  bump();
  return null;
}

export function rejectInstance(id: string, by: string, comment: string): string | null {
  const inst = INSTANCES.find((i) => i.id === id);
  if (!inst || inst.status !== "审批中") return "该审批不在进行中";
  if (!comment.trim()) return "驳回必须填写意见";
  const cur = inst.snapshot.nodes[inst.curNodeIdx];
  inst.results.push({ nodeIdx: inst.curNodeIdx, nodeLabel: nodeLabel(cur), action: "驳回", by, time: demoNow(), comment });
  inst.status = "已驳回";
  finishSheet(inst, "已驳回");
  notify({ level: "red", group: "审批", title: `审批驳回：${inst.docId}`, text: `${inst.summary} · ${nodeLabel(cur)} 驳回：${comment}（${inst.snapshot.rejectPolicy}）`, to: "/approval" });
  logFlow(`${inst.docId}：${nodeLabel(cur)} 驳回（by ${by}）：${comment}`);
  bump();
  return null;
}

// ---------- 引擎 ↔ 核算单写回 ----------
function syncSheet(inst: ApprovalInstance) {
  const s = SHEETS.find((x) => x.id === inst.docId);
  if (!s) return;
  s.status = "审批中";
  const cur = inst.snapshot.nodes[inst.curNodeIdx];
  s.curNode = cur ? nodeLabel(cur) : undefined;
  s.updated = demoNow();
}
function finishSheet(inst: ApprovalInstance, status: "已通过" | "已驳回") {
  const s = SHEETS.find((x) => x.id === inst.docId);
  if (!s) return;
  s.status = status;
  s.curNode = undefined;
  s.updated = demoNow();
}

// ---------- 在途单回填（旧快照只有审批中状态、没有实例：按现配置补建，停在末节点、前置节点记通过） ----------
SHEETS.filter((s) => s.status === "审批中" && !INSTANCE_OF_DOC(s.id)).forEach((s) => {
  const ctx = { monthlyCost: s.monthlyCost, contractValue: s.contractValue, margin: s.margin, lines: s.lines };
  const { hit, flow, branch } = simulate("成本核算单 · 提交", ctx);
  if (!hit || !flow || !branch) return;
  const results: NodeResult[] = branch.nodes.slice(0, Math.max(0, branch.nodes.length - 1)).map((n, i) => ({
    nodeIdx: i, nodeLabel: nodeLabel(n), action: "通过", by: resolveApprover(n), time: s.updated, comment: "历史在途单回填",
  }));
  INSTANCES.unshift({
    id: `AV-${String(INSTANCES.length + 1).padStart(3, "0")}`,
    docType: "成本核算单 · 提交", docId: s.id, summary: `${s.customer} · ${s.contract}`,
    flowId: flow.id, flowName: flow.name, branchId: branch.id, branchName: branch.name,
    snapshot: { nodes: branch.nodes.map((n) => ({ ...n })), rejectPolicy: branch.rejectPolicy, branch: branch.conds.length ? condsText(branch.conds) : "兜底分支" },
    status: "审批中", curNodeIdx: Math.max(0, branch.nodes.length - 1), results,
    submitter: "系统回填", submitAt: s.updated, ctx,
  });
});

// ---------- 配置维护（变更记留痕 + 通知） ----------
const now = demoNow;
export function saveFlow(patch: ApprovalFlow): string | null {
  if (!patch.name.trim()) return "请填写审批流名称";
  if (!patch.branches.length) return "至少配置一个分支";
  if (!patch.branches.some((b) => b.enabled && !b.conds.length)) return "需要一个启用的兜底分支（不设条件的分支）";
  if (patch.branches.some((b) => b.enabled && !b.nodes.length)) return "启用的分支至少需要一个节点";
  if (patch.branches.some((b) => b.enabled && b.nodes.some((n) => !n.approver.trim()))) return "每个节点都要指定审批人";
  const isNew = !FLOW_BY_ID(patch.id);
  const i = FLOWS.findIndex((f) => f.id === patch.id);
  const stamped: ApprovalFlow = { ...patch, updatedAt: now(), updatedBy: "管理员-王芳" };
  if (i >= 0) FLOWS[i] = stamped;
  else FLOWS.push({ ...stamped, id: `AF-${String(FLOWS.length + 1).padStart(2, "0")}`, isDefault: false });
  notify({ level: "blue", group: "系统", title: `审批流${isNew ? "新增" : "变更"}`, text: `「${patch.name}」（${patch.docType}）配置已更新（${patch.enabled ? "启用" : "停用"}），新提交的单据按最新配置流转，在途单按提交时快照走完`, to: "/system/approval" });
  logFlow(`${isNew ? "新建" : "更新"}审批流「${patch.name}」（${patch.docType}，${patch.branches.length} 个分支）`);
  bump();
  return null;
}
export function toggleFlow(id: string) {
  const f = FLOW_BY_ID(id);
  if (f) { f.enabled = !f.enabled; f.updatedAt = now(); f.updatedBy = "管理员-王芳"; logFlow(`${f.enabled ? "启用" : "停用"}审批流「${f.name}」`); bump(); }
}
export function removeFlow(id: string): string | null {
  const f = FLOW_BY_ID(id);
  if (!f) return "审批流不存在";
  if (f.isDefault) return "出厂默认审批流不可删除，可停用";
  FLOWS.splice(FLOWS.indexOf(f), 1);
  logFlow(`删除审批流「${f.name}」（${f.docType}）`);
  bump();
  return null;
}

// ---------- 变更留痕 ----------
export interface FlowLog { at: string; actor: string; action: string }
export const FLOW_LOGS: FlowLog[] = persistable("flowLogs", () => []);
function logFlow(action: string) {
  FLOW_LOGS.unshift({ at: demoNow(), actor: "系统", action });
  if (FLOW_LOGS.length > 80) FLOW_LOGS.length = 80;
}

// ---------- 引擎运行口径 ----------
export const ENGINE_RULES = [
  "单据提交 → 匹配「启用的审批流 × 触发条件」（条件组内 AND）：命中即生成审批实例；未命中 → 直接生效",
  "流内分支按优先级自上而下匹配，取第一条命中的启用分支；都不命中走空条件的兜底分支",
  "提交那一刻对分支做快照：在途单据按提交时配置走完，配置后改只影响新提交",
  "审批人 = 指定人 / 角色（取该角色启用成员）/ 部门负责人（按部门主数据解析，可自定义部门与负责人）",
  "通过 = 流转下一节点，末节点通过 = 单据生效；驳回 = 按分支的驳回策略退回，意见必填并通知发起人",
  "审批动作真实写回业务单据（核算单状态/当前节点），流转记录随实例持久化；配置与审批全程留痕",
];
