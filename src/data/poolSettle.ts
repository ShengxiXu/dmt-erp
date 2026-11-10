// 出口池直接成本 · 两阶段计收（共用计收模式的完整闭环）
//   ① 签单（提交审批那一刻）：锁定「预估快照」——当时池月租合计 / 已售带宽合计 / 本单预估成本，作为报价与审批依据，事后不改；
//   ② 月结：真实账期到了，按当月实际已售带宽重算每一单的结算成本；差异进当月，不追溯改已签核算单；
//   ③ 未售出的闲置容量由全池客户按带宽占比共担（新单进来，老单分摊自然下降，这是共用模式的正常表现）。
import { persistable } from "@/data/persist";
import { useSyncExternalStore } from "react";
import { SOURCES } from "./catalog";
import { demoNow } from "./settings";

/** 签单时锁定的预估快照（一条 = 一单在一个出口池的占用） */
export interface PoolEst {
  orderId: string;          // 订单行 id
  orderName: string;        // 订单行名称（客户 + 带宽）
  pool: string;             // 出口池 = 归属产品类型
  lineIds: string[];        // 选中的出口线路
  bw: number;               // 本单带宽（M）
  rentTotal: number;        // 签单时池月租合计
  soldTotal: number;        // 签单时池已售带宽合计
  est: number;              // 预估月成本 = rentTotal ÷ (soldTotal + bw) × bw
  at: string;               // 锁存时间
}

export interface PoolSettleLine {
  orderId: string; orderName: string; bw: number;
  /** 签单预估（存量单没有快照则为 null） */
  est: number | null;
  settle: number;           // 结算 = 当月实际 rent ÷ sold × bw
  diff: number | null;      // 结算 − 预估（未结算过才有差异概念）
}

export interface PoolSettleRun {
  id: string; period: string; pool: string;
  rentTotal: number; soldTotal: number;   // 当月实际口径
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

/** 从出口线路档案聚合出口池（同归属产品类型的所有线路合并：月租合计 / 已售合计） */
export interface PoolAgg {
  pool: string;
  rentTotal: number;      // 池月租合计
  soldTotal: number;      // 已售带宽合计（档案当前值）
  lineCount: number;
  /** 存量订单（档案里已承载的客户，无签单快照） */
  stockOrders: { orderId: string; orderName: string; bw: number }[];
}
export function poolList(): PoolAgg[] {
  const map = new Map<string, PoolAgg>();
  for (const r of SOURCES.lineinternet.rows) {
    if (!r.ptag || !r.pool) continue;
    const g = map.get(r.ptag) ?? { pool: r.ptag, rentTotal: 0, soldTotal: 0, lineCount: 0, stockOrders: [] };
    g.rentTotal += Number(r.meta || 0);
    g.soldTotal += r.pool.usedM;
    g.lineCount += 1;
    r.pool.orders.forEach((o, i) => g.stockOrders.push({
      orderId: `${r.id}#${i}`, orderName: o.customer, bw: o.bw,
    }));
    map.set(r.ptag, g);
  }
  return [...map.values()];
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
