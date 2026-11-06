// P04 收款与欠费管理 —— 客户应收侧
// 收款登记（P04-1）→ 核销（P04-2，提交自动比对）→ 欠费扫描/策略（P04-3/4，策略在 A5 配置）→
// 提醒（P04-5）→ 滞纳金（P04-6，入下期账单）→ 停机执行（P04-7）→ 复机执行（P04-8，仅收讫触发）→ 坏账处理（P04-9，走 P10 审批）
// 闭环规则：复机仅由「足额核销」自动触发，不接受人工手工复机（防绕过欠费管控）；登记错误走红冲审批（AP-04），原单留痕不可删。
import { useSyncExternalStore } from "react";
import { cfgNum, getCfg } from "@/data/settings";

// ---------- 客户账单（应收） ----------
export type InvStatus = "已发出" | "部分收款" | "已收讫" | "逾期" | "欠停" | "坏账";
export interface Receivable {
  invNo: string; customer: string; contract: string;
  amount: number;          // 账单金额
  received: number;        // 累计已收（Σ payment 未冲正）
  dueDate: string;         // 应收日期
  status: InvStatus;
  items: { name: string; amount: number }[]; // 账单明细
}
// ---------- 收款登记（P04-1） ----------
export type PayStatus = "已登记" | "已红冲";
export interface Payment {
  payNo: string; invNo: string; customer: string;
  amount: number; paidAt: string;
  method: "银行转账" | "支付宝" | "微信" | "现金";
  referenceNo?: string; payerAccount?: string;
  status: PayStatus; remark?: string;
}
// ---------- 停机 / 复机工单（P04-7/8） ----------
export type TicketType = "停机" | "复机";
export interface SuspendTicket {
  ticketNo: string; type: TicketType;
  customer: string; sub: string; invNo: string;
  debtSummary: string;          // 欠费摘要（逾期金额、天数）
  reason: string;               // 停机原因（系统带出：欠费停机（策略触发）/ 收讫复机）
  action?: string; executedAt?: string; result?: string; note?: string;
  status: "待执行" | "已完工";
  linkedTicket?: string;        // 复机工单 → 原停机工单
}
// ---------- 坏账申请（P04-9） ----------
export interface BadDebtApp {
  bdNo: string; customer: string; invNos: string[]; total: number;
  collectRecord: string; reason: "客户失联" | "破产" | "拒付" | "其他";
  reasonText?: string; handling: "核销坏账" | "继续挂账观察";
  status: "草稿" | "审批中" | "已通过" | "已驳回";
  createdAt: string;
}

// ---------- 预置数据 ----------
export const RECEIVABLES: Receivable[] = [
  { invNo: "INV-2026-0881", customer: "中海贸易", contract: "HT-2026-023", amount: 12800, received: 12800, dueDate: "2026-10-15", status: "已收讫",
    items: [{ name: "单线 200M · 10 月周期费", amount: 12800 }] },
  { invNo: "INV-2026-0912", customer: "凯瑞传媒", contract: "HT-2026-020", amount: 8500, received: 5000, dueDate: "2026-10-20", status: "部分收款",
    items: [{ name: "精品网通道 100M · 10 月周期费", amount: 8500 }] },
  { invNo: "INV-2026-0945", customer: "云启数据科技", contract: "HT-2026-021", amount: 26400, received: 0, dueDate: "2026-11-05", status: "已发出",
    items: [{ name: "AI 专线 100M ×2 · 10 月周期费", amount: 24000 }, { name: "IP 地址 12 个", amount: 2400 }] },
  { invNo: "INV-2026-0901", customer: "恒信证券", contract: "HT-2026-018", amount: 15200, received: 0, dueDate: "2026-10-06", status: "逾期",
    items: [{ name: "精品网 80M · 9-10 月周期费", amount: 15200 }] },
  { invNo: "INV-2026-0866", customer: "跃游网络", contract: "HT-2026-024", amount: 6800, received: 0, dueDate: "2026-09-20", status: "逾期",
    items: [{ name: "D-MAN 通道 · 9 月周期费", amount: 6800 }] },
  { invNo: "INV-2026-0777", customer: "某跨境电商", contract: "HT-2026-0202", amount: 9600, received: 0, dueDate: "2026-09-10", status: "欠停",
    items: [{ name: "国际精品网 120M · 8-9 月周期费", amount: 9600 }] },
];
export const PAYMENTS: Payment[] = [
  { payNo: "PAY-2026-0201", invNo: "INV-2026-0881", customer: "中海贸易", amount: 12800, paidAt: "2026-10-14 10:22", method: "银行转账", referenceNo: "BK202610140088", payerAccount: "中海贸易有限公司", status: "已登记" },
  { payNo: "PAY-2026-0212", invNo: "INV-2026-0912", customer: "凯瑞传媒", amount: 5000, paidAt: "2026-10-22 15:40", method: "银行转账", referenceNo: "BK202610220129", payerAccount: "凯瑞传媒股份有限公司", status: "已登记" },
];
export const TICKETS: SuspendTicket[] = [
  { ticketNo: "ST-2026-101", type: "停机", customer: "跃游网络", sub: "SUB-2026-0312（D-MAN 通道）", invNo: "INV-2026-0866", debtSummary: "逾期 6,800 元 · 逾期 44 天", reason: "欠费停机（策略触发：逾期 > 30 天）", status: "待执行" },
  { ticketNo: "ST-2026-097", type: "停机", customer: "某跨境电商", sub: "SUB-2026-0188（国际精品网 120M）", invNo: "INV-2026-0777", debtSummary: "逾期 9,600 元 · 逾期 54 天", reason: "欠费停机（策略触发：逾期 > 30 天）", action: "断网", executedAt: "2026-10-24 11:05", result: "成功", status: "已完工" },
];
export const BADDEBT_APPS: BadDebtApp[] = [
  { bdNo: "BD-2026-003", customer: "某跨境电商", invNos: ["INV-2026-0777"], total: 9600, collectRecord: "9/12、9/26、10/10 三次电话催收无果，10/15 发催收函无回应；客户官网已无法访问。", reason: "客户失联", handling: "核销坏账", status: "草稿", createdAt: "2026-10-28 09:30" },
];

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function useReceivables(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getInvoices = () => RECEIVABLES;
export const getPayments = () => PAYMENTS;
export const getTickets = () => TICKETS;
export const getBadDebtApps = () => BADDEBT_APPS;
export const INV_BY_NO = (no: string) => RECEIVABLES.find((r) => r.invNo === no);
export const invBalance = (inv: Receivable) => inv.amount - inv.received;
/** 逾期天数（应收日 → 今日，未收讫才算） */
export const overdueDays = (inv: Receivable, today = "2026-11-03") =>
  inv.status === "已收讫" || inv.dueDate >= today ? 0 : Math.round((new Date(today).getTime() - new Date(inv.dueDate).getTime()) / 86400000);

// P03-6 应收登记：客户账单「审核通过 → 发出」时由计费模块（billing.ts）调用，写入本台账（已发出）。
// 这是应收账单的唯一流入入口；收款/核销/欠费只改状态与金额，不维护账单主数据。
export function registerReceivable(data: { invNo: string; customer: string; contract: string; amount: number; dueDate: string; items: { name: string; amount: number }[] }) {
  if (INV_BY_NO(data.invNo)) return;
  RECEIVABLES.unshift({ ...data, received: 0, status: "已发出" });
  bump();
}

// 欠费策略（A5 策略中心配置的可视化呈现，实时读取，勿硬编码）
export function getOverduePolicy() {
  const grace = cfgNum("overdue.graceDays"), remind = cfgNum("overdue.remindDays"),
    suspend = cfgNum("overdue.suspendDays"), late = getCfg("overdue.lateFeeRate"),
    bad = cfgNum("overdue.badDebtDays"), billOn = getCfg("billing.billOnSuspend") === "yes";
  return [
    { rule: "宽限期", value: `${grace} 天`, note: `逾期 ≤ ${grace} 天仅提醒，不停机` },
    { rule: "提醒频率", value: `每 ${remind} 天一次`, note: "通知客户联系人 + 归属销售 + 财务；不重复堆叠未读" },
    { rule: "停机条件", value: `逾期 > ${suspend} 天`, note: "信用额度客户按额度判定；命中即逐订阅生成停机工单" },
    { rule: "滞纳金", value: `${late}% / 日`, note: "逾期金额 × 比例 × 天数，按账期入下期账单（fee_type=滞纳金）；收讫即停止" },
    { rule: "停机期间计费", value: billOn ? "照常计" : "暂停计", note: "欠停期间周期费是否仍计入账单（A5 计费规则中配置）" },
    { rule: "复机", value: "仅收讫触发", note: "足额核销自动生成复机工单；不接受人工手工复机" },
    { rule: "坏账门槛", value: `逾期 ≥ ${bad} 天`, note: "坏账走 P10 审批（默认链：财务主管 + 管理层）" },
  ];
}

let paySeq = 213, ticketSeq = 102, bdSeq = 4;
const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

// P04-1/2：收款登记 → 提交即自动核销（累计比对；足额触发复机）
export function addPayment(data: Omit<Payment, "payNo" | "status">): string | null {
  const inv = INV_BY_NO(data.invNo);
  if (!inv) return "账单不存在";
  if (!(data.amount > 0)) return "收款金额必须大于 0";
  if (data.amount > invBalance(inv)) return `收款金额 ${data.amount} 超过未收余额 ${invBalance(inv)}，已拒绝`;
  if (data.method === "银行转账" && !data.referenceNo?.trim()) return "银行转账必须填写流水号";
  const pay: Payment = { ...data, payNo: `PAY-2026-${paySeq++}`, status: "已登记" };
  PAYMENTS.unshift(pay);
  // 核销：累计已收 = Σ payment（未冲正）
  inv.received += data.amount;
  const wasSuspend = inv.status === "欠停";
  inv.status = inv.received >= inv.amount ? "已收讫" : "部分收款";
  if (wasSuspend && inv.received >= inv.amount) {
    // 欠停账单收讫 → 自动生成复机工单（P04-8：仅由收讫触发）
    const oldTicket = [...TICKETS].reverse().find((t) => t.type === "停机" && t.invNo === inv.invNo && t.status === "已完工");
    TICKETS.unshift({
      ticketNo: `RT-2026-${ticketSeq++}`, type: "复机", customer: inv.customer,
      sub: oldTicket?.sub ?? "（关联订阅）", invNo: inv.invNo, debtSummary: "账单已收讫",
      reason: "收讫复机（足额核销自动触发）", status: "待执行", linkedTicket: oldTicket?.ticketNo,
    });
  }
  bump();
  return null;
}
/** 红冲（登记错误）：走 AP-04 红冲审批通过后调用；原 payment 保留「已红冲」痕迹，不可物理删除 */
export function redFlushPayment(payNo: string) {
  const p = PAYMENTS.find((x) => x.payNo === payNo);
  if (!p || p.status === "已红冲") return;
  p.status = "已红冲";
  const inv = INV_BY_NO(p.invNo);
  if (inv) { inv.received = Math.max(0, inv.received - p.amount); inv.status = inv.received >= inv.amount ? "已收讫" : inv.received > 0 ? "部分收款" : "逾期"; }
  bump();
}

// P04-4/7：策略执行 → 生成停机工单
export function createSuspendTicket(invNo: string): string | null {
  const inv = INV_BY_NO(invNo);
  if (!inv || (inv.status !== "逾期" && inv.status !== "欠停")) return "仅逾期账单可生成停机工单";
  if (TICKETS.some((t) => t.type === "停机" && t.invNo === invNo && t.status === "待执行")) return "该账单已有待执行停机工单";
  TICKETS.unshift({
    ticketNo: `ST-2026-${ticketSeq++}`, type: "停机", customer: inv.customer,
    sub: `（${inv.invNo} 关联订阅）`, invNo, debtSummary: `逾期 ${invBalance(inv).toLocaleString("zh-CN")} 元 · 逾期 ${overdueDays(inv)} 天`,
    reason: `欠费停机（人工触发 / 策略执行：逾期 > ${cfgNum("overdue.suspendDays")} 天）`, status: "待执行",
  });
  bump();
  return null;
}
// P04-7/8：工单执行（停机 → 订阅欠停；复机 → 在网）
export function executeTicket(ticketNo: string, data: { action: string; result: string; note?: string }): string | null {
  const t = TICKETS.find((x) => x.ticketNo === ticketNo);
  if (!t || t.status === "已完工") return "工单不存在或已完工";
  if (!data.action) return "请选择执行动作";
  if (!data.result) return "请选择执行结果";
  if (data.result !== "成功" && !data.note?.trim()) return "结果非成功时必须填写执行说明";
  Object.assign(t, { action: data.action, executedAt: now(), result: data.result, note: data.note, status: "已完工" });
  const inv = INV_BY_NO(t.invNo);
  if (t.type === "停机" && inv && inv.status !== "已收讫") inv.status = "欠停";
  if (t.type === "复机" && inv) inv.status = "已收讫";
  bump();
  return null;
}

// P04-3：欠费扫描（每日定时；原型手动触发）
export function runOverdueScan(today = "2026-11-03"): number {
  let n = 0;
  RECEIVABLES.forEach((inv) => {
    if (overdueDays(inv, today) > cfgNum("overdue.graceDays") && inv.status !== "已收讫" && inv.status !== "坏账" && inv.status !== "欠停") {
      inv.status = "逾期"; n++;
    }
  });
  bump();
  return n;
}

// P04-9：坏账申请（提交 → 审批中；走 P10 AP-04 链）
export function submitBadDebt(data: Omit<BadDebtApp, "bdNo" | "status" | "createdAt">): string | null {
  if (!data.invNos.length) return "请选择逾期账单";
  if (data.collectRecord.trim().length < 10) return "催收记录不少于 10 字";
  if (data.reason === "其他" && !data.reasonText?.trim()) return "坏账原因=其他时必须填写说明";
  BADDEBT_APPS.unshift({ ...data, bdNo: `BD-2026-${String(bdSeq++).padStart(3, "0")}`, status: "审批中", createdAt: now() });
  bump();
  return null;
}
export function decideBadDebt(bdNo: string, pass: boolean): string | null {
  const app = BADDEBT_APPS.find((x) => x.bdNo === bdNo);
  if (!app || app.status !== "审批中") return "申请不存在或不在审批中";
  app.status = pass ? "已通过" : "已驳回";
  if (pass) {
    app.invNos.forEach((no) => {
      const inv = INV_BY_NO(no);
      if (inv) inv.status = "坏账";
      // 坏账确认 → 订阅强制进入 P06 退订流程（系统自动发起，退订原因=坏账）
    });
  }
  bump();
  return null;
}
