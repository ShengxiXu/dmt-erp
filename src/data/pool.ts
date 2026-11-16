// 出口池（BGP 资源池）一等实体 —— 对应《BGP资源池建模方案 v1.5》
// 口径：
//   - BGP 三网互通 = 自建资源池：三大运营商出口自组、自有 BGP 调度。池是一等资源实体，
//     出口 ↔ 池多对多（一个出口可同时挂多个池，也可单独承接其他产品类型订单）。
//   - 池不替代出口：其他产品类型（AI 专线 / D-MAN / 精品网…）仍按「出口逐单占用」分配。
//   - 池上只见「池订单」（客户向池采购带宽，不指向池内某一条出口）；出口承载明细只列
//     直接挂在该出口上的订单。存量出口上混挂的 BGP 订单在加载时迁移到池（幂等）。
//   - 扩容判断：人工决策，系统不设超售比硬门槛；池已售 + 本单 > 容量时仅给出提示，不阻断。
//   - 负载数据：工程师定期人工实测录入（measureCycleDays 可配，到期未录给出待办提醒徽标），
//     系统不做流量分摊预测，拥塞处置（QoS / BGP 策略）是工程师现场工作，系统不掺和。
//   - IP 段归属池：单向维护——池档案上选挂 IP 段（ipIds），R3 段上不加「归属池」字段。
import { useSyncExternalStore } from "react";
import { persistable } from "./persist";
import { R1_ROWS } from "./resources";
import type { PoolOrder, MeasureRec } from "./resources";
export type { MeasureRec };

export interface PoolDef {
  id: string;          // P-xxx
  name: string;        // 池名称
  product: string;     // 归属产品类型（如 BGP 三网互通）
  exitIds: string[];   // 成员出口（R1 出口 id，多对多）
  ipIds: string[];     // 池上选挂的 IP 段（R3 段 id，单向维护）
  capacityM: number;   // 池容量 = 成员出口容量合计（商用参考，不做减法准入）
  monthlyCost: number; // 池月成本 = 成员出口月租合计
  effect: string;      // 生效日期
  status: string;      // 生效 / 停用
  measureCycleDays: number;  // 负载实测周期（天），到期未录提醒
  dynamic: {
    usedM: number;     // 池已售带宽（池订单合计）
    orders: PoolOrder[];        // 池订单（客户向池采购，不指向具体出口）
    lastMeasuredAt?: string;    // 最近一次实测录入日期
    measures: MeasureRec[];     // 实测留痕（成趋势）
  };
}

// 出厂池：BGP 三网互通资源池（电信/联通/移动三条出口自组）
export const POOLS: PoolDef[] = persistable("pools", () => [
  {
    id: "P-BGP-01", name: "BGP 三网互通资源池", product: "BGP 三网互通",
    exitIds: ["E-CT-1", "I-102", "I-103"],
    ipIds: ["IP-58.41.0", "IP-58.42.0", "IP-58.43.0"],
    capacityM: 2800, monthlyCost: 113000, effect: "2025-01-01", status: "生效",
    measureCycleDays: 30,
    dynamic: { usedM: 0, orders: [], measures: [] },
  },
]);

/** 订单客户名是否属于 BGP 类（存量出口上混挂的 BGP 订单，迁移到池） */
const isBgpOrder = (customer: string): boolean => customer.includes("（BGP");

/** 出厂 BGP 池订单（自愈用：出口已剥离但池为空时按此恢复，防止旧版本快照覆盖导致的数据丢失） */
const BGP_SEED_ORDERS: PoolOrder[] = [
  { customer: "中海贸易（BGP）", bw: 200, since: "2025-09" },
  { customer: "凯瑞传媒（BGP）", bw: 200, since: "2026-02" },
  { customer: "某科技公司（BGP，核算中）", bw: 50, since: "—" },
];

// ---------- 存量迁移（幂等）：把成员出口上挂的 BGP 订单剥到池 ----------
// 老快照里 BGP 客户订单直接挂在出口 orders 上（与 AI 专线 / D-MAN 订单混挂）；
// 迁移后出口的「已售 / 订单明细」只反映直接挂在出口上的业务，池已售单独累计。
function migrateBgpOrders(): void {
  const bgpPool = POOLS.find((p) => p.product === "BGP 三网互通") ?? POOLS[0];
  if (!bgpPool) return;
  for (const exitId of bgpPool.exitIds) {
    const exit = R1_ROWS.find((r) => r.id === exitId);
    if (!exit) continue;
    const moved = exit.dynamic.orders.filter((o) => isBgpOrder(o.customer));
    for (const o of moved) {
      exit.dynamic.orders.splice(exit.dynamic.orders.indexOf(o), 1);
      exit.dynamic.usedM = Math.max(0, exit.dynamic.usedM - o.bw);
      if (!bgpPool.dynamic.orders.some((p) => p.customer === o.customer)) {
        bgpPool.dynamic.orders.push(o);
        bgpPool.dynamic.usedM += o.bw;
      }
    }
  }
  // 自愈：池仍为空（出口早已被剥离、迁移结果未落库等情况）→ 按出厂 BGP 订单恢复一次
  if (bgpPool.dynamic.orders.length === 0) {
    for (const o of BGP_SEED_ORDERS) {
      if (bgpPool.dynamic.orders.some((x) => x.customer === o.customer)) continue;
      bgpPool.dynamic.orders.push({ ...o });
      bgpPool.dynamic.usedM += o.bw;
    }
  }
}
migrateBgpOrders();

// ---------- 变更订阅（实测录入 / 池订单变更后触发重渲染） ----------
const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version += 1;
  listeners.forEach((f) => f());
};
export function usePools(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}

/** 录入一次负载实测（池级）；返回记录。实测人默认当前角色，可在 UI 传入 */
export function measurePool(poolId: string, peakM: number, by: string, at: string, note?: string): MeasureRec | null {
  const pool = POOLS.find((p) => p.id === poolId);
  if (!pool || peakM <= 0) return null;
  const rec: MeasureRec = {
    id: `M-${pool.id}-${String(pool.dynamic.measures.length + 1).padStart(3, "0")}`,
    at, by, peakM, note,
  };
  pool.dynamic.measures.push(rec);
  pool.dynamic.lastMeasuredAt = at;
  bump();
  return rec;
}

/** 池负载实测是否到期未录（用于待办提醒徽标） */
export function poolMeasureDue(pool: PoolDef, today: string): boolean {
  if (!pool.dynamic.lastMeasuredAt) return true;
  const last = new Date(pool.dynamic.lastMeasuredAt).getTime();
  const now = new Date(today).getTime();
  return now - last > pool.measureCycleDays * 86400_000;
}

/** 出口级负载实测是否超期（沿用所属池周期；不在任何池内的出口按 30 天） */
export function exitMeasureDue(exitId: string, today: string): boolean {
  const exit = R1_ROWS.find((r) => r.id === exitId);
  if (!exit) return false;
  const ms = exit.dynamic.measures;
  const lastAt = ms && ms.length ? ms[ms.length - 1].at : undefined;
  if (!lastAt) return true;
  const pool = POOLS.find((p) => p.exitIds.includes(exitId));
  const cycle = pool?.measureCycleDays ?? 30;
  return new Date(today).getTime() - new Date(lastAt).getTime() > cycle * 86400_000;
}

/** 池内成员出口（按档案顺序返回） */
export function poolExits(pool: PoolDef) {
  return pool.exitIds.map((id) => R1_ROWS.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
}

/** 录入一次出口级负载实测（挂在 R1 出口档案上，与池级实测相互独立） */
export function measureExit(exitId: string, peakM: number, by: string, at: string, note?: string): MeasureRec | null {
  const exit = R1_ROWS.find((r) => r.id === exitId);
  if (!exit || peakM <= 0) return null;
  exit.dynamic.measures ??= [];
  const rec: MeasureRec = {
    id: `M-${exit.id}-${String(exit.dynamic.measures.length + 1).padStart(3, "0")}`,
    at, by, peakM, note,
  };
  exit.dynamic.measures.push(rec);
  exit.dynamic.peakM = peakM;
  bump();
  return rec;
}

/** 池容量水位（商用参考）：已售 ÷ 容量；成员出口不存在时容量按 0 计 */
export function poolWater(pool: PoolDef): number {
  return pool.capacityM > 0 ? pool.dynamic.usedM / pool.capacityM : 0;
}

/** 新增一笔池订单（交付绑定 / 核算提交时调用）；幂等：同客户已存在则跳过 */
export function addPoolOrder(poolId: string, order: PoolOrder): void {
  const pool = POOLS.find((p) => p.id === poolId);
  if (!pool || pool.dynamic.orders.some((o) => o.customer === order.customer)) return;
  pool.dynamic.orders.push(order);
  pool.dynamic.usedM += order.bw;
  bump();
}

/** 移除一笔池订单（退订拆机时调用） */
export function removePoolOrder(poolId: string, customer: string): void {
  const pool = POOLS.find((p) => p.id === poolId);
  if (!pool) return;
  const idx = pool.dynamic.orders.findIndex((o) => o.customer === customer);
  if (idx < 0) return;
  pool.dynamic.usedM = Math.max(0, pool.dynamic.usedM - pool.dynamic.orders[idx].bw);
  pool.dynamic.orders.splice(idx, 1);
  bump();
}
