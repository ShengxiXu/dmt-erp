// A2 审批流引擎 v2 —— 一套模型、一个引擎、所有单据共用
// 三层模型：
//   ① 审批点（嵌入哪个业务环节 + 结构化触发条件 + 适用范围 + 多命中处理 + 优先级）
//   ② 审批链（分支条件取链 + 有序节点：审批人来源/会签或签/时限 + 驳回策略 + 优先级）
//   ③ 审批实例（引擎产物，持久化：提交那一刻对链做快照，配置后改不影响在途单）
// 引擎口径：单据提交 → 匹配启用审批点（条件组 AND 求值）→ 取链（分支从上到下，空条件=兜底）→ 无命中直接生效。
// 审批动作真实写回业务单据（如核算单 status/curNode），流转记录随实例持久化，刷新不丢。
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { notify } from "@/data/notices";
import { demoNow } from "@/data/settings";
import { SHEETS } from "@/data/sheets";
import { USERS } from "@/data/users";

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

/** 各单据可用于条件的字段（仿真试算与引擎判定共用） */
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

export type ScopeType = "全局" | "按产品类别" | "按客户级别" | "按部门";
/** 适用范围取 ctx 字段：按产品类别→cat / 按客户级别→level / 按部门→dept */
const SCOPE_FIELD: Record<ScopeType, string | undefined> = { 全局: undefined, 按产品类别: "cat", 按客户级别: "level", 按部门: "dept" };
export type MultiHit = "按优先级取第一条" | "全部串行（命中几个走几个）" | "并行会签";

// ---------- 第一层：审批点 ----------
export interface ApprovalPoint {
  id: string;
  name: string;
  docType: DocType;
  enabled: boolean;
  conds: Cond[];                 // 结构化触发条件（AND；空 = 无条件）
  legacyCondition?: string;        // v1 快照遗留（仅展示，不参与求值）
  scope: ScopeType;
  scopeValue?: string;             // scope ≠ 全局时的取值（如 按部门=销售部）
  multiHit: MultiHit;
  priority: number;              // 多命中排序，小的优先（默认 100）
  isDefault: boolean;
  updatedAt: string; updatedBy: string;
}

// ---------- 第二层：审批链 ----------
export type ApproverSource = "指定人" | "角色" | "部门负责人";
export interface ChainNode {
  approverSource: ApproverSource;
  approver: string;             // 人名 / 角色名 / 部门名
  mode: "会签" | "或签";
  timeoutHours: number;
}
export interface ApprovalChain {
  id: string;
  pointId: string;
  name?: string;
  branchConds: Cond[];          // 分支条件（AND；空 = 兜底链）
  legacyBranch?: string;        // v1 快照遗留（仅展示）
  nodes: ChainNode[];
  rejectPolicy: "退回发起人修改后重报" | "逐级退回";
  enabled: boolean;
  priority: number;             // 分支匹配顺序，小的优先；兜底链建议大值
  isDefault: boolean;
  updatedAt: string;
}

export const APPROVAL_POINTS: ApprovalPoint[] = persistable("approvalPoints", () => [
  { id: "AP-01", name: "成本核算审批", docType: "成本核算单 · 提交", enabled: true, conds: [], scope: "全局", multiHit: "按优先级取第一条", priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
  { id: "AP-02", name: "采购审批", docType: "采购单 · 提交", enabled: true, conds: [], scope: "全局", multiHit: "按优先级取第一条", priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
  { id: "AP-03", name: "资源分配审批", docType: "资源分配申请 · 提交", enabled: true, conds: [], scope: "全局", multiHit: "按优先级取第一条", priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
  { id: "AP-04", name: "退款/红冲审批", docType: "收款红冲 · 提交", enabled: true, conds: [], scope: "全局", multiHit: "全部串行（命中几个走几个）", priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
  { id: "AP-05", name: "付款审批", docType: "付款申请单 · 提交", enabled: true, conds: [], scope: "全局", multiHit: "按优先级取第一条", priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
]);

export const APPROVAL_CHAINS: ApprovalChain[] = persistable("approvalChains", () => [
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

// ---------- 旧快照迁移（v1 无条件文本 → v2 结构化；补优先级） ----------
APPROVAL_POINTS.forEach((p: Partial<ApprovalPoint> & { condition?: { kind: string; text: string } }) => {
  if (!p.conds) {
    const legacy = p.condition;
    p.conds = [];
    p.legacyCondition = legacy && legacy.kind !== "无条件" ? `${legacy.kind}：${legacy.text}` : undefined;
    delete p.condition;
  }
  if (p.priority === undefined) p.priority = 100;
});
APPROVAL_CHAINS.forEach((c: Partial<ApprovalChain> & { branch?: string }) => {
  if (!c.branchConds) {
    c.branchConds = [];
    c.legacyBranch = c.branch || undefined;
    delete c.branch;
  }
  if (c.priority === undefined) c.priority = c.branchConds?.length ? 100 : 200;
});

// ---------- 出厂链补建：老快照缺分支链的（如只有兜底链的核算审批点），补上大额分支链 ----------
const SEED_EXTRA: ApprovalChain[] = [
  { id: "AC-02", pointId: "AP-01", name: "大额加审管理层", branchConds: [{ field: "monthlyCost", op: ">=", value: "50000" }], nodes: [
    { approverSource: "角色", approver: "业务支撑部", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "技术部", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "财务", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "逐级退回", enabled: true, priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-04", pointId: "AP-02", name: "大额采购双审", branchConds: [{ field: "amount", op: ">=", value: "100000" }], nodes: [
    { approverSource: "角色", approver: "业务支撑部", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-07", pointId: "AP-05", name: "大额付款双审", branchConds: [{ field: "amount", op: ">=", value: "100000" }], nodes: [
    { approverSource: "角色", approver: "财务", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "逐级退回", enabled: true, priority: 100, isDefault: true, updatedAt: "2026-10-20 14:00" },
];
const hasBranch = (pointId: string, field: string, value: string) =>
  APPROVAL_CHAINS.some((x) => x.pointId === pointId && (x.branchConds ?? []).some((b) => b.field === field && b.value === value));
let acSeq = APPROVAL_CHAINS.reduce((m, c) => { const n = Number(c.id.replace("AC-", "")); return Number.isNaN(n) ? m : Math.max(m, n); }, 0);
SEED_EXTRA.forEach((c) => {
  const marker = c.branchConds[0];
  if (marker && hasBranch(c.pointId, marker.field, marker.value)) return; // 该分支已存在（按条件判定，不按 id，兼容老快照的错位编号）
  if (!marker && APPROVAL_CHAINS.some((x) => x.pointId === c.pointId && !(x.branchConds ?? []).length)) return;
  APPROVAL_CHAINS.push({ ...c, id: `AC-${String(++acSeq).padStart(2, "0")}` });
});

// ---------- 第三层：审批实例（引擎产物，持久化） ----------
export interface NodeResult { nodeIdx: number; nodeLabel: string; action: "通过" | "驳回"; by: string; time: string; comment: string }
export interface ApprovalInstance {
  id: string;                    // AV-xxx
  docType: DocType;
  docId: string;                 // 来源单据号
  summary: string;               // 摘要（客户/内容）
  pointId: string; pointName: string;
  chainId: string; chainName?: string;
  snapshot: { nodes: ChainNode[]; rejectPolicy: ApprovalChain["rejectPolicy"]; branch: string };
  status: "审批中" | "已通过" | "已驳回";
  curNodeIdx: number;              // 当前待审节点下标
  results: NodeResult[];           // 已完成的节点流转记录
  submitter: string; submitAt: string;
  ctx: Record<string, unknown>;   // 提交时的单据字段（条件判定 + 留痕）
}
export const INSTANCES: ApprovalInstance[] = persistable("approvalInstances", () => []);

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
export const getPoints = () => APPROVAL_POINTS;
export const getChains = () => APPROVAL_CHAINS;
export const getInstances = () => INSTANCES;
export const POINT_BY_ID = (id: string) => APPROVAL_POINTS.find((p) => p.id === id);
export const CHAINS_OF = (pointId: string) => APPROVAL_CHAINS.filter((c) => c.pointId === pointId).sort((a, b) => a.priority - b.priority);
export const ENABLED_POINTS = () => APPROVAL_POINTS.filter((p) => p.enabled);
export const INSTANCE_OF_DOC = (docId: string) => INSTANCES.find((i) => i.docId === docId);

// ---------- 审批人解析（展示用；演示环境不强制校验审批人身份） ----------
export function resolveApprover(node: ChainNode): string {
  if (node.approverSource === "指定人") return node.approver;
  if (node.approverSource === "角色") {
    const u = USERS.find((x) => x.role === node.approver && x.status === "启用");
    return u ? `${u.name}（${node.approver}）` : `${node.approver}（未分配启用账号）`;
  }
  const u = USERS.find((x) => x.dept === node.approver && x.status === "启用");
  return u ? `${u.name}（${node.approver}·负责人）` : `${node.approver}·负责人`;
}
export const nodeLabel = (node: ChainNode) => `${resolveApprover(node)} 审批`;

// ---------- 引擎：匹配 ----------
export function matchPoints(docType: DocType, ctx: Record<string, unknown>): ApprovalPoint[] {
  return ENABLED_POINTS()
    .filter((p) => p.docType === docType)
    .filter((p) => {
      const f = SCOPE_FIELD[p.scope];
      return !f || !p.scopeValue || String(ctx[f] ?? "") === p.scopeValue;
    })
    .filter((p) => evalConds(p.conds, ctx))
    .sort((a, b) => a.priority - b.priority);
}

/** 取链：分支条件从上到下（priority 升序）取第一条命中的启用链；空条件链 = 兜底 */
export function resolveChain(pointId: string, ctx: Record<string, unknown>): ApprovalChain | null {
  const chains = CHAINS_OF(pointId).filter((c) => c.enabled);
  return chains.find((c) => evalConds(c.branchConds, ctx)) ?? null;
}

/** 仿真试算：返回将走的完整路径（供配置页预览，不产生数据） */
export function simulate(docType: DocType, ctx: Record<string, unknown>): {
  hit: boolean; reason?: string; point?: ApprovalPoint; chain?: ApprovalChain | null;
} {
  const pts = matchPoints(docType, ctx);
  if (!pts.length) return { hit: false, reason: "未命中任何启用审批点 → 单据直接生效，不生成审批" };
  const point = pts[0];
  const chain = resolveChain(point.id, ctx);
  if (!chain) return { hit: false, reason: "命中审批点「" + point.name + "」但该点没有可用审批链（请配置兜底链）", point };
  return { hit: true, point, chain };
}

// ---------- 引擎：提交 / 审批 ----------
export interface SubmitResult { hit: boolean; instance?: ApprovalInstance; reason?: string }

export function submitForApproval(docType: DocType, docId: string, summary: string, ctx: Record<string, unknown>, submitter: string): SubmitResult {
  const existing = INSTANCE_OF_DOC(docId);
  if (existing && existing.status === "审批中") return { hit: true, instance: existing, reason: "已有在途审批实例" };
  const { hit, reason, point, chain } = simulate(docType, ctx);
  if (!hit || !point || !chain) {
    logFlow(`提交 ${docId}：${reason ?? "未命中审批点，直接生效"}`);
    return { hit: false, reason };
  }
  const instance: ApprovalInstance = {
    id: `AV-${String(INSTANCES.length + 1).padStart(3, "0")}`,
    docType, docId, summary,
    pointId: point.id, pointName: point.name,
    chainId: chain.id, chainName: chain.name,
    snapshot: { nodes: chain.nodes.map((n) => ({ ...n })), rejectPolicy: chain.rejectPolicy, branch: chain.branchConds.length ? condsText(chain.branchConds) : "兜底链" },
    status: "审批中", curNodeIdx: 0, results: [],
    submitter, submitAt: demoNow(), ctx: { ...ctx },
  };
  INSTANCES.unshift(instance);
  syncSheet(instance);
  const cur = chain.nodes[0];
  notify({ level: "orange", group: "审批", title: `待审批：${docId}`, text: `${summary} · 当前节点：${nodeLabel(cur)}（${point.name}）`, to: "/approval", roles: [cur.approverSource === "角色" ? cur.approver : "系统管理员"] });
  logFlow(`提交 ${docId} → 命中「${point.name}」/ 链「${chain.name ?? chain.id}」（${chain.branchConds.length ? "分支" : "兜底"}），进入 ${nodeLabel(cur)}`);
  bump();
  return { hit: true, instance };
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
    notify({ level: "orange", group: "审批", title: `待审批：${inst.docId}`, text: `${inst.summary} · 流转至 ${nodeLabel(next)}`, to: "/approval", roles: [next.approverSource === "角色" ? next.approver : "系统管理员"] });
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
  const { hit, point, chain } = simulate("成本核算单 · 提交", ctx);
  if (!hit || !point || !chain) return;
  const results: NodeResult[] = chain.nodes.slice(0, Math.max(0, chain.nodes.length - 1)).map((n, i) => ({
    nodeIdx: i, nodeLabel: nodeLabel(n), action: "通过", by: resolveApprover(n), time: s.updated, comment: "历史在途单回填",
  }));
  INSTANCES.unshift({
    id: `AV-${String(INSTANCES.length + 1).padStart(3, "0")}`,
    docType: "成本核算单 · 提交", docId: s.id, summary: `${s.customer} · ${s.contract}`,
    pointId: point.id, pointName: point.name, chainId: chain.id, chainName: chain.name,
    snapshot: { nodes: chain.nodes.map((n) => ({ ...n })), rejectPolicy: chain.rejectPolicy, branch: chain.branchConds.length ? condsText(chain.branchConds) : "兜底链" },
    status: "审批中", curNodeIdx: Math.max(0, chain.nodes.length - 1), results,
    submitter: "系统回填", submitAt: s.updated, ctx,
  });
});

// ---------- 配置维护（变更记留痕 + 通知） ----------
const now = demoNow;
export function savePoint(patch: ApprovalPoint) {
  const isNew = !POINT_BY_ID(patch.id);
  const i = APPROVAL_POINTS.findIndex((p) => p.id === patch.id);
  if (i >= 0) APPROVAL_POINTS[i] = { ...patch, updatedAt: now(), updatedBy: "管理员-王芳" };
  else APPROVAL_POINTS.push({ ...patch, id: `AP-${String(APPROVAL_POINTS.length + 1).padStart(2, "0")}`, isDefault: false, updatedAt: now(), updatedBy: "管理员-王芳" });
  notify({ level: "blue", group: "系统", title: `审批嵌入点${isNew ? "新增" : "变更"}`, text: `「${patch.name}」配置已更新（${patch.enabled ? "启用" : "停用"}），影响嵌入该点的所有流程`, to: "/system/approval" });
  logFlow(`${isNew ? "新建" : "更新"}审批点「${patch.name}」（${patch.docType}）`);
  bump();
}
export function togglePoint(id: string) {
  const p = POINT_BY_ID(id);
  if (p) { p.enabled = !p.enabled; p.updatedAt = now(); p.updatedBy = "管理员-王芳"; logFlow(`${p.enabled ? "启用" : "停用"}审批点「${p.name}」`); bump(); }
}
export function saveChain(patch: ApprovalChain) {
  const isNew = !APPROVAL_CHAINS.some((c) => c.id === patch.id);
  const i = APPROVAL_CHAINS.findIndex((c) => c.id === patch.id);
  if (i >= 0) APPROVAL_CHAINS[i] = { ...patch, updatedAt: now() };
  else APPROVAL_CHAINS.push({ ...patch, id: `AC-${String(APPROVAL_CHAINS.length + 1).padStart(2, "0")}`, isDefault: false, updatedAt: now() });
  notify({ level: "blue", group: "系统", title: `审批链${isNew ? "新增" : "变更"}`, text: `「${POINT_BY_ID(patch.pointId)?.name ?? patch.pointId}」${isNew ? "已创建" : "节点/顺序已调整"}（${patch.enabled ? "启用" : "停用"}），新发起的单据按最新配置流转`, to: "/system/approval" });
  logFlow(`${isNew ? "新建" : "更新"}审批链「${patch.name ?? patch.id}」（挂 ${patch.pointId}）`);
  bump();
}
export function toggleChain(id: string) {
  const c = APPROVAL_CHAINS.find((x) => x.id === id);
  if (c) { c.enabled = !c.enabled; c.updatedAt = now(); logFlow(`${c.enabled ? "启用" : "停用"}审批链「${c.name ?? c.id}」`); bump(); }
}
export function removeChain(id: string) {
  const i = APPROVAL_CHAINS.findIndex((c) => c.id === id);
  if (i >= 0 && !APPROVAL_CHAINS[i].isDefault) {
    logFlow(`删除审批链「${APPROVAL_CHAINS[i].name ?? id}」`);
    APPROVAL_CHAINS.splice(i, 1);
    bump();
  }
}

// ---------- 变更留痕 ----------
export interface FlowLog { at: string; actor: string; action: string }
export const FLOW_LOGS: FlowLog[] = persistable("flowLogs", () => []);
function logFlow(action: string) {
  FLOW_LOGS.unshift({ at: demoNow(), actor: "系统", action });
  if (FLOW_LOGS.length > 80) FLOW_LOGS.length = 80;
}

export function condsText(conds: Cond[] | undefined): string {
  if (!conds?.length) return "";
  const labelOf = (f: string) => f;
  return conds.map((c) => `${labelOf(c.field)} ${c.op} ${c.op === "非空" ? "" : c.value}`.trim()).join(" 且 ");
}

// ---------- 引擎运行口径 ----------
export const ENGINE_RULES = [
  "单据提交 → 按「启用的审批点 × 触发条件 × 适用范围」匹配（条件组内 AND），命中即生成审批实例；未命中 → 直接生效",
  "同一单据命中多个审批点时按「多命中处理」执行；取链按优先级从上到下，分支条件命中即用，空条件链兜底",
  "提交那一刻对审批链做快照：在途单据按提交时配置走完，配置后改只影响新提交",
  "审批人 = 指定人 / 角色（取启用成员）/ 部门负责人（按用户档案部门解析）；演示环境不校验审批人身份，正式环境校验",
  "通过 = 流转下一节点，末节点通过 = 单据生效；驳回 = 按链的驳回策略退回，意见必填并通知发起人",
  "审批动作真实写回业务单据（核算单状态/当前节点），流转记录随实例持久化；配置与审批全程留痕",
];
