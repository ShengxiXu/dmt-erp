// P04 收款与欠费管理 —— 客户应收侧
// 收款登记（P04-1）→ 核销（P04-2，提交自动比对）→ 欠费扫描/策略（P04-3/4，策略在 A5 配置）→
// 提醒（P04-5）→ 滞纳金（P04-6，入下期账单）→ 停机执行（P04-7）→ 复机执行（P04-8，仅收讫触发）→ 坏账处理（P04-9，走 P10 审批）
// 闭环规则：复机仅由「足额核销」自动触发，不接受人工手工复机（防绕过欠费管控）；登记错误走红冲审批（AP-04），原单留痕不可删。
import { notify } from "@/data/notices";
import { useSyncExternalStore } from "react";
import { cfgNum, getCfg, DEMO_TODAY, demoNow } from "@/data/settings";
import { persistable } from "@/data/persist";

// ---------- 客户账单（应收） ----------
export type InvStatus = "已发出" | "部分收款" | "已收讫" | "逾期" | "欠停" | "坏账";
// 开票标记（P04-0）：开票是应收账单的从属凭证，不拥有独立状态机（财务中心 v2，2026-11-09）。
// 生命周期全部挂在账单行内：待开票 → 开票中 → 已开票 / 已红冲；invoiceApps.ts 仅为派生视图门面。
export type InvMarkStatus = "待开票" | "开票中" | "已开票" | "已红冲";
export interface InvoiceInfo {
  apNo: string;            // KA-2026-xxx 开票申请单号（沿用原编号体系）
  periodText: string;      // 开票账期（如 2026-10-01 ~ 2026-10-31）
  items: string[];         // 开票内容（账单明细名称）
  bizCat: string;          // 业务类别（ISP / IDC / 云 / L2L / 工程 / 设备 / 等保 / 楼宇 / 其他）
  invType: "增值税专用发票（电子）" | "普通发票（电子）";
  format: "PDF" | "OFD" | "XML";
  buyerNote?: string;      // 对方要求开票备注
  contact?: string;        // 对方联系人
  status: InvMarkStatus;
  invoiceNo?: string;      // 发票号码（金蝶开完回填）
  invoicedAt?: string;     // 开票日期
  createdAt: string;
}
export interface Receivable {
  invNo: string; customer: string; contract: string;
  amount: number;          // 账单金额
  received: number;        // 累计已收（Σ payment 未冲正）
  dueDate: string;         // 应收日期
  status: InvStatus;
  items: { name: string; amount: number }[]; // 账单明细
  invoice?: InvoiceInfo;   // 开票标记（账单「通过并发出」时自动生成，待开票）
  promiseDate?: string;    // 承诺付款日（销售与客户协调后登记，逾期超承诺日自动升级催收阶段）
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
// ---------- 催收跟进记录（P04-5 留痕：行动项从政策模板变为可闭环的催收工单） ----------
export interface CollectRecord {
  crNo: string; invNo: string; customer: string;
  at: string;                // 跟进时间
  by: string;                // 跟进人（真实姓名）
  role: "业务支撑" | "归属销售" | "财务" | "技术部";
  channel: "电话" | "微信" | "邮件" | "上门" | "催款函";
  content: string;           // 跟进内容（客户反馈 / 约定）
  promiseDate?: string;      // 本次约定的承诺付款日（写回账单行）
  nextFollowAt?: string;     // 下次跟进日期（到期进通知铃铛 / 工作台待办）
}
export const COLLECT_RECORDS: CollectRecord[] = persistable("collectRecords", () => [
  { crNo: "CR-2026-012", invNo: "INV-2026-0901", customer: "恒信证券", at: "2026-10-30 15:20", by: "许晟熙", role: "业务支撑", channel: "电话",
    content: "客户财务确认 11 月初付款，承诺 11-08 前到账；如未到账将上报其管理层。", promiseDate: "2026-11-08", nextFollowAt: "2026-11-06" },
  { crNo: "CR-2026-009", invNo: "INV-2026-0866", customer: "跃游网络", at: "2026-10-24 10:05", by: "张弛", role: "归属销售", channel: "电话",
    content: "客户说上周已请款，但 10-30 仍未到账；客户承诺 10-28 付款已破约，升级催收。", promiseDate: "2026-10-28" },
  { crNo: "CR-2026-004", invNo: "INV-2026-0777", customer: "某跨境电商", at: "2026-10-15 09:40", by: "许晟熙", role: "业务支撑", channel: "催款函",
    content: "发送催款函（顺丰留底），要求 10 个工作日内付款，否则按合同停网并计滞纳金。", nextFollowAt: "2026-10-29" },
]);
// ---------- 坏账申请（P04-9） ----------
export interface BadDebtApp {
  bdNo: string; customer: string; invNos: string[]; total: number;
  collectRecord: string; reason: "客户失联" | "破产" | "拒付" | "其他";
  reasonText?: string; handling: "核销坏账" | "继续挂账观察";
  status: "草稿" | "审批中" | "已通过" | "已驳回";
  createdAt: string;
}

// ---------- 预置数据 ----------
export const BIZ_CATS = ["ISP", "IDC", "云", "L2L", "工程", "设备", "等保", "楼宇", "其他"];
export const RECEIVABLES: Receivable[] = persistable("receivables", () => [
  { invNo: "INV-2026-0881", customer: "中海贸易", contract: "HT-2026-023", amount: 12800, received: 12800, dueDate: "2026-10-15", status: "已收讫",
    items: [{ name: "单线 200M · 10 月周期费", amount: 12800 }],
    invoice: { apNo: "KA-2026-0305", periodText: "2026-09-25 ~ 2026-10-24", items: ["单线 200M · 账期周期费"],
      bizCat: "ISP", invType: "增值税专用发票（电子）", format: "PDF", buyerNote: "备注栏请注明合同号 HT-2026-023",
      status: "开票中", createdAt: "2026-10-12 09:40" } },
  { invNo: "INV-2026-0912", customer: "凯瑞传媒", contract: "HT-2026-020", amount: 8500, received: 5000, dueDate: "2026-10-20", status: "部分收款",
    items: [{ name: "精品网通道 100M · 10 月周期费", amount: 8500 }] },
  { invNo: "INV-2026-0945", customer: "云启数据科技", contract: "HT-2026-021", amount: 26400, received: 0, dueDate: "2026-11-05", status: "已发出",
    items: [{ name: "AI 专线 100M ×2 · 10 月周期费", amount: 24000 }, { name: "IP 地址 12 个", amount: 2400 }],
    invoice: { apNo: "KA-2026-0312", periodText: "2026-10-01 ~ 2026-10-31", items: ["AI 专线 100M×2 · 10 月周期费", "IP 地址 12 个"],
      bizCat: "ISP", invType: "增值税专用发票（电子）", format: "PDF", contact: "钱工",
      status: "待开票", createdAt: "2026-11-03 10:12" } },
  { invNo: "INV-2026-0901", customer: "恒信证券", contract: "HT-2026-018", amount: 15200, received: 0, dueDate: "2026-10-06", status: "逾期",
    items: [{ name: "精品网 80M · 9-10 月周期费", amount: 15200 }], promiseDate: "2026-11-08" },
  { invNo: "INV-2026-0866", customer: "跃游网络", contract: "HT-2026-024", amount: 6800, received: 0, dueDate: "2026-09-20", status: "逾期",
    items: [{ name: "D-MAN 通道 · 9 月周期费", amount: 6800 }], promiseDate: "2026-10-28" },
  { invNo: "INV-2026-0777", customer: "某跨境电商", contract: "HT-2026-0202", amount: 9600, received: 0, dueDate: "2026-09-10", status: "欠停",
    items: [{ name: "国际精品网 120M · 8-9 月周期费", amount: 9600 }] },
  { invNo: "INV-2026-0833", customer: "恒信证券", contract: "HT-2026-018", amount: 15200, received: 15200, dueDate: "2026-09-09", status: "已收讫",
    items: [{ name: "精品网 80M · 8-9 月周期费", amount: 15200 }],
    invoice: { apNo: "KA-2026-0288", periodText: "2026-08-10 ~ 2026-09-09", items: ["国内精品网 80M · 账期周期费"],
      bizCat: "ISP", invType: "普通发票（电子）", format: "PDF", contact: "孙经理",
      status: "已开票", invoiceNo: "243120000001234567", invoicedAt: "2026-09-12", createdAt: "2026-09-08 14:20" } },
]);
export const PAYMENTS: Payment[] = persistable("payments", () => [
  { payNo: "PAY-2026-0201", invNo: "INV-2026-0881", customer: "中海贸易", amount: 12800, paidAt: "2026-10-14 10:22", method: "银行转账", referenceNo: "BK202610140088", payerAccount: "中海贸易有限公司", status: "已登记" },
  { payNo: "PAY-2026-0212", invNo: "INV-2026-0912", customer: "凯瑞传媒", amount: 5000, paidAt: "2026-10-22 15:40", method: "银行转账", referenceNo: "BK202610220129", payerAccount: "凯瑞传媒股份有限公司", status: "已登记" },
  { payNo: "PAY-2026-0199", invNo: "INV-2026-0833", customer: "恒信证券", amount: 15200, paidAt: "2026-09-08 16:30", method: "银行转账", referenceNo: "BK202609080066", payerAccount: "恒信证券股份有限公司", status: "已登记" },
]);
export const TICKETS: SuspendTicket[] = persistable("tickets", () => [
  { ticketNo: "ST-2026-101", type: "停机", customer: "跃游网络", sub: "SUB-2026-0312（D-MAN 通道）", invNo: "INV-2026-0866", debtSummary: "逾期 6,800 元 · 逾期 44 天", reason: "欠费停机（策略触发：逾期 > 30 天）", status: "待执行" },
  { ticketNo: "ST-2026-097", type: "停机", customer: "某跨境电商", sub: "SUB-2026-0188（国际精品网 120M）", invNo: "INV-2026-0777", debtSummary: "逾期 9,600 元 · 逾期 54 天", reason: "欠费停机（策略触发：逾期 > 30 天）", action: "断网", executedAt: "2026-10-24 11:05", result: "成功", status: "已完工" },
]);
export const BADDEBT_APPS: BadDebtApp[] = persistable("badDebtApps", () => [
  { bdNo: "BD-2026-003", customer: "某跨境电商", invNos: ["INV-2026-0777"], total: 9600, collectRecord: "9/12、9/26、10/10 三次电话催收无果，10/15 发催收函无回应；客户官网已无法访问。", reason: "客户失联", handling: "核销坏账", status: "草稿", createdAt: "2026-10-28 09:30" },
]);

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
export const getCollectRecords = () => COLLECT_RECORDS;
export const INV_BY_NO = (no: string) => RECEIVABLES.find((r) => r.invNo === no);
export const invBalance = (inv: Receivable) => inv.amount - inv.received;
/** 逾期天数（应收日 → 今日，未收讫才算） */
export const overdueDays = (inv: Receivable, today = DEMO_TODAY) =>
  inv.status === "已收讫" || inv.dueDate >= today ? 0 : Math.round((new Date(today).getTime() - new Date(inv.dueDate).getTime()) / 86400000);

// P03-6 应收登记：客户账单「审核通过 → 发出」时由计费模块（billing.ts）调用，写入本台账（已发出）。
// 这是应收账单的唯一流入入口；收款/核销/欠费只改状态与金额，不维护账单主数据。
// invoice 传入时同步生成开票标记（待开票）——开票申请不再有独立单据，见文件头 InvMarkStatus 注释。
const rcSeqBox = persistable("receivables.seq", () => ({ invApp: 313, pay: 213, ticket: 102, bd: 4, cr: 13 }));
const now = demoNow;
export function registerReceivable(data: { invNo: string; customer: string; contract: string; amount: number; dueDate: string; items: { name: string; amount: number }[]; invoice?: { periodText: string; items: string[] } }) {
  if (INV_BY_NO(data.invNo)) return;
  const { invoice, ...rest } = data;
  RECEIVABLES.unshift({ ...rest, received: 0, status: "已发出",
    invoice: invoice ? { apNo: `KA-2026-${rcSeqBox.invApp++}`, periodText: invoice.periodText, items: invoice.items,
      bizCat: "ISP", invType: "增值税专用发票（电子）", format: "PDF", status: "待开票", createdAt: now() } : undefined });
  if (invoice) notify({ level: "blue", group: "财务", title: "应收账单生成", text: `${data.customer} ${data.invNo}（¥${data.amount.toLocaleString("zh-CN")}）已出账，待开票`, to: "/finance?tab=invoice" });
  bump();
}

// ---------- 开票标记操作（P04-0；由 invoiceApps.ts 门面与财务中心共用） ----------
const AP_LOCATE = (apNo: string) => {
  const inv = RECEIVABLES.find((r) => r.invoice?.apNo === apNo);
  return inv?.invoice ? { inv, info: inv.invoice } : null;
};
export const getInvoiceInfo = (invNo: string) => INV_BY_NO(invNo)?.invoice;
/** 待开票 → 编辑开票要素（发票类型 / 格式 / 业务类别 / 对方备注 / 联系人） */
export function updateInvoiceInfo(apNo: string, patch: Partial<Pick<InvoiceInfo, "invType" | "format" | "bizCat" | "buyerNote" | "contact">>): string | null {
  const loc = AP_LOCATE(apNo);
  if (!loc || loc.info.status !== "待开票") return "仅待开票申请可编辑";
  Object.assign(loc.info, patch);
  bump();
  return null;
}
/** 待开票 → 开票中（业务支撑开始录金蝶；登记单随之可打印） */
export function startInvoicingInfo(apNo: string): string | null {
  const loc = AP_LOCATE(apNo);
  if (!loc || loc.info.status !== "待开票") return "仅待开票申请可登记开票";
  loc.info.status = "开票中";
  bump();
  return null;
}
/** 金蝶开完票 → 回填发票号码 + 开票日期（开票中 → 已开票） */
export function fillInvoiceInfo(apNo: string, invoiceNo: string, invoicedAt: string): string | null {
  const loc = AP_LOCATE(apNo);
  if (!loc || loc.info.status !== "开票中") return "仅开票中的申请可回填发票号";
  if (!invoiceNo.trim()) return "必须填写发票号码";
  if (!invoicedAt.trim()) return "必须填写开票日期";
  loc.info.invoiceNo = invoiceNo.trim(); loc.info.invoicedAt = invoicedAt; loc.info.status = "已开票";
  notify({ level: "green", group: "财务", title: "开票完成", text: `${loc.inv.customer} ${loc.inv.invNo} 发票号 ${loc.info.invoiceNo} 已回填（${invoicedAt}）`, to: "/finance?tab=invoice" });
  bump();
  return null;
}
/** 发票红冲/作废（发生在金蝶，此处状态标记留痕）。
 *  规则：账单已发生任何收款（部分/全额）时不允许红冲发票——先走收款红冲审批（AP-04）冲平后再处理发票。 */
export function redFlushInvoiceInfo(apNo: string): string | null {
  const loc = AP_LOCATE(apNo);
  if (!loc || loc.info.status !== "已开票") return "仅已开票申请可标记红冲";
  if (loc.inv.received > 0) return "该账单已发生收款，不允许红冲发票；请先走收款红冲审批（AP-04）冲平收款";
  loc.info.status = "已红冲";
  notify({ level: "red", group: "财务", title: "发票红冲", text: `${loc.inv.customer} ${loc.inv.invNo}（${loc.info.invoiceNo}）已标记红冲，请同步处理金蝶侧`, to: "/finance?tab=invoice" });
  bump();
  return null;
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

// P04-1/2：收款登记 → 提交即自动核销（累计比对；足额触发复机）
export function addPayment(data: Omit<Payment, "payNo" | "status">): string | null {
  const inv = INV_BY_NO(data.invNo);
  if (!inv) return "账单不存在";
  if (!(data.amount > 0)) return "收款金额必须大于 0";
  if (data.amount > invBalance(inv)) return `收款金额 ${data.amount} 超过未收余额 ${invBalance(inv)}，已拒绝`;
  if (data.method === "银行转账" && !data.referenceNo?.trim()) return "银行转账必须填写流水号";
  const pay: Payment = { ...data, payNo: `PAY-2026-${rcSeqBox.pay++}`, status: "已登记" };
  PAYMENTS.unshift(pay);
  // 核销：累计已收 = Σ payment（未冲正）
  inv.received += data.amount;
  const wasSuspend = inv.status === "欠停";
  inv.status = inv.received >= inv.amount ? "已收讫" : "部分收款";
  if (wasSuspend && inv.received >= inv.amount) {
    // 欠停账单收讫 → 自动生成复机工单（P04-8：仅由收讫触发）
    const oldTicket = [...TICKETS].reverse().find((t) => t.type === "停机" && t.invNo === inv.invNo && t.status === "已完工");
    TICKETS.unshift({
      ticketNo: `RT-2026-${rcSeqBox.ticket++}`, type: "复机", customer: inv.customer,
      sub: oldTicket?.sub ?? "（关联订阅）", invNo: inv.invNo, debtSummary: "账单已收讫",
      reason: "收讫复机（足额核销自动触发）", status: "待执行", linkedTicket: oldTicket?.ticketNo,
    });
    notify({ level: "orange", group: "财务", title: "复机工单自动生成", text: `${inv.customer} ${inv.invNo} 已足额收讫，复机工单待执行（仅收讫触发）`, to: "/finance?tab=collect" });
  }
  notify({ level: "green", group: "财务", title: "回款到账", text: `${inv.customer} 回款 ¥${data.amount.toLocaleString("zh-CN")}（${data.method}${data.referenceNo ? ` · 流水 ${data.referenceNo}` : ""} · ${inv.invNo}）`, to: "/finance?tab=pay" });
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
  notify({ level: "red", group: "财务", title: "收款红冲", text: `${p.customer} ${p.payNo}（¥${p.amount.toLocaleString("zh-CN")}）已红冲，账单余额已回冲`, to: "/finance?tab=pay" });
  bump();
}

// P04-4/7：策略执行 → 生成停机工单
export function createSuspendTicket(invNo: string): string | null {
  const inv = INV_BY_NO(invNo);
  if (!inv || (inv.status !== "逾期" && inv.status !== "欠停")) return "仅逾期账单可生成停机工单";
  if (TICKETS.some((t) => t.type === "停机" && t.invNo === invNo && t.status === "待执行")) return "该账单已有待执行停机工单";
  TICKETS.unshift({
    ticketNo: `ST-2026-${rcSeqBox.ticket++}`, type: "停机", customer: inv.customer,
    sub: `（${inv.invNo} 关联订阅）`, invNo, debtSummary: `逾期 ${invBalance(inv).toLocaleString("zh-CN")} 元 · 逾期 ${overdueDays(inv)} 天`,
    reason: `欠费停机（人工触发 / 策略执行：逾期 > ${cfgNum("overdue.suspendDays")} 天）`, status: "待执行",
  });
  notify({ level: "red", group: "财务", title: "停机工单生成", text: `${inv.customer} ${invNo} 停机工单已创建（逾期 ${overdueDays(inv)} 天），待技术执行`, to: "/finance?tab=collect" });
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
  notify({ level: data.result === "成功" ? "green" : "red", group: "财务", title: `${t.type}工单已完工`, text: `${t.customer} ${t.ticketNo} 执行${data.result}${data.note ? `：${data.note}` : ""}`, to: "/finance?tab=collect" });
  bump();
  return null;
}

// P04-3：欠费扫描（每日定时；原型手动触发）
export function runOverdueScan(today = DEMO_TODAY): number {
  let n = 0;
  RECEIVABLES.forEach((inv) => {
    if (overdueDays(inv, today) > cfgNum("overdue.graceDays") && inv.status !== "已收讫" && inv.status !== "坏账" && inv.status !== "欠停") {
      inv.status = "逾期"; n++;
    }
  });
  if (n > 0) notify({ level: "orange", group: "财务", title: "逾期扫描完成", text: `${today} 扫描：${n} 笔账单迁入「逾期」，按策略进入宽限提醒 / 催收 / 停机判定`, to: "/finance?tab=collect" });
  bump();
  return n;
}

// P04-5：催收跟进登记（留痕）——写入跟进记录；如约定承诺付款日则同步写回账单行；下次跟进日进入通知/待办派生
export function addCollectRecord(data: Omit<CollectRecord, "crNo">): string | null {
  const inv = INV_BY_NO(data.invNo);
  if (!inv) return "账单不存在";
  if (data.content.trim().length < 5) return "跟进内容不少于 5 字";
  COLLECT_RECORDS.unshift({ ...data, crNo: `CR-2026-${String(rcSeqBox.cr++).padStart(3, "0")}`, content: data.content.trim() });
  if (data.promiseDate?.trim()) inv.promiseDate = data.promiseDate.trim();
  bump();
  return null;
}

// P04-9：坏账申请（提交 → 审批中；走 P10 AP-04 链）
export function submitBadDebt(data: Omit<BadDebtApp, "bdNo" | "status" | "createdAt">): string | null {
  if (!data.invNos.length) return "请选择逾期账单";
  if (data.collectRecord.trim().length < 10) return "催收记录不少于 10 字";
  if (data.reason === "其他" && !data.reasonText?.trim()) return "坏账原因=其他时必须填写说明";
  const bdNo = `BD-2026-${String(rcSeqBox.bd++).padStart(3, "0")}`;
  BADDEBT_APPS.unshift({ ...data, bdNo, status: "审批中", createdAt: now() });
  notify({ level: "red", group: "财务", title: "坏账申请已提交", text: `${bdNo}（${data.customer} · ${data.invNos.length} 笔）进入审批（默认链：财务主管 + 管理层）`, to: "/finance?tab=collect" });
  bump();
  return null;
}
export function decideBadDebt(bdNo: string, pass: boolean): string | null {
  const app = BADDEBT_APPS.find((x) => x.bdNo === bdNo);
  if (!app || app.status !== "审批中") return "申请不存在或不在审批中";
  app.status = pass ? "已通过" : "已驳回";
  notify({ level: pass ? "red" : "blue", group: "财务", title: `坏账申请${pass ? "已通过" : "被驳回"}`, text: `${bdNo}（${app.customer}）${pass ? "账单已转坏账，停止催收" : "继续催收流程"}`, to: "/finance?tab=collect" });
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
