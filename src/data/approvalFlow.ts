// A2 审批点与审批链配置 —— 审批环节不写死在代码里
// 第一层：审批点（决定审批嵌入哪个业务环节 + 触发条件 + 适用范围 + 多命中处理）
// 第二层：审批链（每个审批点可配多条链，按分支条件取链；链内有序节点：审批人来源 / 会签或签 / 审批时限 / 驳回策略）
// 引擎口径：单据提交 → 按「启用的审批点 × 触发条件 × 适用范围」匹配 → 命中生成 approval 走 P10-2 通用审批单；未命中 → 直接生效。配置变更记版本 + audit_log。
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";

// ---------- 挂接单据候选集（系统内置的全部可提交单据及提交动作） ----------
export const DOC_TYPES = [
  "成本核算单 · 提交", "采购单 · 提交", "采购需求单 · 关闭", "到货验收单 · 提交", "资源分配申请 · 提交",
  "核算变更单 · 提交", "变更申请单 · 提交", "退订申请单 · 提交", "退订审核单 · 提交",
  "收款红冲 · 提交", "坏账申请单 · 提交", "付款申请单 · 提交", "合同/订单建档 · 提交",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export type ScopeType = "全局" | "按产品类别" | "按客户级别" | "按部门";
export type MultiHit = "全部串行（命中几个走几个）" | "按优先级取第一条" | "并行会签";
export interface PointCondition { kind: "无条件" | "金额区间" | "字段条件" | "组织条件"; text: string }

export interface ApprovalPoint {
  id: string;                 // AP-xxx
  name: string;
  docType: DocType;           // 挂接单据与触发动作
  enabled: boolean;
  condition: PointCondition;  // 留空 = 无条件触发
  scope: ScopeType;
  multiHit: MultiHit;
  isDefault: boolean;         // 出厂默认（可停用/修改，不可删除）
  updatedAt: string; updatedBy: string;
}

// ---------- 第二层：审批链 ----------
export type ApproverSource = "指定人" | "角色" | "部门负责人";
export interface ChainNode {
  approverSource: ApproverSource;
  approver: string;           // 人名 / 角色名 / 部门名
  mode: "会签" | "或签";       // 会签 = 全部通过；或签 = 一人通过即可
  timeoutHours: number;       // 审批时限：超期自动催办并升级上级
}
export interface ApprovalChain {
  id: string;                 // AC-xxx
  pointId: string;
  branch: string;             // 分支条件（留空 = 单一链兜底），如「含税金额 ≥ 100,000」
  nodes: ChainNode[];         // 有序
  rejectPolicy: "退回发起人修改后重报" | "逐级退回";
  enabled: boolean;
  isDefault: boolean;
  updatedAt: string;
}

export const APPROVAL_POINTS: ApprovalPoint[] = persistable("approvalPoints", () => [
  { id: "AP-01", name: "成本核算审批", docType: "成本核算单 · 提交", enabled: true, condition: { kind: "无条件", text: "" }, scope: "全局", multiHit: "按优先级取第一条", isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
  { id: "AP-02", name: "采购审批", docType: "采购单 · 提交", enabled: true, condition: { kind: "无条件", text: "" }, scope: "全局", multiHit: "按优先级取第一条", isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
  { id: "AP-03", name: "资源分配审批", docType: "资源分配申请 · 提交", enabled: true, condition: { kind: "无条件", text: "" }, scope: "全局", multiHit: "按优先级取第一条", isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
  { id: "AP-04", name: "退款/红冲审批", docType: "收款红冲 · 提交", enabled: true, condition: { kind: "无条件", text: "" }, scope: "全局", multiHit: "全部串行（命中几个走几个）", isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
  { id: "AP-05", name: "付款审批", docType: "付款申请单 · 提交", enabled: true, condition: { kind: "无条件", text: "" }, scope: "全局", multiHit: "按优先级取第一条", isDefault: true, updatedAt: "2026-10-20 14:00", updatedBy: "系统出厂" },
]);

export const APPROVAL_CHAINS: ApprovalChain[] = persistable("approvalChains", () => [
  { id: "AC-01", pointId: "AP-01", branch: "", nodes: [
    { approverSource: "角色", approver: "财务主管", mode: "会签", timeoutHours: 24 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-02", pointId: "AP-02", branch: "", nodes: [
    { approverSource: "角色", approver: "采购主管", mode: "会签", timeoutHours: 24 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-03", pointId: "AP-02", branch: "含税金额 ≥ 100,000", nodes: [
    { approverSource: "角色", approver: "采购主管", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-04", pointId: "AP-03", branch: "", nodes: [
    { approverSource: "角色", approver: "资源主管", mode: "会签", timeoutHours: 24 },
  ], rejectPolicy: "逐级退回", enabled: true, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-05", pointId: "AP-04", branch: "违约金 / 坏账", nodes: [
    { approverSource: "角色", approver: "财务主管", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "退回发起人修改后重报", enabled: true, isDefault: true, updatedAt: "2026-10-20 14:00" },
  { id: "AC-06", pointId: "AP-05", branch: "付款金额 ≥ 100,000", nodes: [
    { approverSource: "角色", approver: "财务主管", mode: "会签", timeoutHours: 24 },
    { approverSource: "角色", approver: "管理层", mode: "会签", timeoutHours: 48 },
  ], rejectPolicy: "逐级退回", enabled: true, isDefault: true, updatedAt: "2026-10-20 14:00" },
]);

// ---------- 轻量 store（配置变更记版本 + 二次确认在页面层做） ----------
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
export const POINT_BY_ID = (id: string) => APPROVAL_POINTS.find((p) => p.id === id);
export const CHAINS_OF = (pointId: string) => APPROVAL_CHAINS.filter((c) => c.pointId === pointId);
export const ENABLED_POINTS = () => APPROVAL_POINTS.filter((p) => p.enabled);

import { demoNow } from "@/data/settings";

const now = demoNow;
export function savePoint(patch: ApprovalPoint) {
  const i = APPROVAL_POINTS.findIndex((p) => p.id === patch.id);
  if (i >= 0) APPROVAL_POINTS[i] = { ...patch, updatedAt: now(), updatedBy: "管理员-王芳" };
  else APPROVAL_POINTS.push({ ...patch, id: `AP-${String(APPROVAL_POINTS.length + 1).padStart(2, "0")}`, isDefault: false, updatedAt: now(), updatedBy: "管理员-王芳" });
  bump();
}
export function togglePoint(id: string) {
  const p = POINT_BY_ID(id);
  if (p) { p.enabled = !p.enabled; p.updatedAt = now(); p.updatedBy = "管理员-王芳"; bump(); }
}
export function saveChain(patch: ApprovalChain) {
  const i = APPROVAL_CHAINS.findIndex((c) => c.id === patch.id);
  if (i >= 0) APPROVAL_CHAINS[i] = { ...patch, updatedAt: now() };
  else APPROVAL_CHAINS.push({ ...patch, id: `AC-${String(APPROVAL_CHAINS.length + 1).padStart(2, "0")}`, isDefault: false, updatedAt: now() });
  bump();
}
export function toggleChain(id: string) {
  const c = APPROVAL_CHAINS.find((x) => x.id === id);
  if (c) { c.enabled = !c.enabled; c.updatedAt = now(); bump(); }
}
export function removeChain(id: string) {
  const i = APPROVAL_CHAINS.findIndex((c) => c.id === id);
  if (i >= 0 && !APPROVAL_CHAINS[i].isDefault) { APPROVAL_CHAINS.splice(i, 1); bump(); }
}

// ---------- 引擎匹配说明（单据提交时的判定口径，供页面与文档共用） ----------
export const ENGINE_RULES = [
  "单据提交 → 按「启用的审批点 × 触发条件 × 适用范围」匹配，命中即生成 approval 走 P10-2 通用审批单（来源单据锁定编辑）",
  "未命中任何审批点 → 单据直接生效，不生成审批",
  "同一单据命中多个审批点时按审批点的「多命中处理」执行：全部串行 / 按优先级取第一条 / 并行会签",
  "审批链按「分支条件」从上到下取第一条命中的启用链；都不命中则用无分支条件的兜底链",
  "审批人离职/休假按代理人配置自动转交；超期未审自动催办并升级上级；每步操作写 audit_log",
  "配置变更记版本并需二次确认，全程 audit_log 可回溯",
];
