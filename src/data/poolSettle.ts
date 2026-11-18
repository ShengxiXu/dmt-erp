// 出口带宽直接成本 · 计价与归档（《出口带宽成本计价口径设计 v1.4》定稿）
//   签单（提交审批那一刻）：锁定「预估快照」——当时产品类型租金池 / 已售带宽 / 各出口切分明细 / 本单预估，
//   作为报价与审批依据，事后不追改；
//   月结：按签单锁定快照归集归档（前提 1：不重算）；签单快照是月结的唯一依据。
//   两步法口径见 @/data/exitPricing：① 出口租金按各类型已售占比切分 ② 类型跨出口叠加边际计价。
import { persistable } from "@/data/persist";
import { useSyncExternalStore } from "react";
import { POOLS } from "./pool";
import { R1_ROWS } from "./resources";
import { typeRentPool, typeOrders } from "./exitPricing";
import { demoNow } from "./settings";

/** 签单时锁定的预估快照（一条 = 一单在一个产品类型租金池的占用） */
export interface PoolEst {
  orderId: string;          // 订单行 id
  orderName: string;        // 订单行名称（客户 + 带宽）
  pool: string;             // 租金池键 ＝ 订单产品类型（两步法跨出口叠加；非出口归属类型、非池名称）
  lineIds: string[];        // 选中的出口线路（选池模式 = 池成员出口）
  bw: number;               // 本单带宽（M）
  rentTotal: number;        // 签单时类型租金池合计
  soldTotal: number;        // 签单时类型已售带宽合计
  est: number;              // 预估月成本 = rentTotal ÷ (soldTotal + bw) × bw
  /** 各出口切分明细（月结归档 / 对账依据；存量快照无此字段） */
  splits?: { exitId: string; rent: number; sold: number }[];
  at: string;               // 锁存时间
}

export interface PoolSettleLine {
  orderId: string; orderName: string; bw: number;
  /** 签单预估（存量单没有快照则为 null） */
  est: number | null;
  settle: number;           // 结算 ＝ 签单锁定快照 est（前提 1：月结不重算）
  diff: number | null;      // 预留：未来如启用实际成本口径时的差异位
}

export interface PoolSettleRun {
  id: string; period: string; pool: string;
  rentTotal: number; soldTotal: number;   // 归档时快照口径
  lines: PoolSettleLine[];
  totalSettle: number; totalDiff: number;
  runAt: string; status: "已结算";
}

// ---------- 轻量 store ----------
const ests: PoolEst[] = persistable("poolSettle.ests", () => []);
const runs: PoolSettleRun[] = persistable("poolSettle.runs", () => []);
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function usePoolSettle(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getEsts = () => ests;
export const getRuns = () => runs;

/** 提交审批那一刻锁存预估快照（按出口池分组，一单一组一条） */
export function snapshotEsts(list: Omit<PoolEst, "at">[]) {
  const at = demoNow();
  ests.push(...list.map((e) => ({ ...e, at })));
  bump();
}

/** 结算单元列表（按产品类型租金池聚合：两步法口径的租金合计 / 已售合计 / 在役订单）
 *  数据来自 exitPricing 的台账口径（出口直挂订单 + 池化分摊），随单据实时沉淀、无需人工维护 */
export interface PoolAgg {
  pool: string;
  rentTotal: number;      // 类型租金池合计（各出口切给该类型的租金加总）
  soldTotal: number;      // 类型已售带宽合计（直挂 + 池化分摊，档案当前值）
  lineCount: number;      // 贡献租金的出口数
  /** 在役订单（无签单快照的存量订单；含直挂与池订单） */
  stockOrders: { orderId: string; orderName: string; bw: number }[];
}
export function poolList(): PoolAgg[] {
  const types = new Set<string>([...R1_ROWS.map((r) => r.product), ...POOLS.map((p) => p.product)]);
  return [...types]
    .map((t) => {
      const agg = typeRentPool(t);
      return {
        pool: t,
        rentTotal: Math.round(agg.rent),
        soldTotal: Math.round(agg.sold * 10) / 10,
        lineCount: agg.details.length,
        stockOrders: typeOrders(t).map((o, i) => ({ orderId: `${t}#${i}`, orderName: o.customer, bw: o.bw })),
      };
    })
    .filter((a) => a.lineCount > 0 || a.stockOrders.length > 0);
}

/** 该池的签单快照（含已结算过的，供明细查看） */
export const estsOf = (pool: string) => ests.filter((e) => e.pool === pool);
/** 还没结算过首次月结的签单快照（差异 = 首次结算 − 签单预估） */
export const pendingEstsOf = (pool: string) =>
  ests.filter((e) => e.pool === pool && !runs.some((r) => r.pool === pool && r.lines.some((l) => l.orderId === e.orderId)));

export function addRun(run: PoolSettleRun) {
  runs.push(run);
  bump();
}
