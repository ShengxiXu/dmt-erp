// 财务中心共享派生层（2026-11-09 财务中心 v2）
// 原则：所有看板 / 台账 / 待办 / 行动清单的口径唯一出处，页面禁止各自重算。
// 全部为 RECEIVABLES / PAYMENTS 的纯派生视图——不落库、不维护独立待办数据（行业实践：账龄是行动清单而非报表）。
import { RECEIVABLES, PAYMENTS, COLLECT_RECORDS, invBalance, overdueDays, type Receivable } from "@/data/receivables";
import { CUSTOMERS } from "@/data/customers";
import { cfgNum } from "@/data/settings";

/** 演示基准日（与 receivables.runOverdueScan / overdueDays 默认值一致，勿用真实日期） */
export const FIN_TODAY = "2026-11-03";

/** 归属销售（客户主数据取真名；客户档案维护，无 CRM 同步） */
export const salesOf = (customer: string) => CUSTOMERS.find((c) => c.name === customer)?.sales ?? "—";
/** 承诺付款日是否已破约（已过期且未收讫） */
export const promiseBroken = (inv: Receivable) =>
  !!inv.promiseDate && inv.promiseDate < FIN_TODAY && inv.status !== "已收讫" && inv.status !== "坏账";
/** 破约天数 */
export const promiseOverDays = (inv: Receivable) =>
  promiseBroken(inv) ? Math.round((new Date(FIN_TODAY).getTime() - new Date(inv.promiseDate!).getTime()) / 86400000) : 0;

// ---------- KPI（财务中心页头与「对账看板」页签共用） ----------
export interface FinanceKPIs {
  应收总额: number;   // Σ 账单金额（不含坏账）
  应收余额: number;   // Σ 未收余额（不含已收讫 / 坏账）
  已收金额: number;   // Σ 已收（未红冲）
  回款率: number;     // 已收 ÷ 应收总额
  逾期金额: number;   // 逾期 + 欠停的未收余额
  逾期率: number;     // 逾期金额 ÷ 应收总额
  收讫笔数: number;
  按时收讫笔数: number; // 最后一笔实收日 ≤ 应收日
  开票及时率: number;   // 已开票 ÷（已开票 + 已收讫未开票）——收款先于开票视为不及时
  待开票笔数: number;
  开票中笔数: number;
}
export function financeKPIs(): FinanceKPIs {
  const live = RECEIVABLES.filter((r) => r.status !== "坏账");
  const 应收总额 = live.reduce((s, r) => s + r.amount, 0);
  const 已收金额 = live.reduce((s, r) => s + r.received, 0);
  const open = live.filter((r) => r.status !== "已收讫");
  const 应收余额 = open.reduce((s, r) => s + invBalance(r), 0);
  const overdue = open.filter((r) => r.status === "逾期" || r.status === "欠停");
  const 逾期金额 = overdue.reduce((s, r) => s + invBalance(r), 0);
  const settled = live.filter((r) => r.status === "已收讫");
  const lastPaidAt = (invNo: string) =>
    PAYMENTS.filter((p) => p.invNo === invNo && p.status === "已登记").map((p) => p.paidAt.slice(0, 10)).sort().pop() ?? "9999";
  const 按时收讫笔数 = settled.filter((r) => lastPaidAt(r.invNo) <= r.dueDate).length;
  const invoiced = live.filter((r) => r.invoice?.status === "已开票").length;
  const paidUninvoiced = settled.filter((r) => r.invoice && r.invoice.status !== "已开票" && r.invoice.status !== "已红冲").length;
  return {
    应收总额, 应收余额, 已收金额,
    回款率: 应收总额 ? 已收金额 / 应收总额 : 0,
    逾期金额, 逾期率: 应收总额 ? 逾期金额 / 应收总额 : 0,
    收讫笔数: settled.length, 按时收讫笔数,
    开票及时率: invoiced + paidUninvoiced ? invoiced / (invoiced + paidUninvoiced) : 1,
    待开票笔数: live.filter((r) => r.invoice?.status === "待开票").length,
    开票中笔数: live.filter((r) => r.invoice?.status === "开票中").length,
  };
}

// ---------- 账龄与催收阶段（策略实时读 A5 策略中心，勿硬编码） ----------
export const agingDays = (inv: Receivable) => overdueDays(inv, FIN_TODAY);

export type CollectStage = "正常" | "宽限提醒" | "催收跟进" | "停机预警" | "坏账候选";
/** 催收阶段：宽限期 → 催收跟进 → 停机预警 → 坏账候选，阶梯参数全部来自 A5 策略中心；
 *  承诺付款日破约 → 阶段强制不低于「催收跟进」（升级提示由 collectActions 给出） */
export function collectStage(inv: Receivable): CollectStage {
  if (inv.status === "已收讫" || inv.status === "坏账") return "正常";
  const d = agingDays(inv);
  if (d <= 0) return "正常";
  let stage: CollectStage;
  if (d <= cfgNum("overdue.graceDays")) stage = "宽限提醒";
  else if (d >= cfgNum("overdue.badDebtDays")) stage = "坏账候选";
  else if (d > cfgNum("overdue.suspendDays")) stage = "停机预警";
  else stage = "催收跟进";
  if (stage === "宽限提醒" && promiseBroken(inv)) stage = "催收跟进";
  return stage;
}

export interface CollectAction { owner: string; action: string }
/** 催收行动清单：每条逾期余额派生出「谁该干什么」（行业实践：状态语义 = 责任人 + 下一步动作）。
 *  责任人取客户主数据「归属销售」真名；行动项可由催收跟进记录（COLLECT_RECORDS）闭环留痕。 */
export function collectActions(inv: Receivable): CollectAction[] {
  const acts: CollectAction[] = [];
  const d = agingDays(inv);
  const remind = Math.max(1, cfgNum("overdue.remindDays"));
  const sales = `归属销售（${salesOf(inv.customer)}）`;
  if (inv.invoice && (inv.invoice.status === "待开票" || inv.invoice.status === "开票中")) {
    acts.push({ owner: "业务支撑", action: `完成开票${inv.invoice.status === "开票中" ? "并回填发票号" : "（录金蝶 → 回填发票号）"}，客户凭票付款` });
  }
  if (inv.status === "已收讫" || inv.status === "坏账" || d <= 0) return acts;
  const stage = collectStage(inv);
  if (inv.promiseDate && !promiseBroken(inv)) {
    acts.push({ owner: sales, action: `按约定跟进：承诺付款日 ${inv.promiseDate}，到期前 1-2 天提醒客户财务` });
  }
  if (promiseBroken(inv)) {
    acts.push({ owner: sales, action: `承诺付款日 ${inv.promiseDate} 已破约 ${promiseOverDays(inv)} 天：联系客户确认原因，重新约定付款日并登记跟进` });
  }
  if (stage === "宽限提醒") {
    acts.push({ owner: "业务支撑", action: `提醒客户联系人付款（逾期 ${d} 天，宽限期内）` });
    acts.push({ owner: sales, action: "同步客户，确认付款安排" });
  } else if (stage === "催收跟进") {
    acts.push({ owner: "业务支撑", action: `第 ${Math.floor(d / remind) + 1} 次周期提醒（每 ${remind} 天一次）：客户联系人 + ${sales} + 财务` });
    if (!promiseBroken(inv)) acts.push({ owner: sales, action: "电话/上门催收，向业务支撑登记客户承诺付款日" });
  } else if (stage === "停机预警") {
    acts.push({ owner: sales, action: `告知客户限期付款，逾期 > ${cfgNum("overdue.suspendDays")} 天将停网` });
    acts.push({ owner: "技术部", action: inv.status === "欠停" ? "停机工单执行中 / 已完工" : "按策略生成停机工单（本页可直接触发）" });
  } else {
    acts.push({ owner: "财务", action: `逾期 ${d} 天 ≥ 坏账门槛 ${cfgNum("overdue.badDebtDays")} 天，发起坏账审批（P10）` });
    acts.push({ owner: sales, action: "最后一轮催收并留痕（坏账申请需附催收记录 ≥ 10 字）" });
  }
  return acts;
}
/** 全量催收行动清单（「催收行动」页签与待办计数共用） */
export function allCollectItems() {
  return RECEIVABLES.filter((r) => r.status !== "已收讫" && r.status !== "坏账" && agingDays(r) > 0)
    .map((r) => ({ inv: r, stage: collectStage(r), days: agingDays(r), actions: collectActions(r),
      records: COLLECT_RECORDS.filter((c) => c.invNo === r.invNo) }));
}
/** 到期跟进项（nextFollowAt ≤ 基准日）：通知铃铛 / 工作台待办派生 */
export function dueFollowUps() {
  return COLLECT_RECORDS.filter((c) => c.nextFollowAt && c.nextFollowAt <= FIN_TODAY);
}

// ---------- 对账看板派生指标（「对账看板」页签唯一出处） ----------
/** DSO（原型口径）：已收讫账单的平均回款延迟天数 = Σ max(0, 最后一笔实收日 − 应收日) ÷ 收讫笔数 */
export function dsoDays(): number {
  const settled = RECEIVABLES.filter((r) => r.status === "已收讫");
  if (!settled.length) return 0;
  const sum = settled.reduce((s, r) => {
    const last = PAYMENTS.filter((p) => p.invNo === r.invNo && p.status === "已登记").map((p) => p.paidAt.slice(0, 10)).sort().pop();
    if (!last) return s;
    return s + Math.max(0, Math.round((new Date(last).getTime() - new Date(r.dueDate).getTime()) / 86400000));
  }, 0);
  return Math.round((sum / settled.length) * 10) / 10;
}
export interface AgingBucket { label: string; amount: number; n: number }
/** 账龄结构（未收讫且非坏账的账单，按逾期天数分桶） */
export function agingBuckets(): AgingBucket[] {
  const open = RECEIVABLES.filter((r) => r.status !== "已收讫" && r.status !== "坏账");
  const put = (b: AgingBucket, inv: Receivable) => { b.amount += invBalance(inv); b.n++; };
  const buckets: AgingBucket[] = [
    { label: "未到期", amount: 0, n: 0 }, { label: "宽限期内", amount: 0, n: 0 },
    { label: "逾期 ≤30 天", amount: 0, n: 0 }, { label: "逾期 31-90 天", amount: 0, n: 0 }, { label: "逾期 >90 天", amount: 0, n: 0 },
  ];
  const grace = cfgNum("overdue.graceDays");
  open.forEach((inv) => {
    const d = agingDays(inv);
    if (d <= 0) put(buckets[0], inv);
    else if (d <= grace) put(buckets[1], inv);
    else if (d <= 30) put(buckets[2], inv);
    else if (d <= 90) put(buckets[3], inv);
    else put(buckets[4], inv);
  });
  return buckets;
}
/** 已收讫但未完成开票的账单（开票及时率的明细，也是对账重点关注） */
export function paidUninvoiced(): Receivable[] {
  return RECEIVABLES.filter((r) => r.status === "已收讫" && r.invoice && r.invoice.status !== "已开票" && r.invoice.status !== "已红冲");
}
/** 坏账风险：坏账候选阶段余额合计（审批中的坏账申请另行展示在欠费与坏账页） */
export function badDebtRisk(): number {
  return RECEIVABLES.filter((r) => collectStage(r) === "坏账候选").reduce((s, r) => s + invBalance(r), 0);
}
