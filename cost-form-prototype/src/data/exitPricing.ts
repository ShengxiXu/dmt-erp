// 出口带宽直接成本 · 两步计价口径（《出口带宽成本计价口径设计 v1.4》定稿，四条前提均已确认）
//   ① 出口租金按「各产品类型在该出口上的已售带宽占比」切分（出口无在役单时全额归归属产品类型）
//   ② 同类型跨出口叠加为「产品类型租金池」，边际计价：池租金 ÷（类型已售 + 本单带宽）× 本单带宽
//      ——回答「新增这一单要花多少钱」，签单锁定快照，月结按签单快照归档、不重算（前提 1）
//   池化单（客户向池采购、不指向具体出口）：池在成员出口上的分摊 ＝ 池已售 × 分摊权重占比，
//      权重默认 ＝ 成员容量占比、可按路由策略在池档案手工修正（前提 2，调整留痕）。
//   台账冲减（退订/变更）以工单完工时点为准（前提 4），保证分母实时准确。
import { CATS, PTYPES } from "./products";
import { R1_ROWS, type R1Row, type PoolOrder } from "./resources";
import { POOLS, type PoolDef } from "./pool";

const fmt1 = (n: number) => Math.round(n * 10) / 10;

/** 全量已知产品类型（识别订单类型标注的合法值） */
const KNOWN_TYPES: string[] = (() => {
  const s = new Set<string>();
  for (const c of CATS()) for (const t of PTYPES(c)) s.add(t);
  return [...s];
})();

/** 订单的产品类型：客户名括号标注（如「云启数据（AI 专线）」「某科技公司（BGP，核算中）」）优先，
 *  标注不是已知产品类型（如「批量 260 户」）或缺失时，归出口归属产品类型 */
export function orderTypeOf(o: PoolOrder, exit: R1Row): string {
  const m = o.customer.match(/（(.+?)）/);
  if (m) {
    const tag = m[1].split(/[，,]/)[0].trim();
    if (KNOWN_TYPES.includes(tag)) return tag;
  }
  return exit.product;
}

/** 池在成员出口上的分摊带宽（分摊权重默认 ＝ 容量占比） */
export function poolAllocOnExit(pool: PoolDef, exitId: string): number {
  if (!pool.exitIds.includes(exitId) || pool.capacityM <= 0) return 0;
  const weightOf = (id: string) =>
    pool.allocWeights?.[id] ?? R1_ROWS.find((r) => r.id === id)?.capacityM ?? 0;
  const total = pool.exitIds.reduce((s, id) => s + weightOf(id), 0);
  return total > 0 ? (pool.dynamic.usedM * weightOf(exitId)) / total : 0;
}

/** 出口上某产品类型的已售带宽 ＝ 直挂订单（按订单类型标注）＋ 该类型池分摊 */
export function exitTypeSold(exit: R1Row, type: string): number {
  const direct = exit.dynamic.orders
    .filter((o) => orderTypeOf(o, exit) === type)
    .reduce((s, o) => s + o.bw, 0);
  const viaPool = POOLS
    .filter((p) => p.product === type && p.exitIds.includes(exit.id))
    .reduce((s, p) => s + poolAllocOnExit(p, exit.id), 0);
  return direct + viaPool;
}

/** 出口上全部类型的已售带宽合计（直挂订单 ＋ 所有挂在本出口的池分摊） */
export function exitTotalSold(exit: R1Row): number {
  const direct = exit.dynamic.orders.reduce((s, o) => s + o.bw, 0);
  const viaPool = POOLS
    .filter((p) => p.exitIds.includes(exit.id))
    .reduce((s, p) => s + poolAllocOnExit(p, exit.id), 0);
  return direct + viaPool;
}

export interface RentSplitPart { type: string; rent: number; sold: number }
/** ① 一条出口租金按各类型已售占比切分（无在役单 → 全额归归属产品类型） */
export function exitRentSplit(exit: R1Row): RentSplitPart[] {
  const byType = new Map<string, number>();
  for (const o of exit.dynamic.orders) {
    const t = orderTypeOf(o, exit);
    byType.set(t, (byType.get(t) ?? 0) + o.bw);
  }
  for (const p of POOLS) {
    if (!p.exitIds.includes(exit.id)) continue;
    const t = p.product;
    byType.set(t, (byType.get(t) ?? 0) + poolAllocOnExit(p, exit.id));
  }
  const total = [...byType.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [{ type: exit.product, rent: exit.monthlyCost, sold: 0 }];
  return [...byType.entries()]
    .map(([type, sold]) => ({ type, rent: (exit.monthlyCost * sold) / total, sold }))
    .sort((a, b) => b.rent - a.rent);
}

export interface TypeRentPool {
  type: string;
  rent: number;                    // 类型租金池 ＝ 各出口切给该类型的租金加总（② 跨出口叠加）
  sold: number;                    // 类型已售带宽合计（含池化分摊）
  details: { exitId: string; rent: number; sold: number }[];
}
/** ② 产品类型租金池：各出口切给该类型的租金跨出口叠加 */
export function typeRentPool(type: string): TypeRentPool {
  const details: TypeRentPool["details"] = [];
  let rent = 0;
  let sold = 0;
  for (const exit of R1_ROWS) {
    if (exit.status !== "生效") continue;
    const ts = exitTypeSold(exit, type);
    const share = exitRentSplit(exit).find((x) => x.type === type)?.rent ?? 0;
    if (ts <= 0 && share <= 0) continue;
    rent += share;
    sold += ts;
    details.push({ exitId: exit.id, rent: share, sold: ts });
  }
  return { type, rent, sold, details };
}

/** 边际计价（签单预估口径）：本单成本 ＝ 类型租金池 ÷（类型已售 + 本单带宽）× 本单带宽 */
export function marginalCost(type: string, bw: number): { cost: number; pool: TypeRentPool } {
  const pool = typeRentPool(type);
  const cost = pool.sold + bw > 0 ? (pool.rent / (pool.sold + bw)) * bw : 0;
  return { cost, pool };
}

/** 该类型的全部在役订单（直挂 ＋ 池订单），供月结归集/明细展示 */
export function typeOrders(type: string): PoolOrder[] {
  const direct = R1_ROWS.flatMap((r) => r.dynamic.orders.filter((o) => orderTypeOf(o, r) === type));
  const viaPool = POOLS.filter((p) => p.product === type).flatMap((p) => p.dynamic.orders);
  return [...direct, ...viaPool];
}

/** 池的分摊权重展示文本（默认容量占比） */
export function poolAllocText(pool: PoolDef, exitId: string): string {
  const exit = R1_ROWS.find((r) => r.id === exitId);
  const w = pool.allocWeights?.[exitId] ?? exit?.capacityM ?? 0;
  const isCustom = pool.allocWeights?.[exitId] != null;
  return `${fmt1(w)}${isCustom ? "（手工权重）" : `（容量 ${fmt1(w)}M）`}`;
}
