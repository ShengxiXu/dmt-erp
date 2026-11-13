// 特批申请 + 合同管理（蓝图 B3 批次）
// 依据《特批与合同管理模块设计-v1.0》：合同+订单合二为一，合同生效即订单生效
import { useSyncExternalStore } from "react";
import { DEMO_TODAY } from "@/data/settings";
import { persistable } from "@/data/persist";

export const SPECIAL_LEVELS = ["业务支撑部（业务条款）", "财务负责人（折扣与账期）", "管理层（例外与风险）"];

export interface FlowStep {
  level: number; role: string; name: string;
  result?: "通过" | "驳回"; comment?: string; time?: string;
}

export interface Special {
  id: string; customer: string; dealId: string; // dealId：特批必须挂在具体成交机会上（客户可能有多单生意）
  discount: number; terms: string; reason: string;
  applicant: string; createdAt: string;
  status: "审批中" | "已通过" | "已驳回";
  current: number; // 当前待审层级（1 起）
  flows: FlowStep[];
}

const L = (level: number, name: string, result?: "通过" | "驳回", comment?: string, time?: string): FlowStep =>
  ({ level, role: SPECIAL_LEVELS[level - 1], name, result, comment, time });

export const SPECIALS: Special[] = persistable("specials", () => [
  {
    id: "SA-2026-011", customer: "云启数据科技", dealId: "CJ-2026-001", discount: 12,
    terms: "AI 专线 99.99% SLA + 突发带宽弹性扩容条款", reason: "客户为算力头部客户，竞品压价，需 12% 折扣锁定三年合作",
    applicant: "张弛（销售）", createdAt: "2026-10-18", status: "已通过", current: 4,
    flows: [
      L(1, "周敏（业务支撑部）", "通过", "条款可承接，SLA 与资源池匹配", "2026-10-19 10:20"),
      L(2, "陈立（财务负责人）", "通过", "折扣后毛利达标，同意", "2026-10-19 16:42"),
      L(3, "赵启明（管理层）", "通过", "战略客户，批准", "2026-10-20 09:05"),
    ],
  },
  {
    id: "SA-2026-012", customer: "澜石金融", dealId: "CJ-2026-006", discount: 8,
    terms: "账期 90 天 + 提前解约违约金减免条款", reason: "客户财务流程要求长账期，否则流失至竞争对手",
    applicant: "张弛（销售）", createdAt: "2026-10-24", status: "审批中", current: 2,
    flows: [
      L(1, "周敏（业务支撑部）", "通过", "条款无异常，转财务", "2026-10-24 14:10"),
      L(2, "陈立（财务负责人）"),
      L(3, "赵启明（管理层）"),
    ],
  },
  {
    id: "SA-2026-013", customer: "凯瑞传媒", dealId: "CJ-2026-004", discount: 15,
    terms: "半年付改为月付", reason: "客户现金流紧张要求月付",
    applicant: "李骁（销售）", createdAt: "2026-10-20", status: "已驳回", current: 1,
    flows: [L(1, "周敏（业务支撑部）", "驳回", "15% 折扣超一级权限，且账期变更需财务先审，请补充说明后重新发起", "2026-10-21 09:30")],
  },
  {
    id: "SA-2026-014", customer: "智算中心（临港算力）", dealId: "CJ-2026-005", discount: 5,
    terms: "带宽按季度阶梯扩容条款", reason: "客户算力业务增长快，要求按季扩容不加价",
    applicant: "张弛（销售）", createdAt: "2026-10-25", status: "审批中", current: 1,
    flows: [L(1, "周敏（业务支撑部）"), L(2, "陈立（财务负责人）"), L(3, "赵启明（管理层）")],
  },
]);

// ---------- 特批共享 store：发起 / 审批直接改 SPECIALS（原地修改保证快照引用稳定），跨页面（合同起草引用已通过特批）实时可见 ----------
let spVersion = 0;
const spListeners = new Set<() => void>();
const spBump = () => { spVersion += 1; spListeners.forEach((fn) => fn()); };

/** 组件订阅特批变更（返回版本号触发重渲染，数据用 SPECIALS 读） */
export function useSpecials(): number {
  return useSyncExternalStore(
    (fn) => { spListeners.add(fn); return () => { spListeners.delete(fn); }; },
    () => spVersion
  );
}

/** 发起特批申请（三级审批流，默认模板，从一级开始） */
export function addSpecial(patch: Omit<Special, "id" | "applicant" | "createdAt" | "status" | "current" | "flows">): string {
  const id = `SA-2026-0${String(SPECIALS.length + 11).padStart(2, "0")}`;
  SPECIALS.unshift({
    ...patch, id,
    applicant: "张弛（销售）", createdAt: DEMO_TODAY, status: "审批中", current: 1,
    flows: [
      { level: 1, role: SPECIAL_LEVELS[0], name: "周敏（业务支撑部）" },
      { level: 2, role: SPECIAL_LEVELS[1], name: "陈立（财务负责人）" },
      { level: 3, role: SPECIAL_LEVELS[2], name: "赵启明（管理层）" },
    ],
  });
  spBump();
  return id;
}

/** 审批决定：通过自动流转下一级，三级全过 → 已通过（合同可引用）；驳回 → 已驳回 */
export function decideSpecial(id: string, level: number, result: "通过" | "驳回", comment: string) {
  const s = SPECIALS.find((x) => x.id === id);
  if (!s || s.status !== "审批中" || s.current !== level) return;
  s.flows = s.flows.map((f) => (f.level === level ? { ...f, result, comment, time: DEMO_TODAY } : f));
  if (result === "驳回") { s.status = "已驳回"; }
  else if (level >= 3) { s.status = "已通过"; s.current = 4; }
  else { s.current = level + 1; }
  spBump();
}

// ---------- 合同（含订单行，合二为一） ----------
export type SealChannel = "online" | "offline";
// 待出合同 = 合同申请审批已通过，业务支撑部待出具正式合同并上传；上传登记后进入「待用章」
// 审批中 = 销售已提交合同申请，在审批流中；已驳回 = 审批被驳回，可修改后重新发起
export type ContractStatus = "审批中" | "已驳回" | "待出合同" | "待用章" | "签署中" | "已生效" | "待修订" | "已终止";

export const ONLINE_STEPS = ["推送契约锁", "我方签署", "客户签署", "回传归档"];
export const OFFLINE_STEPS = ["用章申请", "盖印上传", "客户回签", "扫描质检"];

export interface OrderLine {
  cat: string;      // 产品类别
  ptype: string;    // 产品类型
  plan?: string;    // 所选套餐 id（可空 = 自由组合规格）
  spec: string;     // 规格摘要（由产品基础数据结构化选项自动拼接，不允许自由输入）
  specs?: Record<string, string>; // 结构化规格值（按产品基础数据字段）
  price: number;    // 月租（元/月）
}

export interface ContractVersion { v: number; note: string; at: string }

export interface Contract {
  id: string; customer: string;
  entityId?: string;        // 签约主体（分子公司；决定合同抬头、用印、销方税号、收款账户）
  dealId?: string;          // 关联商机（客户 → 商机 → 特批 → 合同；合同生效后商机自动「赢单」关闭）
  renewOf?: string;         // 续签来源合同号（发起续签带入；新合同生效时源合同自动「已终止」并停其订阅出账，防双算）
  specialId?: string; discount: number; terms?: string;
  seal: SealChannel; pay: "月付" | "季度付" | "半年付" | "年付";
  start: string; end: string; amount: number;
  status: ContractStatus; step: number; // 0-3 签署步骤，4=完成
  lines: OrderLine[];
  approvals?: FlowStep[];   // 合同申请审批链（审批中/已驳回/待出合同留痕）
  approvalStep?: number;    // 当前待审节点序号（1 起）
  versions: ContractVersion[];
  terminateReason?: string;
}

export const CONTRACTS: Contract[] = persistable("contracts", () => [
  {
    id: "HT-2026-021", entityId: "ENT-HQ", customer: "云启数据科技", specialId: "SA-2026-011", discount: 12,
    terms: "AI 专线 99.99% SLA + 突发带宽弹性扩容条款",
    seal: "online", pay: "月付", start: "2026-11-01", end: "2027-10-31", amount: 84480,
    status: "签署中", step: 1,
    lines: [
      { cat: "ISP 互联网接入", ptype: "AI 专线", spec: "100M · 绑定 IP 100 个（58.40 段）", price: 96000 },
    ],
    versions: [{ v: 1, note: "初始版本（关联 SA-2026-011，折扣 12%）", at: "2026-10-22" }],
  },
  {
    id: "HT-2026-018", entityId: "ENT-HQ", customer: "恒信证券", discount: 0,
    seal: "online", pay: "季度付", start: "2026-10-01", end: "2027-09-30", amount: 42500,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "BGP 三网互通", spec: "80M · 绑定 IP 64 个", price: 42500 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-09-20" }],
  },
  {
    id: "HT-2026-023", entityId: "ENT-HQ", customer: "中海贸易", discount: 0,
    seal: "offline", pay: "月付", start: "2026-11-15", end: "2027-11-14", amount: 38000,
    status: "签署中", step: 1,
    lines: [
      { cat: "ISP 互联网接入", ptype: "BGP 三网互通", spec: "200M · 绑定 IP 100 个（58.42 段）", price: 38000 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-10-24" }],
  },
  {
    id: "HT-2026-024", entityId: "ENT-HQ", customer: "跃游网络", discount: 0,
    seal: "online", pay: "年付", start: "2026-12-01", end: "2027-11-30", amount: 21000,
    status: "待出合同", step: 0,
    lines: [
      { cat: "ISP 互联网接入", ptype: "国内精品网", spec: "50M · 绑定 IP 40 个", price: 21000 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-10-26" }],
  },
  {
    id: "HT-2026-020", entityId: "ENT-HQ", customer: "凯瑞传媒", specialId: "SA-2026-013", discount: 15,
    terms: "半年付改为月付",
    seal: "online", pay: "月付", start: "2026-11-01", end: "2027-10-31", amount: 25500,
    status: "待修订", step: 0,
    lines: [
      { cat: "ISP 互联网接入", ptype: "BGP 三网互通", spec: "200M · 绑定 IP 80 个（58.43 段）", price: 30000 },
    ],
    versions: [
      { v: 1, note: "初始版本（关联 SA-2026-013）", at: "2026-10-21" },
      { v: 2, note: "条款修改：客户要求月付，原特批已驳回，需重新发起特批", at: "2026-10-25" },
    ],
  },
  {
    id: "HT-2026-015", entityId: "ENT-HQ", customer: "正大物流", discount: 0,
    seal: "offline", pay: "月付", start: "2026-10-01", end: "2027-09-30", amount: 67200,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "BGP 三网互通", spec: "100M · 绑定 IP 100 个（58.44 段）", price: 5600 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-10-08" }],
  },
  {
    id: "HT-2026-0202", entityId: "ENT-NET", customer: "某跨境电商", discount: 0,
    seal: "online", pay: "月付", start: "2025-09-01", end: "2027-08-31", amount: 230400,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "国际精品网", spec: "120M · 绑定 IP 60 个", price: 9600 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2025-08-20" }],
  },
  {
    id: "HT-2026-0309", entityId: "ENT-BJ", customer: "博彦软件", discount: 0,
    seal: "online", pay: "月付", start: "2026-06-20", end: "2027-06-19", amount: 118800,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "国内精品网", spec: "CN2 GIA 100M · 绑定 IP 40 个", price: 9900 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-06-10" }],
  },
  {
    id: "HT-2026-0341", entityId: "ENT-HQ", customer: "上海某科技公司", discount: 0,
    seal: "offline", pay: "月付", start: "2026-10-01", end: "2028-09-30", amount: 840000,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "AI 专线", spec: "200M ×2 · 绑定 IP 100 个", price: 35000 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-09-22" }],
  },
  {
    id: "HT-2026-0338", entityId: "ENT-HQ", customer: "恒信证券", discount: 0,
    seal: "online", pay: "月付", start: "2026-09-01", end: "2027-08-31", amount: 696000,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "国内精品网", spec: "双线路 100M ×2", price: 58000 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-08-18" }],
  },
  {
    id: "HT-2026-0335", entityId: "ENT-HQ", customer: "澜石金融", discount: 0,
    seal: "online", pay: "月付", start: "2026-11-01", end: "2029-10-31", amount: 5472000,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "BGP 三网互通", spec: "多线路组合 800M", price: 152000 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-10-15" }],
  },
  {
    id: "HT-2026-0329", entityId: "ENT-HQ", customer: "跃游网络", discount: 0,
    seal: "online", pay: "月付", start: "2026-08-01", end: "2027-07-31", amount: 96000,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "国内精品网", spec: "80M · 绑定 IP 30 个", price: 8000 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-07-20" }],
  },
  {
    id: "HT-2026-0326", entityId: "ENT-HQ", customer: "正大物流", discount: 0,
    seal: "offline", pay: "月付", start: "2026-09-01", end: "2028-08-31", amount: 156000,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "国内精品网", spec: "单线 50M", price: 6500 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2026-08-15" }],
  },
  {
    id: "HT-2026-0302", entityId: "ENT-HQ", customer: "展鹏教育", discount: 0,
    seal: "online", pay: "月付", start: "2025-12-01", end: "2026-11-30", amount: 81600,
    status: "已生效", step: 4,
    lines: [
      { cat: "ISP 互联网接入", ptype: "国内精品网", spec: "50M · 绑定 IP 40 个", price: 6800 },
    ],
    versions: [{ v: 1, note: "初始版本（标准合同）", at: "2025-11-18" }],
  },
]);

// 折扣校验规则（上传合同附件时执行）：非标折扣必须关联已通过的特批单且折扣率一致
export const checkDiscount = (discount: number, specialId?: string): string | null => {
  if (discount > 0 && !specialId) return "折扣率 > 0 属于非标内容，必须先关联已通过的特批单";
  if (specialId) {
    const sp = SPECIALS.find((s) => s.id === specialId);
    if (!sp) return "关联的特批单不存在";
    if (sp.status !== "已通过") return `特批单 ${specialId} 未通过审批（当前状态：${sp.status}），不能作为合同依据`;
    if (sp.discount !== discount) return `折扣率与特批单不一致：合同 ${discount}% vs 特批单 ${sp.discount}%`;
  }
  return null;
};

// ---------- 合同申请审批链（预置默认模板；审批流节点未来由业务管理员在审批中心自行配置） ----------
// 节点 2「财务复核」仅非标合同（折扣 > 0）触发，标准合同自动跳过
export function initContractApproval(discount: number): FlowStep[] {
  const nodes: FlowStep[] = [
    { level: 1, role: "业务支撑部负责人", name: "许晟熙（业务支撑部负责人）" },
  ];
  if (discount > 0) nodes.push({ level: 2, role: "财务负责人", name: "陈立（财务负责人）" });
  return nodes;
}

export const fmtMoney = (n: number) => n.toLocaleString("zh-CN");

/** 距合同到期的剩余天数（演示基准日口径；负数 = 已到期未终止） */
export const daysToEnd = (c: Contract) => Math.round((new Date(c.end).getTime() - new Date(DEMO_TODAY).getTime()) / 86400000);
/** 到期预警清单：已生效且 days 天内到期（含已到期未终止），按剩余天数升序 */
export const expiringContracts = (days = 90) =>
  CONTRACTS.filter((c) => c.status === "已生效" && daysToEnd(c) <= days).sort((a, b) => daysToEnd(a) - daysToEnd(b));
/** 客户维度：全部生效合同中最近的一份到期（用于客户档案的到期提醒列） */
export const nearestActiveEnd = (customer: string): { end: string; days: number } | null => {
  const actives = CONTRACTS.filter((c) => c.customer === customer && c.status === "已生效");
  if (!actives.length) return null;
  const nearest = actives.reduce((a, b) => (daysToEnd(a) <= daysToEnd(b) ? a : b));
  return { end: nearest.end, days: daysToEnd(nearest) };
};
