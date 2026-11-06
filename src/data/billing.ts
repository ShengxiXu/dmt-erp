// P03 计费与账单生成（客户侧）—— 应收账单的唯一出生点
// 链路：合同建档 → 开通确认 → 订阅激活（P02-8）→ 账期扫描（P03-1，按各订阅开通日滚动）→ 费用计算（P03-2：周期费 + 一次性费用 + 滞纳金回灌）
//   → 账单生成（P03-3）→ 账单审核（P03-4 财务）→ 账单发出（P03-5）→ 应收登记（P03-6）→ 开票申请（P04-0）→ 收款（P04）。
// 账期锚定开通日：开通日 16 号 → 账期为 16 日 ~ 次月 15 日，与自然月无关；月中开通首月按整月收、不折算。
// 应收日期 = 账期截止日 + 付款期（后付）或 账期开始日 − 付款期（预付），付款时点/付款期在 A5 配置。
// 欠停期间周期费照常计（A5 可配）；滞纳金由 P04-6 按账期回灌下期账单（fee_type=滞纳金）。
import { useSyncExternalStore } from "react";
import { registerReceivable } from "@/data/receivables";
import { createInvoiceApp } from "@/data/invoiceApps";
import { cfgNum, getCfg } from "@/data/settings";

// ---------- 订阅台账（P02-8 激活；从合同生成，客户账单的取数基础） ----------
export type SubStatus = "在网" | "欠停" | "退订";
export interface Subscription {
  subNo: string; customer: string; contractNo: string;
  line: string;            // 开通对象（产品 / 带宽）
  monthlyFee: number;      // 周期费（月租，含 IP 等附加）
  activatedAt: string;     // 订阅激活日（账期锚点：以开通日滚动账期）
  status: SubStatus;
}
// ---------- 客户账单（P03-3 生成） ----------
export type BillStatus = "已生成" | "审核中" | "已发出" | "已驳回";
export interface BillItem { name: string; amount: number; feeType: "周期费" | "一次性费用" | "滞纳金" | "其他" }
export interface CustInvoice {
  invNo: string; customer: string; contractNo: string;
  period: string;          // 账期展示，如 2026-11-05 ~ 2026-12-04
  periodStart: string;     // 账期开始日（按订阅开通日锚定）
  periodEnd: string;       // 账期截止日
  dueDate: string;         // 应收日期（生成时按 A5 付款时点/付款期计算）
  subNo?: string;          // 关联订阅（账期去重与账单计划视图）
  items: BillItem[];
  amount: number;
  status: BillStatus;
  generatedAt: string; reviewedAt?: string; reviewer?: string; rejectReason?: string;
}

// ---------- 账期工具（按开通日锚定；月末日期钳制到当月最后一天） ----------
const parseD = (s: string) => new Date(`${s}T00:00:00`);
export const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonthsClamped = (d: Date, n: number) => {
  const day = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
};
/** 第 idx 个账期（idx 从 0 起；首账期自激活日起，整月收费不折算） */
export const periodOf = (sub: Subscription, idx: number) => {
  const start = addMonthsClamped(parseD(sub.activatedAt), idx);
  const end = addDays(addMonthsClamped(parseD(sub.activatedAt), idx + 1), -1);
  return { start, end };
};
export const periodText = (sub: Subscription, idx: number) => {
  const { start, end } = periodOf(sub, idx);
  return `${fmtD(start)} ~ ${fmtD(end)}`;
};
/** 应收日期：后付 = 账期截止 + 付款期；预付 = 账期开始 − 付款期（A5：billing.payTiming / billing.dueDays） */
export const dueDateOf = (start: Date, end: Date) => {
  const n = cfgNum("billing.dueDays");
  return getCfg("billing.payTiming") === "prepaid" ? fmtD(addDays(start, -n)) : fmtD(addDays(end, n));
};

// ---------- 预置数据（订阅与已发应收的历史账单口径一致） ----------
export const SUBSCRIPTIONS: Subscription[] = [
  { subNo: "SUB-2026-0305", customer: "中海贸易", contractNo: "HT-2026-023", line: "单线 200M", monthlyFee: 12800, activatedAt: "2025-11-01", status: "在网" },
  { subNo: "SUB-2026-0312", customer: "跃游网络", contractNo: "HT-2026-024", line: "D-MAN 城域通道", monthlyFee: 6800, activatedAt: "2025-10-20", status: "欠停" },
  { subNo: "SUB-2026-0280", customer: "凯瑞传媒", contractNo: "HT-2026-020", line: "国内精品网 100M", monthlyFee: 8500, activatedAt: "2026-02-15", status: "在网" },
  { subNo: "SUB-2026-0266", customer: "云启数据科技", contractNo: "HT-2026-021", line: "AI 专线 100M×2 + IP 12 个", monthlyFee: 26400, activatedAt: "2026-03-01", status: "在网" },
  { subNo: "SUB-2026-0201", customer: "恒信证券", contractNo: "HT-2026-018", line: "国内精品网 80M", monthlyFee: 15200, activatedAt: "2026-01-10", status: "在网" },
  { subNo: "SUB-2026-0188", customer: "某跨境电商", contractNo: "HT-2026-0202", line: "国际精品网 120M", monthlyFee: 9600, activatedAt: "2025-09-01", status: "欠停" },
  { subNo: "SUB-2026-0330", customer: "博彦软件", contractNo: "HT-2026-0309", line: "CN2 GIA 100M", monthlyFee: 9900, activatedAt: "2026-06-20", status: "在网" },
  { subNo: "SUB-2026-0355", customer: "正大物流", contractNo: "HT-2026-015", line: "单线 100M", monthlyFee: 5600, activatedAt: "2026-10-08", status: "在网" },
  { subNo: "SUB-2026-0117", customer: "展鹏教育", contractNo: "HT-2026-0302", line: "国内精品网 50M", monthlyFee: 6800, activatedAt: "2025-12-01", status: "退订" },
];
export const CUST_INVOICES: CustInvoice[] = [
  { invNo: "INV-2026-1001", customer: "博彦软件", contractNo: "HT-2026-0309", subNo: "SUB-2026-0330",
    period: "2026-09-20 ~ 2026-10-19", periodStart: "2026-09-20", periodEnd: "2026-10-19", dueDate: "2026-10-26",
    items: [{ name: "CN2 GIA 100M · 2026-09-20 ~ 2026-10-19 周期费", amount: 9900, feeType: "周期费" }], amount: 9900, status: "已生成", generatedAt: "2026-10-20 02:00" },
  { invNo: "INV-2026-0994", customer: "正大物流", contractNo: "HT-2026-015", subNo: "SUB-2026-0355",
    period: "2026-10-08 ~ 2026-11-07", periodStart: "2026-10-08", periodEnd: "2026-11-07", dueDate: "2026-11-14",
    items: [{ name: "单线 100M · 2026-10-08 ~ 2026-11-07 周期费", amount: 5600, feeType: "周期费" }], amount: 5600, status: "审核中", generatedAt: "2026-11-07 02:00" },
];

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function useBilling(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getSubscriptions = () => SUBSCRIPTIONS;
export const getBills = () => CUST_INVOICES;
export const BILL_BY_NO = (no: string) => CUST_INVOICES.find((b) => b.invNo === no);
/** P05 变更生效：更新订阅行（line 描述 / 月租），由 lifecycle.ts 调用 */
export function updateSubscription(subNo: string, patch: Partial<Pick<Subscription, "line" | "monthlyFee" | "status">>) {
  const s = SUBSCRIPTIONS.find((x) => x.subNo === subNo);
  if (s) { Object.assign(s, patch); bump(); }
}

let invSeq = 1002;
const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

/** P06 退订违约金等非订阅类一次性费用：以手工账单进入正常 审核 → 发出 → 应收 流程（账单唯一出生点不变） */
export function addManualBill(data: { customer: string; contractNo: string; period: string; items: BillItem[] }): string {
  const invNo = `INV-2026-${invSeq++}`;
  const ps = `${data.period}-01`, pe = fmtD(addDays(addMonthsClamped(parseD(ps), 1), -1));
  CUST_INVOICES.unshift({ invNo, customer: data.customer, contractNo: data.contractNo, period: data.period, periodStart: ps, periodEnd: pe, dueDate: dueDateOf(parseD(ps), parseD(pe)), items: data.items, amount: data.items.reduce((s, i) => s + i.amount, 0), status: "已生成", generatedAt: now() });
  bump();
  return invNo;
}

// P03-1/2/3：账期扫描 + 费用计算 + 账单生成。
// 按各订阅开通日滚动：后付=账期截止后出账；预付=账期开始前（应收日已到）出账；每次扫描每个订阅至多补 1 个到期账期；月中开通整月收。
export function runBillingScan(today = "2026-11-05"): { created: number; skipped: number } {
  let created = 0, skipped = 0;
  const t = parseD(today), dueDays = cfgNum("billing.dueDays"), prepaid = getCfg("billing.payTiming") === "prepaid";
  SUBSCRIPTIONS.forEach((sub) => {
    if (sub.status === "退订") { skipped++; return; }
    if (sub.status === "欠停" && getCfg("billing.billOnSuspend") === "no") { skipped++; return; }
    // 定位「当前应出」的账期（按开通日滚动，最后一个已到出账时点的账期）
    let dueIdx = -1;
    for (let idx = 0; idx < 240; idx++) {
      const { start, end } = periodOf(sub, idx);
      const due = prepaid ? addDays(start, -dueDays) : addDays(end, 1);
      if (due > t) break;
      dueIdx = idx;
    }
    if (dueIdx < 0) { skipped++; return; }
    const { start, end } = periodOf(sub, dueIdx);
    const billed = CUST_INVOICES.some((b) => b.subNo === sub.subNo && b.periodStart === fmtD(start) && b.status !== "已驳回");
    if (billed) { skipped++; return; }
    CUST_INVOICES.unshift({
      invNo: `INV-2026-${invSeq++}`, customer: sub.customer, contractNo: sub.contractNo, subNo: sub.subNo,
      period: periodText(sub, dueIdx), periodStart: fmtD(start), periodEnd: fmtD(end), dueDate: dueDateOf(start, end),
      items: [{ name: `${sub.line} · ${periodText(sub, dueIdx)} 周期费`, amount: sub.monthlyFee, feeType: "周期费" }],
      amount: sub.monthlyFee, status: "已生成", generatedAt: now(),
    });
    created++;
  });
  bump();
  return { created, skipped };
}
// P03-4：提交审核
export function submitBill(invNo: string) {
  const b = BILL_BY_NO(invNo);
  if (b && b.status === "已生成") { b.status = "审核中"; bump(); }
}
// P03-4/5/6：审核通过 → 发出 → 应收登记（写入 receivables）→ 自动生成开票申请（P04-0）
export function approveBill(invNo: string, reviewer = "财务-李娜"): string | null {
  const b = BILL_BY_NO(invNo);
  if (!b || b.status !== "审核中") return "账单不存在或不在审核中";
  b.status = "已发出"; b.reviewer = reviewer; b.reviewedAt = now();
  registerReceivable({
    invNo: b.invNo, customer: b.customer, contract: b.contractNo, amount: b.amount,
    dueDate: b.dueDate, items: b.items.map((i) => ({ name: i.name, amount: i.amount })),
  });
  createInvoiceApp({
    invNo: b.invNo, customer: b.customer, contractNo: b.contractNo,
    amount: b.amount, periodText: b.period, items: b.items.map((i) => i.name),
  });
  bump();
  return null;
}
export function rejectBill(invNo: string, reason: string): string | null {
  const b = BILL_BY_NO(invNo);
  if (!b || b.status !== "审核中") return "账单不存在或不在审核中";
  if (!reason.trim()) return "驳回必须填写原因";
  b.status = "已驳回"; b.rejectReason = reason; b.reviewedAt = now(); b.reviewer = "财务-李娜";
  bump();
  return null;
}

// 口径说明（页面底部展示；实时读取 A5 配置，改配置此处同步）
export function getBillingRules(): string[] {
  return [
    "账单明细来源：周期费 = 订阅行月租（合同行单价 × 数量）；账期按各订阅开通日滚动（开通日 16 号 → 账期 16 日 ~ 次月 15 日），与自然月无关，月中开通首月整月收、不折算",
    `付款时点：${getCfg("billing.payTiming") === "prepaid" ? "预付费（账期开始前出账收款）" : "后付费（账期结束后出账收款）"}；应收日期 = ${getCfg("billing.payTiming") === "prepaid" ? "账期开始日 −" : "账期截止日 +"} ${getCfg("billing.dueDays")} 天付款期（A5 可配）`,
    `欠停订阅周期费${getCfg("billing.billOnSuspend") === "no" ? "暂停计" : "照常计"}（A5 可配）；退订订阅自退订生效账期停止出账（P06）`,
    "应收登记（P03-6）是收款管理应收账单的唯一流入入口：审核通过 → 发出即登记，并自动生成开票申请（P04-0 开票管理）；P04 只改收款状态、不维护账单主数据",
  ];
}
