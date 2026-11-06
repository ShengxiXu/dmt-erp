// P07 月结 —— 出口成本两阶段分摊 + 测算差异比对 + 间接费用按收入占比分配 → 客户毛利
// 阶段一（出口 → 产品类型池）：出口当月成本按该出口上各产品类型的占用带宽比例拆分（共用出口的算法特例）；
// 阶段二（类型池 → 订单/客户）：池成本 ÷ 池内已售带宽 = 类型统一单位成本；订单成本 = 带宽 × 单位成本。
// 空载：出口当月无订单 → 成本进归属类型的「空载成本」，不摊给客户（扩容/缩容信号）。
// 差异：核算单测算月成本 vs 客户实际直接成本，超过 A5 阈值标黄/标红，只记录说明、不自动调账。
// 间接费用：按客户收入占比分配（A5 之外不再设参数）。月结完成后账期锁账：批次为只读快照，改动只能红冲。
import { useSyncExternalStore } from "react";
import { R1_ROWS } from "@/data/resources";
import { RECEIVABLES } from "@/data/receivables";
import { SHEETS } from "@/data/sheets";
import { getCenters } from "@/data/costCenters";
import { cfgNum } from "@/data/settings";

export interface ExitSplit {
  exitId: string; exitName: string; monthlyCost: number; totalBW: number;
  splits: { type: string; bw: number }[]; idleCost: number;
}
export interface PoolRow {
  type: string;             // 产品类型
  poolCost: number;         // 阶段一分得成本合计（自有出口全额 + 共用出口分得）
  soldBW: number;           // 池内已售带宽合计
  unitCost: number;         // 类型统一单位成本（元/M/月）
  orderCost: number;        // 阶段二摊到订单的成本合计
  idleCost: number;         // 空载成本（该类型下无订单出口的月租）
}
export interface MarginRow {
  customer: string;
  revenue: number;          // 当期收入（应收口径）
  directCost: number;       // 出口分摊直接成本
  indirectAlloc: number;    // 间接费用分配
  margin: number; marginRate: number;   // 毛利 / 毛利率
}
export interface DiffRow {
  sheetId: string; customer: string;
  estMonthly: number;       // 核算单测算月成本
  actualDirect: number;     // 实际直接成本（出口分摊）
  diff: number; diffPct: number;
  level: "正常" | "黄" | "红";
  note?: string;
}
export interface SettleBatch {
  batchNo: string; period: string; status: "已锁定"; runAt: string; operator: string;
  indirectTotal: number;
  exitSplits: ExitSplit[];
  pools: PoolRow[];
  margins: MarginRow[];
  diffs: DiffRow[];
  totals: { revenue: number; direct: number; indirect: number; margin: number };
}

// ---------- 预置：一个已跑完的 2026-09 批次（口径演示） ----------
export const SETTLE_BATCHES: SettleBatch[] = [];

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function useSettle(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getBatches = () => SETTLE_BATCHES;
export const BATCH_BY_NO = (no: string) => SETTLE_BATCHES.find((b) => b.batchNo === no);

/** 订单的产品类型：客户名带（类型）标注的取标注（共用出口），否则取出口归属类型 */
const TYPE_OF = (orderCustomer: string, exitProduct: string) => {
  const m = orderCustomer.match(/（(.+?)）/);
  return m ? m[1] : exitProduct;
};
/** 订单客户名（去标注） */
const CUST_OF = (orderCustomer: string) => orderCustomer.replace(/（.+?）/g, "");
/** 订单在账期内是否有效（since <= period；"—" = 核算中未开通，不计） */
const ACTIVE = (since: string, period: string) => since !== "—" && since <= period;

/** 间接费用预填：成本中心当月归集（settleRuns 命中账期取 estCost；无命中取各中心最近一次） */
export function preIndirect(period: string): number {
  const runs = getCenters().flatMap((c) => (c.settleRuns ?? []).map((r) => ({ ...r })));
  const hit = runs.filter((r) => r.period === period);
  const src = hit.length ? hit : runs;
  return src.reduce((s, r) => s + r.estCost, 0);
}

// P07-1：跑月结（每个账期一个批次，跑完锁账为只读快照）
export function runSettle(period: string, indirectTotal: number, operator = "财务-李娜"): { batch?: SettleBatch; error?: string } {
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "账期格式须为 2026-10" };
  if (SETTLE_BATCHES.some((b) => b.period === period)) return { error: `账期 ${period} 已月结并锁账；改动只能红冲，不能重跑` };
  if (!(indirectTotal >= 0)) return { error: "间接费用总额不能为负" };

  // 阶段一：出口成本按类型占用拆分 + 汇总类型池；空载出口成本计入归属类型 idle
  const exitSplits: ExitSplit[] = [];
  const poolMap = new Map<string, PoolRow>();
  const poolOf = (type: string) => {
    if (!poolMap.has(type)) poolMap.set(type, { type, poolCost: 0, soldBW: 0, unitCost: 0, orderCost: 0, idleCost: 0 });
    return poolMap.get(type)!;
  };
  for (const e of R1_ROWS) {
    const active = e.dynamic.orders.filter((o) => ACTIVE(o.since, period));
    const totalBW = active.reduce((s, o) => s + o.bw, 0);
    if (!totalBW) {
      exitSplits.push({ exitId: e.id, exitName: e.name, monthlyCost: e.monthlyCost, totalBW: 0, splits: [], idleCost: e.monthlyCost });
      poolOf(e.product).idleCost += e.monthlyCost;
      continue;
    }
    const splitsMap = new Map<string, number>();
    active.forEach((o) => splitsMap.set(TYPE_OF(o.customer, e.product), (splitsMap.get(TYPE_OF(o.customer, e.product)) ?? 0) + o.bw));
    const splits = [...splitsMap.entries()].map(([type, bw]) => ({ type, bw }));
    exitSplits.push({ exitId: e.id, exitName: e.name, monthlyCost: e.monthlyCost, totalBW, splits, idleCost: 0 });
    splits.forEach(({ type, bw }) => {
      poolOf(type).poolCost += Math.round((e.monthlyCost * bw) / totalBW);
      poolOf(type).soldBW += bw;
    });
  }
  // 阶段二：类型单位成本 → 订单成本
  const orderCostOf = new Map<string, number>();   // key: `${exitId}|${customer}` → 成本
  for (const e of R1_ROWS) {
    const active = e.dynamic.orders.filter((o) => ACTIVE(o.since, period));
    const totalBW = active.reduce((s, o) => s + o.bw, 0);
    if (!totalBW) continue;
    for (const o of active) {
      const type = TYPE_OF(o.customer, e.product);
      const pool = poolOf(type);
      const unit = pool.soldBW ? pool.poolCost / pool.soldBW : 0;
      pool.unitCost = Math.round((unit) * 100) / 100;
      const cost = Math.round(o.bw * unit);
      pool.orderCost += cost;
      const cust = CUST_OF(o.customer);
      orderCostOf.set(`${e.id}|${cust}`, (orderCostOf.get(`${e.id}|${cust}`) ?? 0) + cost);
    }
  }
  const pools = [...poolMap.values()].map((p) => ({
    ...p,
    unitCost: p.soldBW ? Math.round((p.poolCost / p.soldBW) * 100) / 100 : 0,
  }));

  // 收入：应收口径（应收日期所在账期）
  const revenueOf = new Map<string, number>();
  RECEIVABLES.forEach((r) => {
    if (r.dueDate.slice(0, 7) !== period) return;
    revenueOf.set(r.customer, (revenueOf.get(r.customer) ?? 0) + r.amount);
  });
  // 直接成本：客户维度汇总（去标注匹配）
  const directOf = new Map<string, number>();
  for (const e of R1_ROWS) {
    const active = e.dynamic.orders.filter((o) => ACTIVE(o.since, period));
    active.forEach((o) => {
      const cust = CUST_OF(o.customer);
      directOf.set(cust, (directOf.get(cust) ?? 0) + (orderCostOf.get(`${e.id}|${cust}`) ?? 0));
    });
  }
  // 客户毛利：收入 ∪ 成本 的客户全集；间接费用按收入占比分配
  const customers = [...new Set([...revenueOf.keys(), ...directOf.keys()])];
  const revenueSum = customers.reduce((s, c) => s + (revenueOf.get(c) ?? 0), 0);
  const margins: MarginRow[] = customers.map((customer) => {
    const revenue = revenueOf.get(customer) ?? 0;
    const directCost = directOf.get(customer) ?? 0;
    const indirectAlloc = revenueSum ? Math.round((indirectTotal * revenue) / revenueSum) : 0;
    const margin = revenue - directCost - indirectAlloc;
    return { customer, revenue, directCost, indirectAlloc, margin, marginRate: revenue ? Math.round((margin / revenue) * 1000) / 10 : 0 };
  }).sort((a, b) => b.margin - a.margin);

  // 测算差异：核算单（测算月成本）vs 客户实际直接成本；阈值 A5
  const yellow = cfgNum("settle.diffYellow"), red = cfgNum("settle.diffRed");
  const diffs: DiffRow[] = SHEETS.filter((s) => s.status !== "已驳回").map((s) => {
    const estMonthly = s.monthlyCost;
    const actualDirect = directOf.get(s.customer) ?? 0;
    const diff = actualDirect - estMonthly;
    const diffPct = estMonthly ? Math.round((diff / estMonthly) * 1000) / 10 : 0;
    const abs = Math.abs(diffPct);
    return { sheetId: s.id, customer: s.customer, estMonthly, actualDirect, diff, diffPct, level: abs >= red ? "红" : abs >= yellow ? "黄" : "正常" as DiffRow["level"] };
  });

  const batch: SettleBatch = {
    batchNo: `JS-2026-${String(SETTLE_BATCHES.length + 1).padStart(3, "0")}`,
    period, status: "已锁定", runAt: new Date().toISOString().slice(0, 16).replace("T", " "), operator,
    indirectTotal, exitSplits, pools, margins, diffs,
    totals: {
      revenue: margins.reduce((s, m) => s + m.revenue, 0),
      direct: margins.reduce((s, m) => s + m.directCost, 0),
      indirect: margins.reduce((s, m) => s + m.indirectAlloc, 0),
      margin: margins.reduce((s, m) => s + m.margin, 0),
    },
  };
  SETTLE_BATCHES.unshift(batch);
  bump();
  return { batch };
}

/** 差异说明补录（黄 / 红项必填说明；写回快照） */
export function saveDiffNote(batchNo: string, sheetId: string, note: string): string | null {
  const b = BATCH_BY_NO(batchNo);
  const d = b?.diffs.find((x) => x.sheetId === sheetId);
  if (!b || !d) return "批次或核算单不存在";
  if (!note.trim()) return "说明不能为空";
  d.note = note.trim();
  bump();
  return null;
}
