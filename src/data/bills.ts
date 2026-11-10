// 供应商账单 —— 采购侧真实支出凭证，成本中心月费用的「真实水位」来源
// 关联链路（最短路径，全程无需手选订单）：
//   录入账单（供应商 + 账期 + 金额 + 费用归类）→ 费用归类即成本条目，自动带出归属（直接成本随单算 / 间接费用归集成本中心）
//   → 核算单填报时按归属引用账单（来源单号 = 账单号）
//   → 核算单挂在合同上，账单经「账单 → 耗用 → 核算单 → 合同」间接关联订单
// 月结时：中心内账单金额合计 = 中心真实费用，与核算预估切分对比，差异留中心滚动。
import { persistable } from "@/data/persist";
import { useSyncExternalStore } from "react";
import { getCostItems } from "./costItems";
import { CC_NAME, getCenters } from "./costCenters";
import { DEMO_TODAY } from "./settings";

export type BillStatus = "待入账" | "已入账" | "已月结";

export interface SupplierBill {
  id: string;              // 账单号（入账后 = 核算单「账本耗用单」的来源单号）
  supplier: string;        // 供应商
  period: string;          // 账期（YYYY-MM）
  costItemKey: string;     // 费用归类 → 成本条目（决定直接/间接口径与归集成本中心）
  amount: number;          // 金额（元）
  poNo?: string;           // 关联采购单号（一次性类：设备 / 按单线路）
  contractNo?: string;     // 关联采购合同号（周期性月租类；见「采购合同」主数据）
  resRef?: string;         // 关联资源（可空：账单归属哪个资源档案，便于按资源查账）
  status: BillStatus;
  note?: string;
  createdAt: string;
  source?: "手工录入" | "邮件导入";  // 来源（邮件导入的账单可回溯到原始邮件）
  emailId?: string;                 // 来源邮件 id（EM-2026-xxxx）
  diff?: {                          // 邮件导入核对差异留痕（无差异不带此字段）
    expected: number;               // 系统基准（采购合同价）
    diff: number;                   // 账单 − 基准
    reason?: string;                // 差异原因（按实入账时登记）
    handle: "按实入账" | "暂挂对账";
  };
}

// ---------- 预置账单（号段与核算单演示数据的来源单号一致，可直接被引用） ----------
export const bills: SupplierBill[] = persistable("supplierBills", () => [
  { id: "HY-2026-1013", supplier: "上海电信", period: "2026-10", costItemKey: "op1a", amount: 500, poNo: "PO-2026-028", resRef: "B-001", status: "已入账", createdAt: "2026-10-08" },
  { id: "HY-2026-1014", supplier: "上海电信", period: "2026-10", costItemKey: "op1b", amount: 45000, contractNo: "CT-2026-018", resRef: "E-CT-1", status: "已入账", note: "BGP 电信出口（E-CT-1）月租，并入 BGP 三网出口池按已售带宽计收", createdAt: "2026-10-08" },
  { id: "HY-2026-1015", supplier: "中国电信长途传输", period: "2026-10", costItemKey: "op1a", amount: 6800, poNo: "PO-2026-029", resRef: "B-201", status: "已入账", createdAt: "2026-10-09" },
  { id: "HY-2026-1016", supplier: "APNIC 代管服务商", period: "2026-10", costItemKey: "op6", amount: 12480, resRef: "I-101", status: "已入账", note: "C 段地址年费摊月", createdAt: "2026-10-10" },
  { id: "HY-2026-1017", supplier: "漕河泾机房物业", period: "2026-10", costItemKey: "t2", amount: 6400, resRef: "I-101", status: "已入账", note: "漕河泾机房 10G 上联端口月租", createdAt: "2026-10-10" },
  { id: "HY-2026-1018", supplier: "漕河泾机房物业", period: "2026-10", costItemKey: "op5", amount: 12800, status: "待入账", note: "整柜电力月租，待核对", createdAt: "2026-10-27" },
]);

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
export function useBills(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}
export const getBills = () => bills;

// 单号计数器 box 持久化（快照捕获引用，基本类型 reassignment 会丢）
const seqBox = persistable("bills.seq", () => ({ v: 1019 }));
export function addBill(patch: Omit<SupplierBill, "id" | "status" | "createdAt">) {
  const b: SupplierBill = {
    ...patch,
    id: `HY-2026-${seqBox.v++}`,
    status: "待入账",
    createdAt: DEMO_TODAY,
  };
  bills.unshift(b);
  bump();
  return b.id;
}

export function setBillStatus(id: string, status: BillStatus) {
  const b = bills.find((x) => x.id === id);
  if (b) {
    b.status = status;
    bump();
  }
}

/** 费用归类 → 记到哪（直接成本随单算；间接费用归集到所属成本中心） */
export const billCenter = (costItemKey: string): string => {
  const it = getCostItems().find((i) => i.key === costItemKey);
  if (!it) return "—（未归类）";
  if (it.settleType !== "间接") return "随单直接成本";
  return it.costCenter ? CC_NAME(it.costCenter) : "—（未选成本中心）";
};

/** 费用归类 → 归属成本中心 id（仅间接条目有；直接成本返回 null） */
export const centerOfBill = (costItemKey: string): string | null => {
  const it = getCostItems().find((i) => i.key === costItemKey);
  return it && it.settleType === "间接" && it.costCenter ? it.costCenter : null;
};
/** 最近有账单的账期（成本中心页「当月归集」默认账期） */
export const latestBillPeriod = (): string => [...bills.map((b) => b.period)].sort().at(-1) ?? "";
/** 中心在某账期的归集水位：已入账（含已月结）账单金额合计 + 张数 */
export function centerPeriodTotal(centerId: string, period: string): { total: number; count: number } {
  const keys = new Set(getCenters().find((c) => c.id === centerId)?.itemKeys ?? []);
  const hit = bills.filter((b) => b.period === period && b.status !== "待入账" && keys.has(b.costItemKey));
  return { total: hit.reduce((s, b) => s + b.amount, 0), count: hit.length };
}
